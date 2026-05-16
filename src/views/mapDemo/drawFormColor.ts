/**
 * 地图标绘示例表单：将 Cesium `toCssColorString()` 常见的 `rgba(...)` / `#RRGGBBAA` 等
 * 规范为 color 控件用的 `#rrggbb` 与独立 alpha，避免仅用 `normalizeHex` 时回显落到默认色。
 */

export function normalizeHex(css: string, fallback: string): string {
  const t = css.trim()
  if (/^#[0-9a-fA-F]{6}$/i.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{8}$/i.test(t)) return `#${t.slice(1, 7)}`.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/i.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

export function parseCssColorForForm(
  css: string | undefined,
  fallbackHex: string,
): { hex: string; alpha: number } {
  if (!css || typeof css !== 'string') return { hex: fallbackHex, alpha: 1 }
  const t = css.trim()
  const rgba = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
  if (rgba) {
    const r = Math.min(255, Math.max(0, Math.round(Number(rgba[1]))))
    const g = Math.min(255, Math.max(0, Math.round(Number(rgba[2]))))
    const b = Math.min(255, Math.max(0, Math.round(Number(rgba[3]))))
    const a = rgba[4] !== undefined && rgba[4] !== '' ? Number(rgba[4]) : 1
    if ([r, g, b].every((x) => Number.isFinite(x))) {
      const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toLowerCase()
      return { hex, alpha: Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1 }
    }
  }
  if (/^#[0-9a-fA-F]{3}$/i.test(t) || /^#[0-9a-fA-F]{6}$/i.test(t)) {
    return { hex: normalizeHex(t, fallbackHex), alpha: 1 }
  }
  if (/^#[0-9a-fA-F]{8}$/i.test(t)) {
    const hex6 = `#${t.slice(1, 7)}`.toLowerCase()
    const aByte = parseInt(t.slice(7, 9), 16)
    const alpha = Number.isFinite(aByte) ? Math.min(1, Math.max(0, aByte / 255)) : 1
    return { hex: normalizeHex(hex6, fallbackHex), alpha }
  }
  return { hex: fallbackHex, alpha: 1 }
}
