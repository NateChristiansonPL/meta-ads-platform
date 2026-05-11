// CampaignTable — spreadsheet-style bulk-entry table for campaigns
// Status at front as button group (default PAUSED), column resizing, paste support
// specialAdCategory and cbo are in the Optional Fields popup (not inline columns)

import { useRef, KeyboardEvent, useState, useCallback, useEffect } from 'react';
import { Plus, Copy, Trash2, ChevronDown, SlidersHorizontal, X, Check } from 'lucide-react';
import {
  CampaignRow, newCampaign, OBJECTIVES, SPECIAL_AD_CATEGORIES,
} from './campaignStoreAdmin';
import { cn } from '@/lib/utils';

interface Props {
  rows: CampaignRow[];
  onChange: (rows: CampaignRow[]) => void;
}

// ── Optional Fields popup ─────────────────────────────────────────────────────

const CAMPAIGN_OPT_FIELDS: { key: keyof CampaignRow; label: string; description: string }[] = [
  { key: 'specialAdCategory', label: 'Special Ad Category', description: 'Required for housing, employment, credit, or political ads' },
  { key: 'cbo',               label: 'CBO',                 description: 'Campaign Budget Optimisation — Meta allocates budget across ad sets' },
];

type CampaignOptPopupProps = {
  row: CampaignRow;
  optFields: Set<string>;
  addOptField: (key: string) => void;
  removeOptField: (key: string) => void;
  update: (updates: Partial<CampaignRow>) => void;
  onClose: () => void;
};

