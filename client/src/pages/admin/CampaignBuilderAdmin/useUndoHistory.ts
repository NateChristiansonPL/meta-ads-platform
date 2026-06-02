/**
 * useUndoHistory — Maintains a stack of state snapshots for undo functionality.
 * Captures state snapshots on meaningful changes (debounced) and provides
 * an undo function to revert to the previous snapshot.
 *
 * Works at the CampaignBuilderState level so it covers all tabs.
 */

import { useRef, useCallback } from "react";
import { CampaignBuilderState } from "./campaignStoreAdmin";

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 800;

export function useUndoHistory(
  state: CampaignBuilderState,
  setState: React.Dispatch<React.SetStateAction<CampaignBuilderState>>
) {
  const historyRef = useRef<string[]>([]);
  const lastPushRef = useRef<number>(0);
  const isUndoingRef = useRef(false);

  // Push a snapshot onto the history stack (debounced externally)
  const pushSnapshot = useCallback(() => {
    if (isUndoingRef.current) return;
    const snapshot = JSON.stringify(state);
    const stack = historyRef.current;

    // Don't push if identical to the last snapshot
    if (stack.length > 0 && stack[stack.length - 1] === snapshot) return;

    stack.push(snapshot);
    if (stack.length > MAX_HISTORY) {
      stack.shift();
    }
    lastPushRef.current = Date.now();
  }, [state]);

  // Capture the current state before a change is made
  const captureBeforeChange = useCallback(() => {
    const now = Date.now();
    // Only capture if enough time has passed since last push (debounce)
    if (now - lastPushRef.current < DEBOUNCE_MS) return;
    pushSnapshot();
  }, [pushSnapshot]);

  // Undo: pop the last snapshot and restore it
  const undo = useCallback(() => {
    const stack = historyRef.current;
    if (stack.length === 0) return false;

    // First, push current state so we can redo if needed (optional future feature)
    const popped = stack.pop();
    if (!popped) return false;

    isUndoingRef.current = true;
    try {
      const restored = JSON.parse(popped) as CampaignBuilderState;
      setState(restored);
    } catch {
      // If parsing fails, just skip
      isUndoingRef.current = false;
      return false;
    }

    // Reset the flag after a tick to allow normal state flow to resume
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);

    return true;
  }, [setState]);

  const canUndo = historyRef.current.length > 0;

  return { captureBeforeChange, undo, canUndo, pushSnapshot };
}
