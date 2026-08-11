import * as Cesium from 'cesium'
import type { Entity } from 'cesium'
import { toCartesian } from '../measureMath'
import {
  sampleTerrainGrid,
  surfaceDistanceMeters,
  terrainPointToLngLatHeight,
  type TerrainGrid,
  type TerrainGridPoint,
} from '../terrainGrid'
import { createTerrainRasterOverlay, removeTerrainRasterOverlay } from '../terrainRasterOverlay'
import {
  MeasureType,
  type FloodAnalyzeOptions,
  type FloodCell,
  type FloodRenderMode,
  type FloodResult,
  type FloodStats,
  type FloodWaterLevelMode,
  type LngLatHeightTuple,
  type MeasureCreateOptions,
} from '../types'
import { MeasureBase } from './MeasureBase'

/** 淹没分析构造参数，直接 new 时可省略 type。 */
export type FloodAnalyzeCreateOptions = Omit<MeasureCreateOptions, 'type'> & {
  /** 分析类型；不传时默认使用 floodAnalyze。 */
  type?: MeasureCreateOptions['type']
}

type ResolvedFloodOptions = Required<Omit<FloodAnalyzeOptions, 'onFloodChange'>> & {
  onFloodChange?: FloodAnalyzeOptions['onFloodChange']
}

/** 0~255 RGB 颜色 */
interface RgbColor {
  r: number
  g: number
  b: number
}

/** 单个淹没分析采样单元几何信息 */
interface FloodCellGeometry {
  /** 单元四角采样点 */
  corners: [TerrainGridPoint, TerrainGridPoint, TerrainGridPoint, TerrainGridPoint]
  /** 单元中心采样点 */
  center: TerrainGridPoint
  /** 单元面积（平方米） */
  area: number
}

const DEFAULT_FLOOD_OPTIONS: ResolvedFloodOptions = {
  gridSize: 40,
  renderMode: 'grid',
  textureSize: 768,
  smooth: true,
  clipToPolygon: true,
  waterLevelMode: 'relativeToMin',
  waterLevel: 30,
  tolerance: 0,
  heightOffset: 1.5,
  waterColor: '#22d3ee',
  dryColor: '#f59e0b',
  waterAlpha: 0.58,
  dryAlpha: 0.2,
  showFloodedCells: true,
  showDryCells: false,
  showGrid: false,
  gridColor: '#ffffff',
  showStatsLabel: true,
  onFloodChange: undefined,
}

const COLOR_CACHE = new Map<string, RgbColor>()

/** 限制数值范围。 */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 限制并四舍五入为整数。 */
function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.round(clampNumber(value!, min, max))
}

/** 读取有限数值，否则使用默认值。 */
function finiteNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return clampNumber(value!, min, max)
}

/** 解析水位模式。 */
function resolveWaterLevelMode(mode?: FloodWaterLevelMode): FloodWaterLevelMode {
  return mode === 'absolute' || mode === 'relativeToAverage' ? mode : 'relativeToMin'
}

/** 解析渲染模式，未知值回退到网格色块，兼容旧默认效果。 */
function resolveRenderMode(mode?: FloodRenderMode): FloodRenderMode {
  return mode === 'raster' ? 'raster' : 'grid'
}

