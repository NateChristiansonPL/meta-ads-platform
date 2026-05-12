/**
 * AudienceBuilderModalAdmin
 * Full 5-screen audience builder with LIVE DATA wiring:
 *   1. TypeSelector    — landing with Custom / Lookalike / Quick Build cards
 *   2. SourcePicker    — YOUR SOURCES + META SOURCES grid
 *   3. CustomConfig    — per-source form with LIVE API data (pixels, videos, IG accounts, pages, events, lead forms, catalogs)
 *   4. LALBuilder      — source dropdown (live custom audiences), location, size slider
 *   5. QuickBuild      — 12 pre-built templates, all source-dependent fields wired to live API data
 *
 * Design tokens: pageBg #0d0c36 · surface #141349 · card #1a1860 · cyan #00BEEF
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import VideoSelectorModal, { type VideoItem } from './VideoSelectorModalAdmin';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  cyan:       '#00beef',
  cyanDim:    'rgba(0,190,239,0.15)',
  cyanGlow:   'rgba(0,190,239,0.25)',
  borderHi:   'rgba(0,190,239,0.45)',
  pink:       '#ed135f',
  pinkDim:    'rgba(237,19,95,0.15)',
  orange:     '#f7901e',
  orangeDim:  'rgba(247,144,30,0.15)',
  green:      '#00d48a',
  greenDim:   'rgba(0,212,138,0.15)',
  purple:     '#a78bfa',
  purpleDim:  'rgba(167,139,250,0.15)',
  blue:       '#60a5fa',
  blueDim:    'rgba(96,165,250,0.15)',
  yellow:     '#fbbf24',
  yellowDim:  'rgba(251,191,36,0.15)',
  bg:         '#0d0c36',
  surface:    '#141349',
  surface2:   '#1a1860',
  surface3:   '#1f1d70',
  overlay:    'rgba(7,6,28,0.80)',
  border:     'rgba(255,255,255,0.08)',
  borderMid:  'rgba(255,255,255,0.14)',
  textHi:     '#f0f0ff',
  textMid:    '#a8a8c8',
  textLo:     '#6b6b8f',
  sh1:        '0 1px 4px rgba(0,0,0,0.4)',
  sh4:        '0 24px 64px rgba(0,0,0,0.7)',
  shCyan:     '0 0 24px rgba(0,190,239,0.18)',
  font:       "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

// ─── Source Definitions ───────────────────────────────────────────────────────
const YOUR_SOURCES = [
  { id: 'website',       emoji: '🌐', label: 'Website',          sub: 'Pixel-based visitors',  color: T.cyanDim,   accent: T.cyan },
  { id: 'customer_list', emoji: '📂', label: 'Customer list',    sub: 'Upload CSV / TXT',       color: 'rgba(255,255,255,0.05)', accent: T.textMid },
  { id: 'app',           emoji: '📱', label: 'App activity',     sub: 'Mobile app events',      color: T.orangeDim, accent: T.orange },
  { id: 'offline',       emoji: '📡', label: 'Offline activity', sub: 'Offline conversions',    color: T.greenDim,  accent: T.green },
  { id: 'catalog',       emoji: '🗂️', label: 'Catalog',          sub: 'Product interactions',   color: 'rgba(255,255,255,0.05)', accent: T.textMid },
];

const META_SOURCES = [
  { id: 'video',         emoji: '🎬', label: 'Video',               sub: 'Video engagement',      color: T.purpleDim, accent: T.purple },
  { id: 'instagram',     emoji: '📸', label: 'Instagram profile',   sub: 'IG profile engagement', color: T.pinkDim,   accent: T.pink },
  { id: 'leadform',      emoji: '📋', label: 'Lead form',           sub: 'Lead gen activity',     color: T.greenDim,  accent: T.green },
  { id: 'events',        emoji: '🎟️', label: 'Events',              sub: 'Event engagement',      color: T.yellowDim, accent: T.yellow },
  { id: 'instant_exp',   emoji: '⚡', label: 'Instant Experience',  sub: 'Canvas engagement',     color: T.orangeDim, accent: T.orange },
  { id: 'facebook_page', emoji: '👍', label: 'Facebook Page',       sub: 'Page engagement',       color: T.blueDim,   accent: T.blue },
  { id: 'shopping',      emoji: '🛍️', label: 'Shopping',            sub: 'Catalog activity',      color: T.pinkDim,   accent: T.pink },
  { id: 'on_facebook',   emoji: '📣', label: 'On-Facebook listings',sub: 'Rental & vehicle',      color: T.orangeDim, accent: T.orange },
];

type SourceDef = { id: string; emoji: string; label: string; sub: string; color: string; accent: string };
type Screen = 'type' | 'source_picker' | 'custom_config' | 'lal' | 'quick';

interface Props {
  accessToken: string;
  adAccountId: string;
  pixelId?: string;
  facebookPageId?: string;
  instagramUserId?: string;
  onCreated: (audience: { id: string; name: string }) => void;
  onClose: () => void;
}

// ─── Primitive Components ─────────────────────────────────────────────────────
function Btn({ children, variant = 'primary', onClick, disabled, style: extra = {} }: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void; disabled?: boolean; style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const base: React.CSSProperties = { fontFamily: T.font, fontWeight: 600, fontSize: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 8, padding: '9px 18px', transition: 'all 0.18s ease', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.4 : 1, ...extra };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: disabled ? T.cyanDim : hover ? '#00d4ff' : T.cyan, color: T.bg, boxShadow: hover && !disabled ? `0 0 20px ${T.cyanGlow}` : 'none', transform: hover && !disabled ? 'translateY(-1px)' : 'none' },
    secondary: { background: hover ? T.surface3 : T.surface2, color: T.textMid, border: `1px solid ${T.border}` },
    ghost: { background: 'transparent', color: hover ? T.cyan : T.textMid },
  };
  return <button style={{ ...base, ...styles[variant] }} onClick={onClick} disabled={disabled} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{children}</button>;
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <span style={{ fontFamily: T.font, fontWeight: 600, fontSize: 12, color: T.textMid, letterSpacing: '0.02em' }}>{children}</span>
      {hint && <div style={{ fontFamily: T.font, fontSize: 11, color: T.textLo, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontFamily: T.font, fontSize: 13, color: T.textHi,
  padding: '9px 13px', borderRadius: 8, background: T.surface2, outline: 'none', transition: 'all 0.15s ease',
};

function TxtInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focus, setFocus] = useState(false);
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
    style={{ ...inputBase, border: `1px solid ${focus ? T.cyan : T.border}`, boxShadow: focus ? `0 0 0 3px ${T.cyanDim}` : 'none' }} />;
}

function SelInput({ value, onChange, options, loading }: { value: string; onChange: (v: string) => void; options: string[]; loading?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} disabled={loading}
        style={{ ...inputBase, border: `1px solid ${focus ? T.cyan : T.border}`, boxShadow: focus ? `0 0 0 3px ${T.cyanDim}` : 'none', appearance: 'none', cursor: loading ? 'wait' : 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a8a8c8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 13px center', paddingRight: 34, opacity: loading ? 0.6 : 1 }}>
        {options.map(o => <option key={o} style={{ background: T.surface2, color: T.textHi }}>{o}</option>)}
      </select>
      {loading && <div style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', fontFamily: T.font, fontSize: 11, color: T.textLo }}>Loading…</div>}
    </div>
  );
}

function RadioGrp({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <label key={opt.value} onClick={() => onChange(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '9px 13px', borderRadius: 8, border: `1px solid ${active ? T.cyan : T.border}`, background: active ? T.cyanDim : T.surface2, transition: 'all 0.15s ease' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${active ? T.cyan : T.borderMid}`, background: active ? T.cyan : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
              {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.bg }} />}
            </div>
            <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.textHi : T.textMid }}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function SliderInput({ value, onChange, min, max, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; unit: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: T.font, fontSize: 12, color: T.textLo }}>{min} {unit}</span>
        <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.cyan, background: T.cyanDim, border: `1px solid ${T.borderHi}`, padding: '2px 12px', borderRadius: 20 }}>{value} {unit}</span>
        <span style={{ fontFamily: T.font, fontSize: 12, color: T.textLo }}>{max} {unit}</span>
      </div>
      <div style={{ position: 'relative', height: 5, background: T.surface3, borderRadius: 3 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${T.cyan}, #00d4ff)`, borderRadius: 3, transition: 'width 0.1s', boxShadow: `0 0 8px ${T.cyanGlow}` }} />
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, opacity: 0, cursor: 'pointer', margin: 0 }} />
      </div>
    </div>
  );
}

function RuleGroup({ value, onChange, ruleTypes }: { value: { type: string }[] | undefined; onChange: (v: { type: string }[]) => void; ruleTypes: string[] }) {
  const rules = value || [{ type: ruleTypes[0] }];
  const updateRule = (i: number, v: string) => onChange(rules.map((r, idx) => idx === i ? { ...r, type: v } : r));
  const addRule = () => onChange([...rules, { type: ruleTypes[0] }]);
  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  return (
    <div>
      {rules.map((rule, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          {i > 0 && <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: T.cyan, background: T.cyanDim, border: `1px solid ${T.borderHi}`, padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>OR</span>}
          <div style={{ flex: 1 }}><SelInput value={rule.type} onChange={v => updateRule(i, v)} options={ruleTypes} /></div>
          {rules.length > 1 && <button onClick={() => removeRule(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textLo, fontSize: 18, padding: '0 4px', flexShrink: 0 }}>×</button>}
        </div>
      ))}
      <button onClick={addRule} style={{ fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.cyan, background: 'none', border: `1px dashed ${T.borderHi}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', width: '100%', transition: 'all 0.15s ease' }}>+ Add OR condition</button>
    </div>
  );
}

function FileUpload({ onChange, hint }: { onChange: (f: File | null) => void; hint?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  const handle = (f: File) => { setFile(f); onChange(f); };
  return (
    <div>
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        onClick={() => ref.current?.click()}
        style={{ border: `1.5px dashed ${drag ? T.cyan : T.borderMid}`, borderRadius: 10, padding: '22px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? T.cyanDim : T.surface2, transition: 'all 0.15s ease' }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>📁</div>
        {file ? <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.green }}>✓ {file.name}</div> :
          <><div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 500, color: T.textMid }}>Drop file here or <span style={{ color: T.cyan }}>browse</span></div><div style={{ fontFamily: T.font, fontSize: 11, color: T.textLo, marginTop: 3 }}>CSV or TXT, up to 500,000 rows</div></>}
        <input ref={ref} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handle(e.target.files[0]); }} />
      </div>
      {hint && <div style={{ fontFamily: T.font, fontSize: 11, color: T.textLo, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

// ─── Shared Layout Pieces ─────────────────────────────────────────────────────
const Divider = () => <div style={{ height: 1, background: T.border, margin: '14px 0 0' }} />;
const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.font, fontSize: 12, fontWeight: 600, color: T.textLo, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: 14, transition: 'color 0.15s' }}
    onMouseEnter={e => (e.currentTarget.style.color = T.cyan)} onMouseLeave={e => (e.currentTarget.style.color = T.textLo)}>
    ← Back
  </button>
);
const SuccessScreen = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
    <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
    <div style={{ fontFamily: T.font, fontSize: 17, fontWeight: 700, color: T.textHi, marginBottom: 8 }}>{title}</div>
    <div style={{ fontFamily: T.font, fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>{subtitle}</div>
  </div>
);

// ─── Screen: Type Selector ────────────────────────────────────────────────────
function TypeSelector({ onSelect }: { onSelect: (t: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const types = [
    { id: 'custom', emoji: '🎯', label: 'Custom Audience', desc: 'Reach people who already know your business — website visitors, customers, app users, and more.', accent: T.cyan, dim: T.cyanDim, glowColor: T.cyanGlow },
    { id: 'lal',    emoji: '🔍', label: 'Lookalike Audience', desc: 'Find new people who look like your best customers or most engaged users.', accent: T.blue, dim: T.blueDim, glowColor: 'rgba(96,165,250,0.25)' },
    { id: 'quick',  emoji: '⚡', label: 'Quick Build', desc: 'Pre-designed audience templates — fill in a few details and go. Audience name generated automatically.', accent: T.orange, dim: T.orangeDim, glowColor: 'rgba(247,144,30,0.25)', badge: 'NEW' as const },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 22px 0' }}>
        <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.cyan, marginBottom: 8 }}>Meta Audience Builder</div>
        <div style={{ fontFamily: T.font, fontSize: 20, fontWeight: 800, color: T.textHi, marginBottom: 4 }}>Build Your Audience</div>
        <div style={{ fontFamily: T.font, fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>Choose the type of audience you want to create for your Meta campaigns.</div>
      </div>
      <Divider />
      <div style={{ flex: 1, padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {types.map(t => (
          <div key={t.id} onClick={() => onSelect(t.id)} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}
            style={{ padding: '15px 16px', borderRadius: 12, border: `1px solid ${hover === t.id ? t.accent : T.border}`, background: hover === t.id ? t.dim : T.surface2, cursor: 'pointer', transition: 'all 0.18s ease', boxShadow: hover === t.id ? `0 0 20px ${t.glowColor}` : T.sh1, transform: hover === t.id ? 'translateY(-2px)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: hover === t.id ? t.dim : T.surface3, border: `1px solid ${hover === t.id ? t.accent + '55' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, transition: 'all 0.18s ease' }}>{t.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 800, color: T.textHi, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.label}
                {'badge' in t && t.badge && <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: T.orange, background: T.orangeDim, border: '1px solid rgba(247,144,30,0.35)', padding: '2px 6px', borderRadius: 20, letterSpacing: '0.06em' }}>NEW</span>}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: T.textMid, lineHeight: 1.55 }}>{t.desc}</div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: T.font, fontSize: 11, fontWeight: 700, color: hover === t.id ? t.accent : T.textLo, transition: 'color 0.18s' }}>Get started →</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: Source Picker ────────────────────────────────────────────────────
function SourceRow({ src, selected, onToggle }: { src: SourceDef; selected: string | null; onToggle: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  const checked = selected === src.id;
  return (
    <div onClick={() => onToggle(src.id)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: checked ? src.color : hover ? T.surface2 : 'transparent', border: `1px solid ${checked ? src.accent : 'transparent'}`, transition: 'all 0.14s ease' }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${checked ? src.accent : T.borderMid}`, background: checked ? src.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.14s ease' }}>
        {checked && <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.bg }} />}
      </div>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: checked ? 'rgba(255,255,255,0.1)' : T.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{src.emoji}</div>
      <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? T.textHi : T.textMid, lineHeight: 1.2 }}>{src.label}</div>
    </div>
  );
}

function SourcePicker({ onSelect, onBack }: { onSelect: (src: SourceDef) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const handleNext = () => {
    const src = [...YOUR_SOURCES, ...META_SOURCES].find(s => s.id === selected);
    if (src) onSelect(src);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <BackBtn onClick={onBack} />
        <div style={{ fontFamily: T.font, fontSize: 17, fontWeight: 800, color: T.textHi, marginBottom: 3 }}>Create a Custom Audience</div>
        <div style={{ fontFamily: T.font, fontSize: 12, color: T.textMid }}>Choose a source to build your audience from.</div>
      </div>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
        <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.textLo, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>Your Sources</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 14 }}>
          {YOUR_SOURCES.map(s => <SourceRow key={s.id} src={s} selected={selected} onToggle={setSelected} />)}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.textLo, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>Meta Sources</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {META_SOURCES.map(s => <SourceRow key={s.id} src={s} selected={selected} onToggle={setSelected} />)}
        </div>
      </div>
      <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="#" style={{ fontFamily: T.font, fontSize: 12, color: T.cyan, textDecoration: 'none' }} onClick={e => e.preventDefault()}>About custom audiences</a>
        <div style={{ display: 'flex', gap: 8 }}><Btn variant="secondary" onClick={onBack}>Cancel</Btn><Btn onClick={handleNext} disabled={!selected}>Next</Btn></div>
      </div>
    </div>
  );
}

// ─── Screen: Custom Config (FULLY WIRED) ─────────────────────────────────────
function CustomConfig({ source, onBack, onCreated, accessToken, adAccountId, pixelId, facebookPageId, instagramUserId }: {
  source: SourceDef; onBack: () => void;
  onCreated: (a: { id: string; name: string }) => void;
  accessToken: string; adAccountId: string;
  pixelId?: string; facebookPageId?: string; instagramUserId?: string;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<VideoItem[]>([]);

  // ── Live data queries (each only enabled when relevant) ──
  const { data: pixelEventsData, isLoading: pixelEventsLoading } = trpc.adminMeta.getPixelEvents.useQuery(
    { accessToken, pixelId: pixelId || '', adAccountId },
    { enabled: !!accessToken && !!pixelId && (source.id === 'website'), staleTime: 5 * 60 * 1000 }
  );

  const { data: videosData, isLoading: videosLoading } = trpc.adminMeta.getAdVideos.useQuery(
    { accessToken, adAccountId },
    { enabled: !!accessToken && !!adAccountId && source.id === 'video', staleTime: 5 * 60 * 1000 }
  );

  const { data: igAccountsData, isLoading: igAccountsLoading } = trpc.adminMeta.getPageInstagramAccounts.useQuery(
    { accessToken, pageId: facebookPageId || '' },
    { enabled: !!accessToken && !!facebookPageId && source.id === 'instagram', staleTime: 5 * 60 * 1000 }
  );

  const { data: leadFormsData, isLoading: leadFormsLoading } = trpc.adminMeta.getLeadGenForms.useQuery(
    { accessToken, pageId: facebookPageId || '' },
    { enabled: !!accessToken && !!facebookPageId && source.id === 'leadform', staleTime: 5 * 60 * 1000 }
  );

  const { data: eventsData, isLoading: eventsLoading } = trpc.adminMeta.getPageEvents.useQuery(
    { accessToken, pageId: facebookPageId || '' },
    { enabled: !!accessToken && !!facebookPageId && source.id === 'events', staleTime: 5 * 60 * 1000 }
  );

  const { data: instantExpData, isLoading: instantExpLoading } = trpc.adminMeta.getPageInstantExperiences.useQuery(
    { accessToken, pageId: facebookPageId || '' },
    { enabled: !!accessToken && !!facebookPageId && source.id === 'instant_exp', staleTime: 5 * 60 * 1000 }
  );

  const { data: catalogsData, isLoading: catalogsLoading } = trpc.adminMeta.getAdAccountCatalogs.useQuery(
    { accessToken, adAccountId },
    { enabled: !!accessToken && !!adAccountId && (source.id === 'catalog' || source.id === 'shopping'), staleTime: 5 * 60 * 1000 }
  );

  const { data: customConversionsData, isLoading: customConversionsLoading } = trpc.adminMeta.getPixelEvents.useQuery(
    { accessToken, pixelId: pixelId || '', adAccountId },
    { enabled: !!accessToken && !!pixelId && source.id === 'app', staleTime: 5 * 60 * 1000 }
  );

  // ── Build dynamic options for each source ──
  const getDynamicOptions = (sourceId: string, field: string): { options: string[]; loading: boolean } => {
    switch (sourceId) {
      case 'website':
        if (field === 'pixel') {
          if (!pixelId) return { options: ['No pixel configured in settings'], loading: false };
          return { options: [`Pixel: ${pixelId}`, ...(pixelEventsData?.events || [])], loading: pixelEventsLoading };
        }
        break;
      case 'video':
        if (field === 'videos') {
          const videoOpts = videosData?.videos?.map((v: { id: string; title: string }) => `${v.id}|${v.title}`) || [];
          return { options: ['All videos', ...videoOpts], loading: videosLoading };
        }
        break;
      case 'instagram':
        if (field === 'account') {
          if (!facebookPageId) return { options: ['No Facebook Page configured in settings'], loading: false };
          // Prefer session instagramUserId if available
          const sessionIG = instagramUserId ? [`${instagramUserId}|Session IG Account`] : [];
          const apiIG = igAccountsData?.accounts?.map((a: { id: string; username: string }) => `${a.id}|@${a.username}`) || [];
          const combined = Array.from(new Set([...sessionIG, ...apiIG]));
          return { options: ['Select Instagram account', ...combined], loading: igAccountsLoading };
        }
        break;
      case 'leadform':
        if (field === 'form') {
          if (!facebookPageId) return { options: ['No Facebook Page configured in settings'], loading: false };
          const formOpts = leadFormsData?.forms?.map((f: { id: string; name: string }) => `${f.id}|${f.name}`) || [];
          return { options: ['Select a lead form', ...formOpts], loading: leadFormsLoading };
        }
        break;
      case 'events':
        if (field === 'event') {
          if (!facebookPageId) return { options: ['All events'], loading: false };
          const eventOpts = eventsData?.events?.map((e: { id: string; name: string }) => `${e.id}|${e.name}`) || [];
          return { options: ['All events', ...eventOpts], loading: eventsLoading };
        }
        break;
      case 'instant_exp':
        if (field === 'experience') {
          if (!facebookPageId) return { options: ['No Facebook Page configured in settings'], loading: false };
          const expOpts = instantExpData?.experiences?.map((e: { id: string; name: string }) => `${e.id}|${e.name}`) || [];
          return { options: ['Select an Instant Experience', ...expOpts], loading: instantExpLoading };
        }
        break;
      case 'facebook_page':
        if (field === 'page') {
          if (!facebookPageId) return { options: ['No Facebook Page configured in settings'], loading: false };
          return { options: [`${facebookPageId}|Session Facebook Page`], loading: false };
        }
        break;
      case 'catalog':
      case 'shopping':
        if (field === 'catalog' || field === 'shop') {
          const catOpts = catalogsData?.catalogs?.map((c: { id: string; name: string }) => `${c.id}|${c.name}`) || [];
          return { options: ['Select a catalog', ...catOpts], loading: catalogsLoading };
        }
        break;
      case 'app':
        if (field === 'app') {
          const appOpts = customConversionsData?.events?.map((e: string) => e) || [];
          return { options: ['Select an App', ...appOpts], loading: customConversionsLoading };
        }
        break;
    }
    return { options: [], loading: false };
  };

  // ── Static source configs with dynamic overrides ──
  const SOURCE_CONFIG: Record<string, { title: string; sections: Array<{ label: string; type: string; field: string; placeholder?: string; options?: string[] | { value: string; label: string }[]; ruleTypes?: string[]; min?: number; max?: number; defaultVal?: number; unit?: string; hint?: string; dynamic?: boolean }> }> = {
    website: {
      title: 'Website Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Website Visitors – Last 30 Days' },
        { label: 'Pixel', type: 'select', field: 'pixel', dynamic: true },
        { label: 'Include people who', type: 'rule_group', field: 'rules', ruleTypes: ['All website visitors', 'People who visited specific web pages', 'Visitors by time spent', 'From your events', 'People who completed a purchase', 'People who added to cart', 'People who initiated checkout', 'People who registered', 'People who searched', 'People who viewed content'] },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days', hint: 'Include people who matched the criteria within the last N days.' },
      ],
    },
    video: {
      title: 'Video Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. 75% Video Viewers' },
        { label: 'Engagement', type: 'select', field: 'engagement', options: ['People who watched at least 3 seconds', 'People who watched at least 10 seconds', 'People who watched 25% of your video', 'People who watched 50% of your video', 'People who watched 75% of your video', 'People who watched 95% of your video', 'People who watched ThruPlay'] },
        { label: 'Videos', type: 'video_picker', field: 'videos' },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 60, unit: 'days' },
      ],
    },
    leadform: {
      title: 'Lead Form Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Lead Form Openers' },
        { label: 'Engagement Type', type: 'radio', field: 'engagement', options: [{ value: 'opened', label: 'People who opened the form' }, { value: 'opened_not_submitted', label: "People who opened but didn't submit" }, { value: 'submitted', label: 'People who submitted the form' }] },
        { label: 'Lead Form', type: 'select', field: 'form', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 90, defaultVal: 30, unit: 'days' },
      ],
    },
    instagram: {
      title: 'Instagram Account Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. IG Profile Visitors' },
        { label: 'Engagement', type: 'radio', field: 'engagement', options: [{ value: 'all', label: 'Everyone who engaged with your professional account' }, { value: 'visited', label: 'Anyone who visited your profile' }, { value: 'post_cta', label: 'People who engaged with any post or ad' }, { value: 'messaged', label: 'People who sent a message to your account' }, { value: 'saved', label: 'People who saved any post or ad' }] },
        { label: 'Account', type: 'select', field: 'account', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 60, unit: 'days' },
      ],
    },
    facebook_page: {
      title: 'Facebook Page Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Page Engagers – 90 Days' },
        { label: 'Engagement', type: 'radio', field: 'engagement', options: [{ value: 'all', label: 'Everyone who engaged with your Page' }, { value: 'visited', label: 'Anyone who visited your Page' }, { value: 'post', label: 'People who engaged with any post or ad' }, { value: 'cta', label: 'People who clicked any call-to-action button' }, { value: 'messaged', label: 'People who sent a message to your Page' }, { value: 'saved', label: 'People who saved your Page or any post' }] },
        { label: 'Facebook Page', type: 'select', field: 'page', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 90, unit: 'days' },
      ],
    },
    customer_list: {
      title: 'Customer List Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. CRM Upload – Q4 Buyers' },
        { label: 'List Type', type: 'radio', field: 'listType', options: [{ value: 'customer_file', label: 'Upload a file that includes customer value' }, { value: 'mailchimp', label: 'Import from Mailchimp' }, { value: 'crm', label: 'Import from CRM' }] },
        { label: 'Data Format', type: 'select', field: 'format', options: ['CSV or TXT file', 'Hashed CSV', 'Email addresses only', 'Phone numbers only', 'Mixed identifiers'] },
        { label: 'Upload File', type: 'file_upload', field: 'file', hint: 'Your file should include at least one identifier: email, phone, name, or address.' },
      ],
    },
    offline: {
      title: 'Offline Activity Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. In-Store Purchasers' },
        { label: 'Offline Event Set', type: 'select', field: 'event_set', options: ['Select an event set', 'In-Store Purchases', 'Call Center Leads', 'POS Transactions'] },
        { label: 'Event', type: 'radio', field: 'engagement', options: [{ value: 'purchase', label: 'Purchase' }, { value: 'lead', label: 'Lead' }, { value: 'other', label: 'Other offline event' }] },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
      ],
    },
    shopping: {
      title: 'Shopping Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Shop Visitors – 30 Days' },
        { label: 'Engagement', type: 'radio', field: 'engagement', options: [{ value: 'all', label: 'Everyone who visited your shop' }, { value: 'viewed', label: 'People who viewed a product' }, { value: 'added', label: 'People who added a product to cart' }, { value: 'purchased', label: 'People who purchased a product' }, { value: 'saved', label: 'People who saved a product' }] },
        { label: 'Shop / Catalog', type: 'select', field: 'shop', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
      ],
    },
    app: {
      title: 'App Activity Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. App Purchasers – 30 Days' },
        { label: 'App', type: 'select', field: 'app', dynamic: true },
        { label: 'Activity', type: 'rule_group', field: 'rules', ruleTypes: ['All app users', 'Most active users by percentile', 'Users by purchase amount', 'Users who completed a specific event', 'Users who opened the app', 'Users who installed the app', 'Users who made an in-app purchase'] },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
      ],
    },
    catalog: {
      title: 'Catalog Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Product Viewers' },
        { label: 'Catalog', type: 'select', field: 'catalog', dynamic: true },
        { label: 'Interaction', type: 'radio', field: 'engagement', options: [{ value: 'viewed', label: 'People who viewed items' }, { value: 'added', label: 'People who added items to cart' }, { value: 'purchased', label: 'People who purchased items' }, { value: 'viewed_not_purchased', label: 'Viewed but not purchased' }] },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
      ],
    },
    events: {
      title: 'Facebook Events Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Event Responders' },
        { label: 'Engagement', type: 'radio', field: 'engagement', options: [{ value: 'all', label: 'People who interacted with any event' }, { value: 'responded_going', label: 'People who responded Going' }, { value: 'responded_interested', label: 'People who responded Interested' }, { value: 'visited', label: 'People who visited event page' }, { value: 'purchased_ticket', label: 'People who purchased a ticket' }] },
        { label: 'Event', type: 'select', field: 'event', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 90, unit: 'days' },
      ],
    },
    instant_exp: {
      title: 'Instant Experience Custom Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Canvas Engagers – 30 Days' },
        { label: 'Engagement', type: 'radio', field: 'engagement', options: [{ value: 'opened', label: 'People who opened your Instant Experience' }, { value: 'clicked', label: 'People who clicked any link in your Instant Experience' }] },
        { label: 'Instant Experience', type: 'select', field: 'experience', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
      ],
    },
    on_facebook: {
      title: 'On-Facebook Listings Audience', sections: [
        { label: 'Audience Name', type: 'text', field: 'name', placeholder: 'e.g. Rental Listing Viewers' },
        { label: 'Listing Type', type: 'radio', field: 'listingType', options: [{ value: 'rental', label: 'Rental property listings' }, { value: 'vehicle', label: 'Vehicle listings' }] },
        { label: 'Engagement', type: 'radio', field: 'engagement', options: [{ value: 'viewed', label: 'People who viewed your listings' }, { value: 'inquired', label: 'People who sent an inquiry' }, { value: 'saved', label: 'People who saved your listings' }] },
        { label: 'Facebook Page', type: 'select', field: 'page', dynamic: true },
        { label: 'Retention', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
      ],
    },
  };

  const config = SOURCE_CONFIG[source.id];

  const createMutation = trpc.adminMeta.createCustomAudience.useMutation({
    onSuccess: (data) => {
      setSaved(true);
      setTimeout(() => onCreated({ id: data.audienceId, name: data.name }), 1800);
    },
    onError: (err) => toast.error(`Failed to create audience: ${err.message}`),
  });

  const name = (form.name as string) || '';
  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({
      accessToken, adAccountId,
      name: name.trim(),
      subtype: 'CUSTOM',
      retentionDays: (form.retention as number) || 30,
    });
  };

  if (!config) return null;

  const renderSection = (section: typeof config.sections[0], i: number) => {
    const val = form[section.field];
    const set = (v: unknown) => setForm(s => ({ ...s, [section.field]: v }));

    if (section.type === 'text') {
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          <TxtInput value={(val as string) || ''} onChange={set} placeholder={section.placeholder} />
        </div>
      );
    }

    if (section.type === 'select') {
      let opts: string[];
      let loading = false;
      if (section.dynamic) {
        const dyn = getDynamicOptions(source.id, section.field);
        opts = dyn.options;
        loading = dyn.loading;
      } else {
        opts = (section.options as string[]) || [];
      }
      const strVal = (val as string) || (opts[0] || '');
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          <SelInput value={strVal} onChange={set} options={opts.length ? opts : ['Loading...']} loading={loading} />
        </div>
      );
    }

    if (section.type === 'radio') {
      const radioOptions = section.options as { value: string; label: string }[];
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          <RadioGrp options={radioOptions} value={(val as string) || (radioOptions[0]?.value || '')} onChange={set} />
        </div>
      );
    }

    if (section.type === 'slider') {
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          <SliderInput value={(val as number) ?? (section.defaultVal ?? section.min ?? 1)} onChange={set} min={section.min ?? 1} max={section.max ?? 180} unit={section.unit || 'days'} />
        </div>
      );
    }

    if (section.type === 'rule_group') {
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          <RuleGroup value={val as { type: string }[] | undefined} onChange={set} ruleTypes={section.ruleTypes || []} />
        </div>
      );
    }

    if (section.type === 'file_upload') {
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          <FileUpload onChange={set} hint={section.hint} />
        </div>
      );
    }

    if (section.type === 'video_picker') {
      const pickedVideos = selectedVideos;
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label hint={section.hint}>{section.label}</Label>
          {pickedVideos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {pickedVideos.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 5px', borderRadius: 20, background: T.purpleDim, border: `1px solid rgba(167,139,250,0.35)`, fontFamily: T.font, fontSize: 11, color: T.purple, maxWidth: 200 }}>
                  {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || v.id}</span>
                  <button onClick={() => {
                    const next = pickedVideos.filter(x => x.id !== v.id);
                    setSelectedVideos(next);
                    set(next.map(x => x.id).join(','));
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textLo, fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowVideoSelector(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.borderMid}`, background: T.surface2, cursor: 'pointer', fontFamily: T.font, fontSize: 12, fontWeight: 600, color: pickedVideos.length > 0 ? T.purple : T.textMid, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.purple; (e.currentTarget as HTMLButtonElement).style.color = T.purple; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.borderMid; (e.currentTarget as HTMLButtonElement).style.color = pickedVideos.length > 0 ? T.purple : T.textMid; }}
          >
            <span style={{ fontSize: 14 }}>🎬</span>
            {pickedVideos.length > 0 ? `${pickedVideos.length} video${pickedVideos.length > 1 ? 's' : ''} selected — Change` : 'Select Videos'}
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 3 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: source.color, border: `1px solid ${source.accent}44`, flexShrink: 0 }}>{source.emoji}</div>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 800, color: T.textHi }}>{config.title}</div>
            <div style={{ fontFamily: T.font, fontSize: 11, color: T.textMid }}>{source.sub}</div>
          </div>
        </div>
      </div>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
        {saved ? <SuccessScreen title="Custom Audience Created!" subtitle="Your audience is being populated. It may take up to 24 hours to be ready for use in campaigns." /> :
          config.sections.map((section, i) => renderSection(section, i))}
      </div>
      {!saved && (
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <Btn variant="secondary" onClick={onBack}>Back</Btn>
          <Btn onClick={handleCreate} disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending ? '⏳ Creating...' : 'Create Audience'}
          </Btn>
        </div>
      )}
      {showVideoSelector && (
        <VideoSelectorModal
          accessToken={accessToken}
          adAccountId={adAccountId}
          facebookPageId={facebookPageId}
          instagramUserId={instagramUserId}
          initialSelected={selectedVideos.map(v => v.id)}
          onConfirm={(videos) => {
            setSelectedVideos(videos);
            setForm(s => ({ ...s, videos: videos.map(v => v.id).join(',') }));
            setShowVideoSelector(false);
          }}
          onClose={() => setShowVideoSelector(false)}
        />
      )}
    </div>
  );
}
// ─── Screen: LAL Builder ───────────────────────────────────────────────────────
const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Brazil', 'Japan', 'India', 'Mexico', 'Spain', 'Italy', 'Netherlands', 'South Korea', 'Singapore', 'United Arab Emirates', 'South Africa'];
const COUNTRY_CODES: Record<string, string> = { 'United States': 'US', 'United Kingdom': 'GB', 'Canada': 'CA', 'Australia': 'AU', 'Germany': 'DE', 'France': 'FR', 'Brazil': 'BR', 'Japan': 'JP', 'India': 'IN', 'Mexico': 'MX', 'Spain': 'ES', 'Italy': 'IT', 'Netherlands': 'NL', 'South Korea': 'KR', 'Singapore': 'SG', 'United Arab Emirates': 'AE', 'South Africa': 'ZA' };

function LALBuilder({ onBack, onCreated, accessToken, adAccountId }: {
  onBack: () => void; onCreated: (a: { id: string; name: string }) => void;
  accessToken: string; adAccountId: string;
}) {
  const [source, setSource] = useState('');
  const [country, setCountry] = useState('United States');
  const [size, setSize] = useState(2);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: audiencesData } = trpc.adminMeta.getCustomAudiences.useQuery(
    { accessToken, adAccountId },
    { enabled: !!accessToken && !!adAccountId, staleTime: 5 * 60 * 1000 }
  );
  const existingAudiences = audiencesData?.audiences ?? [];
  const seedOptions = ['Select a source audience', ...existingAudiences.filter((a: { subtype?: string }) => a.subtype !== 'LOOKALIKE').map((a: { id: string; name: string }) => a.name)];

  const createMutation = trpc.adminMeta.createLookalikeAudience.useMutation({
    onSuccess: (data) => {
      setSaved(true);
      setTimeout(() => onCreated({ id: data.audienceId, name: data.name }), 1800);
    },
    onError: (err) => toast.error(`Failed to create lookalike: ${err.message}`),
  });

  const complete = source && source !== seedOptions[0] && name.trim();
  const handleCreate = () => {
    if (!complete) return;
    const srcAud = existingAudiences.find((a: { name: string }) => a.name === source);
    createMutation.mutate({
      accessToken, adAccountId,
      name: name.trim(),
      originAudienceId: srcAud?.id || '',
      country: COUNTRY_CODES[country] || 'US',
      ratio: size / 100,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 3 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.cyanDim, border: `1px solid ${T.borderHi}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🔍</div>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 17, fontWeight: 800, color: T.textHi }}>Lookalike Audience</div>
            <div style={{ fontFamily: T.font, fontSize: 12, color: T.textMid }}>Find new people similar to your best customers</div>
          </div>
        </div>
      </div>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
        {saved ? <SuccessScreen title="Lookalike Audience Created!" subtitle="Meta is building your audience. This typically takes 1–6 hours." /> : (
          <>
            <div style={{ marginBottom: 18 }}>
              <Label>Source Audience</Label>
              <SelInput value={source || seedOptions[0]} onChange={setSource} options={seedOptions} />
              {source && source !== seedOptions[0] && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: T.cyanDim, border: `1px solid ${T.borderHi}`, fontFamily: T.font, fontSize: 12, color: T.textMid, display: 'flex', gap: 6 }}>
                  <span>ℹ️</span><span>Source needs at least <strong style={{ color: T.textHi }}>100 people</strong> in the target country.</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 18 }}>
              <Label>Audience Location</Label>
              <SelInput value={country} onChange={setCountry} options={COUNTRIES} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <Label hint="1% = most similar. 10% = larger, less similar.">Audience Size</Label>
              <SliderInput value={size} onChange={setSize} min={1} max={10} unit="%" />
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                {['1%', '2%', '5%', '10%'].map(pct => {
                  const v = parseInt(pct);
                  const active = size === v;
                  return (
                    <button key={pct} onClick={() => setSize(v)} style={{ flex: 1, fontFamily: T.font, fontSize: 12, fontWeight: 600, padding: '5px 4px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${active ? T.cyan : T.border}`, background: active ? T.cyanDim : T.surface2, color: active ? T.cyan : T.textMid, transition: 'all 0.14s ease' }}>{pct}</button>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 8, background: T.surface2, fontFamily: T.font, fontSize: 12, color: T.textMid }}>
                Estimated reach: <strong style={{ color: T.cyan }}>{(size * 1.8).toFixed(1)}M – {(size * 2.4).toFixed(1)}M people</strong> in {country}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <Label>Audience Name</Label>
              <TxtInput value={name} onChange={setName} placeholder={`e.g. Lookalike (${country}, ${size}%) – Source`} />
            </div>
          </>
        )}
      </div>
      {!saved && (
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <Btn variant="secondary" onClick={onBack}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={createMutation.isPending || !complete}>
            {createMutation.isPending ? '⏳ Creating...' : 'Create Lookalike Audience'}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── Screen: Quick Build (FULLY WIRED) ───────────────────────────────────────
type QBOption = {
  id: string; label: string; icon: string; desc: string;
  fields: Array<{ label: string; type: string; field: string; min?: number; max?: number; defaultVal?: number; unit?: string; placeholder?: string; options?: string[] | { value: string; label: string }[]; dynamic?: boolean }>;
  buildName: (f: Record<string, unknown>) => string;
};

const QUICK_BUILD_OPTIONS: QBOption[] = [
  { id: 'all_visitors', label: 'All Website Visitors', icon: '🌐', desc: 'Everyone who visited your website', fields: [{ label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - All Visitors (${f.retention || 30} Days)` },
  { id: 'page_visitors', label: 'Specific Page Visitors', icon: '📄', desc: 'People who visited a specific URL', fields: [{ label: 'URL Contains', type: 'text', field: 'url', placeholder: 'e.g. /pricing or /checkout' }, { label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - Page Visitors${f.url ? ` - ${f.url}` : ''} (${f.retention || 30} Days)` },
  { id: 'purchase_event', label: 'Standard Event: Purchase', icon: '💳', desc: 'People who fired the Purchase pixel event', fields: [{ label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - Event - Purchase (${f.retention || 30} Days)` },
  { id: 'add_to_cart', label: 'Standard Event: Add to Cart', icon: '🛒', desc: 'People who added an item to cart', fields: [{ label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - Event - Add to Cart (${f.retention || 30} Days)` },
  { id: 'lead_event', label: 'Standard Event: Lead', icon: '📋', desc: 'People who completed a Lead event', fields: [{ label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - Event - Lead (${f.retention || 30} Days)` },
  { id: 'initiate_checkout', label: 'Standard Event: Initiate Checkout', icon: '🏁', desc: 'People who started the checkout process', fields: [{ label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - Event - Initiate Checkout (${f.retention || 30} Days)` },
  {
    id: 'custom_conversion', label: 'Custom Conversion Event', icon: '⚙️', desc: 'People who fired a specific custom conversion',
    fields: [
      { label: 'Custom Conversion', type: 'select', field: 'conversion', dynamic: true },
      { label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' },
    ],
    buildName: (f) => { const conv = f.conversion && !(f.conversion as string).startsWith('Select') ? f.conversion as string : 'Custom Event'; return `Website - Event - ${conv} (${f.retention || 30} Days)`; },
  },
  { id: 'top_visitors', label: 'Top 25% Time Spent', icon: '⏱️', desc: 'Your most engaged website visitors by time on site', fields: [{ label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 180, defaultVal: 30, unit: 'days' }], buildName: (f) => `Website - Top 25% Time Spent (${f.retention || 30} Days)` },
  {
    id: 'video_viewers', label: 'Video Viewers (75%+)', icon: '🎬', desc: 'People who watched 75% or more of your videos',
    fields: [
      { label: 'View Threshold', type: 'radio', field: 'threshold', options: [{ value: '25', label: '25% watched' }, { value: '50', label: '50% watched' }, { value: '75', label: '75% watched' }, { value: '95', label: '95% watched' }, { value: 'thruplay', label: 'ThruPlay' }] },
      { label: 'Videos', type: 'video_picker', field: 'videos' },
      { label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 60, unit: 'days' },
    ],
    buildName: (f) => `Video - ${f.threshold ? (f.threshold === 'thruplay' ? 'ThruPlay' : f.threshold + '% Viewers') : '75% Viewers'} (${f.retention || 60} Days)`,
  },
  {
    id: 'ig_engagers', label: 'Instagram Engagers', icon: '📸', desc: 'People who engaged with your Instagram account',
    fields: [
      { label: 'Engagement Type', type: 'radio', field: 'engagement', options: [{ value: 'all', label: 'All engagement' }, { value: 'visited', label: 'Profile visitors' }, { value: 'post', label: 'Post/ad engagers' }, { value: 'messaged', label: 'Messaged your account' }] },
      { label: 'Instagram Account', type: 'select', field: 'ig_account', dynamic: true },
      { label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 60, unit: 'days' },
    ],
    buildName: (f) => { const lbl: Record<string, string> = { all: 'All Engagers', visited: 'Profile Visitors', post: 'Post Engagers', messaged: 'DM Senders' }; return `Instagram - ${lbl[f.engagement as string] || 'All Engagers'} (${f.retention || 60} Days)`; },
  },
  {
    id: 'fb_page_engagers', label: 'Facebook Page Engagers', icon: '👍', desc: 'People who engaged with your Facebook Page',
    fields: [
      { label: 'Engagement Type', type: 'radio', field: 'engagement', options: [{ value: 'all', label: 'All engagement' }, { value: 'visited', label: 'Page visitors' }, { value: 'post', label: 'Post/ad engagers' }, { value: 'cta', label: 'CTA button clicks' }] },
      { label: 'Facebook Page', type: 'select', field: 'fb_page', dynamic: true },
      { label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 365, defaultVal: 90, unit: 'days' },
    ],
    buildName: (f) => { const lbl: Record<string, string> = { all: 'All Engagers', visited: 'Page Visitors', post: 'Post Engagers', cta: 'CTA Clickers' }; return `Facebook Page - ${lbl[f.engagement as string] || 'All Engagers'} (${f.retention || 90} Days)`; },
  },
  {
    id: 'lead_form_submitters', label: 'Lead Form Submitters', icon: '📝', desc: 'People who submitted an Instant Form',
    fields: [
      { label: 'Lead Form', type: 'select', field: 'form', dynamic: true },
      { label: 'Retention Window', type: 'slider', field: 'retention', min: 1, max: 90, defaultVal: 30, unit: 'days' },
    ],
    buildName: (f) => `Lead Form - Submitted${f.form && !(f.form as string).startsWith('Select') && !(f.form as string).startsWith('All') ? ` - ${(f.form as string).split('|')[1] || f.form}` : ''} (${f.retention || 30} Days)`,
  },
];

function QuickBuild({ onBack, onCreated, accessToken, adAccountId, pixelId, facebookPageId, instagramUserId }: {
  onBack: () => void; onCreated: (a: { id: string; name: string }) => void;
  accessToken: string; adAccountId: string;
  pixelId?: string; facebookPageId?: string; instagramUserId?: string;
}) {
  const [step, setStep] = useState<'pick' | 'config'>('pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<VideoItem[]>([]);

  const option = selectedId ? QUICK_BUILD_OPTIONS.find(o => o.id === selectedId) : null;

  // ── Live data queries for Quick Build templates ──
  const { data: customConversionsData, isLoading: ccLoading } = trpc.adminMeta.getPixelEvents.useQuery(
    { accessToken, pixelId: pixelId || '', adAccountId },
    { enabled: !!accessToken && !!pixelId && selectedId === 'custom_conversion' && step === 'config', staleTime: 5 * 60 * 1000 }
  );

  const { data: videosData, isLoading: videosLoading } = trpc.adminMeta.getAdVideos.useQuery(
    { accessToken, adAccountId },
    { enabled: !!accessToken && !!adAccountId && selectedId === 'video_viewers' && step === 'config', staleTime: 5 * 60 * 1000 }
  );

  const { data: igAccountsData, isLoading: igLoading } = trpc.adminMeta.getPageInstagramAccounts.useQuery(
    { accessToken, pageId: facebookPageId || '' },
    { enabled: !!accessToken && !!facebookPageId && selectedId === 'ig_engagers' && step === 'config', staleTime: 5 * 60 * 1000 }
  );

  const { data: leadFormsData, isLoading: formsLoading } = trpc.adminMeta.getLeadGenForms.useQuery(
    { accessToken, pageId: facebookPageId || '' },
    { enabled: !!accessToken && !!facebookPageId && selectedId === 'lead_form_submitters' && step === 'config', staleTime: 5 * 60 * 1000 }
  );

  // ── Build dynamic options for Quick Build fields ──
  const getQBDynamicOptions = (optId: string, field: string): { options: string[]; loading: boolean } => {
    if (optId === 'custom_conversion' && field === 'conversion') {
      if (!pixelId) return { options: ['No pixel configured in settings'], loading: false };
      const events = customConversionsData?.events || [];
      return { options: ['Select a custom conversion', ...events], loading: ccLoading };
    }
    if (optId === 'video_viewers' && field === 'videos') {
      const videoOpts = videosData?.videos?.map((v: { id: string; title: string }) => `${v.id}|${v.title}`) || [];
      return { options: ['All videos', ...videoOpts], loading: videosLoading };
    }
    if (optId === 'ig_engagers' && field === 'ig_account') {
      if (!facebookPageId) return { options: ['No Facebook Page configured in settings'], loading: false };
      const sessionIG = instagramUserId ? [`${instagramUserId}|Session IG Account`] : [];
      const apiIG = igAccountsData?.accounts?.map((a: { id: string; username: string }) => `${a.id}|@${a.username}`) || [];
      const combined = Array.from(new Set([...sessionIG, ...apiIG]));
      return { options: ['Select Instagram account', ...combined], loading: igLoading };
    }
    if (optId === 'fb_page_engagers' && field === 'fb_page') {
      if (!facebookPageId) return { options: ['No Facebook Page configured in settings'], loading: false };
      return { options: [`${facebookPageId}|Session Facebook Page`], loading: false };
    }
    if (optId === 'lead_form_submitters' && field === 'form') {
      if (!facebookPageId) return { options: ['All lead forms'], loading: false };
      const formOpts = leadFormsData?.forms?.map((f: { id: string; name: string }) => `${f.id}|${f.name}`) || [];
      return { options: ['All lead forms', ...formOpts], loading: formsLoading };
    }
    return { options: [], loading: false };
  };

  // Auto-update name from template when form changes (unless user manually edited)
  useEffect(() => {
    if (option && !nameDirty) setName(option.buildName(form));
  }, [form, option, nameDirty]);

  const createMutation = trpc.adminMeta.createCustomAudience.useMutation({
    onSuccess: (data) => {
      setSaved(true);
      setTimeout(() => onCreated({ id: data.audienceId, name: data.name }), 1800);
    },
    onError: (err) => toast.error(`Failed to create audience: ${err.message}`),
  });

  const pickOption = (id: string) => {
    const opt = QUICK_BUILD_OPTIONS.find(o => o.id === id);
    if (!opt) return;
    const defaults: Record<string, unknown> = {};
    opt.fields.forEach(f => { if (f.type === 'slider') defaults[f.field] = f.defaultVal ?? f.min ?? 1; });
    setForm(defaults);
    setNameDirty(false);
    setName(opt.buildName(defaults));
    setSelectedId(id);
    setStep('config');
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({
      accessToken, adAccountId,
      name: name.trim(),
      subtype: 'CUSTOM',
      retentionDays: (form.retention as number) || 30,
    });
  };

  const renderQBField = (field: QBOption['fields'][0], i: number) => {
    const val = form[field.field];
    const set = (v: unknown) => setForm(s => ({ ...s, [field.field]: v }));

    if (field.type === 'text') {
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label>{field.label}</Label>
          <TxtInput value={(val as string) || ''} onChange={set} placeholder={field.placeholder} />
        </div>
      );
    }
    if (field.type === 'select') {
      let opts: string[];
      let loading = false;
      if (field.dynamic && selectedId) {
        const dyn = getQBDynamicOptions(selectedId, field.field);
        opts = dyn.options;
        loading = dyn.loading;
      } else {
        opts = (field.options as string[]) || [];
      }
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label>{field.label}</Label>
          <SelInput value={(val as string) || (opts[0] || '')} onChange={set} options={opts.length ? opts : ['Loading...']} loading={loading} />
        </div>
      );
    }
    if (field.type === 'radio') {
      const radioOptions = field.options as { value: string; label: string }[];
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label>{field.label}</Label>
          <RadioGrp options={radioOptions} value={(val as string) || (radioOptions[0]?.value || '')} onChange={set} />
        </div>
      );
    }
    if (field.type === 'slider') {
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label>{field.label}</Label>
          <SliderInput value={(val as number) ?? (field.defaultVal ?? field.min ?? 1)} onChange={set} min={field.min ?? 1} max={field.max ?? 180} unit={field.unit || 'days'} />
        </div>
      );
    }
    if (field.type === 'video_picker') {
      const pickedVideos = selectedVideos;
      return (
        <div key={i} style={{ marginBottom: 18 }}>
          <Label>{field.label}</Label>
          {pickedVideos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {pickedVideos.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 5px', borderRadius: 20, background: T.purpleDim, border: `1px solid rgba(167,139,250,0.35)`, fontFamily: T.font, fontSize: 11, color: T.purple, maxWidth: 200 }}>
                  {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title || v.id}</span>
                  <button onClick={() => {
                    const next = pickedVideos.filter(x => x.id !== v.id);
                    setSelectedVideos(next);
                    set(next.map(x => x.id).join(','));
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textLo, fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowVideoSelector(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.borderMid}`, background: T.surface2, cursor: 'pointer', fontFamily: T.font, fontSize: 12, fontWeight: 600, color: pickedVideos.length > 0 ? T.purple : T.textMid, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.purple; (e.currentTarget as HTMLButtonElement).style.color = T.purple; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.borderMid; (e.currentTarget as HTMLButtonElement).style.color = pickedVideos.length > 0 ? T.purple : T.textMid; }}
          >
            <span style={{ fontSize: 14 }}>🎬</span>
            {pickedVideos.length > 0 ? `${pickedVideos.length} video${pickedVideos.length > 1 ? 's' : ''} selected — Change` : 'Select Videos'}
          </button>
        </div>
      );
    }
    return null;
  };

  // ── Pick screen ──
  if (step === 'pick') return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.orangeDim, border: '1px solid rgba(247,144,30,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>⚡</div>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 17, fontWeight: 800, color: T.textHi }}>Quick Build</div>
            <div style={{ fontFamily: T.font, fontSize: 12, color: T.textMid }}>Pre-designed audiences ready in seconds</div>
          </div>
        </div>
      </div>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 22px 16px' }}>
        {QUICK_BUILD_OPTIONS.map(opt => (
          <div key={opt.id} onClick={() => pickOption(opt.id)} onMouseEnter={() => setHover(opt.id)} onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9, border: `1px solid ${hover === opt.id ? T.cyan : T.border}`, background: hover === opt.id ? T.cyanDim : T.surface2, cursor: 'pointer', transition: 'all 0.14s ease', marginBottom: 6, boxShadow: hover === opt.id ? T.shCyan : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: hover === opt.id ? T.cyanDim : T.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 0.14s ease' }}>{opt.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 600, color: hover === opt.id ? T.textHi : T.textMid }}>{opt.label}</div>
              <div style={{ fontFamily: T.font, fontSize: 11, color: T.textLo, marginTop: 1 }}>{opt.desc}</div>
            </div>
            <span style={{ fontFamily: T.font, fontSize: 16, color: hover === opt.id ? T.cyan : T.textLo, transition: 'color 0.14s' }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Config screen ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <BackBtn onClick={() => { setStep('pick'); setSelectedId(null); }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.cyanDim, border: `1px solid ${T.borderHi}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{option?.icon}</div>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 800, color: T.textHi }}>{option?.label}</div>
            <div style={{ fontFamily: T.font, fontSize: 11, color: T.textMid }}>{option?.desc}</div>
          </div>
        </div>
      </div>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
        {saved ? <SuccessScreen title="Audience Created!" subtitle="Your audience is being populated. It may take up to 24 hours to be ready for use in campaigns." /> : (
          <>
            {option?.fields.map((field, i) => renderQBField(field, i))}

            {/* Audience Name with auto-naming template */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <Label>Audience Name</Label>
                {nameDirty && (
                  <button onClick={() => { setNameDirty(false); if (option) setName(option.buildName(form)); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.font, fontSize: 11, color: T.cyan, fontWeight: 600, padding: 0 }}>
                    ↺ Reset to template
                  </button>
                )}
              </div>
              {!nameDirty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, padding: '4px 10px', background: T.greenDim, border: '1px solid rgba(0,212,138,0.25)', borderRadius: 6, width: 'fit-content' }}>
                  <span style={{ fontSize: 11 }}>✨</span>
                  <span style={{ fontFamily: T.font, fontSize: 11, fontWeight: 600, color: T.green }}>Auto-generated from your selections</span>
                </div>
              )}
              <input
                value={name}
                onChange={e => { setName(e.target.value); setNameDirty(true); }}
                placeholder="Audience name"
                style={{ ...inputBase, border: `1px solid ${nameDirty ? T.orange : T.cyan}`, boxShadow: nameDirty ? `0 0 0 3px ${T.orangeDim}` : `0 0 0 3px ${T.cyanDim}` }}
              />
              {nameDirty && <div style={{ fontFamily: T.font, fontSize: 11, color: T.orange, marginTop: 4 }}>✏️ Custom name — template auto-fill paused</div>}
            </div>
          </>
        )}
      </div>
      {!saved && (
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Btn variant="secondary" onClick={() => setStep('pick')}>Back</Btn>
          <Btn onClick={handleCreate} disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending ? '⏳ Creating...' : 'Create Audience'}
          </Btn>
        </div>
      )}
      {showVideoSelector && (
        <VideoSelectorModal
          accessToken={accessToken}
          adAccountId={adAccountId}
          facebookPageId={facebookPageId}
          instagramUserId={instagramUserId}
          initialSelected={selectedVideos.map(v => v.id)}
          onConfirm={(videos) => {
            setSelectedVideos(videos);
            setForm(s => ({ ...s, videos: videos.map(v => v.id).join(',') }));
            setShowVideoSelector(false);
          }}
          onClose={() => setShowVideoSelector(false)}
        />
      )}
    </div>
  );
}
// ─── Main Modall ───────────────────────────────────────────────────────────────
export default function AudienceBuilderModal({ accessToken, adAccountId, pixelId, facebookPageId, instagramUserId, onCreated, onClose }: Props) {
  const [screen, setScreen] = useState<Screen>('type');
  const [selectedSource, setSelectedSource] = useState<SourceDef | null>(null);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: T.overlay, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: T.surface, borderRadius: 16, width: '100%', maxWidth: 510, maxHeight: '92vh', boxShadow: `${T.sh4}, 0 0 0 1px ${T.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', animation: 'abSlideUp 0.22s cubic-bezier(.2,.7,.2,1)' }}>
        {/* Close button */}
        <button onClick={onClose}
          style={{ position: 'absolute', right: 14, top: 14, zIndex: 20, width: 26, height: 26, borderRadius: '50%', border: `1px solid ${T.border}`, background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font, fontSize: 14, color: T.textMid, fontWeight: 700, transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.cyan; (e.currentTarget as HTMLButtonElement).style.color = T.cyan; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border; (e.currentTarget as HTMLButtonElement).style.color = T.textMid; }}>
          ×
        </button>

        {screen === 'type' && (
          <TypeSelector onSelect={t => {
            if (t === 'custom') setScreen('source_picker');
            else if (t === 'lal') setScreen('lal');
            else setScreen('quick');
          }} />
        )}
        {screen === 'source_picker' && (
          <SourcePicker onSelect={src => { setSelectedSource(src); setScreen('custom_config'); }} onBack={() => setScreen('type')} />
        )}
        {screen === 'custom_config' && selectedSource && (
          <CustomConfig
            source={selectedSource}
            onBack={() => setScreen('source_picker')}
            onCreated={onCreated}
            accessToken={accessToken}
            adAccountId={adAccountId}
            pixelId={pixelId}
            facebookPageId={facebookPageId}
            instagramUserId={instagramUserId}
          />
        )}
        {screen === 'lal' && (
          <LALBuilder onBack={() => setScreen('type')} onCreated={onCreated} accessToken={accessToken} adAccountId={adAccountId} />
        )}
        {screen === 'quick' && (
          <QuickBuild
            onBack={() => setScreen('type')}
            onCreated={onCreated}
            accessToken={accessToken}
            adAccountId={adAccountId}
            pixelId={pixelId}
            facebookPageId={facebookPageId}
            instagramUserId={instagramUserId}
          />
        )}
      </div>

      <style>{`
        @keyframes abSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: ${T.cyan}; cursor: pointer; box-shadow: 0 0 8px ${T.cyanGlow}; }
        input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: ${T.cyan}; cursor: pointer; border: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.surface3}; border-radius: 2px; }
        ::placeholder { color: ${T.textLo} !important; }
        select option { background: #1a1860; color: #f0f0ff; }
      `}</style>
    </div>
  );
}

// ─── React import (needed for useRef in FileUpload) ───────────────────────────
import React from 'react';
