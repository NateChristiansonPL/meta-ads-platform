/**
 * Manus Task API Service
 * Handles creating, polling, and extracting results from Manus skill tasks.
 * Base URL: https://api.manus.ai
 * Auth: x-manus-api-key header
 *
 * Flow:
 *  1. POST /v2/task.create  → get task_id
 *  2. Poll GET /v2/task.listMessages until agent_status === "stopped" | "error"
 *     - Paginate with cursor to collect ALL messages (not just last 20)
 *  3. Extract ALL assistant_message content joined as the report
 */

import axios from "axios";

const MANUS_API_BASE = "https://api.manus.ai";

// Skill ID mappings — these are the Manus skill IDs for the five analysis skills.
// The admin must have these skills enabled on their Manus account.
export const SKILL_IDS: Record<string, string> = {
  "weekly-optimization": "pl-weekly-optimization",
  "performance-insights": "pl-performance-analysis-insights-v3",
  "creative-lifecycle": "pl-creative-lifecycle-v3",
  "structural-audit": "meta-ads-audit",
  "audience-overlap": "pl-audience-overlap-spend",
};

interface ManusTaskOptions {
  apiKey: string;
  skillId: string;
  prompt: string;
  agentProfile?: "manus-1.6" | "manus-1.6-lite" | "manus-1.6-max";
  projectId?: string;
  onProgress?: (message: string, taskId?: string) => void | Promise<void>;
}

interface ManusMessage {
  id?: string;
  type: string;
  status_update?: {
    agent_status: "running" | "stopped" | "waiting" | "error";
    status_detail?: {
      waiting_for_event_id?: string;
      waiting_for_event_type?: string;
      waiting_description?: string;
    };
  };
  assistant_message?: {
    content: string;
    attachments?: Array<{
      type: string;
      filename?: string;
      url?: string;
      content_type?: string;
    }>;
  };
  error_message?: {
    content: string;
  };
}

interface ManusTaskResult {
  taskId: string;
  taskUrl: string;
  report: string;
  attachments: Array<{ filename: string; url: string; contentType: string }>;
  status: "success" | "error";
  errorMessage?: string;
  creditUsage?: number;
}

/**
 * Build a precise, skill-specific prompt that mirrors how the skill is invoked
 * natively on the Manus platform. Each skill has its own invocation pattern
 * derived from its SKILL.md Quick Start section.
 */
export function buildSkillPrompt(
  skillId: string,
  params: {
    adAccountId: string;
    businessManagerId?: string;
    campaignIds?: string[];
    dateRange: string;
    additionalInstructions?: string;
    knowledgeContext?: string;
    accessToken?: string;
    /** Raw JSON string from a prior Audience Overlap run (sidecarJson) to inject as enrichment */
    enrichOverlapJson?: string;
    /** Raw JSON string from a prior Creative Lifecycle run (sidecarJson) to inject as enrichment */
    enrichLifecycleJson?: string;
  }
): string {
  const { adAccountId, campaignIds, dateRange, additionalInstructions, knowledgeContext, accessToken, enrichOverlapJson, enrichLifecycleJson } = params;

  // Normalize account ID — ensure it has the act_ prefix
  const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  // Map human-readable date ranges to Meta date presets
  const datePreset = mapDateRangeToPreset(dateRange);

  // Campaign filter string
  const campaignFilter = campaignIds && campaignIds.length > 0
    ? campaignIds.join(",")
    : "";

  const knowledgeSection = knowledgeContext
    ? `\n\n--- ACCOUNT CONTEXT (from knowledge base) ---\n${knowledgeContext}\n---`
    : "";

  const additionalSection = additionalInstructions
    ? `\n\nAdditional instructions from the user: ${additionalInstructions}`
    : "";

  // Build the env-var export line that injects the token at runtime.
  // The skill config.py files read META_ACCESS_TOKEN from the environment.
  const tokenExport = accessToken
    ? `export META_ACCESS_TOKEN="${accessToken}"
`
    : "# WARNING: No META_ACCESS_TOKEN provided — skill will fail if no token is configured\n";

  switch (skillId) {
    case "weekly-optimization":
      return buildWeeklyOptPrompt(accountId, datePreset, campaignFilter, knowledgeSection, additionalSection, tokenExport);

    case "performance-insights":
      return buildPerformanceInsightsPrompt(accountId, datePreset, campaignFilter, knowledgeSection, additionalSection, tokenExport, enrichOverlapJson, enrichLifecycleJson);

    case "creative-lifecycle":
      return buildCreativeLifecyclePrompt(accountId, datePreset, campaignFilter, knowledgeSection, additionalSection, tokenExport);

    case "structural-audit":
      return buildStructuralAuditPrompt(accountId, campaignFilter, knowledgeSection, additionalSection, tokenExport);

    case "audience-overlap":
      return buildAudienceOverlapPrompt(accountId, datePreset, campaignFilter, knowledgeSection, additionalSection, tokenExport);

    default:
      return `Run the ${SKILL_IDS[skillId] ?? skillId} skill for Meta Ads account ${accountId}.\nDate range: ${dateRange}${campaignFilter ? `\nCampaigns: ${campaignFilter}` : ""}${knowledgeSection}${additionalSection}\n\nProvide a comprehensive, detailed report with all findings and actionable recommendations.`;
  }
}

