import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { makeEntries, sizes } from "./fixtures.mjs";
import { mockView, renderedFiles } from "../tests/mock-feed.mjs";
const results = [];
for (const size of sizes) {
  const input = makeEntries(size);
  for (const scenario of ["reordered", "small-change", "all-replaced", "equal-titles"]) {
    const initial = scenario === "equal-titles" ? input.map((e,i)=>({file:{...e.file,basename:"Group " + (i%7)}})) : input;
    const alternate = scenario === "small-change" ? [...initial.slice(1),{file:{basename:"New 1",path:"Notes/New 1.md",extension:"md"}}]
      : scenario === "all-replaced" ? initial.map(e=>({file:{...e.file}})) : [...initial].reverse();
    const expected = [initial,alternate].map(list=>[...list].sort((a,b)=>a.file.basename.localeCompare(b.file.basename,undefined,{numeric:true,sensitivity:"base"})).map(e=>e.file));
    const {view,container}=mockView(initial);
    view.onDataUpdated();
    const samples=[];
    global.gc?.();
    const before=process.memoryUsage().heapUsed;
    let peak=before;
    for(let i=0;i<12;i++){
      const index=(i+1)%2;
      const next=index?alternate:initial;
      view.data={data:next.map(e=>({file:e.file}))};
      const start=performance.now();
      view.onDataUpdated();
      const elapsed=performance.now()-start;
      assert.deepEqual(renderedFiles(container),expected[index]);
      if(i>=3)samples.push(elapsed);
      peak=Math.max(peak,process.memoryUsage().heapUsed);
    }
    const ordered=[...samples].sort((a,b)=>a-b);
    view.onunload();
    results.push({size,scenario,median:ordered[4],p95:ordered[8],samples,sampledHeapDeltaBytes:peak-before});
  }
}
console.log(JSON.stringify({kind:"mocked-feed-changed-query-not-obsidian",results},null,2));
