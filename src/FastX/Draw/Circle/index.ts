import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import {
  AREA_DRAFT_TARGET_KEY,
  type AddCircleOptions,
  type CircleCenterInput,
  type CircleCenterTuple,
  type CircleSnapshot,
  type CircleStyleOptions,
  type UpdateCircleProperties,
} from '../../Types'
import {
  clearAreaDraftTargetData,
  commitEntityPosition,
  createDraftRadiusProperty,
  draftRadiusFromPoints,
  getDraftPoints,
  isAreaDraftTargetData,
  markAreaDraftTargetData,
  setDraftPoints,
  type AreaDraftPointsHolder,
} from '../../Utils/areaDraft'
export type {
  AddCircleOptions,
  CircleCenterInput,
  CircleCenterTuple,
  CircleSnapshot,
  CircleStyleOptions,
  UpdateCircleProperties,
}

interface CircleRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

function createDraftCircleCenterProperty(getPoints: () => Cesium.Cartesian3[]): Cesium.PositionProperty {
  return new Cesium.CallbackPositionProperty(() => {
    const pts = getPoints()
    return pts.length ? Cesium.Cartesian3.clone(pts[0]!) : Cesium.Cartesian3.ZERO
  }, false)
}

function resolveCircleDraftCenter(options: AddCircleOptions | UpdateCircleProperties): Cesium.Cartesian3 | undefined {
  if (options.areaDraft && options.center !== undefined) {
    return toCartesian3(options.center)
  }
  if (options.areaDraft && options.draftVertices !== undefined && options.draftVertices.length >= 1) {
    return toCartesian3(options.draftVertices[0]!)
  }
  const n = [options.position, options.center, options.positions].filter((x) => x !== undefined).length
  if (n > 1) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.center !== undefined) return toCartesian3(options.center)
  if (options.positions !== undefined && options.positions.length >= 1) {
    return centerFromTuple(options.positions)
  }
  const p = options as UpdateCircleProperties
  if (p.longitude !== undefined && p.latitude !== undefined) {
    const h = p.height !== undefined ? p.height : 0
    return Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h))
  }
  return undefined
}

function syncCircleDraftPoints(rec: CircleRecord, center: Cesium.Cartesian3, rim?: Cesium.Cartesian3): void {
  const pts: Cesium.Cartesian3[] = [Cesium.Cartesian3.clone(center)]
  if (rim) pts.push(Cesium.Cartesian3.clone(rim))
  setDraftPoints(rec, pts)
}

function setCircleDraftFromVertices(
  rec: CircleRecord,
  td: Record<string, unknown>,
  vertices: readonly { longitude: number; latitude: number; height?: number }[],
): void {
  const carts = vertices.map((p) => toCartesian3(p))
  if (!carts.length) return
  setDraftPoints(rec, carts)
  storeCircleCenterInTargetData(td, carts[0]!)
  td.radius = carts.length >= 2 ? Cesium.Cartesian3.distance(carts[0]!, carts[1]!) : 0
}

function resolveCircleStyleFromTargetData(td: Record<string, unknown>): {
  showFill: boolean
  alpha: number
  fillColor: Color
  outline: boolean
  outlineColor: Color
  outlineWidth: number
  style?: CircleStyleOptions
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
  return { showFill, alpha, fillColor, outline, outlineColor, outlineWidth, style: td.styleSnapshot as CircleStyleOptions | undefined }
}