function mapDateRangeToPreset(dateRange: string): string {
  const lower = dateRange.toLowerCase().replace(/\s/g, "_");
  // Direct preset passthrough
  if (["last_7d","last_14d","last_30d","this_month","last_month","last_quarter","this_year","last_year","lifetime","today","yesterday"].includes(lower)) {
    return lower;
  }
  // Human-readable mappings
  if (lower.includes("7") || lower.includes("week")) return "last_7d";
  if (lower.includes("14")) return "last_14d";
  if (lower.includes("30") || lower.includes("month")) return "last_30d";
  if (lower.includes("quarter")) return "last_quarter";
  if (lower.includes("year")) return "last_year";
  return "last_7d"; // safe default
}

function buildWeeklyOptPrompt(
  accountId: string,
  datePreset: string,
  campaignFilter: string,
  knowledgeSection: string,
  additionalSection: string,
  tokenExport: string
): string {
  const campaignArg = campaignFilter ? `--campaign-ids ${campaignFilter} ` : "";
  return `Please run the **pl-weekly-optimization** skill for the following Meta Ads account.

**Account ID:** ${accountId}
**Date Preset:** ${datePreset}
${campaignFilter ? `**Campaign IDs:** ${campaignFilter}` : "**Scope:** All active campaigns"}
${knowledgeSection}${additionalSection}

## Instructions

Read the skill at \`/home/ubuntu/skills/pl-weekly-optimization/SKILL.md\` first, then execute:

\`\`\`bash
${tokenExport}cd /home/ubuntu/skills/pl-weekly-optimization/scripts
python3 run_weekly_analysis.py \\
  --account-id ${accountId} \\
  --date-preset ${datePreset} \\
  ${campaignArg}--compare-prior \\
  --output-dir /home/ubuntu/output/weekly-opt
\`\`\`
After the script completes:
1. Confirm that the analysis finished successfully
2. List the output files produced in \`/home/ubuntu/output/weekly-opt/\` (filenames and sizes)
3. If the script errored or produced no output files, describe the error in full so it can be debugged

Do **not** re-output the file contents as a message — the report will be retrieved directly from the output files.`;
}

