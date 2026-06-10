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

## Knowledge Base & Sidebar Updates

- [x] Add "Early Detection" folder/section to Knowledge Base with Creative Decay, Audience Saturation, Allocation Drift articles
- [x] Remove Manus AI from Tools section in Knowledge Base
- [x] Update sidebar nav: rename three Coming Soon items to Creative Decay, Audience Saturation, Allocation Drift
- [x] Add Early Detection grouping label in sidebar nav

## UI Fixes Batch 4

- [x] Fix ad accounts not loading after BM selection (critical bug)
- [x] Fix date note styling: larger font, bold, black text, yellow highlight
- [x] Fix credits counter: show count + % (÷8000), remove date range
- [x] Feedback modal: remove rating from all options, add "Issues when running skill" dimension with skill dropdown (including Campaign Builder)

## UI Fixes Batch 5

- [x] Admin-only feedback notification badge: persists until admin clicks it, DB-backed unread count
- [x] Fix Primary Text column text alignment/size in CreativesTable to match Headline and Description
- [x] Paste-from-spreadsheet support for Creative Library columns (creative concept, length, website URL, headline, primary text, description, CTA, link to UTM)

## Team Plan Access (Open Login)

- [x] Remove @pathlabs.com domain restriction from OAuth callback — any Manus account can now log in

## Team Members Admin Panel

- [x] Add DB helper: listAllUsers with total credits used (join users + skill_runs)
- [x] Add tRPC procedure: admin.teamMembers (admin-only, returns users with credits)
- [x] Add tRPC mutation: admin.setUserRole (admin-only, promote/demote user)
- [x] Build Team Members panel in AdminUsage.tsx (table: name, email, role badge, last sign-in, credits used, role toggle)

## RBAC Security Fix (Critical)

- [x] Add AdminRoute guard component that redirects non-admins to /dashboard
- [x] Wrap all admin-only routes in App.tsx with AdminRoute guard
- [x] Hide all admin nav items in DashboardLayout sidebar for non-admin users (already done via isAdmin check in AppShell)
- [x] Fix post-login redirect: OAuth callback always lands on /dashboard
- [x] Verify all admin tRPC procedures use adminProcedure (server-side check)

## Team Account Enforcement & Launch Build Disable

- [x] Add isTeamMember boolean column to users table + pnpm db:push migration
- [x] OAuth callback calls Manus teamLog API to set isTeamMember on every login
- [x] Disable skill run buttons for non-team users with greyed-out style and tooltip in SkillRunner.tsx
- [x] Permanently grey out Launch Build button in ExportPanel.tsx for all users ("Coming soon")

## Login Page & Team Account Block

- [x] OAuth callback: deny session when isTeamMember=false, redirect to /login?error=not_team_member
- [x] App.tsx: unauthenticated users land on /login first instead of being auto-redirected to Manus OAuth
- [x] DashboardLayout/AppShell: redirect unauthenticated users to /login instead of Manus OAuth portal directly
- [x] Login page: branded screen with "Sign in using your Manus Team Account" button
- [x] Login page: show error message when ?error=not_team_member is in the URL

## Team Members Dedicated Admin Nav Item

- [x] Add "Team Members" as its own nav item in ADMIN section of AppShell (between Run Logs and Usage & Tallies)
- [x] Create dedicated AdminTeamMembers.tsx page (extract Team Members table from AdminUsage.tsx)
- [x] Add /admin/team-members route in App.tsx wrapped in AdminRoute guard

## Skill Run Prompt Fix (Critical)

- [x] Audit task creation API call in routers.ts to confirm project_id is always passed correctly
- [x] Update skill run prompt to explicitly instruct agent to read project files before executing
- [x] Ensure prompt is identical for all users (admin and non-admin)

## Remove Knowledge Base Injection from Skill Prompts (Critical)

- [x] Remove knowledgeContext fetch and injection from runs.execute in routers.ts
- [x] Remove knowledgeSection parameter and injection from buildSkillPrompt and all 5 skill prompt builders in manusTask.ts
- [x] Ensure no app-level DB knowledge contaminates any user's skill run

## Remove Admin Knowledge Base Page

- [x] Remove admin Knowledge Base nav item from ADMIN_ITEMS in AppShell.tsx
- [x] Remove /admin/knowledge route from App.tsx
- [x] Verify platform documentation Knowledge Base (sidebar, above Provide Feedback) is untouched

## Google OAuth Invite System & Team Members Overhaul

- [x] DB schema: add auth_provider column to users table (enum: 'manus' | 'google'), add invited_users table (id, email, token, invitedBy, acceptedAt, createdAt)
- [x] Push DB migration
- [x] Backend: Google OAuth callback route (/api/oauth/google/callback), exchange code for token, create/find user with auth_provider='google'
- [x] Backend: tRPC invites.send procedure (admin only) — create invite record, send email via built-in notification or SMTP
- [x] Backend: tRPC invites.list procedure (admin only) — list all pending/accepted invites
- [x] Backend: tRPC invites.revoke procedure (admin only)
- [x] Backend: public invite acceptance endpoint (/api/invite/accept?token=...) — validate token, redirect to Google OAuth with state
- [x] Frontend: Update Login page — split into "Manus Tester" (existing OAuth) vs "Invited User" (Google OAuth) options
- [x] Frontend: Grey out Run Analysis button for users with auth_provider='google' with tooltip explaining access level
- [x] Frontend: Rename Team Members nav item and page header to "Team Members & Users"
- [x] Frontend: Add Invite User button and modal (email input) in Team Members & Users page
- [x] Frontend: Add Invited Users table section showing pending/accepted invites with revoke action

## Credits Summation Bug Fixes

- [x] Fix Total Credits Used stat card in Team Members panel (correctly coerce MySQL string to Number before summing)
- [x] Fix Team Total row in Credits Used by User table in Usage & Tallies (same Number coercion fix)

## SendGrid Email Integration

- [x] Decided to use copy-link approach instead of SendGrid (user preference, low invite volume)
- [x] Invite link copy button implemented in Team Members & Users admin panel

## Login & Invited User Fixes (Round 2)

- [x] Remove "I was invited" Google OAuth button from login page
- [x] Fix greyed-out Run Analysis button for invited users (authProvider='invited')

## Magic Link Reuse

- [x] Allow invite link to be reused after first acceptance (re-creates session for existing user instead of blocking with "already used")

## Login Fix

- [x] Restore Manus OAuth button with remember-for-8-hours checkbox (revert to pre-Google-OAuth login flow)

## Admin Campaign Builder (Isolated Copy)

- [x] Audit all Campaign Builder files (frontend components, store, hooks, server router)
- [x] Copy all frontend files into client/src/pages/admin/CampaignBuilderAdmin/ with Admin prefix
- [x] Copy server tRPC procedures into server/routers/admin/ (metaAdmin.ts, sessionsAdmin.ts, googleSheetsAdmin.ts)
- [x] Register admin route in App.tsx (/admin/campaign-builder) and nav item in AppShell.tsx (Campaign Builder (Admin))
- [x] TypeScript check (0 errors), tests (23 passing), checkpoint, package zip

## Invite System Fixes
- [x] Remove invite link from notifyOwner content so Manus does not forward it to invitees
- [x] Fix acceptedAt being set immediately on invite creation — should only be set when magic link is clicked (confirmed already correct)
- [x] Fix Team Members page to only show isTeamMember=true users (keep invited users out of Team Members section)

## Remove Model Selector from Skill Pages

- [x] Remove model selector UI from SkillRunner component (or wherever it is rendered)
- [x] Remove model-related state/props from all skill pages
- [x] Remove "Recommend using 1.6 Lite model" note from all skill pages
- [x] Hardcode model to 1.6 regular in routers.ts runs.execute procedure
- [x] Verify no model selector appears in Campaign Builder Export tab either (removed from ExportPanel.tsx and ExportPanelAdmin.tsx)

