import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type { CircleCenterInput, CircleCenterTuple } from '../Circle'
import type { PolygonStyleOptions } from '../Polygon'
import { computeSectorCartesianRing, pointOnCircleAtAzimuth } from './sectorWedge'

import type { AddSectorOptions, SectorSnapshot, UpdateSectorProperties } from '../../Types'
import {
  clearAreaDraftTargetData,
  getDraftPoints,
  isAreaDraftTargetData,
  markAreaDraftTargetData,
  setDraftPoints,
  type AreaDraftPointsHolder,
} from '../../Utils/areaDraft'
import { bearingDegreesNorthClockwise } from '../../Utils/geoDraw'
export type { AddSectorOptions, SectorSnapshot, UpdateSectorProperties }

export type { PolygonStyleOptions as SectorStyleOptions } from '../Polygon'

interface SectorRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

function sectorGeomFromDraftPoints(pts: Cesium.Cartesian3[]): {
  center: Cesium.Cartesian3
  lon: number
  lat: number
  height: number
  radius: number
  startAz: number
  endAz: number
} {
  const center = pts[0] ?? Cesium.Cartesian3.ZERO
  const carto = Cesium.Cartographic.fromCartesian(center)
  const lon = Cesium.Math.toDegrees(carto.longitude)
  const lat = Cesium.Math.toDegrees(carto.latitude)
  const height = carto.height
  if (pts.length < 2) {
    return { center, lon, lat, height, radius: 0, startAz: 0, endAz: 0 }
  }
  const radius = Cesium.Cartesian3.distance(pts[0]!, pts[1]!)
  const startAz = bearingDegreesNorthClockwise(pts[0]!, pts[1]!)
  const endAz = pts.length >= 3 ? bearingDegreesNorthClockwise(pts[0]!, pts[2]!) : startAz
  return { center, lon, lat, height, radius, startAz, endAz }
}

function sectorDraftRing(
  pts: Cesium.Cartesian3[],
  arcSegments: number,
  out: Cesium.Cartesian3[],
): Cesium.Cartesian3[] {
  out.length = 0
  if (pts.length < 2) return out
  const center = pts[0]!
  if (pts.length === 2) {
    out.push(Cesium.Cartesian3.clone(center, new Cesium.Cartesian3()))
    out.push(Cesium.Cartesian3.clone(pts[1]!, new Cesium.Cartesian3()))
    return out
  }
  const radius = Cesium.Cartesian3.distance(center, pts[1]!)
  const startAz = bearingDegreesNorthClockwise(center, pts[1]!)
  const endAz = bearingDegreesNorthClockwise(center, pts[2]!)
  const carto = Cesium.Cartographic.fromCartesian(center)
  computeSectorCartesianRing(
    Cesium.Math.toDegrees(carto.longitude),
    Cesium.Math.toDegrees(carto.latitude),
    carto.height,
    radius,
    startAz,
    endAz,
    arcSegments,
    out,
  )
  if (out.length >= 2) {
    out[1] = Cesium.Cartesian3.clone(pts[1]!, out[1])
    const endOnArc = pointOnCircleAtAzimuth(center, radius, endAz)
    out[out.length - 1] = endOnArc
  }
  return out
}

function resolveSectorStyleFromTargetData(td: Record<string, unknown>): {
  showFill: boolean
  alpha: number
  fillColor: Color
  outline: boolean
  outlineColor: Color
  outlineWidth: number
  extruded?: number
  perPositionHeight: boolean
  style?: PolygonStyleOptions
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
  const perPositionHeight = (td.styleSnapshot as PolygonStyleOptions | undefined)?.perPositionHeight !== false
  return { showFill, alpha, fillColor, outline, outlineColor, outlineWidth, extruded, perPositionHeight, style: td.styleSnapshot as PolygonStyleOptions | undefined }
}

