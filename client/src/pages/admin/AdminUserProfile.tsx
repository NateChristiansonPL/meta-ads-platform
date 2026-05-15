/**
 * AdminUserProfile — Admin-only profile page.
 * Currently exposes Notification Preferences (Slack webhook URL).
 * Will be extended to non-admin users once tested.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, ExternalLink, Loader2, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#FAFAFA",
};

const labelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

// ── Slack webhook test is handled server-side via tRPC to avoid CORS ─────────

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminUserProfile() {
  const { user } = useAuth();

  // ── Slack webhook state ───────────────────────────────────────────────────
  const { data: webhookData, isLoading: webhookLoading } =
    trpc.creativeDecay.getSlackWebhook.useQuery();
  const saveWebhook = trpc.creativeDecay.saveSlackWebhook.useMutation();
  const testWebhook = trpc.creativeDecay.testSlackWebhook.useMutation();
  const utils = trpc.useUtils();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (webhookData?.webhookUrl) setWebhookUrl(webhookData.webhookUrl);
  }, [webhookData]);

  const handleSaveWebhook = async () => {
    try {
      await saveWebhook.mutateAsync({ webhookUrl: webhookUrl.trim() });
      utils.creativeDecay.getSlackWebhook.invalidate();
      toast.success("Slack webhook saved.");
    } catch {
      toast.error("Failed to save webhook URL.");
    }
  };

  const handleTestWebhook = async () => {
    const url = webhookUrl.trim();
    if (!url) { toast.error("Enter a webhook URL first."); return; }
    setTestState("testing");
    setTestError(null);
    try {
      const result = await testWebhook.mutateAsync({ webhookUrl: url });
      if (result.ok) {
        setTestState("ok");
        toast.success("Test message sent to Slack.");
      } else {
        setTestState("fail");
        setTestError(result.error ?? "Unknown error");
        toast.error(`Slack test failed: ${result.error}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setTestState("fail");
      setTestError(msg);
      toast.error(`Slack test failed: ${msg}`);
    }
    setTimeout(() => setTestState("idle"), 4000);
  };

  const isValidUrl = (s: string) => {
    try { new URL(s); return true; } catch { return false; }
  };
  const canSave = webhookUrl.trim() === "" || isValidUrl(webhookUrl.trim());

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ fontFamily: "'Montserrat', sans-serif", background: "#0E0D3A" }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(26,108,246,0.18)", border: "1px solid rgba(26,108,246,0.3)" }}>
          <User size={18} style={{ color: "#1A6CF6" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#FAFAFA" }}>My Profile</h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
            Admin-only — notification preferences and account settings.
          </p>
        </div>
      </div>

      {/* ── Account Info ── */}
      <div className="p-5 space-y-4" style={cardStyle}>
        <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p style={labelStyle}>Name</p>
            <p className="mt-1 text-sm" style={{ color: "#FAFAFA" }}>{user?.name ?? "—"}</p>
          </div>
          <div>
            <p style={labelStyle}>Email</p>
            <p className="mt-1 text-sm" style={{ color: "#FAFAFA" }}>{user?.email ?? "—"}</p>
          </div>
          <div>
            <p style={labelStyle}>Role</p>
            <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              style={{ background: "rgba(26,108,246,0.18)", color: "#1A6CF6", border: "1px solid rgba(26,108,246,0.3)" }}>
              {user?.role ?? "admin"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Notification Preferences ── */}
      <div className="p-5 space-y-5" style={cardStyle}>
        <div className="flex items-center gap-2">
          <Bell size={15} style={{ color: "#1A6CF6" }} />
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#FAFAFA" }}>Notification Preferences</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
              Configure where creative decay fatigue alerts are sent for your account.
            </p>
          </div>
        </div>

        {/* Slack webhook */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>Slack Webhook URL</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                Receive fatigue alerts in a Slack channel. One webhook covers all your ad accounts.{" "}
                <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-0.5 underline" style={{ color: "#1A6CF6" }}>
                  How to create one <ExternalLink size={10} />
                </a>
              </p>
            </div>
            {webhookData?.webhookUrl && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,179,122,0.14)", color: "#00B37A" }}>
                <CheckCircle2 size={10} /> Configured
              </span>
            )}
          </div>

          {webhookLoading ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setTestState("idle"); }}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              {/* Test button */}
              <button
                onClick={handleTestWebhook}
                disabled={!webhookUrl.trim() || testState === "testing"}
                className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                style={{
                  background: testState === "ok" ? "rgba(0,179,122,0.18)" : testState === "fail" ? "rgba(255,80,80,0.18)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${testState === "ok" ? "rgba(0,179,122,0.35)" : testState === "fail" ? "rgba(255,80,80,0.35)" : "rgba(255,255,255,0.12)"}`,
                  color: testState === "ok" ? "#00B37A" : testState === "fail" ? "#FF5050" : "rgba(255,255,255,0.7)",
                  whiteSpace: "nowrap",
                }}>
                {testState === "testing" && <Loader2 size={11} className="animate-spin" />}
                {testState === "ok" && <CheckCircle2 size={11} />}
                {testState === "fail" && <XCircle size={11} />}
                {testState === "idle" && "Test"}
                {testState === "testing" && "Sending…"}
                {testState === "ok" && "Sent!"}
                {testState === "fail" && "Failed"}
              </button>
              {/* Save button */}
              <button
                onClick={handleSaveWebhook}
                disabled={saveWebhook.isPending || !canSave}
                className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                style={{ background: "#1A6CF6", color: "#fff" }}>
                {saveWebhook.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
                {saveWebhook.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}

          {/* Validation error */}
          {webhookUrl.trim() && !isValidUrl(webhookUrl.trim()) && (
            <p className="text-xs" style={{ color: "#FF5050" }}>
              Enter a valid URL (must start with https://).
            </p>
          )}

          {/* Test error detail */}
          {testState === "fail" && testError && (
            <p className="text-xs" style={{ color: "#FF5050" }}>
              Error: {testError}
            </p>
          )}

          {/* Clear button */}
          {webhookData?.webhookUrl && (
            <button
              onClick={async () => {
                setWebhookUrl("");
                await saveWebhook.mutateAsync({ webhookUrl: "" });
                utils.creativeDecay.getSlackWebhook.invalidate();
                toast.success("Slack webhook removed.");
              }}
              className="text-xs underline"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              Remove webhook
            </button>
          )}
        </div>

        {/* What triggers notifications */}
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: "rgba(26,108,246,0.07)", border: "1px solid rgba(26,108,246,0.15)" }}>
          <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
            What triggers Slack notifications?
          </p>
          <ul className="space-y-1">
            {[
              "Creative fatigue detected at the threshold you configured per schedule (Probable / Possible / Emerging)",
              "If \"Always save report\" is enabled on a schedule, a report summary is sent even when no fatigue is detected",
              "Notifications are scoped to your account — other users' schedules won't trigger your webhook",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                <span className="mt-0.5 shrink-0 w-1 h-1 rounded-full" style={{ background: "#1A6CF6" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── In-app notifications note ── */}
      <div className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Bell size={14} style={{ color: "rgba(255,255,255,0.3)", marginTop: 2 }} />
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          In-app notifications are always enabled for admin accounts — you'll see a bell alert in the sidebar
          whenever a fatigue signal fires, regardless of whether a Slack webhook is configured.
        </p>
      </div>
    </div>
  );
}