function buildPerformanceInsightsPrompt(
  accountId: string,
  datePreset: string,
  campaignFilter: string,
  knowledgeSection: string,
  additionalSection: string,
  tokenExport: string,
  enrichOverlapJson?: string,
  enrichLifecycleJson?: string
): string {
  const campaignArg = campaignFilter ? `--campaign-ids ${campaignFilter} ` : "";

  // Build enrichment injection block — write sidecar JSON to temp files the skill can read
  let enrichmentBlock = "";
  if (enrichOverlapJson || enrichLifecycleJson) {
    let bashBlock = "";
    if (enrichOverlapJson) {
      bashBlock += "# Audience Overlap sidecar JSON\n";
      bashBlock += "cat > /tmp/enrichment_audience_overlap.json << 'ENDJSON'\n";
      bashBlock += enrichOverlapJson + "\n";
      bashBlock += "ENDJSON\n";
      bashBlock += "export ENRICHMENT_AUDIENCE_OVERLAP_JSON=/tmp/enrichment_audience_overlap.json\n";
    }
    if (enrichLifecycleJson) {
      bashBlock += "# Creative Lifecycle sidecar JSON\n";
      bashBlock += "cat > /tmp/enrichment_creative_lifecycle.json << 'ENDJSON'\n";
      bashBlock += enrichLifecycleJson + "\n";
      bashBlock += "ENDJSON\n";
      bashBlock += "export ENRICHMENT_CREATIVE_LIFECYCLE_JSON=/tmp/enrichment_creative_lifecycle.json\n";
    }
    const overlapNote = enrichOverlapJson
      ? "- If ENRICHMENT_AUDIENCE_OVERLAP_JSON is set: reference the audience overlap signals (wasted spend, overlapping ad sets) in the Audience module and recommendations\n"
      : "";
    const lifecycleNote = enrichLifecycleJson
      ? "- If ENRICHMENT_CREATIVE_LIFECYCLE_JSON is set: reference the creative fatigue signals (CDR, BOCPD, CUSUM, EWMA) in the Creative module and recommendations\n"
      : "";
    enrichmentBlock =
      "\n## Enrichment Data\n\n" +
      "The following prior-run JSON data has been provided to enrich this analysis.\n" +
      "Write each JSON block to the corresponding temp file before running the skill scripts:\n\n" +
      "```bash\n" + bashBlock + "```\n\n" +
      "When the skill scripts have completed, **incorporate the enrichment data** into the final analysis:\n" +
      overlapNote +
      lifecycleNote +
      "- Cross-reference enrichment findings with the live performance data to produce a more complete picture\n";
  }

  return `Please run the **pl-performance-analysis-insights-v3** skill for the following Meta Ads account.

**Account ID:** ${accountId}
**Date Preset:** ${datePreset}
${campaignFilter ? `**Campaign IDs:** ${campaignFilter}` : "**Scope:** All active campaigns"}
${knowledgeSection}${additionalSection}${enrichmentBlock}
## Instructions

Read the skill at \`/home/ubuntu/skills/pl-performance-analysis-insights-v3/SKILL.md\` first, then execute the full analysis:

\`\`\`bash
${tokenExport}cd /home/ubuntu/skills/pl-performance-analysis-insights-v3/scripts

# If specific campaigns provided, use filtered run:
${campaignFilter
  ? `python3 run_filtered_analysis.py \\
  --account-id ${accountId} \\
  --date-preset ${datePreset} \\
  ${campaignArg}--output-dir /home/ubuntu/output/perf-insights`
  : `python3 run_full_analysis.py \\
  --account-id ${accountId} \\
  --date-preset ${datePreset} \\
  --output-dir /home/ubuntu/output/perf-insights`}
\`\`\`

## Module Retry Policy

If **any individual analysis module** (Audience, Creative, Timing, Saturation, Lifecycle, Placement, or any other) fails, returns an error, or produces empty output:
- **Automatically retry that specific module up to 3 times** before marking it as failed
- Do NOT skip a module after the first failure — retry until it succeeds or 3 attempts are exhausted
- Log each retry attempt (e.g., "Retrying Audience module — attempt 2/3")
- Only mark a module as failed after all 3 retry attempts have been exhausted
- Continue running all other modules regardless of any single module's failure status

## Ad Name Cleaning

After aggregating ad performance data across ad sets:
- **Strip any ad-set-specific or campaign-specific naming prefixes from ad names**
- Ad names in Meta accounts often include targeting identifiers baked in (e.g., geo, audience type, campaign objective, funnel stage) separated by " - " delimiters
- The **creative name** is the meaningful part that describes the actual creative content — typically the last 2–3 segments after stripping targeting prefixes
- **Rule:** If an ad name contains " - " separators, identify and remove any leading segments that describe targeting/geo/audience/objective (e.g., "SAG", "Tucson", "Conversion", "Purchase LAL") and keep only the segments that describe the creative itself (e.g., "April New Breakfast - Burrito - Static")
- Apply this cleaning consistently across all ad name references in the report
- Example: "SAG - Tucson - Conversion - Purchase LAL - April New Breakfast - Burrito - Static" → "April New Breakfast - Burrito - Static"

After the script completes:
1. Confirm that the analysis finished successfully
2. List the output files produced in \`/home/ubuntu/output/perf-insights/\` (filenames and sizes)
3. If the script errored or produced no output files, describe the error in full so it can be debugged

Do **not** re-output the file contents as a message — the report will be retrieved directly from the output files.`;
}

