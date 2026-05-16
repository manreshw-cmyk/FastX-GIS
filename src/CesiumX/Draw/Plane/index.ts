import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId, type LngLatHeight } from '../../Coordinates'

/** 平面中心：[经度, 纬度, 高度?]（度 / 米） */
export type PlanePositionsTuple = readonly [lng: number, lat: number, height?: number]

export type PlaneCenterInput = Cesium.Cartesian3 | LngLatHeight

export interface PlaneStyleOptions {
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

/**
 * 添加平面（`Entity` + `PlaneGraphics`）。
 * - 中心：`position` 或 `positions`（`[lng,lat,h?]`）二选一。
 * - `dimensions`：平面宽、高（米），默认 `200×200`；平面默认落在 ENU 的东–北水平面，法向朝上。
 * - `headingDegrees` / `pitchDegrees` / `rollDegrees`：相对 ENU 的姿态（度）。
 */
export interface AddPlaneOptions {
  id?: string
  position?: PlaneCenterInput
  positions?: PlanePositionsTuple
  /** 平面宽、高（米） */
  dimensions?: { width: number; height: number }
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  style?: PlaneStyleOptions
  color?: string
  alpha?: number
  fill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdatePlaneProperties {
  longitude?: number
  latitude?: number
  height?: number
  position?: PlaneCenterInput
  positions?: PlanePositionsTuple
  dimensions?: { width: number; height: number }
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  color?: string | Color
  alpha?: number
  fill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PlaneStyleOptions
}

export interface PlaneSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  width: number
  planeHeight: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  colorCss?: string
  fill?: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

interface PlaneRecord {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

const DEFAULT_COLOR = '#00bcd4'
const DEFAULT_OUTLINE = '#ffffff'
const DEFAULT_DIM = { width: 200, height: 200 }

function finiteOr(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(x) ? x : fallback
}

/** 椭球上局部 ENU 姿态换算需要有限位置与非退化四元数，否则 Cesium 会抛 DeveloperError。 */
function isFiniteCartesian3(c: Cesium.Cartesian3 | undefined): c is Cesium.Cartesian3 {
  if (!c) return false
  return Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)
}

/** 从 Entity 模型矩阵安全提取 HPR（Cesium 1.140+ 使用 `fixedFrameToHeadingPitchRoll(transform)`）。 */
const scratchModelMatrix = new Cesium.Matrix4()

function safeEntityHeadingPitchRoll(
  entity: Entity,
  time: Cesium.JulianDate = Cesium.JulianDate.now(),
): Cesium.HeadingPitchRoll | undefined {
  try {
    const mm = entity.computeModelMatrix(time, scratchModelMatrix)
    if (!mm) return undefined
    const hpr = Cesium.Transforms.fixedFrameToHeadingPitchRoll(mm)
    if (!Number.isFinite(hpr.heading) || !Number.isFinite(hpr.pitch) || !Number.isFinite(hpr.roll)) {
      return undefined
    }
    return hpr
  } catch {
    return undefined
  }
}

function colorFromString(css: string, alpha = 1): Color {
  const a = Math.min(1, Math.max(0, finiteOr(alpha, 1)))
  return Cesium.Color.fromCssColorString(css).withAlpha(a)
}

function toColor(c: string | Color | undefined, alpha?: number): Color | undefined {
  if (c === undefined) return undefined
  if (c instanceof Cesium.Color) {
    const a = alpha !== undefined ? Math.min(1, Math.max(0, finiteOr(alpha, 1))) : undefined
    return a !== undefined ? c.withAlpha(a) : c
  }
  return colorFromString(c, alpha !== undefined ? finiteOr(alpha, 1) : 1)
}

function toCartesian3(center: PlaneCenterInput, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (center instanceof Cesium.Cartesian3) {
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
      return Cesium.Cartesian3.fromDegrees(0, 0, 0, undefined, result)
    }
    return Cesium.Cartesian3.clone(center, result)
  }
  const lng = finiteOr(center.longitude, 0)
  const lat = finiteOr(center.latitude, 0)
  const h = finiteOr(center.height, 0)
  return Cesium.Cartesian3.fromDegrees(lng, lat, h, undefined, result)
}

function centerFromTuple(t: PlanePositionsTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(finiteOr(t[0], 0), finiteOr(t[1], 0), finiteOr(t[2], 0), undefined, result)
}

function resolveCenterCartesian(options: AddPlaneOptions): Cesium.Cartesian3 | undefined {
  if (options.position !== undefined && options.positions !== undefined) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
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

function readMaterialColor(plane: Cesium.PlaneGraphics): Color | undefined {
  const mat = plane.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function mergePlaneGraphics(
  pg: Cesium.PlaneGraphics,
  options: AddPlaneOptions | UpdatePlaneProperties,
  isCreate: boolean,
): void {
  const dim =
    (options as AddPlaneOptions).dimensions ??
    (options as UpdatePlaneProperties).dimensions ??
    (isCreate ? DEFAULT_DIM : undefined)
  if (dim !== undefined) {
    const dw = finiteOr(dim.width, DEFAULT_DIM.width)
    const dh = finiteOr(dim.height, DEFAULT_DIM.height)
    if (dw > 0 && dh > 0) {
      pg.dimensions = new Cesium.ConstantProperty(new Cesium.Cartesian2(dw, dh))
    }
  }

  const fill =
    (options as AddPlaneOptions).fill ?? (options as UpdatePlaneProperties).fill ?? (isCreate ? true : undefined)
  if (fill !== undefined) pg.fill = new Cesium.ConstantProperty(fill)

  const col =
    toColor((options as AddPlaneOptions).color, (options as AddPlaneOptions).alpha) ??
    toColor((options as UpdatePlaneProperties).color as string | undefined, (options as UpdatePlaneProperties).alpha)
  if (col !== undefined) {
    pg.material = new Cesium.ColorMaterialProperty(col)
  } else if (isCreate) {
    pg.material = new Cesium.ColorMaterialProperty(colorFromString(DEFAULT_COLOR, 0.85))
  }

  const outline =
    (options as AddPlaneOptions).outline ?? (options as UpdatePlaneProperties).outline ?? (isCreate ? false : undefined)
  if (outline !== undefined) pg.outline = new Cesium.ConstantProperty(outline)

  const oc =
    toColor((options as AddPlaneOptions).outlineColor, (options as AddPlaneOptions).outlineAlpha) ??
    toColor(
      (options as UpdatePlaneProperties).outlineColor as string | undefined,
      (options as UpdatePlaneProperties).outlineAlpha,
    )
  if (oc !== undefined) pg.outlineColor = new Cesium.ConstantProperty(oc)
  else if (isCreate) {
    pg.outlineColor = new Cesium.ConstantProperty(colorFromString(DEFAULT_OUTLINE, 0.9))
  }

  const ow =
    (options as AddPlaneOptions).outlineWidth ??
    (options as UpdatePlaneProperties).outlineWidth ??
    (isCreate ? 1 : undefined)
  if (ow !== undefined) {
    pg.outlineWidth = new Cesium.ConstantProperty(finiteOr(ow, 1))
  }

  if (options.style?.shadows !== undefined) {
    pg.shadows = new Cesium.ConstantProperty(options.style.shadows)
  }
  if (options.style?.distanceDisplayCondition !== undefined) {
    pg.distanceDisplayCondition = new Cesium.ConstantProperty(options.style.distanceDisplayCondition)
  }
}

function syncPlaneTargetData(
  td: Record<string, unknown>,
  center: Cesium.Cartesian3,
  dim: { width: number; height: number },
  hprDeg: { heading: number; pitch: number; roll: number },
  colorCss: string | undefined,
  alpha: number,
  outline: boolean,
  outlineCss: string | undefined,
  outlineAlpha: number,
  outlineWidth: number,
  fill: boolean,
): Record<string, unknown> {
  const carto = Cesium.Cartographic.fromCartesian(center)
  const lonDeg = finiteOr(Cesium.Math.toDegrees(carto.longitude), NaN)
  const latDeg = finiteOr(Cesium.Math.toDegrees(carto.latitude), NaN)
  const hEl = finiteOr(carto.height, NaN)
  const fallbackLon = finiteOr(td.longitude, 0)
  const fallbackLat = finiteOr(td.latitude, 0)
  const fallbackH = finiteOr(td.height, 0)
  const dw = finiteOr(dim.width, DEFAULT_DIM.width)
  const dh = finiteOr(dim.height, DEFAULT_DIM.height)
  return {
    ...td,
    longitude: Number.isFinite(lonDeg) ? lonDeg : fallbackLon,
    latitude: Number.isFinite(latDeg) ? latDeg : fallbackLat,
    height: Number.isFinite(hEl) ? hEl : fallbackH,
    dimensions: { width: dw > 0 ? dw : DEFAULT_DIM.width, height: dh > 0 ? dh : DEFAULT_DIM.height },
    headingDegrees: finiteOr(hprDeg.heading, 0),
    pitchDegrees: finiteOr(hprDeg.pitch, 0),
    rollDegrees: finiteOr(hprDeg.roll, 0),
    color: colorCss,
    alpha: finiteOr(alpha, 0.85),
    outline,
    outlineColor: outlineCss,
    outlineAlpha: finiteOr(outlineAlpha, 0.9),
    outlineWidth: finiteOr(outlineWidth, 1),
    fill,
  }
}

/**
 * 基础绘制 — 平面（`Entity` + `PlaneGraphics`）。
 */
export default class Plane {
  private readonly data = new Map<string, PlaneRecord>()

  private isRecordAlive(rec: PlaneRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): PlaneRecord | undefined {
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

  add(viewer: Viewer, options: AddPlaneOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('pln')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    const center = resolveCenterCartesian(options)
    if (!center) return undefined
    if (!isFiniteCartesian3(center)) return undefined

    const dim = options.dimensions ?? DEFAULT_DIM
    const w = finiteOr(dim.width, DEFAULT_DIM.width)
    const h = finiteOr(dim.height, DEFAULT_DIM.height)
    if (w <= 0 || h <= 0) return undefined

    const heading = finiteOr(options.headingDegrees, 0)
    const pitch = finiteOr(options.pitchDegrees, 0)
    const roll = finiteOr(options.rollDegrees, 0)
    const hpr = Cesium.HeadingPitchRoll.fromDegrees(heading, pitch, roll)
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(center, hpr)
    if (
      !orientation ||
      [orientation.x, orientation.y, orientation.z, orientation.w].some((v) => !Number.isFinite(v))
    ) {
      return undefined
    }

    const pg = new Cesium.PlaneGraphics()
    mergePlaneGraphics(pg, options, true)

    const fillCol = readMaterialColor(pg)
    const fillCss = colorToCss(fillCol)
    const alpha = finiteOr(fillCol?.alpha, 0.85)
    const outline = sampleProperty<boolean>(pg.outline) === true
    const oc = sampleProperty<Color>(pg.outlineColor)
    const ow = finiteOr(sampleProperty<number>(pg.outlineWidth), 1)

    const mergedTd = syncPlaneTargetData(
      this.cloneTargetData(options.targetData),
      center,
      { width: w, height: h },
      { heading, pitch, roll },
      fillCss,
      alpha,
      outline,
      colorToCss(oc),
      finiteOr(oc?.alpha, 0.9),
      ow,
      sampleProperty<boolean>(pg.fill) !== false,
    )

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(center),
      orientation: new Cesium.ConstantProperty(orientation),
      plane: pg,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)
    this.data.set(id, { viewer, entity, targetData: mergedTd })
    return entity
  }

  updatePlane(id: string, properties: UpdatePlaneProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false

    let center: Cesium.Cartesian3 | undefined
    if (properties.position !== undefined) {
      center = toCartesian3(properties.position)
    } else if (properties.positions !== undefined && properties.positions.length >= 2) {
      center = centerFromTuple(properties.positions)
    } else if (properties.longitude !== undefined && properties.latitude !== undefined) {
      const hRaw = properties.height !== undefined ? properties.height : (rec.targetData.height as number)
      const h = finiteOr(hRaw, 0)
      center = Cesium.Cartesian3.fromDegrees(
        finiteOr(properties.longitude, 0),
        finiteOr(properties.latitude, 0),
        h,
      )
    }
    if (center !== undefined) {
      rec.entity.position = new Cesium.ConstantPositionProperty(center)
    }

    const curPos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!curPos || !Number.isFinite(curPos.x) || !Number.isFinite(curPos.y) || !Number.isFinite(curPos.z)) {
      return false
    }

    let heading = finiteOr(rec.targetData.headingDegrees, 0)
    let pitch = finiteOr(rec.targetData.pitchDegrees, 0)
    let roll = finiteOr(rec.targetData.rollDegrees, 0)
    if (properties.headingDegrees !== undefined) heading = finiteOr(properties.headingDegrees, 0)
    if (properties.pitchDegrees !== undefined) pitch = finiteOr(properties.pitchDegrees, 0)
    if (properties.rollDegrees !== undefined) roll = finiteOr(properties.rollDegrees, 0)

    const hpr = Cesium.HeadingPitchRoll.fromDegrees(heading, pitch, roll)
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(curPos, hpr)
    if (
      !orientation ||
      [orientation.x, orientation.y, orientation.z, orientation.w].some((v) => !Number.isFinite(v))
    ) {
      return false
    }
    rec.entity.orientation = new Cesium.ConstantProperty(orientation)

    const pl = rec.entity.plane ?? (rec.entity.plane = new Cesium.PlaneGraphics())
    mergePlaneGraphics(pl, properties, false)

    if (properties.show !== undefined) rec.entity.show = properties.show
    if (properties.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(properties.description)
    }
    if (properties.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...properties.targetData }
    }

    const pg = rec.entity.plane!
    const dimProp = sampleProperty<Cesium.Cartesian2>(pg.dimensions)
    const dw = finiteOr(dimProp?.x ?? (rec.targetData.dimensions as { width?: number })?.width, DEFAULT_DIM.width)
    const dh = finiteOr(dimProp?.y ?? (rec.targetData.dimensions as { height?: number })?.height, DEFAULT_DIM.height)
    const fillCol = readMaterialColor(pg)
    const outline = sampleProperty<boolean>(pg.outline) === true
    const oc = sampleProperty<Color>(pg.outlineColor)
    const ow = finiteOr(sampleProperty<number>(pg.outlineWidth), 1)

    rec.targetData = syncPlaneTargetData(
      rec.targetData,
      curPos,
      { width: dw, height: dh },
      { heading, pitch, roll },
      colorToCss(fillCol),
      finiteOr(fillCol?.alpha, 1),
      outline,
      colorToCss(oc),
      finiteOr(oc?.alpha, 0.9),
      ow,
      sampleProperty<boolean>(pg.fill) !== false,
    )
    return true
  }

  updatePlanes(updates: Array<{ id: string } & UpdatePlaneProperties>): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u
      return { id, success: this.updatePlane(id, rest) }
    })
  }

  getPlane(id: string): PlaneSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return null
    const td = rec.targetData
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const lonDeg = finiteOr(Cesium.Math.toDegrees(carto.longitude), NaN)
    const latDeg = finiteOr(Cesium.Math.toDegrees(carto.latitude), NaN)
    const hEl = finiteOr(carto.height, NaN)
    const fbLon = finiteOr(td.longitude, 0)
    const fbLat = finiteOr(td.latitude, 0)
    const fbH = finiteOr(td.height, 0)
    const pg = rec.entity.plane
    const dim = pg ? sampleProperty<Cesium.Cartesian2>(pg.dimensions) : undefined
    const w = finiteOr(dim?.x ?? (td.dimensions as { width?: number })?.width, DEFAULT_DIM.width)
    const ph = finiteOr(dim?.y ?? (td.dimensions as { height?: number })?.height, DEFAULT_DIM.height)

    let headingDegrees = finiteOr(td.headingDegrees, 0)
    let pitchDegrees = finiteOr(td.pitchDegrees, 0)
    let rollDegrees = finiteOr(td.rollDegrees, 0)
    const hpr = safeEntityHeadingPitchRoll(rec.entity)
    if (hpr) {
      headingDegrees = finiteOr(Cesium.Math.toDegrees(hpr.heading), headingDegrees)
      pitchDegrees = finiteOr(Cesium.Math.toDegrees(hpr.pitch), pitchDegrees)
      rollDegrees = finiteOr(Cesium.Math.toDegrees(hpr.roll), rollDegrees)
    }

    const fillCol = pg ? readMaterialColor(pg) : undefined
    const outline = pg ? sampleProperty<boolean>(pg.outline) : undefined
    const outlineColor = pg ? sampleProperty<Color>(pg.outlineColor) : undefined
    const outlineWidth = pg ? sampleProperty<number>(pg.outlineWidth) : undefined
    const desc = sampleProperty<string>(rec.entity.description)

    return {
      id: rec.entity.id,
      longitude: Number.isFinite(lonDeg) ? lonDeg : fbLon,
      latitude: Number.isFinite(latDeg) ? latDeg : fbLat,
      height: Number.isFinite(hEl) ? hEl : fbH,
      width: finiteOr(w, DEFAULT_DIM.width),
      planeHeight: finiteOr(ph, DEFAULT_DIM.height),
      headingDegrees: finiteOr(headingDegrees, 0),
      pitchDegrees: finiteOr(pitchDegrees, 0),
      rollDegrees: finiteOr(rollDegrees, 0),
      colorCss: colorToCss(fillCol),
      fill: pg ? sampleProperty<boolean>(pg.fill) : undefined,
      outline,
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      show: rec.entity.show !== false,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllPlanes(viewer?: Viewer): PlaneSnapshot[] {
    const out: PlaneSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getPlane(id)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
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

  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity
  }

  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined
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

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      rec.entity.show = show
    }
  }

  setSpecifyVisibility(id: string, show: boolean): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.show = show
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
    for (const [id, rec] of [...this.data]) {
      if (!this.isRecordAlive(rec)) {
        this.data.delete(id)
        n++
      }
    }
    return n
  }
}
