/**
 * 基础绘制 — 历史轨迹（`Entity` + `PathGraphics`）。
 * 仅负责尾迹图元；运动轨迹由 `Trajectory` 定义，模型由 `Model` 等另行挂载。
 */

import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

export interface PathStyleOptions {
  width?: number
  leadTime?: number
  trailTime?: number
  resolution?: number
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

export interface AddPathOptions {
  id?: string
  /** 时间采样位置（通常来自 `Trajectory#getPositionProperty()`） */
  position: Cesium.PositionProperty
  /** 可见时间窗；不传则始终可见 */
  availability?: Cesium.TimeIntervalCollection
  style?: PathStyleOptions
  width?: number
  color?: string
  alpha?: number
  leadTime?: number
  trailTime?: number
  resolution?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdatePathProperties {
  position?: Cesium.PositionProperty
  availability?: Cesium.TimeIntervalCollection
  style?: PathStyleOptions
  width?: number
  color?: string | Color
  alpha?: number
  leadTime?: number
  trailTime?: number
  resolution?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface PathSnapshot {
  id: string
  width: number
  leadTime: number
  trailTime: number
  resolution: number
  colorCss?: string
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

interface PathRecord {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

function colorFromString(css: string, alpha = 1): Color {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha)
}

function toColor(c: string | Color | undefined, alpha?: number): Color | undefined {
  if (c === undefined) return undefined
  if (c instanceof Cesium.Color) {
    return alpha !== undefined ? c.withAlpha(alpha) : c
  }
  return colorFromString(c, alpha ?? 1)
}

function sampleProperty<T>(p: Property | undefined, time = Cesium.JulianDate.now()): T | undefined {
  if (!p || typeof (p as Cesium.Property).getValue !== 'function') return undefined
  return (p as Cesium.Property).getValue(time) as T | undefined
}

function colorToCss(c: Color | undefined): string | undefined {
  if (!c) return undefined
  return typeof (c as { toCssColorString?: () => string }).toCssColorString === 'function'
    ? (c as Color & { toCssColorString: () => string }).toCssColorString()
    : undefined
}

function mergePathGraphics(
  pg: Cesium.PathGraphics,
  opts: {
    width: number
    color: Color
    leadTime: number
    trailTime: number
    resolution: number
    style?: PathStyleOptions
  },
  isCreate: boolean,
): void {
  pg.width = new Cesium.ConstantProperty(opts.width)
  pg.material = new Cesium.ColorMaterialProperty(opts.color)
  pg.leadTime = new Cesium.ConstantProperty(opts.leadTime)
  pg.trailTime = new Cesium.ConstantProperty(opts.trailTime)
  pg.resolution = new Cesium.ConstantProperty(opts.resolution)
  pg.show = new Cesium.ConstantProperty(true)

  const st = opts.style
  if (st?.distanceDisplayCondition !== undefined) {
    pg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  } else if (isCreate) {
    pg.distanceDisplayCondition = undefined
  }
}

function buildStyleFromOptions(options: AddPathOptions | UpdatePathProperties): {
  width: number
  color: Color
  leadTime: number
  trailTime: number
  resolution: number
  style?: PathStyleOptions
} {
  const st = options.style
  const width = options.width ?? st?.width ?? 4
  const color =
    toColor(options.color ?? '#ffcc00', options.alpha) ?? colorFromString('#ffcc00', options.alpha ?? 0.85)
  const leadTime = options.leadTime ?? st?.leadTime ?? 0
  const trailTime = options.trailTime ?? st?.trailTime ?? 60
  const resolution = options.resolution ?? st?.resolution ?? 1
  return { width, color, leadTime, trailTime, resolution, style: st }
}

/**
 * 基础绘制 — Path（`Entity` + `PathGraphics`），API 形态对齐 `Point`。
 */
export default class Path {
  private readonly data = new Map<string, PathRecord>()

  private isRecordAlive(rec: PathRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): PathRecord | undefined {
    const rec = this.data.get(id)
    if (!rec) return undefined
    if (!this.isRecordAlive(rec)) {
      this.data.delete(id)
      return undefined
    }
    return rec
  }

  private cloneTargetData(data?: Record<string, unknown>): Record<string, unknown> {
    if (!data || typeof data !== 'object') return {}
    return { ...data }
  }

  add(viewer: Viewer, options: AddPathOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id : createRandomXgxId('path')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined
    if (!options.position) return undefined

    const pathStyle = buildStyleFromOptions(options)
    const pathGraphics = new Cesium.PathGraphics()
    mergePathGraphics(pathGraphics, pathStyle, true)

    const entity = new Cesium.Entity({
      id,
      position: options.position,
      path: pathGraphics,
      availability: options.availability,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const td = this.cloneTargetData(options.targetData)
    td.leadTime = pathStyle.leadTime
    td.trailTime = pathStyle.trailTime
    td.resolution = pathStyle.resolution
    if (options.color) td.color = options.color
    if (options.alpha !== undefined) td.alpha = options.alpha

    this.data.set(id, { viewer, entity, targetData: td })
    return entity
  }

  updatePath(id: string, properties: UpdatePathProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false

    const p = properties
    if (p.position !== undefined) {
      rec.entity.position = p.position
    }
    if (p.availability !== undefined) {
      rec.entity.availability = p.availability
    }

    const pg = rec.entity.path ?? (rec.entity.path = new Cesium.PathGraphics())
    if (
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.width !== undefined ||
      p.leadTime !== undefined ||
      p.trailTime !== undefined ||
      p.resolution !== undefined ||
      p.style !== undefined
    ) {
      const prevColor = sampleProperty<Color>(
        pg.material instanceof Cesium.ColorMaterialProperty ? pg.material.color : undefined,
      )
      const patch = buildStyleFromOptions({
        color: (p.color as string | undefined) ?? colorToCss(prevColor),
        alpha: p.alpha,
        width: p.width ?? sampleProperty<number>(pg.width),
        leadTime: p.leadTime ?? sampleProperty<number>(pg.leadTime),
        trailTime: p.trailTime ?? sampleProperty<number>(pg.trailTime),
        resolution: p.resolution ?? sampleProperty<number>(pg.resolution),
        style: p.style,
      })
      mergePathGraphics(pg, patch, false)
      if (p.color) rec.targetData.color = p.color
      if (p.alpha !== undefined) rec.targetData.alpha = p.alpha
      rec.targetData.leadTime = patch.leadTime
      rec.targetData.trailTime = patch.trailTime
      rec.targetData.resolution = patch.resolution
    }

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(p.description)
    if (p.targetData !== undefined) rec.targetData = { ...rec.targetData, ...p.targetData }

    return true
  }

  getPath(id: string): PathSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec) return null
    const pg = rec.entity.path
    const width = pg ? (sampleProperty<number>(pg.width) ?? 4) : 4
    const leadTime = pg ? (sampleProperty<number>(pg.leadTime) ?? 0) : 0
    const trailTime = pg ? (sampleProperty<number>(pg.trailTime) ?? 60) : 60
    const resolution = pg ? (sampleProperty<number>(pg.resolution) ?? 1) : 1
    let colorCss: string | undefined
    if (pg?.material instanceof Cesium.ColorMaterialProperty) {
      colorCss = colorToCss(sampleProperty<Color>(pg.material.color))
    }
    const td = rec.targetData
    if (!colorCss && typeof td.color === 'string') colorCss = td.color
    const desc = sampleProperty<string>(rec.entity.description)

    return {
      id: rec.entity.id,
      width,
      leadTime: typeof td.leadTime === 'number' ? td.leadTime : leadTime,
      trailTime: typeof td.trailTime === 'number' ? td.trailTime : trailTime,
      resolution: typeof td.resolution === 'number' ? td.resolution : resolution,
      colorCss,
      show: rec.entity.show,
      targetData: { ...td },
      description: desc,
    }
  }

  getAllPaths(viewer?: Viewer): PathSnapshot[] {
    const out: PathSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const snap = this.getPath(id)
      if (snap) out.push(snap)
    }
    return out
  }

  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id)
    if (!rec) return undefined
    return { ...rec.targetData }
  }

  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity
  }

  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined
  }

  getIds(viewer?: Viewer): string[] {
    const out: string[] = []
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      out.push(id)
    }
    return out
  }

  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer)
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
  }

  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.show = visible
    return true
  }

  show(id: string): boolean {
    return this.setVisible(id, true)
  }

  hide(id: string): boolean {
    return this.setVisible(id, false)
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      rec.entity.show = show
    }
  }

  remove(id: string): boolean {
    const rec = this.data.get(id)
    if (!rec) return false
    this.data.delete(id)
    if (!rec.viewer.isDestroyed() && rec.viewer.entities.contains(rec.entity)) {
      rec.viewer.entities.remove(rec.entity)
    }
    return true
  }

  clear(viewer?: Viewer): void {
    const toRemove: string[] = []
    for (const [id, rec] of this.data) {
      if (viewer !== undefined && rec.viewer !== viewer) continue
      toRemove.push(id)
    }
    for (const id of toRemove) this.remove(id)
  }

  pruneInvalid(): number {
    let n = 0
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) {
        this.data.delete(id)
        n += 1
      }
    }
    return n
  }

  destroy(): void {
    this.clear()
  }
}
