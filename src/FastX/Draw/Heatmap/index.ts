import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import { ensureHeatmapJs } from '../../plugins/h337'
import {
  createHeatmap23D,
  destroyHeatmap23D,
  updateHeatmap23DShow,
  type Heatmap23DInstance,
} from './core/Heatmap23D'
import { clampGridSize, mergeHeatmapStyle, normalizeBounds, resolveHeatmapKind } from './core/heatmapShared'
import type {
  HeatmapCreateOptions,
  HeatmapDimension,
  HeatmapGrid,
  HeatmapKind,
  HeatmapRenderType,
  HeatmapSnapshot,
  HeatmapStyle,
  HeatmapUpdateOptions,
} from './types'

export type {
  HeatmapBounds,
  HeatmapCell,
  HeatmapColorStop,
  HeatmapCreateOptions,
  HeatmapDimension,
  HeatmapGrid,
  HeatmapKind,
  HeatmapRenderType,
  HeatmapSnapshot,
  HeatmapStyle,
  HeatmapUpdateOptions,
} from './types'
export { DEFAULT_HEATMAP_GRADIENT, DEFAULT_HEATMAP_STYLE } from './types'
export { HEATMAP_BOX_FILL_ALPHA, HEATMAP_BOX_LINE_COLOR } from './core/heatmapJs'
export { ensureHeatmapJs } from '../../plugins/h337'

/** 模块加载时预拉 heatmap.js */
const heatmapJsReady = ensureHeatmapJs()

/** 内存中单条热力图记录 */
interface HeatmapRecord {
  viewer: Viewer
  kind: HeatmapKind
  dimension: HeatmapDimension
  renderType: HeatmapRenderType
  bounds: ReturnType<typeof normalizeBounds>
  gridCols: number
  gridRows: number
  style: HeatmapStyle
  grid?: HeatmapGrid
  show: boolean
  seed: number
  inst?: Heatmap23DInstance
}

function resolveDimension(opts: { dimension?: HeatmapDimension }): HeatmapDimension {
  return opts.dimension === '3d' ? '3d' : '2d'
}

function resolveRenderType(opts: { renderType?: HeatmapRenderType }): HeatmapRenderType {
  return opts.renderType === 'surface' ? 'surface' : 'mesh'
}

/** 移除 Cesium 图元 */
function destroyGraphics(viewer: Viewer, rec: HeatmapRecord): void {
  if (rec.inst) destroyHeatmap23D(viewer, rec.inst)
  rec.inst = undefined
}

/** heatmap.js 就绪后同步挂载（create 时可能脚本尚未加载完） */
function mountGraphicsSync(rec: HeatmapRecord): void {
  rec.inst = createHeatmap23D({
    viewer: rec.viewer,
    dimension: rec.dimension,
    renderType: rec.renderType,
    bounds: rec.bounds,
    gridCols: rec.gridCols,
    gridRows: rec.gridRows,
    style: rec.style,
    grid: rec.grid,
    show: rec.show,
    seed: rec.seed,
  })
}

function mountGraphics(rec: HeatmapRecord): void {
  void heatmapJsReady.then(() => mountGraphicsSync(rec)).catch((err) => console.error('[FastX.Heatmap]', err))
}

/** 判断 update 是否需要重建图元 */
function shouldRebuild(prevKind: HeatmapKind, nextKind: HeatmapKind, options: HeatmapUpdateOptions): boolean {
  return (
    prevKind !== nextKind ||
    options.bounds !== undefined ||
    options.gridCols !== undefined ||
    options.gridRows !== undefined ||
    options.grid !== undefined ||
    options.style !== undefined ||
    options.seed !== undefined ||
    options.dimension !== undefined ||
    options.renderType !== undefined
  )
}

/**
 * FastX 2D/3D 热力图管理器
 * - 二维：贴地，无高度
 * - 三维：按热力强度抬升
 * - 面状 / 网状：同一 heatmap.js 纹理，几何拓扑不同
 */
