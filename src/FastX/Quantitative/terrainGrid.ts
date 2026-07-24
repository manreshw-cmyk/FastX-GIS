/**
 * 地形网格采样核心。
 * 坡度、坡向、挖填方、淹没等地形分析都可以基于同一套采样结果继续计算。
 */
import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import type { LngLatHeightTuple } from './types'

/** 地形网格采样点 */
export interface TerrainGridPoint {
  /** 经度（度） */
  lon: number
  /** 纬度（度） */
  lat: number
  /** 地形高程（米） */
  height: number
}

/** 矩形地形采样网格 */
export interface TerrainGrid {
  /** 网格行数 */
  rows: number
  /** 网格列数 */
  cols: number
  /** 二维采样点矩阵 */
  points: TerrainGridPoint[][]
  /** 最小高程（米） */
  minHeight: number
  /** 最大高程（米） */
  maxHeight: number
}

/** 将经度归一到 [-180, 180]。 */
function normalizeLongitude(lon: number): number {
  let value = lon
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}

/** 计算跨日期变更线时更短的经度差。 */
function shortestLongitudeDelta(from: number, to: number): number {
  let delta = to - from
  if (Math.abs(delta) > 180) delta = delta > 0 ? delta - 360 : delta + 360
  return delta
}

/** 限制采样点数量，避免超高密度拖慢场景。 */
function clampGridCount(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(2, Math.min(121, Math.round(value!)))
}

/**
 * 读取单个 Cartographic 的高程。
 * 优先使用 terrainProvider 采样后的高度，失败时回退到当前 Globe 可见高程。
 */
function resolveHeight(viewer: Viewer, cartographic: Cesium.Cartographic): number {
  const sampled = cartographic.height
  if (Number.isFinite(sampled) && Math.abs(sampled) > 1e-6) return sampled
  return viewer.scene.globe.getHeight(cartographic) ?? sampled ?? 0
}

/**
 * 采样矩形区域的地形高程。
 * @param viewer Cesium Viewer
 * @param corners 矩形对角两点
 * @param rows 网格点行数
 * @param cols 网格点列数
 */
export async function sampleTerrainGrid(
  viewer: Viewer,
  corners: LngLatHeightTuple[],
  rows = 33,
  cols = 33,
): Promise<TerrainGrid> {
  const [a, b] = corners
  const rowCount = clampGridCount(rows, 33)
  const colCount = clampGridCount(cols, 33)
  if (!a || !b) {
    return { rows: rowCount, cols: colCount, points: [], minHeight: 0, maxHeight: 0 }
  }

  const lonDelta = shortestLongitudeDelta(a[0], b[0])
  const latDelta = b[1] - a[1]
  const cartographics: Cesium.Cartographic[] = []

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const lon = normalizeLongitude(a[0] + (lonDelta * c) / (colCount - 1))
      const lat = a[1] + (latDelta * r) / (rowCount - 1)
      cartographics.push(Cesium.Cartographic.fromDegrees(lon, lat))
    }
  }

  const terrain = viewer.terrainProvider
  if (terrain && !(terrain instanceof Cesium.EllipsoidTerrainProvider)) {
    try {
      await Cesium.sampleTerrainMostDetailed(terrain, cartographics)
    } catch {
      // 地形服务不可用时使用当前 Globe 高程，保证分析仍能给出结果。
    }
  }

  let minHeight = Infinity
  let maxHeight = -Infinity
  const points: TerrainGridPoint[][] = []
  for (let r = 0; r < rowCount; r++) {
    points[r] = []
    for (let c = 0; c < colCount; c++) {
      const cartographic = cartographics[r * colCount + c]!
      const height = resolveHeight(viewer, cartographic)
      minHeight = Math.min(minHeight, height)
      maxHeight = Math.max(maxHeight, height)
      points[r]![c] = {
        lon: Cesium.Math.toDegrees(cartographic.longitude),
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        height,
      }
    }
  }

  return {
    rows: rowCount,
    cols: colCount,
    points,
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
  }
}

/**
 * 地表两点的椭球测地线距离。
 * @param a 点 A
 * @param b 点 B
 */
export function surfaceDistanceMeters(a: TerrainGridPoint, b: TerrainGridPoint): number {
  const start = Cesium.Cartographic.fromDegrees(a.lon, a.lat)
  const end = Cesium.Cartographic.fromDegrees(b.lon, b.lat)
  return new Cesium.EllipsoidGeodesic(start, end).surfaceDistance
}

/**
 * 采样点转经纬高三元组。
 * @param point 采样点
 * @param heightOffset 高程偏移，避免矢量结果与地形闪烁
 */
export function terrainPointToLngLatHeight(
  point: TerrainGridPoint,
  heightOffset = 0,
): LngLatHeightTuple {
  return [point.lon, point.lat, point.height + heightOffset]
}

/**
 * 由对角两点生成闭合矩形环。
 * @param a 角点 1
 * @param b 角点 2
 */
export function rectangleRing(a: LngLatHeightTuple, b: LngLatHeightTuple): LngLatHeightTuple[] {
  return [
    [a[0], a[1], 0],
    [b[0], a[1], 0],
    [b[0], b[1], 0],
    [a[0], b[1], 0],
    [a[0], a[1], 0],
  ]
}
