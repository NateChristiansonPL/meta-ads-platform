/**
 * Manus Task API Service
 * Handles creating, polling, and extracting results from Manus skill tasks.
 * Base URL: https://api.manus.ai
 * Auth: x-manus-api-key header
 *
 * Flow:
 *  1. POST /v2/task.create  → get task_id
 *  2. Poll GET /v2/task.listMessages until agent_status === "stopped" | "error"
 *  3. Extract final assistant_message content as the report
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

// Meta Marketing MCP connector UUID (from Manus connector list)
export const META_MARKETING_CONNECTOR_ID = "meta-marketing";

interface ManusTaskOptions {
  apiKey: string;
  skillId: string;
  prompt: string;
  onProgress?: (message: string) => void;
}

interface ManusMessage {
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
}

/**
 * Build a structured prompt for a given skill and parameters.
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
  }
): string {
  const skillNames: Record<string, string> = {
    "weekly-optimization": "Weekly Optimization",
    "performance-insights": "Performance Insights",
    "creative-lifecycle": "Creative Lifecycle",
    "structural-audit": "Structural Audit",
    "audience-overlap": "Audience Overlap & Wasted Spend",
  };

  const skillName = skillNames[skillId] ?? skillId;
  const campaignFilter =
    params.campaignIds && params.campaignIds.length > 0
      ? `\nFocus on these specific campaign IDs: ${params.campaignIds.join(", ")}`
      : "\nAnalyze all active campaigns.";

  const knowledgeSection = params.knowledgeContext
    ? `\n\n--- ACCOUNT CONTEXT (from knowledge base) ---\n${params.knowledgeContext}\n---`
    : "";

  const additionalSection = params.additionalInstructions
    ? `\n\nAdditional instructions: ${params.additionalInstructions}`
    : "";

  return `Run the ${skillName} skill for the following Meta Ads account:

Ad Account ID: ${params.adAccountId}${params.businessManagerId ? `\nBusiness Manager ID: ${params.businessManagerId}` : ""}
Date Range: ${params.dateRange}${campaignFilter}${knowledgeSection}${additionalSection}

Please use the ${SKILL_IDS[skillId] ?? skillId} skill to perform this analysis. Provide a comprehensive report with actionable recommendations.`;
}

/**
 * Create a Manus task and poll until completion.
 * Returns the final report content and any file attachments.
 */
export async function runManusSkillTask(
  options: ManusTaskOptions
): Promise<ManusTaskResult> {
  const { apiKey, skillId, prompt, onProgress } = options;

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
      title: `Pathlabs: ${skillId} run`,
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

  onProgress?.(`Task created (${taskId}). Waiting for analysis to complete...`);

  // 2. Poll for completion
  let attempts = 0;
  const MAX_ATTEMPTS = 120; // 10 minutes at 5s intervals
  const POLL_INTERVAL_MS = 5000;

  while (attempts < MAX_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    attempts++;

    const listResp = await axios.get(
      `${MANUS_API_BASE}/v2/task.listMessages`,
      {
        params: { task_id: taskId, order: "desc", limit: 20 },
        headers,
        timeout: 15000,
      }
    );

    if (!listResp.data?.ok) continue;

    const messages: ManusMessage[] = listResp.data.messages ?? [];

    // Find the latest status update
    const statusUpdate = messages.find((m) => m.type === "status_update");
    const agentStatus = statusUpdate?.status_update?.agent_status;

    if (agentStatus === "running") {
      onProgress?.(`Analysis in progress... (${attempts * 5}s elapsed)`);
      continue;
    }

    if (agentStatus === "waiting") {
      const detail = statusUpdate?.status_update?.status_detail;
      onProgress?.(
        `Waiting: ${detail?.waiting_description ?? "Agent needs input"}`
      );
      // For skill runs we don't expect waiting states — continue polling
      continue;
    }

    if (agentStatus === "error") {
      const errorMsg =
        messages.find((m) => m.type === "error_message")?.error_message
          ?.content ?? "Unknown error";
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
      onProgress?.("Analysis complete. Extracting report...");

      // Collect all assistant messages in chronological order
      const assistantMessages = messages
        .filter((m) => m.type === "assistant_message" && m.assistant_message?.content)
        .reverse(); // listMessages returns desc, so reverse for chronological

      const reportParts = assistantMessages.map(
        (m) => m.assistant_message!.content
      );
      const report = reportParts.join("\n\n---\n\n");

      // Collect attachments
      const attachments = assistantMessages
        .flatMap((m) => m.assistant_message?.attachments ?? [])
        .filter((a) => a.url && a.filename)
        .map((a) => ({
          filename: a.filename!,
          url: a.url!,
          contentType: a.content_type ?? "application/octet-stream",
        }));

      return { taskId, taskUrl, report, attachments, status: "success" };
    }
  }

  throw new Error("Task timed out after 10 minutes.");
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
