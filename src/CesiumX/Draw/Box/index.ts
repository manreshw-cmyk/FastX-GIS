import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type { PointPositionInput, PointPositionsTuple } from '../Point'

export type BoxPositionsTuple = PointPositionsTuple

export type BoxDimensionsInput = Cesium.Cartesian3 | readonly [number, number, number]

export interface BoxStyleOptions {
  dimensions?: Cesium.Cartesian3
  heightReference?: Cesium.HeightReference
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  shadows?: Cesium.ShadowMode
}

/**
 * 添加轴对齐盒子（`Entity` + `BoxGraphics`），中心在 `position` / `positions`，轴向与 ENU 对齐。
 */
export interface AddBoxOptions {
  id?: string
  position?: PointPositionInput
  positions?: BoxPositionsTuple
  /** 长宽高（米），默认 [200, 200, 200] */
  dimensions?: BoxDimensionsInput
  style?: BoxStyleOptions
  color?: string
  alpha?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  fill?: boolean
  show?: boolean
  description?: string
  heightReference?: keyof typeof Cesium.HeightReference
  targetData?: Record<string, unknown>
}

export interface UpdateBoxProperties {
  longitude?: number
  latitude?: number
  height?: number
  position?: PointPositionInput
  positions?: BoxPositionsTuple
  dimensions?: BoxDimensionsInput
  color?: string | Color
  alpha?: number
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  fill?: boolean
  show?: boolean
  description?: string
  heightReference?: keyof typeof Cesium.HeightReference
  targetData?: Record<string, unknown>
  style?: BoxStyleOptions
}

export interface BoxSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  dimensions: { x: number; y: number; z: number }
  fillColorCss?: string
  outlineColorCss?: string
  outlineWidth?: number
  outline?: boolean
  fill?: boolean
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

interface BoxRecord {
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

function toCartesian3(position: PointPositionInput, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (position instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(position, result)
  }
  const h = position.height ?? 0
  return Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, h, undefined, result)
}

function positionFromTuple(positions: BoxPositionsTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  const h = positions[2] ?? 0
  return Cesium.Cartesian3.fromDegrees(Number(positions[0]), Number(positions[1]), Number(h), undefined, result)
}

function resolveAddCartesian(options: AddBoxOptions): Cesium.Cartesian3 | undefined {
  if (options.position !== undefined && options.positions !== undefined) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.positions !== undefined && options.positions.length >= 2) {
    return positionFromTuple(options.positions)
  }
  return undefined
}

function resolveDimensions(d?: BoxDimensionsInput): Cesium.Cartesian3 {
  if (!d) return new Cesium.Cartesian3(200, 200, 200)
  if (d instanceof Cesium.Cartesian3) return Cesium.Cartesian3.clone(d)
  return new Cesium.Cartesian3(Number(d[0]) || 200, Number(d[1]) || 200, Number(d[2]) || 200)
}

function parseHeightRef(s: keyof typeof Cesium.HeightReference | undefined): Cesium.HeightReference {
  if (!s) return Cesium.HeightReference.NONE
  return Cesium.HeightReference[s] ?? Cesium.HeightReference.NONE
}

function mergeBoxGraphics(box: Cesium.BoxGraphics, options: AddBoxOptions | UpdateBoxProperties, isCreate: boolean): void {
  const st = options.style
  const upd = options as UpdateBoxProperties
  const add = options as AddBoxOptions

  let dim: Cesium.Cartesian3 | undefined
  if (st?.dimensions !== undefined) dim = Cesium.Cartesian3.clone(st.dimensions)
  else if (isCreate) dim = resolveDimensions(add.dimensions)
  else if (upd.dimensions !== undefined) dim = resolveDimensions(upd.dimensions)
  if (dim !== undefined) box.dimensions = new Cesium.ConstantProperty(dim)

  if (isCreate || upd.color !== undefined || upd.alpha !== undefined) {
    const fillCol = toColor(upd.color ?? add.color, upd.alpha ?? add.alpha) ?? Cesium.Color.CYAN.withAlpha(0.65)
    box.material = new Cesium.ColorMaterialProperty(fillCol)
  }

  if (upd.outline !== undefined) {
    box.outline = new Cesium.ConstantProperty(upd.outline)
  } else if (isCreate) {
    box.outline = new Cesium.ConstantProperty(add.outline !== false)
  }

  if (upd.outlineColor !== undefined || upd.outlineAlpha !== undefined || add.outlineColor !== undefined || add.outlineAlpha !== undefined) {
    const oc = toColor(upd.outlineColor ?? add.outlineColor, upd.outlineAlpha ?? add.outlineAlpha)
    if (oc !== undefined) box.outlineColor = new Cesium.ConstantProperty(oc)
  } else if (isCreate) {
    box.outlineColor = new Cesium.ConstantProperty(Cesium.Color.BLACK)
  }

  if (upd.outlineWidth !== undefined || add.outlineWidth !== undefined) {
    const ow = upd.outlineWidth ?? add.outlineWidth
    if (ow !== undefined) box.outlineWidth = new Cesium.ConstantProperty(ow)
  } else if (isCreate) {
    box.outlineWidth = new Cesium.ConstantProperty(1)
  }

  if (upd.fill !== undefined || add.fill !== undefined) {
    const f = upd.fill !== undefined ? upd.fill : add.fill
    if (f !== undefined) box.fill = new Cesium.ConstantProperty(f)
  } else if (isCreate) {
    box.fill = new Cesium.ConstantProperty(true)
  }

  const hrKey = add.heightReference ?? upd.heightReference
  const hr = st?.heightReference ?? (hrKey !== undefined ? parseHeightRef(hrKey) : undefined)
  if (hr !== undefined) box.heightReference = new Cesium.ConstantProperty(hr)
  else if (isCreate) box.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)

  if (st?.distanceDisplayCondition !== undefined) {
    box.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.shadows !== undefined) box.shadows = new Cesium.ConstantProperty(st.shadows)
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

