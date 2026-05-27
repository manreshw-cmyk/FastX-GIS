import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId, type LngLatHeight } from '../../Coordinates'

import {
  AREA_DRAFT_TARGET_KEY,
  type AddPolygonOptions,
  type PolygonSnapshot,
  type PolygonStyleOptions,
  type UpdatePolygonProperties,
} from '../../Types'
export type { AddPolygonOptions, PolygonSnapshot, PolygonStyleOptions, UpdatePolygonProperties }
export { AREA_DRAFT_TARGET_KEY }

/** 多边形顶点：[经度, 纬度, 高度?]（度 / 米） */
export type PolygonLngLatTuple = readonly [lng: number, lat: number, height?: number]

/** 顶点：笛卡尔、经纬高对象或三元组 */
export type PolygonVertexInput = Cesium.Cartesian3 | LngLatHeight | PolygonLngLatTuple

interface PolygonRecord {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
  /** 空域草稿：动态外环（锚点 + 鼠标），由 CallbackProperty 读取 */
  draftRing?: Cesium.Cartesian3[]
}

function isAreaDraftTargetData(td: Record<string, unknown>): boolean {
  return td[AREA_DRAFT_TARGET_KEY] === true
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

function vertexToCartesian3(v: PolygonVertexInput, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (v instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(v, result)
  }
  if (Array.isArray(v)) {
    const h = v[2] ?? 0
    return Cesium.Cartesian3.fromDegrees(Number(v[0]), Number(v[1]), Number(h), undefined, result)
  }
  const p = v as { longitude: number; latitude: number; height?: number }
  const h = p.height ?? 0
  return Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, h, undefined, result)
}

function ringToCartesian3Array(
  ring: PolygonVertexInput[],
  minVertices = 3,
): Cesium.Cartesian3[] | undefined {
  if (!Array.isArray(ring) || ring.length < minVertices) return undefined
  return ring.map((p) => vertexToCartesian3(p))
}

function resolvePolygonStyleFromTargetData(td: Record<string, unknown>): {
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
  return {
    showFill,
    alpha,
    fillColor,
    outline,
    outlineColor,
    outlineWidth,
    extruded,
    perPositionHeight,
    style: td.styleSnapshot as PolygonStyleOptions | undefined,
  }
}

function draftPolylinePositions(ring: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  if (ring.length >= 2) return ring
  if (ring.length === 1) {
    const p = ring[0]!
    return [p, Cesium.Cartesian3.clone(p)]
  }
  return [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO]
}

function draftPolygonHierarchy(ring: Cesium.Cartesian3[]): Cesium.PolygonHierarchy {
  if (ring.length >= 3) return new Cesium.PolygonHierarchy(ring)
  if (ring.length === 2) {
    const a = ring[0]!
    const b = ring[1]!
    return new Cesium.PolygonHierarchy([a, b, Cesium.Cartesian3.clone(a)])
  }
  if (ring.length === 1) {
    const p = ring[0]!
    return new Cesium.PolygonHierarchy([p, Cesium.Cartesian3.clone(p), Cesium.Cartesian3.clone(p)])
  }
  const z = Cesium.Cartesian3.ZERO
  return new Cesium.PolygonHierarchy([z, z, z])
}

function applyAreaDraftGraphics(rec: PolygonRecord): void {
  const entity = rec.entity
  const st = resolvePolygonStyleFromTargetData(rec.targetData)
  const getRing = (): Cesium.Cartesian3[] => rec.draftRing ?? []

  entity.polyline = new Cesium.PolylineGraphics({
    positions: new Cesium.CallbackProperty(() => draftPolylinePositions(getRing()), false),
    width: new Cesium.ConstantProperty(Math.max(st.outlineWidth, 2)),
    material: new Cesium.ColorMaterialProperty(st.outlineColor),
    show: new Cesium.CallbackProperty(() => {
      const n = getRing().length
      return n > 0 && n < 3
    }, false),
  })

  const polygon = new Cesium.PolygonGraphics()
  polygon.hierarchy = new Cesium.CallbackProperty(() => draftPolygonHierarchy(getRing()), false)
  polygon.fill = new Cesium.ConstantProperty(st.showFill)
  polygon.material = new Cesium.ColorMaterialProperty(st.fillColor)
  polygon.outline = new Cesium.ConstantProperty(st.outline)
  polygon.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  polygon.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  polygon.perPositionHeight = new Cesium.ConstantProperty(st.perPositionHeight)
  polygon.show = new Cesium.CallbackProperty(() => getRing().length >= 3, false)
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

  entity.polygon = polygon
}

