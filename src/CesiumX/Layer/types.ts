import type {
  Camera,
  CesiumTerrainProvider,
  GridImageryProvider,
  Resource,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from 'cesium'
import { CzmlDataSource, GeoJsonDataSource, KmlDataSource } from 'cesium'

/** 地图中心点：经纬度（度）+ 相机高度（米，相对椭球）。 */
export interface LayerCenter {
  longitude: number
  latitude: number
  height: number
}

/** 相机朝向（度）。 */
export interface LayerCameraOrientation {
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
}

/** camera.setView 的入参（与 Cesium 一致）。 */
export type LayerCameraSetViewOptions = Parameters<Camera['setView']>[0]
/** camera.flyTo 的入参（与 Cesium 一致）。 */
export type LayerCameraFlyToOptions = Parameters<Camera['flyTo']>[0]

/**
 * 初次定位相机：是否过渡动画决定使用 setView 或 flyTo。
 * - `useAnimation: false` → `camera.setView`
 * - `useAnimation: true` → `camera.flyTo`
 */
export interface LayerInitialCameraOptions {
  /** 为 true 时使用 flyTo，否则 setView。 @default false */
  useAnimation?: boolean
  /** flyTo 时长（秒）。 @default 2 */
  duration?: number
  /** 透传给 Camera.flyTo 的其它字段（如 easingFunction、maximumHeight 等），会与 destination/orientation 合并。 */
  flyToOverrides?: Omit<LayerCameraFlyToOptions, 'destination' | 'orientation' | 'duration'>
}

/** 初始化时可开启的性能与调试相关项。 */
export interface LayerPerformanceInitConfig {
  /** 按需渲染。 */
  requestRenderMode?: boolean
  /** 与 requestRenderMode 配合，超过该时间（秒）强制渲染一帧。 */
  maximumRenderTimeChange?: number
  /** 使用浏览器建议分辨率（Viewer 属性）。 */
  useBrowserRecommendedResolution?: boolean
  /** 在场景左上角显示 Cesium 内置 FPS。 */
  showFps?: boolean
  /** WebGL 多重采样（若 Viewer/context 支持）。 */
  msaaSamples?: number
}

/** 初始化时 UI 行为（比例尺、层级、罗盘、鼠标样式等）。Cesium Logo/版权条区域由 Layer 内部固定隐藏。 */
export interface LayerUiInitConfig {
  /** 是否显示简易比例尺（自绘 DOM，非 Cesium 内置控件）。 @default false */
  showScaleBar?: boolean
  /** 是否显示当前大致缩放层级文字。 @default false */
  showTileLevelOverlay?: boolean
  /** 是否显示简易罗盘（自绘 DOM，指示相机航向）。 @default false */
  showCompassOverlay?: boolean
  /** 画布鼠标 CSS cursor，如 `grab`、`pointer`、`crosshair`。 */
  initialCursor?: string
}

/**
 * 地图初始化配置（对应文档「初始化地图（图层）」+ 可选性能/UI）。
 * 影像采用 {@link UrlTemplateImageryProvider}（XYZ / 模板瓦片），地形可选 {@link CesiumTerrainProvider}。
 */
export interface LayerInitConfig {
  mapName?: string
  ionAccessToken?: string

  /** 地图中心：经纬高（度 / 米）。 */
  center: LayerCenter
  /** 相机朝向（度）；默认 pitch -45° 俯视。 */
  orientation?: LayerCameraOrientation
  /** 初次定位：无动画 setView 或有动画 flyTo。 */
  initialCamera?: LayerInitialCameraOptions

  /** 初始化完成后是否自动叠加网格影像层。 @default false */
  showGridAtStartup?: boolean
  /** 与 `showGridAtStartup` 配套的 GridImageryProvider 参数。 */
  gridAtStartupOptions?: GridImageryProvider.ConstructorOptions

  performance?: LayerPerformanceInitConfig
  ui?: LayerUiInitConfig

  imageryUrlTemplate: string
  imageryProviderOptions?: Omit<UrlTemplateImageryProvider.ConstructorOptions, 'url'>
  terrainUrl?: string
  terrainProviderOptions?: CesiumTerrainProvider.ConstructorOptions
  depthTestAgainstTerrain?: boolean
  viewerOptions?: Viewer.ConstructorOptions

  /**
   * 对应 `ScreenSpaceCameraController.zoomFactor`；Cesium 默认 `5` 滚轮一步偏大。
   * 未传时 Layer 使用约 `2.25`；若需恢复原生手感可显式传 `5`。
   */
  wheelZoomFactor?: number
}

/** 向 imageryLayers 追加图层时的可选顺序。 */
export interface ImageryLayerInsertOptions {
  insertIndex?: number
}

/** 影像图层「滤镜/调色」参数（对应 ImageryLayer 上可调属性）。 */
export interface ImageryLayerVisualParams {
  alpha?: number
  brightness?: number
  contrast?: number
  /** 弧度，与 Cesium.ImageryLayer.hue 一致；也可用 degreesToRadians 在外部换算。 */
  hue?: number
  saturation?: number
  gamma?: number
  nightAlpha?: number
  dayAlpha?: number
}

export type WmtsImageryAddInput = WebMapTileServiceImageryProvider.ConstructorOptions
export type WmsImageryAddInput = WebMapServiceImageryProvider.ConstructorOptions
export type TmsImageryFromUrlOptions = TileMapServiceImageryProvider.ConstructorOptions
export type UrlTemplateImageryAddInput = UrlTemplateImageryProvider.ConstructorOptions
export type GridImageryAddInput = GridImageryProvider.ConstructorOptions

export type GeoJsonLoadInput = Parameters<typeof GeoJsonDataSource.load>[0]
export type GeoJsonLoadOptions = NonNullable<Parameters<typeof GeoJsonDataSource.load>[1]>

export type KmlLoadInput = Parameters<typeof KmlDataSource.load>[0]
export type KmlLoadOptions = NonNullable<Parameters<typeof KmlDataSource.load>[1]>

export type CzmlLoadInput = Parameters<typeof CzmlDataSource.load>[0]
export type CzmlLoadOptions = NonNullable<Parameters<typeof CzmlDataSource.load>[1]>

export type TerrainFromUrlInput = string | Resource
export type TerrainFromUrlOptions = CesiumTerrainProvider.ConstructorOptions

/** 二三维模式（对应文档「二三维切换」）。 */
export type LayerSceneModeKey = '3d' | '2d' | 'columbus'

export interface LayerOverviewMapOptions {
  width?: number
  height?: number
  /** 与主视图相机高度比例，用于鹰眼相机高度（粗略）。 @default 8 */
  heightRatio?: number
  /**
   * 是否双向同步：为 `true`（默认）时主图驱动鹰眼，且可在鹰眼拖拽/滚轮操作主图；
   * 为 `false` 时仅主图→鹰眼，鹰眼不反向影响主图。
   * @default true
   */
  bidirectionalSync?: boolean
  /** 若未传则尝试从主视图首层影像复制 url 模板（UrlTemplateImageryProvider）。 */
  imageryUrlTemplate?: string
  imageryProviderOptions?: Omit<UrlTemplateImageryProvider.ConstructorOptions, 'url'>
}

export type { Color, CzmlDataSource, GeoJsonDataSource, ImageryLayer, KmlDataSource, Rectangle, SceneMode, Viewer } from 'cesium'
