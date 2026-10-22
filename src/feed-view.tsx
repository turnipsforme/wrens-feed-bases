import { BasesEntry, BasesView, Menu, QueryController, TFile } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { FeedReactView } from "./FeedReactView";
import { AppContext } from "./context";

export const FeedViewType = "feed";

export class FeedView extends BasesView {
  type = FeedViewType;
  scrollEl: HTMLElement;
  containerEl: HTMLElement;
  root: Root | null = null;

  private entries: BasesEntry[] = [];

  constructor(controller: QueryController, scrollEl: HTMLElement) {
    super(controller);
    this.scrollEl = scrollEl;
    this.containerEl = scrollEl.createDiv({
      cls: "bases-feed-container is-loading",
      attr: { tabIndex: 0 },
    });
  }

  onload(): void {
    // React components will handle their own lifecycle
  }

  onunload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.entries = [];
  }

  onResize(): void {
    // Feed view should adapt to resizing automatically
  }

  public focus(): void {
    this.containerEl.focus({ preventScroll: true });
  }

  public onDataUpdated(): void {
    this.containerEl.removeClass("is-loading");
    this.updateFeed();
  }

  private updateFeed(): void {
    if (!this.data) {
      this.root?.unmount();
      this.root = null;
      this.containerEl.empty();
      this.containerEl.createDiv("bases-feed-empty").textContent =
        "No entries to display";
      return;
    }

    this.entries = this.data.data.filter(
      (entry) => entry.file.extension === "md",
    );

    // Bases presorts query data by the view's sort config (all keys, with
    // its own type-aware comparison). Only fall back to title A–Z when the
    // user hasn't configured a sort.
    if (this.config.getSort().length === 0) {
      this.entries.sort((a, b) =>
        a.file.basename.localeCompare(b.file.basename, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    }

    this.renderReactFeed();
  }

  private renderReactFeed(): void {
    if (!this.root) {
      this.root = createRoot(this.containerEl);
    }

    const showProperties =
      (this.config.get("showProperties") as boolean | undefined) ?? false;
    const multipleColumns =
      (this.config.get("multipleColumns") as boolean | undefined) ?? false;
    const fullWidthCards =
      (this.config.get("fullWidthCards") as boolean | undefined) ?? false;
    const maxCardWidth =
      (this.config.get("maxCardWidth") as number | undefined) ?? 760;

    this.root.render(
      <StrictMode>
        <AppContext.Provider value={this.app}>
          <FeedReactView
            entries={this.entries}
            scrollElement={this.scrollEl}
            showProperties={showProperties}
            multipleColumns={multipleColumns}
            fullWidthCards={fullWidthCards}
            maxCardWidth={maxCardWidth}
            onEntryClick={this.handleEntryClick}
            onEntryContextMenu={this.handleEntryContextMenu}
          />
        </AppContext.Provider>
      </StrictMode>,
    );
  }

  // Stable references so memoized cards don't re-render on every data update.
  private handleEntryClick = (file: TFile, isModEvent: boolean): void => {
    this.app.workspace.openLinkText(file.path, "", isModEvent).catch((err) => {
      console.error("Failed to open link:", err);
    });
  };

  private handleEntryContextMenu = (
    evt: React.MouseEvent,
    file: TFile,
  ): void => {
    evt.preventDefault();
    const menu = Menu.forEvent(evt.nativeEvent);
    this.app.workspace.handleLinkContextMenu(menu, file.path, "");
  };
}
