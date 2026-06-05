/**
 * 图层渲染示例 — 影像加载通用工具（WMTS/WMS/Image 共用）。
 */
import * as Cesium from 'cesium'

/** 等待指定毫秒（用于「清图层 → 停顿 → 再加载」演示） */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 是否为 XYZ 瓦片模板 URL（含 `{z}/{x}/{y}` 占位符） */
export function isXyzTemplateUrl(url: string): boolean {
  return /\{z\}/i.test(url) || /\{x\}/i.test(url) || /\{y\}/i.test(url)
}

/** 移除 viewer 上全部影像层（含初始底图） */
export function clearAllViewerImagery(viewer: Cesium.Viewer): void {
  while (viewer.imageryLayers.length > 0) {
    viewer.imageryLayers.remove(viewer.imageryLayers.get(0)!, true)
  }
}
