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
import {
  MeasureType,
  type CutFillAnalyzeOptions,
  type CutFillBaseHeightMode,
  type CutFillCell,
  type CutFillCellKind,
  type CutFillResult,
  type CutFillStats,
  type LngLatHeightTuple,
  type MeasureCreateOptions,
} from '../types'
import { MeasureBase } from './MeasureBase'

/** 挖填方分析构造参数，直接 new 时可省略 type。 */
export type CutFillAnalyzeCreateOptions = Omit<MeasureCreateOptions, 'type'> & {
  /** 分析类型；不传时默认使用 cutFillAnalyze。 */
  type?: MeasureCreateOptions['type']
}

type ResolvedCutFillOptions = Required<
  Omit<CutFillAnalyzeOptions, 'baseHeight' | 'onCutFillChange'>
> & {
  baseHeight?: number
  onCutFillChange?: CutFillAnalyzeOptions['onCutFillChange']
}

interface CutFillCellGeometry {
  /** 单元四角点 */
  corners: [TerrainGridPoint, TerrainGridPoint, TerrainGridPoint, TerrainGridPoint]
  /** 单元中心点 */
  center: TerrainGridPoint
  /** 单元面积（平方米） */
  area: number
}

const DEFAULT_CUT_FILL_OPTIONS: ResolvedCutFillOptions = {
  gridSize: 36,
  baseHeightMode: 'average',
  baseHeight: undefined,
  heightOffset: 1.5,
  tolerance: 0.1,
  cutColor: '#ef4444',
  fillColor: '#22c55e',
  flatColor: '#94a3b8',
  fillAlpha: 0.52,
  showCells: true,
  showGrid: true,
  gridColor: '#ffffff',
  showStatsLabel: true,
  onCutFillChange: undefined,
}

/** 限制数值范围。 */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** 限制并四舍五入为整数。 */
function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.round(clampNumber(value!, min, max))
}

/** 解析基准高程模式。 */
function resolveBaseHeightMode(mode?: CutFillBaseHeightMode): CutFillBaseHeightMode {
  return mode === 'min' || mode === 'max' || mode === 'custom' ? mode : 'average'
}