function applyAreaDraftGraphics(rec: SectorRecord): void {
  const st = resolveSectorStyleFromTargetData(rec.targetData)
  const td = rec.targetData
  const getPts = (): Cesium.Cartesian3[] => getDraftPoints(rec)
  const ringScratch: Cesium.Cartesian3[] = []

  const polygon = new Cesium.PolygonGraphics()
  polygon.hierarchy = new Cesium.CallbackProperty(() => {
    const pts = getPts()
    const segs = typeof td.arcSegments === 'number' && td.arcSegments >= 2 ? Math.floor(td.arcSegments) : 32
    const positions = sectorDraftRing(pts, segs, ringScratch)
    if (positions.length < 3) {
      const c = pts[0] ?? Cesium.Cartesian3.ZERO
      return new Cesium.PolygonHierarchy([c, c, c])
    }
    return new Cesium.PolygonHierarchy(positions)
  }, false)
  polygon.fill = new Cesium.ConstantProperty(st.showFill)
  polygon.material = new Cesium.ColorMaterialProperty(st.fillColor)
  polygon.outline = new Cesium.ConstantProperty(st.outline)
  polygon.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  polygon.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  polygon.perPositionHeight = new Cesium.ConstantProperty(st.perPositionHeight)
  if (st.extruded !== undefined) {
    polygon.extrudedHeight = new Cesium.ConstantProperty(st.extruded)
  }
  const style = st.style
  if (style?.arcType !== undefined) polygon.arcType = new Cesium.ConstantProperty(style.arcType)
  if (style?.granularity !== undefined) polygon.granularity = new Cesium.ConstantProperty(style.granularity)
  if (style?.shadows !== undefined) polygon.shadows = new Cesium.ConstantProperty(style.shadows)
  if (style?.distanceDisplayCondition !== undefined) {
    polygon.distanceDisplayCondition = new Cesium.ConstantProperty(style.distanceDisplayCondition)
  }
  if (style?.classificationType !== undefined) {
    polygon.classificationType = new Cesium.ConstantProperty(style.classificationType)
  }
  if (style?.zIndex !== undefined) polygon.zIndex = new Cesium.ConstantProperty(style.zIndex)

  rec.entity.polygon = polygon
}

function storeSectorGeomInTargetData(td: Record<string, unknown>, g: ReturnType<typeof sectorGeomFromDraftPoints>): void {
  td.longitude = g.lon
  td.latitude = g.lat
  td.height = g.height
  td.radius = g.radius
  td.startAzimuthDegrees = g.startAz
  td.endAzimuthDegrees = g.endAz
}

