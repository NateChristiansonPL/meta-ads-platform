/**
 * Google Sheets helper for write-back after Meta ad creation.
 *
 * Uses the bundled service account key to obtain a short-lived OAuth2 access
 * token via the JWT Bearer flow, then calls the Sheets v4 REST API.
 *
 * The SA key is read from GOOGLE_SA_KEY_JSON env var (JSON string) or falls
 * back to the bundled key path for local development.
 */

import { SignJWT, importPKCS8 } from "jose";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── SA key loading ────────────────────────────────────────────────────────────

interface SaKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function loadSaKey(): SaKey {
  // 1. Prefer env var (production / secrets)
  const envJson = process.env.GOOGLE_SA_KEY_JSON;
  if (envJson) {
    return JSON.parse(envJson) as SaKey;
  }
  // 2. Fallback: bundled key (local dev / sandbox)
  const bundledPath = path.resolve(
    __dirname,
    "../../../skills/pl-campaign-creation/scripts/google_sa_key.json"
  );
  if (fs.existsSync(bundledPath)) {
    return JSON.parse(fs.readFileSync(bundledPath, "utf8")) as SaKey;
  }
  throw new Error(
    "Google SA key not found. Set GOOGLE_SA_KEY_JSON env var or bundle the key."
  );
}

// ── Token cache ───────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now() / 1000;
  if (_cachedToken && _tokenExpiry - now > 60) return _cachedToken;

  const sa = loadSaKey();
  const privateKey = await importPKCS8(sa.private_key, "RS256");

  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/spreadsheets",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(sa.client_email)
    .setAudience(sa.token_uri)
    .setExpirationTime("1h")
    .sign(privateKey);

  const resp = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google token exchange failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  _cachedToken = data.access_token;
  _tokenExpiry = now + data.expires_in;
  return _cachedToken;
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

export interface ValueRange {
  range: string; // e.g. "Export!AM2"
  values: (string | number | null)[][];
}

/**
 * Write multiple ranges to a Google Sheet in a single batchUpdate call.
 */
export async function sheetsValuesBatchUpdate(
  spreadsheetId: string,
  data: ValueRange[]
): Promise<void> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values:batchUpdate`;

  const body = {
    valueInputOption: "USER_ENTERED",
    data,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets batchUpdate failed: ${resp.status} ${text}`);
  }
}

/**
 * Read a range from a Google Sheet.
 */
export async function sheetsValuesGet(
  spreadsheetId: string,
  range: string
): Promise<(string | number | null)[][]> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets values.get failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as { values?: (string | number | null)[][] };
  return data.values ?? [];
}

/**
 * Extract the spreadsheet ID from a Google Sheets URL.
 * Accepts full URLs like https://docs.google.com/spreadsheets/d/{id}/edit
 * or bare IDs.
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Assume it's already a bare ID
  return urlOrId.trim();
}
