/**
 * 量算分析算法库。
 * 提供距离、面积、通视、缓冲等几何计算，对标 FreeX FeMeasureAnalyze。
 */
import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import type { LngLatHeightTuple } from './types'

/** 两点三维距离分解结果（水平、垂直、斜距） */
export interface ThreeDistanceResult {
  horizontal: number
  vertical: number
  distance: number
  position3: LngLatHeightTuple
}

/** 直线通视分析结果 */
export interface VisualDistanceResult {
  positions: LngLatHeightTuple[]
  visibleDistance: number
  invisibleDistance: number
}

/**
 * 经纬高元组或笛卡尔坐标转 Cartesian3。
 * @param p 输入点
 */
function toCartesian(p: LngLatHeightTuple | Cesium.Cartesian3): Cesium.Cartesian3 {
  if (p instanceof Cesium.Cartesian3) return p
  return Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] ?? 0)
}

/**
 * Cartesian3 转 [经度, 纬度, 高程]。
 * @param c 笛卡尔坐标
 */
function toLngLat(c: Cesium.Cartesian3): LngLatHeightTuple {
  const carto = Cesium.Cartographic.fromCartesian(c)
  return [
    Cesium.Math.toDegrees(carto.longitude),
    Cesium.Math.toDegrees(carto.latitude),
    carto.height,
  ]
}

/**
 * 空间折线长度（米）。
 * @param positions 折线顶点
 */
export function computeLineLength(positions: LngLatHeightTuple[]): number {
  if (positions.length < 2) return 0
  let total = 0
  for (let i = 0; i < positions.length - 1; i++) {
    total += Cesium.Cartesian3.distance(toCartesian(positions[i]!), toCartesian(positions[i + 1]!))
  }
  return total
}

/**
 * 投影距离（椭球测地线，米）。
 * @param positions 折线顶点
 */
export function computeProjectionLength(positions: LngLatHeightTuple[]): number {
  if (positions.length < 2) return 0
  let total = 0
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i]!
    const b = positions[i + 1]!
    const start = Cesium.Cartographic.fromDegrees(a[0], a[1])
    const end = Cesium.Cartographic.fromDegrees(b[0], b[1])
    total += new Cesium.EllipsoidGeodesic(start, end).surfaceDistance
  }
  return total
}

/**
 * 线性样条插值折线。
 * @param positions 折线顶点
 * @param pointNumber 插值点数
 */
export function lineInterpolate(positions: LngLatHeightTuple[], pointNumber = 100): Cesium.Cartesian3[] {
  if (positions.length < 2) return []
  const pts = positions.map(toCartesian)
  const total = computeLineLength(positions)
  if (total <= 0) return pts

  const times = [0]
  let cur = 0
  for (let i = 1; i < positions.length; i++) {
    cur += Cesium.Cartesian3.distance(pts[i - 1]!, pts[i]!)
    const n = Math.min(pointNumber, Math.ceil((cur * pointNumber) / total))
    times.push(n)
  }

  const spline = new Cesium.LinearSpline({ times, points: pts })
  const out: Cesium.Cartesian3[] = []
  for (let i = 0; i <= pointNumber; i++) {
    out.push(spline.evaluate(i) as Cesium.Cartesian3)
  }
  return out
}

/**
 * 用视口 Globe 高程更新 Cartographic 数组。
 * @param viewer Cesium Viewer
 * @param cartographics 待更新高程点
 */
export function updateCartographicHeights(
  viewer: Viewer,
  cartographics: Cesium.Cartographic[],
): void {
  for (const c of cartographics) {
    const h = viewer.scene.globe.getHeight(c)
    if (h !== undefined) c.height = h
  }
}

/**
 * 地表距离（米）：插值 + 视口/地形高程。
 * @param viewer Cesium Viewer
 * @param positions 折线顶点
 */
