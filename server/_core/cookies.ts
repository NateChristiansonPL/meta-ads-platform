import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string | undefined): boolean {
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isLocalRequest(req: Request): boolean {
  const hostname = req.hostname;
  if (!hostname) return false;
  return LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const local = isLocalRequest(req);

  if (local) {
    // Local dev: http://localhost — Secure must be false;
    // SameSite=None requires Secure=true so we fall back to Lax here.
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    };
  }

  // Production / deployed: always HTTPS.
  // Secure=true is REQUIRED for SameSite=None to be honoured by the browser.
  // Without it the cookie is silently dropped after the cross-site OAuth
  // redirect, causing the session to appear missing on the very next request.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
  };
}
