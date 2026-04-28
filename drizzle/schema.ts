import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Meta API Token Vault ──────────────────────────────────────────────────────
// Admins store long-lived Meta user access tokens here.
// Each token is associated with a Business Manager.
// All users share these tokens (they don't need their own).

export const tokenVault = mysqlTable("token_vault", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  businessManagerId: varchar("businessManagerId", { length: 64 }).notNull(),
  businessManagerName: varchar("businessManagerName", { length: 255 }),
  accessToken: text("accessToken").notNull(),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  addedByUserId: int("addedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TokenVaultEntry = typeof tokenVault.$inferSelect;
export type InsertTokenVaultEntry = typeof tokenVault.$inferInsert;

// ── Skill Run Log ─────────────────────────────────────────────────────────────
// Every time a user runs a skill, we record it here.

export const skillRuns = mysqlTable("skill_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  skillId: varchar("skillId", { length: 64 }).notNull(),
  skillName: varchar("skillName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["running", "success", "error"]).default("running").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }),
  adAccountName: varchar("adAccountName", { length: 255 }),
  businessManagerId: varchar("businessManagerId", { length: 64 }),
  datePreset: varchar("datePreset", { length: 64 }),
  campaignIds: json("campaignIds").$type<string[]>().default([]),
  extraParams: json("extraParams").$type<Record<string, unknown>>().default({}),
  reportMarkdown: text("reportMarkdown"),
  errorMessage: text("errorMessage"),
  taskUrl: varchar("taskUrl", { length: 512 }),
  attachments: json("attachments").$type<Array<{ filename: string; url: string; contentType: string }>>().default([]),
  statusLog: json("statusLog").$type<Array<{ ts: number; msg: string }>>().default([]),
  durationMs: int("durationMs"),
  creditUsage: int("creditUsage"),
  agentProfile: varchar("agentProfile", { length: 32 }).default("manus-1.6-lite"),
  /** Manus task ID returned by task.create — used for abort (task.stop) and redelivery */
  manusTaskId: varchar("manusTaskId", { length: 128 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type SkillRun = typeof skillRuns.$inferSelect;
export type InsertSkillRun = typeof skillRuns.$inferInsert;

// ── Knowledge Base ────────────────────────────────────────────────────────────
// Admin can upload/paste knowledge documents shared with all users.

export const knowledgeBase = mysqlTable("knowledge_base", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).default("general"),
  content: text("content").notNull(),
  addedByUserId: int("addedByUserId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeEntry = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeEntry = typeof knowledgeBase.$inferInsert;

// ── App Settings ─────────────────────────────────────────────────────────────
// Key-value store for admin-configurable app settings.
// e.g., billingCycleStartDay (1-28) for the credits chart billing period.

export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ── User Feedback ───────────────────────────────────────────────────────────────────────────────
// Users can submit feedback on specific skills, suggest new skills, or leave general feedback.

export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Category: 'skill' | 'suggestion' | 'general' */
  category: mysqlEnum("category", ["skill", "suggestion", "general"]).notNull(),
  /** Only set when category = 'skill' */
  skillId: varchar("skillId", { length: 64 }),
  skillName: varchar("skillName", { length: 128 }),
  /** The feedback message */
  message: text("message").notNull(),
  /** Optional rating 1-5 */
  rating: int("rating"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;