function buildCreativeLifecyclePrompt(
  accountId: string,
  datePreset: string,
  campaignFilter: string,
  knowledgeSection: string,
  additionalSection: string,
  tokenExport: string
): string {
  const campaignArg = campaignFilter ? `--campaigns "${campaignFilter}" ` : "";
  return `Please run the **pl-creative-lifecycle-v3** skill for the following Meta Ads account.

**Account ID:** ${accountId}
**Date Preset:** ${datePreset}
${campaignFilter ? `**Campaign IDs:** ${campaignFilter}` : "**Scope:** All active campaigns"}
${knowledgeSection}${additionalSection}

## Instructions

Read the skill at \`/home/ubuntu/skills/pl-creative-lifecycle-v3/SKILL.md\` first, then execute:

\`\`\`bash
${tokenExport}cd /home/ubuntu/skills/pl-creative-lifecycle-v3/scripts

# Install dependencies if needed
pip install scipy tabulate rapidfuzz 2>/dev/null || true

python3 analyze_creative_lifecycle.py \\
  --account-id ${accountId} \\
  --date-preset ${datePreset} \\
  ${campaignArg}--output-dir /home/ubuntu/output/creative-lifecycle
\`\`\`

After the script completes:
1. Confirm that the analysis finished successfully
2. List the output files produced in \`/home/ubuntu/output/creative-lifecycle/\` (filenames and sizes)
3. If the script errored or produced no output files, describe the error in full so it can be debugged

Do **not** re-output the file contents as a message — the report will be retrieved directly from the output files.`;
}

function buildStructuralAuditPrompt(
  accountId: string,
  campaignFilter: string,
  knowledgeSection: string,
  additionalSection: string,
  tokenExport: string
): string {
  const campaignArg = campaignFilter ? campaignFilter.split(",").join(" ") : "";
  // For structural audit, the fetcher uses --token CLI arg (not env var)
  // We pass the token both as env var (for consistency) and as --token flag
  const tokenArg = tokenExport.startsWith("export META_ACCESS_TOKEN=")
    ? `--token "$META_ACCESS_TOKEN" \\
  `
    : "";
  return `Please run the **meta-ads-audit** (Andromeda Structural Audit) skill for the following Meta Ads account.

**Account ID:** ${accountId}
${campaignFilter ? `**Campaign IDs:** ${campaignFilter}` : "**Scope:** All active campaigns (select the most significant ones)"}
${knowledgeSection}${additionalSection}

## Instructions

Read the skill at \`/home/ubuntu/skills/meta-ads-audit/SKILL.md\` first, then execute both steps:

\`\`\`bash
${tokenExport}cd /home/ubuntu/skills/meta-ads-audit

# Step 1 — Fetch data
python3 meta_ads_fetcher_v3.py \\
  --account ${accountId} \\
  ${tokenArg}${campaignArg ? `--campaigns ${campaignArg} \\` : ""}
  --output audit_data.json

# Step 2 — Run mechanical checks
python3 meta_ads_checker_v3.py \\
  --input audit_data.json \\
  --output mechanical_check_results.json
\`\`\`

After both scripts complete:
1. Confirm that both scripts finished successfully
2. List the output files produced (\`audit_data.json\`, \`mechanical_check_results.json\`, and any other files written)
3. If either script errored or produced no output, describe the error in full so it can be debugged

Do **not** re-output the file contents as a message — the report will be retrieved directly from the output files.`;
}

