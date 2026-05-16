import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { Viewer } from 'cesium'
import type { Layer } from '../../CesiumX/Layer'
import type { LayerCameraOrientation, LayerCenter } from '../../CesiumX/Layer/types'

/**
 * 当前应用内主地图 `Layer` 单例（由 `XMap` 在挂载后绑定、卸载前解绑）。
 * 各功能页通过本 store 调用 `setSceneMode`、`clearAllMapEntities` 等，无需层层透传 props。
 * `initialMapCenter` / `initialMapOrientation` 在地图就绪后写入，供「视角复位」等使用。
 */
export const useMapLayerStore = defineStore('mapLayer', () => {
  const layer = shallowRef<Layer | null>(null)
  const initialMapCenter = shallowRef<LayerCenter | null>(null)
  const initialMapOrientation = shallowRef<LayerCameraOrientation | null>(null)

  function bindLayer(next: Layer | null): void {
    layer.value = next
  }

  /**
   * 若当前仍指向该实例则置空。
   * 参数用 `object`：避免 `Ref<Layer>` 与带私有字段的 class 实例在结构化类型上不兼容。
   */
  function clearIfCurrent(inst: object | null): void {
    if (inst != null && layer.value === inst) {
      layer.value = null
    }
  }

  function getLayer(): Layer | null {
    return layer.value
  }

  function getViewer(): Viewer | null {
    return layer.value?.getViewer() ?? null
  }

  function clearAllMapEntities(): void {
    layer.value?.clearAllMapEntities()
  }

  /** 切换菜单时恢复鹰眼/大气层/光照/二三维/比例尺等与初始化一致 */
  function resetSharedMapDemoUiState(): void {
    layer.value?.resetSharedMapDemoUiState()
  }

  function setInitialMapView(center: LayerCenter, orientation: LayerCameraOrientation): void {
    initialMapCenter.value = { ...center }
    initialMapOrientation.value = { ...orientation }
  }

  return {
    layer,
    initialMapCenter,
    initialMapOrientation,
    bindLayer,
    clearIfCurrent,
    getLayer,
    getViewer,
    clearAllMapEntities,
    resetSharedMapDemoUiState,
    setInitialMapView,
  }
})
