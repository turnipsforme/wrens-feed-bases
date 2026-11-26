import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { strict as assert } from "node:assert";
import { mockView } from "../tests/mock-feed.mjs";
import { makeEntries, sizes } from "./fixtures.mjs";

const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1], samples: values };
};
const results = [];
for (const size of sizes) {
  const entries = makeEntries(size);
  for (const mode of ["fallback", "configured"]) {
    const initial = [], update = [];
    let renderRequests = 0;
    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    let peakSample = before;
    for (let i = 0; i < 9; i++) {
      const { view, container } = mockView(entries, mode === "configured" ? [{}] : []);
      let start = performance.now();
      view.onDataUpdated();
      if (i >= 2) initial.push(performance.now() - start);
      view.data = { data: [...entries].reverse() };
      start = performance.now();
      view.onDataUpdated();
      if (i >= 2) update.push(performance.now() - start);
      assert.equal(container.props.entries.length, size);
      if (mode === "configured") assert.equal(container.props.entries[0], entries.at(-1));
      else assert.deepEqual(container.props.entries.map(e => e.file.basename), [...entries].map(e => e.file.basename).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
      peakSample = Math.max(peakSample, process.memoryUsage().heapUsed);
      if (i >= 2) renderRequests += container.renders;
      view.onunload();
    }
    global.gc?.();
    results.push({ size, mode, initialMockMs: stats(initial), queryUpdateMockMs: stats(update),
      mockRootRenderRequests: renderRequests, sampledHeapDeltaBytes: peakSample - before,
      postGcHeapDeltaBytes: global.gc ? process.memoryUsage().heapUsed - before : null });
  }
}
const bundle = await readFile("main.js");
console.log(JSON.stringify({
  kind: "mocked-query-only-not-obsidian", node: process.version, platform: process.platform,
  arch: process.arch, warmup: 2, samples: 7, results,
  bundleBytes: bundle.length, gzipBytes: gzipSync(bundle).length,
  unavailable: ["native editor counts", "scroll frame times", "dropped frames", "real React renders", "native peak and retained memory", "actual initial feed and query latency"]
}, null, 2));
