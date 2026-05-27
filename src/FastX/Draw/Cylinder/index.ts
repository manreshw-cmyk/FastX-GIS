import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type {
  AddCylinderOptions,
  CylinderCenterInput,
  CylinderCenterTuple,
  CylinderSnapshot,
  CylinderStyleOptions,
  UpdateCylinderProperties,
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
  AddCylinderOptions,
  CylinderCenterInput,
  CylinderCenterTuple,
  CylinderSnapshot,
  CylinderStyleOptions,
  UpdateCylinderProperties,
}

interface CylinderRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

function resolveCylinderDraftCenter(options: AddCylinderOptions | UpdateCylinderProperties): Cesium.Cartesian3 | undefined {
  const explicitCount = [options.position, options.center, options.positions].filter((x) => x !== undefined).length
  if (explicitCount > 1) return undefined
  if (explicitCount === 1) {
    if (options.position !== undefined) return toCartesian3(options.position)
    if (options.center !== undefined) return toCartesian3(options.center)
    if (options.positions !== undefined && options.positions.length >= 1) {
      return centerFromTuple(options.positions)
    }
    return undefined
  }
  const p = options as UpdateCylinderProperties
  if (p.longitude !== undefined && p.latitude !== undefined) {
    const h = p.height !== undefined ? p.height : 0
    return Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h))
  }
  return undefined
}

function createDraftCylinderCenterProperty(getPoints: () => Cesium.Cartesian3[]): Cesium.PositionProperty {
  return new Cesium.CallbackPositionProperty(() => {
    const pts = getPoints()
    return pts.length ? Cesium.Cartesian3.clone(pts[0]!) : Cesium.Cartesian3.ZERO
  }, false)
}

