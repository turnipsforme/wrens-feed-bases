# Feed performance baseline (AAE + Ponytail)

Original production revision: a45502b1844608711cf29c1494ec6ffbce610dcb (0.13.0).
No production changes in this branch. No new dependencies. The release workflow still builds via Bun and publishes main.js, manifest.json and styles.css on tags; no release is authorized by this baseline.

## Reproduce

- bun install --frozen-lockfile
- bun run build
- node --test tests/*.test.mjs
- node --expose-gc scripts/benchmark.mjs > benchmark.json
- node scripts/fixtures.mjs /path/to/new/output

The fixture generator creates four separate vault directories (100, 1,000, 5,000 and 10,000 notes), with YAML, tasks, long notes, local SVG images and note embeds. It refuses to overwrite existing vaults. Open one directory as an Obsidian vault, enable Bases and the plugin, create a Base outside Notes filtered to the Notes folder, and select Feed.

Mock timings execute the production FeedView query path and build React element objects, not actual React rendering, Obsidian editor initialization or browser layout. Mock heap samples include harness activity and are not peak native memory. Build sizes are real artifact sizes. Node version, platform, raw samples, median and p95 are recorded. The mocked baseline is pending CI; no results have been invented.

## Native protocol

On each desktop and physical iOS device, record Obsidian version, OS, hardware, refresh rate, theme, enabled plugins and viewport. Use a separate copy of the same fixture vault for each revision, production build, identical configuration and no other community plugins. Test single-column, masonry, properties on/off and default/configured sorting.

Use two warmups and at least seven measured trials per scenario. Alternate baseline and candidate order on the same device; report medians, p95 and raw measurements. Separate cold app launch from warm view creation. Measure from query notification/view opening until visible editors are loaded; measure query notification to updated visible cards. Use development-only instrumentation equally on both revisions for native editor creation/close counts and React Profiler commit counts. For scrolling, capture frame intervals over the same scripted or reproducible gesture sequence and report frames exceeding device frame budget and missed refresh intervals (not equivalent to exact compositor drops). On desktop use DevTools performance/heap recordings; on iOS use Safari Web Inspector if available and Instruments/device memory tools where supported. Record process peak and retained memory after repeated open/scroll/close cycles, idle and GC where available; report unavailable counters rather than substitute Node metrics.

Correctness gates: identical files/order for all configured sort keys and fallback; edit/save/reopen, rapid scroll and filtering during typing, focused editor behavior, links, tasks, embeds/images, frontmatter visibility, daily titles, hidden H1, width/full width, masonry resizing and context menus; no orphan editor or extra reopen history. Native editing and saving are mandatory, not replaced by static cards.

## Hypotheses (not tested)

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

For each experiment record prediction before implementation, one isolated commit, compare against original and current best, run correctness tests before timing, and retain only reproducible improvements beyond noise (target >=10%). Compare paired ratios and geometric mean across dataset sizes; report each size and avoid averaging away regressions. Export each accepted commit as a numbered patch and record rejected outcomes too. No accepted production changes, no numbered patches, and no PDF experiment report yet because no experiment is complete. No upstream knowledge-base contribution authorized.

References: https://github.com/CHSZLab/AgenticAlgorithmEngineering/blob/main/AAE.md and https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md.
