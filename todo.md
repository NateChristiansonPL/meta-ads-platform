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

## Concurrent Skill Run Persistence
- [x] Keep all skill pages mounted in background (display:none when inactive) so active runs survive navigation between skills
- [x] Add 5s retry for Manus attachment fetch when rawAttachments is empty on task completion (race condition fix for missing report attachments)

## Token Removal from Skill Files

- [x] Update buildSkillPrompt signature to accept accessToken parameter
- [x] Update routers.ts execute mutation to fetch token from DB and pass to buildSkillPrompt
- [x] Update all 5 skill prompts in manusTask.ts to export META_ACCESS_TOKEN env var before running scripts
- [x] Update pl-weekly-optimization/scripts/config.py — remove hardcoded EAA tokens, read from META_ACCESS_TOKEN env var
- [x] Update pl-performance-analysis-insights-v3/scripts/config.py — same
- [x] Update pl-creative-lifecycle-v3/scripts/config.py — same
- [x] Update pl-audience-overlap-spend/scripts/config.py — same
- [x] Update meta-ads-audit prompt in manusTask.ts to pass --token flag with the injected token value

## April 28 UI/Functional Improvements

- [x] Fix credits counter in top bar: show per-user credits (not aggregate), scoped to billing cycle dates
- [x] Fix credits-by-user total calculation in Usage & Tallies
- [x] Credits % used per user based on 8k credits per individual seat
- [x] Move "Provide Feedback" button: below Manus AI in sidebar, centered, red bg, bold white text
- [x] Add "Beta" badge next to "Pathlabs Intelligence" in top-left header
- [x] Campaign Builder: add "Coming Soon" overlay with translucent bright background
- [x] Richer live status: stream real Manus task messages to progress log during skill runs
- [x] Add active-skill indicator (spinner/dot) in sidebar next to skill name when running
- [x] Add kill-switch (Abort) button to skill output panel
- [x] Add "Re-deliver Report" button to skill output panel for re-fetching from completed task
- [x] Fix status detection: only mark success if .md attachments were actually retrieved
- [x] Add per-run error logging: capture and persist error details in DB, visible in Run Logs

## Campaign Builder Backend Wiring

- [x] Add campaign_sessions table to drizzle schema
- [x] Add db helpers: createSession, listSessions, getSessionById, updateSession, deleteSession
- [x] Add sessions tRPC router: list, save, load, delete
- [x] Add meta.validateSettings procedure
- [x] Add meta.getAdImages procedure
- [x] Add meta.getAdVideos procedure
- [x] Add meta.getAudienceOverlap procedure
- [x] Add meta.getPixelEvents procedure
- [x] Add meta.getCustomAudiences procedure
- [x] Add meta.getSavedAudiences procedure
- [x] Add meta.searchGeoLocations procedure
- [x] Add meta.searchTargeting procedure
- [x] Create client/src/lib/campaignStore.ts with all shared types and factories
- [x] Create client/src/hooks/useLaunchBuild.ts with LaunchProgress type and launch logic
- [x] Copy all 11 uploaded components into client/src/components/
- [x] Replace CampaignBuilder.tsx with new version using uploaded components
- [x] Remove Coming Soon gate from AppShell sidebar for Campaign Builder
- [x] TypeScript check and tests pass

## Live Status & UX Improvements (Apr 28 batch 2)
- [x] Replace repetitive "Analysis in progress..." live status with real agent step summaries
- [x] Add "Request Update" button during active runs that pings the task and returns plain-language status
- [x] Fix Re-fetch Report button to show on any completed run missing report files (not just aborted)
- [x] Add onboarding tooltips (? icons) throughout the UI for key buttons and sections
- [x] Create Knowledge Base page with full platform documentation

