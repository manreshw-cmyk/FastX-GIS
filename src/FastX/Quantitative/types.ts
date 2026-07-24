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
  SLOPE_ANALYZE: 'slopeAnalyze',
  ASPECT_ANALYZE: 'aspectAnalyze',
  TERRAIN_PROFILE_ANALYZE: 'terrainProfileAnalyze',
  CUT_FILL_ANALYZE: 'cutFillAnalyze',
  FLOOD_ANALYZE: 'floodAnalyze',
  POINT_BUFFER_ANALYZE: 'pointBufferAnalyze',
  LINE_BUFFER_ANALYZE: 'lineBufferAnalyze',
  PLANE_BUFFER_ANALYZE: 'planeBufferAnalyze',
} as const

/** 量算类型字面量联合 */
export type MeasureTypeKey = (typeof MeasureType)[keyof typeof MeasureType]

/** 经纬高三元组 [经度, 纬度, 高程] */
export type LngLatHeightTuple = [number, number, number]

/** 各类型交互顶点数量范围 [min, max] */
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
  [MeasureType.SLOPE_ANALYZE]: [2, 2],
  [MeasureType.ASPECT_ANALYZE]: [2, 2],
  [MeasureType.TERRAIN_PROFILE_ANALYZE]: [2, Number.MAX_VALUE],
  [MeasureType.CUT_FILL_ANALYZE]: [3, Number.MAX_VALUE],
  [MeasureType.FLOOD_ANALYZE]: [3, Number.MAX_VALUE],
  [MeasureType.POINT_BUFFER_ANALYZE]: [1, 1],
  [MeasureType.LINE_BUFFER_ANALYZE]: [2, Number.MAX_VALUE],
  [MeasureType.PLANE_BUFFER_ANALYZE]: [3, Number.MAX_VALUE],
}

/** 量算绘制样式（均可选，未设置时使用默认值） */
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

/** 视域分析参数（扇形网格多边形填充 + 视锥/椭球示意） */
export interface ViewShedOptions {
  /** 水平可视夹角（度），默认 90 */
  horizontalViewAngle?: number
  /** 垂直可视夹角（度），默认 60 */
  verticalViewAngle?: number
  /** 无目标点时的默认观测距离（米），默认 100 */
  defaultViewDistance?: number
  /** 完成绘制后水平网格步长（度），默认 5 */
  rayStepDegrees?: number
  /** 绘制预览时水平网格步长（度），默认 8 */
  previewRayStepDegrees?: number
  /** 完成绘制后垂直网格步长（度），默认 6 */
  verticalRayStepDegrees?: number
  /** 绘制预览时垂直网格步长（度），默认 9 */
  previewVerticalRayStepDegrees?: number
  /** 单元格通视采样数，默认 28 */
  sampleCount?: number
  /** 预览时单元格通视采样数，默认 16 */
  previewSampleCount?: number
  /** 完成绘制后径向分层数，默认 8 */
  radialRingCount?: number
  /** 预览时径向分层数，默认 5 */
  previewRadialRingCount?: number
  /** 可视/不可视填充透明度 0~1，默认 0.88 */
  fillAlpha?: number
  /** 视锥线框颜色（CSS），默认 #9acd32 */
  frustumOutlineColor?: string
  /** 视域扇形网格线颜色（CSS），默认 #00e5ff */
  sketchOutlineColor?: string
  /** 是否显示扇形椭球最外层轮廓线，默认 true */
  showSketchOutline?: boolean
  /** 是否显示视锥金字塔线框，默认 true */
  showFrustumOutline?: boolean
}

