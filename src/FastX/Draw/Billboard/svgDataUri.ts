/** 将 SVG 标记串转为 Cesium 可用的 data URI（支持 UTF-8 文本） */
export function svgMarkupToDataUri(svg: string): string {
  const t = svg.trim()
  if (!t) return ''
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`
}
