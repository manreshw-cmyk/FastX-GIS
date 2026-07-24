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
  type AspectAnalyzeOptions,
  type AspectAnalyzeStats,
  type AspectGrade,
  type AspectRenderMode,
  type LngLatHeightTuple,
  type MeasureCreateOptions,
} from '../types'
import { MeasureBase } from './MeasureBase'

/** 坡向分析默认方向色带 */
export const DEFAULT_ASPECT_GRADES: AspectGrade[] = [
  { minAspect: 337.5, maxAspect: 22.5, color: '#38bdf8', label: '北坡' },
  { minAspect: 22.5, maxAspect: 67.5, color: '#2dd4bf', label: '东北坡' },
  { minAspect: 67.5, maxAspect: 112.5, color: '#84cc16', label: '东坡' },
  { minAspect: 112.5, maxAspect: 157.5, color: '#facc15', label: '东南坡' },
  { minAspect: 157.5, maxAspect: 202.5, color: '#fb923c', label: '南坡' },
  { minAspect: 202.5, maxAspect: 247.5, color: '#f472b6', label: '西南坡' },
  { minAspect: 247.5, maxAspect: 292.5, color: '#a78bfa', label: '西坡' },
  { minAspect: 292.5, maxAspect: 337.5, color: '#60a5fa', label: '西北坡' },
]

/** 坡向分析构造参数，直接 new 时可省略 type。 */
export type AspectAnalyzeCreateOptions = Omit<MeasureCreateOptions, 'type'> & {
  /** 分析类型；不传时默认使用 aspectAnalyze。 */
  type?: MeasureCreateOptions['type']
}

type ResolvedAspectOptions = Required<Omit<AspectAnalyzeOptions, 'grades'>> & {
  grades: AspectGrade[]
}

/** 0~255 RGB 颜色 */
interface RgbColor {
  r: number
  g: number
  b: number
}

/** 单个坡向采样单元的计算结果 */
interface AspectCellInfo {
  /** 坡向角，0 为北、90 为东；平地为 null */
  aspect: number | null
  /** 当前采样单元坡度角（度） */
  slope: number
  /** 基于高程梯度估算的明暗值，0~1 */
  light: number
}

/** 坡向分析网格结果 */
interface AspectAnalysisGrid {
  rows: number
  cols: number
  cells: AspectCellInfo[][]
  stats: AspectAnalyzeStats
}