export default class Heatmap {
  private readonly records = new Map<string, HeatmapRecord>()

  /** 创建热力图，返回 id；失败返回空字符串 */
  create(options: HeatmapCreateOptions): string {
    const viewer = options.viewer
    if (viewer.isDestroyed()) return ''

    const id = options.id?.trim() || createRandomXgxId('hm')
    this.remove(id)

    const dimension = resolveDimension(options)
    const renderType = resolveRenderType(options)
    const rec: HeatmapRecord = {
      viewer,
      dimension,
      renderType,
      kind: resolveHeatmapKind(dimension, renderType),
      bounds: normalizeBounds(options.bounds),
      gridCols: clampGridSize(options.gridCols),
      gridRows: clampGridSize(options.gridRows),
      style: mergeHeatmapStyle(options.style),
      grid: options.grid,
      show: options.show !== false,
      seed: options.seed ?? Date.now() % 9973,
    }

    mountGraphics(rec)
    this.records.set(id, rec)
    return id
  }

  /** 更新参数；涉及几何/样式/种子变更时会重建 */
  update(id: string, options: HeatmapUpdateOptions): boolean {
    const rec = this.records.get(id)
    if (!rec || rec.viewer.isDestroyed()) return false

    const dimension = options.dimension ?? rec.dimension
    const renderType = options.renderType ?? rec.renderType
    const prevKind = rec.kind
    const kind = resolveHeatmapKind(dimension, renderType)

    rec.dimension = dimension
    rec.renderType = renderType
    rec.kind = kind
    rec.bounds = options.bounds ? normalizeBounds(options.bounds) : rec.bounds
    rec.gridCols = options.gridCols !== undefined ? clampGridSize(options.gridCols) : rec.gridCols
    rec.gridRows = options.gridRows !== undefined ? clampGridSize(options.gridRows) : rec.gridRows
    rec.style = options.style ? mergeHeatmapStyle({ ...rec.style, ...options.style }) : rec.style
    rec.grid = options.grid ?? rec.grid
    rec.seed = options.seed ?? rec.seed
    rec.show = options.show ?? rec.show

    if (shouldRebuild(prevKind, kind, options)) {
      destroyGraphics(rec.viewer, rec)
      mountGraphics(rec)
    } else if (rec.inst) {
      updateHeatmap23DShow(rec.inst, rec.show)
    }

    return true
  }

  /** 按 id 删除 */
  remove(id: string): boolean {
    const rec = this.records.get(id)
    if (!rec) return false
    if (!rec.viewer.isDestroyed()) destroyGraphics(rec.viewer, rec)
    this.records.delete(id)
    return true
  }

  /** 清空；传入 viewer 时仅清除该 viewer 上的实例 */
  clear(viewer?: Viewer): void {
    for (const id of [...this.records.keys()]) {
      const rec = this.records.get(id)
      if (!rec) continue
      if (viewer && rec.viewer !== viewer) continue
      this.remove(id)
    }
  }

  /** 获取单条快照 */
  getSnapshot(id: string): HeatmapSnapshot | null {
    const rec = this.records.get(id)
    if (!rec) return null
    return {
      id,
      kind: rec.kind,
      bounds: { ...rec.bounds },
      gridCols: rec.gridCols,
      gridRows: rec.gridRows,
      show: rec.show,
    }
  }

  /** 列出快照；可限定 viewer */
  getAll(viewer?: Viewer): HeatmapSnapshot[] {
    return [...this.records.keys()]
      .map((id) => this.getSnapshot(id))
      .filter((s): s is HeatmapSnapshot => !!s && (!viewer || this.records.get(s.id)?.viewer === viewer))
  }

  /** 清理 viewer 已销毁的残留记录 */
  pruneInvalid(): void {
    for (const id of [...this.records.keys()]) {
      const rec = this.records.get(id)
      if (!rec || rec.viewer.isDestroyed()) this.records.delete(id)
    }
  }
}
