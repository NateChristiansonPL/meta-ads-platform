/**
 * FatigueTrendChart
 * Renders a dual-axis area/line chart showing how fatigue score, CTR, and
 * frequency evolved day-by-day over the analysis window.
 *
 * Used as an expandable inline panel inside the AdminCreativeDecay results table.
 */
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";

export interface TrendPoint {
  date: string;        // "YYYY-MM-DD"
  ctr: number;         // percentage, e.g. 1.23 = 1.23%
  frequency: number;   // avg frequency
  impressions: number; // daily impressions
  fatigueScore: number; // 0–100
}

interface Props {
  data: TrendPoint[];
  adName?: string;
}

// Colour palette aligned with the dark Pathlabs theme
const FATIGUE_COLOR  = "#ef4444"; // red-500
const CTR_COLOR      = "#22d3ee"; // cyan-400
const FREQ_COLOR     = "#a78bfa"; // violet-400
const GRID_COLOR     = "rgba(255,255,255,0.06)";
const AXIS_COLOR     = "rgba(255,255,255,0.35)";

// Thresholds for reference lines
const EMERGING_THRESHOLD  = 30;
const POSSIBLE_THRESHOLD  = 50;
const PROBABLE_THRESHOLD  = 70;

function shortDate(dateStr: string) {
  try { return format(parseISO(dateStr), "MMM d"); } catch { return dateStr; }
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-white/10 p-3 text-xs shadow-xl"
      style={{ background: "rgba(14,13,58,0.97)", minWidth: 160 }}
    >
      <p className="mb-2 font-semibold text-white/70">{shortDate(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
          <span className="text-white/60">{entry.name}:</span>
          <span className="font-mono text-white font-semibold">
            {entry.name === "Fatigue Score"
              ? `${entry.value.toFixed(1)}`
              : entry.name === "CTR"
              ? `${entry.value.toFixed(3)}%`
              : entry.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FatigueTrendChart({ data, adName }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-white/30 italic">
        No daily trend data available for this creative.
      </div>
    );
  }

  // Normalise CTR: if stored as a fraction (0.0123) convert to percentage
  const normalised = data.map((d) => ({
    ...d,
    ctr: d.ctr < 1 && d.ctr > 0 ? d.ctr * 100 : d.ctr,
  }));

  return (
    <div className="pt-2 pb-1">
      {adName && (
        <p className="text-[10px] text-white/40 mb-2 truncate px-1">
          Trend for: <span className="text-white/60 font-medium">{adName}</span>
        </p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={normalised} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="fatigueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={FATIGUE_COLOR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={FATIGUE_COLOR} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="ctrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={CTR_COLOR} stopOpacity={0.18} />
              <stop offset="95%" stopColor={CTR_COLOR} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: AXIS_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />

          {/* Left axis: Fatigue Score 0-100 */}
          <YAxis
            yAxisId="score"
            domain={[0, 100]}
            tick={{ fill: AXIS_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
            tickFormatter={(v) => `${v}`}
          />

          {/* Right axis: CTR % */}
          <YAxis
            yAxisId="ctr"
            orientation="right"
            tick={{ fill: AXIS_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />

          {/* Fatigue threshold reference lines */}
          <ReferenceLine yAxisId="score" y={EMERGING_THRESHOLD}  stroke="#facc15" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine yAxisId="score" y={POSSIBLE_THRESHOLD}  stroke="#f97316" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine yAxisId="score" y={PROBABLE_THRESHOLD}  stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 10, color: AXIS_COLOR, paddingTop: 6 }}
            iconType="circle"
            iconSize={8}
          />

          {/* Fatigue Score — filled area */}
          <Area
            yAxisId="score"
            type="monotone"
            dataKey="fatigueScore"
            name="Fatigue Score"
            stroke={FATIGUE_COLOR}
            strokeWidth={2}
            fill="url(#fatigueGrad)"
            dot={false}
            activeDot={{ r: 4, fill: FATIGUE_COLOR }}
          />

          {/* CTR — filled area on right axis */}
          <Area
            yAxisId="ctr"
            type="monotone"
            dataKey="ctr"
            name="CTR"
            stroke={CTR_COLOR}
            strokeWidth={1.5}
            fill="url(#ctrGrad)"
            dot={false}
            activeDot={{ r: 3, fill: CTR_COLOR }}
          />

          {/* Frequency — thin line on right axis (shares scale with CTR, small values) */}
          <Line
            yAxisId="ctr"
            type="monotone"
            dataKey="frequency"
            name="Frequency"
            stroke={FREQ_COLOR}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: FREQ_COLOR }}
            strokeDasharray="5 3"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend for reference lines */}
      <div className="flex items-center gap-4 mt-1 px-1 text-[9px] text-white/35">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-yellow-400" />
          Emerging (30)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-orange-400" />
          Possible (50)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-red-500" />
          Probable (70)
        </span>
      </div>
    </div>
  );
}
