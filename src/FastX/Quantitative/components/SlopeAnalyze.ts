import * as Cesium from 'cesium'
import type { Entity } from 'cesium'
import { toCartesian } from '../measureMath'
import {
  rectangleRing,
  sampleTerrainGrid,
  surfaceDistanceMeters,
  terrainPointToLngLatHeight,
  type TerrainGrid,
  type TerrainGridPoint,
} from '../terrainGrid'
import { createTerrainRasterOverlay, removeTerrainRasterOverlay } from '../terrainRasterOverlay'
import {
  MeasureType,
  type LngLatHeightTuple,
  type MeasureCreateOptions,
  type SlopeAnalyzeOptions,
  type SlopeGrade,
  type SlopeRenderMode,
  type SlopeAnalyzeStats,
} from '../types'
import { MeasureBase } from './MeasureBase'

/** 坡度分析默认分级色带 */
export const DEFAULT_SLOPE_GRADES: SlopeGrade[] = [
  { maxSlope: 5, color: '#22d3ee', label: '0°-5° 平缓' },
  { maxSlope: 15, color: '#2dd4bf', label: '5°-15° 缓坡' },
  { maxSlope: 25, color: '#86efac', label: '15°-25° 中坡' },
  { maxSlope: 35, color: '#bef264', label: '25°-35° 陡坡' },
  { maxSlope: 90, color: '#facc15', label: '35°以上 极陡' },
]

/** 坡度分析构造参数，直接 new 时可省略 type。 */
export type SlopeAnalyzeCreateOptions = Omit<MeasureCreateOptions, 'type'> & {
  /** 分析类型；不传时默认使用 slopeAnalyze。 */
  type?: MeasureCreateOptions['type']
}

type ResolvedSlopeOptions = Required<Omit<SlopeAnalyzeOptions, 'grades'>> & {
  grades: SlopeGrade[]
}

/** 0~255 RGB 颜色 */
interface RgbColor {
  r: number
  g: number
  b: number
}

/** 单个坡度采样单元的计算结果 */
interface SlopeCellInfo {
  /** 当前采样单元坡度角（度） */
  slope: number
  /** 基于高程梯度估算的明暗值，0~1 */
  light: number
}

/** 坡度分析网格结果 */
interface SlopeAnalysisGrid {
  /** 采样单元行数 */
  rows: number
  /** 采样单元列数 */
  cols: number
  /** 采样单元二维矩阵 */
  cells: SlopeCellInfo[][]
  /** 坡度统计结果 */
  stats: SlopeAnalyzeStats
}

const DEFAULT_SLOPE_OPTIONS: ResolvedSlopeOptions = {
  gridSize: 48,
  fillAlpha: 0.58,
  renderMode: 'raster',
  textureSize: 768,
  smooth: true,
  shadeStrength: 0.35,
  showGrid: false,
  gridColor: '#ffffff',
  gridWidth: 1,
  heightOffset: 1.5,
  showStatsLabel: true,
  grades: DEFAULT_SLOPE_GRADES,
}

const COLOR_CACHE = new Map<string, RgbColor>()
const LIGHT_X = -0.451
const LIGHT_Y = -0.351
const LIGHT_Z = 0.822

/** 限制数值范围。 */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 限制并四舍五入为整数。 */
function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.round(clampNumber(value!, min, max))
}

/** 解析渲染模式，未知值回退到平滑贴图。 */
function resolveRenderMode(mode?: SlopeRenderMode): SlopeRenderMode {
  return mode === 'grid' ? 'grid' : 'raster'
}

/** 清洗并排序坡度色带，保证至少返回默认色带。 */
function normalizeSlopeGrades(grades?: SlopeGrade[]): SlopeGrade[] {
  const normalized = [...(grades?.length ? grades : DEFAULT_SLOPE_GRADES)]
    .filter((grade) => Number.isFinite(grade.maxSlope) && grade.color)
    .sort((a, b) => a.maxSlope - b.maxSlope)
  return normalized.length ? normalized : DEFAULT_SLOPE_GRADES
}

