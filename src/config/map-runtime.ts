const FALLBACK_IMAGERY = 'http://localhost:98/qqhr_satellite/{z}/{x}/{y}.png'
const FALLBACK_TERRAIN = 'http://localhost:98/taiwan_dem'

/** 读取 `window.apiConfig`（由 `/config.js` 注入）与内置兜底，供 `x-map` / 业务初始化。 */
export function resolveMapBaseUrls(): { imageryUrlTemplate: string; terrainUrl: string } {
  const c = typeof window !== 'undefined' ? window.apiConfig : undefined
  return {
    imageryUrlTemplate: c?.imageryProvider ?? FALLBACK_IMAGERY,
    terrainUrl: c?.terrainProvider ?? FALLBACK_TERRAIN,
  }
}
