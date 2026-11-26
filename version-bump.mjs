import { readFile, writeFile } from "node:fs/promises";

// Read version from package.json
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const targetVersion = packageJson.version;

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
await writeFile("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
// but only if the target version is not already in versions.json
const versions = JSON.parse(await readFile("versions.json", "utf8"));
if (!Object.hasOwnProperty.call(versions, targetVersion)) {
  versions[targetVersion] = minAppVersion;
  await writeFile("versions.json", JSON.stringify(versions, null, "\t"));
}
