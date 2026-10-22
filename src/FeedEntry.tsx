import { App, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import React, { memo, useCallback } from "react";
import { getDisplayTitle } from "./display-title";

// Memoized on `file` (not the BasesEntry, which is recreated on every query
// update) so typing in one card doesn't re-render every other card.
export const FeedEntry = memo(function FeedEntry({
  file,
  app,
  showProperties,
  onEntryClick,
  onEntryContextMenu,
}: FeedEntryProps) {
  const handleTitleClick = (evt: React.MouseEvent) => {
    evt.preventDefault();
    const isModEvent = evt.ctrlKey || evt.metaKey;
    onEntryClick(file, isModEvent);
  };

  const handleContextMenu = (evt: React.MouseEvent) => {
    onEntryContextMenu(evt, file);
  };

  const handleHover = (evt: React.MouseEvent) => {
    app.workspace.trigger("hover-link", {
      event: evt.nativeEvent,
      source: "bases",
      hoverParent: app.renderContext,
      targetEl: evt.currentTarget,
      linktext: file.path,
    });
  };

  const setEditorHost = useCallback(
    (node: HTMLDivElement) => {
      let alive = true;
      // @ts-ignore using internal API
      const leaf = new WorkspaceLeaf(app);
      void (async () => {
        try {
          await leaf.openFile(file, {
            state: { mode: "source", source: false },
          });
          // Unmounted while the file was opening: the cleanup below already
          // ran against the empty view, so dispose of the real one now.
          if (!alive) {
            disposeLeaf(leaf);
            return;
          }

          const view = leaf.view;
          if (!(view instanceof MarkdownView)) {
            node.replaceChildren();
            const err = node.createDiv("bases-feed-error");
            err.setText("Failed to load Markdown editor");
            return;
          }

          node.replaceChildren(view.containerEl);
        } catch (e) {
          if (alive) console.error("Error setting up editor:", e);
        }
      })();

      return () => {
        alive = false;
        node.replaceChildren();
        disposeLeaf(leaf);
      };
    },
    [app, file],
  );

  return (
    <div className="bases-feed-entry" onContextMenu={handleContextMenu}>
      <div className="bases-feed-entry-header">
        <a
          className="bases-feed-entry-title"
          onClick={handleTitleClick}
          onMouseEnter={handleHover}
          href={file.path}
        >
          {getDisplayTitle(file.basename)}
        </a>
      </div>

      <div className="bases-feed-entry-content">
        <div
          ref={setEditorHost}
          className="bases-feed-entry-editor"
          style={
            {
              "--metadata-display-editing": showProperties ? "block" : "none",
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
});

// Tear down a detached leaf's view (CodeMirror instance, vault/metadata event
// listeners) and its resize observer. leaf.detach() is avoided on purpose: it
// pushes the leaf onto the workspace's "reopen closed tab" history.
function disposeLeaf(leaf: WorkspaceLeaf): void {
  try {
    const internal = leaf as unknown as InternalLeaf;
    const { view, _empty: emptyView } = internal;
    if (view && view !== emptyView) {
      internal.view = emptyView;
      void view.close().catch((e: unknown) => {
        console.error("Error closing feed editor:", e);
      });
    }
    internal.resizeObserver?.disconnect();
  } catch (e) {
    console.error("Error disposing feed editor:", e);
  }
}

type InternalLeaf = {
  view: { close: () => Promise<void> } | null;
  _empty: InternalLeaf["view"];
  resizeObserver?: ResizeObserver;
};

type FeedEntryProps = {
  file: TFile;
  app: App;
  showProperties: boolean;
  onEntryClick: (file: TFile, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, file: TFile) => void;
};
