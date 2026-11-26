import { TFile } from "obsidian";
import { useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Shared virtualizer setup for the single-column and masonry layouts.
// Every rendered card hosts a full Markdown editor, so overscan is kept small.
export const useFeedVirtualizer = (
  entries: TFile[],
  scrollElement: HTMLElement,
  overscan: number,
) => {
  const getScrollEl = useMemo(() => () => scrollElement, [scrollElement]);

  // Key rows by file path so a card (and its editor) survives notes being
  // inserted or reordered above it, and cached heights follow the note.
  const getItemKey = useCallback(
    (index: number) => entries[index]?.path ?? index,
    [entries],
  );

  return useVirtualizer({
    count: entries.length,
    getScrollElement: getScrollEl,
    getItemKey,
    estimateSize: () => 280,
    overscan,
  });
};
