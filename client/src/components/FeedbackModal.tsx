import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MessageSquarePlus, ChevronRight, CheckCircle2 } from "lucide-react";

const SKILLS = [
  { id: "weekly-optimization", name: "Weekly Optimization" },
  { id: "performance-insights", name: "Performance Insights" },
  { id: "creative-lifecycle", name: "Creative Lifecycle" },
  { id: "structural-audit", name: "Structural Audit" },
  { id: "audience-overlap", name: "Audience Overlap" },
  { id: "campaign-builder", name: "Campaign Builder" },
];

type Category = "skill" | "skill-issue" | "suggestion" | "general";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const submit = trpc.feedback.submit.useMutation();

  const [step, setStep] = useState<"category" | "form" | "done">("category");
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [message, setMessage] = useState("");

  const reset = () => {
    setStep("category");
    setCategory(null);
    setSelectedSkillId("");
    setMessage("");
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleSelectCategory = (cat: Category) => {
    setCategory(cat);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!category || !message.trim()) return;
    // For skill and skill-issue categories, require a skill selection
    if ((category === "skill" || category === "skill-issue") && !selectedSkillId) return;
    const skill = SKILLS.find((s) => s.id === selectedSkillId);
    try {
      await submit.mutateAsync({
        category: category,
        skillId: (category === "skill" || category === "skill-issue") ? (skill?.id ?? undefined) : undefined,
        skillName: (category === "skill" || category === "skill-issue") ? (skill?.name ?? undefined) : undefined,
        message: message.trim(),
        rating: undefined,
      });
      setStep("done");
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    }
  };

  const categoryOptions: { id: Category; label: string; description: string; icon: string }[] = [
    { id: "skill", label: "Skill Feedback", description: "Comment on a specific analysis skill", icon: "📊" },
    { id: "skill-issue", label: "Issues When Running Skill", description: "Report a problem encountered while running a skill", icon: "⚠️" },
    { id: "suggestion", label: "Skill Suggestions", description: "Suggest new skills or improvements to existing ones", icon: "💡" },
    { id: "general", label: "General Feedback", description: "Share thoughts on the platform overall", icon: "💬" },
  ];

  const needsSkillSelector = category === "skill" || category === "skill-issue";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden"
        style={{ background: "#141349", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,190,239,0.15)" }}>
              <MessageSquarePlus size={16} style={{ color: "#00BEEF" }} />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold" style={{ color: "#FAFAFA" }}>
                Provide Feedback
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Help us improve the Pathlabs Intelligence Platform
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step: Category selection */}
        {step === "category" && (
          <div className="px-6 py-5 flex flex-col gap-2.5">
            {categoryOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSelectCategory(opt.id)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all group"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,190,239,0.4)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,190,239,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                <span className="text-xl w-8 text-center">{opt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "#FAFAFA" }}>{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{opt.description}</div>
                </div>
                <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
              </button>
            ))}
          </div>
        )}

        {/* Step: Form */}
        {step === "form" && category && (
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Back + category label */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("category")}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}
              >
                ← Back
              </button>
              <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: "rgba(0,190,239,0.1)", color: "#00BEEF" }}>
                {categoryOptions.find((c) => c.id === category)?.label}
              </span>
            </div>

            {/* Skill selector (for "skill" and "skill-issue" categories) */}
            {needsSkillSelector && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Which skill?</label>
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFAFA", outline: "none" }}
                >
                  <option value="" style={{ background: "#141349" }}>Select a skill…</option>
                  {SKILLS.map((s) => (
                    <option key={s.id} value={s.id} style={{ background: "#141349" }}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Message */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                {category === "suggestion"
                  ? "Your suggestion"
                  : category === "skill-issue"
                  ? "Describe the issue"
                  : "Your feedback"}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === "skill"
                    ? "What worked well? What could be improved?"
                    : category === "skill-issue"
                    ? "Describe what happened when you ran the skill…"
                    : category === "suggestion"
                    ? "Describe the skill or improvement you'd like to see…"
                    : "Share your thoughts on the platform…"
                }
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#FAFAFA",
                  outline: "none",
                  lineHeight: "1.5",
                }}
              />
              <div className="text-xs text-right" style={{ color: "rgba(255,255,255,0.2)" }}>{message.length}/4000</div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submit.isPending || !message.trim() || (needsSkillSelector && !selectedSkillId)}
              className="w-full font-semibold text-sm"
              style={{ background: "#00BEEF", color: "#141349" }}
            >
              {submit.isPending ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(0,179,122,0.15)" }}>
              <CheckCircle2 size={28} style={{ color: "#00B37A" }} />
            </div>
            <div>
              <div className="text-base font-bold" style={{ color: "#FAFAFA" }}>Thank you!</div>
              <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Your feedback has been submitted and will be reviewed by the admin team.
              </div>
            </div>
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="mt-2 text-sm"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#FAFAFA", background: "transparent" }}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
