import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
  /** True if the user's Manus openId appears in the team's membership list (verified via Manus API at login). */
  isTeamMember: boolean("isTeamMember").default(false).notNull(),
  /**
   * Auth provider: 'manus' for Manus OAuth users, 'invited' for magic-link invited users.
   * Invited users can view the app but cannot run skill analyses.
   */
  authProvider: mysqlEnum("authProvider", ["manus", "google", "invited"]).default("manus").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** Slack incoming webhook URL for creative decay fatigue notifications. Per-user, optional. */
  slackWebhookUrl: text("slack_webhook_url"),
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

// ── Admin Creative Decay / Meta Performance Sync ──────────────────────────────
// These tables power the admin-only Creative Decay workbench. Raw Meta performance
// rows are persisted in adPerformance; the fatigue analysis reads only from that
// fact table and writes deterministic outputs into creativeFatigueResults.

export const metaSyncSchedule = mysqlTable("meta_sync_schedule", {
  id: int("id").autoincrement().primaryKey(),
  /** The user who owns this schedule. NULL = legacy global row (id=1). */
  userId: int("user_id"),
  // Sync scheduler
  syncEnabled: boolean("sync_enabled").default(false).notNull(),
  syncUtcHour: int("sync_utc_hour").default(6).notNull(),
  syncRollingDays: int("sync_rolling_days").default(14).notNull(),
  syncPreset: varchar("sync_preset", { length: 32 }).default("rolling").notNull(), // 'yesterday' | 'rolling'
  vaultTokenId: int("vault_token_id"),
  accountId: varchar("account_id", { length: 64 }).default("").notNull(),
  campaignIds: text("campaign_ids"),
  campaignStatusFilter: mysqlEnum("campaign_status_filter", ["active", "active_30d", "inactive", "all"]).default("active").notNull(),
  // Analysis scheduler
  analysisEnabled: boolean("analysis_enabled").default(false).notNull(),
  analysisUtcHour: int("analysis_utc_hour").default(7).notNull(),
  analysisRollingDays: int("analysis_rolling_days").default(14).notNull(),
  // Notification thresholds
  notifyEmerging: boolean("notify_emerging").default(false).notNull(),
  notifyPossible: boolean("notify_possible").default(true).notNull(),
  notifyProbable: boolean("notify_probable").default(true).notNull(),
  // Filters
  onlyLiveAds: boolean("only_live_ads").default(false).notNull(),
  // Whether to always save a report (even when no signals found)
  alwaysSendReport: boolean("always_send_report").default(false).notNull(),
  // Notification owner — the admin user who last saved the analysis scheduler config
  notifyUserId: int("notify_user_id"),
  // Legacy fields kept for compatibility
  enabled: boolean("enabled").default(false).notNull(),
  utcHour: int("utc_hour").default(6).notNull(),
  rollingDays: int("rolling_days").default(14).notNull(),
  targetTable: varchar("target_table", { length: 64 }).default("ad_performance").notNull(),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: mysqlEnum("last_run_status", ["success", "partial", "error"]),
  lastAnalysisAt: timestamp("last_analysis_at"),
  lastAnalysisStatus: mysqlEnum("last_analysis_status", ["success", "partial", "error"]),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// Tracks when each fatigue signal level was FIRST detected for a creative fingerprint.
// Used to show "first detected on" dates in the results table.
export const firstFatigueDetected = mysqlTable("first_fatigue_detected", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  accountId: varchar("account_id", { length: 64 }).notNull(),
  contentFingerprint: varchar("content_fingerprint", { length: 128 }).notNull(),
  level: mysqlEnum("level", ["emerging", "possible", "probable"]).notNull(),
  firstDetectedAt: timestamp("first_detected_at").defaultNow().notNull(),
  // The actual date in the performance data on which this level threshold was first crossed.
  // May be earlier than firstDetectedAt (which records when analysis ran).
  signalDate: date("signal_date", { mode: "string" }),
  representativeName: text("representative_name"),
}, (table) => ({
  uniqueSignal: uniqueIndex("ffd_account_fp_level_unique").on(table.accountId, table.contentFingerprint, table.level),
  accountIdx: index("ffd_account_idx").on(table.accountId),
}));

export const metaSyncHistory = mysqlTable("meta_sync_history", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  /** The user who triggered this sync run. NULL = legacy rows before user-scoping. */
  userId: int("user_id"),
  mode: mysqlEnum("mode", ["manual", "scheduled", "csv", "breakdown"]).notNull(),
  accountId: varchar("account_id", { length: 64 }),
  campaignFilter: text("campaign_filter"),
  campaignStatusFilter: mysqlEnum("history_campaign_status_filter", ["active", "active_30d", "inactive", "all"]),
  syncType: mysqlEnum("sync_type", ["sync", "analysis", "combined"]).default("combined"),
  dateFrom: date("date_from", { mode: "string" }),
  dateTo: date("date_to", { mode: "string" }),
  rowsUpserted: int("rows_upserted").default(0).notNull(),
  adsProcessed: int("ads_processed").default(0).notNull(),
  adsetsProcessed: int("adsets_processed").default(0).notNull(),
  durationMs: int("duration_ms").default(0).notNull(),
  status: mysqlEnum("status", ["success", "partial", "error"]).notNull(),
  errorMessage: text("error_message"),
  warnings: json("warnings").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("meta_sync_history_created_at_idx").on(table.createdAt),
}));

