import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { parseKeymap } from "../docs/keymap-model.mjs";

const source = await readFile("config/nice60.keymap", "utf8");
const model = parseKeymap(source);
if (model.layers.length !== 4 || model.keyCount !== 61) {
  throw new Error("Unexpected nice!60 layout; review viewer layout before publishing");
}
await mkdir("_site", { recursive: true });
for (const file of ["index.html", "app.mjs", "keymap-model.mjs"]) {
  await copyFile("docs/" + file, "_site/" + file);
}
await copyFile("config/nice60.keymap", "_site/nice60.keymap");
await writeFile("_site/.nojekyll", "");
console.log("Validated " + model.layers.length + " layers and " + model.keyCount + " keys per layer.");