/** 合并坡度分析参数并限制安全范围。 */
function resolveSlopeOptions(options?: SlopeAnalyzeOptions): ResolvedSlopeOptions {
  return {
    gridSize: clampInteger(options?.gridSize, DEFAULT_SLOPE_OPTIONS.gridSize, 4, 120),
    fillAlpha: clampNumber(options?.fillAlpha ?? DEFAULT_SLOPE_OPTIONS.fillAlpha, 0, 1),
    renderMode: resolveRenderMode(options?.renderMode),
    textureSize: clampInteger(options?.textureSize, DEFAULT_SLOPE_OPTIONS.textureSize, 128, 2048),
    smooth: options?.smooth ?? DEFAULT_SLOPE_OPTIONS.smooth,
    shadeStrength: clampNumber(options?.shadeStrength ?? DEFAULT_SLOPE_OPTIONS.shadeStrength, 0, 1),
    showGrid: options?.showGrid ?? DEFAULT_SLOPE_OPTIONS.showGrid,
    gridColor: options?.gridColor ?? DEFAULT_SLOPE_OPTIONS.gridColor,
    gridWidth: clampNumber(options?.gridWidth ?? DEFAULT_SLOPE_OPTIONS.gridWidth, 1, 8),
    heightOffset: clampNumber(options?.heightOffset ?? DEFAULT_SLOPE_OPTIONS.heightOffset, 0, 200),
    showStatsLabel: options?.showStatsLabel ?? DEFAULT_SLOPE_OPTIONS.showStatsLabel,
    grades: normalizeSlopeGrades(options?.grades),
  }
}

/** 格式化坡度角。 */
function formatSlope(value: number): string {
  return `${value.toFixed(2)}°`
}

/**
 * 坡度分析：矩形框选地形区域，按地形采样计算坡度。
 * - raster：平滑贴图模式，使用单张影像覆盖地形，视觉更连续。
 * - grid：网格色块模式，使用 Entity 面片逐格绘制，便于观察采样单元。
 */
export class SlopeAnalyze extends MeasureBase {
  /** 当前坡度分析参数 */
  private slopeOptions: ResolvedSlopeOptions
  /** 最近一次统计结果 */
  private stats: SlopeAnalyzeStats | null = null
  /** raster 模式生成的影像图层 */
  private rasterLayer: Cesium.ImageryLayer | null = null
  /** 异步采样版本号，用于丢弃过期结果 */
  private buildVersion = 0

  /**
   * @param options 创建参数
   */
  constructor(options: SlopeAnalyzeCreateOptions) {
    const { positions, position, ...baseOptions } = options
    super({ ...baseOptions, type: options.type ?? MeasureType.SLOPE_ANALYZE })
    this.slopeOptions = resolveSlopeOptions(options.slope)
    if (positions?.length) this.setPositions(positions)
    if (position) this.setPosition(position)
  }

  /** 获取当前坡度分析参数副本。 */
  getSlopeOptions(): SlopeAnalyzeOptions {
    return {
      ...this.slopeOptions,
      grades: this.slopeOptions.grades.map((grade) => ({ ...grade })),
    }
  }

  /**
   * 更新坡度分析参数；如果已经完成框选，会自动重新分析。
   * @param options 待合并参数
   */
  setSlopeOptions(options: Partial<SlopeAnalyzeOptions>): void {
    this.slopeOptions = resolveSlopeOptions({ ...this.slopeOptions, ...options })
    if (this.positions.length >= 2) void this.buildSlope()
  }

  /** 获取最近一次坡度统计结果。 */
  getStats(): SlopeAnalyzeStats | null {
    return this.stats ? { ...this.stats } : null
  }

  /**
   * 设置矩形对角点并预览范围。
   * @param positions 最多取前两点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.buildVersion++
    this.positions = positions.slice(0, 2)
    this.syncKeyPoints(this.positions)
    this.clearAnalysisResult()
    if (this.positions.length < 2) {
      this.clearDynamicLine()
      return
    }
    this.drawPreviewRectangle(this.positions[0]!, this.positions[1]!)
  }

  /**
   * 鼠标移动时预览矩形范围。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const anchor = this.positions[0]!
    this.positions = [anchor]
    this.drawPreviewRectangle(anchor, cursor)
  }

  /** 完成框选后开始坡度分析。 */
  complete(): void {
    if (this.positions.length < 2) return
    void this.buildSlope()
  }

