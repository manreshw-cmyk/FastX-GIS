import { ensureHeatmapJs } from './h337'
import { ensureTurf } from './turf'

export type { VendorManifest, VendorPluginEntry } from './manifest'
export { VENDOR_MANIFEST, getVendorPlugin } from './manifest'
export { resolvePluginScriptUrl } from './resolve-url'
export { loadPluginScript } from './load-script'

export type { TurfStatic } from './turf-types'
export { ensureTurf, getTurf, turf } from './turf'

export type { H337Factory, H337Instance, H337CreateConfig } from './h337-types'
export { ensureHeatmapJs, getH337, h337 } from './h337'

export type {
  CesiumNavigationInstance,
  CesiumNavigationOptions,
  CesiumNavigationConstructor,
} from './cesium-navigation-types'
export {
  ensureCesiumNavigation,
  getCesiumNavigation,
} from './cesium-navigation'

/** 预加载 manifest 中已启用的脚本插件（导航控件按需加载） */
export function ensureVendorPlugins(): Promise<void[]> {
  return Promise.all([ensureHeatmapJs(), ensureTurf()])
}
