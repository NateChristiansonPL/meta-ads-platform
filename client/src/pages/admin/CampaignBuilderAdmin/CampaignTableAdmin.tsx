// CampaignTable — spreadsheet-style bulk-entry table for campaigns
// Status at front as button group (default PAUSED), column resizing, paste support

import { useRef, KeyboardEvent, useState, useCallback } from 'react';
import { Plus, Copy, Trash2, ChevronDown } from 'lucide-react';
import {
  CampaignRow, newCampaign, OBJECTIVES, SPECIAL_AD_CATEGORIES,
} from './campaignStoreAdmin';
import { cn } from '@/lib/utils';

interface Props {
  rows: CampaignRow[];
  onChange: (rows: CampaignRow[]) => void;
}

// Column widths in px — resizable
const DEFAULT_WIDTHS: Record<string, number> = {
  num: 32, status: 110, name: 260, objective: 160, category: 140,
  spendCap: 110, cbo: 60, campaignId: 160, actions: 64,
};

export default function CampaignTable({ rows, onChange }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS);
  const resizingCol = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const set = (idx: number, key: keyof CampaignRow, val: unknown) => {
    onChange(rows.map((r, i) => i === idx ? { ...r, [key]: val } : r));
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

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number, totalCols: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      const nextRow = nextCol < 0 ? rowIdx - 1 : nextCol >= totalCols ? rowIdx + 1 : rowIdx;
      const actualCol = nextCol < 0 ? totalCols - 1 : nextCol >= totalCols ? 0 : nextCol;
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
    const COLS: (keyof CampaignRow)[] = ['status', 'name', 'objective', 'specialAdCategory', 'spendCap'];
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
            <col style={w('category')} />
            <col style={w('spendCap')} />
            <col style={w('cbo')} />
            <col style={w('campaignId')} />
            <col style={w('actions')} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-2 border-b border-border">
              {[
                { key: 'num', label: '#' },
                { key: 'status', label: 'Status', required: true },
                { key: 'name', label: 'Campaign Name', required: true },
                { key: 'objective', label: 'Objective', required: true },
                { key: 'category', label: 'Special Ad Category' },
                { key: 'spendCap', label: 'Spend Cap ($)' },
                { key: 'cbo', label: 'CBO' },
                { key: 'campaignId', label: 'Campaign ID (write-back)', muted: true },
                { key: 'actions', label: '' },
              ].map(col => (
                <th key={col.key} className={cn('relative px-2 py-2 text-left text-[10px] font-700 uppercase tracking-wider border-r border-border last:border-r-0', col.muted ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
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
            {rows.map((row, i) => (
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
                    onKeyDown={e => onKeyDown(e, i, 0, 5)}
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
                      onChange={e => set(i, 'objective', e.target.value as any)}
                      onKeyDown={e => onKeyDown(e, i, 1, 5)}
                      className="cell-input w-full appearance-none pr-6 cursor-pointer"
                    >
                      {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>
                </td>

                {/* Special Ad Category */}
                <td className="p-0 border-r border-border">
                  <div className="relative">
                    <select
                      data-cell={`${i}-2`}
                      value={row.specialAdCategory}
                      onChange={e => set(i, 'specialAdCategory', e.target.value as any)}
                      onKeyDown={e => onKeyDown(e, i, 2, 5)}
                      className="cell-input w-full appearance-none pr-6 cursor-pointer"
                    >
                      {SPECIAL_AD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>
                </td>

                {/* Spend Cap */}
                <td className="p-0 border-r border-border">
                  <input
                    data-cell={`${i}-3`}
                    value={row.spendCap}
                    onChange={e => set(i, 'spendCap', e.target.value)}
                    onKeyDown={e => onKeyDown(e, i, 3, 5)}
                    placeholder="—"
                    type="number"
                    min="0"
                    className="cell-input w-full font-mono"
                  />
                </td>

                {/* CBO */}
                <td className="p-0 border-r border-border text-center">
                  <div className="flex items-center justify-center h-8">
                    <input
                      type="checkbox"
                      checked={row.cbo}
                      onChange={e => set(i, 'cbo', e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-500"
                    />
                  </div>
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
            ))}
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