function applyAreaDraftGraphics(rec: CircleRecord): void {
  const entity = rec.entity
  const st = resolveCircleStyleFromTargetData(rec.targetData)
  const getPts = (): Cesium.Cartesian3[] => getDraftPoints(rec)

  entity.position = createDraftCircleCenterProperty(getPts)

  const ellipse = new Cesium.EllipseGraphics()
  ellipse.semiMajorAxis = createDraftRadiusProperty(getPts)
  ellipse.semiMinorAxis = createDraftRadiusProperty(getPts)
  ellipse.fill = new Cesium.ConstantProperty(st.showFill)
  ellipse.material = new Cesium.ColorMaterialProperty(st.fillColor)
  ellipse.outline = new Cesium.ConstantProperty(st.outline)
  ellipse.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  ellipse.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  ellipse.height = new Cesium.ConstantProperty(st.style?.ellipseHeight ?? 0)
  const style = st.style
  if (style?.heightReference !== undefined) {
    ellipse.heightReference = new Cesium.ConstantProperty(style.heightReference)
  }
  if (style?.rotation !== undefined) ellipse.rotation = new Cesium.ConstantProperty(style.rotation)
  if (style?.granularity !== undefined) {
    ellipse.granularity = new Cesium.ConstantProperty(style.granularity)
  } else {
    ellipse.granularity = new Cesium.ConstantProperty(Cesium.Math.toRadians(0.35))
  }
  if (style?.shadows !== undefined) ellipse.shadows = new Cesium.ConstantProperty(style.shadows)
  if (style?.distanceDisplayCondition !== undefined) {
    ellipse.distanceDisplayCondition = new Cesium.ConstantProperty(style.distanceDisplayCondition)
  }
  if (style?.classificationType !== undefined) {
    ellipse.classificationType = new Cesium.ConstantProperty(style.classificationType)
  }
  if (style?.zIndex !== undefined) ellipse.zIndex = new Cesium.ConstantProperty(style.zIndex)

  entity.ellipse = ellipse
}

function refreshAreaDraftStyle(rec: CircleRecord): void {
  const st = resolveCircleStyleFromTargetData(rec.targetData)
  const eg = rec.entity.ellipse
  if (!eg) return
  eg.fill = new Cesium.ConstantProperty(st.showFill)
  eg.material = new Cesium.ColorMaterialProperty(st.fillColor)
  eg.outline = new Cesium.ConstantProperty(st.outline)
  eg.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  eg.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
}

function storeCircleCenterInTargetData(td: Record<string, unknown>, center: Cesium.Cartesian3): void {
  const carto = Cesium.Cartographic.fromCartesian(center)
  td.longitude = Cesium.Math.toDegrees(carto.longitude)
  td.latitude = Cesium.Math.toDegrees(carto.latitude)
  td.height = carto.height
}

