/**
 * 图层渲染示例 — 公共工具与生命周期清理。
 *
 * - `fastxDataUrl`：解析 public 下的 json / models 资源
 * - `useLayerDemoCleanup`：各 layer-*.vue 共享的加载/卸载清理（影像、网格、实体、探测圆锥）
 */
import * as Cesium from 'cesium'
import { message } from 'ant-design-vue'
import { onBeforeUnmount } from 'vue'
import type { Layer } from '../../../FastX/Layer'
import { useMapLayerStore } from '../../../stores/modules/mapLayer'

function normalizeFastxDataPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '')
    .replace(/^src\/FastX\/build\/Data\//, '')
    .replace(/^FastX\/build\/Data\//, '')
    .replace(/^Data\//, '')
}

export function fastxDataUrl(relativePath: string): string {
  const rel = normalizeFastxDataPath(relativePath)
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  const encodedRel = rel.split('/').map(encodeURIComponent).join('/')
  return `${base}${encodedRel}`
}

/** 飞行至 DataSource 包围范围 */
export async function flyToDataSource(viewer: Cesium.Viewer, ds: Cesium.DataSource): Promise<void> {
  if (viewer.isDestroyed()) return
  await viewer.flyTo(ds, { duration: 1.6 })
}

/** 图层示例页 composable：跟踪叠加资源，组件卸载或点击清除时统一回收 */
export function useLayerDemoCleanup() {
  const map = useMapLayerStore()
  const overlays: Cesium.ImageryLayer[] = []
  const trackedEntities: Cesium.Entity[] = []
  let lonLatGridTracked = false
  /** 卫星探测圆锥 preRender 监听的 dispose */
  let sensorDispose: (() => void) | undefined

  function getLayer(): Layer | null {
    const layer = map.getLayer()
    if (!layer) message.warning('地图尚未就绪')
    return layer ?? null
  }

  function trackImagery(imageryLayer: Cesium.ImageryLayer): void {
    overlays.push(imageryLayer)
  }

  function trackEntities(entities: Cesium.Entity[]): void {
    trackedEntities.push(...entities)
  }

  function trackLonLatGrid(): void {
    lonLatGridTracked = true
  }

  /** 注册探测圆锥销毁函数（切换示例或清除时调用） */
  function trackSensorCones(dispose: () => void): void {
    sensorDispose?.()
    sensorDispose = dispose
  }

  function cleanup(): void {
    const layer = map.getLayer()
    const viewer = map.getViewer()
    if (!layer || !viewer || viewer.isDestroyed()) return

    sensorDispose?.()
    sensorDispose = undefined
    layer.resetGlobalSkyBox()

    for (const img of overlays) {
      if (!img.isDestroyed()) layer.removeImageryLayer(img, true)
    }
    overlays.length = 0

    if (lonLatGridTracked) layer.removeLonLatGrid()
    lonLatGridTracked = false

    for (const entity of trackedEntities) {
      viewer.entities.remove(entity)
    }
    trackedEntities.length = 0

    viewer.dataSources.removeAll()
  }

  onBeforeUnmount(cleanup)

  return {
    map,
    getLayer,
    trackImagery,
    trackEntities,
    trackLonLatGrid,
    trackSensorCones,
    cleanup,
  }
}
