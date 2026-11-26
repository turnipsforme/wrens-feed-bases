import { build } from "esbuild";

// Execute real source modules, replacing only host/UI boundaries.
// No DOM, actual React reconciliation, or Obsidian runtime is simulated.
const mocks = {
  obsidian: `
    export class BasesView { constructor(controller) { Object.assign(this, controller); } }
    export class Menu {}
    export const leaves = [];
    export class MarkdownView {
      containerEl = {};
      closes = 0;
      async close() { this.closes++; }
    }
    export class WorkspaceLeaf {
      _empty = new MarkdownView();
      view = this._empty;
      resizeObserver = { disconnects: 0, disconnect() { this.disconnects++; } };
      constructor() { leaves.push(this); }
      openFile(file) {
        this.file = file;
        return new Promise((resolve, reject) => {
          this.finish = (view = new MarkdownView()) => { this.view = view; resolve(); };
          this.fail = (view = new MarkdownView()) => { this.view = view; reject(new Error("mock open failed")); };
        });
      }
    }
  `,
  "react-dom/client": `
    export function createRoot(container) {
      return {
        render(tree) { container.renders++; container.props = tree.props.children.props.children.props; },
        unmount() { container.unmounts++; container.props = null; }
      };
    }
  `,
  "./FeedReactView": "export function FeedReactView() {}",
  "virtual-react": `let cursor = 0; const hooks = []; export function beginHooks() { cursor = 0; } export function useMemo(fn, deps) { const i = cursor++; const old = hooks[i]; if (old && deps.every((d,j) => d === old.deps[j])) return old.value; const value = fn(); hooks[i] = { deps, value }; return value; } export const useCallback = (fn, deps) => useMemo(() => fn, deps);`,
  "@tanstack/react-virtual": "export const useVirtualizer = options => options;",
  "entry-react": "export const memo = fn => fn; export const useCallback = fn => fn; export default {};"
};
const result = await build({
  stdin: {
    contents: 'export * from "./src/feed-view"; export * from "./src/display-title"; export * from "./src/FeedEntry"; export { leaves } from "obsidian"; export * from "./src/virtualizer"; export { beginHooks } from "virtual-react";',
    resolveDir: process.cwd(), loader: "ts"
  },
  bundle: true, write: false, platform: "node", format: "esm",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "mock-host",
    setup(plugin) {
      plugin.onResolve({ filter: /^(obsidian|react-dom\/client|\.\/FeedReactView|@tanstack\/react-virtual|virtual-react|react)$/ }, args => {
        if (args.path === "react") {
          if (args.importer.endsWith("virtualizer.ts")) return { path: "virtual-react", namespace: "mock" };
          if (!args.importer.endsWith("FeedEntry.tsx")) return;
          return { path: "entry-react", namespace: "mock" };
        }
        return { path: args.path, namespace: "mock" };
      });
      plugin.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path], loader: "js" }));
    }
  }]
});
export const { FeedView, FeedEntry, getDisplayTitle, leaves, useFeedVirtualizer, beginHooks } =
  await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));

export const renderedFiles = container => container.props.entries.map(entry => entry.file ?? entry);

export function mockView(entries, sort = []) {
  const container = {
    renders: 0, unmounts: 0, props: null,
    removeClass() {}, empty() {}, createDiv() { return {}; }
  };
  const config = { sort, settings: {}, getSort() { return this.sort; }, get(key) { return this.settings[key]; } };
  const view = new FeedView({ data: { data: entries }, config, app: {} }, { createDiv: () => container });
  return { view, container, config };
}
