// A deliberately read-only parser for the ZMK keymap used by this repository.
// It does not preprocess C, compile firmware, or modify the source.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\r\n]*/g, "");
}

function blockAt(source, open) {
  if (source[open] !== "{") throw new Error("Expected opening brace");
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return { body: source.slice(open + 1, i), end: i + 1 };
  }
  throw new Error("Unclosed keymap block");
}

function extractBindings(body, name, keyCount) {
  const match = /\bbindings\s*=\s*<([\s\S]*?)>\s*;/.exec(body);
  if (!match) throw new Error("Missing bindings in " + name);
  const data = match[1];
  const starts = [...data.matchAll(/&[A-Za-z_][\w]*/g)].map((m) => m.index);
  if (!starts.length) throw new Error("No bindings in " + name);
  const bindings = starts.map((start, i) =>
    data.slice(start, i + 1 < starts.length ? starts[i + 1] : data.length).trim()
  );
  if (bindings.length !== keyCount) {
    throw new Error(name + ": expected " + keyCount + " bindings, found " + bindings.length);
  }
  return bindings;
}

export function parseKeymap(source, { keyCount } = {}) {
  if (!Number.isInteger(keyCount) || keyCount < 1 || keyCount > 300) throw new RangeError("Invalid expected key count");
  if (typeof source !== "string") throw new TypeError("Keymap source must be text");
  const macros = new Map([...source.matchAll(/^\s*#define\s+([A-Za-z_]\w*)\s+(\d+)\b/gm)]
    .map((m) => [m[1], Number(m[2])]));
  const cleaned = stripComments(source);
  const keymapMatch = /\bkeymap\s*\{/.exec(cleaned);
  if (!keymapMatch) throw new Error("No keymap node found");
  const keymapOpen = cleaned.indexOf("{", keymapMatch.index);
  const keymapBody = blockAt(cleaned, keymapOpen).body;
  const layers = [];
  const nodes = /\b([A-Za-z_]\w*)\s*\{/g;
  let match;
  while ((match = nodes.exec(keymapBody)) !== null) {
    const open = keymapBody.indexOf("{", match.index);
    const block = blockAt(keymapBody, open);
    nodes.lastIndex = block.end;
    if (!/\bbindings\s*=/.test(block.body)) continue;
    const node = match[1];
    const symbol = node.replace(/_layer$/, "").toUpperCase();
    const display = /\bdisplay-name\s*=\s*"([^"]+)"/.exec(block.body);
    layers.push({
      id: layers.length,
      node,
      symbol,
      name: display ? display[1] : symbol,
      bindings: extractBindings(block.body, node, keyCount),
    });
  }
  if (!layers.length) throw new Error("No keymap layers found");
  for (const layer of layers) {
    if (macros.has(layer.symbol) && macros.get(layer.symbol) !== layer.id) {
      throw new Error("Layer index mismatch for " + layer.symbol);
    }
  }
  const customBehaviors = {};
  const definitions = /([A-Za-z_]\w*)\s*:\s*[A-Za-z_]\w*\s*\{([^{}]*?)\};/g;
  let definition;
  while ((definition = definitions.exec(cleaned)) !== null) {
    const compatible = /compatible\s*=\s*"zmk,behavior-(mod-morph|tap-dance)"/.exec(definition[2]);
    const actions = /bindings\s*=\s*<([^>]+)>\s*,\s*<([^>]+)>/.exec(definition[2]);
    if (compatible && actions) {
      customBehaviors[definition[1]] = {
        type: compatible[1],
        actions: [actions[1].trim(), actions[2].trim()],
      };
    }
  }
  return { layers, macros: Object.fromEntries(macros), keyCount, customBehaviors };
}

export function layerTarget(binding, keymap) {
  const match = /^&(mo|to|tog|lt|sl)\s+([A-Za-z_]\w*|\d+)\b/.exec(binding);
  if (!match) return null;
  const token = match[2];
  const index = /^\d+$/.test(token) ? Number(token) : keymap.macros[token];
  return Number.isInteger(index) && keymap.layers[index] ? index : null;
}

export function effectiveBinding(keymap, selectedLayer, keyIndex) {
  if (!keymap.layers[selectedLayer] || keyIndex < 0 || keyIndex >= keymap.keyCount) {
    throw new RangeError("Invalid layer or key index");
  }
  const binding = keymap.layers[selectedLayer].bindings[keyIndex];
  if (binding !== "&trans") return { binding, sourceLayer: selectedLayer, inherited: false };
  // Only the selected layer and base are assumed active in this preview.
  // Intermediate layer numbers are not necessarily active in ZMK.
  const base = keymap.layers[0].bindings[keyIndex];
  if (selectedLayer > 0 && base !== "&trans") {
    return { binding: base, sourceLayer: 0, inherited: true };
  }
  return { binding: "&trans", sourceLayer: null, inherited: false };
}
