import * as Cesium from 'cesium'
import type {
  HeatmapBounds,
  HeatmapCell,
  HeatmapDimension,
  HeatmapGrid,
  HeatmapKind,
  HeatmapRenderType,
  HeatmapStyle,
} from '../types'
import { DEFAULT_HEATMAP_STYLE } from '../types'

/** 由维度与形态拼出 kind 标识 */
export function resolveHeatmapKind(dimension: HeatmapDimension, renderType: HeatmapRenderType): HeatmapKind {
  return `${dimension}-${renderType}` as HeatmapKind
}

/** 合并用户样式与默认值 */
export function mergeHeatmapStyle(partial?: Partial<HeatmapStyle>): HeatmapStyle {
  return {
    ...DEFAULT_HEATMAP_STYLE,
    ...partial,
    gradient: partial?.gradient?.length ? [...partial.gradient] : [...DEFAULT_HEATMAP_STYLE.gradient],
  }
}

/** 规范 west/east、south/north 顺序 */
export function normalizeBounds(b: HeatmapBounds): HeatmapBounds {
  return {
    west: Math.min(b.west, b.east),
    east: Math.max(b.west, b.east),
    south: Math.min(b.south, b.north),
    north: Math.max(b.south, b.north),
  }
}

/** 限制到 [0, 1] */
export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/**
 * 确定性伪随机数（0~1），用于演示数据可复现
 * @param seed 主种子
 * @param a 行/索引扰动
 * @param b 列/索引扰动
 */
export function seededRand(seed: number, a: number, b: number): number {
  const x = Math.sin(seed * 12.9898 + a * 78.233 + b * 37.719) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 三维最大抬升高度（米），与框选区域跨度成比例
 * @param bounds 经纬度范围
 */
export function estimateHeightScale(bounds: HeatmapBounds): number {
  const b = normalizeBounds(bounds)
  const lat = (b.south + b.north) / 2
  const widthM = Cesium.Cartesian3.distance(
    Cesium.Cartesian3.fromDegrees(b.west, lat),
    Cesium.Cartesian3.fromDegrees(b.east, lat),
  )
  const heightM = Cesium.Cartesian3.distance(
    Cesium.Cartesian3.fromDegrees((b.west + b.east) / 2, b.south),
    Cesium.Cartesian3.fromDegrees((b.west + b.east) / 2, b.north),
  )
  return Math.max(50, Math.min(widthM, heightM) * 0.12)
}

/**
 * 按 seed 生成高斯叠加的演示热力网格
 * @param cols 列数
 * @param rows 行数
 * @param seed 随机种子
 */
export function generateHeatGrid(cols: number, rows: number, seed: number): HeatmapGrid {
  const peakCount = 5 + Math.floor(seededRand(seed, 1, 2) * 4)
  const peaks = Array.from({ length: peakCount }, (_, i) => ({
    cx: seededRand(seed, 10 + i, 1),
    cy: seededRand(seed, 20 + i, 2),
    r: 0.06 + seededRand(seed, 30 + i, 3) * 0.18,
    amp: 0.4 + seededRand(seed, 40 + i, 4) * 0.6,
  }))

  const grid: HeatmapGrid = []
  for (let r = 0; r < rows; r++) {
    const row: HeatmapCell[] = []
    const fy = rows <= 1 ? 0.5 : r / (rows - 1)
    for (let c = 0; c < cols; c++) {
      const fx = cols <= 1 ? 0.5 : c / (cols - 1)
      let value = 0
      for (const p of peaks) {
        const dx = fx - p.cx
        const dy = fy - p.cy
        value += p.amp * Math.exp(-(dx * dx + dy * dy) / (2 * p.r * p.r))
      }
      value += (seededRand(seed, r, c) - 0.5) * 0.4
      row.push({ value: clamp01(value), height: 0 })
    }
    grid.push(row)
  }
  return grid
}

/**
 * 解析最终网格：优先使用传入 grid 并裁剪/填充到目标尺寸，否则随机生成
 */
export function resolveHeatGrid(
  grid: HeatmapGrid | undefined,
  cols: number,
  rows: number,
  seed: number,
): HeatmapGrid {
  if (!grid?.length) return generateHeatGrid(cols, rows, seed)

  const out: HeatmapGrid = []
  for (let r = 0; r < rows; r++) {
    const src = grid[r] ?? []
    const row: HeatmapCell[] = []
    for (let c = 0; c < cols; c++) {
      const cell = src[c]
      row.push({
        value: clamp01(cell?.value ?? 0),
        height: Math.max(0, cell?.height ?? 0),
      })
    }
    out.push(row)
  }
  return out
}

/** 网格密度限制在 [2, 48] */
export function clampGridSize(n?: number): number {
  return Math.min(48, Math.max(2, n ?? 12))
}
