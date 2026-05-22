import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type { CircleCenterInput, CircleCenterTuple } from '../Circle'
import type { PolygonStyleOptions } from '../Polygon'
import { computeSectorCartesianRing } from './sectorWedge'

export type { PolygonStyleOptions as SectorStyleOptions } from '../Polygon'

/** 扇心：与 `Circle` 一致，`position` / `center` / `positions` 三选一 */
export interface AddSectorOptions {
  id?: string
  position?: CircleCenterInput
  center?: CircleCenterInput
  positions?: CircleCenterTuple
  /** 半径（米），必填且 &gt; 0 */
  radius: number
  /** 起始方位角（度），自北顺时针 */
  startAzimuthDegrees: number
  /** 结束方位角（度），自北顺时针；可小于起始角，内部按跨越 360° 展开 */
  endAzimuthDegrees: number
  /** 圆弧分段数，越大弧边越平滑，默认 32 */
  arcSegments?: number
  style?: PolygonStyleOptions
  extrudedHeight?: number
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateSectorProperties {
  longitude?: number
  latitude?: number
  height?: number
  position?: CircleCenterInput
  center?: CircleCenterInput
  positions?: CircleCenterTuple
  radius?: number
  startAzimuthDegrees?: number
  endAzimuthDegrees?: number
  arcSegments?: number
  extrudedHeight?: number
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PolygonStyleOptions
}

export interface SectorSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  radius: number
  startAzimuthDegrees: number
  endAzimuthDegrees: number
  arcSegments: number
  extrudedHeight: number
  colorCss?: string
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

interface SectorRecord {
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

function toCartesian3(center: CircleCenterInput, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (center instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(center, result)
  }
  const h = center.height ?? 0
  return Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, h, undefined, result)
}

function centerFromTuple(t: CircleCenterTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  const h = t[2] ?? 0
  return Cesium.Cartesian3.fromDegrees(Number(t[0]), Number(t[1]), Number(h), undefined, result)
}

function resolveCenterCartesian(options: AddSectorOptions): Cesium.Cartesian3 | undefined {
  const n = [options.position, options.center, options.positions].filter((x) => x !== undefined).length
  if (n !== 1) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.center !== undefined) return toCartesian3(options.center)
  if (options.positions !== undefined && options.positions.length >= 2) {
    return centerFromTuple(options.positions)
  }
  return undefined
}

function resolveCenterFromUpdate(p: UpdateSectorProperties, prev: Cesium.Cartesian3 | undefined): Cesium.Cartesian3 | undefined {
  const n = [p.position, p.center, p.positions].filter((x) => x !== undefined).length
  if (n > 1) return undefined
  if (p.position !== undefined) return toCartesian3(p.position)
  if (p.center !== undefined) return toCartesian3(p.center)
  if (p.positions !== undefined && p.positions.length >= 2) return centerFromTuple(p.positions)
  if (p.longitude !== undefined && p.latitude !== undefined) {
    const h = p.height !== undefined ? p.height : prev ? Cesium.Cartographic.fromCartesian(prev).height : 0
    return Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h))
  }
  if (p.height !== undefined && prev) {
    const c = Cesium.Cartographic.fromCartesian(prev)
    return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, p.height)
  }
  return undefined
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

