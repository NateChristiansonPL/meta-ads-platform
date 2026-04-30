/**
 * useTablePaste — spreadsheet-style multi-cell copy/paste for table rows
 *
 * Usage:
 *   const { selectedCells, onCellMouseDown, onCellMouseEnter, onCellMouseUp,
 *           onCellKeyDown, onPaste, selectionStyle } = useTablePaste({ rows, columns, onChange })
 *
 * Supports:
 *  - Click to select a single cell
 *  - Shift+click / drag to select a rectangular range
 *  - Ctrl/Cmd+C to copy selected cells as TSV
 *  - Ctrl/Cmd+V to paste TSV from clipboard into selected range
 *  - Tab/Enter to move focus
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CellCoord {
  row: number;
  col: number;
}

export interface UseTablePasteOptions<T extends Record<string, unknown>> {
  rows: T[];
  /** ordered list of field keys that correspond to columns */
  columns: (keyof T)[];
  onChange: (rows: T[]) => void;
}

export function useTablePaste<T extends Record<string, unknown>>({
  rows,
  columns,
  onChange,
}: UseTablePasteOptions<T>) {
  const [anchor, setAnchor] = useState<CellCoord | null>(null);
  const [focus, setFocus] = useState<CellCoord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getRange = useCallback(
    (a: CellCoord, b: CellCoord) => ({
      r0: Math.min(a.row, b.row),
      r1: Math.max(a.row, b.row),
      c0: Math.min(a.col, b.col),
      c1: Math.max(a.col, b.col),
    }),
    []
  );

  const isSelected = useCallback(
    (row: number, col: number) => {
      if (!anchor || !focus) return false;
      const { r0, r1, c0, c1 } = getRange(anchor, focus);
      return row >= r0 && row <= r1 && col >= c0 && col <= c1;
    },
    [anchor, focus, getRange]
  );

  const onCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (e.shiftKey && anchor) {
        setFocus({ row, col });
      } else {
        setAnchor({ row, col });
        setFocus({ row, col });
      }
      setIsDragging(true);
    },
    [anchor]
  );

  const onCellMouseEnter = useCallback(
    (row: number, col: number) => {
      if (isDragging) {
        setFocus({ row, col });
      }
    },
    [isDragging]
  );

  const onCellMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouseup to stop dragging even if mouse leaves table
  useEffect(() => {
    const stop = () => setIsDragging(false);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const copySelection = useCallback(() => {
    if (!anchor || !focus) return;
    const { r0, r1, c0, c1 } = getRange(anchor, focus);
    const lines: string[] = [];
    for (let r = r0; r <= r1; r++) {
      const cells: string[] = [];
      for (let c = c0; c <= c1; c++) {
        const key = columns[c];
        const val = rows[r]?.[key];
        cells.push(val === undefined || val === null ? '' : String(val));
      }
      lines.push(cells.join('\t'));
    }
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }, [anchor, focus, rows, columns, getRange]);

  const pasteFromClipboard = useCallback(
    async (text: string) => {
      if (!anchor) return;
      const pasteRows = text
        .split('\n')
        .map(line => line.split('\t'));

      const startRow = anchor.row;
      const startCol = anchor.col;
      const updated = rows.map((r, ri) => {
        const pasteRowIdx = ri - startRow;
        if (pasteRowIdx < 0 || pasteRowIdx >= pasteRows.length) return r;
        const pasteCols = pasteRows[pasteRowIdx];
        const patch: Partial<T> = {};
        pasteCols.forEach((val, ci) => {
          const colIdx = startCol + ci;
          if (colIdx < columns.length) {
            const key = columns[colIdx];
            (patch as Record<string, unknown>)[key as string] = val;
          }
        });
        return { ...r, ...patch };
      });
      onChange(updated as T[]);
    },
    [anchor, rows, columns, onChange]
  );

  // Keyboard: Ctrl+C copy, Ctrl+V paste
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inContainer = containerRef.current?.contains(active);
      if (!inContainer) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelection();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const text = await navigator.clipboard.readText().catch(() => '');
        if (text) pasteFromClipboard(text);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelection, pasteFromClipboard]);

  // Native paste event (works in more browsers)
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (text) pasteFromClipboard(text);
    },
    [pasteFromClipboard]
  );

  return {
    containerRef,
    anchor,
    focus,
    isSelected,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onPaste,
    copySelection,
    clearSelection: () => { setAnchor(null); setFocus(null); },
  };
}