  /** 移除全部坡度分析结果。 */
  clear(): void {
    this.buildVersion++
    this.removeRasterLayer()
    this.stats = null
    super.clear()
  }

  /** 采样地形并绘制坡度分析结果。 */
  private async buildSlope(): Promise<void> {
    const [a, b] = this.positions
    if (!a || !b) return

    const version = ++this.buildVersion
    this.clearDynamicLine()
    this.clearAnalysisResult()

    try {
      const grid = await sampleTerrainGrid(
        this.viewer,
        [a, b],
        this.slopeOptions.gridSize + 1,
        this.slopeOptions.gridSize + 1,
      )
      if (this.isStale(version)) return

      const analysis = this.computeSlopeAnalysisGrid(grid)
      this.stats = analysis.stats
      await this.drawAnalysis(grid, analysis, version)
      if (this.isStale(version)) return

      this.drawSlopeGrid(grid)
      this.drawStatsLabel(a, b)
      this.requestRender()
    } catch (error) {
      console.warn('[FastX] 坡度分析失败', error)
    }
  }

  /** 计算完整坡度分析网格。 */
  private computeSlopeAnalysisGrid(grid: TerrainGrid): SlopeAnalysisGrid {
    const rowCount = Math.max(grid.rows - 1, 1)
    const colCount = Math.max(grid.cols - 1, 1)
    const cells: SlopeCellInfo[][] = []
    let minSlope = Infinity
    let maxSlope = -Infinity
    let totalSlope = 0
    let cellCount = 0

    for (let r = 0; r < rowCount; r++) {
      cells[r] = []
      for (let c = 0; c < colCount; c++) {
        const info = this.computeCellSlopeInfo(grid, r, c)
        cells[r]![c] = info
        minSlope = Math.min(minSlope, info.slope)
        maxSlope = Math.max(maxSlope, info.slope)
        totalSlope += info.slope
        cellCount++
      }
    }

    return {
      rows: rowCount,
      cols: colCount,
      cells,
      stats: {
        minSlope: Number.isFinite(minSlope) ? minSlope : 0,
        maxSlope: Number.isFinite(maxSlope) ? maxSlope : 0,
        avgSlope: cellCount ? totalSlope / cellCount : 0,
        cellCount,
        minHeight: grid.minHeight,
        maxHeight: grid.maxHeight,
      },
    }
  }

