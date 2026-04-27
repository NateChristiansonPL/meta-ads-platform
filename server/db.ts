import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appSettings,
  InsertSkillRun,
  InsertTokenVaultEntry,
  InsertUser,
  knowledgeBase,
  skillRuns,
  tokenVault,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

// ── Token Vault ────────────────────────────────────────────────────────────────

export async function getActiveTokens() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: tokenVault.id,
    label: tokenVault.label,
    businessManagerId: tokenVault.businessManagerId,
    businessManagerName: tokenVault.businessManagerName,
    tokenExpiresAt: tokenVault.tokenExpiresAt,
    isActive: tokenVault.isActive,
    addedByUserId: tokenVault.addedByUserId,
    createdAt: tokenVault.createdAt,
    updatedAt: tokenVault.updatedAt,
  }).from(tokenVault).where(eq(tokenVault.isActive, true)).orderBy(desc(tokenVault.createdAt));
}

export async function getAllTokens() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: tokenVault.id,
    label: tokenVault.label,
    businessManagerId: tokenVault.businessManagerId,
    businessManagerName: tokenVault.businessManagerName,
    tokenExpiresAt: tokenVault.tokenExpiresAt,
    isActive: tokenVault.isActive,
    addedByUserId: tokenVault.addedByUserId,
    createdAt: tokenVault.createdAt,
    updatedAt: tokenVault.updatedAt,
  }).from(tokenVault).orderBy(desc(tokenVault.createdAt));
}

export async function getTokenById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(tokenVault).where(eq(tokenVault.id, id)).limit(1);
  return rows[0];
}

export async function insertToken(entry: InsertTokenVaultEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(tokenVault).values(entry);
  return (result as { insertId: number }).insertId;
}

export async function updateToken(id: number, patch: Partial<InsertTokenVaultEntry>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(tokenVault).set(patch).where(eq(tokenVault.id, id));
}

export async function deactivateToken(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(tokenVault).set({ isActive: false }).where(eq(tokenVault.id, id));
}

// ── Skill Runs ────────────────────────────────────────────────────────────────

export async function createSkillRun(run: InsertSkillRun): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(skillRuns).values(run);
  return (result as { insertId: number }).insertId;
}

export async function updateSkillRun(
  id: number,
  patch: {
    status?: "success" | "error" | "running";
    reportMarkdown?: string;
    errorMessage?: string;
    taskUrl?: string;
    attachments?: Array<{ filename: string; url: string; contentType: string }>;
    statusLog?: Array<{ ts: number; msg: string }>;
    durationMs?: number;
    creditUsage?: number | null;
    agentProfile?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  // Only set completedAt when the run is actually finishing (not for mid-run statusLog flushes)
  const isFinishing = patch.status === "success" || patch.status === "error";
  await db.update(skillRuns).set({
    ...patch,
    ...(isFinishing ? { completedAt: new Date() } : {}),
  }).where(eq(skillRuns.id, id));
}

export async function getRecentRuns(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: skillRuns.id,
    userId: skillRuns.userId,
    skillId: skillRuns.skillId,
    skillName: skillRuns.skillName,
    status: skillRuns.status,
    adAccountId: skillRuns.adAccountId,
    adAccountName: skillRuns.adAccountName,
    datePreset: skillRuns.datePreset,
    durationMs: skillRuns.durationMs,
    creditUsage: skillRuns.creditUsage,
    agentProfile: skillRuns.agentProfile,
    campaignIds: skillRuns.campaignIds,
    startedAt: skillRuns.startedAt,
    completedAt: skillRuns.completedAt,
    userName: users.name,
    userEmail: users.email,
  })
    .from(skillRuns)
    .leftJoin(users, eq(skillRuns.userId, users.id))
    .orderBy(desc(skillRuns.startedAt))
    .limit(limit);
}

export async function getRunsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(skillRuns)
    .where(eq(skillRuns.userId, userId))
    .orderBy(desc(skillRuns.startedAt))
    .limit(limit);
}
export async function getRunsByUserAndSkill(userId: number, skillId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(skillRuns)
    .where(and(eq(skillRuns.userId, userId), eq(skillRuns.skillId, skillId)))
    .orderBy(desc(skillRuns.startedAt))
    .limit(limit);
}

export async function getRunById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(skillRuns).where(eq(skillRuns.id, id)).limit(1);
  return rows[0];
}

export async function getUserSuccessCounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    userId: skillRuns.userId,
    userName: users.name,
    userEmail: users.email,
    count: sql<number>`COUNT(*)`,
  })
    .from(skillRuns)
    .leftJoin(users, eq(skillRuns.userId, users.id))
    .where(eq(skillRuns.status, "success"))
    .groupBy(skillRuns.userId, users.name, users.email);
}

export async function getSkillSuccessCounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    skillId: skillRuns.skillId,
    skillName: skillRuns.skillName,
    count: sql<number>`COUNT(*)`,
  })
    .from(skillRuns)
    .where(eq(skillRuns.status, "success"))
    .groupBy(skillRuns.skillId, skillRuns.skillName);
}

export async function getCreditsByUser() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    userId: skillRuns.userId,
    userName: users.name,
    userEmail: users.email,
    totalCredits: sql<number>`COALESCE(SUM(${skillRuns.creditUsage}), 0)`,
    runCount: sql<number>`COUNT(*)`,
    avgCredits: sql<number>`COALESCE(AVG(${skillRuns.creditUsage}), 0)`,
  })
    .from(skillRuns)
    .leftJoin(users, eq(skillRuns.userId, users.id))
    .groupBy(skillRuns.userId, users.name, users.email)
    .orderBy(sql`COALESCE(SUM(${skillRuns.creditUsage}), 0) DESC`);
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

export async function getKnowledgeEntries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeBase)
    .where(eq(knowledgeBase.isActive, true))
    .orderBy(desc(knowledgeBase.createdAt));
}

export async function createKnowledgeEntry(entry: { title: string; category: string; content: string; addedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [result] = await db.insert(knowledgeBase).values({ ...entry, isActive: true });
  return (result as { insertId: number }).insertId;
}

export async function deleteKnowledgeEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(knowledgeBase).set({ isActive: false }).where(eq(knowledgeBase.id, id));
}

// ── App Settings ─────────────────────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setAppSetting(key: string, value: string, updatedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(appSettings)
    .values({ key, value, updatedByUserId })
    .onDuplicateKeyUpdate({ set: { value, updatedByUserId } });
}

export async function getAllAppSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
