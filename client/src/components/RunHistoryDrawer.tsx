/**
 * RunHistoryDrawer
 * Slide-in panel showing past skill runs for the current user + skill.
 * Opens via a "History" button at the top of each skill page.
 * Clicking a run expands to show the full report inline.
 */

import HelpTip from "@/components/HelpTip";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  History,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Database,
} from "lucide-react";

interface RunHistoryDrawerProps {
  skillId: string;
  skillName: string;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-400" />;
  return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">Complete</Badge>;
  if (status === "error") return <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">Failed</Badge>;
  return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Running</Badge>;
}

type HistoryRun = {
  id: number;
  skillId: string;
  skillName: string;
  status: string;
  adAccountId: string;
  adAccountName: string | null;
  datePreset: string;
  reportMarkdown: string | null;
  errorMessage: string | null;
  taskUrl: string | null;
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

function RunRow({ run }: { run: HistoryRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden mb-2">
      {/* Row header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <StatusIcon status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">
              {run.adAccountName ?? run.adAccountId}
            </span>
            <StatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(run.startedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(run.durationMs)}
            </span>
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {run.datePreset}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
        )}
      </button>

      {/* Expanded report */}
      {expanded && (
        <div className="border-t border-white/10 bg-black/20">
          {/* Action bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
            {run.taskUrl && (
              <a
                href={run.taskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View on Manus
              </a>
            )}
          </div>

          {/* Report content */}
          <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
            {run.status === "error" ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="font-medium mb-1">Run failed</p>
                <p className="text-red-400/80">{run.errorMessage ?? "Unknown error"}</p>
              </div>
            ) : run.reportMarkdown ? (
              <div className="prose prose-invert prose-sm max-w-none text-sm">
                <Streamdown>{run.reportMarkdown}</Streamdown>
              </div>
            ) : (
              <p className="text-sm text-white/40 italic">No report content available for this run.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RunHistoryDrawer({ skillId, skillName }: RunHistoryDrawerProps) {
  const [open, setOpen] = useState(false);

  const { data: runs, isLoading } = trpc.runs.skillHistory.useQuery(
    { skillId, limit: 50 },
    { enabled: open }
  );

  const successCount = runs?.filter((r) => r.status === "success").length ?? 0;
  const totalCount = runs?.length ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      <HelpTip content="View all past runs for this skill — including the full report, credit usage, and duration. Click any row to expand the report inline." />
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent"
        >
          <History className="w-4 h-4" />
          History
          {totalCount > 0 && (
            <span className="ml-1 bg-white/10 text-white/60 text-xs px-1.5 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-[#0e0d3a] border-white/10 text-white overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            {skillName} — Run History
          </SheetTitle>
          {totalCount > 0 && (
            <p className="text-sm text-white/50">
              {successCount} of {totalCount} run{totalCount !== 1 ? "s" : ""} completed successfully
            </p>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading history...</span>
          </div>
        ) : !runs || runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/30">
            <History className="w-10 h-10" />
            <p className="text-sm">No runs yet for this skill.</p>
            <p className="text-xs text-white/20">
              Run an analysis to see your history here.
            </p>
          </div>
        ) : (
          <div>
            {(runs as HistoryRun[]).map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
    </div>
  );
}