export const adSourceDetails = mysqlTable("ad_source_details", {
  creativeId: varchar("creative_id", { length: 128 }).primaryKey(),
  accountId: varchar("account_id", { length: 64 }),
  campaignId: varchar("campaign_id", { length: 128 }),
  adId: varchar("ad_id", { length: 128 }),
  adName: text("ad_name"),
  mediaType: varchar("media_type", { length: 32 }),
  imageUrl: text("image_url"),
  imageHash: varchar("image_hash", { length: 128 }),
  videoId: varchar("video_id", { length: 128 }),
  contentFingerprint: varchar("content_fingerprint", { length: 24 }),
  destinationUrl: text("destination_url"),
  primaryText: text("primary_text"),
  headline: text("headline"),
  description: text("description"),
  ctaType: varchar("cta_type", { length: 64 }),
  sourcePayload: json("source_payload").$type<Record<string, unknown>>(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  imageHashIdx: index("asd_image_hash_fp_idx").on(table.imageHash),
  videoIdIdx: index("asd_video_id_fp_idx").on(table.videoId),
}));

export const adPerformance = mysqlTable("ad_performance", {
  adId: varchar("ad_id", { length: 128 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  publisherPlatform: varchar("publisher_platform", { length: 64 }).default("unknown").notNull(),
  accountId: varchar("account_id", { length: 64 }),
  accountName: text("account_name"),
  campaignId: varchar("campaign_id", { length: 128 }),
  campaignName: text("campaign_name"),
  adsetId: varchar("adset_id", { length: 128 }),
  adsetName: text("adset_name"),
  adName: text("ad_name"),
  creativeId: varchar("creative_id", { length: 128 }),
  adType: varchar("ad_type", { length: 32 }),
  contentFingerprint: varchar("content_fingerprint", { length: 24 }),
  imageHash: varchar("image_hash", { length: 128 }),
  videoId: varchar("video_id", { length: 128 }),
  impressions: int("impressions").default(0).notNull(),
  reach: int("reach"),
  frequency: decimal("frequency", { precision: 8, scale: 4 }),
  spend: decimal("spend", { precision: 12, scale: 4 }).default("0").notNull(),
  cpm: decimal("cpm", { precision: 10, scale: 4 }),
  clicks: int("clicks"),
  ctr: decimal("ctr", { precision: 10, scale: 6 }),
  linkCtr: decimal("link_ctr", { precision: 10, scale: 6 }),
  cpc: decimal("cpc", { precision: 10, scale: 4 }),
  cpcLink: decimal("cpc_link", { precision: 10, scale: 4 }),
  linkClicks: int("link_clicks"),
  landingPageViews: int("landing_page_views"),
  costPerLpv: decimal("cost_per_lpv", { precision: 10, scale: 4 }),
  results: decimal("results", { precision: 12, scale: 4 }),
  costPerResult: decimal("cost_per_result", { precision: 12, scale: 4 }),
  convEvent: text("conv_event"),
  optimizationGoal: varchar("optimization_goal", { length: 128 }),
  pageLikes: int("page_likes"),
  costPerPageLike: decimal("cost_per_page_like", { precision: 10, scale: 4 }),
  postEngagement: int("post_engagement"),
  costPerPostEngagement: decimal("cost_per_post_engagement", { precision: 10, scale: 4 }),
  pageEngagement: int("page_engagement"),
  costPerPageEngagement: decimal("cost_per_page_engagement", { precision: 10, scale: 4 }),
  fbLeads: int("fb_leads"),
  costPerFbLead: decimal("cost_per_fb_lead", { precision: 10, scale: 4 }),
  videoViews: int("video_views"),
  costPerVideoView: decimal("cost_per_video_view", { precision: 10, scale: 4 }),
  videoContinuous2sViews: int("video_continuous_2s_views"),
  costPer2sView: decimal("cost_per_2s_view", { precision: 10, scale: 4 }),
  thruplays: int("thruplays"),
  costPerThruplay: decimal("cost_per_thruplay", { precision: 10, scale: 4 }),
  videoAvgWatchTime: decimal("video_avg_watch_time", { precision: 10, scale: 4 }),
  videoViews25: int("video_views_25"),
  videoViews50: int("video_views_50"),
  videoViews75: int("video_views_75"),
  videoViews95: int("video_views_95"),
  videoViews100: int("video_views_100"),
  estimatedAdRecallers: int("estimated_ad_recallers"),
  costPerRecaller: decimal("cost_per_recaller", { precision: 10, scale: 4 }),
  estimatedAdRecallRate: decimal("estimated_ad_recall_rate", { precision: 10, scale: 6 }),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.adId, table.date, table.publisherPlatform] }),
  fingerprintDateIdx: index("ap_fingerprint_date_idx").on(table.contentFingerprint, table.date),
  creativeDateIdx: index("ap_creative_id_date_idx").on(table.creativeId, table.date),
  campaignDateIdx: index("ap_campaign_id_date_idx").on(table.campaignId, table.date),
  imageHashIdx: index("ap_image_hash_fp_idx").on(table.imageHash),
  videoIdIdx: index("ap_video_id_fp_idx").on(table.videoId),
  syncedAtIdx: index("ap_synced_at_idx").on(table.syncedAt),
}));