/** 合并淹没分析参数并限制安全范围。 */
function resolveFloodOptions(options?: FloodAnalyzeOptions): ResolvedFloodOptions {
  return {
    gridSize: clampInteger(options?.gridSize, DEFAULT_FLOOD_OPTIONS.gridSize, 4, 100),
    renderMode: resolveRenderMode(options?.renderMode),
    textureSize: clampInteger(options?.textureSize, DEFAULT_FLOOD_OPTIONS.textureSize, 128, 2048),
    smooth: options?.smooth ?? DEFAULT_FLOOD_OPTIONS.smooth,
    clipToPolygon: options?.clipToPolygon ?? DEFAULT_FLOOD_OPTIONS.clipToPolygon,
    waterLevelMode: resolveWaterLevelMode(options?.waterLevelMode),
    waterLevel: finiteNumber(options?.waterLevel, DEFAULT_FLOOD_OPTIONS.waterLevel, -11_000, 100_000),
    tolerance: finiteNumber(options?.tolerance, DEFAULT_FLOOD_OPTIONS.tolerance, 0, 10_000),
    heightOffset: finiteNumber(options?.heightOffset, DEFAULT_FLOOD_OPTIONS.heightOffset, 0, 200),
    waterColor: options?.waterColor ?? DEFAULT_FLOOD_OPTIONS.waterColor,
    dryColor: options?.dryColor ?? DEFAULT_FLOOD_OPTIONS.dryColor,
    waterAlpha: finiteNumber(options?.waterAlpha, DEFAULT_FLOOD_OPTIONS.waterAlpha, 0, 1),
    dryAlpha: finiteNumber(options?.dryAlpha, DEFAULT_FLOOD_OPTIONS.dryAlpha, 0, 1),
    showFloodedCells: options?.showFloodedCells ?? DEFAULT_FLOOD_OPTIONS.showFloodedCells,
    showDryCells: options?.showDryCells ?? DEFAULT_FLOOD_OPTIONS.showDryCells,
    showGrid: options?.showGrid ?? DEFAULT_FLOOD_OPTIONS.showGrid,
    gridColor: options?.gridColor ?? DEFAULT_FLOOD_OPTIONS.gridColor,
    showStatsLabel: options?.showStatsLabel ?? DEFAULT_FLOOD_OPTIONS.showStatsLabel,
    onFloodChange: options?.onFloodChange,
  }
}