export async function computeGroundLength(
  viewer: Viewer,
  positions: LngLatHeightTuple[],
): Promise<number> {
  if (positions.length < 2) return 0
  const interpolated = lineInterpolate(positions, 100)
  const cartos = interpolated.map((c) => Cesium.Cartographic.fromCartesian(c))

  const terrain = viewer.terrainProvider
  if (terrain && !(terrain instanceof Cesium.EllipsoidTerrainProvider)) {
    try {
      await Cesium.sampleTerrainMostDetailed(terrain, cartos)
    } catch {
      updateCartographicHeights(viewer, cartos)
    }
  } else {
    updateCartographicHeights(viewer, cartos)
  }

  let total = 0
  let prev = Cesium.Cartographic.toCartesian(cartos[0]!, undefined, new Cesium.Cartesian3())
  for (let i = 1; i < cartos.length; i++) {
    const cur = Cesium.Cartographic.toCartesian(cartos[i]!, undefined, new Cesium.Cartesian3())
    total += Cesium.Cartesian3.distance(prev, cur)
    prev = cur
  }
  return total
}

/**
 * 二维折线环面积（Shoelace，输入为笛卡尔坐标）。
 * @param positions 环顶点
 */
function computeArea2D(positions: Cesium.Cartesian3[]): number {
  let area = 0
  for (let i = 0; i < positions.length; i++) {
    const j = (i + 1) % positions.length
    area += positions[i]!.x * positions[j]!.y - positions[j]!.x * positions[i]!.y
  }
  return area * 0.5
}

/**
 * 投影多边形面积（m²）。
 * @param positions 多边形顶点
 */
export function computeProjectionArea(positions: LngLatHeightTuple[]): number {
  if (positions.length < 3) return 0
  const ring = positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1]))
  return Math.abs(computeArea2D(ring))
}

/**
 * 空间多边形面积（m²）。
 * @param positions 多边形顶点
 */
export function computeSpacePolygonArea(positions: LngLatHeightTuple[]): number {
  if (positions.length < 3) return 0
  const pts = positions.map(toCartesian)
  const origin = pts[0]!
  let area = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const a = new Cesium.Cartesian3()
    const b = new Cesium.Cartesian3()
    Cesium.Cartesian3.subtract(pts[i]!, origin, a)
    Cesium.Cartesian3.subtract(pts[i + 1]!, origin, b)
    const cross = new Cesium.Cartesian3()
    Cesium.Cartesian3.cross(a, b, cross)
    area += Cesium.Cartesian3.magnitude(cross) * 0.5
  }
  return area
}

/**
 * 三角测量三边（水平、垂直、斜距）。
 * @param position1 起点
 * @param position2 终点
 */
export function computeTwoPointsDistance(
  position1: LngLatHeightTuple,
  position2: LngLatHeightTuple,
): ThreeDistanceResult {
  const h1 = position1[2] ?? 0
  const h2 = position2[2] ?? 0
  let position3: LngLatHeightTuple
  if (h1 > h2) {
    position3 = [position2[0], position2[1], h1]
    return {
      horizontal: computeLineLength([position1, position3]),
      vertical: h1 - h2,
      distance: computeLineLength([position1, position2]),
      position3,
    }
  }
  position3 = [position1[0], position1[1], h2]
  return {
    horizontal: computeLineLength([position2, position3]),
    vertical: h2 - h1,
    distance: computeLineLength([position1, position2]),
    position3,
  }
}

/**
 * 按方位角与距离求终点（米、弧度），对齐 FreeX FeMath.destination。
 * @param origin 起点
 * @param distanceMeters 距离（米）
 * @param azimuthRad 方位角（弧度，自北顺时针）
 */
export function geodesicDestination(
  origin: LngLatHeightTuple,
  distanceMeters: number,
  azimuthRad: number,
): LngLatHeightTuple {
  const latRad = Cesium.Math.toRadians(origin[1])
  const dLat = (distanceMeters * Math.cos(azimuthRad)) / 111_110
  const dLon =
    (distanceMeters * Math.sin(azimuthRad)) / (111_110 * Math.max(Math.cos(latRad), 1e-6))
  return [origin[0] + dLon, origin[1] + dLat, origin[2] ?? 0]
}

/**
 * 圆形通视预览：半径点与圆心同高，避免圆半径偏差。
 * @param center 圆心
 * @param edge 半径点
 */
export function flattenRadiusPoint(
  center: LngLatHeightTuple,
  edge: LngLatHeightTuple,
): LngLatHeightTuple {
  return [edge[0], edge[1], center[2] ?? 0]
}

/**
 * 方位角（弧度，自北顺时针）。
 * @param from 起点
 * @param to 终点
 */