/** 点 / 线 / 面缓冲分析样式（{@link BufferAnalyze}） */
export interface BufferAnalyzeOptions {
  /** 缓冲填充色，默认 #e53935 */
  bufferFillColor?: string
  /** 缓冲填充透明度 0~1，默认 0.45 */
  bufferFillAlpha?: number
  /** 缓冲外轮廓颜色，默认 #c62828 */
  bufferOutlineColor?: string
  /** 缓冲外轮廓线宽（像素），默认 2 */
  bufferOutlineWidth?: number
  /** 是否绘制缓冲外轮廓，默认 true */
  showBufferOutline?: boolean
  /** 源折线颜色（线/面绘制中），默认 #ffeb3b */
  sourceLineColor?: string
  /** 源折线宽度，默认 3 */
  sourceLineWidth?: number
  /** 源面填充色（面缓冲），默认 #ff9800 */
  sourceFillColor?: string
  /** 源面填充透明度，默认 0.45 */
  sourceFillAlpha?: number
}

/** 坡度分级配置 */
export interface SlopeGrade {
  /** 当前分级的最大坡度角（度） */
  maxSlope: number
  /** 当前分级颜色（CSS 颜色） */
  color: string
  /** 图例显示文案 */
  label?: string
}

/** 坡度分析渲染模式：raster 为平滑贴图，grid 为网格色块 */
export type SlopeRenderMode = 'raster' | 'grid'

/** 坡度分析参数 */
export interface SlopeAnalyzeOptions {
  /** 单边采样网格密度，代表每行/列采样单元数量，默认 48 */
  gridSize?: number
  /** 坡度覆盖层透明度 0~1，默认 0.58 */
  fillAlpha?: number
  /** 渲染模式：raster 为平滑贴图，grid 为网格色块，默认 raster */
  renderMode?: SlopeRenderMode
  /** raster 模式下的贴图分辨率（像素），默认 768 */
  textureSize?: number
  /** raster 模式下是否对采样值做平滑插值，默认 true */
  smooth?: boolean
  /** raster 模式下地形明暗起伏强度 0~1，默认 0.35 */
  shadeStrength?: number
  /** 是否显示内部采样网格线；关闭时仅保留分析范围外轮廓，默认 false */
  showGrid?: boolean
  /** 采样网格线颜色，默认 #ffffff */
  gridColor?: string
  /** 采样网格线宽度（像素），默认 1 */
  gridWidth?: number
  /** 网格色块和轮廓线相对采样地形的抬升高度，避免与地形闪烁，默认 1.5 米 */
  heightOffset?: number
  /** 是否显示最小/最大/平均坡度统计标注，默认 true */
  showStatsLabel?: boolean
  /** 坡度分级色带，按 maxSlope 从小到大匹配 */
  grades?: SlopeGrade[]
}

/** 坡度分析统计结果 */
export interface SlopeAnalyzeStats {
  /** 最小坡度角（度） */
  minSlope: number
  /** 最大坡度角（度） */
  maxSlope: number
  /** 平均坡度角（度） */
  avgSlope: number
  /** 参与统计的网格单元数量 */
  cellCount: number
  /** 分析范围内最小高程（米） */
  minHeight: number
  /** 分析范围内最大高程（米） */
  maxHeight: number
}

/** 坡向分级配置 */
export interface AspectGrade {
  /** 当前分级起始坡向角（度，0 为北、90 为东） */
  minAspect: number
  /** 当前分级结束坡向角（度，允许跨 0 度，例如 337.5 到 22.5） */
  maxAspect: number
  /** 当前分级颜色（CSS 颜色） */
  color: string
  /** 图例显示文案 */
  label?: string
}

/** 坡向/坡面分析渲染模式：raster 为平滑贴图，grid 为网格色块 */
export type AspectRenderMode = 'raster' | 'grid'

