import { TFile } from "obsidian";
import { useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Virtualizer } from "@tanstack/react-virtual";

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

  // Last measured height per path. Public replacement for TanStack's private
  // itemSizeCache: reuse it when scrolling backward so cards above the viewport
  // cannot resize and make the list jump. The map resets with the file list.
  const sizes = useMemo(() => new Map<string, number>(), [entries]);

  const measureElement = useCallback(
    (
      element: Element,
      _entry: ResizeObserverEntry | undefined,
      instance: Virtualizer<HTMLElement, Element>,
    ) => {
      const index = Number(element.getAttribute("data-index"));
      const key = String(instance.options.getItemKey(index));
      const cached = sizes.get(key);
      if (instance.scrollDirection === "backward" && cached !== undefined) {
        return cached;
      }

      // ResizeObserver's borderBoxSize produced extra editor churn in native
      // Obsidian testing, so measure the rendered height as 0.13.0 did.
      const size = (element as HTMLElement).getBoundingClientRect().height;
      sizes.set(key, size);
      return size;
    },
    [sizes],
  );

  return useVirtualizer({
    count: entries.length,
    getScrollElement: getScrollEl,
    getItemKey,
    estimateSize: () => 280,
    overscan,
    measureElement,
  });
};