function commitAreaDraftRecord(rec: CircleRecord): boolean {
  const pts = getDraftPoints(rec)
  if (!pts.length) return false
  const center = pts[0]!
  const radius = draftRadiusFromPoints(pts)
  if (!Number.isFinite(radius) || radius <= 0) return false

  const td = rec.targetData
  td.radius = radius
  storeCircleCenterInTargetData(td, center)
  clearAreaDraftTargetData(td)
  rec.draftPoints = undefined

  const st = resolveCircleStyleFromTargetData(td)
  commitEntityPosition(rec.entity, center)
  const eg = rec.entity.ellipse ?? (rec.entity.ellipse = new Cesium.EllipseGraphics())
  mergeEllipseGraphics(
    eg,
    {
      radius,
      fillColor: st.fillColor,
      showFill: st.showFill,
      outline: st.outline,
      outlineColor: st.outlineColor,
      outlineWidth: st.outlineWidth,
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

function resolveCenterCartesian(options: AddCircleOptions): Cesium.Cartesian3 | undefined {
  const n = [options.position, options.center, options.positions].filter((x) => x !== undefined).length
  if (n !== 1) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.center !== undefined) return toCartesian3(options.center)
  if (options.positions !== undefined && options.positions.length >= 2) {
    return centerFromTuple(options.positions)
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

function readMaterialColor(ellipse: Cesium.EllipseGraphics): Color | undefined {
  const mat = ellipse.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function mergeEllipseGraphics(
  eg: Cesium.EllipseGraphics,
  opts: {
    radius: number
    fillColor: Color
    showFill: boolean
    outline: boolean
    outlineColor: Color
    outlineWidth: number
    style?: CircleStyleOptions
  },
  isCreate: boolean,
): void {
  const r = Math.max(1e-3, opts.radius)
  eg.semiMajorAxis = new Cesium.ConstantProperty(r)
  eg.semiMinorAxis = new Cesium.ConstantProperty(r)

  eg.fill = new Cesium.ConstantProperty(opts.showFill)
  eg.material = new Cesium.ColorMaterialProperty(opts.fillColor)

  eg.outline = new Cesium.ConstantProperty(opts.outline)
  eg.outlineColor = new Cesium.ConstantProperty(opts.outlineColor)
  eg.outlineWidth = new Cesium.ConstantProperty(opts.outlineWidth)

  const st = opts.style
  /** 必须给出 `ellipse.height`，否则 Cesium 在 fill 开启时判为贴地几何并禁用轮廓线 */
  eg.height = new Cesium.ConstantProperty(st?.ellipseHeight ?? 0)

  if (st?.heightReference !== undefined) {
    eg.heightReference = new Cesium.ConstantProperty(st.heightReference)
  } else if (isCreate) {
    eg.heightReference = undefined
  }
  if (st?.rotation !== undefined) eg.rotation = new Cesium.ConstantProperty(st.rotation)
  if (st?.granularity !== undefined) {
    eg.granularity = new Cesium.ConstantProperty(st.granularity)
  } else if (isCreate) {
    /** 略加密轮廓细分，减轻大半径圆在屏幕上的锯齿感（仍受 MSAA / 分辨率影响） */
    eg.granularity = new Cesium.ConstantProperty(Cesium.Math.toRadians(0.35))
  }
  if (st?.shadows !== undefined) eg.shadows = new Cesium.ConstantProperty(st.shadows)
  if (st?.distanceDisplayCondition !== undefined) {
    eg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.classificationType !== undefined) {
    eg.classificationType = new Cesium.ConstantProperty(st.classificationType)
  }
  if (st?.zIndex !== undefined) eg.zIndex = new Cesium.ConstantProperty(st.zIndex)
}

/**
 * 圆（`Entity` + `EllipseGraphics`，长短轴相等）。
 * 单例：各方法首参传入 `viewer`，内部 `Map<id, record>`。
 */
export default class Circle {
  private readonly data = new Map<string, CircleRecord>()

  private isRecordAlive(rec: CircleRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): CircleRecord | undefined {
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

  add(viewer: Viewer, options: AddCircleOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id : createRandomXgxId('cir')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const center = resolveCenterCartesian(options)
    if (!center) return undefined
    const radius = Number(options.radius)
    if (!Number.isFinite(radius) || radius <= 0) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const fillColor = toColor(options.color ?? '#3388ff', showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
    const outline = options.outline !== false
    const outlineColor =
      toColor(options.outlineColor ?? '#ffffff', options.outlineAlpha ?? 1) ?? Cesium.Color.WHITE
    const outlineWidth = options.outlineWidth ?? 2

    const ellipse = new Cesium.EllipseGraphics()
    mergeEllipseGraphics(
      ellipse,
      {
        radius,
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        style: options.style,
      },
      true,
    )

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(center),
      ellipse,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const td = this.cloneTargetData(options.targetData)
    td.radius = radius
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

  private addAreaDraft(viewer: Viewer, id: string, options: AddCircleOptions): Entity | undefined {
    const center = resolveCircleDraftCenter(options)
    if (!center) return undefined
    const radius = Number(options.radius)
    const radiusHint = Number.isFinite(radius) && radius >= 0 ? radius : 0

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    td.radius = radiusHint
    storeCircleCenterInTargetData(td, center)
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

    const rec: CircleRecord = { viewer, entity, targetData: td }
    if (options.draftVertices !== undefined && options.draftVertices.length >= 1) {
      setCircleDraftFromVertices(rec, td, options.draftVertices)
    } else {
      syncCircleDraftPoints(rec, center)
    }
    applyAreaDraftGraphics(rec)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  addCircles(viewer: Viewer, items: AddCircleOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id : createRandomXgxId('cir')
        const e = this.add(viewer, { ...item, id })
        if (e) ids.push(id)
      } catch (e) {
        console.error(`[FastX.Draw.Circle] addCircles 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updateCircle(id: string, properties: UpdateCircleProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      const center = resolveCircleDraftCenter(p) ?? getDraftPoints(rec)[0]
      if (center) storeCircleCenterInTargetData(td, center)
      if (p.draftVertices !== undefined && p.draftVertices.length >= 1) {
        setCircleDraftFromVertices(rec, td, p.draftVertices)
      } else if (center) {
        const existing = getDraftPoints(rec)
        syncCircleDraftPoints(rec, center, existing.length >= 2 ? existing[1] : undefined)
      }
      return commitAreaDraftRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

    if (p.targetData !== undefined) Object.assign(td, p.targetData)

    if (p.longitude !== undefined && p.latitude !== undefined) {
      const prev = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
      const h =
        p.height !== undefined
          ? p.height
          : prev
            ? Cesium.Cartographic.fromCartesian(prev).height
            : 0
      rec.entity.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h)),
      )
    } else if (p.height !== undefined) {
      const prev = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
      if (!prev) return false
      const c = Cesium.Cartographic.fromCartesian(prev)
      rec.entity.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, p.height),
      )
    } else if (p.position !== undefined) {
      rec.entity.position = new Cesium.ConstantPositionProperty(toCartesian3(p.position))
    } else if (p.positions !== undefined && p.positions.length >= 2) {
      rec.entity.position = new Cesium.ConstantPositionProperty(centerFromTuple(p.positions))
    }

    if (p.radius !== undefined && Number.isFinite(p.radius) && p.radius > 0) {
      td.radius = p.radius
    }

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

    const needEllipse =
      p.radius !== undefined ||
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.showFill !== undefined ||
      p.outline !== undefined ||
      p.outlineColor !== undefined ||
      p.outlineAlpha !== undefined ||
      p.outlineWidth !== undefined ||
      p.style !== undefined

    if (needEllipse) {
      const eg = rec.entity.ellipse ?? (rec.entity.ellipse = new Cesium.EllipseGraphics())
      const r = typeof td.radius === 'number' && td.radius > 0 ? td.radius : 100
      const showFill = td.showFill !== false
      const alpha = typeof td.alpha === 'number' ? td.alpha : 1
      const fillColor = toColor(String(td.color ?? '#3388ff'), showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
      const outline = td.outline !== false
      const outlineColor =
        toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
        Cesium.Color.WHITE
      const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
      mergeEllipseGraphics(
        eg,
        {
          radius: r,
          fillColor,
          showFill,
          outline,
          outlineColor,
          outlineWidth,
          style: td.styleSnapshot as CircleStyleOptions | undefined,
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

  private applyStylePatchToTargetData(rec: CircleRecord, p: UpdateCircleProperties): void {
    const td = rec.targetData
    if (p.targetData !== undefined) Object.assign(td, p.targetData)
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

  private updateAreaDraft(rec: CircleRecord, p: UpdateCircleProperties): boolean {
    const td = rec.targetData
    markAreaDraftTargetData(td)
    this.applyStylePatchToTargetData(rec, p)

    if (p.draftVertices !== undefined && p.draftVertices.length >= 1) {
      setCircleDraftFromVertices(rec, td, p.draftVertices)
    } else {
      const prev = getDraftPoints(rec)[0]
      const center = resolveCircleDraftCenter(p) ?? prev
      if (center) {
        storeCircleCenterInTargetData(td, center)
        if (p.radius !== undefined && Number.isFinite(p.radius) && p.radius >= 0) {
          td.radius = p.radius
        }
        const existing = getDraftPoints(rec)
        const rim = existing.length >= 2 ? existing[1] : undefined
        syncCircleDraftPoints(rec, center, rim)
      }
    }

    applyAreaDraftGraphics(rec)
    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updateCircles(updates: Array<{ id: string } & UpdateCircleProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateCircle(id, rest) }))
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

  getCircle(id: string): CircleSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos) return null
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const eg = rec.entity.ellipse
    const semi = eg ? sampleProperty<number>(eg.semiMajorAxis) : undefined
    const radius = typeof semi === 'number' && semi > 0 ? semi : Number(rec.targetData.radius) || 0
    const fillCol = eg ? readMaterialColor(eg) : undefined
    const outline = eg ? sampleProperty<boolean>(eg.outline) : undefined
    const outlineColor = eg ? sampleProperty<Color>(eg.outlineColor) : undefined
    const outlineWidth = eg ? sampleProperty<number>(eg.outlineWidth) : undefined
    const desc = sampleProperty<string>(rec.entity.description)
    const rawShowFill = rec.targetData.showFill

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      radius,
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

  getAllCircles(viewer?: Viewer): CircleSnapshot[] {
    const out: CircleSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getCircle(id)
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

export type {
  CircleCollectionAddItem,
  CircleCollectionSnapshot,
  CircleCollectionUpdateEntry,
  CircleCollectionUpdateOptions,
} from './CircleCollection'