/** 坡向/坡面分析参数 */
export interface AspectAnalyzeOptions {
  /** 单边采样网格密度，代表每行/列采样单元数量，默认 48 */
  gridSize?: number
  /** 坡向覆盖层透明度 0~1，默认 0.58 */
  fillAlpha?: number
  /** 渲染模式：raster 为平滑贴图，grid 为网格色块，默认 raster */
  renderMode?: AspectRenderMode
  /** raster 模式下的贴图分辨率（像素），默认 768 */
  textureSize?: number
  /** raster 模式下是否对采样值做平滑插值，默认 true */
  smooth?: boolean
  /** raster 模式下地形明暗起伏强度 0~1，默认 0.25 */
  shadeStrength?: number
  /** 是否显示内部采样网格线；关闭时仅保留分析范围外轮廓，默认 false */
  showGrid?: boolean
  /** 采样网格线颜色，默认 #ffffff */
  gridColor?: string
  /** 采样网格线宽度（像素），默认 1 */
  gridWidth?: number
  /** 网格色块和轮廓线相对采样地形的抬升高度，避免与地形闪烁，默认 1.5 米 */
  heightOffset?: number
  /** 是否显示平均坡向、主导坡向和平地数量统计标注，默认 true */
  showStatsLabel?: boolean
  /** 小于等于该坡度角时按平地处理，不参与坡向统计，默认 1 度 */
  flatSlopeThreshold?: number
  /** 平地颜色，默认 #d1d5db */
  flatColor?: string
  /** 坡向分级色带，按角度区间匹配 */
  grades?: AspectGrade[]
}

/** 坡向/坡面分析统计结果 */
export interface AspectAnalyzeStats {
  /** 参与统计的网格单元数量 */
  cellCount: number
  /** 被平地阈值过滤的网格单元数量 */
  flatCount: number
  /** 平均坡向角（度，0 为北、90 为东；无有效坡向时为 null） */
  meanAspect: number | null
  /** 出现次数最多的坡向分级名称 */
  dominantAspect: string | null
  /** 分析范围内最小高程（米） */
  minHeight: number
  /** 分析范围内最大高程（米） */
  maxHeight: number
}

/** 地形剖面采样点 */
export interface TerrainProfilePoint {
  /** 经度（度） */
  longitude: number
  /** 纬度（度） */
  latitude: number
  /** 地形高程（米） */
  height: number
  /** 距起点的累计水平距离（米） */
  distance: number
  /** 与前一个采样点之间的坡度角（度），首点为 0 */
  slopeDegree: number
}

/** 地形剖面统计结果 */
export interface TerrainProfileStats {
  /** 剖面水平总距离（米） */
  totalDistance: number
  /** 最低高程（米） */
  minHeight: number
  /** 最高高程（米） */
  maxHeight: number
  /** 平均高程（米） */
  avgHeight: number
  /** 终点高程 - 起点高程（米） */
  heightDiff: number
  /** 累计爬升高度（米） */
  ascent: number
  /** 累计下降高度（米） */
  descent: number
  /** 最大上坡坡度角（度） */
  maxSlopeDegree: number
  /** 最大下坡坡度角（度，负值） */
  minSlopeDegree: number
  /** 采样点数量 */
  sampleCount: number
}

/** 地形剖面完整结果 */
export interface TerrainProfileResult {
  /** 用户绘制的剖面线关键点 */
  anchors: LngLatHeightTuple[]
  /** 沿剖面线生成的采样点 */
  points: TerrainProfilePoint[]
  /** 统计结果 */
  stats: TerrainProfileStats
}

/** 地形剖面分析参数 */
export interface TerrainProfileAnalyzeOptions {
  /** 采样点数量，默认 120 */
  sampleCount?: number
  /** 采样线相对地形抬升高度，避免与地形闪烁，默认 2 米 */
  heightOffset?: number
  /** 是否绘制采样后的剖面线，默认 true */
  showProfileLine?: boolean
  /** 剖面线颜色，默认 #59ff9b */
  profileLineColor?: string
  /** 剖面线宽度（像素），默认 3 */
  profileLineWidth?: number
  /** 是否显示采样点，默认 false */
  showSamplePoints?: boolean
  /** 采样点抽稀间隔，每隔几个采样点显示一个，默认 8 */
  samplePointEvery?: number
  /** 采样点颜色，默认 #facc15 */
  samplePointColor?: string
  /** 采样点大小（像素），默认 5 */
  samplePointSize?: number
  /** 是否显示剖面统计标注，默认 true */
  showStatsLabel?: boolean
  /** 剖面结果变化回调；常用于示例页或业务面板绘制剖面曲线 */
  onProfileChange?: (result: TerrainProfileResult | null) => void
}

