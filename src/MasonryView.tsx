import { App, BasesEntry, TFile } from "obsidian";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./hooks";
import { FeedEntry } from "./FeedEntry";
import { useFeedVirtualizer } from "./virtualizer";

export const MasonryView: React.FC<MasonryViewProps> = ({
  entries,
  onEntryClick,
  onEntryContextMenu,
  scrollElement,
  showProperties,
  maxCardWidth,
}) => {
  const app = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const gapSize = 16;

  // Track container width for responsive column calculation
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;

        // Calculate column count based on container width and max card width
        // Account for gaps between columns (16px per gap)
        const availableWidth = width - gapSize * 2; // padding on sides
        const cols = Math.max(
          1,
          Math.floor((availableWidth + gapSize) / (maxCardWidth + gapSize)),
        );
        setColumnCount((current) => (current === cols ? current : cols));
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [maxCardWidth]);

  // Distribute entries across columns
  const columns = useMemo(() => {
    const cols: BasesEntry[][] = Array.from({ length: columnCount }, () => []);

    // Distribute entries evenly across columns (round-robin)
    entries.forEach((entry, index) => {
      cols[index % columnCount].push(entry);
    });

    return cols;
  }, [entries, columnCount]);

  return (
    <div ref={containerRef} className="bases-feed bases-feed-masonry">
      {entries.length === 0 ? (
        <div className="bases-feed-empty">No notes to display</div>
      ) : (
        <div
          className="bases-feed-masonry-grid"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            maxWidth: `${columnCount * maxCardWidth + (columnCount - 1) * gapSize}px`,
          }}
        >
          {columns.map((columnEntries, columnIndex) => (
            <MasonryColumn
              key={columnIndex}
              entries={columnEntries}
              scrollElement={scrollElement}
              app={app}
              showProperties={showProperties}
              onEntryClick={onEntryClick}
              onEntryContextMenu={onEntryContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MasonryColumn: React.FC<MasonryColumnProps> = ({
  entries,
  scrollElement,
  app,
  showProperties,
  onEntryClick,
  onEntryContextMenu,
}) => {
  const rowVirtualizer = useFeedVirtualizer(entries, scrollElement, 2);
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="bases-feed-masonry-column">
      <div
        className="bases-feed-virtualizer"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {virtualItems.map((vi) => {
          const entry = entries[vi.index];
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={rowVirtualizer.measureElement}
              className="bases-feed-virtual-item"
              style={{
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <FeedEntry
                file={entry.file}
                app={app}
                showProperties={showProperties}
                onEntryClick={onEntryClick}
                onEntryContextMenu={onEntryContextMenu}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Props

type MasonryViewProps = {
  entries: BasesEntry[];
  onEntryClick: (file: TFile, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, file: TFile) => void;
  scrollElement: HTMLElement;
  showProperties: boolean;
  maxCardWidth: number;
};

type MasonryColumnProps = {
  entries: BasesEntry[];
  scrollElement: HTMLElement;
  app: App;
  showProperties: boolean;
  onEntryClick: (file: TFile, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, file: TFile) => void;
};
