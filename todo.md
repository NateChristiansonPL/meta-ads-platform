# Pathlabs Intelligence Platform TODO

## Completed
- [x] Full app with DashboardLayout, AppShell sidebar navigation
- [x] 5 skill pages (Weekly Optimization, Performance Insights, Creative Lifecycle, Structural Audit, Audience Overlap)
- [x] Campaign Builder UI with 5-tab spreadsheet interface
- [x] OAuth login with @pathlabs.com domain restriction
- [x] Remember this device checkbox (8h vs 1y session)
- [x] Ad account fetching (owned + client, paginated, alphabetically sorted)
- [x] Campaign multi-select with inline search, select-all/clear, count badge
- [x] Last-used account persisted to localStorage per skill
- [x] Skill execution wired to real Manus agent API (fire-and-forget)
- [x] Live status polling every 8s with rate-limit/timeout alerts
- [x] Per-skill run history drawer (stored in DB, per-user, per-skill)
- [x] Model selector (1.6 Lite / 1.6 / 1.6 Max, default Lite)
- [x] Per-run credit usage badge
- [x] Monthly credits-used counter in header (fixed Unix timestamp bug)
- [x] Full report extraction from .md attachment files

## In Progress
- [x] Ad name cleaning in Performance Insights prompt: strip ad-set/campaign prefixes after aggregation
- [x] Auto-retry failed modules: add retry logic to Performance Insights prompt (Module Retry Policy section)
- [x] Billing period credits chart: added configurable billing cycle start day (admin setting in Usage & Tallies), credits chart on Dashboard uses billing period window

## Run Logs Improvements
- [x] Add credits used column to Admin Run Logs table
- [x] Add model used column to Admin Run Logs table
- [x] Add campaign count column to Admin Run Logs table
- [x] Convert duration from raw seconds to mm:ss format in Run Logs table

## Admin Usage & Tallies — Credits by User
- [x] Add DB query for credits used per user (sum creditUsage, count runs, avg per run)
- [x] Add tRPC procedure runs.creditsByUser
- [x] Add Credits Used by User table in AdminUsage.tsx

## Billing Period Date Range
- [x] Replace billingCycleStartDay setting with billingPeriodStart and billingPeriodEnd (ISO date strings) in app_settings
- [x] Update tRPC settings procedures: getBillingPeriod, setBillingPeriod (start+end dates)
- [x] Update billingPeriodCredits and dailyCreditsChart procedures to use explicit start/end dates
- [x] Update monthlyCreditsUsed (header counter) to use billing period dates
- [x] Update AdminUsage.tsx billing settings UI: replace number input with start/end date pickers
- [x] Update Dashboard.tsx credits chart to use billing period dates
- [x] Update AppShell header counter to show billing period date range label
- [x] Update Credits Used by User table to use billing period dates (invalidated on save)

## Feedback System
- [x] Add feedback table to drizzle/schema.ts (id, userId, category, skillId, message, createdAt)
- [x] Add DB helpers: createFeedback, listFeedback (admin)
- [x] Add tRPC procedures: feedback.submit (protected), feedback.list (admin), feedback.delete (admin)
- [x] Build FeedbackModal component with category selector and text area
- [x] Add "Provide Feedback" button to AppShell header next to credits widget
- [x] Add Feedback section to AdminUsage.tsx organized by category tabs/sections

## Token and API Key Vault Expansion
- [x] Audit all API tokens/keys used across the app
- [x] Update TokenVault page to cover all token categories (Manus API Key status, Meta BM tokens, Google Sheets config)
- [x] Rename nav label from "Token Vault" to "Token and API Key Vault"
- [x] Rename page title/header to "Token and API Key Vault"

## Manus Team Plan Migration
- [x] Update MANUS_API_KEY secret to team plan key (verified HTTP 200 with skill.list)
- [x] Add per-skill Manus Project ID to app_settings DB (key pattern: skillProjectId:{skillId})
- [x] Add tRPC procedures: settings.skillProjectIds, settings.setSkillProjectId
- [x] Update skill run dispatch to pass project_id when configured
- [x] Add Manus Project Assignments section to Token and API Key Vault UI
- [x] Pre-populated: Structural Audit → MKTYEMAkqiP2LpTLjUQbfX, all others → juQv4FJjcFEmRRYNSe9VPF

## Skill Output Persistence
- [x] Add DB helper: getLastSkillOutput(userId, skillId) — queries skillRuns for most recent success row with reportMarkdown
- [x] Add tRPC procedure: runs.lastOutput (protected, query by skillId)
- [x] All five skill pages updated automatically via shared SkillRunner component
- [x] Show a "Last run: <date>" banner with account name, date preset, and "Previous result" badge
