import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  ExternalLink,
  Layers,
  MessageSquare,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What does a high CPM on Facebook Feed typically indicate?",
  "How do I interpret a Creative Lifecycle fatigue signal?",
  "What's the difference between CDR and BOCPD fatigue detection?",
  "When should I consolidate ad sets to improve liquidity?",
  "How does audience overlap cause wasted spend in Meta auctions?",
  "What are the Andromeda structural audit checks and what do they mean?",
];

const MANUS_LINKS = [
  {
    icon: Layers,
    label: "Connectors",
    description: "Connect Meta Ads, Google Sheets, and other data sources",
    href: "https://manus.im/app",
    color: "#00BEEF",
  },
  {
    icon: Sparkles,
    label: "Skills Library",
    description: "Browse and install additional Manus skills",
    href: "https://manus.im/app",
    color: "#F7901E",
  },
  {
    icon: Zap,
    label: "Scheduled Tasks",
    description: "Set up recurring skill runs and automated reports",
    href: "https://manus.im/app",
    color: "#00B37A",
  },
  {
    icon: MessageSquare,
    label: "Manus Chat",
    description: "Full Manus agent with all tools and capabilities",
    href: "https://manus.im/app",
    color: "#ED135F",
  },
];

export default function ManusAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your Meta Ads AI assistant, powered by Manus. I can help you interpret skill results, explain Meta Ads concepts, and guide you through optimization decisions.\n\nFor full Manus capabilities — connectors, scheduled tasks, and the complete skill library — use the quick links below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: recentRuns = [] } = trpc.runs.myRuns.useQuery({ limit: 5 });
  const chat = trpc.ai.chat.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const result = await chat.mutateAsync({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        context: `The user is working with Meta Ads skills: Weekly Optimization, Performance Insights, Creative Lifecycle, Structural Audit, and Audience Overlap & Wasted Spend. Recent runs: ${JSON.stringify(recentRuns.slice(0, 3))}`,
      });
      setMessages((prev) => [...prev, { role: "assistant" as const, content: String(result.content) }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }

  return (
    <AppShell title="Manus AI" subtitle="Context-aware Meta Ads assistant" badge="powered by manus">
      <div className="flex gap-6 h-full max-h-[calc(100vh-120px)]">
        {/* ── Chat Panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: msg.role === "assistant" ? "rgba(0,190,239,0.15)" : "rgba(237,19,95,0.15)",
                  }}
                >
                  {msg.role === "assistant" ? (
                    <Bot size={13} style={{ color: "#00BEEF" }} />
                  ) : (
                    <span className="text-xs font-bold" style={{ color: "#ED135F" }}>U</span>
                  )}
                </div>
                <div
                  className="max-w-[85%] rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: msg.role === "assistant" ? "rgba(255,255,255,0.04)" : "rgba(237,19,95,0.1)",
                    border: `1px solid ${msg.role === "assistant" ? "rgba(255,255,255,0.07)" : "rgba(237,19,95,0.2)"}`,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  <Streamdown>{msg.content}</Streamdown>
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(0,190,239,0.15)" }}>
                  <Bot size={13} style={{ color: "#00BEEF" }} />
                </div>
                <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }}>
                  {streamingContent ? (
                    <Streamdown>{streamingContent}</Streamdown>
                  ) : (
                    <div className="flex gap-1 items-center py-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#00BEEF", animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts */}
          {messages.length === 1 && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); }}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{ background: "rgba(0,190,239,0.08)", color: "#00BEEF", border: "1px solid rgba(0,190,239,0.2)" }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask about Meta Ads, skill results, optimization strategies…"
                className="flex-1 input-field"
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
                style={{
                  background: input.trim() && !isStreaming ? "#ED135F" : "rgba(255,255,255,0.08)",
                  color: input.trim() && !isStreaming ? "#fff" : "rgba(255,255,255,0.3)",
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Manus Platform Links ──────────────────────── */}
        <div className="flex flex-col gap-4 shrink-0" style={{ width: 260 }}>
          <div>
            <h3 className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Manus Platform
            </h3>
            <div className="flex flex-col gap-2">
              {MANUS_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-xl transition-all group"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = link.color + "40")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: link.color + "18" }}>
                    <link.icon size={14} style={{ color: link.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: "#FAFAFA" }}>{link.label}</span>
                      <ExternalLink size={10} style={{ color: "rgba(255,255,255,0.25)" }} />
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{link.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Recent runs context */}
          {(recentRuns as Array<{ id: number; skillName: string; status: string; startedAt: Date }>).length > 0 && (
            <div>
              <h3 className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Recent Context
              </h3>
              <div className="flex flex-col gap-1.5">
                {(recentRuns as Array<{ id: number; skillName: string; status: string; startedAt: Date }>).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.status === "success" ? "#00B37A" : "#ED135F" }} />
                    <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{r.skillName}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>The AI has context from your recent runs.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