function CampaignOptPopup({ row, optFields, addOptField, removeOptField, update, onClose }: CampaignOptPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-[70] top-full right-0 mt-1 rounded-xl shadow-2xl"
      style={{ width: 340, maxHeight: 420, overflowY: 'auto', background: '#0e0d3a', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-[12px] font-700 text-white">Optional Fields</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors"><X size={14} /></button>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Field toggles */}
        <div className="flex flex-wrap gap-1.5">
          {CAMPAIGN_OPT_FIELDS.map(f => {
            const isActive = optFields.has(f.key as string);
            return (
              <button
                key={f.key as string}
                onClick={() => isActive ? removeOptField(f.key as string) : addOptField(f.key as string)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-600 transition-all',
                  isActive
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-transparent border-[rgba(255,255,255,0.12)] text-white/40 hover:text-white/70 hover:border-[rgba(255,255,255,0.25)]'
                )}
              >
                {isActive && <Check size={9} />}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Active field inputs */}
        <div className="space-y-3">
          {optFields.has('specialAdCategory') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Special Ad Category</label>
              <p className="text-[10px] text-white/30 mb-1.5">Required for housing, employment, credit, or political ads. Default: NONE.</p>
              <select
                value={row.specialAdCategory}
                onChange={e => update({ specialAdCategory: e.target.value as CampaignRow['specialAdCategory'] })}
                className="w-full px-2 py-1.5 text-[11px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded text-white"
              >
                {SPECIAL_AD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {optFields.has('cbo') && (
            <div>
              <label className="text-[10px] font-700 text-white/40 tracking-wider uppercase block mb-1">Campaign Budget Optimisation (CBO)</label>
              <p className="text-[10px] text-white/30 mb-1.5">Meta allocates budget across ad sets automatically. Default: off.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update({ cbo: !row.cbo })}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    row.cbo ? 'bg-primary' : 'bg-[rgba(255,255,255,0.12)]'
                  )}
                >
                  <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform', row.cbo ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
                <span className="text-[11px] text-white/60">{row.cbo ? 'On — CBO enabled' : 'Off — standard per-ad-set budgets'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Column widths ─────────────────────────────────────────────────────────────

const DEFAULT_WIDTHS: Record<string, number> = {
  num: 32, status: 110, name: 260, objective: 160,
  spendCap: 110, optFields: 110, campaignId: 160, actions: 64,
};

export default function CampaignTable({ rows, onChange }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS);
  const resizingCol = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Per-row optional fields state: rowId → Set<fieldKey>
  const [activeOptFields, setActiveOptFields] = useState<Record<string, Set<string>>>({});
  const [openOptPopup, setOpenOptPopup] = useState<string | null>(null); // rowId

  const getOptFields = (rowId: string) => activeOptFields[rowId] ?? new Set<string>();

  const addOptField = (rowId: string, key: string) => {
    setActiveOptFields(prev => ({
      ...prev,
      [rowId]: new Set([...Array.from(prev[rowId] ?? []), key]),
    }));
  };

  const removeOptField = (rowId: string, key: string) => {
    setActiveOptFields(prev => {
      const next = new Set(prev[rowId] ?? []);
      next.delete(key);
      return { ...prev, [rowId]: next };
    });
  };

  const set = (idx: number, key: keyof CampaignRow, val: unknown) => {
    onChange(rows.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const update = (idx: number, updates: Partial<CampaignRow>) => {
    onChange(rows.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const addRows = (n = 1) => {
    onChange([...rows, ...Array.from({ length: n }, () => newCampaign({ status: 'PAUSED' }))]);
  };

  const duplicate = (idx: number) => {
    const copy = { ...rows[idx], id: newCampaign().id, name: rows[idx].name + ' (copy)', campaignId: '' };
    const next = [...rows]; next.splice(idx + 1, 0, copy); onChange(next);
  };

  const remove = (idx: number) => {
    if (rows.length === 1) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

  // Total navigable columns: name(0), objective(1), spendCap(2) = 3
  const TOTAL_COLS = 3;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      const nextRow = nextCol < 0 ? rowIdx - 1 : nextCol >= TOTAL_COLS ? rowIdx + 1 : rowIdx;
      const actualCol = nextCol < 0 ? TOTAL_COLS - 1 : nextCol >= TOTAL_COLS ? 0 : nextCol;
      if (nextRow >= rows.length) addRows(1);
      setTimeout(() => {
        tableRef.current?.querySelector<HTMLElement>(`[data-cell="${nextRow}-${actualCol}"]`)?.focus();
      }, 50);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextRow = rowIdx + 1;
      if (nextRow >= rows.length) addRows(1);
      setTimeout(() => {
        tableRef.current?.querySelector<HTMLElement>(`[data-cell="${nextRow}-${colIdx}"]`)?.focus();
      }, 50);
    }
  };

  // Paste handler — paste TSV data from clipboard into table starting at focused cell
  const onPaste = useCallback((e: React.ClipboardEvent<HTMLElement>, rowIdx: number, colIdx: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // single cell, let default handle
    e.preventDefault();
    const pastedRows = text.trim().split('\n').map(r => r.split('\t'));
    const COLS: (keyof CampaignRow)[] = ['status', 'name', 'objective', 'spendCap'];
    const next = [...rows];
    pastedRows.forEach((pastedRow, ri) => {
      const targetRow = rowIdx + ri;
      while (next.length <= targetRow) next.push(newCampaign({ status: 'PAUSED' }));
      pastedRow.forEach((val, ci) => {
        const col = COLS[colIdx + ci];
        if (col) next[targetRow] = { ...next[targetRow], [col]: val.trim() };
      });
    });
    onChange(next);
  }, [rows, onChange]);

  // Column resize handlers
  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingCol.current = { key, startX: e.clientX, startW: colWidths[key] };
    const onMove = (me: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = me.clientX - resizingCol.current.startX;
      setColWidths(prev => ({ ...prev, [resizingCol.current!.key]: Math.max(60, resizingCol.current!.startW + delta) }));
    };
    const onUp = () => { resizingCol.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const w = (key: string) => ({ width: colWidths[key], minWidth: colWidths[key] });

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-1 flex-shrink-0">
        <div>
          <h2 className="text-sm font-700 text-foreground">Campaigns</h2>
          <p className="text-[11px] text-muted-foreground">One row per campaign. Tab to move between cells, Enter to add a row. Paste TSV from spreadsheets.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => addRows(1)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-xs font-600 text-foreground border border-border transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
          <button onClick={() => addRows(5)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-xs font-600 text-foreground border border-border transition-all">
            <Plus className="w-3.5 h-3.5" /> Add 5 Rows
          </button>
        </div>
      </div>

      {/* Table */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={w('num')} />
            <col style={w('status')} />
            <col style={w('name')} />
            <col style={w('objective')} />
            <col style={w('spendCap')} />
            <col style={w('optFields')} />
            <col style={w('campaignId')} />
            <col style={w('actions')} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-2 border-b border-border">
              {[
                { key: 'num',        label: '#' },
                { key: 'status',     label: 'Status',                       required: true },
                { key: 'name',       label: 'Campaign Name',                required: true },
                { key: 'objective',  label: 'Objective',                    required: true },
                { key: 'spendCap',   label: 'Spend Cap ($)' },
                { key: 'optFields',  label: 'Optional Fields' },
                { key: 'campaignId', label: 'Campaign ID (write-back)',      muted: true },
                { key: 'actions',    label: '' },
              ].map(col => (
                <th key={col.key} className={cn('relative px-2 py-2 text-left text-[10px] font-700 uppercase tracking-wider border-r border-border last:border-r-0', (col as any).muted ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
                  {col.label}
                  {(col as any).required && <span className="text-danger ml-0.5">*</span>}
                  {col.key !== 'num' && col.key !== 'actions' && (
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 transition-colors"
                      onMouseDown={e => startResize(col.key, e)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const optFields = getOptFields(row.id);
              const isPopupOpen = openOptPopup === row.id;
              // Compute summary badges for the optional fields button
              const activeSummary: string[] = [];
              if (optFields.has('specialAdCategory') && row.specialAdCategory !== 'NONE') activeSummary.push(row.specialAdCategory);
              if (optFields.has('cbo') && row.cbo) activeSummary.push('CBO');

              return (
                <tr key={row.id} className="border-b border-border group hover:bg-surface-2/40 transition-colors">
                  {/* Row number */}
                  <td className="px-2 py-0 text-center text-[10px] text-muted-foreground font-mono border-r border-border select-none">
                    {i + 1}
                  </td>

                  {/* Status — button group */}
                  <td className="p-1 border-r border-border">
                    <div className="flex gap-1">
                      {(['PAUSED', 'ACTIVE'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => set(i, 'status', s)}
                          className={cn(
                            'flex-1 py-1 rounded text-[10px] font-700 transition-all border',
                            row.status === s
                              ? s === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-surface-2 text-muted-foreground border-border hover:border-primary/40'
                          )}
                        >
                          {s === 'ACTIVE' ? 'Active' : 'Paused'}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* Campaign Name */}
                  <td className="p-0 border-r border-border">
                    <input
                      data-cell={`${i}-0`}
                      value={row.name}
                      onChange={e => set(i, 'name', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 0)}
                      onPaste={e => onPaste(e, i, 0)}
                      placeholder="e.g. Brand — Awareness — Q2 2026"
                      className="cell-input w-full"
                    />
                  </td>

                  {/* Objective */}
                  <td className="p-0 border-r border-border">
                    <div className="relative">
                      <select
                        data-cell={`${i}-1`}
                        value={row.objective}
                        onChange={e => set(i, 'objective', e.target.value as CampaignRow['objective'])}
                        onKeyDown={e => onKeyDown(e, i, 1)}
                        className="cell-input w-full appearance-none pr-6 cursor-pointer"
                      >
                        {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                  </td>

                  {/* Spend Cap */}
                  <td className="p-0 border-r border-border">
                    <input
                      data-cell={`${i}-2`}
                      value={row.spendCap}
                      onChange={e => set(i, 'spendCap', e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, 2)}
                      placeholder="—"
                      type="number"
                      min="0"
                      className="cell-input w-full font-mono"
                    />
                  </td>

                  {/* Optional Fields */}
                  <td className="p-0 border-r border-border relative">
                    <button
                      onClick={() => setOpenOptPopup(isPopupOpen ? null : row.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1.5 w-full text-left hover:bg-surface-2/60 transition-colors',
                        isPopupOpen && 'text-primary'
                      )}
                    >
                      <SlidersHorizontal size={11} className={optFields.size > 0 ? 'text-primary' : 'text-muted-foreground/40'} />
                      <span className={cn('text-[11px] truncate', optFields.size > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
                        {activeSummary.length > 0 ? activeSummary.join(', ') : optFields.size > 0 ? `${optFields.size} active` : 'Add…'}
                      </span>
                      <ChevronDown size={10} className={cn('ml-auto flex-shrink-0 transition-transform', isPopupOpen && 'rotate-180 text-primary')} />
                    </button>
                    {isPopupOpen && (
                      <CampaignOptPopup
                        row={row}
                        optFields={optFields}
                        addOptField={key => addOptField(row.id, key)}
                        removeOptField={key => removeOptField(row.id, key)}
                        update={updates => update(i, updates)}
                        onClose={() => setOpenOptPopup(null)}
                      />
                    )}
                  </td>

                  {/* Campaign ID write-back */}
                  <td className="p-0 border-r border-border">
                    <input
                      value={row.campaignId}
                      onChange={e => set(i, 'campaignId', e.target.value)}
                      placeholder="auto-populated"
                      className="cell-input w-full font-mono text-emerald-400/80 placeholder:text-muted-foreground/40"
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-1 py-0">
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => duplicate(i)} title="Duplicate row" className="p-1 rounded hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={() => remove(i)} title="Delete row" disabled={rows.length === 1} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row footer */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-surface-1 sticky bottom-0">
          <button onClick={() => addRows(1)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Add row
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button onClick={() => addRows(5)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Add 5 rows
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">{rows.filter(r => r.name.trim()).length} / {rows.length} rows filled</span>
        </div>
      </div>
    </div>
  );
}
