import { COOKIE_NAME, EIGHT_HOURS_MS, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Checks whether a given Manus openId appears in the team's membership list
 * by calling the Manus API /v2/usage.teamLog with the admin MANUS_API_KEY.
 *
 * Returns true  → user is on the team plan (login allowed).
 * Returns false → user is on a personal account (login denied).
 *
 * Fails gracefully: if the API call fails or the key is not configured,
 * returns false so personal-account users are blocked by default.
 *
 * Also returns true for the app owner (OWNER_OPEN_ID) so the admin is
 * never locked out even if they have zero usage history.
 */
async function checkIsTeamMember(openId: string): Promise<boolean> {
  // Always allow the app owner (admin) regardless of usage history
  const ownerOpenId = process.env.OWNER_OPEN_ID;
  if (ownerOpenId && openId === ownerOpenId) return true;

  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) return false;

  try {
    // Fetch up to 500 team log entries across a wide date range to catch
    // members who haven't used credits recently (new members, low-usage members)
    const url = `https://api.manus.im/v2/usage.teamLog?limit=500`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      // permission_denied → personal account key, not a team key
      // Any other error → fail closed (deny login)
      return false;
    }

    const data = (await resp.json()) as { items?: Array<{ user_id?: string }> };
    const memberIds = new Set(
      (data.items ?? []).map((item) => item.user_id).filter(Boolean)
    );
    return memberIds.has(openId);
  } catch {
    // Network error, timeout, or unexpected shape — fail closed
    return false;
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // ── Team membership check ──────────────────────────────────────────────
      // Only users whose openId appears in the Manus team membership list
      // (or the app owner) are allowed to create a session.
      // Personal-account users are redirected to /login?error=not_team_member.
      const isTeamMember = await checkIsTeamMember(userInfo.openId);

      if (!isTeamMember) {
        // Deny the session — do NOT set a cookie
        res.redirect(302, "/login?error=not_team_member");
        return;
      }

      const email = userInfo.email ?? "";

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: email || null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        isTeamMember: true,
      });

      // ── Remember this device ────────────────────────────────────────────
      // Frontend encodes state as btoa(redirectUri + "|remember=1") when the
      // "Remember this device" checkbox is checked. Default: 8-hour session.
      let rememberDevice = false;
      try {
        const decoded = atob(state);
        rememberDevice = decoded.includes("|remember=1");
      } catch {
        // malformed state — ignore, use default
      }
      const sessionDurationMs = rememberDevice ? ONE_YEAR_MS : EIGHT_HOURS_MS;

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: sessionDurationMs,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: sessionDurationMs });
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
