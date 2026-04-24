import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORIES = [
  "general",
  "weekly-optimization",
  "performance-insights",
  "creative-lifecycle",
  "structural-audit",
  "audience-overlap",
];

type KnowledgeEntry = {
  id: number;
  title: string;
  category: string;
  content: string;
  createdAt: Date;
};

export default function AdminKnowledge() {
  const { data: entries = [], refetch } = trpc.knowledge.list.useQuery();
  const addEntry = trpc.knowledge.add.useMutation({
    onSuccess: () => { refetch(); setShowAdd(false); resetForm(); toast.success("Knowledge entry added"); },
  });
  const deleteEntry = trpc.knowledge.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Entry deleted"); },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [content, setContent] = useState("");

  function resetForm() { setTitle(""); setCategory("general"); setContent(""); }

  return (
    <AppShell title="Knowledge Base" subtitle="Persistent context transferred to all skill runs" badge="admin-only">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black" style={{ color: "#FAFAFA" }}>Knowledge Transfer</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Entries here are injected as context into every skill run. Use this to transfer account-specific knowledge from your personal Manus account to the team.
            </p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: "#ED135F", color: "#fff" }}
          >
            <Plus size={14} /> Add Entry
          </button>
        </div>

        {showAdd && (
          <div className="rounded-xl p-5 mb-5" style={{ background: "rgba(237,19,95,0.06)", border: "1px solid rgba(237,19,95,0.2)" }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "#ED135F" }}>New Knowledge Entry</h3>
            <div className="flex flex-col gap-3">
              <Field label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Account naming conventions" className="input-field" />
              </Field>
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "#141349" }}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Content">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the knowledge content to inject into skill runs…"
                  rows={5}
                  className="input-field resize-none"
                />
              </Field>
              <div className="flex gap-2">
                <button
                  onClick={() => addEntry.mutate({ title, category, content })}
                  disabled={!title || !content || addEntry.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: "#ED135F", color: "#fff", opacity: (!title || !content) ? 0.5 : 1 }}
                >
                  {addEntry.isPending ? "Saving…" : "Save Entry"}
                </button>
                <button
                  onClick={() => { setShowAdd(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {(entries as KnowledgeEntry[]).length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <BookOpen size={24} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>No knowledge entries yet</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Add entries to inject persistent context into all skill runs.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(entries as KnowledgeEntry[]).map((e) => (
              <div key={e.id} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-sm font-bold" style={{ color: "#FAFAFA" }}>{e.title}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>{e.category}</span>
                  </div>
                  <button
                    onClick={() => deleteEntry.mutate({ id: e.id })}
                    className="p-1.5 rounded-lg shrink-0"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)", whiteSpace: "pre-wrap" }}>
                  {e.content.length > 300 ? e.content.slice(0, 300) + "…" : e.content}
                </p>
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Added {new Date(e.createdAt).toLocaleDateString()}</p>
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