/** 挖填方基准高程模式 */
export type CutFillBaseHeightMode = 'min' | 'max' | 'average' | 'custom'

/** 挖填方单元类型 */
export type CutFillCellKind = 'cut' | 'fill' | 'flat'

/** 挖填方采样单元 */
export interface CutFillCell {
  /** 单元中心经度（度） */
  longitude: number
  /** 单元中心纬度（度） */
  latitude: number
  /** 单元中心地形高程（米） */
  height: number
  /** 当前单元面积（平方米） */
  area: number
  /** 地形高程 - 基准高程；正值为挖方，负值为填方 */
  heightDiff: number
  /** 当前单元体积（立方米，始终为正值） */
  volume: number
  /** 当前单元分类 */
  kind: CutFillCellKind
}

/** 挖填方统计结果 */
export interface CutFillStats {
  /** 基准高程（米） */
  baseHeight: number
  /** 分析范围总面积（平方米） */
  totalArea: number
  /** 挖方面积（平方米） */
  cutArea: number
  /** 填方面积（平方米） */
  fillArea: number
  /** 挖方体积（立方米） */
  cutVolume: number
  /** 填方体积（立方米） */
  fillVolume: number
  /** 净体积：填方 - 挖方（立方米） */
  netVolume: number
  /** 最低采样高程（米） */
  minHeight: number
  /** 最高采样高程（米） */
  maxHeight: number
  /** 平均采样高程（米） */
  avgHeight: number
  /** 参与统计的采样单元数量 */
  cellCount: number
}

/** 挖填方完整结果 */
export interface CutFillResult {
  /** 用户绘制的分析范围 */
  polygon: LngLatHeightTuple[]
  /** 分析范围内的采样单元 */
  cells: CutFillCell[]
  /** 统计结果 */
  stats: CutFillStats
}

/** 挖填方分析参数 */
export interface CutFillAnalyzeOptions {
  /** 单边采样网格密度，默认 36 */
  gridSize?: number
  /** 基准高程模式，默认 average */
  baseHeightMode?: CutFillBaseHeightMode
  /** 自定义基准高程；仅 baseHeightMode 为 custom 时生效 */
  baseHeight?: number
  /** 采样面相对地形抬升高度，避免与地形闪烁，默认 1.5 米 */
  heightOffset?: number
  /** 小于该高差时视为平衡单元，默认 0.1 米 */
  tolerance?: number
  /** 挖方颜色，默认 #ef4444 */
  cutColor?: string
  /** 填方颜色，默认 #22c55e */
  fillColor?: string
  /** 平衡单元颜色，默认 #94a3b8 */
  flatColor?: string
  /** 单元填充透明度 0~1，默认 0.52 */
  fillAlpha?: number
  /** 是否绘制采样单元，默认 true */
  showCells?: boolean
  /** 是否显示采样单元网格轮廓，默认 true */
  showGrid?: boolean
  /** 采样单元网格线颜色，默认 #ffffff */
  gridColor?: string
  /** 是否显示统计标注，默认 true */
  showStatsLabel?: boolean
  /** 挖填方结果变化回调 */
  onCutFillChange?: (result: CutFillResult | null) => void
}

/** 淹没分析水位解析模式 */
export type FloodWaterLevelMode = 'absolute' | 'relativeToMin' | 'relativeToAverage'

