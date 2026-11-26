import { BasesEntry, BasesView, Menu, QueryController, TFile } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { FeedReactView } from "./FeedReactView";
import { AppContext } from "./context";

export const FeedViewType = "feed";

const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export class FeedView extends BasesView {
  type = FeedViewType;
  scrollEl: HTMLElement;
  containerEl: HTMLElement;
  root: Root | null = null;

  private entries: TFile[] = [];
  private lastInput: { files: TFile[]; paths: string[]; fallback: boolean } | null = null;
  private lastOptions: [boolean, boolean, boolean, number] | null = null;

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
    this.lastInput = null;
    this.lastOptions = null;
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
      this.entries = [];
      this.lastInput = null;
      this.lastOptions = null;
      this.containerEl.empty();
      this.containerEl.createDiv("bases-feed-empty").textContent =
        "No entries to display";
      return;
    }

    const fallback = this.config.getSort().length === 0;
    const previous = this.lastInput;
    const unchanged = previous !== null && previous.fallback === fallback &&
      this.sameFiles(this.data.data, previous.files, previous.paths);

    if (!unchanged) {
      // Only native files are used by the cards; do not retain obsolete Bases entries.
      const files = this.data.data.filter(entry => entry.file.extension === "md").map(entry => entry.file);
      this.lastInput = { files, paths: files.map(file => file.path), fallback };
      // Bases presorts configured queries; otherwise preserve the natural title sort.
      this.entries = fallback ? [...files].sort((a, b) => titleCollator.compare(a.basename, b.basename)) : files;
    }
    this.renderReactFeed(unchanged);
  }

  private sameFiles(data: BasesEntry[], files: TFile[], paths: string[]): boolean {
    let index = 0;
    for (const { file } of data) {
      if (file.extension !== "md") continue;
      if (files[index] !== file || paths[index] !== file.path) return false;
      index++;
    }
    return index === files.length;
  }

  private renderReactFeed(unchanged: boolean): void {
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

    const options: [boolean, boolean, boolean, number] = [showProperties, multipleColumns, fullWidthCards, maxCardWidth];
    if (unchanged && this.lastOptions && options.every((value, index) => value === this.lastOptions![index])) return;
    this.lastOptions = options;

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