function refreshAreaDraftStyle(rec: PolygonRecord): void {
  if (!rec.draftRing) return
  const st = resolvePolygonStyleFromTargetData(rec.targetData)
  const pg = rec.entity.polygon
  const pl = rec.entity.polyline
  if (pg) {
    pg.fill = new Cesium.ConstantProperty(st.showFill)
    pg.material = new Cesium.ColorMaterialProperty(st.fillColor)
    pg.outline = new Cesium.ConstantProperty(st.outline)
    pg.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
    pg.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
    pg.perPositionHeight = new Cesium.ConstantProperty(st.perPositionHeight)
    if (st.extruded !== undefined) {
      pg.extrudedHeight = new Cesium.ConstantProperty(st.extruded)
    } else {
      pg.extrudedHeight = undefined
    }
  }
  if (pl) {
    pl.width = new Cesium.ConstantProperty(Math.max(st.outlineWidth, 2))
    pl.material = new Cesium.ColorMaterialProperty(st.outlineColor)
  }
}

function commitAreaDraftRecord(rec: PolygonRecord): boolean {
  const ring = ringToCartesian3Array(
    (rec.targetData.positions as number[][]).map(
      (t) => [Number(t[0]), Number(t[1]), Number(t[2] ?? 0)] as PolygonLngLatTuple,
    ),
    3,
  )
  if (!ring) return false

  const st = resolvePolygonStyleFromTargetData(rec.targetData)
  const pl = rec.entity.polyline
  if (pl) {
    pl.positions = new Cesium.ConstantProperty(ring)
    pl.show = new Cesium.ConstantProperty(false)
  }

  const pg = rec.entity.polygon ?? (rec.entity.polygon = new Cesium.PolygonGraphics())
  mergePolygonGraphics(
    pg,
    {
      hierarchy: new Cesium.PolygonHierarchy(ring),
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
  pg.show = new Cesium.ConstantProperty(rec.entity.show !== false)

  delete rec.targetData[AREA_DRAFT_TARGET_KEY]
  rec.draftRing = undefined
  // 仅隐藏草稿折线，勿置 undefined（否则下一帧 PolylineVisualizer 仍可能访问已释放几何）

  return true
}

/** `hierarchy` 采样失败时从 `targetData.positions` 还原外环 */
function positionsRingFromTargetData(td: Record<string, unknown>): number[][] {
  const raw = td.positions
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: number[][] = []
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue
    const a = row as unknown[]
    const lng = Number(a[0])
    const lat = Number(a[1])
    const h = row.length > 2 ? Number(a[2]) : 0
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      out.push([lng, lat, Number.isFinite(h) ? h : 0])
    }
  }
  return out
}