/** 淹没分析采样单元 */
export interface FloodCell {
  /** 单元中心经度（度） */
  longitude: number
  /** 单元中心纬度（度） */
  latitude: number
  /** 单元中心地形高程（米） */
  terrainHeight: number
  /** 当前单元水深（米），未淹没时为 0 */
  waterDepth: number
  /** 当前单元面积（平方米） */
  area: number
  /** 当前单元蓄水体积（立方米） */
  volume: number
  /** 当前单元是否被淹没 */
  flooded: boolean
}

/** 淹没分析统计结果 */
export interface FloodStats {
  /** 最终参与计算的水位高程（米） */
  waterLevel: number
  /** 分析范围总面积（平方米） */
  totalArea: number
  /** 淹没面积（平方米） */
  floodedArea: number
  /** 未淹没面积（平方米） */
  dryArea: number
  /** 蓄水体积（立方米） */
  floodedVolume: number
  /** 淹没面积占比（0~1） */
  floodedRatio: number
  /** 最低采样高程（米） */
  minHeight: number
  /** 最高采样高程（米） */
  maxHeight: number
  /** 平均采样高程（米） */
  avgHeight: number
  /** 最大水深（米） */
  maxWaterDepth: number
  /** 参与统计的采样单元数量 */
  cellCount: number
  /** 被淹没的采样单元数量 */
  floodedCellCount: number
}

/** 淹没分析完整结果 */
export interface FloodResult {
  /** 用户绘制的分析范围 */
  polygon: LngLatHeightTuple[]
  /** 分析范围内的采样单元 */
  cells: FloodCell[]
  /** 统计结果 */
  stats: FloodStats
}

/** 淹没分析参数 */
export interface FloodAnalyzeOptions {
  /** 单边采样网格密度，默认 40 */
  gridSize?: number
  /** 水位解析模式，默认 relativeToMin */
  waterLevelMode?: FloodWaterLevelMode
  /** 水位值；absolute 为绝对高程，其余模式为相对高差，默认 30 米 */
  waterLevel?: number
  /** 小于该水深时视为未淹没，默认 0 米 */
  tolerance?: number
  /** 水面相对计算水位的抬升高度，避免与地形闪烁，默认 1.5 米 */
  heightOffset?: number
  /** 淹没区域颜色，默认 #22d3ee */
  waterColor?: string
  /** 未淹没区域颜色，默认 #f59e0b */
  dryColor?: string
  /** 淹没区域透明度 0~1，默认 0.58 */
  waterAlpha?: number
  /** 未淹没区域透明度 0~1，默认 0.2 */
  dryAlpha?: number
  /** 是否绘制淹没单元，默认 true */
  showFloodedCells?: boolean
  /** 是否绘制未淹没单元，默认 false */
  showDryCells?: boolean
  /** 是否显示采样单元网格轮廓，默认 false */
  showGrid?: boolean
  /** 采样单元网格线颜色，默认 #ffffff */
  gridColor?: string
  /** 是否显示统计标注，默认 true */
  showStatsLabel?: boolean
  /** 淹没分析结果变化回调 */
  onFloodChange?: (result: FloodResult | null) => void
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
  /** 缓冲分析专用样式（填充色、源要素颜色等） */
  buffer?: BufferAnalyzeOptions
  /** 坡度分析专用参数 */
  slope?: SlopeAnalyzeOptions
  /** 坡向/坡面分析专用参数 */
  aspect?: AspectAnalyzeOptions
  /** 地形剖面分析专用参数 */
  terrainProfile?: TerrainProfileAnalyzeOptions
  /** 挖填方分析专用参数 */
  cutFill?: CutFillAnalyzeOptions
  /** 淹没分析专用参数 */
  flood?: FloodAnalyzeOptions
  /** 等高线等高距（米） */
  contourInterval?: number
  /** 等高线网格行列数 */
  contourGridSize?: number
  /** 等高线 Shader 变更时回调 */
  onContourShaderChange?: () => void
  /** 视域分析参数 */
  viewShed?: ViewShedOptions
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
