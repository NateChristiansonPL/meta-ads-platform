/**
 * VideoSelectorModalAdmin
 * Meta-style "Select videos" modal for the Audience Builder.
 * Layout: Left panel (source + sub-selector) | Center (video list with filters) | Right (selected sidebar)
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { X, Play, ChevronLeft, ChevronRight, Search, RefreshCw, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { format, subDays, startOfDay } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  lengthSeconds?: number;
  createdTime?: string;
  source: "page" | "instagram" | "adaccount" | "campaign";
  adName?: string;
  adId?: string;
  // Stats (loaded separately)
  threeSecViews?: number;
  lastUsed?: string | null;
}

export interface VideoSelectorModalProps {
  accessToken: string;
  adAccountId: string;
  facebookPageId?: string;
  instagramUserId?: string;
  /** Pre-selected video IDs */
  initialSelected?: string[];
  onConfirm: (videos: VideoItem[]) => void;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function formatViews(n?: number): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Date filter presets matching the screenshot ───────────────────────────────

const DATE_PRESETS = [
  { label: "Today", range: () => { const t = startOfDay(new Date()); return { from: t, to: t }; } },
  { label: "Yesterday", range: () => { const y = subDays(startOfDay(new Date()), 1); return { from: y, to: y }; } },
  { label: "Last 7 days", range: () => ({ from: subDays(startOfDay(new Date()), 6), to: startOfDay(new Date()) }) },
  { label: "Last 14 days", range: () => ({ from: subDays(startOfDay(new Date()), 13), to: startOfDay(new Date()) }) },
  { label: "Last 28 days", range: () => ({ from: subDays(startOfDay(new Date()), 27), to: startOfDay(new Date()) }) },
  { label: "This month", range: () => ({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: startOfDay(new Date()) }) },
  { label: "This quarter", range: () => {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return { from: qStart, to: startOfDay(now) };
  }},
];

// ── Video source types ────────────────────────────────────────────────────────

type VideoSource = "page" | "instagram" | "adaccount" | "campaign";

