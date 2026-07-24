import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'

/** 地形分析栅格贴图图层参数 */
export interface TerrainRasterOverlayOptions {
  /** 整体透明度，0~1 */
  alpha?: number
  /** 是否显示图层 */
  show?: boolean
  /** 插入到影像图层集合中的位置；不传则追加到最上层 */
  insertIndex?: number
}

/**
 * 将 canvas 作为单张影像贴到指定经纬度矩形上。
 * @param viewer Cesium Viewer
 * @param canvas 已绘制分析结果的 canvas
 * @param rectangle 贴图覆盖范围
 * @param options 图层显示参数
 */
export async function createTerrainRasterOverlay(
  viewer: Viewer,
  canvas: HTMLCanvasElement,
  rectangle: Cesium.Rectangle,
  options: TerrainRasterOverlayOptions = {},
): Promise<Cesium.ImageryLayer> {
  const provider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
    rectangle,
  })
  const layer = viewer.imageryLayers.addImageryProvider(provider, options.insertIndex)
  layer.alpha = options.alpha ?? 1
  layer.show = options.show ?? true
  return layer
}

/**
 * 从场景中移除地形分析贴图图层。
 * @param viewer Cesium Viewer
 * @param layer 待移除的影像图层
 */
export function removeTerrainRasterOverlay(viewer: Viewer, layer: Cesium.ImageryLayer | null): void {
  if (!layer || viewer.isDestroyed()) return
  try {
    viewer.imageryLayers.remove(layer, true)
  } catch {
    // 图层已被外部清理时忽略，保证分析实例自身清理不抛错。
  }
}
