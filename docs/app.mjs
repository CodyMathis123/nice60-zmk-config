import { parseKeymap, ROW_WIDTHS, effectiveBinding, layerTarget } from "./keymap-model.mjs";

const $ = (id) => document.getElementById(id);
const keyAliases = {
  BSPC: "Backspace", RET: "Enter", TAB: "Tab", CLCK: "Caps Lock", ESC: "Esc",
  MINUS: "-", EQUAL: "=", LBKT: "[", RBKT: "]", BSLH: "\\", SEMI: ";",
  SQT: "'", FSLH: "/", COMMA: ",", DOT: ".", SPACE: "Space", DEL: "Delete",
  LSHFT: "Shift", RSHFT: "Shift", LCTRL: "Ctrl", RCTRL: "Ctrl",
  LGUI: "Win", RGUI: "Win", LALT: "Alt", RALT: "Alt",
  LEFT: "Left", RIGHT: "Right", UP: "Up", DOWN: "Down",
  PG_DN: "Page Down", PG_UP: "Page Up", HOME: "Home", END: "End",
};
const rgbAliases = {
  RGB_TOG: "RGB toggle", RGB_EFR: "Effect −", RGB_EFF: "Effect +",
  RGB_HUI: "Hue +", RGB_HUD: "Hue −", RGB_SAI: "Saturation +",
  RGB_SAD: "Saturation −", RGB_BRI: "Brightness +", RGB_BRD: "Brightness −",
  RGB_SPI: "Speed +", RGB_SPD: "Speed −",
};
const shortAliases = {
  "Backspace": "Bksp", "Caps Lock": "Caps", "Page Down": "PgDn",
  "Page Up": "PgUp", "Delete": "Del", "Enter": "Enter", "Space": "Space",
  "RGB toggle": "RGB on/off", "Brightness +": "Bright +",
  "Brightness −": "Bright −", "Saturation +": "Sat +",
  "Saturation −": "Sat −",
};
function nameOf(key) {
  const wrapped = /^L([CASG])\((.+)\)$/.exec(key);
  if (wrapped) {
    const mod = { C: "Ctrl", A: "Alt", S: "Shift", G: "Win" }[wrapped[1]];
    return mod + "+" + nameOf(wrapped[2]);
  }
  if (/^N\d$/.test(key)) return key.slice(1);
  return keyAliases[key] || key;
}
function shortened(label) { return shortAliases[label] || label; }
function layerName(token, model) {
  const index = /^\d+$/.test(token) ? Number(token) : model.macros[token];
  return model.layers[index] ? model.layers[index].name : token;
}
function describe(binding, model) {
  const parts = binding.split(/\s+/);
  const behavior = parts[0];
  const target = layerTarget(binding, model);
  if (behavior === "&kp") {
    const name = nameOf(parts.slice(1).join(" "));
    return { main: shortened(name), sub: "", detail: "Send " + name + ".", kind: "normal", target };
  }
  if (behavior === "&gresc") return {
    main: "Esc / \u0060", sub: "Grave Escape",
    detail: "Grave Escape behavior: Escape or grave/tilde depending on modifier state.",
    kind: "normal", target
  };
  if (behavior === "&hm") {
    const held = nameOf(parts[1]); const tapped = nameOf(parts[2]);
    return { main: shortened(tapped), sub: "hold " + held,
      detail: "Home-row hold-tap: tap " + tapped + "; hold " + held + " modifier. Behavior timing comes from the ZMK configuration.",
      kind: "normal", target };
  }
  if (behavior === "&lt") {
    const layer = layerName(parts[1], model); const tapped = nameOf(parts[2]);
    return { main: shortened(tapped), sub: "hold " + layer,
      detail: "Layer-tap: tap " + tapped + ", or hold to activate the " + layer + " layer. Click to preview " + layer + ".",
      kind: "layer", target };
  }
  if (["&mo", "&to", "&tog", "&sl"].includes(behavior)) {
    const layer = layerName(parts[1], model);
    const actions = {
      "&mo": "Momentarily activate", "&to": "Switch to",
      "&tog": "Toggle", "&sl": "Sticky activation of"
    };
    return { main: layer, sub: behavior.slice(1).toUpperCase(),
      detail: actions[behavior] + " the " + layer + " layer. Click to preview it; the preview does not send a keypress.",
      kind: "layer", target };
  }
  if (behavior === "&rgb_ug") {
    const name = rgbAliases[parts[1]] || parts[1] || "RGB";
    return { main: shortened(name), sub: "RGB", detail: "Underglow control: " + name + ".", kind: "special", target };
  }
  if (behavior === "&bt") {
    const action = parts[1] === "BT_CLR" ? "Clear Bluetooth pairing" :
      parts[1] === "BT_SEL" ? "Select Bluetooth profile " + (Number(parts[2]) + 1) : binding;
    const label = parts[1] === "BT_CLR" ? "BT clear" :
      parts[1] === "BT_SEL" ? "BT " + (Number(parts[2]) + 1) : "Bluetooth";
    return { main: label, sub: "Bluetooth", detail: action + ".", kind: "special", target };
  }
  if (behavior === "&none") return { main: "Disabled", sub: "", detail: "No key action.", kind: "normal", target };
  if (behavior === "&trans") return { main: "Transparent", sub: "", detail: "No lower layer supplies a binding.", kind: "normal", target };
  return { main: behavior.replace(/^&/, ""), sub: parts.slice(1).join(" "),
    detail: "Raw ZMK binding: " + binding + ". See the source for behavior-specific semantics.",
    kind: "normal", target };
}