export const creativeFatigueResults = mysqlTable("creative_fatigue_results", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  analysisRunId: varchar("analysis_run_id", { length: 64 }).notNull(),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
  accountId: varchar("account_id", { length: 64 }),
  dateFrom: date("date_from", { mode: "string" }).notNull(),
  dateTo: date("date_to", { mode: "string" }).notNull(),
  contentFingerprint: varchar("content_fingerprint", { length: 128 }),
  creativeIds: json("creative_ids").$type<string[]>().default([]),
  adNames: json("ad_names").$type<string[]>().default([]),
  representativeName: text("representative_name"),
  campaignIds: json("campaign_ids").$type<string[]>().default([]),
  campaignName: text("campaign_name"),
  optimizationGoal: varchar("optimization_goal", { length: 128 }),
  // Human-readable label for the metric the analysis scored this creative on
  // e.g. "Offsite Conversions", "Link Clicks", "Custom: 123456789"
  convEventLabel: varchar("conv_event_label", { length: 256 }),
  mediaType: varchar("media_type", { length: 32 }),
  adsetName: text("adset_name"),
  imageUrl: text("image_url"),
  eligible: boolean("eligible").default(false).notNull(),
  totalSpend: decimal("total_spend", { precision: 14, scale: 4 }),
  totalImpressions: bigint("total_impressions", { mode: "number" }),
  totalEvents: decimal("total_events", { precision: 14, scale: 4 }),
  daysActive: int("days_active"),
  avgCtr: decimal("avg_ctr", { precision: 10, scale: 6 }),
  avgFrequency: decimal("avg_frequency", { precision: 8, scale: 4 }),
  earlyCtr: decimal("early_ctr", { precision: 10, scale: 6 }),
  recentCtr: decimal("recent_ctr", { precision: 10, scale: 6 }),
  ctrDrop: decimal("ctr_drop", { precision: 8, scale: 6 }),
  earlySpend: decimal("early_spend", { precision: 14, scale: 4 }),
  recentSpend: decimal("recent_spend", { precision: 14, scale: 4 }),
  earlyEvents: decimal("early_events", { precision: 14, scale: 4 }),
  recentEvents: decimal("recent_events", { precision: 14, scale: 4 }),
  earlyCpe: decimal("early_cpe", { precision: 12, scale: 4 }),
  recentCpe: decimal("recent_cpe", { precision: 12, scale: 4 }),
  cpeDegrade: decimal("cpe_degrade", { precision: 8, scale: 6 }),
  ewmaEarly: decimal("ewma_early", { precision: 10, scale: 6 }),
  ewmaLate: decimal("ewma_late", { precision: 10, scale: 6 }),
  ewmaDrop: decimal("ewma_drop", { precision: 8, scale: 6 }),
  frequencyFatigue: decimal("frequency_fatigue", { precision: 6, scale: 4 }),
  reliability: decimal("reliability", { precision: 6, scale: 4 }),
  cpeWeight: decimal("cpe_weight", { precision: 4, scale: 2 }),
  ctrWeight: decimal("ctr_weight", { precision: 4, scale: 2 }),
  ewmaWeight: decimal("ewma_weight", { precision: 4, scale: 2 }),
  freqWeight: decimal("freq_weight", { precision: 4, scale: 2 }),
  rawSignal: decimal("raw_signal", { precision: 8, scale: 6 }),
  fatigueScore: decimal("fatigue_score", { precision: 6, scale: 2 }),
  fatigueLabel: varchar("fatigue_label", { length: 64 }),
  fatigueStatus: mysqlEnum("fatigue_status", ["URGENT", "REFRESH", "MONITOR", "HEALTHY", "IMPROVING", "BLOCKED"]),
  badgeCpeCdr: boolean("badge_cpe_cdr").default(false).notNull(),
  badgeCtrSplit: boolean("badge_ctr_split").default(false).notNull(),
  badgeEwma: boolean("badge_ewma").default(false).notNull(),
  badgeFrequency: boolean("badge_frequency").default(false).notNull(),
  notificationSent: boolean("notification_sent").default(false).notNull(),
  notificationLevel: mysqlEnum("notification_level", ["emerging", "possible", "probable"]),
  // ── Enrichment 2: Performance Impact ──────────────────────────────────────
  impactCpeExpected: decimal("impact_cpe_expected", { precision: 12, scale: 4 }),
  impactCpeActual: decimal("impact_cpe_actual", { precision: 12, scale: 4 }),
  impactCpeChangePct: decimal("impact_cpe_change_pct", { precision: 8, scale: 4 }),
  impactEventsExpected: decimal("impact_events_expected", { precision: 14, scale: 4 }),
  impactEventsActual: decimal("impact_events_actual", { precision: 14, scale: 4 }),
  impactEventsChangePct: decimal("impact_events_change_pct", { precision: 8, scale: 4 }),
  impactCpmExpected: decimal("impact_cpm_expected", { precision: 10, scale: 4 }),
  impactCpmActual: decimal("impact_cpm_actual", { precision: 10, scale: 4 }),
  impactCpmChangePct: decimal("impact_cpm_change_pct", { precision: 8, scale: 4 }),
  impactCtrExpected: decimal("impact_ctr_expected", { precision: 10, scale: 6 }),
  impactCtrActual: decimal("impact_ctr_actual", { precision: 10, scale: 6 }),
  impactCtrChangePct: decimal("impact_ctr_change_pct", { precision: 8, scale: 4 }),
  impactFreqExpected: decimal("impact_freq_expected", { precision: 8, scale: 4 }),
  impactFreqActual: decimal("impact_freq_actual", { precision: 8, scale: 4 }),
  impactFreqChangePct: decimal("impact_freq_change_pct", { precision: 8, scale: 4 }),
  impactConfidence: mysqlEnum("impact_confidence", ["high", "medium", "low"]),
  // ── Enrichment 3: Score-Trajectory Projection ─────────────────────────────
  dailyScoreSlope: decimal("daily_score_slope", { precision: 8, scale: 4 }),
  slopeRSquared: decimal("slope_r_squared", { precision: 6, scale: 4 }),
  projectedPossibleDate: date("projected_possible_date", { mode: "string" }),
  projectedProbableDate: date("projected_probable_date", { mode: "string" }),
  // ── Enrichment 4: Decay Velocity Classification ───────────────────────────
  decayVelocity: mysqlEnum("decay_velocity", ["fast", "moderate", "slow"]),
}, (table) => ({
  runScoreIdx: index("cfr_run_score_idx").on(table.analysisRunId, table.fatigueScore),
  fingerprintRunIdx: index("cfr_fingerprint_run_idx").on(table.contentFingerprint, table.analyzedAt),
  notificationIdx: index("cfr_notification_idx").on(table.notificationSent, table.notificationLevel),
  runFingerprintUnique: uniqueIndex("cfr_run_fingerprint_unique").on(table.analysisRunId, table.contentFingerprint),
}));

