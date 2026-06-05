import type { HeatmapColorStop, HeatmapGrid, HeatmapStyle } from '../types'
import { getH337 } from '../../../plugins/h337'
import type { H337Instance } from '../../../plugins/h337-types'
import { clamp01, seededRand } from './heatmapShared'

/** 框选描边色（与等高线分析一致） */
export const HEATMAP_BOX_LINE_COLOR = '#59ff9b'

/** 框选填充透明度 */
export const HEATMAP_BOX_FILL_ALPHA = 0.25

/** heatmap.js 内置默认色带（节点不足 3 个时回退） */
const HEATMAP_JS_GRADIENT: Record<string, string> = {
  '0.1': 'blue',
  '0.25': 'rgb(0,0,255)',
  '0.55': 'rgb(0,255,0)',
  '0.75': 'yellow',
  '0.85': 'rgb(255,165,0)',
  '0.99': 'white',
  '1.0': 'rgb(255,0,0)',
}

interface HeatmapJsPoint {
  x: number
  y: number
  value: number
}

/** heatmap.js 运行时：纹理 canvas + 强度采样 + 资源释放 */
export interface HeatmapJsRuntime {
  canvas: HTMLCanvasElement
  size: number
  sampleIntensity: (u: number, v: number) => number
  dispose: () => void
}

/** 将色带节点转为 heatmap.js gradient 对象 */
function buildH337Gradient(stops: HeatmapColorStop[]): Record<string, string> {
  if (stops.length < 3) return { ...HEATMAP_JS_GRADIENT }
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const out: Record<string, string> = {}
  for (const s of sorted) out[String(clamp01(s.position))] = s.color
  return out
}

/** 网格单元 → heatmap.js 散点（带轻微抖动使过渡更自然） */
function gridToHeatmapPoints(grid: HeatmapGrid, size: number, seed: number): HeatmapJsPoint[] {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const points: HeatmapJsPoint[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]![c]!
      const jitterX = (seededRand(seed, r, c * 2) - 0.5) * 0.35
      const jitterY = (seededRand(seed, r + 3, c * 2 + 1) - 0.5) * 0.35
      points.push({
        x: Math.round(clamp01((c + 0.5 + jitterX) / cols) * (size - 1)),
        y: Math.round(clamp01((r + 0.5 + jitterY) / rows) * (size - 1)),
        value: Math.max(1, Math.round(cell.value * 100)),
      })
    }
  }
  return points
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  out.getContext('2d')?.drawImage(src, 0, 0)
  return out
}

function readHeatmapCanvas(instance: H337Instance, container: HTMLElement): HTMLCanvasElement {
  const src =
    (container.querySelector('canvas') as HTMLCanvasElement | null) ?? instance._renderer?.canvas
  if (!src) throw new Error('heatmap.js 未生成 canvas')
  return cloneCanvas(src)
}

function scanPeakIntensity(instance: H337Instance, size: number): number {
  let peak = 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      peak = Math.max(peak, instance.getValueAt({ x, y }))
    }
  }
  return peak
}

/** 创建 heatmap.js 运行时（须先 await ensureHeatmapJs()） */
export function buildHeatmapJsRuntime(
  grid: HeatmapGrid,
  style: HeatmapStyle,
  size = 200,
  seed = 1,
): HeatmapJsRuntime {
  const h337 = getH337()

  const container = document.createElement('div')
  container.style.cssText = `width:${size}px;height:${size}px;position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;`
  document.body.appendChild(container)

  const cols = grid[0]?.length ?? 12
  const rows = grid.length
  const radius = Math.max(12, Math.min(48, Math.floor((size / Math.max(cols, rows, 1)) * 1.8)))

  const instance = h337.create({
    container,
    radius,
    maxOpacity: style.maxOpacity,
    minOpacity: style.minOpacity,
    blur: 0.75,
    gradient: buildH337Gradient(style.gradient),
  })

  instance.setData({ min: 0, max: 100, data: gridToHeatmapPoints(grid, size, seed) })

  const canvas = readHeatmapCanvas(instance, container)
  const peak = scanPeakIntensity(instance, size)

  const sampleIntensity = (u: number, v: number): number => {
    const x = Math.min(size - 1, Math.max(0, Math.round(clamp01(u) * (size - 1))))
    const y = Math.min(size - 1, Math.max(0, Math.round(clamp01(v) * (size - 1))))
    return clamp01(instance.getValueAt({ x, y }) / peak)
  }

  return {
    canvas,
    size,
    sampleIntensity,
    dispose: () => container.remove(),
  }
}
