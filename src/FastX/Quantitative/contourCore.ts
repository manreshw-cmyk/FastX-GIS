/**
 * 等高线矢量生成（网格采样 + 等高线段提取，对齐 FreeX FeContourAnalyze 效果）。
 */
import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import type { LngLatHeightTuple } from './types'

/** 单条等高线段 */
export interface ContourSegment {
  a: LngLatHeightTuple
  b: LngLatHeightTuple
  level: number
}

/** 等高线构建结果 */
export interface ContourBuildResult {
  segments: ContourSegment[]
  labelLevels: number[]
}

/** 网格采样点 */
interface GridPoint {
  lon: number
  lat: number
  height: number
  level: number
}

/**
 * 采样指定经纬度处 Globe 高程。
 * @param viewer Cesium Viewer
 * @param lon 经度
 * @param lat 纬度
 */
function sampleHeight(viewer: Viewer, lon: number, lat: number): number {
  const carto = Cesium.Cartographic.fromDegrees(lon, lat)
  return viewer.scene.globe.getHeight(carto) ?? 0
}

/**
 * 两点间按等高值线性插值。
 * @param p1 网格点 1
 * @param p2 网格点 2
 * @param level 等高值
 */
function lerpPoint(
  p1: GridPoint,
  p2: GridPoint,
  level: number,
): LngLatHeightTuple {
  const t = (level - p1.height) / (p2.height - p1.height || 1)
  const lon = p1.lon + (p2.lon - p1.lon) * t
  const lat = p1.lat + (p2.lat - p1.lat) * t
  return [lon, lat, level]
}

/**
 * 在矩形范围内生成等高线段。
 * @param viewer Cesium Viewer
 * @param corners 对角两点 [左下/左上, 右上/右下]
 * @param interval 等高距（米）
 * @param gridRows 网格行数
 * @param gridCols 网格列数
 */
export async function buildContourSegments(
  viewer: Viewer,
  corners: LngLatHeightTuple[],
  interval: number,
  gridRows = 50,
  gridCols = 50,
): Promise<ContourBuildResult> {
  const [p0, p1] = corners
  if (!p0 || !p1) return { segments: [], labelLevels: [] }

  let west = Math.min(p0[0], p1[0])
  let east = Math.max(p0[0], p1[0])
  const south = Math.min(p0[1], p1[1])
  const north = Math.max(p0[1], p1[1])

  let differLon = p1[0] - p0[0]
  if (Math.abs(differLon) > 180) {
    differLon = differLon > 0 ? differLon - 360 : differLon + 360
  }

  const grid: GridPoint[][] = []
  let minH = Infinity
  let maxH = -Infinity

  for (let r = 0; r < gridRows; r++) {
    grid[r] = []
    for (let c = 0; c < gridCols; c++) {
      let lon = p0[0] + (differLon * c) / (gridCols - 1)
      if (lon > 180) lon -= 360
      if (lon < -180) lon += 360
      const lat = p0[1] + ((p1[1] - p0[1]) * r) / (gridRows - 1)
      const height = sampleHeight(viewer, lon, lat)
      minH = Math.min(minH, height)
      maxH = Math.max(maxH, height)
      const level = height > -10000 ? Math.floor(height / interval) : 0
      grid[r]![c] = { lon, lat, height, level }
    }
  }

  const segments: ContourSegment[] = []
  const labelSet = new Set<number>()
  const startLevel = Math.floor(minH / interval) * interval

  for (let level = startLevel; level <= maxH; level += interval) {
    for (let r = 0; r < gridRows - 1; r++) {
      for (let c = 0; c < gridCols - 1; c++) {
        const p00 = grid[r]![c]!
        const p10 = grid[r]![c + 1]!
        const p01 = grid[r + 1]![c]!
        const p11 = grid[r + 1]![c + 1]!
        const cornersH = [p00.height, p10.height, p11.height, p01.height]
        const mask =
          (cornersH[0]! >= level ? 1 : 0) |
          ((cornersH[1]! >= level ? 1 : 0) << 1) |
          ((cornersH[2]! >= level ? 1 : 0) << 2) |
          ((cornersH[3]! >= level ? 1 : 0) << 3)
        if (mask === 0 || mask === 15) continue

        const pts: LngLatHeightTuple[] = []
        const edges: Array<[GridPoint, GridPoint, number, number]> = [
          [p00, p10, cornersH[0]!, cornersH[1]!],
          [p10, p11, cornersH[1]!, cornersH[2]!],
          [p11, p01, cornersH[2]!, cornersH[3]!],
          [p01, p00, cornersH[3]!, cornersH[0]!],
        ]
        for (const [a, b, ha, hb] of edges) {
          if ((ha >= level) !== (hb >= level)) {
            pts.push(lerpPoint(a, b, level))
          }
        }
        if (pts.length >= 2) {
          segments.push({ a: pts[0]!, b: pts[1]!, level })
          if (level % (interval * 5) === 0) labelSet.add(level)
        }
        if (pts.length === 4) {
          segments.push({ a: pts[2]!, b: pts[3]!, level })
        }
      }
    }
  }

  return { segments: segments, labelLevels: [...labelSet].sort((a, b) => a - b) }
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