export type CreativeFatigueResult = typeof creativeFatigueResults.$inferSelect;
export type InsertCreativeFatigueResult = typeof creativeFatigueResults.$inferInsert;

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
  /**
   * Sidecar JSON payload extracted from the skill output.
   * For Creative Lifecycle: the signals.json content.
   * For Audience Overlap: the overlap_report.json content.
   * Stored as raw JSON text for use as enrichment input in Performance Insights.
   */
  sidecarJson: mediumtext("sidecarJson"),
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
  /** Category: 'skill' | 'skill-issue' | 'suggestion' | 'general' */
  category: mysqlEnum("category", ["skill", "skill-issue", "suggestion", "general"]).notNull(),
  /** Only set when category = 'skill' or 'skill-issue' */
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

// ── Admin Feedback Reads ──────────────────────────────────────────────────────
// Tracks when each admin last acknowledged (read) the feedback notification.
// One row per admin user. lastReadAt is updated when admin clicks the badge.

export const adminFeedbackReads = mysqlTable("admin_feedback_reads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  lastReadAt: timestamp("lastReadAt").defaultNow().notNull(),
});

export type AdminFeedbackRead = typeof adminFeedbackReads.$inferSelect;

// ── Campaign Builder Sessions ─────────────────────────────────────────────────
// Named save-states for the Campaign Builder spreadsheet UI.
// Each user can have multiple saved sessions (drafts / named builds).
// "builderSessions" is the canonical name used by the sessions router.