## UI/UX Updates (Apr 28 batch 3)
- [x] Update Performance Insights enrichment section description copy
- [x] Remove 1.6 max model option from all skill runners
- [x] Add per-skill date range recommendation notes next to skill header
- [x] Add "Recommend using 1.6 Lite model for credit efficiency" note next to model selector
- [x] Hide Manus AI tool from sidebar
- [x] Rename "Tools" to "Coming Soon" and add Creative Decay, Audience Saturation, Allocation Drift auto-detect blocks

## Campaign Builder - Round 2 Updates

- [x] Fix ad set ID pre-population bug in AdsMatrix (only use numeric Meta IDs)
- [x] Add geoLocationObjects and interestObjects structured fields to AdSetRow
- [x] Update AdSetsTable location picker to store key+type alongside display label
- [x] Update AdSetsTable interest picker to store id+type alongside display name
- [x] Add reach estimate tRPC procedure (Meta /reachestimate endpoint)
- [x] Add delivery estimate tRPC procedure (Meta /delivery_estimate for CPM)
- [x] Add audience overlap tRPC procedure (dual-anchor methodology)
- [x] Build Reach Estimate panel in Ad Sets tab with session-persistent history
- [x] Build Audience Overlap panel in Ad Sets tab with session-persistent history
- [x] Remove Find & Replace button from Ads tab toolbar
- [x] Remove Audience Overlap panel from Export tab
- [x] Creative Library: add Asset Upload button/modal (hard asset + URL, with name field)
- [x] Creative Library: add list/tile toggle to media browser
- [x] Creative Library: add per-placement URL customization button in website URL cell
- [x] Creative Library: add per-placement copy customization button (headline/primary text)
- [x] Creative Library: remove Lead Gen Form button from toolbar
- [x] Creative Library: remove Source Post ID column
- [x] Creative Library: remove Preview Link column
- [x] Ad Sets: fix typeahead dropdown positioning (sticky left-0 panel)
- [x] Ad Sets: split Audience column into Detailed Targeting and Custom/LAL Audiences
- [x] Ad Sets: Custom/LAL column uses live account custom/LAL audience search
- [x] Ad Sets: fix settings/session button backgrounds (add solid bg)
- [x] Ad Sets: engagement objective logic (page visits, page likes, on your ads)
- [x] Ad Sets: bulk location paste option
- [x] Ads tab: add primary text, headline, description, CTA columns after website URL override
- [x] Ads tab: Lead Gen Form column added (recalls forms from connected page)
- [x] Ads tab: add Lead Gen Form column after UTM override
- [x] Ads tab: move Source Post ID column to after Lead Gen Form column
- [x] Ads tab: Lead Gen Form uses page-recall picker (simplified per user request)
- [x] Wire pl-campaign-creation skill to Export Launch button

## Campaign Builder - Round 3 Fixes

- [x] Fix reach estimate 400 errors (debug Meta API payload)
- [x] Fix Settings/Sessions panel transparent background (black bg)
- [x] Fix asset upload false error (suppress error when upload actually succeeded)
- [x] Fix media browser hash return bug in carousel cards
- [x] Fix ad name convention: "Creative Concept - Asset Type - Length - Month-Yr" (no brackets, no placement custom)
- [x] Carry over website URL, primary text, headline, description, CTA, UTMs to ads table when generating from ad trafficker
- [x] Fix typeahead positioning: all panels (location, interests, custom/LAL) should appear under Opt Goal column area
- [x] Restructure audience targeting into unified Targeting panel with Location/Interests/Custom-LAL tabs
- [x] Remove Custom/LAL audiences from Interests & Behaviors section
- [x] Fix Custom/LAL panel: don't show all audiences until user searches; only show selected after selection
- [x] Remove Lead Gen Form from optional fields in ad sets table
- [x] Add model selector (1.6 Lite / 1.6) to Export tab Launch via Manus section
- [x] Verify Meta API payload shapes for placements, locations, interests, custom audiences
- [x] Explain write-back architecture for ad IDs, ad set IDs, campaign IDs, source post IDs, preview links