const SOURCE_OPTIONS: { value: VideoSource; label: string; icon: string }[] = [
  { value: "page", label: "Facebook Page", icon: "fb" },
  { value: "instagram", label: "Instagram professional account", icon: "ig" },
  { value: "adaccount", label: "Ad Account", icon: "account" },
  { value: "campaign", label: "Campaign", icon: "campaign" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function VideoSelectorModal({
  accessToken,
  adAccountId,
  facebookPageId,
  instagramUserId,
  initialSelected = [],
  onConfirm,
  onClose,
}: VideoSelectorModalProps) {
  const [videoSource, setVideoSource] = useState<VideoSource>("page");
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [videoIdInput, setVideoIdInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Date filters
  const [lastUsedRange, setLastUsedRange] = useState<DateRange | undefined>(undefined);
  const [uploadedRange, setUploadedRange] = useState<DateRange | undefined>(undefined);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelected));
  const [selectedVideos, setSelectedVideos] = useState<VideoItem[]>([]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const pageVideosQuery = trpc.adminMeta.getPageVideos.useQuery(
    {
      accessToken,
      pageId: facebookPageId || "",
      limit: 100,
      uploadedAfter: uploadedRange?.from ? format(uploadedRange.from, "yyyy-MM-dd") : undefined,
      uploadedBefore: uploadedRange?.to ? format(uploadedRange.to, "yyyy-MM-dd") : undefined,
    },
    { enabled: videoSource === "page" && !!facebookPageId && !!accessToken }
  );

  const igVideosQuery = trpc.adminMeta.getIGAccountVideos.useQuery(
    { accessToken, igUserId: instagramUserId || "", limit: 100 },
    { enabled: videoSource === "instagram" && !!instagramUserId && !!accessToken }
  );

  const adAccountVideosQuery = trpc.adminMeta.getAdVideos.useQuery(
    { accessToken, adAccountId, limit: 100 },
    { enabled: videoSource === "adaccount" && !!adAccountId && !!accessToken }
  );

  const campaignVideosQuery = trpc.adminMeta.getCampaignVideos.useQuery(
    { accessToken, adAccountId, campaignId },
    { enabled: videoSource === "campaign" && !!campaignId && !!accessToken }
  );

  // ── Campaigns list for campaign selector ──────────────────────────────────

  const campaignsQuery = trpc.adminMeta.getCampaigns.useQuery(
    { accessToken, adAccountId },
    { enabled: videoSource === "campaign" && !!accessToken && !!adAccountId }
  );

  // ── Aggregate raw videos based on source ──────────────────────────────────

  const rawVideos: VideoItem[] = useMemo(() => {
    const toItem = (v: Record<string, unknown>, src: VideoItem["source"]): VideoItem => ({
      id: String(v.id ?? ""),
      title: String(v.title ?? ""),
      description: v.description ? String(v.description) : undefined,
      thumbnailUrl: String(v.thumbnailUrl ?? ""),
      lengthSeconds: v.lengthSeconds != null ? Number(v.lengthSeconds) : undefined,
      createdTime: v.createdTime ? String(v.createdTime) : undefined,
      source: src,
      adName: v.adName ? String(v.adName) : undefined,
      adId: v.adId ? String(v.adId) : undefined,
    });
    if (videoSource === "page") {
      return (pageVideosQuery.data?.videos || []).map(v => toItem(v as Record<string, unknown>, "page"));
    }
    if (videoSource === "instagram") {
      return (igVideosQuery.data?.videos || []).map(v => toItem(v as Record<string, unknown>, "instagram"));
    }
    if (videoSource === "adaccount") {
      return (adAccountVideosQuery.data?.videos || []).map((v: { id: string; title: string; description?: string; thumbnailUrl: string; lengthSeconds?: number; createdTime?: string; status?: string }) => toItem(v as Record<string, unknown>, "adaccount"));
    }
    if (videoSource === "campaign") {
      return (campaignVideosQuery.data?.videos || []).filter(Boolean).map(v => toItem(v as Record<string, unknown>, "campaign"));
    }
    return [];
  }, [videoSource, pageVideosQuery.data, igVideosQuery.data, adAccountVideosQuery.data, campaignVideosQuery.data]);

  // ── Fetch stats for visible video IDs ─────────────────────────────────────

  const visibleIds = useMemo(() => rawVideos.map(v => v.id).slice(0, 50), [rawVideos]);

  const statsQuery = trpc.adminMeta.getVideoStats.useQuery(
    { accessToken, adAccountId, videoIds: visibleIds },
    { enabled: visibleIds.length > 0 && !!accessToken && !!adAccountId }
  );

  // ── Merge stats into videos ────────────────────────────────────────────────

  const videosWithStats: VideoItem[] = useMemo(() => {
    const stats = statsQuery.data?.stats || {};
    return rawVideos.map(v => ({
      ...v,
      threeSecViews: stats[v.id]?.threeSecViews,
      lastUsed: stats[v.id]?.lastUsed,
    }));
  }, [rawVideos, statsQuery.data]);

  // ── Filter by search and date ranges ──────────────────────────────────────

  const filteredVideos = useMemo(() => {
    let vids = videosWithStats;
    if (search.trim()) {
      const q = search.toLowerCase();
      vids = vids.filter(v => v.title.toLowerCase().includes(q) || v.id.includes(q));
    }
    if (lastUsedRange?.from) {
      const from = lastUsedRange.from.getTime();
      const to = lastUsedRange.to ? lastUsedRange.to.getTime() : Infinity;
      vids = vids.filter(v => {
        if (!v.lastUsed) return false;
        const ts = new Date(v.lastUsed).getTime();
        return ts >= from && ts <= to;
      });
    }
    return vids;
  }, [videosWithStats, search, lastUsedRange]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
  const pagedVideos = filteredVideos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [videoSource, search, lastUsedRange, uploadedRange]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleVideo = useCallback((video: VideoItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(video.id)) {
        next.delete(video.id);
        setSelectedVideos(sv => sv.filter(v => v.id !== video.id));
      } else {
        next.add(video.id);
        setSelectedVideos(sv => [...sv, video]);
      }
      return next;
    });
  }, []);

  const removeSelected = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setSelectedVideos(sv => sv.filter(v => v.id !== id));
  }, []);

  const isLoading =
    (videoSource === "page" && pageVideosQuery.isLoading) ||
    (videoSource === "instagram" && igVideosQuery.isLoading) ||
    (videoSource === "adaccount" && adAccountVideosQuery.isLoading) ||
    (videoSource === "campaign" && campaignVideosQuery.isLoading);

  const refetch = () => {
    if (videoSource === "page") pageVideosQuery.refetch();
    else if (videoSource === "instagram") igVideosQuery.refetch();
    else if (videoSource === "adaccount") adAccountVideosQuery.refetch();
    else if (videoSource === "campaign") campaignVideosQuery.refetch();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="relative flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "#141349",
          border: "1px solid rgba(255,255,255,0.10)",
          width: "min(1100px, 96vw)",
          height: "min(720px, 92vh)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h2 className="text-lg font-semibold text-white">Select videos</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body: 3-panel layout ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left panel: Video source selector ── */}
          <div
            className="w-72 shrink-0 flex flex-col gap-4 p-5 overflow-y-auto"
            style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Video sources label */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                Video sources
              </p>

              {/* Source dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSourceDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                  style={{
                    background: "#1a1860",
                    border: "1px solid rgba(0,190,239,0.35)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <SourceIcon source={videoSource} />
                    {SOURCE_OPTIONS.find(s => s.value === videoSource)?.label}
                  </span>
                  <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {sourceDropdownOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 shadow-xl"
                    style={{ background: "#0d0c36", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {SOURCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setVideoSource(opt.value); setSourceDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                        style={{
                          color: opt.value === videoSource ? "#00BEEF" : "rgba(255,255,255,0.85)",
                          background: opt.value === videoSource ? "rgba(0,190,239,0.08)" : "transparent",
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {opt.value === videoSource && (
                            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <SourceIcon source={opt.value} />
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sub-selector: FB Page */}
            {videoSource === "page" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Facebook Page
                </p>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/80"
                  style={{ background: "#1a1860", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <Facebook className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">{facebookPageId || "No page configured"}</span>
                </div>
                {!facebookPageId && (
                  <p className="text-xs mt-1.5" style={{ color: "#f87171" }}>
                    Configure a Facebook Page in session settings
                  </p>
                )}
              </div>
            )}

            {/* Sub-selector: IG Account */}
            {videoSource === "instagram" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Instagram Account
                </p>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/80"
                  style={{ background: "#1a1860", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                  <span className="truncate">{instagramUserId || "No IG account configured"}</span>
                </div>
                {!instagramUserId && (
                  <p className="text-xs mt-1.5" style={{ color: "#f87171" }}>
                    Configure an Instagram User ID in session settings
                  </p>
                )}
              </div>
            )}

            {/* Sub-selector: Campaign */}
            {videoSource === "campaign" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Campaign
                </p>
                <select
                  value={campaignId}
                  onChange={e => setCampaignId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white"
                  style={{ background: "#1a1860", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <option value="">Select a campaign</option>
                  {(campaignsQuery.data?.campaigns || []).map((c: { id: string; name: string }) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-selector: Video ID */}
            {videoSource === "adaccount" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Ad Account Videos
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Showing all videos in ad account {adAccountId}
                </p>
              </div>
            )}

            {/* Date filters */}
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                Filters
              </p>
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>Last used date</p>
                  <DateRangePicker
                    value={lastUsedRange}
                    onChange={setLastUsedRange}
                    placeholder="Any date"
                    className="w-full text-xs"
                    presets={DATE_PRESETS.map(p => ({ label: p.label, range: p.range() }))}
                  />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>Uploaded date</p>
                  <DateRangePicker
                    value={uploadedRange}
                    onChange={setUploadedRange}
                    placeholder="Any date"
                    className="w-full text-xs"
                    presets={DATE_PRESETS.map(p => ({ label: p.label, range: p.range() }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Center panel: Video list ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Center toolbar */}
            <div
              className="flex items-center gap-3 px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.35)" }} />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search videos..."
                  className="pl-8 h-8 text-xs"
                  style={{ background: "#0d0c36", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
              <button
                onClick={refetch}
                className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              {/* Pagination */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div
              className="grid items-center px-5 py-2 shrink-0"
              style={{
                gridTemplateColumns: "32px 80px 1fr 110px 110px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div />
              <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Thumb</div>
              <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Details</div>
              <div className="text-xs font-semibold text-center" style={{ color: "rgba(255,255,255,0.4)" }}>3s video views</div>
              <div className="text-xs font-semibold text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Last used</div>
            </div>

            {/* Video rows */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(0,190,239,0.3)", borderTopColor: "#00BEEF" }} />
                </div>
              ) : pagedVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <Play className="w-8 h-8" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {videoSource === "page" && !facebookPageId ? "No Facebook Page configured" :
                     videoSource === "instagram" && !instagramUserId ? "No Instagram account configured" :
                     videoSource === "campaign" && !campaignId ? "Select a campaign to load videos" :
                     "No videos found"}
                  </p>
                </div>
              ) : (
                pagedVideos.map(video => (
                  <VideoRow
                    key={video.id}
                    video={video}
                    selected={selectedIds.has(video.id)}
                    onToggle={() => toggleVideo(video)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right panel: Selected videos sidebar ── */}
          <div
            className="w-64 shrink-0 flex flex-col"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-sm font-semibold text-white">
                Selected videos ({selectedIds.size})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedIds.size === 0 ? (
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Your selected videos will appear here. You'll be able to remove any videos you don't want to include before confirming your selections.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedVideos.map(video => (
                    <div
                      key={video.id}
                      className="flex items-start gap-2 p-2 rounded-lg group"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-9 rounded overflow-hidden shrink-0 relative" style={{ background: "#0d0c36" }}>
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{video.title}</p>
                        {video.lengthSeconds && (
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{formatDuration(video.lengthSeconds)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeSelected(video.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
            style={{ background: "transparent" }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(selectedVideos)}
            disabled={selectedIds.size === 0}
            style={{
              background: selectedIds.size > 0 ? "#00BEEF" : "rgba(0,190,239,0.25)",
              color: selectedIds.size > 0 ? "#141349" : "rgba(255,255,255,0.4)",
              fontWeight: 700,
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── VideoRow sub-component ────────────────────────────────────────────────────

function VideoRow({
  video,
  selected,
  onToggle,
}: {
  video: VideoItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className="grid items-center px-5 py-3 cursor-pointer transition-colors hover:bg-white/5"
      style={{
        gridTemplateColumns: "32px 80px 1fr 110px 110px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: selected ? "rgba(0,190,239,0.06)" : "transparent",
      }}
    >
      {/* Checkbox */}
      <div onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="border-white/30 data-[state=checked]:bg-[#00BEEF] data-[state=checked]:border-[#00BEEF]"
        />
      </div>

      {/* Thumbnail */}
      <div className="w-16 h-12 rounded overflow-hidden relative" style={{ background: "#0d0c36" }}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.9)" }}>
            <Play className="w-3 h-3 fill-current text-gray-800 ml-0.5" />
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-3 min-w-0">
        <p className="text-sm font-medium text-white truncate">{video.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {video.lengthSeconds && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              {formatDuration(video.lengthSeconds)}
            </span>
          )}
          {video.createdTime && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              • Uploaded: {formatDate(video.createdTime)}
            </span>
          )}
        </div>
        {/* Platform icons */}
        <div className="flex items-center gap-1 mt-1">
          {(video.source === "page" || video.source === "adaccount" || video.source === "campaign") && (
            <Facebook className="w-3.5 h-3.5 text-blue-400" />
          )}
          {(video.source === "instagram") && (
            <Instagram className="w-3.5 h-3.5 text-pink-400" />
          )}
        </div>
      </div>

      {/* 3s video views */}
      <div className="text-center">
        <span className="text-sm font-medium" style={{ color: video.threeSecViews ? "#00BEEF" : "rgba(255,255,255,0.4)" }}>
          {formatViews(video.threeSecViews)}
        </span>
      </div>

      {/* Last used */}
      <div className="text-center">
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
          {formatDate(video.lastUsed)}
        </span>
      </div>
    </div>
  );
}

// ── Source icon helper ────────────────────────────────────────────────────────

function SourceIcon({ source }: { source: VideoSource }) {
  if (source === "page") return <Facebook className="w-4 h-4 text-blue-400 shrink-0" />;
  if (source === "instagram") return <Instagram className="w-4 h-4 text-pink-400 shrink-0" />;
  if (source === "adaccount") return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "rgba(255,255,255,0.6)" }}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "rgba(255,255,255,0.6)" }}>
      <path d="M3 3h18v18H3z" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}
