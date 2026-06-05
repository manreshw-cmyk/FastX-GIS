import type * as Cesium from 'cesium'

/** cesium-navigation-es6 构造选项（常用项） */
export interface CesiumNavigationOptions {
  enableDistanceLegend?: boolean
  enableZoomControls?: boolean
  enableCompass?: boolean
  enableCompassOuterRing?: boolean
  defaultResetView?: Cesium.Cartographic | Cesium.Rectangle
  orientation?: { heading?: number; pitch?: number; roll?: number }
  duration?: number
  resetTooltip?: string
  zoomInTooltip?: string
  zoomOutTooltip?: string
}

export interface CesiumNavigationInstance {
  destroy(): void
  container?: HTMLElement
  setNavigationLocked(locked: boolean): void
  getNavigationLocked(): boolean
}

export type CesiumNavigationConstructor = new (
  viewer: Cesium.Viewer,
  options?: CesiumNavigationOptions,
) => CesiumNavigationInstance

declare global {
  interface Window {
    CesiumNavigation?: CesiumNavigationConstructor
  }
}

export {}
