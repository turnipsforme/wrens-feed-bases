import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedEntry, getDisplayTitle, leaves, mockView, renderedFiles } from "./mock-feed.mjs";
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
