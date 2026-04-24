import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Eye, EyeOff, Key, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminTokenVault() {
  const { data: tokens = [], refetch } = trpc.tokens.listAll.useQuery();
  const addToken = trpc.tokens.add.useMutation({
    onSuccess: () => { refetch(); setShowAdd(false); resetForm(); toast.success("Token added successfully"); },
  });
  const deactivateToken = trpc.tokens.deactivate.useMutation({
    onSuccess: () => { refetch(); toast.success("Token deactivated"); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessManagerId, setBmId] = useState("");
  const [showToken, setShowToken] = useState(false);

  function resetForm() { setLabel(""); setAccessToken(""); setBmId(""); setShowToken(false); }

  return (
    <AppShell title="Token Vault" subtitle="Manage Meta API access tokens" badge="admin-only">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-black" style={{ color: "#FAFAFA" }}>Business Manager Tokens</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Tokens stored here are available to all team members. Users never need to enter their own tokens.
            </p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: "#ED135F", color: "#fff" }}
          >
            <Plus size={14} /> Add Token
          </button>
        </div>

        {showAdd && (
          <div className="rounded-xl p-5 mb-5" style={{ background: "rgba(237,19,95,0.06)", border: "1px solid rgba(237,19,95,0.2)" }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "#ED135F" }}>New Token</h3>
            <div className="flex flex-col gap-3">
              <Field label="Label (e.g. Client Name — BM)">
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Acme Corp — Main BM" className="input-field" />
              </Field>
              <Field label="Business Manager ID">
                <input value={businessManagerId} onChange={(e) => setBmId(e.target.value)} placeholder="123456789" className="input-field" />
              </Field>
              <Field label="Access Token">
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="EAAxxxxx…"
                    className="input-field pr-10"
                  />
                  <button onClick={() => setShowToken((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => addToken.mutate({ label, accessToken, businessManagerId })}
                  disabled={!label || !accessToken || !businessManagerId || addToken.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: "#ED135F", color: "#fff", opacity: (!label || !accessToken || !businessManagerId) ? 0.5 : 1 }}
                >
                  {addToken.isPending ? "Saving…" : "Save Token"}
                </button>
                <button onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {tokens.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Key size={24} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>No tokens yet</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Add a Business Manager token to enable skill runs for your team.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(tokens as Array<{ id: number; label: string; businessManagerId: string; isActive: boolean; createdAt: Date }>).map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: t.isActive ? "rgba(0,179,122,0.15)" : "rgba(255,255,255,0.06)" }}>
                  <Key size={15} style={{ color: t.isActive ? "#00B37A" : "rgba(255,255,255,0.3)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: "#FAFAFA" }}>{t.label}</span>
                    {t.isActive
                      ? <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "#00B37A" }}><CheckCircle2 size={11} /> Active</span>
                      : <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}><XCircle size={11} /> Inactive</span>
                    }
                  </div>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>BM: {t.businessManagerId} · Added {new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                {t.isActive && (
                  <button
                    onClick={() => deactivateToken.mutate({ id: t.id })}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: "rgba(255,255,255,0.3)" }}
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
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
      {children}
    </div>
  );
}