function commitAreaDraftRecord(rec: SectorRecord): boolean {
  const pts = getDraftPoints(rec)
  if (pts.length < 3) return false
  const g = sectorGeomFromDraftPoints(pts)
  if (!g.radius) return false
  const td = rec.targetData
  storeSectorGeomInTargetData(td, g)
  clearAreaDraftTargetData(td)
  rec.draftPoints = undefined

  const segs = typeof td.arcSegments === 'number' && td.arcSegments >= 2 ? Math.floor(td.arcSegments) : 32
  const ringScratch: Cesium.Cartesian3[] = []
  const positions = sectorDraftRing(pts, segs, ringScratch)
  if (positions.length < 3) return false

  const st = resolveSectorStyleFromTargetData(td)
  const pg = rec.entity.polygon ?? (rec.entity.polygon = new Cesium.PolygonGraphics())
  mergeSectorPolygonGraphics(
    pg,
    {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      fillColor: st.fillColor,
      showFill: st.showFill,
      outline: st.outline,
      outlineColor: st.outlineColor,
      outlineWidth: st.outlineWidth,
      extrudedHeight: st.extruded,
      perPositionHeight: st.perPositionHeight,
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
  if (options.areaDraft && options.center !== undefined) {
    return toCartesian3(options.center)
  }
  if (options.areaDraft && options.draftVertices !== undefined && options.draftVertices.length >= 1) {
    return toCartesian3(options.draftVertices[0]!)
  }
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
  if (p.areaDraft && p.center !== undefined) {
    return toCartesian3(p.center)
  }
  if (p.areaDraft && p.draftVertices !== undefined && p.draftVertices.length >= 1) {
    return toCartesian3(p.draftVertices[0]!)
  }
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

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

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

  private addAreaDraft(viewer: Viewer, id: string, options: AddSectorOptions): Entity | undefined {
    const centerCart = resolveCenterCartesian(options)
    if (!centerCart) return undefined

    const radius = Number(options.radius)
    const startAz = Number(options.startAzimuthDegrees)
    const endAz = Number(options.endAzimuthDegrees)
    const radiusHint = Number.isFinite(radius) && radius >= 0 ? radius : 0
    const startHint = Number.isFinite(startAz) ? startAz : 0
    const endHint = Number.isFinite(endAz) ? endAz : startHint

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false
    const extrudedHeight = options.extrudedHeight
    const arcSegments = options.arcSegments ?? 32

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    const carto = Cesium.Cartographic.fromCartesian(centerCart)
    td.longitude = Cesium.Math.toDegrees(carto.longitude)
    td.latitude = Cesium.Math.toDegrees(carto.latitude)
    td.height = carto.height
    td.radius = radiusHint
    td.startAzimuthDegrees = startHint
    td.endAzimuthDegrees = endHint
    td.arcSegments = arcSegments
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

    const rec: SectorRecord = { viewer, entity, targetData: td }
    if (options.draftVertices !== undefined && options.draftVertices.length >= 1) {
      const carts = options.draftVertices.map((v) => toCartesian3(v))
      setDraftPoints(rec, carts)
      td.radius = carts.length >= 2 ? Cesium.Cartesian3.distance(carts[0]!, carts[1]!) : 0
      if (carts.length >= 3) {
        td.startAzimuthDegrees = bearingDegreesNorthClockwise(carts[0]!, carts[1]!)
        td.endAzimuthDegrees = bearingDegreesNorthClockwise(carts[0]!, carts[2]!)
      } else {
        delete td.startAzimuthDegrees
        delete td.endAzimuthDegrees
      }
    } else {
      setDraftPoints(rec, [Cesium.Cartesian3.clone(centerCart)])
    }
    applyAreaDraftGraphics(rec)
    viewer.entities.add(entity)
    this.data.set(id, rec)
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

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      if (p.draftVertices !== undefined && p.draftVertices.length >= 1) {
        const carts = p.draftVertices.map((v) => toCartesian3(v))
        setDraftPoints(rec, carts)
        const center = carts[0]!
        const c = Cesium.Cartographic.fromCartesian(center)
        td.longitude = Cesium.Math.toDegrees(c.longitude)
        td.latitude = Cesium.Math.toDegrees(c.latitude)
        td.height = c.height
        td.radius = carts.length >= 2 ? Cesium.Cartesian3.distance(carts[0]!, carts[1]!) : 0
        if (carts.length >= 3) {
          td.startAzimuthDegrees = bearingDegreesNorthClockwise(carts[0]!, carts[1]!)
          td.endAzimuthDegrees = bearingDegreesNorthClockwise(carts[0]!, carts[2]!)
        }
      } else {
        const prevCenter = readCenterFromTargetData(td)
        const prevCart =
          prevCenter !== undefined
            ? Cesium.Cartesian3.fromDegrees(prevCenter.lon, prevCenter.lat, prevCenter.h)
            : undefined
        const nextCenterCart = resolveCenterFromUpdate(p, prevCart)
        if (nextCenterCart) {
          const pts = getDraftPoints(rec)
          if (pts.length) pts[0] = Cesium.Cartesian3.clone(nextCenterCart)
          else setDraftPoints(rec, [nextCenterCart])
        }
        if (p.radius !== undefined && Number.isFinite(p.radius) && p.radius > 0) td.radius = p.radius
        if (p.startAzimuthDegrees !== undefined) td.startAzimuthDegrees = p.startAzimuthDegrees
        if (p.endAzimuthDegrees !== undefined) td.endAzimuthDegrees = p.endAzimuthDegrees
      }
      return commitAreaDraftRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

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

  private applyStylePatchToTargetData(rec: SectorRecord, p: UpdateSectorProperties): void {
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
    if (p.arcSegments !== undefined && Number.isFinite(p.arcSegments) && p.arcSegments >= 2) {
      td.arcSegments = Math.floor(p.arcSegments)
    }
  }

  private syncSectorDraftPointsFromOptions(rec: SectorRecord, p: UpdateSectorProperties): void {
    const td = rec.targetData
    const prevCenter = readCenterFromTargetData(td)
    const prevCart =
      prevCenter !== undefined
        ? Cesium.Cartesian3.fromDegrees(prevCenter.lon, prevCenter.lat, prevCenter.h)
        : getDraftPoints(rec)[0]
    const nextCenterCart = resolveCenterFromUpdate(p, prevCart) ?? prevCart
    if (!nextCenterCart) return

    const pts: Cesium.Cartesian3[] = [Cesium.Cartesian3.clone(nextCenterCart)]
    const radius = typeof td.radius === 'number' && td.radius > 0 ? td.radius : 1
    const startAz = Number(td.startAzimuthDegrees)
    const endAz = Number(td.endAzimuthDegrees)
    const sa = Number.isFinite(startAz) ? startAz : 0
    const ea = Number.isFinite(endAz) ? endAz : sa + 45

    const carto = Cesium.Cartographic.fromCartesian(nextCenterCart)
    const rim1 = Cesium.Cartesian3.fromDegrees(
      Cesium.Math.toDegrees(carto.longitude) + (radius / 111320) * Math.sin(Cesium.Math.toRadians(sa)),
      Cesium.Math.toDegrees(carto.latitude) + (radius / 110540) * Math.cos(Cesium.Math.toRadians(sa)),
      carto.height,
    )
    pts.push(rim1)
    if (p.endAzimuthDegrees !== undefined || getDraftPoints(rec).length >= 3) {
      const rim2 = Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(carto.longitude) + (radius / 111320) * Math.sin(Cesium.Math.toRadians(ea)),
        Cesium.Math.toDegrees(carto.latitude) + (radius / 110540) * Math.cos(Cesium.Math.toRadians(ea)),
        carto.height,
      )
      pts.push(rim2)
    }
    setDraftPoints(rec, pts)
  }

  private updateAreaDraft(rec: SectorRecord, p: UpdateSectorProperties): boolean {
    const td = rec.targetData
    markAreaDraftTargetData(td)
    this.applyStylePatchToTargetData(rec, p)

    if (p.draftVertices !== undefined && p.draftVertices.length >= 1) {
      const carts = p.draftVertices.map((v) => toCartesian3(v))
      setDraftPoints(rec, carts)
      const center = carts[0]!
      const c = Cesium.Cartographic.fromCartesian(center)
      td.longitude = Cesium.Math.toDegrees(c.longitude)
      td.latitude = Cesium.Math.toDegrees(c.latitude)
      td.height = c.height
      td.radius = carts.length >= 2 ? Cesium.Cartesian3.distance(carts[0]!, carts[1]!) : 0
      if (carts.length >= 3) {
        td.startAzimuthDegrees = bearingDegreesNorthClockwise(carts[0]!, carts[1]!)
        td.endAzimuthDegrees = bearingDegreesNorthClockwise(carts[0]!, carts[2]!)
      } else {
        delete td.startAzimuthDegrees
        delete td.endAzimuthDegrees
      }
    } else {
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

      if (p.radius !== undefined && Number.isFinite(p.radius) && p.radius >= 0) td.radius = p.radius
      if (p.startAzimuthDegrees !== undefined && Number.isFinite(p.startAzimuthDegrees)) {
        td.startAzimuthDegrees = p.startAzimuthDegrees
      }
      if (p.endAzimuthDegrees !== undefined && Number.isFinite(p.endAzimuthDegrees)) {
        td.endAzimuthDegrees = p.endAzimuthDegrees
      }

      this.syncSectorDraftPointsFromOptions(rec, p)
    }

    applyAreaDraftGraphics(rec)
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
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
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