export function computeAzimuth(from: LngLatHeightTuple, to: LngLatHeightTuple): number {
  const lon1 = Cesium.Math.toRadians(from[0])
  const lat1 = Cesium.Math.toRadians(from[1])
  const lon2 = Cesium.Math.toRadians(to[0])
  const lat2 = Cesium.Math.toRadians(to[1])
  const dLon = lon2 - lon1
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI)
}

/**
 * 圆上采样点。
 * @param center 圆心
 * @param radiusMeters 半径（米）
 * @param degreeStep 角度步长（度）
 */
export function getCirclePoints(
  center: LngLatHeightTuple,
  radiusMeters: number,
  degreeStep = 5,
): LngLatHeightTuple[] {
  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0 ||
    !Number.isFinite(center[0]) ||
    !Number.isFinite(center[1])
  ) {
    return []
  }
  const step = Math.max(3, Math.min(degreeStep, 30))
  const out: LngLatHeightTuple[] = []
  for (let i = 0; i < 360; i += step) {
    const rad = Cesium.Math.toRadians(i)
    const lat = center[1] + (radiusMeters * Math.sin(rad)) / 111_110
    const rLat = Cesium.Math.toRadians(lat)
    const lon = center[0] + (radiusMeters * Math.cos(rad)) / (111_110 * Math.cos(rLat))
    out.push([lon, lat, center[2] ?? 0])
  }
  return out
}

/**
 * 通视坡度判定（参考 FreeX visibleCompute）。
 * @param heights 采样点高程序列
 */
function visibleCompute(heights: number[]): boolean[] {
  if (heights.length < 2) return [true]
  const visible: boolean[] = [true, true]
  const beginHeight = heights[0]! + 100
  let lowSlope: number | undefined
  let maxSlope: number | undefined
  let eyeFlag = heights[1]! <= beginHeight ? 1 : 0
  let top = beginHeight
  let topFlag = eyeFlag === 0 ? 1 : 0

  if (eyeFlag === 1) {
    lowSlope = Math.abs(beginHeight - heights[1]!) / 1
  } else {
    maxSlope = Math.abs(heights[1]! - beginHeight) / 1
  }

  for (let i = 2; i < heights.length; i++) {
    const h = heights[i]!
    if (eyeFlag === 1) {
      if (h > beginHeight) {
        eyeFlag = 0
        visible.push(true)
        maxSlope = Math.abs(h - beginHeight) / i
        top = h
        topFlag = 1
        continue
      }
      const curSlope = Math.abs(beginHeight - h) / i
      visible.push(curSlope < (lowSlope ?? curSlope))
      if (curSlope < (lowSlope ?? curSlope)) lowSlope = curSlope
    } else {
      const curSlope = Math.abs(h - beginHeight) / i
      if (h < top) {
        visible.push(false)
      } else if (curSlope >= (maxSlope ?? 0) && topFlag === 1) {
        visible.push(true)
        top = h
        maxSlope = curSlope
      } else if (curSlope < (maxSlope ?? 0)) {
        visible.push(false)
        topFlag = 0
      } else {
        topFlag = 1
        visible.push(false)
        top = h
      }
    }
  }
  return visible
}

/** 直线通视计算选项 */
export interface VisualDistanceOptions {
  /** 插值采样数，预览可降低以减轻卡顿 */
  sampleCount?: number
}

/**
 * 直线通视分析。
 * @param viewer Cesium Viewer
 * @param positions 观测线段顶点
 * @param options 采样选项
 */
export async function computeVisualDistance(
  viewer: Viewer,
  positions: LngLatHeightTuple[],
  options: VisualDistanceOptions = {},
): Promise<VisualDistanceResult> {
  if (positions.length < 2) {
    return { positions: [...positions], visibleDistance: 0, invisibleDistance: 0 }
  }

  const sampleCount = Math.max(12, Math.min(options.sampleCount ?? 80, 120))
  const interpolated = lineInterpolate(positions, sampleCount)
  const cartos = interpolated.map((c) => Cesium.Cartographic.fromCartesian(c))
  updateCartographicHeights(viewer, cartos)

  const heights = cartos.map((c) => c.height)
  const flags = visibleCompute(heights)

  const keyPositions: LngLatHeightTuple[] = [toLngLat(interpolated[0]!)]
  let begin = 0
  let curBool = flags[begin]
  let visibleDistance = 0
  let invisibleDistance = 0

  for (let i = 0; i < flags.length - 1; ) {
    while (i < flags.length - 1 && flags[i] === curBool) i++
    const end = Math.min(i, flags.length - 1)
    const seg: LngLatHeightTuple[] = [
      toLngLat(interpolated[begin]!),
      toLngLat(interpolated[end]!),
    ]
    keyPositions.push(seg[1]!)
    const d = computeProjectionLength(seg)
    if (flags[begin]) visibleDistance += d
    else invisibleDistance += d
    begin = end
    if (i < flags.length) curBool = flags[i]!
  }

  return { positions: keyPositions, visibleDistance, invisibleDistance }
}

