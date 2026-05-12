import { readFileSync, writeFileSync } from "fs";

// ── 1. AdminCreativePerformanceSync — add stalestFetchedAt footer to Goal Resolution card ──
{
  const filePath =
    "/home/ubuntu/meta-ads-platform/client/src/pages/admin/AdminCreativePerformanceSync.tsx";
  let src = readFileSync(filePath, "utf8");

  // Add stalestFetchedAt footer after the byGoal pills block, before the closing </div></section>
  src = src.replace(
    `            </div>
          </section>
        )}
                {/* ── Sync History`,
    `              {goalStats.stalestFetchedAt && (
                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>Stalest Record</p>
                      <p className="text-xs mt-0.5" style={{ color: goalStats.stalestFetchedAt && (Date.now() - new Date(goalStats.stalestFetchedAt).getTime()) > 3 * 24 * 60 * 60 * 1000 ? "#F7901E" : "rgba(255,255,255,0.55)" }}>
                        {new Date(goalStats.stalestFetchedAt).toLocaleString()}
                        {(Date.now() - new Date(goalStats.stalestFetchedAt).getTime()) > 3 * 24 * 60 * 60 * 1000 && (
                          <span className="ml-2 text-[10px] font-bold" style={{ color: "#F7901E" }}>stale &gt;3d</span>
                        )}
                      </p>
                    </div>
                    {goalStats.freshestFetchedAt && (
                      <div>
                        <p className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>Most Recent</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {new Date(goalStats.freshestFetchedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
                {/* ── Sync History`,
  );

  writeFileSync(filePath, src, "utf8");
  console.log("Done — stalestFetchedAt footer added to Goal Resolution card");
}

// ── 2. AdminCreativeDecay — add convEventLabel + evidence strip to row expander ──
{
  const filePath =
    "/home/ubuntu/meta-ads-platform/client/src/pages/admin/AdminCreativeDecay.tsx";
  let src = readFileSync(filePath, "utf8");

  // Add convEventLabel to ResultRow type
  src = src.replace(
    `  optimizationGoal?: string | null;\n};`,
    `  optimizationGoal?: string | null;\n  convEventLabel?: string | null;\n};`,
  );

  // Replace the expanded row to include an evidence strip below the chart
  src = src.replace(
    `            {isExpanded && hasTrend && (
              <tr key={\`trend-\${row.id}\`} style={{ borderTop: "none" }}>
                <td colSpan={12} style={{ background: "rgba(0,0,0,0.25)", padding: "0 16px 12px 16px" }}>
                  <FatigueTrendChart data={row.trendData!} adName={row.creativeName} />
                </td>
              </tr>
            )}`,
    `            {isExpanded && hasTrend && (
              <tr key={\`trend-\${row.id}\`} style={{ borderTop: "none" }}>
                <td colSpan={12} style={{ background: "rgba(0,0,0,0.25)", padding: "0 16px 12px 16px" }}>
                  <FatigueTrendChart data={row.trendData!} adName={row.creativeName} />
                  {/* Evidence strip */}
                  <div className="mt-3 flex flex-wrap gap-3 pb-1">
                    {row.convEventLabel && (
                      <EvidencePill
                        label="Scored On"
                        value={row.convEventLabel}
                        highlight
                      />
                    )}
                    {row.optimizationGoal && (
                      <EvidencePill
                        label="Opt. Goal"
                        value={row.optimizationGoal.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      />
                    )}
                    {row.evidence?.avgCtr != null && (
                      <EvidencePill label="Avg CTR" value={(row.evidence.avgCtr * 100).toFixed(2) + "%"} />
                    )}
                    {row.evidence?.avgFrequency != null && (
                      <EvidencePill label="Avg Freq" value={row.evidence.avgFrequency.toFixed(2)} />
                    )}
                    {row.evidence?.reliability != null && (
                      <EvidencePill label="Reliability" value={(row.evidence.reliability * 100).toFixed(0) + "%"} />
                    )}
                    {row.evidence?.totalEvents != null && (
                      <EvidencePill label="Total Events" value={row.evidence.totalEvents.toLocaleString()} />
                    )}
                    {row.firstDetectedAt?.probable && (
                      <EvidencePill label="Probable Since" value={new Date(row.firstDetectedAt.probable).toLocaleDateString()} />
                    )}
                    {row.firstDetectedAt?.possible && !row.firstDetectedAt?.probable && (
                      <EvidencePill label="Possible Since" value={new Date(row.firstDetectedAt.possible).toLocaleDateString()} />
                    )}
                  </div>
                </td>
              </tr>
            )}`,
  );

  writeFileSync(filePath, src, "utf8");
  console.log("Done — convEventLabel + evidence strip added to row expander");
}
