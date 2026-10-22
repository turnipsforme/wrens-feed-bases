import { BasesEntry } from "obsidian";
import { useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Shared virtualizer setup for the single-column and masonry layouts.
// Every rendered card hosts a full Markdown editor, so overscan is kept small.
export const useFeedVirtualizer = (
  entries: BasesEntry[],
  scrollElement: HTMLElement,
  overscan: number,
) => {
  const getScrollEl = useMemo(() => () => scrollElement, [scrollElement]);

  // Key rows by file path so a card (and its editor) survives notes being
  // inserted or reordered above it, and cached heights follow the note.
  const getItemKey = useCallback(
    (index: number) => entries[index]?.file.path ?? index,
    [entries],
  );

  return useVirtualizer({
    count: entries.length,
    getScrollElement: getScrollEl,
    getItemKey,
    estimateSize: () => 280,
    overscan,
    measureElement: (element, _entry, instance) => {
      const measure = () =>
        (element as HTMLElement | null)?.getBoundingClientRect().height ?? 0;

      // When scrolling backward, reuse the cached height to avoid cards above
      // the viewport resizing and making the list jump.
      const direction = instance.scrollDirection;
      if (direction === "forward" || direction === null) return measure();

      const index = Number((element as HTMLElement).getAttribute("data-index"));
      const key = instance.options.getItemKey(index);
      // @ts-ignore - accessing private property for stable backward scrolling
      const cached: number | undefined = instance.itemSizeCache.get(key);
      return cached ?? measure();
    },
  });
};