  /** 计算单个采样单元的坡度和地形明暗值。 */
  private computeCellSlopeInfo(grid: TerrainGrid, row: number, col: number): SlopeCellInfo {
    const p00 = grid.points[row]![col]!
    const p10 = grid.points[row]![Math.min(col + 1, grid.cols - 1)]!
    const p01 = grid.points[Math.min(row + 1, grid.rows - 1)]![col]!
    const p11 = grid.points[Math.min(row + 1, grid.rows - 1)]![Math.min(col + 1, grid.cols - 1)]!
    const ewDistance = Math.max((surfaceDistanceMeters(p00, p10) + surfaceDistanceMeters(p01, p11)) / 2, 1)
    const nsDistance = Math.max((surfaceDistanceMeters(p00, p01) + surfaceDistanceMeters(p10, p11)) / 2, 1)
    const westHeight = (p00.height + p01.height) / 2
    const eastHeight = (p10.height + p11.height) / 2
    const southHeight = (p00.height + p10.height) / 2
    const northHeight = (p01.height + p11.height) / 2
    const dzdx = (eastHeight - westHeight) / ewDistance
    const dzdy = (northHeight - southHeight) / nsDistance
    const slope = Cesium.Math.toDegrees(Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)))
    return { slope, light: this.computeTerrainLight(dzdx, dzdy) }
  }

  /** 根据地形梯度估算一个柔和的明暗系数。 */
  private computeTerrainLight(dzdx: number, dzdy: number): number {
    const normalScale = 1 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1)
    const nx = -dzdx * normalScale
    const ny = -dzdy * normalScale
    const nz = normalScale
    return clampNumber(nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z, 0, 1)
  }

  /**
   * 根据渲染模式绘制坡度结果。
   * @param grid 地形采样网格
   * @param analysis 坡度分析网格
   * @param version 当前异步版本号
   */
  private async drawAnalysis(
    grid: TerrainGrid,
    analysis: SlopeAnalysisGrid,
    version: number,
  ): Promise<void> {
    if (this.slopeOptions.renderMode === 'grid') {
      this.drawSlopeCells(grid, analysis)
      return
    }
    await this.drawSlopeRaster(grid, analysis, version)
  }

  /**
   * raster 模式：生成连续色带 canvas 并贴到地形上。
   * @param grid 地形采样网格
   * @param analysis 坡度分析网格
   * @param version 当前异步版本号
   */
  private async drawSlopeRaster(
    grid: TerrainGrid,
    analysis: SlopeAnalysisGrid,
    version: number,
  ): Promise<void> {
    const layer = await createTerrainRasterOverlay(
      this.viewer,
      this.createSlopeRasterCanvas(grid, analysis),
      this.createGridRectangle(grid),
      { alpha: this.slopeOptions.fillAlpha },
    )

    if (this.isStale(version)) {
      removeTerrainRasterOverlay(this.viewer, layer)
      return
    }
    this.rasterLayer = layer
  }

  /** 生成坡度连续色带贴图。 */
  private createSlopeRasterCanvas(grid: TerrainGrid, analysis: SlopeAnalysisGrid): HTMLCanvasElement {
    const size = this.slopeOptions.textureSize
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return canvas

    const imageData = context.createImageData(size, size)
    const data = imageData.data
    const orientation = this.getGridTextureOrientation(grid)

    for (let y = 0; y < size; y++) {
      const imageV = this.normalizePixel(y, size)
      const gridV = orientation.flipY ? 1 - imageV : imageV
      for (let x = 0; x < size; x++) {
        const imageU = this.normalizePixel(x, size)
        const gridU = orientation.flipX ? 1 - imageU : imageU
        const sample = this.sampleAnalysisGrid(analysis, gridU, gridV)
        const color = this.resolveSlopeRgbColor(sample.slope)
        const shade = 1 + (sample.light - 0.68) * this.slopeOptions.shadeStrength
        const index = (y * size + x) * 4
        data[index] = this.shadeChannel(color.r, shade)
        data[index + 1] = this.shadeChannel(color.g, shade)
        data[index + 2] = this.shadeChannel(color.b, shade)
        data[index + 3] = 255
      }
    }

    context.putImageData(imageData, 0, 0)
    return canvas
  }

  /** 按归一化坐标读取坡度结果。 */
  private sampleAnalysisGrid(analysis: SlopeAnalysisGrid, u: number, v: number): SlopeCellInfo {
    const maxCol = Math.max(analysis.cols - 1, 0)
    const maxRow = Math.max(analysis.rows - 1, 0)
    const x = clampNumber(u, 0, 1) * maxCol
    const y = clampNumber(v, 0, 1) * maxRow

    if (!this.slopeOptions.smooth) {
      return analysis.cells[Math.round(y)]![Math.round(x)]!
    }

    const c0 = Math.floor(x)
    const r0 = Math.floor(y)
    const c1 = Math.min(c0 + 1, maxCol)
    const r1 = Math.min(r0 + 1, maxRow)
    const tx = x - c0
    const ty = y - r0
    const p00 = analysis.cells[r0]![c0]!
    const p10 = analysis.cells[r0]![c1]!
    const p01 = analysis.cells[r1]![c0]!
    const p11 = analysis.cells[r1]![c1]!

    return {
      slope: this.lerp(this.lerp(p00.slope, p10.slope, tx), this.lerp(p01.slope, p11.slope, tx), ty),
      light: this.lerp(this.lerp(p00.light, p10.light, tx), this.lerp(p01.light, p11.light, tx), ty),
    }
  }

  /**
   * grid 模式：逐个绘制坡度色块。
   * @param grid 地形采样网格
   * @param analysis 坡度分析网格
   */
  private drawSlopeCells(grid: TerrainGrid, analysis: SlopeAnalysisGrid): void {
    for (let r = 0; r < analysis.rows; r++) {
      for (let c = 0; c < analysis.cols; c++) {
        this.drawSlopeCell(grid, r, c, this.rgbToCss(this.resolveSlopeRgbColor(analysis.cells[r]![c]!.slope)))
      }
    }
  }

  /**
   * 绘制单个坡度网格面片。
   * @param grid 地形采样网格
   * @param row 单元行号
   * @param col 单元列号
   * @param color CSS 填充颜色
   */
  private drawSlopeCell(grid: TerrainGrid, row: number, col: number, color: string): Entity {
    const p00 = grid.points[row]![col]!
    const p10 = grid.points[row]![col + 1]!
    const p11 = grid.points[row + 1]![col + 1]!
    const p01 = grid.points[row + 1]![col]!
    const hierarchy = new Cesium.PolygonHierarchy(
      [p00, p10, p11, p01].map((point) =>
        toCartesian(terrainPointToLngLatHeight(point, this.slopeOptions.heightOffset)),
      ),
    )

    const entity = this.viewer.entities.add({
      id: `fastx-measure-slope-${this.id}-${row}-${col}`,
      polygon: {
        hierarchy,
        material: Cesium.Color.fromCssColorString(color).withAlpha(this.slopeOptions.fillAlpha),
        outline: false,
        perPositionHeight: true,
      },
    })
    this.track(entity)
    this.segmentEntities.push(entity)
    return entity
  }

  /**
   * 绘制采样网格线；关闭网格时仅保留外轮廓，便于识别分析范围。
   * @param grid 地形采样网格
   */
  private drawSlopeGrid(grid: TerrainGrid): void {
    const lineColor = this.slopeOptions.showGrid ? this.slopeOptions.gridColor : this.style.lineColor
    const width = this.slopeOptions.showGrid ? this.slopeOptions.gridWidth : this.style.lineWidth
    const rows = this.slopeOptions.showGrid ? [...Array(grid.rows).keys()] : [0, grid.rows - 1]
    const cols = this.slopeOptions.showGrid ? [...Array(grid.cols).keys()] : [0, grid.cols - 1]

    for (const row of rows) {
      this.drawSegmentPolyline(this.gridRowPositions(grid, row), lineColor, width, false)
    }
    for (const col of cols) {
      this.drawSegmentPolyline(this.gridColPositions(grid, col), lineColor, width, false)
    }
  }

  /**
   * 获取采样范围对应的 Cesium 矩形。
   * @param grid 地形采样网格
   */
  private createGridRectangle(grid: TerrainGrid): Cesium.Rectangle {
    let west = Infinity
    let east = -Infinity
    let south = Infinity
    let north = -Infinity

    for (const row of grid.points) {
      for (const point of row) {
        west = Math.min(west, point.lon)
        east = Math.max(east, point.lon)
        south = Math.min(south, point.lat)
        north = Math.max(north, point.lat)
      }
    }

    return Cesium.Rectangle.fromDegrees(west, south, east, north)
  }

  /**
   * 根据坡度值在分级色带之间连续取色。
   * @param slope 坡度角（度）
   */
  private resolveSlopeRgbColor(slope: number): RgbColor {
    const first = this.slopeOptions.grades[0]!
    if (slope <= first.maxSlope) return this.parseCssColor(first.color)

    for (let i = 1; i < this.slopeOptions.grades.length; i++) {
      const previous = this.slopeOptions.grades[i - 1]!
      const current = this.slopeOptions.grades[i]!
      if (slope <= current.maxSlope) {
        const span = Math.max(current.maxSlope - previous.maxSlope, 1e-6)
        const t = clampNumber((slope - previous.maxSlope) / span, 0, 1)
        return this.lerpColor(this.parseCssColor(previous.color), this.parseCssColor(current.color), t)
      }
    }

    return this.parseCssColor(this.slopeOptions.grades[this.slopeOptions.grades.length - 1]!.color)
  }

  /** 将 CSS 颜色解析为 0~255 RGB。 */
  private parseCssColor(cssColor: string, fallback = '#22d3ee'): RgbColor {
    const cached = COLOR_CACHE.get(cssColor)
    if (cached) return cached
    try {
      const color = Cesium.Color.fromCssColorString(cssColor)
      const parsed = {
        r: Math.round(clampNumber(color.red, 0, 1) * 255),
        g: Math.round(clampNumber(color.green, 0, 1) * 255),
        b: Math.round(clampNumber(color.blue, 0, 1) * 255),
      }
      COLOR_CACHE.set(cssColor, parsed)
      return parsed
    } catch {
      return this.parseCssColor(fallback)
    }
  }

  /** 获取网格行线顶点。 */
  private gridRowPositions(grid: TerrainGrid, row: number): LngLatHeightTuple[] {
    return grid.points[row]!.map((point) => this.offsetPoint(point))
  }

  /** 获取网格列线顶点。 */
  private gridColPositions(grid: TerrainGrid, col: number): LngLatHeightTuple[] {
    const positions: LngLatHeightTuple[] = []
    for (let r = 0; r < grid.rows; r++) {
      positions.push(this.offsetPoint(grid.points[r]![col]!))
    }
    return positions
  }

  /** 转换为带高程偏移的绘制坐标。 */
  private offsetPoint(point: TerrainGridPoint): LngLatHeightTuple {
    return terrainPointToLngLatHeight(point, this.slopeOptions.heightOffset + 0.5)
  }

  /** 绘制坡度统计标注。 */
  private drawStatsLabel(a: LngLatHeightTuple, b: LngLatHeightTuple): void {
    if (!this.slopeOptions.showStatsLabel || !this.stats) return
    this.updateMeasureLabel(
      this.midpoint(a, b),
      [
        '坡度统计',
        `最小：${formatSlope(this.stats.minSlope)}`,
        `最大：${formatSlope(this.stats.maxSlope)}`,
        `平均：${formatSlope(this.stats.avgSlope)}`,
      ].join('\n'),
    )
  }

  /** 绘制矩形预览框。 */
  private drawPreviewRectangle(a: LngLatHeightTuple, b: LngLatHeightTuple): void {
    this.setDynamicLinePositions(rectangleRing(a, b), {
      clamp: true,
      color: this.style.lineColor,
      width: this.style.lineWidth,
    })
  }

  /** 清理坡度分析结果，不清理关键点和预览线。 */
  private clearAnalysisResult(): void {
    this.removeRasterLayer()
    this.clearSegmentEntities()
    this.clearMeasureLabel()
    this.stats = null
  }

  /** 移除当前坡度栅格贴图。 */
  private removeRasterLayer(): void {
    removeTerrainRasterOverlay(this.viewer, this.rasterLayer)
    this.rasterLayer = null
  }

  /** 判断异步采样结果是否已过期。 */
  private isStale(version: number): boolean {
    return version !== this.buildVersion
  }

  /** 计算贴图坐标相对采样网格是否需要翻转。 */
  private getGridTextureOrientation(grid: TerrainGrid): { flipX: boolean; flipY: boolean } {
    const firstPoint = grid.points[0]![0]!
    const lastRowPoint = grid.points[grid.rows - 1]![0]!
    const lastColPoint = grid.points[0]![grid.cols - 1]!
    return {
      flipX: firstPoint.lon > lastColPoint.lon,
      flipY: firstPoint.lat < lastRowPoint.lat,
    }
  }

  /** 像素坐标归一化到 0~1。 */
  private normalizePixel(pixel: number, size: number): number {
    return size > 1 ? pixel / (size - 1) : 0
  }

  /** 线性插值。 */
  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t
  }

  /** RGB 颜色插值。 */
  private lerpColor(from: RgbColor, to: RgbColor, t: number): RgbColor {
    return {
      r: Math.round(this.lerp(from.r, to.r, t)),
      g: Math.round(this.lerp(from.g, to.g, t)),
      b: Math.round(this.lerp(from.b, to.b, t)),
    }
  }

  /** RGB 颜色转 CSS rgb() 字符串。 */
  private rgbToCss(color: RgbColor): string {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  /** 应用地形明暗系数。 */
  private shadeChannel(channel: number, shade: number): number {
    return Math.round(clampNumber(channel * shade, 0, 255))
  }
}
