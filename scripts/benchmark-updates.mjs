import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { makeEntries, sizes } from "./fixtures.mjs";
import { mockView, renderedFiles } from "../tests/mock-feed.mjs";

const stats = samples => {
  const sorted = [...samples].sort((a,b) => a-b);
  return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95)-1], samples };
};
const results = [];
for (const size of sizes) {
  const entries = makeEntries(size);
  const reverse = [...entries].reverse();
  const sorted = [...entries].sort((a,b) => a.file.basename.localeCompare(b.file.basename, undefined, { numeric: true, sensitivity: "base" })).map(e => e.file);
  for (const mode of ["fallback", "configured"]) {
    for (const scenario of ["unchanged", "reordered"]) {
      const { view, container } = mockView(entries, mode === "configured" ? [{}] : []);
      view.onDataUpdated();
      const samples = [], requests = [], stableArrays = [];
      for (let i = 0; i < 12; i++) {
        const next = scenario === "reordered" && i % 2 === 0 ? reverse : entries;
        // Bases may recreate entry wrappers after each edit. Keep the native file identities.
        view.data = { data: next.map(e => ({ file: e.file })) };
        const previousRenders = container.renders, previousArray = container.props.entries;
        const start = performance.now();
        view.onDataUpdated();
        const elapsed = performance.now() - start;
        assert.deepEqual(renderedFiles(container), mode === "fallback" ? sorted : next.map(e => e.file));
        if (i >= 3) {
          samples.push(elapsed);
          requests.push(container.renders - previousRenders);
          stableArrays.push(Number(container.props.entries === previousArray));
        }
      }
      view.onunload();
      results.push({ size, mode, scenario, ms: stats(samples), rootRenderRequests: requests.reduce((a,b)=>a+b,0), stableArrays: stableArrays.reduce((a,b)=>a+b,0) });
    }
  }
}
console.log(JSON.stringify({ kind: "mocked-query-updates-not-obsidian", node: process.version, warmups: 3, trials: 9, results }, null, 2));