## Remove Additional Instructions Free-Text Input from Skill Pages

- [x] Remove additionalInstructions state and textarea from SkillRunner.tsx
- [x] Remove additionalInstructions from the execute mutation call in SkillRunner.tsx
- [x] Remove additionalInstructions parameter from routers.ts runs.execute input schema
- [x] Remove additionalInstructions from buildSkillPrompt calls in routers.ts
- [x] Remove additionalInstructions parameter from buildSkillPrompt and all skill prompt builders in manusTask.ts

## Admin Campaign Builder — UI View Toggle (Pillar Hub alternate view)

- [x] Create PillarHubAdmin.tsx — Pillar Hub alternate view for admin builder (port of option-e.jsx to React/TS using existing state types)
- [x] Add viewMode state ('spreadsheet' | 'pillar') to CampaignBuilderAdmin.tsx
- [x] Add tweakSettings state (density, friendly labels, advanced columns, dark mode) to CampaignBuilderAdmin.tsx
- [x] Add "UI View" button to headerActions in CampaignBuilderAdmin.tsx (right of "Campaign Builder" title)
- [x] Add TweaksPanel dropdown/popover that opens from the UI View button with: Density (compact/comfortable), Plain-language labels toggle, Advanced columns toggle
- [x] Wire viewMode to conditionally render PillarHubAdmin vs existing spreadsheet tabs
- [x] Apply tweakSettings as CSS classes/vars to the admin builder container
- [x] Ensure Pillar Hub view reads from and writes to the same CampaignBuilderState (no duplicate state)
- [x] Scope all new styles to admin builder only (no global CSS pollution)

## Admin Campaign Builder — Spreadsheet Design + Feature Updates

### Design Tokens & Pre-Launch QA Panel
- [x] Apply spreadsheet design tokens to admin builder: dark navy bg, row hover, header styling, cell input styles
- [x] Add Pre-Launch QA collapsible right-side panel to CampaignBuilderAdmin (all tabs) matching design file
- [x] QA panel: error/warning/info badge pills, issue cards with Jump links, Helpful Actions section

### Ad Sets Tab — Checkboxes + Reach/Overlap Buttons
- [x] Add checkbox to left of each ad set row in AdSetsTableAdmin
- [x] Move "Reach Estimate" button to header with count badge (disabled until ≥1 checkbox selected)
- [x] Move "Audience Overlap" button to header (separate from Reach Estimate)
- [x] Enable Reach Estimate button when ≥1 ad set checkbox is checked

### Targeting Modal Redesign
- [x] Redesign targeting modal to match spreadsheet design (dark modal, tab bar with icons)
- [x] Remove "Run Reach" and "Check Overlap" buttons from bottom of targeting modal
- [x] Make targeting modal 30% wider than current design (~700px)
- [x] Keep Location / Interests / Custom tabs wired up as they currently are

### Combined Reach Estimate + Audience Overlap Modal
- [x] Build combined modal with two tabs: "Reach Estimate" and "Audience Overlap"
- [x] Reach Estimate tab: uses selected rows from table, runs against those rows, Close button bottom-left
- [x] Audience Overlap tab: populated when user runs overlap, Close button bottom-left
- [x] Persist reach estimate and overlap data between modal opens (survives close/reopen)
- [x] If past data exists, enable Reach Estimate button on ad sets tab even with no checkbox selected

## Admin Campaign Builder — Bug Fixes (Round 2)

