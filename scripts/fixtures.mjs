import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const sizes = [100, 1000, 5000, 10000];
export function noteName(i) {
  return i < 28 ? "2025-01-" + String(i + 1).padStart(2, "0") : "Note " + i;
}
export function makeEntries(size) {
  return Array.from({ length: size }, (_, j) => {
    const i = j * 7919 % size;
    const basename = noteName(i);
    return { file: { basename, path: "Notes/" + basename + ".md", extension: "md" } };
  });
}
export function noteText(i) {
  return [
    "---", "kind: fixture", "rank: " + i, "tags: [feed-benchmark]", "---",
    "# " + noteName(i), "", "Editable text for note " + i + ".",
    ...(i % 10 === 0 ? Array.from({ length: 150 }, (_, j) => "Paragraph " + j + ": " + "Long note text. ".repeat(12)) : []),
    ...(i % 4 === 0 ? ["![[fixture.svg]]", "![Image](../fixture.svg)"] : []),
    ...(i % 5 === 0 ? ["![[Notes/" + noteName(i === 0 ? 1 : 0) + "]]", "[[Notes/" + noteName(1) + "]]"] : []),
    "", "- [ ] Editable task", ""
  ].join("\n");
}
export async function generateVault(parent, size) {
  if (!sizes.includes(size)) throw new Error("Unsupported dataset size");
  const dir = join(resolve(parent), "feed-" + size);
  // Refuse to overwrite an existing vault.
  await mkdir(dir);
  await mkdir(join(dir, "Notes"));
  await writeFile(join(dir, "fixture.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#6699aa"/></svg>');
  for (let i = 0; i < size; i++) {
    await writeFile(join(dir, "Notes", noteName(i) + ".md"), noteText(i));
  }
  return dir;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const parent = process.argv[2];
  if (!parent) throw new Error("Usage: node scripts/fixtures.mjs OUTPUT_DIRECTORY");
  await mkdir(parent, { recursive: true });
  for (const size of sizes) console.log(await generateVault(parent, size));
}
