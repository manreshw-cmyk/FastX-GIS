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
 * 视域扇区角度采样列表（度，相对中心角，含两侧边界）。
 * @param spanDeg 张角跨度
 * @param stepDeg 步长（度），最小 1.5
 */
export function getViewShedAngleOffsets(spanDeg: number, stepDeg: number): number[] {
  const half = spanDeg / 2
  const step = Math.max(1.5, Math.min(stepDeg, 60))
  const offsets: number[] = []
  for (let deg = -half; deg <= half + 1e-6; deg += step) {
    offsets.push(deg)
  }
  const last = offsets[offsets.length - 1]
  if (last === undefined || last < half - 1e-6) {
    offsets.push(half)
  }
  return offsets
}

/** 视域扇形内贴地填充单元 */
export interface ViewShedFillCell {
  corners: [LngLatHeightTuple, LngLatHeightTuple, LngLatHeightTuple, LngLatHeightTuple]
  center: LngLatHeightTuple
}

/** 归一化角度到 (-180, 180]（度） */
function normalizeAngleDeg(deg: number): number {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a <= -180) a += 360
  return a
}

/** 点是否在视域扇形椭球内（与示意椭球同张角、视距） */
function isViewShedPointInSector(
  eye: LngLatHeightTuple,
  point: LngLatHeightTuple,
  headingDeg: number,
  pitchDeg: number,
  horizontalAngleDeg: number,
  verticalAngleDeg: number,
  maxDistanceMeters: number,
): boolean {
  const eyeC = toCartesian(eye)
  const pointC = toCartesian(point)
  const m = Cesium.Transforms.eastNorthUpToFixedFrame(eyeC, undefined, new Cesium.Matrix4())
  Cesium.Matrix4.inverse(m, m)
  const local = new Cesium.Cartesian3()
  Cesium.Matrix4.multiplyByPoint(m, pointC, local)
  const dist = Cesium.Cartesian3.magnitude(local)
  if (dist > maxDistanceMeters + 0.5) return false
  if (dist < 1e-3) return true

  const az = Cesium.Math.toDegrees(Math.atan2(local.x, local.y))
  const el = Cesium.Math.toDegrees(Math.asin(Cesium.Math.clamp(local.z / dist, -1, 1)))
  const halfH = horizontalAngleDeg / 2
  const halfV = verticalAngleDeg / 2
  return (
    Math.abs(normalizeAngleDeg(az - headingDeg)) <= halfH + 0.02 &&
    Math.abs(el - pitchDeg) <= halfV + 0.02
  )
}

/** 单元格中心与四角均在扇形内 */
function isViewShedCellInSector(
  eye: LngLatHeightTuple,
  cell: ViewShedFillCell,
  headingDeg: number,
  pitchDeg: number,
  horizontalAngleDeg: number,
  verticalAngleDeg: number,
  maxDistanceMeters: number,
): boolean {
  const pts: LngLatHeightTuple[] = [cell.center, ...cell.corners]
  return pts.every((p) =>
    isViewShedPointInSector(
      eye,
      p,
      headingDeg,
      pitchDeg,
      horizontalAngleDeg,
      verticalAngleDeg,
      maxDistanceMeters,
    ),
  )
}

/**
 * 生成视域扇形内楔形网格单元（水平×垂直×径向共边；越界单元剔除）。
 * @param radialRingCount 径向环数
 */
export function getViewShedFillCells(
  horizontalAngleDeg: number,
  verticalAngleDeg: number,
  hStepDeg: number,
  vStepDeg: number,
  eye: LngLatHeightTuple,
  distanceMeters: number,
  headingDeg: number,
  pitchDeg: number,
  radialRingCount: number,
): ViewShedFillCell[] {
  const h = getViewShedAngleOffsets(horizontalAngleDeg, hStepDeg)
  const v = getViewShedAngleOffsets(verticalAngleDeg, vStepDeg)
  const rings = Math.max(2, Math.min(radialRingCount, 32))
  const near = Math.max(distanceMeters * 0.02, 1.5)
  const span = distanceMeters - near
  const cells: ViewShedFillCell[] = []

  for (let ri = 0; ri < rings; ri++) {
    const rInner = near + (span * ri) / rings
    if (rInner >= distanceMeters - 0.05) break
    const rOuter = Math.min(near + (span * (ri + 1)) / rings, distanceMeters)
    const rMid = (rInner + rOuter) / 2

    for (let vi = 0; vi < v.length - 1; vi++) {
      const p0 = v[vi]!
      const p1 = v[vi + 1]!
      const pitchMid = (p0 + p1) / 2
      for (let hi = 0; hi < h.length - 1; hi++) {
        const az0 = h[hi]!
        const az1 = h[hi + 1]!
        const corners: ViewShedFillCell['corners'] = [
          viewShedRayTarget(eye, rInner, headingDeg, pitchDeg, az0, p0),
          viewShedRayTarget(eye, rInner, headingDeg, pitchDeg, az1, p0),
          viewShedRayTarget(eye, rOuter, headingDeg, pitchDeg, az1, p1),
          viewShedRayTarget(eye, rOuter, headingDeg, pitchDeg, az0, p1),
        ]
        const center = viewShedRayTarget(
          eye,
          rMid,
          headingDeg,
          pitchDeg,
          (az0 + az1) / 2,
          pitchMid,
        )
        const cell = { corners, center }
        if (
          isViewShedCellInSector(
            eye,
            cell,
            headingDeg,
            pitchDeg,
            horizontalAngleDeg,
            verticalAngleDeg,
            distanceMeters,
          )
        ) {
          cells.push(cell)
        }
      }
    }
  }
  return cells
}

/** 判断单元格中心是否对观测点通视（直线通视采样） */
export async function isViewShedCellVisible(
  viewer: Viewer,
  eye: LngLatHeightTuple,
  center: LngLatHeightTuple,
  sampleCount = 40,
): Promise<boolean> {
  const obj = await computeVisualDistance(viewer, [eye, center], { sampleCount })
  if (obj.invisibleDistance <= 0) return true
  if (obj.visibleDistance <= 0) return false
  return obj.visibleDistance >= obj.invisibleDistance
}

/**
 * 视域单条射线终点（按航向、俯仰与水平/垂直偏移推算）。
 * @param eye 观测点
 * @param distanceMeters 射线长度（米）
 * @param headingDeg 中心航向（度）
 * @param pitchDeg 中心俯仰（度）
 * @param azimuthOffsetDeg 水平偏移（度）
 * @param pitchOffsetDeg 垂直偏移（度）
 */
export function viewShedRayTarget(
  eye: LngLatHeightTuple,
  distanceMeters: number,
  headingDeg: number,
  pitchDeg: number,
  azimuthOffsetDeg: number,
  pitchOffsetDeg = 0,
): LngLatHeightTuple {
  const azRad = Cesium.Math.toRadians(headingDeg + azimuthOffsetDeg)
  const pitchRad = Cesium.Math.toRadians(pitchDeg + pitchOffsetDeg)
  const horiz = distanceMeters * Math.cos(pitchRad)
  const end = geodesicDestination(eye, horiz, azRad)
  return [end[0], end[1], (eye[2] ?? 0) + distanceMeters * Math.sin(pitchRad)]
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
