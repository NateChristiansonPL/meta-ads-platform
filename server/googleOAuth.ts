/**
 * Google OAuth routes for invited users.
 *
 * Flow:
 *  1. Admin sends invite → POST /api/invites/send (tRPC) → stores invite record, emails link
 *  2. Invitee clicks link → GET /api/invite/accept?token=<token>
 *     → validates token → redirects to Google OAuth with state=<token>
 *  3. Google redirects back → GET /api/oauth/google/callback?code=<code>&state=<token>
 *     → exchanges code for user info → creates/updates user with authProvider='google'
 *     → marks invite as accepted → sets session cookie → redirects to /dashboard
 *
 * Google OAuth credentials must be set in env:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import type { Express, Request, Response } from "express";
import axios from "axios";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getGoogleRedirectUri(req: Request): string {
  // Use the origin from the request host to build the redirect URI
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  return `${proto}://${host}/api/oauth/google/callback`;
}

export function registerGoogleOAuthRoutes(app: Express) {
  /**
   * Step 2: Validate invite token and redirect to Google OAuth consent screen.
   * GET /api/invite/accept?token=<token>
   */
  app.get("/api/invite/accept", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!token) {
      res.status(400).send("Missing invite token");
      return;
    }

    const invite = await db.getInviteByToken(token);
    if (!invite) {
      res.status(404).send("Invite not found or already used");
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).send("Google OAuth is not configured");
      return;
    }

    const redirectUri = getGoogleRedirectUri(req);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: token,
      // Hint the email so Google pre-fills the account picker
      login_hint: invite.email,
      prompt: "select_account",
    });

    res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  /**
   * Step 3: Google OAuth callback.
   * GET /api/oauth/google/callback?code=<code>&state=<invite_token>
   */
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const inviteToken = typeof req.query.state === "string" ? req.query.state : undefined;

    if (!code || !inviteToken) {
      res.status(400).send("Missing code or state");
      return;
    }

    const invite = await db.getInviteByToken(inviteToken);
    if (!invite) {
      res.status(404).send("Invite not found or already used");
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).send("Google OAuth is not configured");
      return;
    }

    try {
      const redirectUri = getGoogleRedirectUri(req);

      // Exchange code for tokens
      const tokenResp = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

      const { access_token } = tokenResp.data as { access_token: string };

      // Fetch user info
      const userInfoResp = await axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const googleUser = userInfoResp.data as {
        sub: string;
        email: string;
        name?: string;
        given_name?: string;
      };

      // Verify the Google email matches the invite email (case-insensitive)
      if (googleUser.email.toLowerCase() !== invite.email.toLowerCase()) {
        res.status(403).send(
          `This invite was sent to ${invite.email}. Please sign in with that Google account.`
        );
        return;
      }

      // openId for Google users: "google:<sub>"
      const openId = `google:${googleUser.sub}`;
      const name = invite.name || googleUser.name || googleUser.given_name || googleUser.email.split("@")[0];

      await db.upsertUser({
        openId,
        name,
        email: googleUser.email,
        loginMethod: "google",
        authProvider: "google",
        isTeamMember: false,
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.status(500).send("Failed to create user");
        return;
      }

      // Mark invite as accepted
      await db.acceptInvite(inviteToken, user.id);

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).send("Google OAuth callback failed");
    }
  });
}