/** 格式化面积。 */
function formatArea(area: number): string {
  if (!Number.isFinite(area)) return '-'
  if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`
  return `${area.toFixed(2)} m²`
}

/** 格式化体积。 */
function formatVolume(volume: number): string {
  if (!Number.isFinite(volume)) return '-'
  if (volume >= 10_000) return `${(volume / 10_000).toFixed(2)} 万m³`
  return `${volume.toFixed(2)} m³`
}

/**
 * 淹没分析：多边形框选地形区域，根据水位高程统计淹没面积、蓄水体积和最大水深。
 * - grid：逐格 Entity 面片，便于核对采样单元。
 * - raster：单张平滑贴图，视觉连续，并可裁剪到绘制多边形边界。
 */
export class FloodAnalyze extends MeasureBase {
  /** 当前淹没分析参数 */
  private floodOptions: ResolvedFloodOptions
  /** 最近一次淹没分析结果 */
  private result: FloodResult | null = null
  /** raster 模式生成的影像图层 */
  private rasterLayer: Cesium.ImageryLayer | null = null
  /** 异步采样版本号，用于丢弃过期结果 */
  private buildVersion = 0

  /**
   * @param options 创建参数
   */
  constructor(options: FloodAnalyzeCreateOptions) {
    const { positions, position, ...baseOptions } = options
    super({ ...baseOptions, type: options.type ?? MeasureType.FLOOD_ANALYZE })
    this.floodOptions = resolveFloodOptions(options.flood)
    if (positions?.length) this.setPositions(positions)
    if (position) this.setPosition(position)
  }

  /** 获取当前淹没分析参数副本。 */
  getFloodOptions(): FloodAnalyzeOptions {
    return { ...this.floodOptions }
  }

  /**
   * 更新淹没分析参数；如果已经完成绘制，会自动重新分析。
   * @param options 待合并参数
   */
  setFloodOptions(options: Partial<FloodAnalyzeOptions>): void {
    this.floodOptions = resolveFloodOptions({ ...this.floodOptions, ...options })
    if (this.positions.length >= 3) void this.buildFlood()
  }

  /** 获取最近一次淹没分析结果。 */
  getResult(): FloodResult | null {
    return this.result ? this.cloneResult(this.result) : null
  }

  /**
   * 设置分析范围多边形顶点。
   * @param positions 多边形顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.buildVersion++
    this.positions = [...positions]
    this.syncKeyPoints(this.positions)
    this.clearAnalysisResult()
    this.drawPreviewGeometry(this.positions)
  }

  /**
   * 鼠标移动时预览分析范围。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    this.drawPreviewGeometry([...this.positions, cursor])
  }

  /** 完成绘制后开始淹没分析。 */
  complete(): void {
    if (this.positions.length < 3) return
    void this.buildFlood()
  }

  /** 移除全部淹没分析结果。 */
  clear(): void {
    this.buildVersion++
    this.removeRasterLayer()
    this.result = null
    this.emitResult(null)
    super.clear()
  }

  /** 采样地形并计算淹没结果。 */
  private async buildFlood(): Promise<void> {
    if (this.positions.length < 3) return
    const version = ++this.buildVersion
    const polygon = this.positions.map((point) => [...point] as LngLatHeightTuple)
    this.clearDynamicLine()
    this.clearDynamicPolygon()
    this.clearAnalysisResult()

    try {
      const grid = await sampleTerrainGrid(
        this.viewer,
        this.getBoundingCorners(polygon),
        this.floodOptions.gridSize + 1,
        this.floodOptions.gridSize + 1,
      )
      if (this.isStale(version)) return

      const geometries = this.collectCellsInPolygon(grid, polygon)
      const waterLevel = this.resolveWaterLevel(geometries)
      const result = this.computeFloodResult(polygon, geometries, waterLevel)
      this.result = result
      await this.drawFloodResult(result, grid, geometries, version)
      if (this.isStale(version)) return

      this.emitResult(result)
      this.requestRender()
    } catch (error) {
      console.warn('[FastX] 淹没分析失败', error)
      this.emitResult(null)
    }
  }

  /** 绘制预览线或预览面。 */
  private drawPreviewGeometry(positions: LngLatHeightTuple[]): void {
    if (positions.length >= 3) {
      this.setDynamicPolygon(positions, true, this.style.fillColor, this.style.fillAlpha, this.style.lineColor)
      return
    }
    if (positions.length >= 2) {
      this.setDynamicLinePositions(positions, {
        clamp: true,
        color: this.style.lineColor,
        width: this.style.lineWidth,
      })
      return
    }
    this.clearDynamicLine()
    this.clearDynamicPolygon()
  }

  /** 获取多边形外包矩形对角点。 */
  private getBoundingCorners(polygon: LngLatHeightTuple[]): [LngLatHeightTuple, LngLatHeightTuple] {
    let west = Infinity
    let east = -Infinity
    let south = Infinity
    let north = -Infinity
    for (const point of polygon) {
      west = Math.min(west, point[0])
      east = Math.max(east, point[0])
      south = Math.min(south, point[1])
      north = Math.max(north, point[1])
    }
    const height = polygon[0]?.[2] ?? 0
    return [
      [west, south, height],
      [east, north, height],
    ]
  }

  /** 收集多边形内部的采样单元。 */
  private collectCellsInPolygon(grid: TerrainGrid, polygon: LngLatHeightTuple[]): FloodCellGeometry[] {
    const cells: FloodCellGeometry[] = []
    for (let row = 0; row < grid.rows - 1; row++) {
      for (let col = 0; col < grid.cols - 1; col++) {
        const p00 = grid.points[row]![col]!
        const p10 = grid.points[row]![col + 1]!
        const p11 = grid.points[row + 1]![col + 1]!
        const p01 = grid.points[row + 1]![col]!
        const center = this.createCellCenter(p00, p10, p11, p01)
        if (!this.isPointInPolygon(center.lon, center.lat, polygon)) continue
        cells.push({
          corners: [p00, p10, p11, p01],
          center,
          area: this.computeCellArea(p00, p10, p11, p01),
        })
      }
    }
    return cells
  }

  /** 创建采样单元中心点。 */
  private createCellCenter(
    p00: TerrainGridPoint,
    p10: TerrainGridPoint,
    p11: TerrainGridPoint,
    p01: TerrainGridPoint,
  ): TerrainGridPoint {
    return {
      lon: (p00.lon + p10.lon + p11.lon + p01.lon) / 4,
      lat: (p00.lat + p10.lat + p11.lat + p01.lat) / 4,
      height: (p00.height + p10.height + p11.height + p01.height) / 4,
    }
  }

  /** 估算采样单元面积。 */
  private computeCellArea(
    p00: TerrainGridPoint,
    p10: TerrainGridPoint,
    p11: TerrainGridPoint,
    p01: TerrainGridPoint,
  ): number {
    const width = (surfaceDistanceMeters(p00, p10) + surfaceDistanceMeters(p01, p11)) / 2
    const height = (surfaceDistanceMeters(p00, p01) + surfaceDistanceMeters(p10, p11)) / 2
    return Math.max(width * height, 0)
  }

  /** 判断点是否位于多边形内部。 */
  private isPointInPolygon(lon: number, lat: number, polygon: LngLatHeightTuple[]): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const pi = polygon[i]!
      const pj = polygon[j]!
      const denominator = pj[1] - pi[1]
      const intersects =
        pi[1] > lat !== pj[1] > lat &&
        Math.abs(denominator) > 1e-12 &&
        lon < ((pj[0] - pi[0]) * (lat - pi[1])) / denominator + pi[0]
      if (intersects) inside = !inside
    }
    return inside
  }

  /** 根据配置解析最终水位高程。 */
  private resolveWaterLevel(geometries: FloodCellGeometry[]): number {
    if (!geometries.length) return this.floodOptions.waterLevel
    const heights = geometries.map((cell) => cell.center.height)
    if (this.floodOptions.waterLevelMode === 'absolute') return this.floodOptions.waterLevel
    if (this.floodOptions.waterLevelMode === 'relativeToAverage') {
      return heights.reduce((sum, h) => sum + h, 0) / heights.length + this.floodOptions.waterLevel
    }
    return Math.min(...heights) + this.floodOptions.waterLevel
  }

  /** 计算淹没分析统计结果。 */
  private computeFloodResult(
    polygon: LngLatHeightTuple[],
    geometries: FloodCellGeometry[],
    waterLevel: number,
  ): FloodResult {
    const cells: FloodCell[] = []
    let totalArea = 0
    let floodedArea = 0
    let floodedVolume = 0
    let maxWaterDepth = 0
    let minHeight = Infinity
    let maxHeight = -Infinity
    let heightSum = 0
    let floodedCellCount = 0

    for (const geometry of geometries) {
      const terrainHeight = geometry.center.height
      const waterDepth = Math.max(waterLevel - terrainHeight, 0)
      const flooded = waterDepth > this.floodOptions.tolerance
      const volume = flooded ? waterDepth * geometry.area : 0

      totalArea += geometry.area
      minHeight = Math.min(minHeight, terrainHeight)
      maxHeight = Math.max(maxHeight, terrainHeight)
      heightSum += terrainHeight
      if (flooded) {
        floodedArea += geometry.area
        floodedVolume += volume
        maxWaterDepth = Math.max(maxWaterDepth, waterDepth)
        floodedCellCount++
      }

      cells.push({
        longitude: geometry.center.lon,
        latitude: geometry.center.lat,
        terrainHeight,
        waterDepth: flooded ? waterDepth : 0,
        area: geometry.area,
        volume,
        flooded,
      })
    }

    const stats: FloodStats = {
      waterLevel,
      totalArea,
      floodedArea,
      dryArea: Math.max(totalArea - floodedArea, 0),
      floodedVolume,
      floodedRatio: totalArea > 0 ? floodedArea / totalArea : 0,
      minHeight: Number.isFinite(minHeight) ? minHeight : 0,
      maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
      avgHeight: cells.length ? heightSum / cells.length : 0,
      maxWaterDepth,
      cellCount: cells.length,
      floodedCellCount,
    }
    return { polygon, cells, stats }
  }

  /**
   * 绘制淹没分析结果。
   * @param result 分析结果
   * @param grid 地形采样网格
   * @param geometries 参与统计的采样单元
   * @param version 当前异步版本号
   */
  private async drawFloodResult(
    result: FloodResult,
    grid: TerrainGrid,
    geometries: FloodCellGeometry[],
    version: number,
  ): Promise<void> {
    if (this.floodOptions.renderMode === 'raster') {
      await this.drawFloodRaster(grid, result, version)
    } else {
      for (let i = 0; i < geometries.length; i++) {
        const cell = result.cells[i]!
        if (cell.flooded && this.floodOptions.showFloodedCells) {
          this.drawFloodCell(geometries[i]!, result.stats.waterLevel, this.floodOptions.waterColor, this.floodOptions.waterAlpha)
        } else if (!cell.flooded && this.floodOptions.showDryCells) {
          this.drawDryCell(geometries[i]!)
        }
      }
    }
    this.drawPolygonOutline(result.polygon)
    this.drawStatsLabel(result)
  }

  /**
   * raster 模式：生成连续水深贴图并贴到地形上。
   * @param grid 地形采样网格
   * @param result 分析结果
   * @param version 当前异步版本号
   */
  private async drawFloodRaster(grid: TerrainGrid, result: FloodResult, version: number): Promise<void> {
    const layer = await createTerrainRasterOverlay(
      this.viewer,
      this.createFloodRasterCanvas(grid, result),
      this.createGridRectangle(grid),
    )

    if (this.isStale(version)) {
      removeTerrainRasterOverlay(this.viewer, layer)
      return
    }
    this.rasterLayer = layer
  }

  /** 生成淹没分析平滑贴图。 */
  private createFloodRasterCanvas(grid: TerrainGrid, result: FloodResult): HTMLCanvasElement {
    const size = this.floodOptions.textureSize
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return canvas

    const imageData = context.createImageData(size, size)
    const data = imageData.data
    const rectangle = this.getGridRectangleDegrees(grid)
    const orientation = this.getGridTextureOrientation(grid)
    const waterColor = this.parseCssColor(this.floodOptions.waterColor)
    const dryColor = this.parseCssColor(this.floodOptions.dryColor)

    for (let y = 0; y < size; y++) {
      const imageV = this.normalizePixel(y, size)
      const gridV = orientation.flipY ? 1 - imageV : imageV
      const lat = this.lerp(rectangle.north, rectangle.south, imageV)
      for (let x = 0; x < size; x++) {
        const imageU = this.normalizePixel(x, size)
        const gridU = orientation.flipX ? 1 - imageU : imageU
        const lon = this.lerp(rectangle.west, rectangle.east, imageU)
        const index = (y * size + x) * 4

        if (this.floodOptions.clipToPolygon && !this.isPointInPolygon(lon, lat, result.polygon)) {
          data[index + 3] = 0
          continue
        }

        const height = this.sampleGridHeight(grid, gridU, gridV)
        const waterDepth = Math.max(result.stats.waterLevel - height, 0)
        const flooded = waterDepth > this.floodOptions.tolerance
        if (flooded && this.floodOptions.showFloodedCells) {
          this.writeRasterPixel(data, index, waterColor, this.floodOptions.waterAlpha)
        } else if (!flooded && this.floodOptions.showDryCells) {
          this.writeRasterPixel(data, index, dryColor, this.floodOptions.dryAlpha)
        } else {
          data[index + 3] = 0
        }
      }
    }

    context.putImageData(imageData, 0, 0)
    return canvas
  }

  /** 写入单个贴图像素。 */
  private writeRasterPixel(data: Uint8ClampedArray, index: number, color: RgbColor, alpha: number): void {
    data[index] = color.r
    data[index + 1] = color.g
    data[index + 2] = color.b
    data[index + 3] = Math.round(clampNumber(alpha, 0, 1) * 255)
  }

  /** 绘制被淹没的水面单元。 */
  private drawFloodCell(
    geometry: FloodCellGeometry,
    waterLevel: number,
    color: string,
    alpha: number,
  ): Entity {
    const hierarchy = new Cesium.PolygonHierarchy(
      geometry.corners.map((point) => toCartesian([point.lon, point.lat, waterLevel + this.floodOptions.heightOffset])),
    )
    const entity = this.viewer.entities.add({
      id: `fastx-measure-flood-cell-${this.id}-${this.segmentEntities.length}`,
      polygon: {
        hierarchy,
        material: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
        outline: this.floodOptions.showGrid,
        outlineColor: Cesium.Color.fromCssColorString(this.floodOptions.gridColor),
        perPositionHeight: true,
      },
    })
    this.track(entity)
    this.segmentEntities.push(entity)
    return entity
  }

  /** 绘制未淹没单元，用于需要对比干湿边界的场景。 */
  private drawDryCell(geometry: FloodCellGeometry): Entity {
    const hierarchy = new Cesium.PolygonHierarchy(
      geometry.corners.map((point) => toCartesian(terrainPointToLngLatHeight(point, this.floodOptions.heightOffset))),
    )
    const entity = this.viewer.entities.add({
      id: `fastx-measure-flood-dry-${this.id}-${this.segmentEntities.length}`,
      polygon: {
        hierarchy,
        material: Cesium.Color.fromCssColorString(this.floodOptions.dryColor).withAlpha(this.floodOptions.dryAlpha),
        outline: this.floodOptions.showGrid,
        outlineColor: Cesium.Color.fromCssColorString(this.floodOptions.gridColor),
        perPositionHeight: true,
      },
    })
    this.track(entity)
    this.segmentEntities.push(entity)
    return entity
  }

  /** 绘制分析范围外轮廓。 */
  private drawPolygonOutline(polygon: LngLatHeightTuple[]): void {
    if (polygon.length < 3) return
    const ring = [...polygon, polygon[0]!]
    this.drawSegmentPolyline(ring, this.style.lineColor, this.style.lineWidth, true, false)
  }

  /** 绘制统计标注。 */
  private drawStatsLabel(result: FloodResult): void {
    if (!this.floodOptions.showStatsLabel || result.polygon.length < 1) return
    const stats = result.stats
    this.updateMeasureLabel(
      this.getPolygonLabelPosition(result.polygon),
      [
        '淹没分析统计',
        `水位：${stats.waterLevel.toFixed(2)} m`,
        `淹没面积：${formatArea(stats.floodedArea)}`,
        `蓄水体积：${formatVolume(stats.floodedVolume)}`,
        `最大水深：${stats.maxWaterDepth.toFixed(2)} m`,
      ].join('\n'),
    )
  }

  /** 获取多边形标注位置。 */
  private getPolygonLabelPosition(polygon: LngLatHeightTuple[]): LngLatHeightTuple {
    const sum = polygon.reduce(
      (acc, point) => {
        acc[0] += point[0]
        acc[1] += point[1]
        acc[2] += point[2] ?? 0
        return acc
      },
      [0, 0, 0] as LngLatHeightTuple,
    )
    const count = Math.max(polygon.length, 1)
    return [sum[0] / count, sum[1] / count, sum[2] / count]
  }

  /** 读取采样网格内指定归一化坐标的高程。 */
  private sampleGridHeight(grid: TerrainGrid, u: number, v: number): number {
    const maxCol = Math.max(grid.cols - 1, 0)
    const maxRow = Math.max(grid.rows - 1, 0)
    const x = clampNumber(u, 0, 1) * maxCol
    const y = clampNumber(v, 0, 1) * maxRow

    if (!this.floodOptions.smooth) {
      return grid.points[Math.round(y)]![Math.round(x)]!.height
    }

    const c0 = Math.floor(x)
    const r0 = Math.floor(y)
    const c1 = Math.min(c0 + 1, maxCol)
    const r1 = Math.min(r0 + 1, maxRow)
    const tx = x - c0
    const ty = y - r0
    const h00 = grid.points[r0]![c0]!.height
    const h10 = grid.points[r0]![c1]!.height
    const h01 = grid.points[r1]![c0]!.height
    const h11 = grid.points[r1]![c1]!.height
    return this.lerp(this.lerp(h00, h10, tx), this.lerp(h01, h11, tx), ty)
  }

  /** 获取采样范围对应的 Cesium 矩形。 */
  private createGridRectangle(grid: TerrainGrid): Cesium.Rectangle {
    const bounds = this.getGridRectangleDegrees(grid)
    return Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north)
  }

  /** 获取采样范围经纬度边界。 */
  private getGridRectangleDegrees(grid: TerrainGrid): { west: number; east: number; south: number; north: number } {
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

    return { west, east, south, north }
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

  /** 清理分析结果，不清理关键点和预览几何。 */
  private clearAnalysisResult(): void {
    this.removeRasterLayer()
    this.clearSegmentEntities()
    this.clearMeasureLabel()
    this.result = null
    this.emitResult(null)
  }

  /** 移除当前淹没分析栅格贴图。 */
  private removeRasterLayer(): void {
    removeTerrainRasterOverlay(this.viewer, this.rasterLayer)
    this.rasterLayer = null
  }

  /** 通知外部淹没结果变化。 */
  private emitResult(result: FloodResult | null): void {
    this.floodOptions.onFloodChange?.(result ? this.cloneResult(result) : null)
  }

  /** 深拷贝结果，避免外部直接修改内部状态。 */
  private cloneResult(result: FloodResult): FloodResult {
    return {
      polygon: result.polygon.map((point) => [...point] as LngLatHeightTuple),
      cells: result.cells.map((cell) => ({ ...cell })),
      stats: { ...result.stats },
    }
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
}
