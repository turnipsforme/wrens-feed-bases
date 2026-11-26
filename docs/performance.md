# Feed performance baseline (AAE + Ponytail)

Original production revision: a45502b1844608711cf29c1494ec6ffbce610dcb (0.13.0).
The baseline branch has no production changes; draft PR #2 contains tested candidate optimizations and reliability fixes. No new dependencies. The release workflow still builds via Bun and publishes main.js, manifest.json and styles.css on tags; no release is authorized by this baseline.

## Reproduce

- bun install --frozen-lockfile
- bun run build
- node --test tests/*.test.mjs
- node --expose-gc scripts/benchmark.mjs > benchmark.json
- node scripts/fixtures.mjs /path/to/new/output

The fixture generator creates four separate vault directories (100, 1,000, 5,000 and 10,000 notes), with YAML, tasks, long notes, local SVG images and note embeds. It refuses to overwrite existing vaults. Open one directory as an Obsidian vault, enable Bases and the plugin, create a Base outside Notes filtered to the Notes folder, and select Feed.

Mock timings execute the production FeedView query path and build React element objects, not actual React rendering, Obsidian editor initialization or browser layout. Mock heap samples include harness activity and are not peak native memory. Build sizes are real artifact sizes. Node version, platform, raw samples, median and p95 are recorded. The mocked baseline and subsequent paired CI experiments are recorded below.

## Native protocol

On each desktop and physical iOS device, record Obsidian version, OS, hardware, refresh rate, theme, enabled plugins and viewport. Use a separate copy of the same fixture vault for each revision, production build, identical configuration and no other community plugins. Test single-column, masonry, properties on/off and default/configured sorting.

Use two warmups and at least seven measured trials per scenario. Alternate baseline and candidate order on the same device; report medians, p95 and raw measurements. Separate cold app launch from warm view creation. Measure from query notification/view opening until visible editors are loaded; measure query notification to updated visible cards. Use development-only instrumentation equally on both revisions for native editor creation/close counts and React Profiler commit counts. For scrolling, capture frame intervals over the same scripted or reproducible gesture sequence and report frames exceeding device frame budget and missed refresh intervals (not equivalent to exact compositor drops). On desktop use DevTools performance/heap recordings; on iOS use Safari Web Inspector if available and Instruments/device memory tools where supported. Record process peak and retained memory after repeated open/scroll/close cycles, idle and GC where available; report unavailable counters rather than substitute Node metrics.

Correctness gates: identical files/order for all configured sort keys and fallback; edit/save/reopen, rapid scroll and filtering during typing, focused editor behavior, links, tasks, embeds/images, frontmatter visibility, daily titles, hidden H1, width/full width, masonry resizing and context menus; no orphan editor or extra reopen history. Native editing and saving are mandatory, not replaced by static cards.

## Hypotheses

| ID | Minimal experiment | Target and prediction | Main risk |
|---|---|---|---|
| H1 | Bound editor creation via existing virtualizer settings before considering reuse | >=10% fewer creates per scroll trace | blank cards/focus loss |
| H2 | Preserve card identity across updates; investigate masonry column reparenting separately | >=10% fewer remounts | stale paths, lost edits |
| H3 | Compare overscan and ResizeObserver measurement against current bounding rect | >=10% lower p95 frame interval | incorrect height/scroll jumps |
| H4 | Test cancellation/cleanup on rejection and stale completion | no stale attachments or leaked views; >=10% fewer unnecessary opens if applicable | dropped saves |
| H5 | Use observed width instead of synchronous offsetWidth if equivalent | >=10% lower resize/layout time | column boundary changes |
| H6 | Reuse Intl.Collator for default sort first; then assess stable query input | >=10% lower mocked and native update time | changed collation or stale metadata |
| H7 | Verify public Obsidian and TanStack APIs against locked versions | equivalent behavior, less fragile access; no performance claim without data | workspace history or backward scroll regression |
| H8 | Profile retained views/observers/listeners; fix the smallest demonstrated leak | >=10% lower retained memory | premature close |

For each experiment record prediction before implementation, one isolated commit, compare against original and current best, run correctness tests before timing, and retain only reproducible improvements beyond noise (target >=10%). Compare paired ratios and geometric mean across dataset sizes; report each size and avoid averaging away regressions. Export each accepted commit as a numbered patch and record rejected outcomes too. Candidate commits and raw CI artifacts are listed below; native acceptance is still pending. No upstream knowledge-base contribution authorized.

References: https://github.com/CHSZLab/AgenticAlgorithmEngineering/blob/main/AAE.md and https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md.

## Follow-up experiments and Ponytail audit (2026-11-26)

### Measured results

Original: a45502b; previous collator candidate: c4ca1c8; unchanged-query candidate: 30c675e; default measurement candidate: ff88a5e. All numbers are from production-source execution with a mocked Obsidian host unless stated otherwise.

- H6a (collator): [paired run](https://github.com/turnipsforme/wrens-feed-bases/actions/runs/45803471953). At 10,000 files, reversed fallback query median 374.000 → 16.645 ms; +19 raw bundle bytes.
- H6b (unchanged native file sequence): [paired run](https://github.com/turnipsforme/wrens-feed-bases/actions/runs/45804412968). Repeated queries with new BasesEntry wrappers but unchanged native file references: nine measured trials, three warmups. No sort or root render request if file sequence, file paths, and settings are unchanged. The feed retains TFile references rather than stale BasesEntry objects.

| Notes | Previous collator (ms) | H6b (ms) | Original (ms) |
|---:|---:|---:|---:|
| 100 | 0.08943 | 0.00553 | 2.18794 |
| 1,000 | 1.29943 | 0.07850 | 31.30832 |
| 5,000 | 8.95339 | 0.02133 | 201.46968 |
| 10,000 | 19.90254 | 0.04424 | 445.09720 |

At 10,000 notes, nine unchanged updates requested 0 instead of 9 root renders. The real locked TanStack core, driven by mocked React hooks and no DOM, performed 10,000 rather than 100,000 key lookups over ten updates (90% fewer). Changed configured-order updates were slower: 0.11918 → 0.27575 ms median; H6d below resolves the large-query overhead. H6b is retained as a draft candidate, not a native rendering claim.

- H3/H7 (default measurement): [paired run](https://github.com/turnipsforme/wrens-feed-bases/actions/runs/45804575728). Against actual TanStack 3.13.12, a deterministic mock ResizeObserver trace (101 notifications) produced 0 instead of 100 synchronous bounding rectangle reads. A backward-scroll card whose size changed from 280 to 440 previously returned 280 and now returns 440. A test verifies actual core offset compensation and new total height. Removes the custom private itemSizeCache access. Native backward scroll smoothness remains a mandatory acceptance gate; the default rounds sizes to pixels.
- H6c (incremental sort): [isolated branch](https://github.com/turnipsforme/wrens-feed-bases/tree/aae/2026-11-26-h6c-incremental-sort). Reuses a previous sorted run for substantially overlapping large queries and preserves input order for collation-equal names. Candidate and previous best benchmark changed order, replacement, equal-title, and disjoint file identities. [Paired production-source run](https://github.com/turnipsforme/wrens-feed-bases/actions/runs/45804851863) passed correctness tests. At 10k: reordered 29.02309 → 5.13056 ms (5.66x); one replacement 28.50924 → 4.74749 ms (6.01x); equal titles 9.29588 → 3.46156 ms (2.69x); all replaced 29.62330 → 29.48950 ms. Geometric mean over the nine overlapping cases at >=1k: 3.40x. However, sampled Node heap delta for the 10k small-change trace increased from 14,589,088 to 26,846,432 bytes (harness inclusive, not native peak). **Discard from this PR**: extra transient maps and sets conflict with the iOS memory objective; retain isolated experiment branch and raw data for further research.
- H6d (one pass): [commit](https://github.com/turnipsforme/wrens-feed-bases/commit/0a1a1af98b4374563c2e57a012107e2ee6e4af07). Combines file selection and path snapshot, avoiding temporary filtered and mapped arrays. [Paired run](https://github.com/turnipsforme/wrens-feed-bases/actions/runs/45805003369) passed 13 tests and build. For changed configured-order results, 5k: 0.12951 → 0.03320 ms (3.90x); 10k: 0.27973 → 0.07028 ms (3.98x), versus original 0.11603 ms at 10k. The 1k case regressed from 0.02796 to 0.10955 ms (absolute +0.08159 ms), and 100 from 0.00537 to 0.00706 ms. Retain the simpler one-pass loop for large-query gains and fewer temporary arrays, noting the small-query trade-off. Final 10k unchanged fallback 443.13173 → 0.04544 ms, reordered fallback 441.89310 → 19.59226 ms. Final bundle 216357 bytes versus original 215909 (+448 bytes); gzip 67610 versus 67504 (+106).

### Ponytail audit

Scope: entire small plugin, build/release configuration and tests. Expected load: single Obsidian user, up to 10k notes, desktop/iOS; native editors must remain editable. Source flow: Bases query → FeedView → React → TanStack virtualizer → WorkspaceLeaf → native Markdown editor and Obsidian saving.

| Priority | Finding and concrete case | Fix/status |
|---|---|---|
| Must fix | A rejected openFile may already have assigned a view; both alive and detached hosts could retain it. Unexpected view types also retained resources. | Dispose on rejection and unexpected type, show an error only for live hosts, disconnect observer even if close throws. Regression tests simulate both rejection timings and wrong view types. |
| Must fix | Missing data unmounted React but retained old entries. | Clear list and cached snapshots; regression test covers disappearance and recovery. |
| Must fix | A late image or embed changes size while scrolling backward; old private cache returns stale height. | Use the existing public TanStack measurement, verify real core resize and correction; native scroll check pending. |
| Should fix | Each unchanged query rebuilt the sorted array, React tree and virtualizer measurements. | Compare file reference and path sequence, retain only actual files, and avoid repeated render requests if settings unchanged. Tests cover mutable rename, replacement, sort changes, stable ties, and settings. |
| Should fix | The version command invoked Node but used Bun-specific file APIs. | Use node:fs/promises; test version preservation and idempotence in temporary files. |
| Should fix | Tagged releases installed without frozen lock or running the new tests. | Frozen Bun lock and Node regression tests before release creation. |
| Should fix | Real editor construction/scroll/memory and masonry resize are not covered by the Node tests. | Native device gate; do not claim or ship a native performance improvement from mocked counters alone. |

No dependencies added or removed. No speculative editor pool, static cards, dependency upgrade, or release. Existing private WorkspaceLeaf constructor/close access remains because a public detached editable view equivalent has not been verified. Masonry, overscan and editor reuse changes require device traces; do not alter these blindly. The lockfile actually used is bun.lock; npm's old version metadata is not used by the pinned build. Do not publish from this draft until native edit/save/scroll and the full regression checklist pass.

### Verification maintenance

The permanent verification workflow compares the candidate with the original main revision. Intermediate paired runs are linked above rather than hard-coding experiment-only commit IDs into future builds (those commits may become unreachable after squash merging). All tests run on the candidate; baseline benchmarks check order independently. The one-shot comparison commands can be reproduced by restoring the appropriate src revision on a disposable checkout while leaving the harness fixed.

## Native Obsidian 1.15.1 follow-up (0.13.1)

Native desktop runs (Electron 43, 100- and 1,000-note vaults, single and masonry, scrolled over the full range) showed that the default TanStack measurement (H3/H7 above) caused roughly 50% more editor opens than 0.13.0, and an earlier deferred editor cleanup slowed loads 2-4x and left hundreds of editors open. Both were reverted:

- Editor cleanup is synchronous again, as in 0.13.0 (hardened: failed or invalid opens are disposed and the resize observer is always disconnected).
- `measureElement` is custom again, using only public APIs: it measures the rendered height and reuses a per-path cached height while scrolling backward, so cards above the viewport cannot resize and jump the list. The cache resets with the file list.

Final build versus 0.13.0, 1,000 notes, median of 3 trials: single load 686 vs 733 ms, masonry 721 vs 725 ms, editor opens 799 vs 803 (single) and 1,217 vs 1,209 (masonry), peak heap 163 vs 162 MB (single) and 184 vs 179 MB (masonry), 0 editors left open after scrolling in both. 100 notes: load 129 vs 123 ms, 223 vs 222 editors. Both builds blank frames during fast full-range scrolling; this is not a regression. 5,000 and 10,000 note native runs and iOS were not measured.
