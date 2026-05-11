import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Eye, EyeOff, ExternalLink, FolderOpen, Key, Plus, RefreshCw, Settings, Sheet, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Skill → Project mapping config ────────────────────────────────────────────
const SKILL_PROJECT_CONFIG = [
  { skillId: "weekly-optimization",      skillName: "Weekly Optimization",      color: "#00BEEF", defaultProjectId: "juQv4FJjcFEmRRYNSe9VPF" },
  { skillId: "performance-insights",     skillName: "Performance Insights",     color: "#F7901E", defaultProjectId: "juQv4FJjcFEmRRYNSe9VPF" },
  { skillId: "creative-lifecycle",       skillName: "Creative Lifecycle",       color: "#00B37A", defaultProjectId: "juQv4FJjcFEmRRYNSe9VPF" },
  { skillId: "audience-overlap",         skillName: "Audience Overlap",         color: "#a78bfa", defaultProjectId: "juQv4FJjcFEmRRYNSe9VPF" },
  { skillId: "structural-audit",         skillName: "Structural Audit",         color: "#ED135F", defaultProjectId: "MKTYEMAkqiP2LpTLjUQbfX" },
  { skillId: "campaign-creation-admin",  skillName: "Campaign Builder (Admin)", color: "#F7C948", defaultProjectId: "Zb7DRexqB45QqDTQU2VV5Y" },
];

const PROJECT_LABELS: Record<string, string> = {
  "juQv4FJjcFEmRRYNSe9VPF": "Meta Ads Performance Optimization",
  "MKTYEMAkqiP2LpTLjUQbfX": "Meta Ads Andromeda Audit",
  "Zb7DRexqB45QqDTQU2VV5Y": "Meta Ads Campaign and Ad Builder",
};

// ── Types ──────────────────────────────────────────────────────────────────────
type TokenEntry = {
  id: number;
  label: string;
  businessManagerId: string;
  businessManagerName?: string | null;
  isActive: boolean;
  createdAt: Date;
};