function ringToNumberTuples(ring: PolygonVertexInput[]): number[][] {
  const out: number[][] = []
  for (const v of ring) {
    if (v instanceof Cesium.Cartesian3) {
      const c = Cesium.Cartographic.fromCartesian(v)
      out.push([
        Cesium.Math.toDegrees(c.longitude),
        Cesium.Math.toDegrees(c.latitude),
        c.height,
      ])
    } else if (Array.isArray(v)) {
      out.push([Number(v[0]), Number(v[1]), Number(v[2] ?? 0)])
    } else {
      const p = v as { longitude: number; latitude: number; height?: number }
      out.push([p.longitude, p.latitude, p.height ?? 0])
    }
  }
  return out
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

function mergePolygonGraphics(
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

/**
 * 多边形（`Entity` + `PolygonGraphics`）。
 * 单例：各方法首参传入 `viewer`，内部 `Map<id, record>`。
 */
export default class Polygon {
  private readonly data = new Map<string, PolygonRecord>()

  private isRecordAlive(rec: PolygonRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): PolygonRecord | undefined {
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

  add(viewer: Viewer, options: AddPolygonOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('poly')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const cartesianRing = ringToCartesian3Array(options.positions)
    if (!cartesianRing) return undefined

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
    mergePolygonGraphics(
      polygon,
      {
        hierarchy: new Cesium.PolygonHierarchy(cartesianRing),
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
    td.positions = ringToNumberTuples(options.positions)
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

  private addAreaDraft(viewer: Viewer, id: string, options: AddPolygonOptions): Entity | undefined {
    const cartesianRing = ringToCartesian3Array(options.positions, 1)
    if (!cartesianRing) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false
    const extrudedHeight = options.extrudedHeight

    const td = this.cloneTargetData(options.targetData)
    td[AREA_DRAFT_TARGET_KEY] = true
    td.positions = ringToNumberTuples(options.positions)
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

    const rec: PolygonRecord = {
      viewer,
      entity,
      targetData: td,
      draftRing: cartesianRing.map((c) => Cesium.Cartesian3.clone(c)),
    }
    applyAreaDraftGraphics(rec)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  addPolygons(viewer: Viewer, items: AddPolygonOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id.trim() : createRandomXgxId('poly')
        const e = this.add(viewer, { ...item, id })
        if (e) ids.push(id)
      } catch (e) {
        console.error(`[FastX.Draw.Polygon] addPolygons 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updatePolygon(id: string, properties: UpdatePolygonProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      if (p.positions !== undefined) {
        const ring = ringToCartesian3Array(p.positions, 3)
        if (!ring) return false
        td.positions = ringToNumberTuples(p.positions)
      }
      return commitAreaDraftRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

    if (p.targetData !== undefined) Object.assign(td, p.targetData)

    if (p.positions !== undefined) {
      const ring = ringToCartesian3Array(p.positions)
      if (!ring) return false
      td.positions = ringToNumberTuples(p.positions)
    }

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

    const pg = rec.entity.polygon ?? (rec.entity.polygon = new Cesium.PolygonGraphics())
    const needRebuildHierarchy = p.positions !== undefined

    const positionsNums = td.positions as number[][] | undefined
    const ringCartesian =
      needRebuildHierarchy && positionsNums
        ? ringToCartesian3Array(
            positionsNums.map((t) => [Number(t[0]), Number(t[1]), Number(t[2] ?? 0)] as PolygonLngLatTuple),
          )
        : undefined

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

    const needPolygon =
      needRebuildHierarchy ||
      p.extrudedHeight !== undefined ||
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.showFill !== undefined ||
      p.outline !== undefined ||
      p.outlineColor !== undefined ||
      p.outlineAlpha !== undefined ||
      p.outlineWidth !== undefined ||
      p.style !== undefined

    if (needPolygon) {
      let hierarchy: Cesium.PolygonHierarchy | undefined
      if (ringCartesian) {
        hierarchy = new Cesium.PolygonHierarchy(ringCartesian)
      } else {
        const h0 = sampleProperty<Cesium.PolygonHierarchy>(pg.hierarchy)
        if (!h0?.positions?.length) return false
        hierarchy = h0
      }
      mergePolygonGraphics(
        pg,
        {
          hierarchy,
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
    }

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  private applyStylePatchToTargetData(rec: PolygonRecord, p: UpdatePolygonProperties): void {
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

  private updateAreaDraft(rec: PolygonRecord, p: UpdatePolygonProperties): boolean {
    const td = rec.targetData
    td[AREA_DRAFT_TARGET_KEY] = true
    this.applyStylePatchToTargetData(rec, p)

    if (p.positions !== undefined) {
      const ring = ringToCartesian3Array(p.positions, 1)
      if (!ring) return false
      rec.draftRing = ring
      td.positions = ringToNumberTuples(p.positions)
    }

    refreshAreaDraftStyle(rec)

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updatePolygons(updates: Array<{ id: string } & UpdatePolygonProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updatePolygon(id, rest) }))
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

  getPolygon(id: string): PolygonSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const pg = rec.entity.polygon
    const hier = pg ? sampleProperty<Cesium.PolygonHierarchy>(pg.hierarchy) : undefined
    const positions: number[][] = []
    if (hier?.positions?.length) {
      for (const c of hier.positions) {
        const carto = Cesium.Cartographic.fromCartesian(c)
        positions.push([
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height,
        ])
      }
    }
    if (positions.length === 0) {
      for (const row of positionsRingFromTargetData(rec.targetData)) positions.push(row)
    }
    const fillCol = pg ? readMaterialColor(pg) : undefined
    const outline = pg ? sampleProperty<boolean>(pg.outline) : undefined
    const outlineColor = pg ? sampleProperty<Color>(pg.outlineColor) : undefined
    const outlineWidth = pg ? sampleProperty<number>(pg.outlineWidth) : undefined
    const extruded = pg ? sampleProperty<number>(pg.extrudedHeight) : undefined
    const desc = sampleProperty<string>(rec.entity.description)
    const rawShowFill = rec.targetData.showFill

    return {
      id: rec.entity.id,
      positions,
      vertexCount: positions.length,
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

  getAllPolygons(viewer?: Viewer): PolygonSnapshot[] {
    const out: PolygonSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getPolygon(id)
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

  getIds(viewer?: Viewer, opts?: { includeDraft?: boolean }): string[] {
    const out: string[] = []
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      if (!opts?.includeDraft && isAreaDraftTargetData(rec.targetData)) continue
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
