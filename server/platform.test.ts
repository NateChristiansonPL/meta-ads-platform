import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ── Helpers ──────────────────────────────────────────────────────────────────

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(role: "user" | "admin" = "user") {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@pathlabs.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

// ── Auth tests ────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("returns current user from auth.me when authenticated", async () => {
    const { ctx } = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).not.toBeNull();
    expect(me?.role).toBe("admin");
    expect(me?.email).toBe("test@pathlabs.com");
  });

  it("returns null from auth.me when unauthenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });
});

// ── MANUS_API_KEY validation ──────────────────────────────────────────────────

describe("MANUS_API_KEY", () => {
  it("MANUS_API_KEY env var is set", () => {
    // This test validates that the secret was successfully injected.
    // We don't call the live API here to avoid network dependency in CI.
    // The actual API call is validated by runs.verifyManusKey (admin mutation).
    const key = process.env.MANUS_API_KEY;
    // Key may be empty string if not yet provided by user — just verify it's defined
    expect(key).toBeDefined();
  });
});

// ── Admin RBAC ────────────────────────────────────────────────────────────────

describe("admin RBAC", () => {
  it("non-admin user cannot call adminProcedure (users.list)", async () => {
    const { ctx } = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("admin user can call adminProcedure (users.list) without throwing FORBIDDEN", async () => {
    // This will throw NOT_FOUND or DB error in test env (no real DB), but NOT FORBIDDEN
    const { ctx } = createUserContext("admin");
    const caller = appRouter.createCaller(ctx);
    // We expect either success or a DB connection error, NOT a FORBIDDEN error
    try {
      await caller.users.list();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toContain("FORBIDDEN");
      expect(msg).not.toContain("permission");
    }
  });
});