/**
 * 线缓冲区：每段两侧偏移（简化：圆角折线外包）。
 * @param positions 折线顶点
 * @param widthMeters 缓冲宽度（米）
 */
export function computeLineBufferPolygon(
  positions: LngLatHeightTuple[],
  widthMeters: number,
): LngLatHeightTuple[] {
  if (positions.length < 2) return []
  const left: LngLatHeightTuple[] = []
  const right: LngLatHeightTuple[] = []

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!
    const prev = positions[Math.max(0, i - 1)]!
    const next = positions[Math.min(positions.length - 1, i + 1)]!
    const c = toCartesian(p)
    const dir = new Cesium.Cartesian3()
    Cesium.Cartesian3.subtract(toCartesian(next), toCartesian(prev), dir)
    if (Cesium.Cartesian3.magnitude(dir) < 1e-6) continue
    Cesium.Cartesian3.normalize(dir, dir)
    const lateral = new Cesium.Cartesian3()
    Cesium.Cartesian3.cross(dir, Cesium.Cartesian3.UNIT_Z, lateral)
    if (Cesium.Cartesian3.magnitude(lateral) < 1e-6) {
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(c)
      const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian4())
      Cesium.Cartesian3.multiplyByScalar(
        new Cesium.Cartesian3(east.x, east.y, east.z),
        widthMeters,
        lateral,
      )
    } else {
      Cesium.Cartesian3.normalize(lateral, lateral)
      Cesium.Cartesian3.multiplyByScalar(lateral, widthMeters, lateral)
    }
    const l = new Cesium.Cartesian3()
    const r = new Cesium.Cartesian3()
    Cesium.Cartesian3.add(c, lateral, l)
    Cesium.Cartesian3.subtract(c, lateral, r)
    left.push(toLngLat(l))
    right.push(toLngLat(r))
  }

  return [...left, ...right.reverse()]
}

/**
 * 面缓冲区：顶点外扩（简化）。
 * @param positions 多边形顶点
 * @param widthMeters 缓冲宽度（米）
 */
export function computePolygonBuffer(
  positions: LngLatHeightTuple[],
  widthMeters: number,
): LngLatHeightTuple[] {
  if (positions.length < 3) return []
  const center = positions.reduce(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + (p[2] ?? 0)],
    [0, 0, 0],
  )
  center[0] /= positions.length
  center[1] /= positions.length
  center[2] /= positions.length

  return positions.map((p) => {
    const c = toCartesian(p)
    const o = toCartesian(center as LngLatHeightTuple)
    const dir = new Cesium.Cartesian3()
    Cesium.Cartesian3.subtract(c, o, dir)
    const len = Cesium.Cartesian3.magnitude(dir)
    if (len < 1e-6) return p
    Cesium.Cartesian3.multiplyByScalar(dir, (len + widthMeters) / len, dir)
    Cesium.Cartesian3.add(o, dir, dir)
    return toLngLat(dir)
  })
}

/**
 * 格式化距离显示文本。
 * @param meters 距离（米）
 * @param digits 小数位数
 */
export function formatDistanceMeters(meters: number, digits = 2): string {
  if (!Number.isFinite(meters)) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(digits)} km`
  return `${meters.toFixed(digits)} m`
}

/**
 * 格式化面积显示文本。
 * @param area 面积（m²）
 * @param digits 小数位数
 */
export function formatAreaSqMeters(area: number, digits = 2): string {
  if (!Number.isFinite(area)) return '—'
  if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(digits)} km²`
  return `${area.toFixed(digits)} m²`
}

/**
 * 格式化方位角显示文本。
 * @param rad 方位角（弧度）
 */
export function formatAzimuthDegrees(rad: number): string {
  return `${Cesium.Math.toDegrees(rad).toFixed(2)}°`
}

export { toCartesian, toLngLat }
