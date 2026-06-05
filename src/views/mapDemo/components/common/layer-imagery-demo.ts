/**
 * 图层渲染示例 — WMTS / WMS / Image 影像加载。
 *
 * 三个页面均读取 `window.apiConfig.imageryProvider`，先清空影像层、等待 2 秒后再按各自 API 挂载。
 */
import type { Layer } from '../../../../FastX/Layer'
import { resolveMapBaseUrls } from '../../../../config/map-runtime'
import { clearAllViewerImagery, delay, isXyzTemplateUrl } from './layer-demo-utils'

export type ImageryDemoMode = 'wmts' | 'wms' | 'image'

/** 当前 config 中的影像 URL 模板 */
export function getConfigImageryUrl(): string {
  return resolveMapBaseUrls().imageryUrlTemplate
}

/**
 * 清空全部影像 → 等待 2s → 按模式加载 config 影像。
 * XYZ 模板时 WMTS/WMS 页亦走 UrlTemplate（原生 WMTS/WMS 无法直接消费 `{z}/{x}/{y}`）。
 */
export async function reloadConfigImageryLayer(layer: Layer, mode: ImageryDemoMode) {
  const viewer = layer.getViewer()
  if (!viewer) throw new Error('地图未就绪')

  clearAllViewerImagery(viewer)
  await delay(2000)

  const url = getConfigImageryUrl()
  if (mode === 'image' || isXyzTemplateUrl(url)) {
    return layer.addImageryFromUrlTemplate({ url })
  }
  if (mode === 'wms') {
    return layer.addImageryFromWms({
      url,
      layers: '0',
      parameters: { transparent: true, format: 'image/png' },
    })
  }
  return layer.addImageryFromWmts({
    url,
    layer: 'default',
    style: 'default',
    format: 'image/png',
    tileMatrixSetID: 'GoogleMapsCompatible',
  })
}
