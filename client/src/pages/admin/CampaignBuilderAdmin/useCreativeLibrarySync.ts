/**
 * useCreativeLibrarySync — Auto-saves creative library to DB per ad account,
 * and auto-loads when the ad account changes.
 *
 * - Debounced save (1.5s after last change)
 * - Tracks which rows have been deleted to sync deletions
 * - Loads from DB when adAccountId changes
 */

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { CreativeRow } from "./campaignStoreAdmin";

interface UseCreativeLibrarySyncOptions {
  adAccountId: string;
  creatives: CreativeRow[];
  carouselCreatives: CreativeRow[];
  onLoad: (creatives: CreativeRow[], carouselCreatives: CreativeRow[]) => void;
}

export function useCreativeLibrarySync({
  adAccountId,
  creatives,
  carouselCreatives,
  onLoad,
}: UseCreativeLibrarySyncOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAccountRef = useRef<string>("");
  const isLoadingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // tRPC mutations
  const upsertBatch = trpc.creativeLibrary.upsertBatch.useMutation();
  const deleteRows = trpc.creativeLibrary.deleteRows.useMutation();

  // Track previous row IDs to detect deletions
  const prevRowIdsRef = useRef<Set<string>>(new Set());

  // ── Auto-load when ad account changes ──────────────────────────────────────
  const { data: savedRows, refetch } = trpc.creativeLibrary.getByAccount.useQuery(
    { adAccountId },
    { enabled: !!adAccountId, staleTime: 60_000 }
  );

  useEffect(() => {
    if (!adAccountId) return;
    if (adAccountId === prevAccountRef.current && initialLoadDoneRef.current) return;

    prevAccountRef.current = adAccountId;

    if (savedRows && savedRows.length > 0) {
      isLoadingRef.current = true;

      const loadedCreatives: CreativeRow[] = [];
      const loadedCarousels: CreativeRow[] = [];

      for (const row of savedRows) {
        try {
          const parsed = JSON.parse(row.rowData) as CreativeRow;
          // Ensure the row ID matches
          parsed.id = row.rowId;
          if (parsed.adType === "carousel") {
            loadedCarousels.push(parsed);
          } else {
            loadedCreatives.push(parsed);
          }
        } catch {
          // Skip malformed rows
        }
      }

      onLoad(loadedCreatives, loadedCarousels);

      // Update tracked IDs
      const allIds = new Set([...loadedCreatives.map(c => c.id), ...loadedCarousels.map(c => c.id)]);
      prevRowIdsRef.current = allIds;

      initialLoadDoneRef.current = true;

      // Small delay to prevent immediate re-save
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 500);
    } else if (savedRows && savedRows.length === 0) {
      initialLoadDoneRef.current = true;
      isLoadingRef.current = false;
    }
  }, [adAccountId, savedRows, onLoad]);

  // ── Auto-save with debounce ────────────────────────────────────────────────
  const saveToDb = useCallback(() => {
    if (!adAccountId || isLoadingRef.current || !initialLoadDoneRef.current) return;

    const allRows = [...creatives, ...carouselCreatives];
    const currentIds = new Set(allRows.map(r => r.id));

    // Detect deleted rows
    const deletedIds = Array.from(prevRowIdsRef.current).filter(id => !currentIds.has(id));

    // Upsert all current rows (only those with meaningful content)
    const rowsToSave = allRows
      .filter(r => r.concept || r.creativeId || r.primaryTexts.some(t => t) || r.carouselCards.length > 0)
      .map(r => ({
        rowId: r.id,
        creativeId: r.creativeId || "",
        adType: r.adType,
        rowData: JSON.stringify(r),
      }));

    if (rowsToSave.length > 0) {
      upsertBatch.mutate({ adAccountId, rows: rowsToSave });
    }

    if (deletedIds.length > 0) {
      deleteRows.mutate({ adAccountId, rowIds: deletedIds });
    }

    // Update tracked IDs
    prevRowIdsRef.current = currentIds;
  }, [adAccountId, creatives, carouselCreatives, upsertBatch, deleteRows]);

  // Debounced trigger on creative changes
  useEffect(() => {
    if (!adAccountId || isLoadingRef.current || !initialLoadDoneRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveToDb();
    }, 1500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [creatives, carouselCreatives, saveToDb]);

  // ── Manual refetch (e.g., after switching accounts) ────────────────────────
  const reload = useCallback(() => {
    initialLoadDoneRef.current = false;
    refetch();
  }, [refetch]);

  return { reload, isSaving: upsertBatch.isPending || deleteRows.isPending };
}
