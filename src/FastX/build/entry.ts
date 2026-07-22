/**
 * fastx-sdk 发布入口（不含 Vue components，Rollup alias 指向 stubs）。
 */
import { installFastXToWindow as installCore } from '../index.js'
import { ensureCesiumBaseUrl } from './runtime/ensure-cesium-base-url.js'

export type * from '../index.js'
export type { FastXGlobal } from '../index.js'

export {
  Utils,
  Types,
  Layer,
  Coordinates,
  MouseEvent,
  registerCesiumXVueComponents,
  createRandomXgxId,
  SpecialEffects,
  RadiationCircle,
  RadiationCircleCollection,
  CircleDiffusion,
  CircleDiffusionCollection,
  ElectronicFence,
  ElectronicFenceCollection,
  PolygonDiffusionWall,
  PolygonDiffusionWallCollection,
  RadarEmissionWave,
  RadarEmissionWaveCollection,
  HemisphereRadarScan,
  HemisphereRadarScanCollection,
  GlobalRain,
  GlobalSnow,
  GlobalFog,
  AirRadar,
  AirRadarCollection,
  SectorArcRadarScan,
  SectorArcRadarScanCollection,
  DiffusionRadar,
  DiffusionRadarCollection,
  AimEffect,
  AimEffectCollection,
  ConeEffect,
  ConeEffectCollection,
  DoubleViewFrustum,
  DoubleViewFrustumCollection,
  ParabolaRadar,
  ParabolaRadarCollection,
  RingConeScanner,
  RingConeScannerCollection,
  RingRadar,
  RingRadarCollection,
  SquareConeScanner,
  SquareConeScannerCollection,
  FireRangeEffect,
  FireRangeEffectCollection,
  ParticleSystemEffect,
  ExplosionEffect,
  FrameAnimationEffect,
  EntityFocusEffect,
  entityFocusEffect,
  Point,
  PointCollection,
  Label,
  LabelCollection,
  PolyLine,
  PolyLineCollection,
  Circle,
  CircleCollection,
  Polygon,
  PolygonCollection,
  Sector,
  SectorCollection,
  Rectangle,
  RectangleCollection,
  Cylinder,
  CylinderCollection,
  Corridor,
  CorridorCollection,
  Runway,
  RunwayCollection,
  Ellipsoid,
  EllipsoidCollection,
  Wall,
  Billboard,
  BillboardCollection,
  Overlay,
  Model,
  ModelCollection,
  Box,
  BoxCollection,
  PolylineVolume,
  PolylineVolumeCollection,
  defaultShapeParamsForType,
  parseShapeTypeKey,
  Plane,
  PlaneCollection,
  Path,
  Tileset,
  Heatmap,
  DEFAULT_HEATMAP_GRADIENT,
  DEFAULT_HEATMAP_STYLE,
  ensureHeatmapJs,
  ensureTurf,
  ensureCesiumNavigation,
  ensureVendorPlugins,
  h337,
  turf,
  getTurf,
  getH337,
  getCesiumNavigation,
  VENDOR_MANIFEST,
  PointAggregation,
  DEFAULT_POINT_AGGREGATION_STYLE,
  AreaManager,
  Quantitative,
  MeasureType,
  MEASURE_POINT_RANGE,
  PlaneMaterialType,
  DEFAULT_PLANE_VIDEO,
  normalizePlaneVideoOptions,
  resolvePolylineCartesians,
  PolylineMaterialType,
  computeModelCollectionModelMatrix,
  FastX,
} from '../index.js'

export type { TurfStatic, H337Factory, VendorPluginEntry, CesiumNavigationInstance, CesiumNavigationOptions } from '../plugins/index.js'

export { ensureCesiumBaseUrl } from './runtime/ensure-cesium-base-url.js'
export type { EnsureCesiumBaseUrlOptions } from './runtime/ensure-cesium-base-url.js'

export interface FastXInstallOptions {
  /** Cesium 静态资源 URL 前缀，Vite 生产构建建议 `/Cesium/` */
  cesiumBaseUrl?: string
}

/** 包内已含 Cesium 运行时（`lib/Cesium`），无需单独安装 `cesium` npm 包 */
export * as Cesium from 'cesium'

/** 挂载 `window.FastX`，并配置包内 `lib/Cesium` 路径与 vendor 插件预加载 */
export function installFastXToWindow(options?: FastXInstallOptions): void {
  ensureCesiumBaseUrl(options?.cesiumBaseUrl ? { baseUrl: options.cesiumBaseUrl } : undefined)
  installCore()
}