function buildAudienceOverlapPrompt(
  accountId: string,
  datePreset: string,
  campaignFilter: string,
  knowledgeSection: string,
  additionalSection: string,
  tokenExport: string
): string {
  const campaignArg = campaignFilter ? `--campaigns "${campaignFilter}"` : "";
  return `Please run the **pl-audience-overlap-spend** skill for the following Meta Ads account.

**Account ID:** ${accountId}
**Date Preset:** ${datePreset}
${campaignFilter ? `**Campaign IDs:** ${campaignFilter}` : "**Scope:** All active campaigns"}
${knowledgeSection}${additionalSection}

## Instructions

Read the skill at \`/home/ubuntu/skills/pl-audience-overlap-spend/SKILL.md\` first, then execute all three steps:

\`\`\`bash
${tokenExport}cd /home/ubuntu/skills/pl-audience-overlap-spend/scripts

# Step 1 — Pull data
python3 pull_data.py \\
  --account ${accountId} \\
  --date-preset ${datePreset} \\
  ${campaignArg} \\
  --output ./raw

# Step 2 — Run overlap analysis
python3 run_overlap.py \\
  --account ${accountId} \\
  ${campaignArg} \\
  --adset-data ./raw/adset.json \\
  --output ./output

# Step 3 — Estimate wasted spend
python3 estimate_waste.py \\
  --account ${accountId} \\
  --overlap-results ./output/overlap_results.json \\
  --adset-data ./raw/adset.json \\
  --output ./output
\`\`\`

After all scripts complete:
1. Confirm that all three scripts finished successfully
2. List the output files produced in \`./output/\` (filenames and sizes)
3. If any script errored or produced no output files, describe the error in full so it can be debugged

Do **not** re-output the file contents as a message — the report will be retrieved directly from the output files.`;
}

/**
 * Fetch ALL messages for a task by paginating through the listMessages API.
 * Uses cursor-based pagination to get every message, not just the last 20.
 */
async function fetchAllMessages(
  taskId: string,
  headers: Record<string, string>
): Promise<ManusMessage[]> {
  const allMessages: ManusMessage[] = [];
  let cursor: string | undefined;
  const PAGE_SIZE = 100;

  // Fetch in ascending order so we get messages in chronological order
  // and can paginate forward with a cursor
  do {
    const params: Record<string, string | number> = {
      task_id: taskId,
      order: "asc",
      limit: PAGE_SIZE,
    };
    if (cursor) params.cursor = cursor;

    const resp = await axios.get(`${MANUS_API_BASE}/v2/task.listMessages`, {
      params,
      headers,
      timeout: 15000,
    });

    if (!resp.data?.ok) break;

    const messages: ManusMessage[] = resp.data.messages ?? [];
    allMessages.push(...messages);

    // If we got fewer messages than the page size, we've reached the end
    cursor = messages.length === PAGE_SIZE ? resp.data.next_cursor : undefined;
  } while (cursor);

  return allMessages;
}

/**
 * Create a Manus task and poll until completion.
 * Returns the final report content and any file attachments.
 */
