import { test } from "node:test";
import { Virtualizer } from "@tanstack/react-virtual";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedEntry, getDisplayTitle, leaves, mockView, renderedFiles, beginHooks, useFeedVirtualizer } from "./mock-feed.mjs";
import { generateVault, makeEntries, noteText, sizes } from "../scripts/fixtures.mjs";

const entry = (basename, extension = "md") => ({ file: { basename, path: basename + "." + extension, extension } });
test("default sorting is natural, excludes non-Markdown and does not mutate Bases data", () => {
  const input = [entry("Note 10"), entry("picture", "png"), entry("Note 2")];
  const { view, container } = mockView(input);
  view.onDataUpdated();
  assert.deepEqual(renderedFiles(container).map(e => e.basename), ["Note 2", "Note 10"]);
  assert.equal(input[0].file.basename, "Note 10");
  const click = container.props.onEntryClick;
  view.onDataUpdated();
  assert.equal(container.props.onEntryClick, click);
  view.onunload();
  assert.equal(container.unmounts, 1);
  assert.equal(container.props, null);
});
test("configured Bases order and fork-specific settings survive updates", () => {
  const input = [entry("Z"), entry("A")];
  const { view, container, config } = mockView(input, [{}]);
  config.settings = { multipleColumns: true, fullWidthCards: true, showProperties: true, maxCardWidth: 400 };
  view.onDataUpdated();
  assert.deepEqual(renderedFiles(container), input.map(e => e.file));
  for (const [key, value] of Object.entries(config.settings)) assert.equal(container.props[key], value);
  view.data = null;
  view.onDataUpdated();
  assert.equal(container.unmounts, 1);
  assert.equal(view.entries.length, 0);
  view.data = { data: input };
  view.onDataUpdated();
  assert.deepEqual(renderedFiles(container), input.map(e => e.file));
});
test("daily title formatting and invalid dates", () => {
  const day = new Date(2025, 0, 21);
  const expected = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day) + ", " +
    new Intl.DateTimeFormat(undefined, { month: "long" }).format(day) + " 21st, 2025";
  assert.equal(getDisplayTitle("2025-01-21"), expected);
  assert.equal(getDisplayTitle("2025-02-30"), "2025-02-30");
  assert.equal(getDisplayTitle("Meeting"), "Meeting");
});
function mountEntry() {
  const tree = FeedEntry({ file: entry("Editable").file, app: {}, showProperties: false });
  const node = { children: [], replaceChildren(...children) { this.children = children; }, createDiv() { return { setText: text => this.children.push(text) }; } };
  const cleanup = tree.props.children[1].props.children.props.ref(node);
  return { node, cleanup, leaf: leaves.at(-1) };
}
test("opened editor is attached and closed on cleanup", async () => {
  const { node, cleanup, leaf } = mountEntry();
  leaf.finish();
  await Promise.resolve();
  const editor = leaf.view;
  assert.deepEqual(node.children, [editor.containerEl]);
  cleanup();
  assert.equal(editor.closes, 1);
  assert.deepEqual(node.children, []);
  assert.equal(leaf.resizeObserver.disconnects, 1);
});
test("late editor completion after cleanup cannot attach a stale editor", async () => {
  const { node, cleanup, leaf } = mountEntry();
  cleanup();
  leaf.finish();
  // Capture the opened view before the callback disposes it.
  const editor = leaf.view;
  await Promise.resolve();
  assert.deepEqual(node.children, []);
  assert.equal(editor.closes, 1);
  assert.equal(leaf.view, leaf._empty);
});
test("fixtures have unique paths at every requested size and mixed note content", async () => {
  for (const size of sizes) assert.equal(new Set(makeEntries(size).map(e => e.file.path)).size, size);
  assert.match(noteText(0), /!\[\[fixture\.svg\]\]/);
  assert.match(noteText(0), /!\[\[Notes\//);
  assert.ok(noteText(0).length > noteText(3).length * 10);
  const dir = await mkdtemp(join(tmpdir(), "feed-test-"));
  try {
    const vault = await generateVault(dir, 100);
    assert.equal((await readdir(join(vault, "Notes"))).length, 100);
    assert.match(await readFile(join(vault, "Notes", "2025-01-01.md"), "utf8"), /^---\nkind: fixture/);
    await assert.rejects(generateVault(dir, 100), { code: "EEXIST" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("rejected editor opens dispose partially initialized views even after unmount", async () => {
  for (const unmountFirst of [false, true]) {
    const { node, cleanup, leaf } = mountEntry();
    if (unmountFirst) cleanup();
    leaf.fail();
    const editor = leaf.view;
    await Promise.resolve();
    assert.equal(editor.closes, 1);
    assert.equal(leaf.view, leaf._empty);
    assert.ok(leaf.resizeObserver.disconnects >= 1);
    assert.deepEqual(node.children, unmountFirst ? [] : ["Failed to load Markdown editor"]);
    if (!unmountFirst) cleanup();
    assert.equal(editor.closes, 1);
  }
});
test("unexpected editor type is closed immediately", async () => {
  const { node, cleanup, leaf } = mountEntry();
  const invalid = { closes: 0, async close() { this.closes++; } };
  leaf.finish(invalid);
  await Promise.resolve();
  assert.equal(invalid.closes, 1);
  assert.equal(leaf.view, leaf._empty);
  assert.deepEqual(node.children, ["Failed to load Markdown editor"]);
  cleanup();
  assert.equal(invalid.closes, 1);
});
test("natural sort preserves original locale semantics and stable ties", () => {
  const names = ["Éclair 2", "eclair 2", "eclair 10", "日記", "Å", "a", "A", "a02", "a2", "ß", "ss", "2025-01-01"];
  const input = names.map((name, i) => ({ file: { basename: name, path: i + "/" + name + ".md", extension: "md" } }));
  const { view, container } = mockView(input);
  view.onDataUpdated();
  const expected = [...input].sort((a,b) => a.file.basename.localeCompare(b.file.basename, undefined, { numeric: true, sensitivity: "base" })).map(e => e.file);
  assert.deepEqual(renderedFiles(container), expected);
});

test("unchanged files skip rendering, but settings, rename, order and replacement invalidate", () => {
  const input = [entry("Z"), entry("A"), entry("image", "png")];
  const { view, container, config } = mockView(input);
  view.onDataUpdated();
  const original = container.props.entries;
  view.data = { data: input.map(e => ({ file: e.file })) };
  view.onDataUpdated();
  assert.equal(container.renders, 1);
  assert.equal(container.props.entries, original);
  config.settings.showProperties = true;
  view.onDataUpdated();
  assert.equal(container.renders, 2);
  assert.equal(container.props.showProperties, true);
  assert.equal(container.props.entries, original);
  input[0].file.basename = "0";
  input[0].file.path = "0.md";
  view.onDataUpdated();
  assert.equal(container.renders, 3);
  assert.deepEqual(renderedFiles(container).map(f => f.basename), ["0", "A"]);
  config.sort = [{}];
  view.data = { data: [input[1], input[0]] };
  view.onDataUpdated();
  assert.equal(container.renders, 4);
  assert.deepEqual(renderedFiles(container), [input[1].file, input[0].file]);
  const replacement = { ...input[1].file };
  view.data = { data: [{ file: replacement }, input[0]] };
  view.onDataUpdated();
  assert.equal(container.renders, 5);
  assert.equal(renderedFiles(container)[0], replacement);
  view.data = null;
  view.onDataUpdated();
  assert.equal(view.lastInput, null);
  assert.equal(view.lastOptions, null);
  view.data = { data: input };
  view.onDataUpdated();
  assert.equal(container.renders, 6);
});
test("input order changes retain the original stable sort tie ordering", () => {
  const a = { file: { basename: "a", path: "1/a.md", extension: "md" } };
  const b = { file: { basename: "A", path: "2/A.md", extension: "md" } };
  const { view, container } = mockView([a,b]);
  view.onDataUpdated();
  assert.deepEqual(renderedFiles(container), [a.file,b.file]);
  view.data = { data: [b,a] };
  view.onDataUpdated();
  assert.deepEqual(renderedFiles(container), [b.file,a.file]);
});

test("late height changes while scrolling backward update positions using TanStack's public measurement", () => {
  const { view, container } = mockView([entry("A"), entry("B")]);
  view.onDataUpdated();
  beginHooks();
  const options = useFeedVirtualizer(container.props.entries, {}, 3);
  const adjustments = [];
  const virtualizer = new Virtualizer({ ...options, getScrollElement: () => null,
    scrollToFn: (_offset, info) => adjustments.push(info.adjustments),
    observeElementRect() {}, observeElementOffset() {} });
  assert.equal(virtualizer.getTotalSize(), 560);
  virtualizer.resizeItem(0, 300);
  assert.equal(virtualizer.getTotalSize(), 580);
  virtualizer.scrollDirection = "backward";
  virtualizer.scrollOffset = 400;
  let reads = 0;
  const element = {
    getBoundingClientRect() { reads++; return {height: 440}; },
    get offsetHeight() { reads++; return 440; }, getAttribute() { return "0"; }
  };
  const height = virtualizer.options.measureElement(element, { borderBoxSize: [{blockSize: 440, inlineSize: 500}] }, virtualizer);
  assert.equal(height, 440);
  assert.equal(reads, 0);
  virtualizer.resizeItem(0, height);
  assert.equal(virtualizer.getTotalSize(), 720);
  assert.equal(adjustments.at(-1), 140);
  assert.equal(virtualizer.options.measureElement(element, undefined, virtualizer), 440);
  assert.equal(reads, 1);
});
