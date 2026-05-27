import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { AddRectangleOptions, RectangleSnapshot, RectangleStyleOptions, UpdateRectangleProperties } from '../../Types'
import {
  clearAreaDraftTargetData,
  getDraftPoints,
  isAreaDraftTargetData,
  markAreaDraftTargetData,
  setDraftPoints,
  type AreaDraftPointsHolder,
} from '../../Utils/areaDraft'
import { rectangleFromCorners } from '../../Utils/geoDraw'
export type { AddRectangleOptions, RectangleSnapshot, RectangleStyleOptions, UpdateRectangleProperties }

interface RectangleRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

function cornersFromBounds(w: number, s: number, e: number, n: number): Cesium.Cartesian3[] {
  return [
    Cesium.Cartesian3.fromDegrees(w, s),
    Cesium.Cartesian3.fromDegrees(e, n),
  ]
}

function boundsFromDraftPoints(pts: Cesium.Cartesian3[]): Cesium.Rectangle | undefined {
  if (pts.length >= 2) return rectangleFromCorners(pts[0]!, pts[1]!)
  return undefined
}

function resolveRectangleStyleFromTargetData(td: Record<string, unknown>): {
  showFill: boolean
  alpha: number
  fillColor: Color
  outline: boolean
  outlineColor: Color
  outlineWidth: number
  extruded?: number
  style?: RectangleStyleOptions
} {
  const showFill = td.showFill !== false
  const alpha = typeof td.alpha === 'number' ? td.alpha : 1
  const fillColor =
    toColor(String(td.color ?? '#3388ff'), showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
  const outline = td.outline !== false
  const outlineColor =
    toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
    Cesium.Color.WHITE
  const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
  const extruded =
    typeof td.extrudedHeight === 'number' && Number.isFinite(td.extrudedHeight) && td.extrudedHeight !== 0
      ? td.extrudedHeight
      : undefined
  return { showFill, alpha, fillColor, outline, outlineColor, outlineWidth, extruded, style: td.styleSnapshot as RectangleStyleOptions | undefined }
}

function applyAreaDraftGraphics(rec: RectangleRecord): void {
  const st = resolveRectangleStyleFromTargetData(rec.targetData)
  const getPts = (): Cesium.Cartesian3[] => getDraftPoints(rec)
  const td = rec.targetData

  const rectangle = new Cesium.RectangleGraphics()
  rectangle.coordinates = new Cesium.CallbackProperty(() => {
    const fromPts = boundsFromDraftPoints(getPts())
    if (fromPts) return fromPts
    return normalizeBounds(Number(td.west), Number(td.south), Number(td.east), Number(td.north))
  }, false)
  rectangle.fill = new Cesium.ConstantProperty(st.showFill)
  rectangle.material = new Cesium.ColorMaterialProperty(st.fillColor)
  rectangle.outline = new Cesium.ConstantProperty(st.outline)
  rectangle.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  rectangle.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  rectangle.height = new Cesium.ConstantProperty(st.style?.height ?? 0)
  if (st.extruded !== undefined) {
    rectangle.extrudedHeight = new Cesium.ConstantProperty(st.extruded)
  }
  const style = st.style
  if (style?.rotation !== undefined) rectangle.rotation = new Cesium.ConstantProperty(style.rotation)
  if (style?.stRotation !== undefined) rectangle.stRotation = new Cesium.ConstantProperty(style.stRotation)
  if (style?.granularity !== undefined) rectangle.granularity = new Cesium.ConstantProperty(style.granularity)
  if (style?.shadows !== undefined) rectangle.shadows = new Cesium.ConstantProperty(style.shadows)
  if (style?.distanceDisplayCondition !== undefined) {
    rectangle.distanceDisplayCondition = new Cesium.ConstantProperty(style.distanceDisplayCondition)
  }
  if (style?.classificationType !== undefined) {
    rectangle.classificationType = new Cesium.ConstantProperty(style.classificationType)
  }
  if (style?.zIndex !== undefined) rectangle.zIndex = new Cesium.ConstantProperty(style.zIndex)

  rec.entity.rectangle = rectangle
}

function refreshAreaDraftStyle(rec: RectangleRecord): void {
  const st = resolveRectangleStyleFromTargetData(rec.targetData)
  const rg = rec.entity.rectangle
  if (!rg) return
  rg.fill = new Cesium.ConstantProperty(st.showFill)
  rg.material = new Cesium.ColorMaterialProperty(st.fillColor)
  rg.outline = new Cesium.ConstantProperty(st.outline)
  rg.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  rg.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  if (st.extruded !== undefined) {
    rg.extrudedHeight = new Cesium.ConstantProperty(st.extruded)
  } else {
    rg.extrudedHeight = undefined
  }
}

function storeBoundsInTargetData(td: Record<string, unknown>, rect: Cesium.Rectangle): void {
  td.west = Cesium.Math.toDegrees(rect.west)
  td.south = Cesium.Math.toDegrees(rect.south)
  td.east = Cesium.Math.toDegrees(rect.east)
  td.north = Cesium.Math.toDegrees(rect.north)
}

function commitAreaDraftRecord(rec: RectangleRecord): boolean {
  const td = rec.targetData
  const rect =
    boundsFromDraftPoints(getDraftPoints(rec)) ??
    normalizeBounds(Number(td.west), Number(td.south), Number(td.east), Number(td.north))
  if (!rect) return false

  storeBoundsInTargetData(td, rect)
  clearAreaDraftTargetData(td)
  rec.draftPoints = undefined

  const st = resolveRectangleStyleFromTargetData(td)
  const rg = rec.entity.rectangle ?? (rec.entity.rectangle = new Cesium.RectangleGraphics())
  mergeRectangleGraphics(
    rg,
    {
      rectangle: rect,
      fillColor: st.fillColor,
      showFill: st.showFill,
      outline: st.outline,
      outlineColor: st.outlineColor,
      outlineWidth: st.outlineWidth,
      extrudedHeight: st.extruded,
      style: st.style,
    },
    false,
  )
  return true
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

function normalizeBounds(w: number, s: number, e: number, n: number): Cesium.Rectangle | undefined {
  let west = Number(w)
  let south = Number(s)
  let east = Number(e)
  let north = Number(n)
  if (![west, south, east, north].every((x) => Number.isFinite(x))) return undefined
  if (west > east) {
    const t = west
    west = east
    east = t
  }
  if (south > north) {
    const t = south
    south = north
    north = t
  }
  return Cesium.Rectangle.fromDegrees(west, south, east, north)
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

function readMaterialColor(rect: Cesium.RectangleGraphics): Color | undefined {
  const mat = rect.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function mergeRectangleGraphics(
  rg: Cesium.RectangleGraphics,
  opts: {
    rectangle: Cesium.Rectangle
    fillColor: Color
    showFill: boolean
    outline: boolean
    outlineColor: Color
    outlineWidth: number
    extrudedHeight?: number
    style?: RectangleStyleOptions
  },
  isCreate: boolean,
): void {
  rg.coordinates = new Cesium.ConstantProperty(opts.rectangle)
  rg.fill = new Cesium.ConstantProperty(opts.showFill)
  rg.material = new Cesium.ColorMaterialProperty(opts.fillColor)
  rg.outline = new Cesium.ConstantProperty(opts.outline)
  rg.outlineColor = new Cesium.ConstantProperty(opts.outlineColor)
  rg.outlineWidth = new Cesium.ConstantProperty(opts.outlineWidth)

  const h = opts.style?.height ?? 0
  rg.height = new Cesium.ConstantProperty(h)

  if (opts.extrudedHeight !== undefined && Number.isFinite(opts.extrudedHeight) && opts.extrudedHeight !== 0) {
    rg.extrudedHeight = new Cesium.ConstantProperty(opts.extrudedHeight)
  } else {
    rg.extrudedHeight = undefined
  }

  const st = opts.style
  if (st?.rotation !== undefined) rg.rotation = new Cesium.ConstantProperty(st.rotation)
  else if (isCreate) rg.rotation = undefined
  if (st?.stRotation !== undefined) rg.stRotation = new Cesium.ConstantProperty(st.stRotation)
  else if (isCreate) rg.stRotation = undefined
  if (st?.granularity !== undefined) rg.granularity = new Cesium.ConstantProperty(st.granularity)
  else if (isCreate) rg.granularity = undefined
  if (st?.shadows !== undefined) rg.shadows = new Cesium.ConstantProperty(st.shadows)
  if (st?.distanceDisplayCondition !== undefined) {
    rg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.classificationType !== undefined) {
    rg.classificationType = new Cesium.ConstantProperty(st.classificationType)
  }
  if (st?.zIndex !== undefined) rg.zIndex = new Cesium.ConstantProperty(st.zIndex)
}

/**
 * 矩形（`Entity` + `RectangleGraphics`）。单例，首参传入 `viewer`。
 */
export default class Rectangle {
  private readonly data = new Map<string, RectangleRecord>()

  private isRecordAlive(rec: RectangleRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): RectangleRecord | undefined {
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

  add(viewer: Viewer, options: AddRectangleOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('rect')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const rect = normalizeBounds(options.west, options.south, options.east, options.north)
    if (!rect) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const fillColor =
      toColor(options.color ?? '#3388ff', showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
    const outline = options.outline !== false
    const outlineColor =
      toColor(options.outlineColor ?? '#ffffff', options.outlineAlpha ?? 1) ?? Cesium.Color.WHITE
    const outlineWidth = options.outlineWidth ?? 2
    const extrudedHeight = options.extrudedHeight

    const rectangle = new Cesium.RectangleGraphics()
    mergeRectangleGraphics(
      rectangle,
      {
        rectangle: rect,
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        extrudedHeight,
        style: options.style,
      },
      true,
    )

    const entity = new Cesium.Entity({
      id,
      rectangle,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const td = this.cloneTargetData(options.targetData)
    const w = Cesium.Math.toDegrees(rect.west)
    const s = Cesium.Math.toDegrees(rect.south)
    const e = Cesium.Math.toDegrees(rect.east)
    const n = Cesium.Math.toDegrees(rect.north)
    td.west = w
    td.south = s
    td.east = e
    td.north = n
    td.extrudedHeight = extrudedHeight ?? 0
    td.color = options.color ?? '#3388ff'
    td.alpha = alpha
    td.showFill = showFill
    td.outline = outline
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = outlineWidth
    if (options.style) td.styleSnapshot = { ...options.style }

    this.data.set(id, { viewer, entity, targetData: td })
    return entity
  }

  private addAreaDraft(viewer: Viewer, id: string, options: AddRectangleOptions): Entity | undefined {
    const rect = normalizeBounds(options.west, options.south, options.east, options.north)
    if (!rect) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false
    const extrudedHeight = options.extrudedHeight

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    storeBoundsInTargetData(td, rect)
    td.extrudedHeight = extrudedHeight ?? 0
    td.color = options.color ?? '#3388ff'
    td.alpha = alpha
    td.showFill = showFill
    td.outline = outline
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = options.outlineWidth ?? 2
    if (options.style) td.styleSnapshot = { ...options.style }

    const entity = new Cesium.Entity({
      id,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    const rec: RectangleRecord = { viewer, entity, targetData: td }
    setDraftPoints(rec, cornersFromBounds(options.west, options.south, options.east, options.north))
    applyAreaDraftGraphics(rec)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  addRectangles(viewer: Viewer, items: AddRectangleOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id.trim() : createRandomXgxId('rect')
        const e = this.add(viewer, { ...item, id })
        if (e) ids.push(id)
      } catch (err) {
        console.error(`[FastX.Draw.Rectangle] addRectangles 第 ${i} 项失败:`, err)
      }
    }
    return ids
  }

  updateRectangle(id: string, properties: UpdateRectangleProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      if (p.west !== undefined) td.west = p.west
      if (p.south !== undefined) td.south = p.south
      if (p.east !== undefined) td.east = p.east
      if (p.north !== undefined) td.north = p.north
      const rect = normalizeBounds(Number(td.west), Number(td.south), Number(td.east), Number(td.north))
      if (rect) setDraftPoints(rec, cornersFromBounds(
        Cesium.Math.toDegrees(rect.west),
        Cesium.Math.toDegrees(rect.south),
        Cesium.Math.toDegrees(rect.east),
        Cesium.Math.toDegrees(rect.north),
      ))
      return commitAreaDraftRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

    if (p.targetData !== undefined) Object.assign(td, p.targetData)

    if (p.west !== undefined) td.west = p.west
    if (p.south !== undefined) td.south = p.south
    if (p.east !== undefined) td.east = p.east
    if (p.north !== undefined) td.north = p.north
    if (p.extrudedHeight !== undefined) td.extrudedHeight = p.extrudedHeight

    if (p.color !== undefined) td.color = p.color instanceof Cesium.Color ? colorToCss(p.color) : p.color
    if (p.alpha !== undefined) td.alpha = p.alpha
    if (p.showFill !== undefined) td.showFill = p.showFill
    if (p.outline !== undefined) td.outline = p.outline
    if (p.outlineColor !== undefined) {
      td.outlineColor = p.outlineColor instanceof Cesium.Color ? colorToCss(p.outlineColor) : p.outlineColor
    }
    if (p.outlineAlpha !== undefined) td.outlineAlpha = p.outlineAlpha
    if (p.outlineWidth !== undefined) td.outlineWidth = p.outlineWidth
    if (p.style !== undefined) td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style }

    const rect = normalizeBounds(
      Number(td.west),
      Number(td.south),
      Number(td.east),
      Number(td.north),
    )
    if (!rect) return false

    const rg = rec.entity.rectangle ?? (rec.entity.rectangle = new Cesium.RectangleGraphics())
    const showFill = td.showFill !== false
    const alpha = typeof td.alpha === 'number' ? td.alpha : 1
    const fillColor =
      toColor(String(td.color ?? '#3388ff'), showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
    const outline = td.outline !== false
    const outlineColor =
      toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
      Cesium.Color.WHITE
    const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
    const extruded =
      typeof td.extrudedHeight === 'number' && Number.isFinite(td.extrudedHeight) ? td.extrudedHeight : undefined

    mergeRectangleGraphics(
      rg,
      {
        rectangle: rect,
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        extrudedHeight: extruded,
        style: td.styleSnapshot as RectangleStyleOptions | undefined,
      },
      false,
    )

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  private applyStylePatchToTargetData(rec: RectangleRecord, p: UpdateRectangleProperties): void {
    const td = rec.targetData
    if (p.targetData !== undefined) Object.assign(td, p.targetData)
    if (p.extrudedHeight !== undefined) td.extrudedHeight = p.extrudedHeight
    if (p.color !== undefined) td.color = p.color instanceof Cesium.Color ? colorToCss(p.color) : p.color
    if (p.alpha !== undefined) td.alpha = p.alpha
    if (p.showFill !== undefined) td.showFill = p.showFill
    if (p.outline !== undefined) td.outline = p.outline
    if (p.outlineColor !== undefined) {
      td.outlineColor = p.outlineColor instanceof Cesium.Color ? colorToCss(p.outlineColor) : p.outlineColor
    }
    if (p.outlineAlpha !== undefined) td.outlineAlpha = p.outlineAlpha
    if (p.outlineWidth !== undefined) td.outlineWidth = p.outlineWidth
    if (p.style !== undefined) td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style }
  }

  private updateAreaDraft(rec: RectangleRecord, p: UpdateRectangleProperties): boolean {
    const td = rec.targetData
    markAreaDraftTargetData(td)
    this.applyStylePatchToTargetData(rec, p)

    if (p.west !== undefined) td.west = p.west
    if (p.south !== undefined) td.south = p.south
    if (p.east !== undefined) td.east = p.east
    if (p.north !== undefined) td.north = p.north

    const rect = normalizeBounds(Number(td.west), Number(td.south), Number(td.east), Number(td.north))
    if (rect) {
      setDraftPoints(rec, cornersFromBounds(
        Cesium.Math.toDegrees(rect.west),
        Cesium.Math.toDegrees(rect.south),
        Cesium.Math.toDegrees(rect.east),
        Cesium.Math.toDegrees(rect.north),
      ))
    }

    refreshAreaDraftStyle(rec)
    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updateRectangles(updates: Array<{ id: string } & UpdateRectangleProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateRectangle(id, rest) }))
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

  getRectangle(id: string): RectangleSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const rg = rec.entity.rectangle
    let r = rg ? sampleProperty<Cesium.Rectangle>(rg.coordinates) : undefined
    if (!r) {
      const td = rec.targetData
      const w = td.west
      const s = td.south
      const e = td.east
      const n = td.north
      if (
        typeof w === 'number' &&
        typeof s === 'number' &&
        typeof e === 'number' &&
        typeof n === 'number' &&
        [w, s, e, n].every((x) => Number.isFinite(x))
      ) {
        r = Cesium.Rectangle.fromDegrees(w, s, e, n)
      }
    }
    if (!r) return null
    const fillCol = rg ? readMaterialColor(rg) : undefined
    const outline = rg ? sampleProperty<boolean>(rg.outline) : undefined
    const outlineColor = rg ? sampleProperty<Color>(rg.outlineColor) : undefined
    const outlineWidth = rg ? sampleProperty<number>(rg.outlineWidth) : undefined
    const extruded = rg ? sampleProperty<number>(rg.extrudedHeight) : undefined
    const desc = sampleProperty<string>(rec.entity.description)
    const rawShowFill = rec.targetData.showFill

    return {
      id: rec.entity.id,
      west: Cesium.Math.toDegrees(r.west),
      south: Cesium.Math.toDegrees(r.south),
      east: Cesium.Math.toDegrees(r.east),
      north: Cesium.Math.toDegrees(r.north),
      extrudedHeight: typeof extruded === 'number' ? extruded : Number(rec.targetData.extrudedHeight) || 0,
      colorCss: colorToCss(fillCol),
      showFill: typeof rawShowFill === 'boolean' ? rawShowFill : true,
      outline,
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllRectangles(viewer?: Viewer): RectangleSnapshot[] {
    const out: RectangleSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getRectangle(id)
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
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      rec.entity.show = show
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