export const builderSessions = mysqlTable("builder_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  /** Full CampaignBuilderState serialised as JSON */
  stateJson: text("stateJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BuilderSession = typeof builderSessions.$inferSelect;
export type InsertBuilderSession = typeof builderSessions.$inferInsert;

/** @deprecated Use builderSessions instead */
export const campaignSessions = mysqlTable("campaign_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  /** Full serialized CampaignBuilderState as JSON */
  stateJson: text("stateJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CampaignSession = typeof campaignSessions.$inferSelect;
export type InsertCampaignSession = typeof campaignSessions.$inferInsert;

// ── Invited Users ─────────────────────────────────────────────────────────────
// Admin can invite non-Manus users by email. They sign in via Google OAuth.
// Google-auth users can view the app but cannot run skill analyses.

export const invitedUsers = mysqlTable("invited_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  /** Secure random token used in the invite acceptance link. */
  inviteToken: varchar("inviteToken", { length: 128 }).notNull().unique(),
  invitedByUserId: int("invitedByUserId").notNull(),
  /** Null until the invitee accepts and completes Google OAuth. */
  acceptedAt: timestamp("acceptedAt"),
  /** The users.id of the accepted user (set after Google OAuth completes). */
  acceptedUserId: int("acceptedUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvitedUser = typeof invitedUsers.$inferSelect;
export type InsertInvitedUser = typeof invitedUsers.$inferInsert;
// Logs every notification event sent by the creative decay scheduler.
// Used to display notification history in the Creative Decay admin tool.
export const decayNotificationLog = mysqlTable("decay_notification_log", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  accountId: varchar("account_id", { length: 64 }).notNull(),
  adId: varchar("ad_id", { length: 64 }),
  adName: text("ad_name"),
  signalLevel: mysqlEnum("signal_level", ["emerging", "possible", "probable"]).notNull(),
  fatigueScore: int("fatigue_score"),
  firstDetectedAt: timestamp("first_detected_at"),
  notifiedAt: timestamp("notified_at").defaultNow().notNull(),
  notifyUserId: int("notify_user_id"),
  dateFrom: varchar("date_from", { length: 16 }),
  dateTo: varchar("date_to", { length: 16 }),
  campaignName: text("campaign_name"),
  adsetName: text("adset_name"),
  notifiedViaApp: boolean("notified_via_app").default(false).notNull(),
  notifiedViaSlack: boolean("notified_via_slack").default(false).notNull(),
}, (table) => ({
  accountIdx: index("dnl_account_idx").on(table.accountId),
  notifiedAtIdx: index("dnl_notified_at_idx").on(table.notifiedAt),
}));

// ── Ad Set Goals ──────────────────────────────────────────────────────────────
// Stores the optimization goal and promoted_object for each ad set.
// Populated during every performance sync so the decay analysis always knows
// what metric each ad set is optimizing towards — including the exact custom
// conversion ID when goal is OFFSITE_CONVERSIONS.
export const adsetGoals = mysqlTable("adset_goals", {
  adsetId: varchar("adset_id", { length: 128 }).primaryKey(),
  adsetName: text("adset_name"),
  accountId: varchar("account_id", { length: 64 }),
  campaignId: varchar("campaign_id", { length: 128 }),
  optimizationGoal: varchar("optimization_goal", { length: 128 }),
  // From promoted_object — only present for OFFSITE_CONVERSIONS ad sets
  // targeting a custom conversion (not a standard pixel event).
  customConversionId: varchar("custom_conversion_id", { length: 128 }),
  // From promoted_object.custom_event_type — e.g. PURCHASE, LEAD, OTHER.
  // Present for OFFSITE_CONVERSIONS ad sets using standard pixel events.
  customEventType: varchar("custom_event_type", { length: 128 }),
  // From promoted_object.pixel_id
  pixelId: varchar("pixel_id", { length: 128 }),
  // Human-readable label used in the decay analysis (e.g. "Purchase", "Lead",
  // "Custom: 123456789"). Derived at sync time so the analysis never has to
  // re-derive it.
  convEventLabel: varchar("conv_event_label", { length: 256 }),
  lastFetchedAt: timestamp("last_fetched_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountIdx: index("ag_account_idx").on(table.accountId),
  campaignIdx: index("ag_campaign_idx").on(table.campaignId),
}));

export type AdsetGoal = typeof adsetGoals.$inferSelect;
export type InsertAdsetGoal = typeof adsetGoals.$inferInsert;

// ── Decay Reports ─────────────────────────────────────────────────────────────
// Persists the output of every creative decay analysis run so users can
// retrieve past reports at any time without re-running the analysis.
// Manual reports are saved explicitly by the user; automated reports are saved
// automatically when the cron fires (regardless of whether fatigue was detected
// when alwaysSendReport is true, or only when signals are found otherwise).
export const decayReports = mysqlTable("decay_reports", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  /** The user who owns this report. */
  userId: int("user_id").notNull(),
  /** Ad account the analysis was run against. */
  accountId: varchar("account_id", { length: 64 }).notNull(),
  /** Human-readable account name (snapshot at run time). */
  accountName: text("account_name"),
  /** Comma-separated campaign IDs included in the analysis (empty = all). */
  campaignIds: text("campaign_ids"),
  /** ISO date string for the start of the analysis window. */
  dateFrom: varchar("date_from", { length: 16 }).notNull(),
  /** ISO date string for the end of the analysis window. */
  dateTo: varchar("date_to", { length: 16 }).notNull(),
  /** Whether this was a manual save or an automated cron run. */
  reportType: mysqlEnum("report_type", ["manual", "auto"]).notNull(),
  /** Total number of fatigue signals detected (emerging + possible + probable). */
  signalCount: int("signal_count").default(0).notNull(),
  /** Number of probable fatigue signals. */
  probableCount: int("probable_count").default(0).notNull(),
  /** Number of possible fatigue signals. */
  possibleCount: int("possible_count").default(0).notNull(),
  /** Number of emerging fatigue signals. */
  emergingCount: int("emerging_count").default(0).notNull(),
  /** Full serialized analysis output (array of ResultRow objects). */
  reportJson: mediumtext("report_json").notNull(),
  /** Optional user-supplied label for manual saves. */
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("dr_user_idx").on(table.userId),
  userAccountIdx: index("dr_user_account_idx").on(table.userId, table.accountId),
  createdAtIdx: index("dr_created_at_idx").on(table.createdAt),
}));

export type DecayReport = typeof decayReports.$inferSelect;
export type InsertDecayReport = typeof decayReports.$inferInsert;
