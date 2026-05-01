/**
 * Magic link authentication for invited users.
 *
 * Flow:
 *  1. Admin creates invite → tRPC users.sendInvite → stores invite record with token
 *  2. Admin copies link: /api/invite/accept?token=<token>
 *  3. Invitee clicks link → GET /api/invite/accept?token=<token>
 *     → validates token (not expired, not already used)
 *     → creates/finds user with authProvider='invited'
 *     → marks invite as accepted
 *     → sets session cookie (1-year)
 *     → redirects to /dashboard
 *
 * No external OAuth credentials required.
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

export function registerMagicLinkRoutes(app: Express) {
  /**
   * Magic link acceptance endpoint.
   * GET /api/invite/accept?token=<token>
   */
  app.get("/api/invite/accept", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : undefined;

    if (!token) {
      res.status(400).send(renderErrorPage("Missing invite token", "The invite link is incomplete. Please ask your admin to resend the invite."));
      return;
    }

    try {
      const invite = await db.getInviteByToken(token);

      if (!invite) {
        res.status(404).send(renderErrorPage("Invite not found", "This invite link is invalid or has already been used. Please ask your admin to send a new invite."));
        return;
      }

      if (invite.acceptedAt) {
        res.status(410).send(renderErrorPage("Invite already used", "This invite link has already been used. If you need access, please ask your admin to send a new invite."));
        return;
      }

      // Use email as the stable identifier for invited users
      const openId = `invited:${invite.email.toLowerCase()}`;
      const name = invite.name || invite.email.split("@")[0];

      // Create or update the user record
      await db.upsertUser({
        openId,
        name,
        email: invite.email,
        loginMethod: "magic_link",
        authProvider: "invited",
        isTeamMember: false,
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.status(500).send(renderErrorPage("Account error", "Failed to create your account. Please try again or contact your admin."));
        return;
      }

      // Mark invite as accepted
      await db.acceptInvite(token, user.id);

      // Create a long-lived session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[MagicLink] Accept failed", error);
      res.status(500).send(renderErrorPage("Something went wrong", "An unexpected error occurred. Please try again or contact your admin."));
    }
  });
}

/** Render a branded error page instead of a plain text error */
function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Pathlabs Intelligence</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #141349;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1rem;
      padding: 2.5rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 56px; height: 56px;
      background: rgba(237,19,95,0.12);
      border: 1px solid rgba(237,19,95,0.3);
      border-radius: 1rem;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem;
      font-size: 1.5rem;
    }
    h1 { color: #FAFAFA; font-size: 1.25rem; font-weight: 800; margin-bottom: 0.75rem; }
    p { color: rgba(255,255,255,0.45); font-size: 0.8rem; line-height: 1.6; margin-bottom: 1.5rem; }
    a {
      display: inline-block;
      background: #00BEEF;
      color: #141349;
      font-weight: 700;
      font-size: 0.8rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
    }
    a:hover { background: #00d4f5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/login">Back to Login</a>
  </div>
</body>
</html>`;
}