- [x] QA rail: convert from absolute overlay to flex push layout (table shrinks when QA expands)
- [x] QA rail: solid dark navy background (#0e0d3a), no transparency
- [x] QA rail: collapsed state = thin vertical tab on right edge with rotated "QA · N" text
- [x] QA rail: expanded state = 280px wide panel, content visible, table content shifts left
- [x] Sessions dropdown: solid dark navy background (#0e0d3a), no transparency
- [x] Account Setup modal: solid dark navy background (#0e0d3a), no transparency
- [x] Targeting modal: semi-transparent backdrop (bg-black/60 + minimal blur), builder visible behind modal
- [x] Targeting modal Interests tab: stack Narrow Targeting (AND) below Detailed Targeting (not side-by-side)
- [x] Targeting modal Custom tab: stack Excluded below Targeted (not side-by-side)
- [x] Targeting modal Custom tab: add searchable Excluded box with same audience search functionality as Targeted
- [x] Date/time picker: merge separate date + time pickers into single combined datetime picker per column
- [x] Date/time picker: make calendar/clock icon WHITE via .datetime-white CSS class (color-scheme: dark + filter: invert)

## Admin Campaign Builder — Bug Fixes (Round 3)

- [x] Datetime picker: force white icon via strengthened CSS (filter: invert(1) brightness(10) saturate(0) + all datetime-edit pseudo-elements)
- [x] Ad Sets tab: combine Start and End date columns into single Start/End column (start on top, end on bottom in same cell)
- [x] Placements popup: solid dark navy background (#0e0d3a), no transparency — match sessions/QA fix
- [x] Age column: widen to prevent truncation; combine Age + Gender into single column (age on top, gender on bottom)
- [x] Targeting modal: fix backdrop so builder table is visible behind modal (rgba(0,0,0,0.55) + blur(2px))
- [x] Budget column: stack Lifetime/Daily toggle buttons on top, budget input below; rename LT button to "Lifetime"
- [x] Reach Estimate modal: add "Run Overlap" button to the left of "Run Estimate" button
- [x] Reach Estimate modal: add checkbox to each ad set row; enable Run Overlap when ≥2 rows selected; results populate Audience Overlap tab
- [x] Audience Overlap modal: add Venn diagram view as selectable option (alongside Summary/Pairs tabs)
- [x] Audience Overlap modal: add overlap level column (Minimal 0-10%, Acceptable 11-20%, Medium 21-30%, High 31-40%, Very High 40%+) in Pairs, Venn, and Summary views
- [x] Audience Overlap modal: include confidence level in Venn diagram view

## Admin Campaign Builder — Bug Fixes (Round 4)

- [x] Age/Gender column: make more compact (tighter spacing, smaller inputs, no excess padding)
- [x] Budget column: make more compact (tighter spacing, smaller toggle buttons)
- [x] Targeting: convert from full-screen modal to inline dropdown popup anchored to the row cell (like Placements popup)
- [x] Optional Fields: convert from accordion panel to inline dropdown popup (like Placements popup)
- [x] Audience Overlap Venn: show two Venn diagrams per pair — one from each ad set's perspective (A's overlap of B, B's overlap of A)

## Admin Campaign Builder — Bug Fixes (Round 5)

- [x] Targeting popup: change from left-0 to right-0 so right edge aligns with right edge of Targeting column
- [x] Placements popup: change from left-0 to right-0 so right edge aligns with right edge of Placements column
- [x] Placements popup: expand horizontally (wider 560px, 3-column grid layout) so all options are visible without scrolling

## Admin Campaign Builder — Pillar View Targeting Wire-up

- [x] Pillar view: wire Location targeting (reuse TargetingPopup Location tab logic)
- [x] Pillar view: wire Interests + Behaviors targeting (reuse TargetingPopup Interests tab logic)
- [x] Pillar view: wire Narrow Targeting (AND) section in pillar audience panel
- [x] Pillar view: wire Custom/LAL Targeted Audiences section (reuse TargetingPopup Custom tab logic)
- [x] Pillar view: wire Excluded Audiences section (reuse TargetingPopup Custom tab excluded logic)
- [x] Pillar view: all targeting changes sync back to the same adSet state used by the spreadsheet view

## Pillar View — Round 2 Fixes & Enhancements

- [x] Fix bulk paste button click in Location tab (z-index / pointer-events issue when inline)
- [x] Fix Done button not working on any step (last step should navigate to next ad set or go back to list)
- [x] Schedule step: replace date-only inputs with datetime-local pickers (same as spreadsheet view)
- [x] Schedule step: remove Campaign dropdown
- [x] Schedule step: add Budget Type, Amount, Optimization Goal fields below start/end datetime
- [x] Schedule step: add Conversion Event searchable input (enabled only for CONVERSIONS/VALUE/QUALITY_LEAD goals, auto-populated from pixel events)
- [x] Rename "Budget" step to a name that covers schedule + budget + optimization (e.g. "Delivery")
- [x] Replace old Budget step with new "Platform" step: platform selector (FB, IG, etc.) + dynamic placement checkboxes
- [x] Platform step: combine FB Feed + IG Feed → "Feed", FB Stories + IG Stories → "Stories", FB Reels + IG Reels → "Reels" for simplified UX
- [x] Platform step: support multi-select placements, dynamic based on selected platforms

## Pillar View — Round 2 Fixes

- [x] Fix bulk paste button not clickable in inline TargetingPopup (needs BulkLocModal rendered in PillarAdSets)
- [x] Fix Done button on last step — should navigate back to ad set list (not disabled when last ad set)
- [x] Schedule step: replace date inputs with datetime-local pickers (start date+time, end date+time)
- [x] Schedule step: remove Campaign dropdown
- [x] Schedule step: add Budget Type, Amount, Optimization Goal fields below datetime pickers
- [x] Schedule step: add Conversion Event searchable input (enabled only when opt goal = CONVERSIONS, auto-populates from pixel events)
- [x] Rename Budget step to Platform
- [x] Platform step: platform selector (Facebook, Instagram, Threads, Messenger, Audience Network)
- [x] Platform step: dynamic placement checkboxes based on selected platforms
- [x] Platform step: combine FB Feed + IG Feed → Feed, FB Stories + IG Stories → Stories, FB Reels + IG Reels → Reels
- [x] Platform step: Advantage+ vs Manual toggle

## Bulk Edit — Ad Sets

- [x] Build shared BulkEditPanel component (slide-in drawer) with fields: budget type/amount, start/end datetime, optimization goal, conversion event, locations (add/replace), custom/LAL targeted audiences (add/replace), excluded audiences (add/replace)
- [x] BulkEditPanel: each field has an "enable" toggle so only checked fields get applied
- [x] BulkEditPanel: locations support "Add to existing" vs "Replace all" mode
- [x] BulkEditPanel: audiences support "Add to existing" vs "Replace all" mode
- [x] Spreadsheet view: add "Bulk Edit" button to toolbar (enabled when 2+ rows selected)
- [x] Spreadsheet view: clicking Bulk Edit opens the BulkEditPanel drawer
- [x] Pillar view: add multi-select mode toggle to ad set list (checkbox per card)
- [x] Pillar view: show "Bulk Edit X ad sets" button when 2+ are checked
- [x] Pillar view: clicking Bulk Edit opens the BulkEditPanel drawer

## Bulk Edit — Age, Gender & Optional Fields

- [x] BulkEditPanel: add Age Range field (min age slider/input + max age slider/input)
- [x] BulkEditPanel: add Gender field (All / Male / Female toggle)
- [x] BulkEditPanel: add collapsed "Optional Fields" section that expands to show available optional fields for bulk editing
- [x] BulkEditPanel optional fields: language, operating system, device type, attribution window, attribution model, frequency control

## Bulk Edit — Placements & Detailed Targeting

- [x] BulkEditPanel: add Placements field (Advantage+ toggle, platform selector, dynamic placement checkboxes with combined Feed/Stories/Reels)
- [x] BulkEditPanel: add Detailed Targeting field (interests/behaviors search + chip list, mode: add/replace)
- [x] BulkEditPanel: add Narrow Targeting (AND) field (interests/behaviors search for AND layer, mode: add/replace)
- [x] BulkEditPanel: wire all new fields into handleApply logic

## Bulk Edit — Round 2 Improvements

- [x] BulkEditPanel: add Name field with mode selector (Prefix / Suffix / Replace) so users can version batches of ad sets
- [x] BulkEditPanel: pre-populate all fields from selection when all selected rows share the same value (budget, dates, goal, age, gender, placements, etc.)
- [x] Spreadsheet view: add Select All checkbox in the table header row to select/deselect all ad sets at once
- [x] Pillar view: add Select All button in the ad set list header when multi-select mode is active

## Pillar View — Audience Step Fix

- [x] Audience step (Step 2): disable Location tab (lockedTab="interests" so only Interests/Custom are active)
- [x] Audience step (Step 2): Bulk Paste button hidden automatically (only renders when audienceFocus === 'location', which is now blocked)

## Pillar View — Pre-Launch QA

- [x] Extract QA check logic from spreadsheet view into a shared QAChecks utility
- [x] Add QA panel to Pillar View Launch step (same checks: missing names, budgets, locations, optimization goals, conversion events, placements, creative mapping)
- [x] QA panel: show pass/fail per ad set with expandable detail rows
- [x] QA panel: show overall readiness score / summary banner
- [x] QA panel: clicking a failed item navigates directly to the relevant ad set + step

## Pillar View — QA Inline on Pillar Cards & Spreadsheet Sidebar

- [x] Show QA error/warning counts inline on each pillar strip card (Campaigns, Ad Sets, Creatives, Ads, Launch) using runQAChecks
- [x] Widen collapsed QA sidebar tab in spreadsheet view (from 28px to 44px)

## Campaign Builder — Project Assignment

- [x] Add Campaign Builder (campaign-creation-admin) to SKILL_PROJECT_CONFIG with defaultProjectId Zb7DRexqB45QqDTQU2VV5Y
- [x] Add project label "Meta Ads Campaign and Ad Builder" for Zb7DRexqB45QqDTQU2VV5Y to PROJECT_LABELS

## Campaign Builder — Meta API Alignment Audit & Fixes

- [x] Fix: Add Threads UI warning (not yet supported by Meta Ads API, silently dropped)
- [x] Fix: Add objective-gated placement guard for FB Reels Overlay
- [x] Fix: Add `contextual_multi_ads: {"enroll_status":"OPT_OUT"}` to every ad creative payload
- [x] Fix: Expand image `degrees_of_freedom_spec` to full required OPT_OUT field set
- [x] Fix: Add `video_filtering` to video `degrees_of_freedom_spec`
- [x] Fix: Add carousel-specific `degrees_of_freedom_spec` with `profile_end_card`, `carousel_highlight_card`, `video_highlights`
- [x] Fix: Add `instagram_user_id` to carousel `object_story_spec`
- [x] Fix: Add `multi_share_end_card: false` and `multi_share_optimized: false` to carousel `link_data`
- [x] Fix: Update placement-customized `asset_feed_spec` to 5-label scheme per skill spec
- [x] Fix: Add `ad_formats: ["AUTOMATIC_FORMAT"]` and `optimization_type: "PLACEMENT"` to placement-customized `asset_feed_spec`
- [x] Fix: Standard image (no placement assets) must use `object_story_spec` not `asset_feed_spec`
- [x] Fix: Apply all above fixes to `updateAdCreative` procedure as well

## Campaign Builder — Launch Bug Fixes (May 11 2026)

- [x] Fix: carousel degrees_of_freedom_spec — remove invalid keys profile_end_card, carousel_highlight_card, video_highlights (use base set only)
- [x] Fix: carousel link_data — remove display_url (not accepted by Meta API in object_story_spec carousel)
- [x] Fix: pixel tracking_specs — attach for ALL objectives including OUTCOME_TRAFFIC (was gated on conversionLocation, now gated on pixelId only)
- [x] Fix: UTMs — pass urlParameters as url_tags only; do NOT append to websiteUrl/feedUrl/storiesUrl via appendParams
- [x] Fix: 9:16 placement customization — placementAssetFor() now normalises dimension strings (9:16, 9x16, 916 all match)
- [x] Fix: custom audience exclusion — AdSetsTableAdmin now stores id|name format; parseAudiences() extracts numeric ID from both formats
- [x] Fix: video description — add description field to video_data in object_story_spec (single video and standard video branches, both createAd and updateAdCreative)
- [x] Feature: add displayUrl (display link) column to CreativeRow, CreativesTableAdmin, and wire to all creative branches
- [x] Fix: update pl-campaign-creation SKILL.md with all above changes documented
- [x] Fix: asset_feed_spec fallback — deferred by user (needs error code 2490433 handling in useLaunchBuildAdmin.ts; not yet implemented)

## Admin Creative Decay Feature (from user zip, May 11 2026)

- [x] Add 5 new DB tables to drizzle/schema.ts: metaSyncSchedule, metaSyncHistory, adSourceDetails, adPerformance, creativeFatigueResults
- [x] Copy creativeDecayAdmin.ts router to server/routers/admin/
- [x] Mount creativeDecayAdminRouter in server/routers.ts as adminCreativeDecay
- [x] Copy AdminCreativeDecay.tsx to client/src/pages/admin/
- [x] Add /admin/creative-decay route to App.tsx (admin-only)
- [x] Add Creative Decay item to ADMIN_ITEMS in AppShell.tsx
- [x] DB tables already existed — marked migration 0015 as applied in drizzle tracking table
- [x] Verify TypeScript compiles clean

## Admin Campaign Builder — Post-Mortem Fixes (May 11 2026 Launch)

- [x] Fix Issue 1: special_ad_categories must be a JSON array (["NONE"]), not a string "NONE"
- [x] Fix Issue 2: is_adset_budget_sharing_enabled must be explicitly set to false when CBO is off
- [x] Fix Issue 3: attribution_spec must use ENGAGED_VIDEO_VIEW not ENGAGED_VIEW
- [x] Fix Issue 4: OUTCOME_SALES promoted_object must use pixel_id + custom_event_type: OTHER only — never custom_conversion_id
- [x] Fix Issue 5: OUTCOME_TRAFFIC ad sets must omit promoted_object entirely
- [x] Fix Issue 6: OUTCOME_TRAFFIC attribution_spec must be 1-day click only (not 7d click + 1d view)
- [x] Fix Issue 7: asset_feed_spec bodies/titles/descriptions must deduplicate — same text across labels must use one entry with all labels, not one entry per label
- [x] Update pl-meta-builder skill with all 7 fixes documented

## Campaign Builder — Objective-Gated Fields & Missing Settings (May 11 2026)
- [x] Fix: wire specialAdCategory from CampaignRow through useLaunchBuildAdmin → createCampaign (field exists in UI but was never sent to API)
- [x] Fix: make CBO, specialAdCategory, and is_adset_budget_sharing_enabled optional fields in Campaign tab with correct defaults (CBO=false, specialAdCategory=NONE, adSetBudgetSharing=false)
- [x] Feature: add bidStrategy field to AdSetRow + AdSetsTableAdmin (dropdown: Highest Volume default / Cost per Result Goal / Bid Cap / Highest Value / ROAS Goal) — gated by objective + performance goal
- [x] Feature: add bidCap, costCap, roasFloor conditional inputs to AdSetsTableAdmin (shown based on bidStrategy selection)
- [x] Feature: wire bidStrategy + bidCap/costCap/roasFloor through buildAdSetApiExtras → metaAdmin.ts createAdSet
- [x] Feature: add destination_type inference function in builderMetaMappingAdmin (derived from objective + conversionLocation + optimizationGoal)
- [x] Feature: wire destination_type through buildAdSetApiExtras → metaAdmin.ts createAdSet
- [x] Feature: add pacing_type to createAdSet payload (day_parting when adset_schedule is set, standard otherwise)

## Campaign Builder — UI Changes (May 11 2026 batch 2)
- [x] Feature: add Optional Fields column to Campaign tab (specialAdCategory, CBO) — same pattern as Ad Sets optional fields popup; defaults NONE/false
- [x] Fix: inferDestinationType() map keys updated to match actual CONVERSION_LOCATIONS enum values (INSTAGRAM_PROFILE, ON_AD, PHONE_CALL, IG_FB_COMBINED)
- [x] Feature: add Abort button to Exports tab launch progress panel (OctagonX icon, trpc.runs.abortRun, isAborting state)

## Admin Creative Decay — Full Redesign (May 11 2026)

- [x] Schema: add `metaSyncSchedule` table (enabled, utcHour, rollingDays, syncPreset, tokenId, accountId, campaignIds, campaignStatusFilter, notifyEmerging, notifyPossible, notifyProbable, onlyLiveAds, lastRunAt, lastRunStatus, lastAnalysisAt, lastAnalysisStatus)
- [x] Schema: add `firstFatigueDetected` table (fingerprint, accountId, level, firstDetectedAt) — tracks when each signal level was first seen per creative
- [x] DB tables created via direct SQL (drizzle-kit migrate had env issues)
- [x] Server: split `runAnalysis` into `syncPerformance` (sync only) and `runDecayAnalysis` (analysis only) procedures
- [x] Server: add `getSchedulerConfig` and `saveSchedulerConfig` procedures
- [x] Server: update `analyzeStoredPerformance` to accept `onlyLiveAds` filter and populate `firstFatigueDetected` table
- [x] Server: update `mapResult` to include `firstDetectedAt` from `firstFatigueDetected` table
- [x] Server: update `getCampaignsByTokenId` to accept `statusFilter` param (active / active_30d / inactive / all)
- [x] Server: add `syncPerformance` procedure with campaign status filter support
- [x] Server: add node-cron hourly scheduler that fires sync + analysis at configured UTC hours
- [x] UI: build shared `DateRangePicker` component (single popover, start+end, presets: Today, Yesterday, Last 7d, Last 14d, Last 30d, Last 90d)
- [x] UI: replace all 4 date inputs in AdminCreativeDecay with DateRangePicker (one for sync, one for analysis)
- [x] UI: split header actions into "Sync Ad Performance" and "Run Decay Analysis" buttons
- [x] UI: add Scheduler panel with enable toggle, UTC hour, rolling days, yesterday preset, campaign status filter, notification thresholds (emerging/possible/probable), live-ads-only toggle
- [x] UI: add campaign status filter dropdown to Campaign Scope panel (Active / Active in last 30 days / Inactive / All)
- [x] UI: update Results table to show `firstDetectedAt` column per signal level
- [x] UI: add Signals Only / All filter toggle to Results panel
- [x] Fix: deduplicate BM token selector to show only one entry per unique BM id (AdminCreativeDecay + SettingsDrawerAdmin)

## Admin Creative Decay — Fatigue Trend Chart (May 11 2026)

- [x] Server: daily trend series (date, ctr, frequency, impressions, rolling fatigueScore) computed inline in analyzeStoredPerformance and returned per-fingerprint in `trendData` field
- [x] UI: build `FatigueTrendChart` component (Recharts ComposedChart, dual-axis: fatigue score area + CTR area + frequency dashed line, reference lines at 30/50/70, custom tooltip)
- [x] UI: add expandable trend row to ResultsTable — LineChart icon button per row expands inline chart panel
- [x] UI: expand/collapse toggle per row (ChevronDown when open, LineChart icon when closed), disabled when <2 data points

## Campaign Builder Admin — Meta API Fixes (May 2026 doc)

- [x] Fix 1: `special_ad_categories` — already correct (JSON array)
- [x] Fix 2: `is_adset_budget_sharing_enabled` — already correct (derived from cbo)
- [x] Fix 3: `bid_strategy` — already correct (always explicit, defaults to LOWEST_COST_WITHOUT_CAP)
- [x] Fix 4: `targeting_automation: { advantage_audience: 0 }` — added to buildBuilderTargetingSpec for all non-Advantage+ ad sets; added `advantageAudience` field to AdSetRow
- [x] Fix 5: `attribution_spec` — OUTCOME_TRAFFIC now omits key entirely; all other objectives use canonical 3-event spec (7d click + 1d engaged_video_view + 1d view_through)
- [x] Fix 6: `promoted_object` — already correct (omitted for OUTCOME_TRAFFIC, pixel+OTHER for Sales/Leads)
- [x] Fix 7: Custom audience id|name parsing — already correct in parseAudiences()
- [x] Fix 8: `object_story_spec` anchor (page_id + instagram_user_id) added alongside asset_feed_spec in both createAd and updateAdCreative placement-customized branches
- [x] Fix 9: Carousel display_url removed, multi_share_*: false — already correct
- [x] Fix 10: `contextual_multi_ads: OPT_OUT` — already on every branch
- [x] Fix 11: `degrees_of_freedom_spec` per format — already correct (video adds video_filtering, carousel excludes invalid fields)
- [x] Fix 12: UTM params in url_tags only — already correct

## Admin Creative Decay — Split into Two Separate Tools (May 11 2026)
- [x] Create new server router: creativePerformanceSyncAdmin.ts — syncPerformance, getSchedulerConfig (sync only), saveSchedulerConfig (sync only), listSyncHistory
- [x] Create new page: AdminCreativePerformanceSync.tsx — BM token, ad account, campaign scope (with status filter), sync date range, sync scheduler (with Yesterday preset), sync history log
- [x] Strip sync logic from creativeDecayAdmin.ts — removed syncPerformance, sync scheduler fields, sync history procedures
- [x] Rewrite AdminCreativeDecay.tsx — analysis-only: BM token (for campaign scope loading), ad account, campaign scope, analysis date range, analysis scheduler, results table
- [x] Register AdminCreativePerformanceSync at /admin/creative-performance-sync in App.tsx
- [x] Add "Creative Perf. Sync (Admin)" entry to ADMIN_ITEMS in AppShell.tsx
- [x] TypeScript check: 0 errors

## Creative Performance Sync — Scheduler Duplicate Fields Fix
- [x] Removed BM Token and Ad Account ID SchedField blocks from scheduler panel
- [x] Removed vaultTokenId and accountId from sched state
- [x] saveScheduler.mutate now injects tokenId, accountId, and campaignIds from the main page state at save time
- [x] Scheduler panel shows an info banner: confirms which token/account will be used, or warns if none selected
- [x] TypeScript: 0 errors

## Creative Decay + Perf Sync — UI Overhaul (May 12 2026)
- [x] Creative Decay scheduler: removed duplicate ad account/token fields; inject from main page state at save time; info banner shows which account will be used
- [x] Both pages: compact sizing — p-3 cards, text-xs/text-[11px], tighter gaps (gap-3)
- [x] Both schedulers: auto-save when Enable toggle is flipped; View Config button opens read-only summary modal
- [x] Creative Decay: tabbed output area with "Decay Results" tab and "Notifications" tab
- [x] Creative Decay Notifications tab: shows log of notification events (ad name, account, signal level, fatigue score, sent at)
- [x] Schema: decayNotificationLog table added (id, accountId, adId, adName, signalLevel, fatigueScore, firstDetectedAt, notifiedAt, notifyUserId, dateFrom, dateTo)
- [x] Server: getDecayNotifications procedure returns last 100 notifications; cron writes per-ad rows to decayNotificationLog when signals fire
- [x] Notifications routing: notifyOwner always sends to project owner (admin-only tool); notifications tab shows full log
- [x] TypeScript: 0 errors; Vite em-dash error fixed in AdminCreativePerformanceSync.tsx

## Creative Sync + Decay Redesign (Multi-Account, User-Scoped)

### Schema
- [x] Add userId column to metaSyncSchedule (make schedules user-scoped, unique on userId+accountId)
- [x] Add decay_reports table (userId, accountId, campaignIds, dateFrom, dateTo, type manual/auto, signalCount, reportJson, createdAt)
- [x] Add slackWebhookUrl column to users table
- [x] Run SQL migrations for all three schema changes

### Backend
- [x] Update getSchedulerConfig / saveAnalysisSchedulerConfig to be user-scoped (filter by ctx.user.id)
- [x] Add getUserDecaySchedules procedure (returns all schedules for logged-in user across accounts)
- [x] Add saveDecayReport procedure (saves serialized report to decay_reports)
- [x] Add getDecayReports procedure (returns all reports for logged-in user, sorted by createdAt desc)
- [x] Add saveSlackWebhook procedure (saves webhook URL to users.slackWebhookUrl)
- [x] Add Slack notification helper (sendSlackNotification) called after auto analysis fires
- [x] Update cron to iterate all enabled schedule rows (not just row id=1), fire per-user per-account
- [x] Update runDecayChain to save auto report to decay_reports and send Slack notification
- [x] Update getAnalysisSchedulerConfig to accept accountId and return user+account specific row

### Creative Performance Sync Page Redesign
- [x] Remove Database Flow info box
- [x] Remove duplicate Campaign Status Filter (keep only in Campaign Scope card)
- [x] Combine Automated Sync Scheduler into collapsible panel below manual pull section
- [x] Scheduler panel: Enable toggle, UTC Hour, Date Preset only (no separate Campaign Scope for scheduler)
- [x] Sync History table stays, cleaned up styling

### Creative Decay Page Redesign
- [x] Section 1 — Manual Analysis: BM Token, Ad Account, Date Range, Campaign Scope, Run Analysis button
- [x] Add Save Report button that appears after analysis runs (saves to decay_reports as type=manual)
- [x] Section 2 — Automated Schedule: collapsible panel per account, Enable toggle, UTC Hour, Rolling Days, Always Send Report toggle, notification thresholds, Slack webhook URL input
- [x] Section 3 — Reports Library: unified table across all user accounts (Type pill, Date Range, Account, Run Date, Signal Count, View button)
- [x] Reports Library View: loads full results output in a drawer/modal
- [x] Section 4 — Notifications: existing decay notification log, now user-scoped across all accounts
- [x] My Schedules view: shows all active schedules across accounts with enable/disable per row

## Admin Profile Page + Schedule Conflict Detection

- [x] Add getProfile / saveProfile admin-only tRPC procedures (return/save slackWebhookUrl)
- [x] Create AdminUserProfile.tsx page with Notification Preferences (Slack webhook URL, test button)
- [x] Register /admin/profile route in App.tsx
- [x] Add "My Profile" entry to ADMIN_ITEMS in AppShell.tsx
- [x] Add schedule conflict detection in AdminCreativeDecay.tsx (warn if UTC hour already used by another schedule)

## Sync Engine Improvements (May 13)
- [x] Remove publisher_platform breakdown from sync — single insights call with reach/frequency included directly
- [x] Add onlyLiveAds filter (ad-level ACTIVE status check via Meta API) to syncPerformance procedure, scheduled config schema/DB, cron runner, and UI
- [x] Implement async Meta Insights job polling for large accounts (detect job_id response, poll async_status until complete)
- [x] Verify cross-adset fingerprint aggregation is working correctly in decay analysis

## Sync Engine Improvements (May 2026)
- [x] Remove publisher_platform breakdown from sync — single unified insights call, no breakdown
- [x] Reach and frequency now pulled inline in the same call (no longer a separate API call)
- [x] Add onlyLiveAds filter (ad.effective_status=ACTIVE) to manual sync and scheduled config
- [x] Implement async Meta Insights job polling (metaInsightsAsync) for large accounts
- [x] Cross-adset fingerprint aggregation verified — groups by contentFingerprint across all ad sets

## Creative Decay UI Display Fixes (May 14 2026)
- [x] Add adset_name and image_url columns to creative_fatigue_results DB table (schema + migration)
- [x] Populate adsetName in analyzeStoredPerformance result record (from group rows)
- [x] Populate imageUrl in analyzeStoredPerformance result record (join adSourceDetails by contentFingerprint)
- [x] Flatten evidence fields (ewmaDrop, ctrDrop, frequency, totalEvents, reliability, spend, impressions) to top-level in mapResult()
- [x] Fix ResultRow type to use creativeId/creativeName (matching server response) instead of adId/adName
- [x] Fix fatigueStatus comparisons in UI to use server enum values (URGENT/REFRESH/MONITOR/HEALTHY)
- [x] Fix FatiguePill to display human-readable labels for server enum values
- [x] Fix "Invalid Date" — firstDetectedAt is an object {emerging, possible, probable}, not a flat string
- [x] Fix score color thresholds (was 0-1 scale, now correctly 0-100)
- [x] Add creative thumbnail rendering in Creative column (img with onError fallback)
- [x] Fix EWMA Drop and CTR Drop display to show as percentages (multiply by 100)
- [x] Fix Reliability display to show as percentage
- [x] Add backward-compat normalization for old saved reports (adId→creativeId, adName→creativeName)

## Fingerprint Fix (May 15 2026)
- [x] Expand Meta API creative fields request to include video_id, object_story_spec sub-fields (link_data.image_hash, video_data.video_id, photo_data.image_hash), and asset_feed_spec sub-fields (images.hash, videos.video_id)
- [x] Fix parseCreative() image_hash extraction: add fallbacks for link_data.image_hash, asset_feed_spec.images[0].hash, photo_data.image_hash
- [x] Fix parseCreative() video_id extraction: add fallbacks for asset_feed_spec.videos[0].video_id and creative.video_id
- [x] Fix imageUrl extraction: add fallbacks for asset_feed_spec images[0].url and videos[0].thumbnail_url

## Campaign-Scoped Fingerprint Grouping (May 15 2026)
- [x] Change decay analysis grouping key from contentFingerprint to campaignId::contentFingerprint so same creative in different campaigns is analyzed independently
- [x] Fix imageUrlMap to extract raw fingerprints from compound keys for DB lookup
- [x] Fix first for loop to extract raw fingerprint from compound key for result record contentFingerprint field
- [x] Fix second for loop (trend series) to key trendByFingerprint by compound groupKey
- [x] Fix trendData lookup in return to reconstruct compound key from campaignIds[0] + contentFingerprint

## Move Creative Decay + Sync to Early Detection (May 15 2026)
- [x] Replace placeholder Creative Decay button in AppShell Early Detection with real NavItem linking to /early-detection/creative-decay
- [x] Add Creative Performance Sync NavItem to Early Detection section in AppShell
- [x] Add Early Detection section cards to Dashboard.tsx
- [x] Change routes from /admin/creative-decay and /admin/creative-performance-sync to /early-detection/creative-decay and /early-detection/creative-performance-sync (accessible to all authenticated users)
- [x] Remove admin-only framing from AdminCreativePerformanceSync.tsx header text/badge
- [x] Keep /admin/* routes as backward-compat aliases (no AdminRoute guard)

## Scheduler Fixes (May 15 2026)
- [x] Fix runDecayChain to accept slackWebhookUrl param and call sendSlackNotification when triggered signals exist
- [x] Fix cron to iterate ALL enabled schedule rows (not just id=1) and look up each user's slackWebhookUrl
- [x] Fix triggerDecayAnalysis procedure to also send Slack notification when signals are triggered
- [x] Remove inline Automated Sync Scheduler accordion from AdminCreativePerformanceSync.tsx
- [x] Add Schedule button to AdminCreativePerformanceSync header that opens a schedule config modal

## adminProcedure → protectedProcedure Fix (May 15 2026)
- [x] Remove adminProcedure guard from creativeDecayAdmin.ts (all 14 procedures now use protectedProcedure)
- [x] Remove adminProcedure guard from creativePerformanceSyncAdmin.ts (all 5 procedures now use protectedProcedure)
- [x] Rename router keys in routers.ts: adminCreativeDecay → creativeDecay, adminCreativePerformanceSync → creativePerformanceSync
- [x] Update all client-side trpc.adminCreativeDecay.* references to trpc.creativeDecay.* (AdminCreativeDecay.tsx, AdminUserProfile.tsx)
- [x] Update all client-side trpc.adminCreativePerformanceSync.* references to trpc.creativePerformanceSync.* (AdminCreativePerformanceSync.tsx)
- [x] TypeScript: 0 errors

## Slack + UX Improvements (May 15 2026)
- [x] Improve Slack notification message: include account name (config.accountName), user name (look up from users table by userId), emoji per signal level (🔴 Probable, 🟠 Possible, 🟡 Emerging)
- [x] User-scoped sync history: add userId column to meta_sync_history, write ctx.user.id on syncPerformance, filter getHistory by ctx.user.id
- [x] Slack webhook onboarding banner on Creative Decay page: dismissible amber banner links to /profile if no slackWebhookUrl set
- [x] Move My Profile nav item from ADMIN_ITEMS to main sidebar (visible to all authenticated users); /profile route added, /admin/profile kept as alias
- [x] TypeScript: 0 errors

## Bug Fix (May 15 2026)
- [x] Fix runDecayAnalysis (on-demand Analysis tab) to fetch ctx.user.slackWebhookUrl and send Slack notification when signals detected — it was doing its own inline analysis instead of going through runDecayChain, so slackWebhookUrl was never fetched or passed

## User-Scoping Fixes (May 15 2026)
- [x] Scope Notifications tab: filter decayNotificationLog by ctx.user.id in getDecayNotifications procedure; also write notifyUserId into log rows on insert
- [x] Scheduled sync userId passthrough: pass config.userId into syncMetaPerformanceData in both the decay cron and the performance sync cron so scheduled runs appear in each user's Sync History

## Disable Email Notifications (May 15 2026)
- [x] Remove notifyOwner() calls from both runDecayAnalysis and runDecayChain; removed unused import. Slack is now the only notification channel.

## Fatigue Escalation Timeline + Projection (May 15 2026)
- [x] Build shared utility (fatigueEscalation.ts): buildEscalationTimeline, computePeerVelocities, formatTimelineText, formatProjectionText
- [x] Update Slack message: each creative now shows full timeline (📅 Emerging: May 3 → Possible: May 9) + projected next level (⏱ Est. Probable: ~May 22)
- [x] Update analysis results table: expanded row now shows color-coded Escalation Timeline pills + dashed Est. next level pill with projection date

## Revert Escalation Timeline (May 15 2026)
- [x] Remove timeline/projection lines from Slack message (both runDecayChain and runDecayAnalysis paths)
- [x] Revert ResultsTable expanded row back to plain evidence pills (remove Escalation Timeline section)

## Hybrid Creative Grouping — Fuzzy Name Fallback (May 18 2026)
- [x] Build adNameCanonical.ts: four-pass fuzzy name canonicalization utility (common prefix strip, audience segment strip, suffix grouping, fuzzy dedup at threshold 94)
- [x] Integrate Pass 2 into decay analysis grouping: after hash-based Pass 1, merge single-ad-set groups whose canonical ad names match within the same campaign
- [x] TypeScript: 0 errors

## Creative Name Display + AGGREGATED Ad Set Label (May 18 2026)
- [x] Add canonicalAdName (stripped display name) and adSetCount fields to the server result mapper
- [x] Creative column: show canonicalAdName, full raw name on hover tooltip
- [x] Ad Set column: show actual ad set name when adSetCount === 1, show "AGGREGATED" badge (cyan) when adSetCount > 1
- [x] TypeScript: 0 errors

## Campaign Required + Active-Only Enforcement (May 18 2026)
- [x] Creative Decay manual analysis: require ≥1 campaign selected (disable Run button + show inline note), removed "Only live ads" toggle, added "Only active ads are analyzed" note
- [x] Creative Decay schedule form: require ≥1 campaign selected (disable Save button + show inline note), added "Only active ads are analyzed" note
- [x] Performance Data Sync manual form: require ≥1 campaign selected (disable Sync button + show inline note), removed onlyLiveAds toggle, added "Only active ads are synced" note
- [x] Performance Data Sync schedule form: require ≥1 campaign selected (disable Save button + show inline note), removed onlyLiveAds toggle, added "Only active ads are synced" note
- [x] Server-side: enforce campaignIds.min(1) in runDecayAnalysis; onlyLiveAds defaults to true in both procedures
- [x] TypeScript: 0 errors

## Creative Decay Enrichments 1-4 (May 2026)

### Enrichment 1 — True Signal Date
- [x] Add `signal_date` column to `first_fatigue_detected` table in schema
- [x] Compute signal dates from daily trend series (first date crossing each threshold)
- [x] Update `firstFatigueDetected` insert to include `signalDate` with LEAST/COALESCE idempotency
- [x] Update `firstDetectedMap` loader to carry both `observedAt` and `signalDate`
- [x] Update `mapResult()` to expose both dates per level
- [ ] Update `fatigueEscalation.ts` to prefer `signalDate` over `observedAt` (deferred)

### Enrichment 2 — Performance Impact (Expected vs Actual vs % Change)
- [x] Add 16 impact columns to `creative_fatigue_results` table in schema
- [x] Compute early/recent CPM (impression-weighted) and early/recent frequency (impression-weighted)
- [x] Implement `computeImpact()` helper function
- [x] Wire impact computation into result object assembly
- [x] Expose impact data in `mapResult()` as nested object
- [x] Add expandable Impact panel in AdminCreativeDecay results table

### Enrichment 3 — Score-Trajectory Projection
- [x] Create `server/routers/admin/decayVelocity.ts` with `projectFromSlope()` (OLS fit)
- [x] Add 4 projection columns to `creative_fatigue_results` table in schema
- [x] Wire slope projection into analysis loop after trend series is built
- [ ] Update `fatigueEscalation.ts` to prefer slope-based projection over peer-velocity (deferred)
- [ ] Update `formatProjectionText()` to show slope and R² when available (deferred)

### Enrichment 4 — Decay Velocity Classification
- [x] Add `classifyVelocity()` and `velocityGuidance()` to `decayVelocity.ts`
- [x] Add `decay_velocity` enum column to `creative_fatigue_results` table in schema
- [x] Wire velocity classification into analysis loop
- [x] Expose `decayVelocity` and `velocityGuidance` in `mapResult()`
- [x] Add velocity badge to UI results table (colored: red=fast, amber=moderate, blue=slow)

### Cross-cutting
- [x] Run `pnpm db:push` for all schema changes (single migration)
- [x] Update Slack notification body with impact, projection, and velocity data
- [x] Write Vitest tests for `computeImpact`, `projectFromSlope`, `classifyVelocity`, `findFirstCrossings`
- [x] TypeScript: 0 errors

## Creative Decay Bug Fixes (May 2026 — Round 2)

- [x] Fix expiring Facebook CDN image URLs: skip storing fbcdn.net URLs in ad_source_details.image_url during sync; hide img tag gracefully in UI when URL is a CDN URL
- [x] Add emerging signal projection: compute projected date for emerging threshold (score ≥ 30) in decayVelocity.ts and display it as a pill alongside possible/probable projections
- [x] Fix expand collision: change expandedRow state from single string to Set<string> so multiple rows can be expanded independently at the same time

## Campaign Builder Account Setup Fixes (May 2026)

- [x] Server: merge owned_pages + client_pages in getFacebookPagesByTokenId (both meta.ts and metaAdmin.ts) — always return combined deduplicated list
- [x] Server: add getPixelsByTokenId procedure to meta.ts — fetch owned_pixels + client_pixels from BM, return combined deduplicated list with id and name
- [x] UI: update SettingsDrawer pixel step to use SearchableSelect dropdown (same pattern as ad accounts) instead of ManualInput text field
- [x] UI: keep manual fallback input for pixel if dropdown returns empty (same pattern as pages)
- [x] UI: store pixelName alongside pixelId in BuildSettings so status summary can show the pixel name

## Campaign Builder — Bulk Ad Set Actions (May 2026)

- [x] Bulk duplicate (AdSetsTableAdmin only): separate button in toolbar; opens a campaign selection modal to choose which campaign to duplicate the selected ad sets into; carries over all settings, keeps optimization goal as-is

## Campaign Builder — Available to All Users (May 2026)

- [x] Replace Coming Soon Campaign Builder placeholder in sidebar with actual working Campaign Builder route
- [x] Add /campaign-builder route pointing to the admin campaign builder component (or a shared version)
- [x] Ensure non-admin users can access the campaign builder and launch builds (check tRPC procedure permissions)
- [x] Allow manual pixel ID input in Campaign Builder Settings/Setup section (SettingsDrawerAdmin)
- [x] Add radius option for selected locations in Campaign Builder targeting (per-location radius control on chips for cities and custom locations)
- [x] Support individual address/place locations via the search typeahead (subcity, neighborhood, geo_market added to location_types)
- [x] Update pixel ID section in SettingsDrawerAdmin to fetch and display both pixels AND datasets connected to the token/ad account
- [x] Add address/place-level location targeting: allow users to type a specific address, geocode it to lat/lng, and set a radius (1-50 mi) using Meta's custom_locations targeting
- [x] Implement column width resizing on the Ad Sets tab (same drag-to-resize behavior as the Campaigns tab)
- [x] Fix: custom conversion event selected in Campaign Builder must be passed as promoted_object.custom_conversion_id when creating ad sets via Meta API
- [x] Fix: Column resize on Campaigns and Ad Sets tabs crashes with "Cannot read properties of null (reading 'key')" TypeError
- [x] Add "Pin a Location" address finder with radius controls to Bulk Edit Ad Sets Locations section (same geocoding search + per-location radius as in TargetingPopupAdmin)
- [x] Fix: Custom conversion ID still not being passed to ad set creation via Meta API (conversion event field empty in Ads Manager)
- [x] Fix: Advantage+ placements only sending Facebook & Instagram platforms, missing Audience Network/Messenger/WhatsApp/Threads

## Campaign Builder — Import Existing Visibility Fix

- [x] Import Existing button only shows on Ads Only tab (hidden on Full Build and Update Ads)

## Campaign Builder — Ads Only Mode Isolation & Read-Only Views

- [x] Isolate imported campaigns/ad sets so they don't populate into Full Build or Update Ads state (keep in importedCampaigns/importedAdSets only)
- [x] Ads Only Campaigns tab: read-only table with columns (Name, Objective, Status, Campaign ID) + "READ-ONLY — Imported from Meta" info bar
- [x] Ads Only Ad Sets tab: read-only table with columns (Name, Campaign, Status, Ad Set ID) + "READ-ONLY — Imported from Meta" info bar
- [x] Full Build and Update Ads tabs show the existing editable tables as before (no change)

## Campaign Builder — Persistent Creative Library per Ad Account

- [x] Database schema: creative_library table keyed by ad account ID + creative row ID
- [x] Server tRPC procedures: getCreativeLibrary, upsertCreative, deleteCreative per ad account
- [x] Frontend auto-save: debounced sync of creative library changes to DB
- [x] Frontend auto-load: load creative library from DB when ad account is selected in Settings
- [x] Creative Library shared across all build modes (Full Build, Ads Only, Update Ads) for same ad account

## Campaign Builder — Undo, Sorting, Placements Tab, Quick Build

- [x] Undo button on every tab (Full Build/Ads Only/Update Ads and sub-tabs: Campaigns, Ad Sets, Creative Library, Ads, Export)
- [x] Column sorting (asc/desc) for Ad Sets tab: Campaign Name, Ad Set Name
- [x] Column sorting (asc/desc) for Campaigns tab: Status, Campaign Name, Objective, Spend Cap
- [x] Placements as 4th tab in targeting modal (to the right of Custom), accordion-style platform expansion (one at a time, selections persist)
- [x] Quick Build button on Custom tab (top-right) linking to custom/LAL audience builder section

## Campaign Builder — Bulk Edit, Creative Library Improvements

- [x] Bulk Edit modal: individual ad set editing per field (e.g., Locations shows "All Ad Sets" + one option per selected ad set)
- [x] Bulk Edit modal: combine Detailed Targeting + Narrow Targeting (AND) into one section
- [x] Bulk Edit modal: combine Targeted Custom/LAL Audiences + Excluded Custom/LAL Audiences into one section
- [x] Creative Library: fix 9:16 asset positioning — always under Stories/Reels column, not nested under Feed
- [x] Creative Library: multi-cell paste across text fields (Creative Concept, Length, Website, Headline, Primary Text, Description, Display Link, Link to UTM)
- [x] Creative Library: DONE button at far right of each row to collapse it; click row to expand again

## Campaign Builder — Selective Export for New Ads (Import Existing Flow)

- [x] Detect already-published ads (those with an existing Ad ID) vs new ads (no Ad ID) in the Ads tab after importing existing
- [x] Add selection UI (checkboxes) on the Ads tab/export step so users can select which ads to export to Meta
- [x] Auto-select only new/unpublished ads by default; already-published ads should be unchecked and visually marked
- [x] Prevent already-published ads from being re-published unless explicitly selected by the user

## Ad QA Checklist Skill

- [x] Create Python skill script (ad_qa_checklist.py) that fetches ad data from Meta Graph API
- [x] Implement 5-branch degrees_of_freedom_spec checking (Static No PAC, Static PAC, Video No PAC, Video PAC, Carousel)
- [x] Generate XLSX output with all required columns matching screenshot format
- [x] Add skill prompt builder in manusTask.ts for ad-qa-checklist
- [x] Add tRPC procedure to launch QA skill run
- [x] Add "Run QA" button in Campaign Builder Export panel UI
- [x] Wire QA results back to UI (download XLSX)

## Ad QA Checklist - Visibility & Selection Fix

- [x] Move Run QA button to be visible next to Launch Build button (not hidden below viewport)
- [x] Change QA to use the same Export checkbox selection instead of only targeting published ads
- [x] QA runs on selected ads that have Meta Ad IDs; shows count + warning for selected ads without IDs

## Ad QA Checklist - Dedicated Tab

- [x] Create QaChecklistTab component with cascading Campaign > Ad Set > Ads dropdowns
- [x] Campaign dropdown: multi-select, Active/Inactive filter (default Active)
- [x] Ad Set dropdown: multi-select, filtered by selected campaigns
- [x] Ads dropdown: multi-select, filtered by selected ad sets, with Active/Inactive/Last 7 Days filter
- [x] Run QA button triggers the launchQaChecklist skill on selected ad IDs
- [x] Download XLSX link appears when QA completes
- [x] Add "QA Checklist" tab to Campaign Builder top nav (right of "Update Ads")
- [x] Remove QA section from ExportPanel (moved entirely to dedicated QA Checklist tab)

## Ad QA Checklist - Production Runtime Fix

- [x] Inline Python script as string constant (adQaChecklistScript.ts) instead of fs.readFileSync at runtime
- [x] Remove fs, path, fileURLToPath imports from manusTask.ts (no longer needed)
- [x] TypeScript compiles clean, dev server restarts successfully

## Native QA Backend (Replace Manus Skill)

- [x] Create server/services/qaChecklist.ts — native TypeScript port of the QA logic (batch API, ads QA, adsets QA, XLSX generation)
- [x] Create tRPC procedure runQaChecklistDirect that executes QA directly and returns XLSX download URL
- [x] Rewire QaChecklistTabAdmin.tsx frontend to call the new direct procedure (no polling, instant result)
- [x] Remove old Manus-based launchQaChecklist procedure and related code (kept for backward compat)
- [x] TypeScript compiles clean, dev server runs
- [x] Vitest tests pass (21 tests covering format detection, DOF comparison, field extractors, UTM, geo)

## QA Violations Inline Details + One-Click Fix

- [x] Update qaChecklist.ts to return structured violations array (adId, adName, setting, currentValue, expectedValue, adsManagerUrl)
- [x] Add tRPC procedure fixAdDofViolation that PATCHes the ad's degrees_of_freedom_spec via Meta Graph API
- [x] Update QaChecklistTabAdmin.tsx: show violations panel after QA completes with ad name, setting, link, and Fix button
- [x] Fix button calls fixAdDofViolation and marks the row as fixed in the UI
- [x] TypeScript compiles clean, tests pass (70 tests)

## QA Checklist Bug Fixes

- [x] Fix "Invalid parameter" error on fixAdDofViolation — payload format rejected by Meta API
- [x] Expand DOF detection to cover ALL Advantage+ creative fields: music, inline_comment, text_optimizations, text_extraction, standard_enhancements, enhance_cta
- [x] Ensure the fix endpoint sends the correct payload structure that Meta accepts
- [x] All 75 tests pass (5 new tests for nested customizations, standard_enhancements, audio, inline_comment)

## Unique Creative IDs Per Ad

- [x] Ensure each ad gets a unique creative ID at creation time (prevent Meta deduplication by adding unique differentiator to each creative)

## QA Checklist — Add Music Fix
- [x] Fix structured violations builder to properly parse Add Music violation string (regex match)
- [x] Update fixAdDofSpec to include asset_feed_spec.audios = [{type: "opted_out"}] in fix payload
- [x] Add unit tests for Add Music violation detection and fix payload

## QA Checklist — Fix Actually Persisting DOF Changes
- [x] Rewrite fixAdDofSpec to use three-step approach: fetch existing creative → create NEW creative with corrected DOF → reassign ad to new creative
- [x] Previous approach (POST creative_id + DOF to ad ID) returned success but Meta silently ignored DOF changes
- [x] New approach creates a fresh creative at /act_{accountId}/adcreatives with corrected degrees_of_freedom_spec baked in
- [x] Update tests to match new three-step approach (87 tests pass)

## QA Verification — Standalone Page

- [x] Create standalone QaVerification.tsx page (938 lines) with BM token selector → Ad Account → Campaign → Ad Set → Ads cascading selectors
- [x] Add route /qa-verification to App.tsx
- [x] Add QA Verification NavItem under Tools section in AppShell.tsx sidebar (ShieldCheck icon)
- [x] Include contextual_multi_ads: OPT_OUT and multi_advertiser_eligibility: INELIGIBLE in new creative payload during fix
- [x] TypeScript compiles clean, all 87 tests pass
- [x] Add multi-advertiser ads detection to QA scan (fetch contextual_multi_ads field, report as violation if OPT_IN)

## QA Verification — Layout Redesign & Inline Results

- [x] Redesign QaVerification.tsx to two-column layout: left panel (inputs/selectors, fixed width ~360px), right panel (results, flex-1) — matching SkillRunner layout
- [x] Default ads filter to LAST_7_DAYS when ad sets are selected (instead of ACTIVE)
- [x] Add inline QA results display in right panel: summary card + violations list + ad rows table rendered as readable markdown/structured view
- [x] Add Download Excel button in right panel header (replaces top-bar download button)
- [x] Show idle state in right panel when no QA run yet (matching SkillRunner idle placeholder)
- [x] Show loading/running state in right panel when QA is in progress
