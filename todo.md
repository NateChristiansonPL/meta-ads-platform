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
- [ ] Fix: asset_feed_spec fallback — on Meta error 2490433, retry createAd with object_story_spec using feed-dimension asset (deferred — needs error code handling in useLaunchBuildAdmin.ts)

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
