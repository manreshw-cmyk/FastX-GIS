import type { Viewer } from 'cesium'

/** 单点样式（Billboard / Point / Label） */
export interface PointAggregationPointStyle {
  /** 是否显示，默认 true */
  show?: boolean
  /** Billboard 图标 URL 或 data URI；未传则使用内置图标 */
  image?: string
  /** Billboard 缩放，默认 1 */
  scale?: number
  /** 点颜色（CSS），无 image 时生效 */
  color?: string
  /** 点像素大小，默认 12 */
  pixelSize?: number
  outlineColor?: string
  outlineWidth?: number
  /** 标签文本；未传时使用 GeoJSON `properties.name` */
  labelText?: string
  /** 是否显示名称；有 name 时默认 true（图标下方） */
  labelShow?: boolean
  labelFont?: string
  labelFillColor?: string
  labelOutlineColor?: string
}

/** 聚合簇样式 */
export interface PointAggregationClusterStyle {
  /** 是否启用聚合，默认 true */
  enabled?: boolean
  /** 聚合像素范围，默认 80 */
  pixelRange?: number
  /** 最小聚合数量，默认 2 */
  minimumClusterSize?: number
  /**
   * 固定聚合圆底色；设置后不再按数量分档。
   * 未设置：2+ 蓝 → 5+ 绿 → 10+ 青 → 20+ 橙 → 50+ 红 → 100+ 紫。
   */
  color?: string
  /** 聚合圆直径（px），默认 54 */
  size?: number
  textColor?: string
  fontSize?: number
  /** 填充透明度 0~1，默认 0.55 */
  fillAlpha?: number
}

/** 点聚合整体样式（GeoJSON 根字段或 load 入参） */
export interface PointAggregationStyle {
  point?: PointAggregationPointStyle
  cluster?: PointAggregationClusterStyle
}

/** 从 URL 加载点聚合 */
export interface PointAggregationLoadOptions {
  viewer: Viewer
  /** GeoJSON 文件 HTTP(S) 路径 */
  url: string
  style?: PointAggregationStyle
  show?: boolean
  id?: string
}

/** 从 GeoJSON 对象加载（不发起网络请求） */
export interface PointAggregationGeoJsonOptions {
  viewer: Viewer
  geoJson: unknown
  /** 数据来源 URL，仅快照展示用 */
  url?: string
  style?: PointAggregationStyle
  show?: boolean
  id?: string
}

export interface PointAggregationUpdateOptions {
  show?: boolean
  style?: PointAggregationStyle
}

export interface PointAggregationSnapshot {
  id: string
  url?: string
  featureCount: number
  show: boolean
}

export { DEFAULT_POINT_AGGREGATION_STYLE } from './core/aggregationShared'
