import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { parseKeymap } from "../docs/keymap-model.mjs";
import { layoutPositions, layoutGeometry } from "../docs/layout-model.mjs";

const configPath = process.argv[2] ?? "config/keymap-viewer.json";
const settings = JSON.parse(await readFile(configPath, "utf8"));
if (!settings.name || !settings.description ||
    !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(settings.repository || "") ||
    !settings.keymap || !settings.layout) {
  throw new Error("Viewer configuration needs name, description, repository, keymap, and layout");
}
const layout = JSON.parse(await readFile(settings.layout, "utf8"));
const keys = layoutPositions(layout, settings.layoutName ?? "default_transform");
layoutGeometry(keys); // Validate all geometry before publishing.
const source = await readFile(settings.keymap, "utf8");
const model = parseKeymap(source, { keyCount: keys.length });
await mkdir("_site", { recursive: true });
for (const file of ["index.html", "app.mjs", "keymap-model.mjs", "layout-model.mjs"]) {
  await copyFile(new URL("../docs/" + file, import.meta.url), "_site/" + file);
}
await copyFile(settings.keymap, "_site/keymap.keymap");
await copyFile(settings.layout, "_site/layout.json");
await writeFile("_site/viewer-config.json", JSON.stringify(settings, null, 2) + "\n");
await writeFile("_site/.nojekyll", "");
console.log("Validated " + settings.name + ": " + model.layers.length +
  " layers × " + model.keyCount + " keys. Static read-only viewer packaged in _site/.");
