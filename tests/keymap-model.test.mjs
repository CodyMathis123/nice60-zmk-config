import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseKeymap, KEY_COUNT, ROW_WIDTHS, layerTarget, effectiveBinding } from "../docs/keymap-model.mjs";

const input = readFileSync(new URL("../config/nice60.keymap", import.meta.url), "utf8");
const model = parseKeymap(input);

test("nice!60 physical layout has 61 positions and 15u rows", () => {
  assert.equal(KEY_COUNT, 61);
  assert.deepEqual(ROW_WIDTHS.map((row) => row.length), [14, 14, 13, 12, 8]);
  assert.ok(ROW_WIDTHS.every((row) => row.reduce((a, b) => a + b, 0) === 15));
});

test("all four layers parse in defined order without losing bindings", () => {
  assert.deepEqual(model.layers.slice(0, 4).map((layer) => layer.symbol), ["QWERTY", "RGB", "GAME", "NAV"]);
  assert.ok(model.layers.every((layer) => layer.bindings.length === KEY_COUNT));
  assert.equal(model.layers[0].bindings[0], "&gresc");
  assert.equal(model.layers[0].bindings[28], "&lt NAV CLCK");
});

test("layer selectors resolve symbolic and numeric references", () => {
  assert.equal(layerTarget("&mo RGB", model), 1);
  assert.equal(layerTarget("&to GAME", model), 2);
  assert.equal(layerTarget("&lt NAV CLCK", model), 3);
  assert.equal(layerTarget("&bt BT_SEL 0", model), null);
  assert.equal(layerTarget("&kp LC(Y)", model), null);
});

test("transparent positions inherit base layer bindings", () => {
  assert.deepEqual(effectiveBinding(model, 1, 15),
    { binding: "&kp Q", sourceLayer: 0, inherited: true });
  assert.deepEqual(effectiveBinding(model, 0, 15),
    { binding: "&kp Q", sourceLayer: 0, inherited: false });
  assert.deepEqual(effectiveBinding(model, 1, 0),
    { binding: "&bt BT_CLR", sourceLayer: 1, inherited: false });
});

test("a transparent NAV key falls through to base, not inactive GAME", () => {
  const altered = structuredClone(model);
  altered.layers[2].bindings[28] = "&kp X";
  assert.deepEqual(effectiveBinding(altered, 3, 28),
    { binding: "&lt NAV CLCK", sourceLayer: 0, inherited: true });
});

test("invalid/incomplete keymap fails rather than silently shifting keys", () => {
  const modified = input.replace("&kp N1", "");
  assert.throws(() => parseKeymap(modified), /expected 61 bindings/i);
});
