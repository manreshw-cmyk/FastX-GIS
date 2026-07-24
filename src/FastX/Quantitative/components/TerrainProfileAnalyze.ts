import * as Cesium from 'cesium'
import type { Entity } from 'cesium'
import { formatDistanceMeters, computeProjectionLength } from '../measureMath'
import {
  MeasureType,
  type LngLatHeightTuple,
  type MeasureCreateOptions,
  type TerrainProfileAnalyzeOptions,
  type TerrainProfilePoint,
  type TerrainProfileResult,
  type TerrainProfileStats,
} from '../types'
import { MeasureBase } from './MeasureBase'

/** 地形剖面分析构造参数，直接 new 时可省略 type。 */
export type TerrainProfileAnalyzeCreateOptions = Omit<MeasureCreateOptions, 'type'> & {
  /** 分析类型；不传时默认使用 terrainProfileAnalyze。 */
  type?: MeasureCreateOptions['type']
}

type ResolvedTerrainProfileOptions = Required<Omit<TerrainProfileAnalyzeOptions, 'onProfileChange'>> & {
  onProfileChange?: TerrainProfileAnalyzeOptions['onProfileChange']
}

interface ProfileSegment {
  /** 当前段起点关键点 */
  start: LngLatHeightTuple
  /** 当前段终点关键点 */
  end: LngLatHeightTuple
  /** 当前段起始累计距离（米） */
  startDistance: number
  /** 当前段水平长度（米） */
  length: number
  /** 当前段测地线插值器 */
  geodesic: Cesium.EllipsoidGeodesic
}

