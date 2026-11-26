import assert from "node:assert/strict";
import { measureElement as defaultMeasureElement, Virtualizer } from "@tanstack/react-virtual";
import { makeEntries, sizes } from "./fixtures.mjs";
import { beginHooks, mockView, useFeedVirtualizer } from "../tests/mock-feed.mjs";

// Real locked TanStack core; mocked React hooks and DOM. Counts, not frame times.
const cache = [];
for (const size of sizes) {
  const input = makeEntries(size);
  const { view, container } = mockView(input);
  view.onDataUpdated();
  const scroll = {};
  let keyCalls = 0, priorKey, countedKey, virtualizer;
  for (let i = 0; i < 10; i++) {
    view.data = { data: input.map(e => ({file: e.file})) };
    view.onDataUpdated();
    beginHooks();
    const options = useFeedVirtualizer(container.props.entries, scroll, 3);
    if (options.getItemKey !== priorKey) {
      priorKey = options.getItemKey;
      countedKey = index => { keyCalls++; return priorKey(index); };
    }
    const actual = { ...options, getItemKey: countedKey, getScrollElement: () => null, scrollToFn() {}, observeElementRect() {}, observeElementOffset() {} };
    if (!virtualizer) virtualizer = new Virtualizer(actual);
    else virtualizer.setOptions(actual);
    assert.equal(virtualizer.getTotalSize(), size * 280);
  }
  cache.push({ size, keyCalls });
  view.onunload();
}
beginHooks();
const input = makeEntries(100);
const {view, container} = mockView(input);
view.onDataUpdated();
const options = useFeedVirtualizer(container.props.entries, {}, 3);
const measure = options.measureElement ?? defaultMeasureElement;
let rectReads = 0;
const element = { getBoundingClientRect() { rectReads++; return {height: 440, width: 500}; }, getAttribute() { return "0"; }, offsetHeight: 440, offsetWidth: 500 };
const instance = { scrollDirection: "forward", options: { ...options, horizontal: false }, itemSizeCache: new Map([[options.getItemKey(0), 280]]) };
const observerEntry = { borderBoxSize: [{blockSize: 440, inlineSize: 500}] };
const heights = [];
for (let i=0;i<100;i++) heights.push(measure(element, observerEntry, instance));
const forwardReads = rectReads;
instance.scrollDirection = "backward";
const backwardHeight = measure(element, observerEntry, instance);
const backwardReads = rectReads - forwardReads;
assert.ok(heights.every(h=>h===440));
assert.equal(backwardReads, 0);
view.onunload();
console.log(JSON.stringify({ kind: "mocked-dom-real-tanstack-core", cache, observerMeasurements: 101, rectReads, backwardReads, backwardHeight }, null, 2));