/** 合并挖填方参数并限制安全范围。 */
function resolveCutFillOptions(options?: CutFillAnalyzeOptions): ResolvedCutFillOptions {
  return {
    gridSize: clampInteger(options?.gridSize, DEFAULT_CUT_FILL_OPTIONS.gridSize, 4, 100),
    baseHeightMode: resolveBaseHeightMode(options?.baseHeightMode),
    baseHeight: Number.isFinite(options?.baseHeight) ? options!.baseHeight : undefined,
    heightOffset: clampNumber(options?.heightOffset ?? DEFAULT_CUT_FILL_OPTIONS.heightOffset, 0, 200),
    tolerance: clampNumber(options?.tolerance ?? DEFAULT_CUT_FILL_OPTIONS.tolerance, 0, 100),
    cutColor: options?.cutColor ?? DEFAULT_CUT_FILL_OPTIONS.cutColor,
    fillColor: options?.fillColor ?? DEFAULT_CUT_FILL_OPTIONS.fillColor,
    flatColor: options?.flatColor ?? DEFAULT_CUT_FILL_OPTIONS.flatColor,
    fillAlpha: clampNumber(options?.fillAlpha ?? DEFAULT_CUT_FILL_OPTIONS.fillAlpha, 0, 1),
    showCells: options?.showCells ?? DEFAULT_CUT_FILL_OPTIONS.showCells,
    showGrid: options?.showGrid ?? DEFAULT_CUT_FILL_OPTIONS.showGrid,
    gridColor: options?.gridColor ?? DEFAULT_CUT_FILL_OPTIONS.gridColor,
    showStatsLabel: options?.showStatsLabel ?? DEFAULT_CUT_FILL_OPTIONS.showStatsLabel,
    onCutFillChange: options?.onCutFillChange,
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
 * 挖填方分析：多边形框选地形区域，按采样网格和基准高程统计挖方/填方体积。
 */
export class CutFillAnalyze extends MeasureBase {
  /** 当前挖填方参数 */
  private cutFillOptions: ResolvedCutFillOptions
  /** 最近一次挖填方分析结果 */
  private result: CutFillResult | null = null
  /** 异步采样版本号，用于丢弃过期结果 */
  private buildVersion = 0

  /**
   * @param options 创建参数
   */
  constructor(options: CutFillAnalyzeCreateOptions) {
    const { positions, position, ...baseOptions } = options
    super({ ...baseOptions, type: options.type ?? MeasureType.CUT_FILL_ANALYZE })
    this.cutFillOptions = resolveCutFillOptions(options.cutFill)
    if (positions?.length) this.setPositions(positions)
    if (position) this.setPosition(position)
  }

  /** 获取当前挖填方参数副本。 */
  getCutFillOptions(): CutFillAnalyzeOptions {
    return { ...this.cutFillOptions }
  }

  /**
   * 更新挖填方参数；如果已经完成绘制，会自动重新分析。
   * @param options 待合并参数
   */
  setCutFillOptions(options: Partial<CutFillAnalyzeOptions>): void {
    this.cutFillOptions = resolveCutFillOptions({ ...this.cutFillOptions, ...options })
    if (this.positions.length >= 3) void this.buildCutFill()
  }

  /** 获取最近一次挖填方结果。 */
  getResult(): CutFillResult | null {
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

  /** 完成绘制后开始挖填方分析。 */
  complete(): void {
    if (this.positions.length < 3) return
    void this.buildCutFill()
  }

  /** 移除全部挖填方分析结果。 */
  clear(): void {
    this.buildVersion++
    this.result = null
    this.emitResult(null)
    super.clear()
  }

  /** 采样地形并计算挖填方结果。 */
  private async buildCutFill(): Promise<void> {
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
        this.cutFillOptions.gridSize + 1,
        this.cutFillOptions.gridSize + 1,
      )
      if (this.isStale(version)) return

      const geometries = this.collectCellsInPolygon(grid, polygon)
      const baseHeight = this.resolveBaseHeight(geometries)
      const result = this.computeCutFillResult(polygon, geometries, baseHeight)
      this.result = result
      this.drawCutFillResult(result, geometries)
      this.emitResult(result)
      this.requestRender()
    } catch (error) {
      console.warn('[FastX] 挖填方分析失败', error)
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
  private collectCellsInPolygon(grid: TerrainGrid, polygon: LngLatHeightTuple[]): CutFillCellGeometry[] {
    const cells: CutFillCellGeometry[] = []
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

  /** 按配置解析基准高程。 */
  private resolveBaseHeight(cells: CutFillCellGeometry[]): number {
    if (!cells.length) return this.cutFillOptions.baseHeight ?? 0
    const heights = cells.map((cell) => cell.center.height)
    switch (this.cutFillOptions.baseHeightMode) {
      case 'min':
        return Math.min(...heights)
      case 'max':
        return Math.max(...heights)
      case 'custom':
        return this.cutFillOptions.baseHeight ?? heights.reduce((sum, h) => sum + h, 0) / heights.length
      default:
        return heights.reduce((sum, h) => sum + h, 0) / heights.length
    }
  }

  /** 计算挖填方统计结果。 */
  private computeCutFillResult(
    polygon: LngLatHeightTuple[],
    geometries: CutFillCellGeometry[],
    baseHeight: number,
  ): CutFillResult {
    const cells: CutFillCell[] = []
    let totalArea = 0
    let cutArea = 0
    let fillArea = 0
    let cutVolume = 0
    let fillVolume = 0
    let minHeight = Infinity
    let maxHeight = -Infinity
    let heightSum = 0

    for (const geometry of geometries) {
      const height = geometry.center.height
      const heightDiff = height - baseHeight
      const absDiff = Math.abs(heightDiff)
      const kind: CutFillCellKind =
        absDiff <= this.cutFillOptions.tolerance ? 'flat' : heightDiff > 0 ? 'cut' : 'fill'
      const volume = kind === 'flat' ? 0 : absDiff * geometry.area

      totalArea += geometry.area
      minHeight = Math.min(minHeight, height)
      maxHeight = Math.max(maxHeight, height)
      heightSum += height
      if (kind === 'cut') {
        cutArea += geometry.area
        cutVolume += volume
      } else if (kind === 'fill') {
        fillArea += geometry.area
        fillVolume += volume
      }

      cells.push({
        longitude: geometry.center.lon,
        latitude: geometry.center.lat,
        height,
        area: geometry.area,
        heightDiff,
        volume,
        kind,
      })
    }

    const stats: CutFillStats = {
      baseHeight,
      totalArea,
      cutArea,
      fillArea,
      cutVolume,
      fillVolume,
      netVolume: fillVolume - cutVolume,
      minHeight: Number.isFinite(minHeight) ? minHeight : 0,
      maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
      avgHeight: cells.length ? heightSum / cells.length : 0,
      cellCount: cells.length,
    }
    return { polygon, cells, stats }
  }

  /** 绘制挖填方结果。 */
  private drawCutFillResult(result: CutFillResult, geometries: CutFillCellGeometry[]): void {
    if (this.cutFillOptions.showCells) {
      for (let i = 0; i < geometries.length; i++) {
        this.drawCutFillCell(geometries[i]!, result.cells[i]!)
      }
    }
    this.drawPolygonOutline(result.polygon)
    this.drawStatsLabel(result)
  }

  /** 绘制单个挖填方采样单元。 */
  private drawCutFillCell(geometry: CutFillCellGeometry, cell: CutFillCell): Entity {
    const color = this.colorForKind(cell.kind)
    const hierarchy = new Cesium.PolygonHierarchy(
      geometry.corners.map((point) => toCartesian(terrainPointToLngLatHeight(point, this.cutFillOptions.heightOffset))),
    )
    const entity = this.viewer.entities.add({
      id: `fastx-measure-cut-fill-${this.id}-${this.segmentEntities.length}`,
      polygon: {
        hierarchy,
        material: Cesium.Color.fromCssColorString(color).withAlpha(this.cutFillOptions.fillAlpha),
        outline: this.cutFillOptions.showGrid,
        outlineColor: Cesium.Color.fromCssColorString(this.cutFillOptions.gridColor),
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
  private drawStatsLabel(result: CutFillResult): void {
    if (!this.cutFillOptions.showStatsLabel || result.polygon.length < 1) return
    const stats = result.stats
    this.updateMeasureLabel(
      this.getPolygonLabelPosition(result.polygon),
      [
        '挖填方统计',
        `基准：${stats.baseHeight.toFixed(2)} m`,
        `面积：${formatArea(stats.totalArea)}`,
        `挖方：${formatVolume(stats.cutVolume)}`,
        `填方：${formatVolume(stats.fillVolume)}`,
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

  /** 按单元分类取色。 */
  private colorForKind(kind: CutFillCellKind): string {
    if (kind === 'cut') return this.cutFillOptions.cutColor
    if (kind === 'fill') return this.cutFillOptions.fillColor
    return this.cutFillOptions.flatColor
  }

  /** 清理分析结果，不清理关键点和预览几何。 */
  private clearAnalysisResult(): void {
    this.clearSegmentEntities()
    this.clearMeasureLabel()
    this.result = null
    this.emitResult(null)
  }

  /** 通知外部挖填方结果变化。 */
  private emitResult(result: CutFillResult | null): void {
    this.cutFillOptions.onCutFillChange?.(result ? this.cloneResult(result) : null)
  }

  /** 深拷贝结果，避免外部直接修改内部状态。 */
  private cloneResult(result: CutFillResult): CutFillResult {
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
}