const DEFAULT_PROFILE_OPTIONS: ResolvedTerrainProfileOptions = {
  sampleCount: 120,
  heightOffset: 2,
  showProfileLine: true,
  profileLineColor: '#59ff9b',
  profileLineWidth: 3,
  showSamplePoints: false,
  samplePointEvery: 8,
  samplePointColor: '#facc15',
  samplePointSize: 5,
  showStatsLabel: true,
  onProfileChange: undefined,
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

/** 合并地形剖面参数并限制安全范围。 */
function resolveTerrainProfileOptions(
  options?: TerrainProfileAnalyzeOptions,
): ResolvedTerrainProfileOptions {
  return {
    sampleCount: clampInteger(options?.sampleCount, DEFAULT_PROFILE_OPTIONS.sampleCount, 2, 1024),
    heightOffset: clampNumber(options?.heightOffset ?? DEFAULT_PROFILE_OPTIONS.heightOffset, 0, 1000),
    showProfileLine: options?.showProfileLine ?? DEFAULT_PROFILE_OPTIONS.showProfileLine,
    profileLineColor: options?.profileLineColor ?? DEFAULT_PROFILE_OPTIONS.profileLineColor,
    profileLineWidth: clampNumber(
      options?.profileLineWidth ?? DEFAULT_PROFILE_OPTIONS.profileLineWidth,
      1,
      10,
    ),
    showSamplePoints: options?.showSamplePoints ?? DEFAULT_PROFILE_OPTIONS.showSamplePoints,
    samplePointEvery: clampInteger(
      options?.samplePointEvery,
      DEFAULT_PROFILE_OPTIONS.samplePointEvery,
      1,
      100,
    ),
    samplePointColor: options?.samplePointColor ?? DEFAULT_PROFILE_OPTIONS.samplePointColor,
    samplePointSize: clampNumber(options?.samplePointSize ?? DEFAULT_PROFILE_OPTIONS.samplePointSize, 1, 18),
    showStatsLabel: options?.showStatsLabel ?? DEFAULT_PROFILE_OPTIONS.showStatsLabel,
    onProfileChange: options?.onProfileChange,
  }
}

/** 格式化高程显示。 */
function formatHeight(value: number): string {
  return `${value.toFixed(2)} m`
}

/**
 * 地形剖面分析：沿用户绘制的折线采样地形高程，并输出剖面统计数据。
 * - 可通过 `getProfile()` 获取完整采样结果。
 * - 可通过 `onProfileChange` 将结果同步给业务面板绘制剖面曲线。
 */
export class TerrainProfileAnalyze extends MeasureBase {
  /** 当前剖面分析参数 */
  private profileOptions: ResolvedTerrainProfileOptions
  /** 最近一次剖面分析结果 */
  private profile: TerrainProfileResult | null = null
  /** 异步采样版本号，用于丢弃过期结果 */
  private buildVersion = 0

  /**
   * @param options 创建参数
   */
  constructor(options: TerrainProfileAnalyzeCreateOptions) {
    const { positions, position, ...baseOptions } = options
    super({ ...baseOptions, type: options.type ?? MeasureType.TERRAIN_PROFILE_ANALYZE })
    this.profileOptions = resolveTerrainProfileOptions(options.terrainProfile)
    if (positions?.length) this.setPositions(positions)
    if (position) this.setPosition(position)
  }

  /** 获取当前地形剖面参数副本。 */
  getTerrainProfileOptions(): TerrainProfileAnalyzeOptions {
    return { ...this.profileOptions }
  }

  /**
   * 更新地形剖面参数；如果已经完成绘制，会自动重新采样。
   * @param options 待合并参数
   */
  setTerrainProfileOptions(options: Partial<TerrainProfileAnalyzeOptions>): void {
    this.profileOptions = resolveTerrainProfileOptions({ ...this.profileOptions, ...options })
    if (this.positions.length >= 2) void this.buildProfile()
  }

  /** 获取最近一次剖面分析结果。 */
  getProfile(): TerrainProfileResult | null {
    if (!this.profile) return null
    return {
      anchors: this.profile.anchors.map((point) => [...point] as LngLatHeightTuple),
      points: this.profile.points.map((point) => ({ ...point })),
      stats: { ...this.profile.stats },
    }
  }

  /**
   * 设置剖面折线关键点。
   * @param positions 折线顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.buildVersion++
    this.positions = [...positions]
    this.syncKeyPoints(this.positions)
    this.clearProfileResult()
    this.setDynamicLinePositions(this.positions, {
      clamp: true,
      color: this.style.lineColor,
      width: this.style.lineWidth,
    })
  }

  /**
   * 鼠标移动时预览剖面折线。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    this.setDynamicLinePositions([...this.positions, cursor], {
      clamp: true,
      color: this.style.lineColor,
      width: this.style.lineWidth,
    })
  }

  /** 完成绘制后开始地形剖面采样。 */
  complete(): void {
    if (this.positions.length < 2) return
    void this.buildProfile()
  }

  /** 移除全部剖面分析结果。 */
  clear(): void {
    this.buildVersion++
    this.profile = null
    this.emitProfileChange(null)
    super.clear()
  }

  /** 采样地形并绘制剖面分析结果。 */
  private async buildProfile(): Promise<void> {
    if (this.positions.length < 2) return

    const version = ++this.buildVersion
    const anchors = this.positions.map((point) => [...point] as LngLatHeightTuple)
    this.clearDynamicLine()
    this.clearProfileResult()

    try {
      const points = await this.sampleProfilePoints(anchors)
      if (this.isStale(version)) return

      const stats = this.computeProfileStats(points)
      const result: TerrainProfileResult = { anchors, points, stats }
      this.profile = result
      this.drawProfileResult(result)
      this.emitProfileChange(result)
      this.requestRender()
    } catch (error) {
      console.warn('[FastX] 地形剖面分析失败', error)
      this.emitProfileChange(null)
    }
  }

  /** 沿折线生成地形采样点。 */
  private async sampleProfilePoints(anchors: LngLatHeightTuple[]): Promise<TerrainProfilePoint[]> {
    const { segments, totalDistance } = this.createProfileSegments(anchors)
    if (!segments.length || totalDistance <= 0) return []

    const count = Math.max(2, Math.min(this.profileOptions.sampleCount, 1024))
    const cartographics: Cesium.Cartographic[] = []
    const distances: number[] = []

    for (let i = 0; i < count; i++) {
      const distance = (totalDistance * i) / (count - 1)
      const segment = this.findSegment(segments, distance)
      const localDistance = clampNumber(distance - segment.startDistance, 0, segment.length)
      const t = segment.length > 0 ? localDistance / segment.length : 0
      const cartographic = segment.geodesic.interpolateUsingSurfaceDistance(
        localDistance,
        new Cesium.Cartographic(),
      )
      cartographic.height = this.lerp(segment.start[2] ?? 0, segment.end[2] ?? 0, t)
      cartographics.push(cartographic)
      distances.push(distance)
    }

    await this.sampleTerrainHeights(cartographics)

    const points: TerrainProfilePoint[] = []
    for (let i = 0; i < cartographics.length; i++) {
      const cartographic = cartographics[i]!
      const height = this.resolveHeight(cartographic)
      const previous = points[i - 1]
      const horizontal = previous ? Math.max(distances[i]! - previous.distance, 1e-6) : 1
      const slopeDegree = previous
        ? Cesium.Math.toDegrees(Math.atan((height - previous.height) / horizontal))
        : 0
      points.push({
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height,
        distance: distances[i]!,
        slopeDegree,
      })
    }
    return points
  }

  /** 根据关键点拆分剖面线段。 */
  private createProfileSegments(
    anchors: LngLatHeightTuple[],
  ): { segments: ProfileSegment[]; totalDistance: number } {
    const segments: ProfileSegment[] = []
    let totalDistance = 0

    for (let i = 0; i < anchors.length - 1; i++) {
      const start = anchors[i]!
      const end = anchors[i + 1]!
      const length = computeProjectionLength([start, end])
      if (length <= 0) continue
      segments.push({
        start,
        end,
        startDistance: totalDistance,
        length,
        geodesic: new Cesium.EllipsoidGeodesic(
          Cesium.Cartographic.fromDegrees(start[0], start[1]),
          Cesium.Cartographic.fromDegrees(end[0], end[1]),
        ),
      })
      totalDistance += length
    }

    return { segments, totalDistance }
  }

  /** 按累计距离找到所在剖面线段。 */
  private findSegment(segments: ProfileSegment[], distance: number): ProfileSegment {
    for (const segment of segments) {
      if (distance <= segment.startDistance + segment.length + 1e-6) return segment
    }
    return segments[segments.length - 1]!
  }

  /** 使用 Cesium 地形服务或当前 Globe 高程补齐采样点高程。 */
  private async sampleTerrainHeights(cartographics: Cesium.Cartographic[]): Promise<void> {
    const terrain = this.viewer.terrainProvider
    if (terrain && !(terrain instanceof Cesium.EllipsoidTerrainProvider)) {
      try {
        await Cesium.sampleTerrainMostDetailed(terrain, cartographics)
        return
      } catch {
        // 地形服务不可用时继续使用当前 Globe 高程。
      }
    }
    for (const cartographic of cartographics) {
      const globeHeight = this.viewer.scene.globe.getHeight(cartographic)
      if (Number.isFinite(globeHeight)) cartographic.height = globeHeight!
    }
  }

  /** 获取稳定高程值。 */
  private resolveHeight(cartographic: Cesium.Cartographic): number {
    const globeHeight = this.viewer.scene.globe.getHeight(cartographic)
    if (Number.isFinite(globeHeight)) return globeHeight!
    return Number.isFinite(cartographic.height) ? cartographic.height : 0
  }

  /** 计算剖面统计结果。 */
  private computeProfileStats(points: TerrainProfilePoint[]): TerrainProfileStats {
    if (!points.length) {
      return {
        totalDistance: 0,
        minHeight: 0,
        maxHeight: 0,
        avgHeight: 0,
        heightDiff: 0,
        ascent: 0,
        descent: 0,
        maxSlopeDegree: 0,
        minSlopeDegree: 0,
        sampleCount: 0,
      }
    }

    let minHeight = Infinity
    let maxHeight = -Infinity
    let heightSum = 0
    let ascent = 0
    let descent = 0
    let maxSlopeDegree = 0
    let minSlopeDegree = 0

    for (let i = 0; i < points.length; i++) {
      const point = points[i]!
      minHeight = Math.min(minHeight, point.height)
      maxHeight = Math.max(maxHeight, point.height)
      heightSum += point.height
      maxSlopeDegree = Math.max(maxSlopeDegree, point.slopeDegree)
      minSlopeDegree = Math.min(minSlopeDegree, point.slopeDegree)

      if (i === 0) continue
      const delta = point.height - points[i - 1]!.height
      if (delta > 0) ascent += delta
      else descent += Math.abs(delta)
    }

    return {
      totalDistance: points[points.length - 1]!.distance,
      minHeight,
      maxHeight,
      avgHeight: heightSum / points.length,
      heightDiff: points[points.length - 1]!.height - points[0]!.height,
      ascent,
      descent,
      maxSlopeDegree,
      minSlopeDegree,
      sampleCount: points.length,
    }
  }

  /** 绘制剖面线、采样点和统计标注。 */
  private drawProfileResult(result: TerrainProfileResult): void {
    if (!result.points.length) return
    if (this.profileOptions.showProfileLine) {
      this.drawSegmentPolyline(
        result.points.map((point) => this.toDrawPosition(point)),
        this.profileOptions.profileLineColor,
        this.profileOptions.profileLineWidth,
        false,
      )
    }
    if (this.profileOptions.showSamplePoints) {
      this.drawSamplePoints(result.points)
    }
    this.drawStatsLabel(result)
  }

  /** 绘制抽稀后的采样点。 */
  private drawSamplePoints(points: TerrainProfilePoint[]): void {
    const every = this.profileOptions.samplePointEvery
    for (let i = 0; i < points.length; i += every) {
      this.drawSamplePoint(points[i]!)
    }
    const last = points[points.length - 1]
    if (last && (points.length - 1) % every !== 0) this.drawSamplePoint(last)
  }

  /** 绘制单个采样点。 */
  private drawSamplePoint(point: TerrainProfilePoint): Entity {
    const entity = this.viewer.entities.add({
      id: `fastx-measure-profile-point-${this.id}-${this.segmentEntities.length}`,
      position: Cesium.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        point.height + this.profileOptions.heightOffset,
      ),
      point: {
        pixelSize: this.profileOptions.samplePointSize,
        color: Cesium.Color.fromCssColorString(this.profileOptions.samplePointColor),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.NONE,
      },
    })
    this.track(entity)
    this.segmentEntities.push(entity)
    return entity
  }

  /** 绘制地形剖面统计标注。 */
  private drawStatsLabel(result: TerrainProfileResult): void {
    if (!this.profileOptions.showStatsLabel || !result.points.length) return
    const stats = result.stats
    const last = result.points[result.points.length - 1]!
    this.updateMeasureLabel(
      this.toDrawPosition(last),
      [
        '地形剖面',
        `距离：${formatDistanceMeters(stats.totalDistance)}`,
        `高程：${formatHeight(stats.minHeight)} ~ ${formatHeight(stats.maxHeight)}`,
        `爬升/下降：${formatHeight(stats.ascent)} / ${formatHeight(stats.descent)}`,
      ].join('\n'),
    )
  }

  /** 清理剖面分析结果，不清理关键点和预览线。 */
  private clearProfileResult(): void {
    this.clearSegmentEntities()
    this.clearMeasureLabel()
    this.profile = null
    this.emitProfileChange(null)
  }

  /** 通知外部剖面结果变化。 */
  private emitProfileChange(result: TerrainProfileResult | null): void {
    this.profileOptions.onProfileChange?.(result ? this.cloneProfile(result) : null)
  }

  /** 深拷贝剖面结果，避免外部直接修改内部状态。 */
  private cloneProfile(result: TerrainProfileResult): TerrainProfileResult {
    return {
      anchors: result.anchors.map((point) => [...point] as LngLatHeightTuple),
      points: result.points.map((point) => ({ ...point })),
      stats: { ...result.stats },
    }
  }

  /** 采样点转绘制坐标。 */
  private toDrawPosition(point: TerrainProfilePoint): LngLatHeightTuple {
    return [point.longitude, point.latitude, point.height + this.profileOptions.heightOffset]
  }

  /** 判断异步采样结果是否已过期。 */
  private isStale(version: number): boolean {
    return version !== this.buildVersion
  }

  /** 线性插值。 */
  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t
  }
}
