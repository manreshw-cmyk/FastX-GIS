import type { Viewer } from 'cesium'

/** 二维贴地 / 三维抬升 */
export type HeatmapDimension = '2d' | '3d'

/** 面状三角网 / 网状线框（均贴 heatmap 纹理） */
export type HeatmapRenderType = 'mesh' | 'surface'

/** 维度 × 形态 组合键 */
export type HeatmapKind = '2d-mesh' | '2d-surface' | '3d-mesh' | '3d-surface'

/** 经纬度矩形范围（度） */
export interface HeatmapBounds {
  west: number
  south: number
  east: number
  north: number
}

/** 色带节点：position 0~1 */
export interface HeatmapColorStop {
  position: number
  color: string
}

/** 单格热力数据：value 强度 0~1，height 保留字段（当前由几何采样计算） */
export interface HeatmapCell {
  value: number
  height: number
}

/** 行列网格 */
export type HeatmapGrid = HeatmapCell[][]

/** heatmap.js 渲染样式 */
export interface HeatmapStyle {
  /** 颜色渐变节点 */
  gradient: HeatmapColorStop[]
  /** 最低不透明度 */
  minOpacity: number
  /** 最高不透明度 */
  maxOpacity: number
}

/** 创建热力图 */
export interface HeatmapCreateOptions {
  viewer: Viewer
  /** 默认 2d */
  dimension?: HeatmapDimension
  /** 默认 surface */
  renderType?: HeatmapRenderType
  bounds: HeatmapBounds
  /** 数据网格列数，默认 12 */
  gridCols?: number
  /** 数据网格行数，默认 12 */
  gridRows?: number
  style?: Partial<HeatmapStyle>
  /** 自定义网格；不传则按 seed 随机生成演示数据 */
  grid?: HeatmapGrid
  /** 随机种子，影响演示数据分布 */
  seed?: number
  id?: string
  /** 默认 true */
  show?: boolean
}

/** 更新热力图（传入字段非 undefined 时触发重建或显隐） */
export interface HeatmapUpdateOptions {
  dimension?: HeatmapDimension
  renderType?: HeatmapRenderType
  bounds?: HeatmapBounds
  gridCols?: number
  gridRows?: number
  style?: Partial<HeatmapStyle>
  grid?: HeatmapGrid
  seed?: number
  show?: boolean
}

/** 列表/快照信息 */
export interface HeatmapSnapshot {
  id: string
  kind: HeatmapKind
  bounds: HeatmapBounds
  gridCols: number
  gridRows: number
  show: boolean
}

/** 默认彩虹色带 */
export const DEFAULT_HEATMAP_GRADIENT: HeatmapColorStop[] = [
  { position: 0, color: '#0000ff' },
  { position: 0.25, color: '#00ffff' },
  { position: 0.5, color: '#00ff00' },
  { position: 0.75, color: '#ffff00' },
  { position: 1, color: '#ff0000' },
]

/** 默认 heatmap.js 样式 */
export const DEFAULT_HEATMAP_STYLE: HeatmapStyle = {
  gradient: DEFAULT_HEATMAP_GRADIENT,
  minOpacity: 0.45,
  maxOpacity: 0.9,
}