export async function runManusSkillTask(
  options: ManusTaskOptions
): Promise<ManusTaskResult> {
  const { apiKey, skillId, prompt, agentProfile = "manus-1.6-lite", projectId, onProgress } = options;

  const headers = {
    "Content-Type": "application/json",
    "x-manus-api-key": apiKey,
  };

  // 1. Create the task
  onProgress?.("Creating Manus task...");
  const createResp = await axios.post(
    `${MANUS_API_BASE}/v2/task.create`,
    {
      message: {
        content: prompt,
        force_skills: [SKILL_IDS[skillId] ?? skillId],
      },
      agent_profile: agentProfile,
      title: `Pathlabs: ${skillId} run`,
      ...(projectId ? { project_id: projectId } : {}),
    },
    { headers, timeout: 30000 }
  );

  if (!createResp.data?.ok) {
    throw new Error(
      createResp.data?.error?.message ?? "Failed to create Manus task"
    );
  }

  const taskId: string = createResp.data.task?.id ?? createResp.data.task_id;
  const taskUrl: string =
    createResp.data.task?.url ?? `https://manus.im/app/tasks/${taskId}`;

  // Pass the taskId to the caller immediately so it can be stored for abort/redelivery
  await onProgress?.(`Task created (${taskId}). Waiting for analysis to complete...`, taskId);

  // 2. Poll for completion — check status with a small fetch, then do full fetch at end
  let attempts = 0;
  const MAX_ATTEMPTS = 180; // 15 minutes at 5s intervals
  const POLL_INTERVAL_MS = 5000;
  let lastAgentMessage = "";

  while (attempts < MAX_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    attempts++;

    const elapsedMin = Math.floor((attempts * 5) / 60);
    const elapsedSec = (attempts * 5) % 60;
    const elapsedStr = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`;

    // Fetch recent messages to check status AND surface any new agent activity
    const statusResp = await axios.get(
      `${MANUS_API_BASE}/v2/task.listMessages`,
      {
        params: { task_id: taskId, order: "desc", limit: 10 },
        headers,
        timeout: 15000,
      }
    );

    if (!statusResp.data?.ok) continue;

    const recentMessages: ManusMessage[] = statusResp.data.messages ?? [];
    const statusUpdate = recentMessages.find((m) => m.type === "status_update");
    const agentStatus = statusUpdate?.status_update?.agent_status;

    // Surface the most recent assistant message snippet as a live status update
    const latestAssistant = recentMessages.find(
      (m) => m.type === "assistant_message" && m.assistant_message?.content?.trim()
    );
    if (latestAssistant?.assistant_message?.content) {
      const snippet = latestAssistant.assistant_message.content.trim().slice(0, 120).replace(/\n/g, " ");
      if (snippet && snippet !== lastAgentMessage) {
        lastAgentMessage = snippet;
        await onProgress?.(`Agent: ${snippet}${snippet.length === 120 ? "..." : ""} (${elapsedStr} elapsed)`);
        continue;
      }
    }

    if (agentStatus === "running") {
      await onProgress?.(`Analysis in progress... (${elapsedStr} elapsed)`);
      continue;
    }

    if (agentStatus === "waiting") {
      const detail = statusUpdate?.status_update?.status_detail;
      await onProgress?.(
        `Agent is waiting: ${detail?.waiting_description ?? "needs input"} (${elapsedStr} elapsed)`
      );
      continue;
    }

    if (agentStatus === "error") {
      // Fetch all messages to get the full error context
      const allMsgs = await fetchAllMessages(taskId, headers);
      const errorMsg =
        allMsgs.find((m) => m.type === "error_message")?.error_message?.content
        ?? "Unknown error";
      return {
        taskId,
        taskUrl,
        report: "",
        attachments: [],
        status: "error",
        errorMessage: errorMsg,
      };
    }

    if (agentStatus === "stopped") {
      onProgress?.("Analysis complete. Fetching full report...");

      // Fetch ALL messages with pagination to get the complete output
      const allMessages = await fetchAllMessages(taskId, headers);

      // Collect all assistant messages in chronological order (already asc from fetchAllMessages)
      const assistantMessages = allMessages.filter(
        (m) => m.type === "assistant_message" && m.assistant_message?.content?.trim()
      );

      // Collect ALL attachments across all messages
      let rawAttachments = allMessages
        .flatMap((m) => m.assistant_message?.attachments ?? [])
        .filter((a) => a.url && a.filename);

      // If no attachments found, wait 5s and retry once — the Manus API sometimes
      // commits attachments slightly after the task status changes to "stopped".
      if (rawAttachments.length === 0) {
        onProgress?.("No attachments found yet, retrying in 5s...");
        await new Promise((r) => setTimeout(r, 5000));
        const retryMessages = await fetchAllMessages(taskId, headers);
        rawAttachments = retryMessages
          .flatMap((m) => m.assistant_message?.attachments ?? [])
          .filter((a) => a.url && a.filename);
        // Also update assistantMessages from the retry fetch
        if (retryMessages.length > allMessages.length) {
          assistantMessages.length = 0;
          retryMessages
            .filter((m) => m.type === "assistant_message" && m.assistant_message?.content?.trim())
            .forEach((m) => assistantMessages.push(m));
        }
        if (rawAttachments.length > 0) {
          onProgress?.(`Found ${rawAttachments.length} attachment(s) on retry.`);
        }
      }

      const attachments = rawAttachments.map((a) => ({
        filename: a.filename!,
        url: a.url!,
        contentType: a.content_type ?? "application/octet-stream",
      }));

      // ── Primary strategy: download markdown attachment files ──────────────
      // The Manus agent writes the full analysis into .md files and attaches
      // them. The chat message is just a short summary. We prefer the file
      // content as the report because it contains the complete analysis.
      const mdAttachments = rawAttachments.filter(
        (a) => a.filename?.endsWith(".md") && a.url
      );

      // Prioritise comprehensive/master/summary files first, then the rest
      const priorityOrder = ["comprehensive", "master", "summary", "weekly", "report"];
      const sortedMdAttachments = [...mdAttachments].sort((a, b) => {
        const aIdx = priorityOrder.findIndex((p) => a.filename!.toLowerCase().includes(p));
        const bIdx = priorityOrder.findIndex((p) => b.filename!.toLowerCase().includes(p));
        const aScore = aIdx === -1 ? 99 : aIdx;
        const bScore = bIdx === -1 ? 99 : bIdx;
        return aScore - bScore;
      });

      if (sortedMdAttachments.length > 0) {
        onProgress?.(`Downloading ${sortedMdAttachments.length} report file(s)...`);
        const reportSections: string[] = [];

        for (const att of sortedMdAttachments) {
          try {
            const fileResp = await axios.get(att.url!, {
              timeout: 30000,
              responseType: "text",
              // Manus storage URLs may need the API key
              headers: att.url!.includes("api.manus.ai") ? headers : {},
            });
            const content = typeof fileResp.data === "string"
              ? fileResp.data
              : JSON.stringify(fileResp.data);
            if (content.trim()) {
              reportSections.push(`## ${att.filename}\n\n${content}`);
            }
          } catch (fetchErr) {
            console.warn(`[manusTask] Failed to fetch attachment ${att.filename}:`, fetchErr);
          }
        }

        if (reportSections.length > 0) {
          const report = reportSections.join("\n\n---\n\n");
          onProgress?.(`Full report extracted from ${reportSections.length} file(s) (${report.length} characters)`);
          // Fetch credit_usage from task.detail
          let creditUsage: number | undefined;
          try {
            const detailResp = await axios.get(`${MANUS_API_BASE}/v2/task.detail`, {
              params: { task_id: taskId },
              headers,
              timeout: 10000,
            });
            creditUsage = detailResp.data?.task?.credit_usage ?? detailResp.data?.credit_usage;
          } catch { /* non-fatal */ }
          return { taskId, taskUrl, report, attachments, status: "success", creditUsage };
        }
      }

      // ── Fallback: use assistant message content ───────────────────────────
      if (assistantMessages.length === 0) {
        // Last resort: try the recent messages we already have
        const fallbackMsgs = recentMessages.filter(
          (m) => m.type === "assistant_message" && m.assistant_message?.content?.trim()
        );
        if (fallbackMsgs.length > 0) {
          const report = fallbackMsgs.map((m) => m.assistant_message!.content).join("\n\n---\n\n");
          return { taskId, taskUrl, report, attachments, status: "success" };
        }
        return {
          taskId,
          taskUrl,
          report: "The analysis completed but the report files could not be retrieved. Please view the full output directly at: " + taskUrl,
          attachments,
          status: attachments.length > 0 ? "success" : "error",
          errorMessage: attachments.length > 0 ? undefined : "No report content found in completed task.",
        };
      }

      // Join all assistant message content as the report
      const reportParts = assistantMessages.map((m) => m.assistant_message!.content);
      const report = reportParts.join("\n\n");

      onProgress?.(`Report extracted from ${reportParts.length} message(s) (${report.length} characters)`);

      // Fetch credit_usage from task.detail
      let creditUsage: number | undefined;
      try {
        const detailResp = await axios.get(`${MANUS_API_BASE}/v2/task.detail`, {
          params: { task_id: taskId },
          headers,
          timeout: 10000,
        });
        creditUsage = detailResp.data?.task?.credit_usage ?? detailResp.data?.credit_usage;
      } catch { /* non-fatal */ }

      return { taskId, taskUrl, report, attachments, status: "success", creditUsage };
    }
  }

  throw new Error("Task timed out after 15 minutes. Check the task directly at: https://manus.im/app/tasks/" + taskId);
}

/**
 * Fetch available skills from the Manus API.
 * Used by admin to verify skill IDs are correct.
 */
export async function listManusSkills(apiKey: string) {
  const resp = await axios.get(`${MANUS_API_BASE}/v2/skill.list`, {
    headers: { "x-manus-api-key": apiKey },
    timeout: 15000,
  });
  return resp.data?.skills ?? [];
}
