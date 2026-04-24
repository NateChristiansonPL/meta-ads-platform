import { COOKIE_NAME, EIGHT_HOURS_MS, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const ALLOWED_DOMAIN = "pathlabs.com";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function accessDeniedHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Access Denied — Pathlabs Intelligence</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #141349;
      font-family: 'Montserrat', system-ui, sans-serif;
      color: #FAFAFA;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 48px 40px;
      max-width: 420px;
      width: 90%;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: rgba(237,19,95,0.12);
      border: 1px solid rgba(237,19,95,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
    }
    h1 { font-size: 22px; font-weight: 900; margin-bottom: 10px; }
    .sub { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.6; margin-bottom: 8px; }
    .email { font-size: 12px; color: rgba(255,255,255,0.25); margin-bottom: 32px; word-break: break-all; }
    a {
      display: inline-block;
      background: #00BEEF;
      color: #141349;
      font-weight: 700;
      font-size: 13px;
      padding: 12px 28px;
      border-radius: 12px;
      text-decoration: none;
    }
    a:hover { background: #00d4f5; }
    .footer { margin-top: 24px; font-size: 11px; color: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x1F512;</div>
    <h1>Access Restricted</h1>
    <p class="sub">This platform is only available to <strong>@${ALLOWED_DOMAIN}</strong> team members.</p>
    <p class="email">Signed in as: ${email || "unknown account"}</p>
    <a href="/">Try a different account</a>
    <p class="footer">Contact your team admin if you believe this is an error.</p>
  </div>
</body>
</html>`;
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

      // ── Domain restriction ──────────────────────────────────────────────
      const email = userInfo.email ?? "";
      const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
      if (emailDomain !== ALLOWED_DOMAIN) {
        res.status(403).send(accessDeniedHtml(email));
        return;
      }

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
