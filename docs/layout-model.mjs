// Generic read-only physical key-position renderer for ZMK keymap JSON.
export function layoutPositions(layoutFile, transform = "default_transform") {
  const keys = layoutFile?.layouts?.[transform]?.layout ?? layoutFile?.layout;
  if (!Array.isArray(keys) || !keys.length || keys.length > 300) {
    throw new Error("Layout must contain a nonempty array of physical keys");
  }
  const seen = new Set();
  return keys.map((key, index) => {
    const { row, col, x, y } = key;
    if (![row, col, x, y].every(Number.isFinite) ||
      ![row, col].every(Number.isInteger)) throw new Error("Invalid physical key at index " + index);
    const unique = row + ":" + col;
    if (seen.has(unique)) throw new Error("Duplicate physical row/col " + unique);
    seen.add(unique);
    const w = key.w ?? 1;
    const h = key.h ?? 1;
    const r = key.r ?? 0;
    const rx = key.rx ?? 0;
    const ry = key.ry ?? 0;
    if (![w, h, r, rx, ry].every(Number.isFinite) || w <= 0 || h <= 0) {
      throw new Error("Invalid key dimensions/rotation at index " + index);
    }
    return { row, col, x, y, w, h, r, rx, ry };
  });
}
function rotatePoint(x, y, degrees, ox, oy) {
  const rad = degrees * Math.PI / 180;
  const dx = x - ox, dy = y - oy;
  return { x: ox + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: oy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}
export function layoutGeometry(positions, unit = 64, padding = 20) {
  if (!Array.isArray(positions) || !positions.length) throw new Error("No positions");
  const normalized = positions.map(key => {
    const center = rotatePoint(key.x + key.w / 2, key.y + key.h / 2, key.r, key.rx, key.ry);
    const corners = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([a,b]) =>
      rotatePoint(center.x + a * key.w, center.y + b * key.h, key.r, center.x, center.y));
    return { ...key, center, corners };
  });
  const corners = normalized.flatMap(k => k.corners);
  const minX = Math.min(...corners.map(p => p.x)), minY = Math.min(...corners.map(p => p.y));
  const maxX = Math.max(...corners.map(p => p.x)), maxY = Math.max(...corners.map(p => p.y));
  return { width: Math.ceil((maxX - minX) * unit + 2 * padding),
    height: Math.ceil((maxY - minY) * unit + 2 * padding),
    keys: normalized.map(k => ({
      ...k,
      left: (k.center.x - k.w / 2 - minX) * unit + padding,
      top: (k.center.y - k.h / 2 - minY) * unit + padding,
      width: k.w * unit, height: k.h * unit,
    })) };
}