function readMaterialColor(polygon: Cesium.PolygonGraphics): Color | undefined {
  const mat = polygon.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function mergeSectorPolygonGraphics(
  pg: Cesium.PolygonGraphics,
  opts: {
    hierarchy: Cesium.PolygonHierarchy
    fillColor: Color
    showFill: boolean
    outline: boolean
    outlineColor: Color
    outlineWidth: number
    extrudedHeight?: number
    perPositionHeight: boolean
    style?: PolygonStyleOptions
  },
  isCreate: boolean,
): void {
  pg.hierarchy = new Cesium.ConstantProperty(opts.hierarchy)
  pg.fill = new Cesium.ConstantProperty(opts.showFill)
  pg.material = new Cesium.ColorMaterialProperty(opts.fillColor)
  pg.outline = new Cesium.ConstantProperty(opts.outline)
  pg.outlineColor = new Cesium.ConstantProperty(opts.outlineColor)
  pg.outlineWidth = new Cesium.ConstantProperty(opts.outlineWidth)
  pg.perPositionHeight = new Cesium.ConstantProperty(opts.perPositionHeight)

  if (opts.extrudedHeight !== undefined && Number.isFinite(opts.extrudedHeight) && opts.extrudedHeight !== 0) {
    pg.extrudedHeight = new Cesium.ConstantProperty(opts.extrudedHeight)
  } else {
    pg.extrudedHeight = undefined
  }

  const st = opts.style
  if (st?.arcType !== undefined) pg.arcType = new Cesium.ConstantProperty(st.arcType)
  else if (isCreate) pg.arcType = undefined
  if (st?.granularity !== undefined) pg.granularity = new Cesium.ConstantProperty(st.granularity)
  else if (isCreate) pg.granularity = undefined
  if (st?.shadows !== undefined) pg.shadows = new Cesium.ConstantProperty(st.shadows)
  if (st?.distanceDisplayCondition !== undefined) {
    pg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.classificationType !== undefined) {
    pg.classificationType = new Cesium.ConstantProperty(st.classificationType)
  }
  if (st?.zIndex !== undefined) pg.zIndex = new Cesium.ConstantProperty(st.zIndex)
}

function readCenterFromTargetData(td: Record<string, unknown>): { lon: number; lat: number; h: number } | undefined {
  const lon = Number(td.longitude)
  const lat = Number(td.latitude)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined
  const h = Number(td.height)
  return { lon, lat, h: Number.isFinite(h) ? h : 0 }
}

/**
 * 扇形（`Entity` + `PolygonGraphics` 近似扇面；方位角自北顺时针，度）。
 * 单例：各方法首参传入 `viewer`。
 */
export default class Sector {
  private readonly data = new Map<string, SectorRecord>()

  private isRecordAlive(rec: SectorRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): SectorRecord | undefined {
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

  add(viewer: Viewer, options: AddSectorOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('sec')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    const centerCart = resolveCenterCartesian(options)
    if (!centerCart) return undefined
    const carto = Cesium.Cartographic.fromCartesian(centerCart)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    const height = carto.height

    const radius = Number(options.radius)
    if (!Number.isFinite(radius) || radius <= 0) return undefined

    const startAz = Number(options.startAzimuthDegrees)
    const endAz = Number(options.endAzimuthDegrees)
    if (!Number.isFinite(startAz) || !Number.isFinite(endAz)) return undefined

    const arcSegments = options.arcSegments ?? 32

    const ringScratch: Cesium.Cartesian3[] = []
    const positions = computeSectorCartesianRing(lon, lat, height, radius, startAz, endAz, arcSegments, ringScratch)
    if (positions.length < 3) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const fillColor =
      toColor(options.color ?? '#3388ff', showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
    const outline = options.outline !== false
    const outlineColor =
      toColor(options.outlineColor ?? '#ffffff', options.outlineAlpha ?? 1) ?? Cesium.Color.WHITE
    const outlineWidth = options.outlineWidth ?? 2
    const perPositionHeight = options.style?.perPositionHeight !== false
    const extrudedHeight = options.extrudedHeight

    const polygon = new Cesium.PolygonGraphics()
    mergeSectorPolygonGraphics(
      polygon,
      {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        extrudedHeight,
        perPositionHeight,
        style: options.style,
      },
      true,
    )

    const entity = new Cesium.Entity({
      id,
      polygon,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const td = this.cloneTargetData(options.targetData)
    td.longitude = lon
    td.latitude = lat
    td.height = height
    td.radius = radius
    td.startAzimuthDegrees = startAz
    td.endAzimuthDegrees = endAz
    td.arcSegments = arcSegments
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

  addSectors(viewer: Viewer, items: AddSectorOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id.trim() : createRandomXgxId('sec')
        const e = this.add(viewer, { ...item, id })
        if (e) ids.push(id)
      } catch (e) {
        console.error(`[FastX.Draw.Sector] addSectors 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updateSector(id: string, properties: UpdateSectorProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData

    if (p.targetData !== undefined) Object.assign(td, p.targetData)

    const prevCenter = readCenterFromTargetData(td)
    const prevCart =
      prevCenter !== undefined
        ? Cesium.Cartesian3.fromDegrees(prevCenter.lon, prevCenter.lat, prevCenter.h)
        : undefined
    const nextCenterCart = resolveCenterFromUpdate(p, prevCart)
    if (nextCenterCart) {
      const c = Cesium.Cartographic.fromCartesian(nextCenterCart)
      td.longitude = Cesium.Math.toDegrees(c.longitude)
      td.latitude = Cesium.Math.toDegrees(c.latitude)
      td.height = c.height
    }

    if (p.radius !== undefined && Number.isFinite(p.radius) && p.radius > 0) td.radius = p.radius
    if (p.startAzimuthDegrees !== undefined && Number.isFinite(p.startAzimuthDegrees)) td.startAzimuthDegrees = p.startAzimuthDegrees
    if (p.endAzimuthDegrees !== undefined && Number.isFinite(p.endAzimuthDegrees)) td.endAzimuthDegrees = p.endAzimuthDegrees
    if (p.arcSegments !== undefined && Number.isFinite(p.arcSegments) && p.arcSegments >= 2) td.arcSegments = Math.floor(p.arcSegments)
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

    const geom = readCenterFromTargetData(td)
    if (!geom) return false
    const r = typeof td.radius === 'number' && td.radius > 0 ? td.radius : 0
    if (!r) return false
    const sa = Number(td.startAzimuthDegrees)
    const ea = Number(td.endAzimuthDegrees)
    if (!Number.isFinite(sa) || !Number.isFinite(ea)) return false
    const segs = typeof td.arcSegments === 'number' && td.arcSegments >= 2 ? Math.floor(td.arcSegments) : 32

    const ringScratch: Cesium.Cartesian3[] = []
    const positions = computeSectorCartesianRing(geom.lon, geom.lat, geom.h, r, sa, ea, segs, ringScratch)

    const pg = rec.entity.polygon ?? (rec.entity.polygon = new Cesium.PolygonGraphics())
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
    const perPositionHeight = (td.styleSnapshot as PolygonStyleOptions | undefined)?.perPositionHeight !== false

    mergeSectorPolygonGraphics(
      pg,
      {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        extrudedHeight: extruded,
        perPositionHeight,
        style: td.styleSnapshot as PolygonStyleOptions | undefined,
      },
      false,
    )

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updateSectors(updates: Array<{ id: string } & UpdateSectorProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateSector(id, rest) }))
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

  getSector(id: string): SectorSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec) return null
    const td = rec.targetData
    const g = readCenterFromTargetData(td)
    if (!g) return null
    const pg = rec.entity.polygon
    const fillCol = pg ? readMaterialColor(pg) : undefined
    const outline = pg ? sampleProperty<boolean>(pg.outline) : undefined
    const outlineColor = pg ? sampleProperty<Color>(pg.outlineColor) : undefined
    const outlineWidth = pg ? sampleProperty<number>(pg.outlineWidth) : undefined
    const extruded = pg ? sampleProperty<number>(pg.extrudedHeight) : undefined
    const desc = sampleProperty<string>(rec.entity.description)
    const rawShowFill = td.showFill

    return {
      id: rec.entity.id,
      longitude: g.lon,
      latitude: g.lat,
      height: g.h,
      radius: typeof td.radius === 'number' ? td.radius : 0,
      startAzimuthDegrees: Number(td.startAzimuthDegrees),
      endAzimuthDegrees: Number(td.endAzimuthDegrees),
      arcSegments: typeof td.arcSegments === 'number' ? Math.floor(td.arcSegments) : 32,
      extrudedHeight: typeof extruded === 'number' ? extruded : Number(td.extrudedHeight) || 0,
      colorCss: colorToCss(fillCol),
      showFill: typeof rawShowFill === 'boolean' ? rawShowFill : true,
      outline,
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      show: rec.entity.show,
      targetData: { ...td },
      description: desc,
    }
  }

  getAllSectors(viewer?: Viewer): SectorSnapshot[] {
    const out: SectorSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getSector(id)
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