const DEFAULT_ASPECT_OPTIONS: ResolvedAspectOptions = {
  gridSize: 48,
  fillAlpha: 0.58,
  renderMode: 'raster',
  textureSize: 768,
  smooth: true,
  shadeStrength: 0.25,
  showGrid: false,
  gridColor: '#ffffff',
  gridWidth: 1,
  heightOffset: 1.5,
  showStatsLabel: true,
  flatSlopeThreshold: 1,
  flatColor: '#d1d5db',
  grades: DEFAULT_ASPECT_GRADES,
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

/** 归一化坡向角到 [0, 360)。 */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/** 解析渲染模式，未知值回退到平滑贴图。 */
function resolveRenderMode(mode?: AspectRenderMode): AspectRenderMode {
  return mode === 'grid' ? 'grid' : 'raster'
}

/** 清洗坡向色带。 */
function normalizeAspectGrades(grades?: AspectGrade[]): AspectGrade[] {
  const normalized = [...(grades?.length ? grades : DEFAULT_ASPECT_GRADES)]
    .filter((grade) => Number.isFinite(grade.minAspect) && Number.isFinite(grade.maxAspect) && grade.color)
    .map((grade) => ({
      ...grade,
      minAspect: normalizeAngle(grade.minAspect),
      maxAspect: normalizeAngle(grade.maxAspect),
    }))
  return normalized.length ? normalized : DEFAULT_ASPECT_GRADES
}

/** 合并坡向分析参数并限制安全范围。 */
function resolveAspectOptions(options?: AspectAnalyzeOptions): ResolvedAspectOptions {
  return {
    gridSize: clampInteger(options?.gridSize, DEFAULT_ASPECT_OPTIONS.gridSize, 4, 120),
    fillAlpha: clampNumber(options?.fillAlpha ?? DEFAULT_ASPECT_OPTIONS.fillAlpha, 0, 1),
    renderMode: resolveRenderMode(options?.renderMode),
    textureSize: clampInteger(options?.textureSize, DEFAULT_ASPECT_OPTIONS.textureSize, 128, 2048),
    smooth: options?.smooth ?? DEFAULT_ASPECT_OPTIONS.smooth,
    shadeStrength: clampNumber(options?.shadeStrength ?? DEFAULT_ASPECT_OPTIONS.shadeStrength, 0, 1),
    showGrid: options?.showGrid ?? DEFAULT_ASPECT_OPTIONS.showGrid,
    gridColor: options?.gridColor ?? DEFAULT_ASPECT_OPTIONS.gridColor,
    gridWidth: clampNumber(options?.gridWidth ?? DEFAULT_ASPECT_OPTIONS.gridWidth, 1, 8),
    heightOffset: clampNumber(options?.heightOffset ?? DEFAULT_ASPECT_OPTIONS.heightOffset, 0, 200),
    showStatsLabel: options?.showStatsLabel ?? DEFAULT_ASPECT_OPTIONS.showStatsLabel,
    flatSlopeThreshold: clampNumber(
      options?.flatSlopeThreshold ?? DEFAULT_ASPECT_OPTIONS.flatSlopeThreshold,
      0,
      15,
    ),
    flatColor: options?.flatColor ?? DEFAULT_ASPECT_OPTIONS.flatColor,
    grades: normalizeAspectGrades(options?.grades),
  }
}

/** 格式化坡向角。 */
function formatAspect(value: number | null): string {
  return value == null ? '平地' : `${value.toFixed(1)}°`
}

/**
 * 坡向/坡面分析：矩形框选地形区域，按地形采样计算每个单元的坡面朝向。
 * - raster：平滑贴图模式，使用单张影像覆盖地形。
 * - grid：网格色块模式，使用 Entity 面片逐格绘制。
 */
export class AspectAnalyze extends MeasureBase {
  /** 当前坡向分析参数 */
  private aspectOptions: ResolvedAspectOptions
  /** 最近一次统计结果 */
  private stats: AspectAnalyzeStats | null = null
  /** raster 模式生成的影像图层 */
  private rasterLayer: Cesium.ImageryLayer | null = null
  /** 异步采样版本号，用于丢弃过期结果 */
  private buildVersion = 0

  /**
   * @param options 创建参数
   */
  constructor(options: AspectAnalyzeCreateOptions) {
    const { positions, position, ...baseOptions } = options
    super({ ...baseOptions, type: options.type ?? MeasureType.ASPECT_ANALYZE })
    this.aspectOptions = resolveAspectOptions(options.aspect)
    if (positions?.length) this.setPositions(positions)
    if (position) this.setPosition(position)
  }

  /** 获取当前坡向分析参数副本。 */
  getAspectOptions(): AspectAnalyzeOptions {
    return {
      ...this.aspectOptions,
      grades: this.aspectOptions.grades.map((grade) => ({ ...grade })),
    }
  }

  /**
   * 更新坡向分析参数；如果已经完成框选，会自动重新分析。
   * @param options 待合并参数
   */
  setAspectOptions(options: Partial<AspectAnalyzeOptions>): void {
    this.aspectOptions = resolveAspectOptions({ ...this.aspectOptions, ...options })
    if (this.positions.length >= 2) void this.buildAspect()
  }

  /** 获取最近一次坡向统计结果。 */
  getStats(): AspectAnalyzeStats | null {
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

  /** 完成框选后开始坡向分析。 */
  complete(): void {
    if (this.positions.length < 2) return
    void this.buildAspect()
  }

  /** 移除全部坡向分析结果。 */
  clear(): void {
    this.buildVersion++
    this.removeRasterLayer()
    this.stats = null
    super.clear()
  }

  /** 采样地形并绘制坡向分析结果。 */
  private async buildAspect(): Promise<void> {
    const [a, b] = this.positions
    if (!a || !b) return

    const version = ++this.buildVersion
    this.clearDynamicLine()
    this.clearAnalysisResult()

    try {
      const grid = await sampleTerrainGrid(
        this.viewer,
        [a, b],
        this.aspectOptions.gridSize + 1,
        this.aspectOptions.gridSize + 1,
      )
      if (this.isStale(version)) return

      const analysis = this.computeAspectAnalysisGrid(grid)
      this.stats = analysis.stats
      await this.drawAnalysis(grid, analysis, version)
      if (this.isStale(version)) return

      this.drawAspectGrid(grid)
      this.drawStatsLabel(a, b)
      this.requestRender()
    } catch (error) {
      console.warn('[FastX] 坡向分析失败', error)
    }
  }

  /** 计算完整坡向分析网格。 */
  private computeAspectAnalysisGrid(grid: TerrainGrid): AspectAnalysisGrid {
    const rowCount = Math.max(grid.rows - 1, 1)
    const colCount = Math.max(grid.cols - 1, 1)
    const cells: AspectCellInfo[][] = []
    let cellCount = 0
    let flatCount = 0
    let sx = 0
    let sy = 0
    const directionCounts = new Map<string, number>()

    for (let r = 0; r < rowCount; r++) {
      cells[r] = []
      for (let c = 0; c < colCount; c++) {
        const info = this.computeCellAspectInfo(grid, r, c)
        cells[r]![c] = info
        cellCount++
        if (info.aspect == null) {
          flatCount++
          continue
        }
        const radians = Cesium.Math.toRadians(info.aspect)
        sx += Math.sin(radians)
        sy += Math.cos(radians)
        const grade = this.resolveAspectGrade(info.aspect)
        const label = grade?.label ?? '未分级'
        directionCounts.set(label, (directionCounts.get(label) ?? 0) + 1)
      }
    }

    return {
      rows: rowCount,
      cols: colCount,
      cells,
      stats: {
        cellCount,
        flatCount,
        meanAspect: sx === 0 && sy === 0 ? null : normalizeAngle(Cesium.Math.toDegrees(Math.atan2(sx, sy))),
        dominantAspect: this.resolveDominantAspect(directionCounts),
        minHeight: grid.minHeight,
        maxHeight: grid.maxHeight,
      },
    }
  }

  /** 计算单个采样单元的坡向、坡度和地形明暗值。 */
  private computeCellAspectInfo(grid: TerrainGrid, row: number, col: number): AspectCellInfo {
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
    const aspect = slope <= this.aspectOptions.flatSlopeThreshold
      ? null
      : normalizeAngle(Cesium.Math.toDegrees(Math.atan2(-dzdx, -dzdy)))
    return { aspect, slope, light: this.computeTerrainLight(dzdx, dzdy) }
  }

  /** 根据地形梯度估算一个柔和的明暗系数。 */
  private computeTerrainLight(dzdx: number, dzdy: number): number {
    const normalScale = 1 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1)
    const nx = -dzdx * normalScale
    const ny = -dzdy * normalScale
    const nz = normalScale
    return clampNumber(nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z, 0, 1)
  }

  /** 根据渲染模式绘制坡向结果。 */
  private async drawAnalysis(
    grid: TerrainGrid,
    analysis: AspectAnalysisGrid,
    version: number,
  ): Promise<void> {
    if (this.aspectOptions.renderMode === 'grid') {
      this.drawAspectCells(grid, analysis)
      return
    }
    await this.drawAspectRaster(grid, analysis, version)
  }

  /** raster 模式：生成连续色带 canvas 并贴到地形上。 */
  private async drawAspectRaster(
    grid: TerrainGrid,
    analysis: AspectAnalysisGrid,
    version: number,
  ): Promise<void> {
    const layer = await createTerrainRasterOverlay(
      this.viewer,
      this.createAspectRasterCanvas(grid, analysis),
      this.createGridRectangle(grid),
      { alpha: this.aspectOptions.fillAlpha },
    )

    if (this.isStale(version)) {
      removeTerrainRasterOverlay(this.viewer, layer)
      return
    }
    this.rasterLayer = layer
  }

  /** 生成坡向连续贴图。 */
  private createAspectRasterCanvas(grid: TerrainGrid, analysis: AspectAnalysisGrid): HTMLCanvasElement {
    const size = this.aspectOptions.textureSize
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
        const color = this.resolveAspectRgbColor(sample.aspect)
        const shade = 1 + (sample.light - 0.68) * this.aspectOptions.shadeStrength
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

  /** 按归一化坐标读取坡向结果。 */
  private sampleAnalysisGrid(analysis: AspectAnalysisGrid, u: number, v: number): AspectCellInfo {
    const maxCol = Math.max(analysis.cols - 1, 0)
    const maxRow = Math.max(analysis.rows - 1, 0)
    const x = clampNumber(u, 0, 1) * maxCol
    const y = clampNumber(v, 0, 1) * maxRow

    if (!this.aspectOptions.smooth) {
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
      aspect: this.interpolateAspect(p00, p10, p01, p11, tx, ty),
      slope: this.lerp(this.lerp(p00.slope, p10.slope, tx), this.lerp(p01.slope, p11.slope, tx), ty),
      light: this.lerp(this.lerp(p00.light, p10.light, tx), this.lerp(p01.light, p11.light, tx), ty),
    }
  }

  /** 对坡向角做环形插值，避免 359° 与 1° 被拉到 180°。 */
  private interpolateAspect(
    p00: AspectCellInfo,
    p10: AspectCellInfo,
    p01: AspectCellInfo,
    p11: AspectCellInfo,
    tx: number,
    ty: number,
  ): number | null {
    const weighted = [
      { point: p00, weight: (1 - tx) * (1 - ty) },
      { point: p10, weight: tx * (1 - ty) },
      { point: p01, weight: (1 - tx) * ty },
      { point: p11, weight: tx * ty },
    ]
    let sx = 0
    let sy = 0
    let total = 0
    for (const item of weighted) {
      if (item.point.aspect == null || item.weight <= 0) continue
      const radians = Cesium.Math.toRadians(item.point.aspect)
      sx += Math.sin(radians) * item.weight
      sy += Math.cos(radians) * item.weight
      total += item.weight
    }
    return total === 0 ? null : normalizeAngle(Cesium.Math.toDegrees(Math.atan2(sx, sy)))
  }

  /** grid 模式：逐个绘制坡向色块。 */
  private drawAspectCells(grid: TerrainGrid, analysis: AspectAnalysisGrid): void {
    for (let r = 0; r < analysis.rows; r++) {
      for (let c = 0; c < analysis.cols; c++) {
        this.drawAspectCell(grid, r, c, this.rgbToCss(this.resolveAspectRgbColor(analysis.cells[r]![c]!.aspect)))
      }
    }
  }

  /** 绘制单个坡向网格面片。 */
  private drawAspectCell(grid: TerrainGrid, row: number, col: number, color: string): Entity {
    const p00 = grid.points[row]![col]!
    const p10 = grid.points[row]![col + 1]!
    const p11 = grid.points[row + 1]![col + 1]!
    const p01 = grid.points[row + 1]![col]!
    const hierarchy = new Cesium.PolygonHierarchy(
      [p00, p10, p11, p01].map((point) =>
        toCartesian(terrainPointToLngLatHeight(point, this.aspectOptions.heightOffset)),
      ),
    )

    const entity = this.viewer.entities.add({
      id: `fastx-measure-aspect-${this.id}-${row}-${col}`,
      polygon: {
        hierarchy,
        material: Cesium.Color.fromCssColorString(color).withAlpha(this.aspectOptions.fillAlpha),
        outline: false,
        perPositionHeight: true,
      },
    })
    this.track(entity)
    this.segmentEntities.push(entity)
    return entity
  }

  /** 绘制采样网格线；关闭网格时仅保留外轮廓。 */
  private drawAspectGrid(grid: TerrainGrid): void {
    const lineColor = this.aspectOptions.showGrid ? this.aspectOptions.gridColor : this.style.lineColor
    const width = this.aspectOptions.showGrid ? this.aspectOptions.gridWidth : this.style.lineWidth
    const rows = this.aspectOptions.showGrid ? [...Array(grid.rows).keys()] : [0, grid.rows - 1]
    const cols = this.aspectOptions.showGrid ? [...Array(grid.cols).keys()] : [0, grid.cols - 1]

    for (const row of rows) {
      this.drawSegmentPolyline(this.gridRowPositions(grid, row), lineColor, width, false)
    }
    for (const col of cols) {
      this.drawSegmentPolyline(this.gridColPositions(grid, col), lineColor, width, false)
    }
  }

  /** 获取采样范围对应的 Cesium 矩形。 */
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

  /** 根据坡向角获取对应分级。 */
  private resolveAspectGrade(aspect: number): AspectGrade | undefined {
    return this.aspectOptions.grades.find((grade) => {
      if (grade.minAspect <= grade.maxAspect) {
        return aspect >= grade.minAspect && aspect < grade.maxAspect
      }
      return aspect >= grade.minAspect || aspect < grade.maxAspect
    })
  }

  /** 根据坡向角取色；平地使用 flatColor。 */
  private resolveAspectRgbColor(aspect: number | null): RgbColor {
    if (aspect == null) return this.parseCssColor(this.aspectOptions.flatColor)
    const grade = this.resolveAspectGrade(aspect) ?? this.aspectOptions.grades[0]!
    return this.parseCssColor(grade.color)
  }

  /** 将 CSS 颜色解析为 0~255 RGB。 */
  private parseCssColor(cssColor: string, fallback = '#38bdf8'): RgbColor {
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

  /** 获取出现次数最多的坡向分级。 */
  private resolveDominantAspect(counts: Map<string, number>): string | null {
    let label: string | null = null
    let count = 0
    for (const [key, value] of counts) {
      if (value > count) {
        label = key
        count = value
      }
    }
    return label
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
    return terrainPointToLngLatHeight(point, this.aspectOptions.heightOffset + 0.5)
  }

  /** 绘制坡向统计标注。 */
  private drawStatsLabel(a: LngLatHeightTuple, b: LngLatHeightTuple): void {
    if (!this.aspectOptions.showStatsLabel || !this.stats) return
    this.updateMeasureLabel(
      this.midpoint(a, b),
      [
        '坡向统计',
        `平均：${formatAspect(this.stats.meanAspect)}`,
        `主导：${this.stats.dominantAspect ?? '无'}`,
        `平地：${this.stats.flatCount}/${this.stats.cellCount}`,
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

  /** 清理坡向分析结果，不清理关键点和预览线。 */
  private clearAnalysisResult(): void {
    this.removeRasterLayer()
    this.clearSegmentEntities()
    this.clearMeasureLabel()
    this.stats = null
  }

  /** 移除当前坡向栅格贴图。 */
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

  /** RGB 颜色转 CSS rgb() 字符串。 */
  private rgbToCss(color: RgbColor): string {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  /** 应用地形明暗系数。 */
  private shadeChannel(channel: number, shade: number): number {
    return Math.round(clampNumber(channel * shade, 0, 255))
  }
}