function resolveCylinderStyleFromTargetData(td: Record<string, unknown>): {
  length: number
  topRadius: number
  bottomRadius: number
  showFill: boolean
  fillColor: Color
  outline: boolean
  outlineColor: Color
  outlineWidth: number
  style?: CylinderStyleOptions
} {
  const length = typeof td.length === 'number' && td.length > 0 ? td.length : 100
  const tr = typeof td.topRadius === 'number' ? td.topRadius : 50
  const br = typeof td.bottomRadius === 'number' ? td.bottomRadius : tr
  const showFill = td.showFill !== false
  const alpha = typeof td.alpha === 'number' ? td.alpha : 1
  const fillColor =
    toColor(String(td.color ?? '#3388ff'), showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
  const outline = td.outline !== false
  const outlineColor =
    toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
    Cesium.Color.WHITE
  const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
  return { length, topRadius: tr, bottomRadius: br, showFill, fillColor, outline, outlineColor, outlineWidth, style: td.styleSnapshot as CylinderStyleOptions | undefined }
}

function applyAreaDraftGraphics(rec: CylinderRecord, ellipsoid: Cesium.Ellipsoid): void {
  const st = resolveCylinderStyleFromTargetData(rec.targetData)
  const getPts = (): Cesium.Cartesian3[] => getDraftPoints(rec)
  const radiusProp = createDraftRadiusProperty(getPts)

  rec.entity.position = createDraftCylinderCenterProperty(getPts)

  const cg = new Cesium.CylinderGraphics()
  cg.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  cg.length = new Cesium.ConstantProperty(st.length)
  cg.topRadius = radiusProp
  cg.bottomRadius = radiusProp
  cg.fill = new Cesium.ConstantProperty(st.showFill)
  cg.material = new Cesium.ColorMaterialProperty(st.fillColor)
  cg.outline = new Cesium.ConstantProperty(st.outline)
  cg.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  cg.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  const style = st.style
  if (style?.slices !== undefined) cg.slices = new Cesium.ConstantProperty(style.slices)
  else cg.slices = new Cesium.ConstantProperty(32)
  if (style?.shadows !== undefined) cg.shadows = new Cesium.ConstantProperty(style.shadows)
  if (style?.distanceDisplayCondition !== undefined) {
    cg.distanceDisplayCondition = new Cesium.ConstantProperty(style.distanceDisplayCondition)
  }

  const center = getPts()[0]
  if (center) {
    const hd = typeof rec.targetData.headingDegrees === 'number' ? rec.targetData.headingDegrees : 0
    const pd = typeof rec.targetData.pitchDegrees === 'number' ? rec.targetData.pitchDegrees : 0
    const rd = typeof rec.targetData.rollDegrees === 'number' ? rec.targetData.rollDegrees : 0
    rec.entity.orientation = new Cesium.ConstantProperty(orientationFromHprDegrees(center, hd, pd, rd, ellipsoid))
  }

  rec.entity.cylinder = cg
}

function refreshAreaDraftStyle(rec: CylinderRecord): void {
  const st = resolveCylinderStyleFromTargetData(rec.targetData)
  const cg = rec.entity.cylinder
  if (!cg) return
  cg.length = new Cesium.ConstantProperty(st.length)
  cg.fill = new Cesium.ConstantProperty(st.showFill)
  cg.material = new Cesium.ColorMaterialProperty(st.fillColor)
  cg.outline = new Cesium.ConstantProperty(st.outline)
  cg.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  cg.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
}

function storeCylinderCenterInTargetData(td: Record<string, unknown>, center: Cesium.Cartesian3, ellipsoid: Cesium.Ellipsoid): void {
  const carto = Cesium.Cartographic.fromCartesian(center, ellipsoid)
  td.longitude = Cesium.Math.toDegrees(carto.longitude)
  td.latitude = Cesium.Math.toDegrees(carto.latitude)
  td.height = carto.height
}

function commitAreaDraftRecord(rec: CylinderRecord): boolean {
  const pts = getDraftPoints(rec)
  if (!pts.length) return false
  const center = pts[0]!
  const groundR = draftRadiusFromPoints(pts)
  if (!Number.isFinite(groundR) || groundR <= 0) return false

  const td = rec.targetData
  const len = typeof td.length === 'number' && td.length > 0 ? td.length : groundR
  td.length = len
  td.topRadius = groundR
  td.bottomRadius = groundR
  clearAreaDraftTargetData(td)
  rec.draftPoints = undefined

  const ellipsoid = rec.viewer.scene.globe.ellipsoid
  storeCylinderCenterInTargetData(td, center, ellipsoid)
  const st = resolveCylinderStyleFromTargetData(td)
  commitEntityPosition(rec.entity, center)
  rec.entity.orientation = new Cesium.ConstantProperty(
    orientationFromHprDegrees(
      center,
      typeof td.headingDegrees === 'number' ? td.headingDegrees : 0,
      typeof td.pitchDegrees === 'number' ? td.pitchDegrees : 0,
      typeof td.rollDegrees === 'number' ? td.rollDegrees : 0,
      ellipsoid,
    ),
  )
  const cg = rec.entity.cylinder ?? (rec.entity.cylinder = new Cesium.CylinderGraphics())
  mergeCylinderGraphics(
    cg,
    {
      length: len,
      topRadius: groundR,
      bottomRadius: groundR,
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

function toCartesian3(center: CylinderCenterInput, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (center instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(center, result)
  }
  const h = center.height ?? 0
  return Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, h, undefined, result)
}

function centerFromTuple(t: CylinderCenterTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  const h = t[2] ?? 0
  return Cesium.Cartesian3.fromDegrees(Number(t[0]), Number(t[1]), Number(h), undefined, result)
}

function resolveCenterCartesian(options: AddCylinderOptions): Cesium.Cartesian3 | undefined {
  const explicitCount = [options.position, options.center, options.positions].filter((x) => x !== undefined).length
  if (explicitCount > 1) return undefined
  if (explicitCount === 1) {
    if (options.position !== undefined) return toCartesian3(options.position)
    if (options.center !== undefined) return toCartesian3(options.center)
    if (options.positions !== undefined && options.positions.length >= 2) {
      return centerFromTuple(options.positions)
    }
    return undefined
  }
  const lng = options.longitude
  const lat = options.latitude
  if (lng !== undefined && lat !== undefined && Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))) {
    const hRaw = options.height
    const h =
      hRaw !== undefined && Number.isFinite(Number(hRaw)) ? Number(hRaw) : 0
    return Cesium.Cartesian3.fromDegrees(Number(lng), Number(lat), h)
  }
  return undefined
}

function resolveUpdateCenter(p: UpdateCylinderProperties): Cesium.Cartesian3 | undefined {
  if (p.position !== undefined) return toCartesian3(p.position)
  if (p.center !== undefined) return toCartesian3(p.center)
  if (p.positions !== undefined && p.positions.length >= 2) return centerFromTuple(p.positions)
  if (p.longitude !== undefined && p.latitude !== undefined) {
    const h = p.height !== undefined ? p.height : 0
    return Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h))
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

function readMaterialColor(cyl: Cesium.CylinderGraphics): Color | undefined {
  const mat = cyl.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function validRadii(top: number, bottom: number): boolean {
  return (top > 0 || bottom > 0) && top >= 0 && bottom >= 0
}

function mergeCylinderGraphics(
  cg: Cesium.CylinderGraphics,
  opts: {
    length: number
    topRadius: number
    bottomRadius: number
    fillColor: Color
    showFill: boolean
    outline: boolean
    outlineColor: Color
    outlineWidth: number
    style?: CylinderStyleOptions
  },
  isCreate: boolean,
): void {
  /** 相对椭球面绝对高，避免相对地形/地面参考把负高「吸」到地表 */
  cg.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  cg.length = new Cesium.ConstantProperty(opts.length)
  cg.topRadius = new Cesium.ConstantProperty(opts.topRadius)
  cg.bottomRadius = new Cesium.ConstantProperty(opts.bottomRadius)
  cg.fill = new Cesium.ConstantProperty(opts.showFill)
  cg.material = new Cesium.ColorMaterialProperty(opts.fillColor)
  cg.outline = new Cesium.ConstantProperty(opts.outline)
  cg.outlineColor = new Cesium.ConstantProperty(opts.outlineColor)
  cg.outlineWidth = new Cesium.ConstantProperty(opts.outlineWidth)

  const st = opts.style
  if (st?.slices !== undefined) cg.slices = new Cesium.ConstantProperty(st.slices)
  else if (isCreate) cg.slices = new Cesium.ConstantProperty(32)
  if (st?.shadows !== undefined) cg.shadows = new Cesium.ConstantProperty(st.shadows)
  if (st?.distanceDisplayCondition !== undefined) {
    cg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
}

function orientationFromHprDegrees(
  center: Cesium.Cartesian3,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
  ellipsoid: Cesium.Ellipsoid,
): Cesium.Quaternion {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(headingDeg),
    Cesium.Math.toRadians(pitchDeg),
    Cesium.Math.toRadians(rollDeg),
  )
  return Cesium.Transforms.headingPitchRollQuaternion(center, hpr, ellipsoid)
}

/**
 * 圆柱 / 圆锥（`Entity` + `CylinderGraphics`）。单例，首参传入 `viewer`。
 */
export default class Cylinder {
  private readonly data = new Map<string, CylinderRecord>()

  private isRecordAlive(rec: CylinderRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): CylinderRecord | undefined {
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

  add(viewer: Viewer, options: AddCylinderOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('cyl')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const center = resolveCenterCartesian(options)
    if (!center) return undefined

    const length = Number(options.length)
    const topR = Number(options.topRadius)
    const bottomR = Number(options.bottomRadius)
    if (!Number.isFinite(length) || length <= 0) return undefined
    if (!validRadii(topR, bottomR)) return undefined

    const hd = options.headingDegrees ?? 0
    const pd = options.pitchDegrees ?? 0
    const rd = options.rollDegrees ?? 0

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const fillColor =
      toColor(options.color ?? '#3388ff', showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
    const outline = options.outline !== false
    const outlineColor =
      toColor(options.outlineColor ?? '#ffffff', options.outlineAlpha ?? 1) ?? Cesium.Color.WHITE
    const outlineWidth = options.outlineWidth ?? 2

    const cylinder = new Cesium.CylinderGraphics()
    mergeCylinderGraphics(
      cylinder,
      {
        length,
        topRadius: topR,
        bottomRadius: bottomR,
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        style: options.style,
      },
      true,
    )

    const ellipsoid = viewer.scene.globe.ellipsoid
    const orientation = orientationFromHprDegrees(center, hd, pd, rd, ellipsoid)

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(center),
      orientation: new Cesium.ConstantProperty(orientation),
      cylinder,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const carto = Cesium.Cartographic.fromCartesian(center, ellipsoid)
    const td = this.cloneTargetData(options.targetData)
    td.longitude = Cesium.Math.toDegrees(carto.longitude)
    td.latitude = Cesium.Math.toDegrees(carto.latitude)
    td.height = carto.height
    td.length = length
    td.topRadius = topR
    td.bottomRadius = bottomR
    td.headingDegrees = hd
    td.pitchDegrees = pd
    td.rollDegrees = rd
    td.color = options.color ?? '#3388ff'
    td.alpha = alpha
    td.showFill = showFill
    td.outline = outline
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = outlineWidth
    if (options.style) td.styleSnapshot = { ...options.style }
    td.slices = options.style?.slices ?? 32

    this.data.set(id, { viewer, entity, targetData: td })
    return entity
  }

  private addAreaDraft(viewer: Viewer, id: string, options: AddCylinderOptions): Entity | undefined {
    const center = resolveCylinderDraftCenter(options)
    if (!center) return undefined

    const length = Number(options.length)
    const topR = Number(options.topRadius)
    const bottomR = Number(options.bottomRadius)
    const lenHint = Number.isFinite(length) && length > 0 ? length : 1
    const rHint =
      Number.isFinite(topR) && topR > 0
        ? topR
        : Number.isFinite(bottomR) && bottomR > 0
          ? bottomR
          : 1

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false
    const hd = options.headingDegrees ?? 0
    const pd = options.pitchDegrees ?? 0
    const rd = options.rollDegrees ?? 0
    const ellipsoid = viewer.scene.globe.ellipsoid

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    storeCylinderCenterInTargetData(td, center, ellipsoid)
    td.length = lenHint
    td.topRadius = rHint
    td.bottomRadius = rHint
    td.headingDegrees = hd
    td.pitchDegrees = pd
    td.rollDegrees = rd
    td.color = options.color ?? '#3388ff'
    td.alpha = alpha
    td.showFill = showFill
    td.outline = outline
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = options.outlineWidth ?? 2
    if (options.style) td.styleSnapshot = { ...options.style }
    td.slices = options.style?.slices ?? 32

    const entity = new Cesium.Entity({
      id,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    const rec: CylinderRecord = { viewer, entity, targetData: td }
    setDraftPoints(rec, [Cesium.Cartesian3.clone(center)])
    applyAreaDraftGraphics(rec, ellipsoid)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  addCylinders(viewer: Viewer, items: AddCylinderOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const rid = item.id?.trim() ? item.id.trim() : createRandomXgxId('cyl')
        const e = this.add(viewer, { ...item, id: rid })
        if (e) ids.push(rid)
      } catch (err) {
        console.error(`[FastX.Draw.Cylinder] addCylinders 第 ${i} 项失败:`, err)
      }
    }
    return ids
  }

  updateCylinder(id: string, properties: UpdateCylinderProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData
    const ellipsoid = rec.viewer.scene.globe.ellipsoid

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      const center = resolveCylinderDraftCenter(p) ?? getDraftPoints(rec)[0]
      if (center) {
        storeCylinderCenterInTargetData(td, center, ellipsoid)
        const pts = getDraftPoints(rec)
        if (pts.length) pts[0] = Cesium.Cartesian3.clone(center)
        else setDraftPoints(rec, [center])
      }
      if (p.topRadius !== undefined) td.topRadius = p.topRadius
      if (p.bottomRadius !== undefined) td.bottomRadius = p.bottomRadius
      return commitAreaDraftRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p, ellipsoid)
    }

    if (p.targetData !== undefined) Object.assign(td, p.targetData)

    const pos = resolveUpdateCenter(p)
    if (pos) {
      const carto = Cesium.Cartographic.fromCartesian(pos, ellipsoid)
      td.longitude = Cesium.Math.toDegrees(carto.longitude)
      td.latitude = Cesium.Math.toDegrees(carto.latitude)
      td.height = carto.height
      rec.entity.position = new Cesium.ConstantPositionProperty(pos)
    }

    if (p.length !== undefined) td.length = p.length
    if (p.topRadius !== undefined) td.topRadius = p.topRadius
    if (p.bottomRadius !== undefined) td.bottomRadius = p.bottomRadius
    if (p.headingDegrees !== undefined) td.headingDegrees = p.headingDegrees
    if (p.pitchDegrees !== undefined) td.pitchDegrees = p.pitchDegrees
    if (p.rollDegrees !== undefined) td.rollDegrees = p.rollDegrees

    if (p.color !== undefined) td.color = p.color instanceof Cesium.Color ? colorToCss(p.color) ?? String(p.color) : p.color
    if (p.alpha !== undefined) td.alpha = p.alpha
    if (p.showFill !== undefined) td.showFill = p.showFill
    if (p.outline !== undefined) td.outline = p.outline
    if (p.outlineColor !== undefined) {
      td.outlineColor = p.outlineColor instanceof Cesium.Color ? colorToCss(p.outlineColor) ?? String(p.outlineColor) : p.outlineColor
    }
    if (p.outlineAlpha !== undefined) td.outlineAlpha = p.outlineAlpha
    if (p.outlineWidth !== undefined) td.outlineWidth = p.outlineWidth
    if (p.style !== undefined) {
      td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style }
      if (p.style.slices !== undefined) td.slices = p.style.slices
    }

    const len = Number(td.length)
    const tr = Number(td.topRadius)
    const br = Number(td.bottomRadius)
    if (!Number.isFinite(len) || len <= 0 || !validRadii(tr, br)) return false

    const showFill = td.showFill !== false
    const alpha = typeof td.alpha === 'number' ? td.alpha : 1
    const fillColor =
      toColor(String(td.color ?? '#3388ff'), showFill ? alpha : 0) ?? Cesium.Color.BLUE.withAlpha(showFill ? alpha : 0)
    const outline = td.outline !== false
    const outlineColor =
      toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
      Cesium.Color.WHITE
    const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2

    const cg = rec.entity.cylinder ?? (rec.entity.cylinder = new Cesium.CylinderGraphics())
    mergeCylinderGraphics(
      cg,
      {
        length: len,
        topRadius: tr,
        bottomRadius: br,
        fillColor,
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        style: td.styleSnapshot as CylinderStyleOptions | undefined,
      },
      false,
    )

    const centerNow = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (centerNow) {
      const hd = typeof td.headingDegrees === 'number' ? td.headingDegrees : 0
      const pd = typeof td.pitchDegrees === 'number' ? td.pitchDegrees : 0
      const rd = typeof td.rollDegrees === 'number' ? td.rollDegrees : 0
      rec.entity.orientation = new Cesium.ConstantProperty(orientationFromHprDegrees(centerNow, hd, pd, rd, ellipsoid))
    }

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  private applyStylePatchToTargetData(rec: CylinderRecord, p: UpdateCylinderProperties): void {
    const td = rec.targetData
    if (p.targetData !== undefined) Object.assign(td, p.targetData)
    if (p.length !== undefined) td.length = p.length
    if (p.headingDegrees !== undefined) td.headingDegrees = p.headingDegrees
    if (p.pitchDegrees !== undefined) td.pitchDegrees = p.pitchDegrees
    if (p.rollDegrees !== undefined) td.rollDegrees = p.rollDegrees
    if (p.color !== undefined) td.color = p.color instanceof Cesium.Color ? colorToCss(p.color) ?? String(p.color) : p.color
    if (p.alpha !== undefined) td.alpha = p.alpha
    if (p.showFill !== undefined) td.showFill = p.showFill
    if (p.outline !== undefined) td.outline = p.outline
    if (p.outlineColor !== undefined) {
      td.outlineColor = p.outlineColor instanceof Cesium.Color ? colorToCss(p.outlineColor) ?? String(p.outlineColor) : p.outlineColor
    }
    if (p.outlineAlpha !== undefined) td.outlineAlpha = p.outlineAlpha
    if (p.outlineWidth !== undefined) td.outlineWidth = p.outlineWidth
    if (p.style !== undefined) {
      td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style }
      if (p.style.slices !== undefined) td.slices = p.style.slices
    }
  }

  private updateAreaDraft(rec: CylinderRecord, p: UpdateCylinderProperties, ellipsoid: Cesium.Ellipsoid): boolean {
    const td = rec.targetData
    markAreaDraftTargetData(td)
    this.applyStylePatchToTargetData(rec, p)

    const center = resolveCylinderDraftCenter(p) ?? getDraftPoints(rec)[0]
    if (center) {
      storeCylinderCenterInTargetData(td, center, ellipsoid)
      const pts = getDraftPoints(rec)
      const groundR =
        p.topRadius !== undefined && p.topRadius > 0
          ? p.topRadius
          : p.bottomRadius !== undefined && p.bottomRadius > 0
            ? p.bottomRadius
            : undefined
      if (pts.length >= 2) {
        pts[0] = Cesium.Cartesian3.clone(center)
        setDraftPoints(rec, pts)
      } else if (groundR !== undefined) {
        const carto = Cesium.Cartographic.fromCartesian(center, ellipsoid)
        const rim = Cesium.Cartesian3.fromRadians(
          carto.longitude + groundR / ellipsoid.maximumRadius,
          carto.latitude,
          carto.height,
          ellipsoid,
        )
        setDraftPoints(rec, [Cesium.Cartesian3.clone(center), rim])
        td.topRadius = groundR
        td.bottomRadius = groundR
      } else {
        setDraftPoints(rec, [Cesium.Cartesian3.clone(center)])
      }
    }

    refreshAreaDraftStyle(rec)
    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updateCylinders(updates: Array<{ id: string } & UpdateCylinderProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateCylinder(id, rest) }))
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

  getCylinder(id: string): CylinderSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos) return null
    const carto = Cesium.Cartographic.fromCartesian(pos, rec.viewer.scene.globe.ellipsoid)
    const cg = rec.entity.cylinder
    const fillCol = cg ? readMaterialColor(cg) : undefined
    const outline = cg ? sampleProperty<boolean>(cg.outline) : undefined
    const outlineColor = cg ? sampleProperty<Color>(cg.outlineColor) : undefined
    const outlineWidth = cg ? sampleProperty<number>(cg.outlineWidth) : undefined
    const length = cg ? sampleProperty<number>(cg.length) : undefined
    const topR = cg ? sampleProperty<number>(cg.topRadius) : undefined
    const bottomR = cg ? sampleProperty<number>(cg.bottomRadius) : undefined
    const desc = sampleProperty<string>(rec.entity.description)
    const rawShowFill = rec.targetData.showFill

    const fillAlpha =
      fillCol && typeof (fillCol as Color).alpha === 'number' && Number.isFinite((fillCol as Color).alpha)
        ? (fillCol as Color).alpha
        : undefined
    const outlineAlphaVal =
      outlineColor &&
      typeof (outlineColor as Color).alpha === 'number' &&
      Number.isFinite((outlineColor as Color).alpha)
        ? (outlineColor as Color).alpha
        : undefined

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      length: typeof length === 'number' ? length : Number(rec.targetData.length) || 0,
      topRadius: typeof topR === 'number' ? topR : Number(rec.targetData.topRadius) || 0,
      bottomRadius: typeof bottomR === 'number' ? bottomR : Number(rec.targetData.bottomRadius) || 0,
      headingDegrees: typeof rec.targetData.headingDegrees === 'number' ? rec.targetData.headingDegrees : 0,
      pitchDegrees: typeof rec.targetData.pitchDegrees === 'number' ? rec.targetData.pitchDegrees : 0,
      rollDegrees: typeof rec.targetData.rollDegrees === 'number' ? rec.targetData.rollDegrees : 0,
      colorCss: colorToCss(fillCol),
      fillAlpha,
      showFill: typeof rawShowFill === 'boolean' ? rawShowFill : true,
      outline,
      outlineColorCss: colorToCss(outlineColor),
      outlineAlpha: outlineAlphaVal,
      outlineWidth,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllCylinders(viewer?: Viewer): CylinderSnapshot[] {
    const out: CylinderSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getCylinder(id)
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
