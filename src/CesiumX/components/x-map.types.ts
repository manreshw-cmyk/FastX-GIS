import type { Viewer } from 'cesium'
import type { LayerCameraOrientation, LayerCenter, LayerInitialCameraOptions } from '../Layer/types'

/**
 * 传给 `XMap` 的地图初始化配置（由页面如 `mapDemo/index.vue` 组装后一次性传入）。
 */
export interface XMapConfig {
  /** 业务地图名，对应 `LayerInitConfig.mapName`。 */
  mapName?: string
  /** 初始中心：经纬度（度）+ 相机高度（米）。 */
  center: LayerCenter
  /** 相机朝向（度）；俯视台湾可设 `pitchDegrees: -90`。 */
  orientation?: LayerCameraOrientation
  /** XYZ / 模板瓦片地址。 */
  imageryUrlTemplate: string
  /** 地形服务地址；不传则 `initMap` 使用椭球地形。 */
  terrainUrl?: string
  /** 首次相机定位是否飞入等。 */
  initialCamera?: LayerInitialCameraOptions
  /** 是否在初始化时创建鹰眼；默认不创建，由「鹰眼」等功能页调用 `setOverviewMapVisible` 开启。 */
  showOverview?: boolean
  /** 鹰眼是否与主图双向操作（拖拽/滚轮改主图）。 @default true */
  overviewBidirectionalSync?: boolean
  overviewWidth?: number
  overviewHeight?: number
  /** 鹰眼相机高度 ≈ 主图高度 ÷ 该值。 */
  overviewHeightRatio?: number
  depthTestAgainstTerrain?: boolean

  /**
   * 抗锯齿总开关（与常见 Cesium 写法对齐）：
   * - **MSAA**：通过 Viewer 构造参数 `msaaSamples`（默认 `4`，更高更吃性能；可用 `viewerOptions.msaaSamples` 覆盖）。
   * - **FXAA**：Viewer 构造器无 `fxaa` 字段，需在 `Viewer` 创建后设置 `viewer.scene.postProcessStages.fxaa.enabled`（本组件在 `initMap` 之后替你设为与该项一致）。
   * - 另补充 **WebGL** `contextOptions.webgl.antialias`（画布级），与上两者叠加。
   * 未传或 `true` 视为开启；显式 `false` 时关 FXAA、MSAA 置 `1`、WebGL `antialias` 为 `false`。
   * @default true
   */
  antialias?: boolean
  /** 透传给 `Layer.initMap` 的 `viewerOptions`（会与根据 `antialias` 生成的选项深度合并）。 */
  viewerOptions?: Viewer.ConstructorOptions
}