/**
 * 基础绘制 — 盒子 / 立方体（`Entity` + `BoxGraphics`）。
 */
export default class Box {
  private readonly data = new Map<string, BoxRecord>()

  private isRecordAlive(rec: BoxRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): BoxRecord | undefined {
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

  add(viewer: Viewer, options: AddBoxOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id : createRandomXgxId('box')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    const position = resolveAddCartesian(options)
    if (!position) return undefined

    const bg = new Cesium.BoxGraphics()
    mergeBoxGraphics(bg, options, true)

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      box: bg,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)
    this.data.set(id, { viewer, entity, targetData: this.cloneTargetData(options.targetData) })
    return entity
  }

  addBatch(viewer: Viewer, items: AddBoxOptions[]): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed()) return { succeeded: [], failedIds: [] }
    const succeeded: Entity[] = []
    const failedIds: string[] = []
    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId('box')
      const e = this.add(viewer, { ...item, id: resolvedId })
      if (e) succeeded.push(e)
      else failedIds.push(resolvedId)
    }
    return { succeeded, failedIds }
  }

  addBoxes(viewer: Viewer, items: AddBoxOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id : createRandomXgxId('box')
        const ent = this.add(viewer, { ...item, id })
        if (ent) ids.push(id)
      } catch (e) {
        console.error(`[XGX.Draw.Box] addBoxes 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updateBox(id: string, properties: UpdateBoxProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false

    const p = properties
    if (p.position !== undefined) {
      rec.entity.position = new Cesium.ConstantPositionProperty(toCartesian3(p.position))
    } else if (p.positions !== undefined) {
      if (p.positions.length < 2) return false
      rec.entity.position = new Cesium.ConstantPositionProperty(positionFromTuple(p.positions))
    } else if (p.longitude !== undefined && p.latitude !== undefined) {
      const h = p.height !== undefined ? p.height : 0
      rec.entity.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h)),
      )
    }

    const bg = rec.entity.box ?? (rec.entity.box = new Cesium.BoxGraphics())
    mergeBoxGraphics(bg, p, false)

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(p.description)
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    return true
  }

  updateBoxes(updates: Array<{ id: string } & UpdateBoxProperties>): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u
      return { id, success: this.updateBox(id, rest) }
    })
  }

  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id)
    if (!rec) return undefined
    return { ...rec.targetData }
  }

  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = { ...targetData }
    return true
  }

  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = { ...rec.targetData, ...patch }
    return true
  }

  getBox(id: string): BoxSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos) return null
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const bx = rec.entity.box
    const dims = bx ? sampleProperty<Cesium.Cartesian3>(bx.dimensions) : undefined
    let fillCss: string | undefined
    if (bx?.material && typeof bx.material.getValue === 'function') {
      const mat = bx.material.getValue(Cesium.JulianDate.now()) as Cesium.Material | Cesium.Color | undefined
      if (mat instanceof Cesium.Color) fillCss = colorToCss(mat)
      else if (mat instanceof Cesium.Material && mat.uniforms?.color) {
        fillCss = colorToCss(mat.uniforms.color as Color)
      }
    }
    const outlineColor = bx ? sampleProperty<Color>(bx.outlineColor) : undefined
    const outlineWidth = bx ? sampleProperty<number>(bx.outlineWidth) : undefined
    const outline = bx ? sampleProperty<boolean>(bx.outline) : undefined
    const fill = bx ? sampleProperty<boolean>(bx.fill) : undefined
    const desc = sampleProperty<string>(rec.entity.description)

    const d = dims ?? new Cesium.Cartesian3(200, 200, 200)
    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      dimensions: { x: d.x, y: d.y, z: d.z },
      fillColorCss: fillCss,
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      outline,
      fill,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllBoxes(viewer?: Viewer): BoxSnapshot[] {
    const out: BoxSnapshot[] = []
    for (const bid of this.getIds(viewer)) {
      const s = this.getBox(bid)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
  }

  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer)
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, r] of this.data) {
      if (!this.isRecordAlive(r)) continue
      if (viewer !== undefined && r.viewer !== viewer) continue
      r.entity.show = show
    }
  }

  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show)
  }

  removeAll(viewer?: Viewer): void {
    this.clear(viewer)
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

  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.show = visible
    return true
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

  removeBatch(ids: string[]): number {
    let n = 0
    for (const id of ids) {
      if (this.remove(id)) n += 1
    }
    return n
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
