import { COOKIE_NAME, EIGHT_HOURS_MS, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
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

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: email || null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
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
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