// ── Section header component ───────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  subtitle,
  color = "#00BEEF",
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div>
          <h2 className="text-sm font-black" style={{ color: "#FAFAFA" }}>{title}</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="flex items-center gap-1 text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full"
      style={{
        background: ok ? "rgba(0,179,122,0.12)" : "rgba(255,255,255,0.06)",
        color: ok ? "#00B37A" : "rgba(255,255,255,0.3)",
      }}
    >
      {ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

// ── Project Assignments Section ───────────────────────────────────────────────
function ProjectAssignmentsSection() {
  const { data: savedIds = {}, refetch } = trpc.settings.skillProjectIds.useQuery();
  const setProjectId = trpc.settings.setSkillProjectId.useMutation({
    onSuccess: () => { refetch(); toast.success("Project assignment saved"); },
    onError: () => toast.error("Failed to save project assignment"),
  });

  // Local edit state: skillId → draft value
  const [editing, setEditing] = useState<Record<string, string>>({});

  const getEffectiveId = (skillId: string, defaultId: string) =>
    (savedIds as Record<string, string>)[skillId] ?? defaultId;

  const getProjectLabel = (projectId: string) =>
    PROJECT_LABELS[projectId] ?? (projectId ? "Custom Project" : "None");

  return (
    <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <SectionHeader
        icon={<FolderOpen size={16} />}
        title="Manus Project Assignments"
        subtitle="Each skill run is dispatched into a specific Manus team project, giving it access to that project's shared knowledge and context."
        color="#a78bfa"
      />

      <div className="flex flex-col gap-2">
        {SKILL_PROJECT_CONFIG.map((skill) => {
          const effectiveId = getEffectiveId(skill.skillId, skill.defaultProjectId);
          const isEditing = skill.skillId in editing;
          const draftValue = editing[skill.skillId] ?? effectiveId;

          return (
            <div
              key={skill.skillId}
              className="rounded-xl px-4 py-3.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3">
                {/* Skill color dot */}
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: skill.color }} />

                {/* Skill name */}
                <span className="text-sm font-semibold w-44 shrink-0" style={{ color: "#FAFAFA" }}>
                  {skill.skillName}
                </span>

                {/* Project display / edit */}
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      value={draftValue}
                      onChange={(e) => setEditing((s) => ({ ...s, [skill.skillId]: e.target.value }))}
                      placeholder="Project ID"
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.4)", color: "#FAFAFA", outline: "none" }}
                    />
                    <button
                      onClick={() => {
                        setProjectId.mutate({ skillId: skill.skillId, projectId: draftValue });
                        setEditing((s) => { const n = { ...s }; delete n[skill.skillId]; return n; });
                      }}
                      disabled={setProjectId.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                      style={{ background: "#a78bfa", color: "#fff" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing((s) => { const n = { ...s }; delete n[skill.skillId]; return n; })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold block" style={{ color: "rgba(167,139,250,0.9)" }}>
                        {getProjectLabel(effectiveId)}
                      </span>
                      <span className="text-xs font-mono block truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {effectiveId}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditing((s) => ({ ...s, [skill.skillId]: effectiveId }))}
                      className="p-1.5 rounded-lg transition-colors shrink-0"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#a78bfa"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; }}
                      title="Edit project assignment"
                    >
                      <Settings size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.3)" }}>
        Project IDs are sourced from your Manus team workspace. Each skill run is dispatched into the assigned project so the agent can recall shared knowledge, files, and context stored there. Changes take effect on the next run.
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminTokenVault() {
  // ── Meta BM tokens ──────────────────────────────────────────────────────────
  const { data: tokens = [], refetch: refetchTokens } = trpc.tokens.listAll.useQuery();
  const addToken = trpc.tokens.add.useMutation({
    onSuccess: () => { refetchTokens(); setShowAdd(false); resetForm(); toast.success("Token added successfully"); },
    onError: () => toast.error("Failed to add token"),
  });
  const deactivateToken = trpc.tokens.deactivate.useMutation({
    onSuccess: () => { refetchTokens(); toast.success("Token deactivated"); },
    onError: () => toast.error("Failed to deactivate token"),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessManagerId, setBmId] = useState("");
  const [businessManagerName, setBmName] = useState("");
  const [showToken, setShowToken] = useState(false);
  function resetForm() { setLabel(""); setAccessToken(""); setBmId(""); setBmName(""); setShowToken(false); }

  // ── Manus API key status ─────────────────────────────────────────────────────
  const { data: manusKeyStatus, refetch: refetchManusKey } = trpc.settings.manusApiKeyStatus.useQuery();

  // ── Google Sheets config ─────────────────────────────────────────────────────
  const { data: sheetsConfig, refetch: refetchSheets } = trpc.settings.googleSheetsConfig.useQuery();
  const setSheets = trpc.settings.setGoogleSheetsConfig.useMutation({
    onSuccess: () => { refetchSheets(); toast.success("Google Sheets config saved"); },
    onError: () => toast.error("Failed to save Google Sheets config"),
  });
  const [sheetId, setSheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [showSheetsForm, setShowSheetsForm] = useState(false);

  return (
    <AppShell title="Token and API Key Vault" subtitle="Manage all API credentials used by the platform" badge="admin-only">
      <div className="max-w-3xl flex flex-col gap-8">

        {/* ── Section 1: Manus API Key ──────────────────────────────────── */}
        <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <SectionHeader
            icon={<Key size={16} />}
            title="Manus API Key"
            subtitle="Used to dispatch all skill runs and fetch credit usage from the Manus Task API."
            color="#00BEEF"
            action={
              <button
                onClick={() => { refetchManusKey(); toast.success("Status refreshed"); }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                title="Refresh status"
              >
                <RefreshCw size={13} />
              </button>
            }
          />

          <div className="rounded-lg px-4 py-3.5 flex items-center gap-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: manusKeyStatus?.configured ? "rgba(0,179,122,0.15)" : "rgba(237,19,95,0.12)" }}>
              <Key size={14} style={{ color: manusKeyStatus?.configured ? "#00B37A" : "#ED135F" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>MANUS_API_KEY</span>
                <StatusBadge ok={!!manusKeyStatus?.configured} label={manusKeyStatus?.configured ? "Configured" : "Not set"} />
              </div>
              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                {manusKeyStatus?.configured
                  ? manusKeyStatus.masked ?? "••••••••••••••••"
                  : "Not configured — skill runs will fail"}
              </span>
            </div>
            <a
              href="https://manus.im/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#00BEEF" }}
            >
              Get key <ExternalLink size={11} />
            </a>
          </div>

          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            To update this key, go to <strong style={{ color: "rgba(255,255,255,0.5)" }}>Settings → Secrets</strong> in the Management UI and update <code style={{ color: "#00BEEF" }}>MANUS_API_KEY</code>. The key is stored as an encrypted environment secret and is never exposed in the UI.
          </p>
        </div>

        {/* ── Section 2: Meta Business Manager Tokens ───────────────────── */}
        <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <SectionHeader
            icon={<Key size={16} />}
            title="Meta Business Manager Tokens"
            subtitle="Access tokens for Meta Ads API. Stored here and shared across all team members — users never need to enter their own tokens."
            color="#ED135F"
            action={
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "#ED135F", color: "#fff" }}
              >
                <Plus size={13} /> Add Token
              </button>
            }
          />

          {showAdd && (
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(237,19,95,0.06)", border: "1px solid rgba(237,19,95,0.2)" }}>
              <h3 className="text-xs font-bold mb-3" style={{ color: "#ED135F" }}>New Meta Token</h3>
              <div className="flex flex-col gap-3">
                <Field label="Label (e.g. Client Name — BM)">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Acme Corp — Main BM"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Business Manager ID">
                    <input
                      value={businessManagerId}
                      onChange={(e) => setBmId(e.target.value)}
                      placeholder="123456789"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                    />
                  </Field>
                  <Field label="BM Name (optional)">
                    <input
                      value={businessManagerName}
                      onChange={(e) => setBmName(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                    />
                  </Field>
                </div>
                <Field label="Access Token">
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAxxxxx…"
                      className="w-full px-3 py-2 rounded-lg text-sm pr-10"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                    />
                    <button
                      onClick={() => setShowToken((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => addToken.mutate({ label, accessToken, businessManagerId, businessManagerName: businessManagerName || undefined })}
                    disabled={!label || !accessToken || !businessManagerId || addToken.isPending}
                    className="px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                    style={{ background: "#ED135F", color: "#fff" }}
                  >
                    {addToken.isPending ? "Saving…" : "Save Token"}
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); resetForm(); }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {(tokens as TokenEntry[]).length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Key size={22} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>No tokens yet</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Add a Business Manager token to enable skill runs for your team.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(tokens as TokenEntry[]).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: t.isActive ? "rgba(0,179,122,0.15)" : "rgba(255,255,255,0.06)" }}
                  >
                    <Key size={15} style={{ color: t.isActive ? "#00B37A" : "rgba(255,255,255,0.3)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: "#FAFAFA" }}>{t.label}</span>
                      <StatusBadge ok={t.isActive} label={t.isActive ? "Active" : "Inactive"} />
                    </div>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      BM: {t.businessManagerId}
                      {t.businessManagerName && ` (${t.businessManagerName})`}
                      {" · "}Added {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {t.isActive && (
                    <button
                      onClick={() => deactivateToken.mutate({ id: t.id })}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ED135F"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(237,19,95,0.1)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      title="Deactivate token"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Google Sheets / Campaign Builder ────────────────── */}
        <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <SectionHeader
            icon={<Sheet size={16} />}
            title="Google Sheets — Campaign Builder"
            subtitle="The Campaign Builder skill (pl-campaign-creation) reads from a Google Sheet. Configure the default Sheet ID here so the skill knows which spreadsheet to use."
            color="#00B37A"
            action={
              <button
                onClick={() => {
                  setShowSheetsForm((s) => !s);
                  if (!showSheetsForm) {
                    setSheetId(sheetsConfig?.sheetId ?? "");
                    setSheetName(sheetsConfig?.sheetName ?? "");
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "rgba(0,179,122,0.15)", color: "#00B37A", border: "1px solid rgba(0,179,122,0.25)" }}
              >
                <Settings size={13} /> {showSheetsForm ? "Cancel" : "Configure"}
              </button>
            }
          />

          {/* Current config display */}
          <div className="rounded-lg px-4 py-3.5 flex items-center gap-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: sheetsConfig?.sheetId ? "rgba(0,179,122,0.15)" : "rgba(255,255,255,0.06)" }}>
              <Sheet size={14} style={{ color: sheetsConfig?.sheetId ? "#00B37A" : "rgba(255,255,255,0.3)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>
                  {sheetsConfig?.sheetName || "Campaign Builder Sheet"}
                </span>
                <StatusBadge ok={!!sheetsConfig?.sheetId} label={sheetsConfig?.sheetId ? "Configured" : "Not set"} />
              </div>
              <span className="text-xs font-mono truncate block" style={{ color: "rgba(255,255,255,0.35)" }}>
                {sheetsConfig?.sheetId
                  ? `Sheet ID: ${sheetsConfig.sheetId}`
                  : "No Sheet ID configured — Campaign Builder will use the default from the skill"}
              </span>
            </div>
            {sheetsConfig?.sheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetsConfig.sheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "#00B37A" }}
              >
                Open <ExternalLink size={11} />
              </a>
            )}
          </div>

          {showSheetsForm && (
            <div className="rounded-xl p-4" style={{ background: "rgba(0,179,122,0.05)", border: "1px solid rgba(0,179,122,0.2)" }}>
              <div className="flex flex-col gap-3">
                <Field label="Google Sheet ID">
                  <input
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                    className="w-full px-3 py-2 rounded-lg text-sm font-mono"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                  />
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Found in the Google Sheets URL: docs.google.com/spreadsheets/d/<strong style={{ color: "rgba(0,179,122,0.7)" }}>SHEET_ID</strong>/edit
                  </p>
                </Field>
                <Field label="Sheet Name (optional label for display)">
                  <input
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Pathlabs Campaign Template"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                  />
                </Field>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => {
                      setSheets.mutate({ sheetId, sheetName: sheetName || undefined });
                      setShowSheetsForm(false);
                    }}
                    disabled={!sheetId || setSheets.isPending}
                    className="px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                    style={{ background: "#00B37A", color: "#fff" }}
                  >
                    {setSheets.isPending ? "Saving…" : "Save Config"}
                  </button>
                  <button
                    onClick={() => setShowSheetsForm(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            The Google service account key used to authenticate with Google Sheets is bundled inside the <code style={{ color: "#00B37A" }}>pl-campaign-creation</code> skill in your Manus workspace. Only the Sheet ID needs to be configured here.
          </p>
        </div>

        {/* ── Section 4: Manus Project Assignments ──────────────────────── */}
        <ProjectAssignmentsSection />

      </div>
    </AppShell>
  );
}
