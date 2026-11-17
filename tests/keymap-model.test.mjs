import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseKeymap, layerTarget, effectiveBinding } from "../docs/keymap-model.mjs";
import { layoutPositions, layoutGeometry } from "../docs/layout-model.mjs";

const input = readFileSync(new URL("../config/nice60.keymap", import.meta.url), "utf8");
const layout = JSON.parse(readFileSync(new URL("../config/nice60-layout.json", import.meta.url), "utf8"));
const positions = layoutPositions(layout);
const model = parseKeymap(input, { keyCount: positions.length });

test("nice!60 layout has 61 positions, 15u physical rows", () => {
  assert.equal(positions.length, 61);
  const rows = Array.from({ length: 5 }, (_, r) => positions.filter(k => k.row === r));
  assert.deepEqual(rows.map(r => r.length), [14,14,13,12,8]);
  assert.ok(rows.every(r => r.reduce((a,k) => a+k.w, 0) === 15));
  const bounds = layoutGeometry(positions);
  assert.ok(bounds.width > bounds.height);
});

test("all four layers parse in order without losing bindings", () => {
  assert.deepEqual(model.layers.slice(0, 4).map(l => l.symbol), ["QWERTY", "RGB", "GAME", "NAV"]);
  assert.ok(model.layers.every(l => l.bindings.length === positions.length));
  assert.equal(model.layers[0].bindings[0], "&gresc");
  assert.equal(model.layers[0].bindings[28], "&lt NAV CLCK");
});

test("layer selectors resolve symbolic and numeric targets", () => {
  assert.equal(layerTarget("&mo RGB", model), 1);
  assert.equal(layerTarget("&to GAME", model), 2);
  assert.equal(layerTarget("&lt NAV CLCK", model), 3);
  assert.equal(layerTarget("&bt BT_SEL 0", model), null);
});

test("transparent positions inherit base layer, not inactive intermediate layer", () => {
  assert.deepEqual(effectiveBinding(model, 1, 15),
    { binding: "&kp Q", sourceLayer: 0, inherited: true });
  const altered = structuredClone(model);
  altered.layers[2].bindings[28] = "&kp X";
  altered.layers[3].bindings[28] = "&trans";
  assert.deepEqual(effectiveBinding(altered, 3, 28),
    { binding: "&lt NAV CLCK", sourceLayer: 0, inherited: true });
});

test("invalid/incomplete keymaps fail safely", () => {
  assert.throws(() => parseKeymap(input.replace("&kp N1", ""), { keyCount: positions.length }),
    /expected 61 bindings/i);
  assert.throws(() => parseKeymap(input), /invalid expected key count/i);
});

test("custom mod-morph and tap-dance behaviors are detected without compiling", () => {
  const source = [
    "#define BASE 0",
    '/ { behaviors { morph: morph { compatible = "zmk,behavior-mod-morph";',
    'bindings = <&kp BSPC>, <&kp DEL>; }; };',
    'keymap { base { bindings = <&morph &kp A>; }; }; };'
  ].join("\n");
  const parsed = parseKeymap(source, { keyCount: 2 });
  assert.deepEqual(parsed.customBehaviors.morph,
    { type: "mod-morph", actions: ["&kp BSPC", "&kp DEL"] });
  assert.equal(parsed.layers[0].bindings[0], "&morph");
});

test("rotated Cornelius thumb positions produce finite, expanded bounds", () => {
  const thumbs = layoutPositions({ layout: [
    { row: 0, col: 0, x: 0, y: 0 },
    { row: 0, col: 1, x: 3.48, y: 3.125, r: 30, rx: 3.02, ry: 7.695 },
  ] });
  const bounds = layoutGeometry(thumbs);
  assert.ok(bounds.width > 100 && bounds.height > 100);
  assert.ok(bounds.keys.every(k => [k.left,k.top,k.width,k.height].every(Number.isFinite)));
});
