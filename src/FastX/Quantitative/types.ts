/**
 * 量算分析类型定义、交互规则与公共接口。
 */
import type { Viewer } from 'cesium'

/** 量算分析类型枚举（与 FreeX FeMeasureType 对齐） */
export const MeasureType = {
  LINE_DISTANCE: 'lineDistance',
  SPACE_AREA: 'spaceArea',
  GROUND_DISTANCE: 'groundDistance',
  PROJECTION_DISTANCE: 'projectionDistance',
  PROJECTION_AREA: 'projectArea',
  ALTITUDE_INTERCEPT: 'altitudeIntercept',
  AZIMUTH: 'azimuth',
  LINE_ANALYZE: 'lineAnalyze',
  AREA_ANALYZE: 'areaAnalyze',
  MULTI_POINT_ANALYZE: 'multiPointAnalyze',
  VIEWSHED_ANALYZE: 'viewShedAnalyze',
  CONTOUR_ANALYZE: 'contourAnalyze',
  CONTOUR_ANALYZE_SHADER: 'contourAnalyzeShader',
  POINT_BUFFER_ANALYZE: 'pointBufferAnalyze',
  LINE_BUFFER_ANALYZE: 'lineBufferAnalyze',
  PLANE_BUFFER_ANALYZE: 'planeBufferAnalyze',
} as const

/** 量算类型字面量联合 */
export type MeasureTypeKey = (typeof MeasureType)[keyof typeof MeasureType]

/** 经纬高三元组 [经度, 纬度, 高程] */
export type LngLatHeightTuple = [number, number, number]

/** 各类型交互顶点数范围 [min, max] */
export const MEASURE_POINT_RANGE: Record<MeasureTypeKey, [number, number]> = {
  [MeasureType.LINE_DISTANCE]: [2, Number.MAX_VALUE],
  [MeasureType.GROUND_DISTANCE]: [2, Number.MAX_VALUE],
  [MeasureType.PROJECTION_DISTANCE]: [2, Number.MAX_VALUE],
  [MeasureType.SPACE_AREA]: [3, Number.MAX_VALUE],
  [MeasureType.PROJECTION_AREA]: [3, Number.MAX_VALUE],
  [MeasureType.ALTITUDE_INTERCEPT]: [2, 2],
  [MeasureType.AZIMUTH]: [2, Number.MAX_VALUE],
  [MeasureType.LINE_ANALYZE]: [2, 2],
  [MeasureType.AREA_ANALYZE]: [2, 2],
  [MeasureType.MULTI_POINT_ANALYZE]: [2, Number.MAX_VALUE],
  [MeasureType.VIEWSHED_ANALYZE]: [2, 2],
  [MeasureType.CONTOUR_ANALYZE]: [2, 2],
  [MeasureType.CONTOUR_ANALYZE_SHADER]: [2, 2],
  [MeasureType.POINT_BUFFER_ANALYZE]: [1, 1],
  [MeasureType.LINE_BUFFER_ANALYZE]: [2, Number.MAX_VALUE],
  [MeasureType.PLANE_BUFFER_ANALYZE]: [3, Number.MAX_VALUE],
}

/** 量算绘制样式（均可选，未设则用默认值） */
export interface MeasureStyle {
  lineColor?: string
  lineWidth?: number
  lineDashed?: boolean
  pointColor?: string
  pointSize?: number
  /** 关键点透明度 0~1，默认 0.42 */
  pointAlpha?: number
  showKeyPoint?: boolean
  labelColor?: string
  labelFont?: string
  labelSize?: number
  fillColor?: string
  fillAlpha?: number
  visibleLineColor?: string
  invisibleLineColor?: string
  rightAngleLineColor?: string
  azimuthGuideColor?: string
  circleColor?: string
  contourLineColor?: string
  contourShaderColor?: string
  contourShaderWidth?: number
}

/** 量算实例样式读写接口 */
export interface IMeasureStyleOptions {
  getStyle(): MeasureStyle
  setStyle(style: Partial<MeasureStyle>): void
}

/** 创建量算实例的选项 */
export interface MeasureCreateOptions {
  viewer: Viewer
  type: MeasureTypeKey
  id?: string
  positions?: LngLatHeightTuple[]
  position?: LngLatHeightTuple
  clampToGround?: boolean
  style?: MeasureStyle
  /** 缓冲区半径（米） */
  bufferWidth?: number
  /** 等高线间隔（米） */
  contourInterval?: number
  /** 等高线网格行列 */
  contourGridSize?: number
  /** 等高线 Shader 变更时回调 */
  onContourShaderChange?: () => void
}

/** 量算实例公共接口 */
export interface IMeasure extends IMeasureStyleOptions {
  readonly id: string
  readonly type: MeasureTypeKey
  clear(): void
  destroy(): void
  setPositions?(positions: LngLatHeightTuple[]): void
  setPosition?(position: LngLatHeightTuple): void
  update?(cursor: LngLatHeightTuple): void
  complete?(): void
}

/** Quantitative 系统构造选项 */
export interface QuantitativeOptions {
  /** 切换量算类型时是否清除已有结果 */
  removeOnTypeChange?: boolean
}
