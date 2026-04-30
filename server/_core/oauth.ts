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
 * Returns true  → user is on the team plan (skill runs allowed).
 * Returns false → user is on a personal account (skill runs blocked).
 *
 * Fails gracefully: if the API call fails or the key is not configured,
 * returns false so personal-account users are blocked by default.
 */
async function checkIsTeamMember(openId: string): Promise<boolean> {
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) return false;

  try {
    // Fetch up to 200 team log entries (covers most teams)
    const url = `https://api.manus.im/v2/usage.teamLog?limit=200`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      // permission_denied → personal account key, not a team key
      return false;
    }

    const data = (await resp.json()) as { items?: Array<{ user_id?: string }> };
    const memberIds = new Set(
      (data.items ?? []).map((item) => item.user_id).filter(Boolean)
    );
    return memberIds.has(openId);
  } catch {
    // Network error, timeout, or unexpected shape — default to false
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

      // ── Access control: any authenticated Manus user on the team plan is allowed ──
      // No domain restriction — the Manus OAuth app itself acts as the gate.
      // Only users with a valid Manus account connected to this OAuth app can log in.
      const email = userInfo.email ?? "";

      // ── Team membership check ──────────────────────────────────────────────
      // Verify whether this user's openId appears in the Manus team membership
      // list. Team members can run skills; personal-account users cannot.
      const isTeamMember = await checkIsTeamMember(userInfo.openId);

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: email || null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        isTeamMember,
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