let model;
let activeLayer = 0;
let selectedKey = null;
function node(tag, cls, text) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
}
function renderDetails() {
  const title = $("detail-title");
  const description = $("detail-description");
  const raw = $("detail-raw");
  raw.replaceChildren();
  if (selectedKey === null) {
    title.textContent = "Select any key";
    description.textContent = "Click a key to inspect its ZMK behavior. Layer controls also take you to the destination layer.";
    return;
  }
  const result = effectiveBinding(model, activeLayer, selectedKey);
  const display = describe(result.binding, model);
  title.textContent = display.main;
  description.textContent = display.detail +
    (result.inherited ? " Inherited from " + model.layers[result.sourceLayer].name + "." : "");
  raw.appendChild(node("code", "raw", result.binding));
}
function render() {
  $("active-name").textContent = model.layers[activeLayer].name;
  const tabs = $("layer-tabs");
  tabs.replaceChildren();
  model.layers.forEach((layer, index) => {
    const tab = node("button", "tab", layer.name);
    tab.type = "button";
    tab.setAttribute("aria-pressed", String(activeLayer === index));
    tab.addEventListener("click", () => { activeLayer = index; selectedKey = null; render(); });
    tabs.appendChild(tab);
  });
  const keyboard = $("keyboard");
  keyboard.replaceChildren();
  let offset = 0;
  ROW_WIDTHS.forEach((widths, rowIndex) => {
    const row = node("div", "keyrow");
    row.setAttribute("aria-label", "Keyboard row " + (rowIndex + 1));
    widths.forEach((width, colIndex) => {
      const index = offset + colIndex;
      const result = effectiveBinding(model, activeLayer, index);
      const display = describe(result.binding, model);
      const original = model.layers[activeLayer].bindings[index];
      const key = node("button", "key");
      key.type = "button";
      key.style.flex = String(width) + " 1 0%";
      if (result.inherited) key.classList.add("inherited");
      if (display.kind === "layer") key.classList.add("layer-key");
      if (display.kind === "special") key.classList.add("special-key");
      if (selectedKey === index) key.classList.add("selected");
      key.appendChild(node("span", "key-main", display.main));
      if (display.sub || result.inherited) {
        key.appendChild(node("span", "key-sub", result.inherited ? "↳ " + model.layers[result.sourceLayer].name : display.sub));
      }
      key.title = result.binding + (result.inherited ? " (inherited)" : "");
      key.setAttribute("aria-label", "Row " + (rowIndex + 1) + ", key " + (colIndex + 1) +
        ": " + display.main + ". " + display.detail);
      if (original === "&trans") key.dataset.inherited = "true";
      key.addEventListener("click", () => {
        selectedKey = index;
        if (display.target !== null) activeLayer = display.target;
        render();
      });
      row.appendChild(key);
    });
    offset += widths.length;
    keyboard.appendChild(row);
  });
  renderDetails();
}

async function load() {
  try {
    const response = await fetch("./nice60.keymap", { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    model = parseKeymap(await response.text());
    if (model.keyCount !== 61) throw new Error("Unexpected key count");
    $("status").hidden = true;
    $("viewer").hidden = false;
    render();
  } catch (error) {
    $("status").textContent = "Unable to load the keymap: " + error.message +
      ". Publish the site through the repository workflow or serve the generated _site directory.";
  }
}
load();
