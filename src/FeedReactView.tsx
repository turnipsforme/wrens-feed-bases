import { BasesEntry, TFile } from "obsidian";
import React from "react";
import { useApp } from "./hooks";
import { MasonryView } from "./MasonryView";
import { FeedEntry } from "./FeedEntry";
import { useFeedVirtualizer } from "./virtualizer";

export const FeedReactView: React.FC<FeedReactViewProps> = ({
  entries,
  onEntryClick,
  onEntryContextMenu,
  scrollElement,
  showProperties,
  multipleColumns = false,
  fullWidthCards = false,
  maxCardWidth = 760,
}) => {
  // Conditionally render masonry or single column view
  if (multipleColumns) {
    return (
      <MasonryView
        entries={entries}
        onEntryClick={onEntryClick}
        onEntryContextMenu={onEntryContextMenu}
        scrollElement={scrollElement}
        showProperties={showProperties}
        maxCardWidth={maxCardWidth}
      />
    );
  }

  // Single column centered view
  return (
    <SingleColumnView
      entries={entries}
      onEntryClick={onEntryClick}
      onEntryContextMenu={onEntryContextMenu}
      scrollElement={scrollElement}
      showProperties={showProperties}
      fullWidthCards={fullWidthCards}
      maxCardWidth={maxCardWidth}
    />
  );
};

const SingleColumnView: React.FC<SingleColumnViewProps> = ({
  entries,
  onEntryClick,
  onEntryContextMenu,
  scrollElement,
  showProperties,
  fullWidthCards,
  maxCardWidth,
}) => {
  const app = useApp();
  const rowVirtualizer = useFeedVirtualizer(entries, scrollElement, 3);
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      className="bases-feed bases-feed-single-column"
      style={{ maxWidth: fullWidthCards ? "none" : `${maxCardWidth}px` }}
    >
      {entries.length === 0 ? (
        <div className="bases-feed-empty">No notes to display</div>
      ) : (
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
      )}
    </div>
  );
};

// Props

type FeedReactViewProps = {
  entries: BasesEntry[];
  onEntryClick: (file: TFile, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, file: TFile) => void;
  scrollElement: HTMLElement;
  showProperties: boolean;
  multipleColumns?: boolean;
  fullWidthCards?: boolean;
  maxCardWidth?: number;
};

type SingleColumnViewProps = {
  entries: BasesEntry[];
  onEntryClick: (file: TFile, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, file: TFile) => void;
  scrollElement: HTMLElement;
  showProperties: boolean;
  fullWidthCards: boolean;
  maxCardWidth: number;
};
