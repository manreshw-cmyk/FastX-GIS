import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import {
  clearAreaDraftTargetData,
  createDraftPolylinePositionsProperty,
  getDraftPoints,
  isAreaDraftTargetData,
  markAreaDraftTargetData,
  setDraftPoints,
  type AreaDraftPointsHolder,
  type DraftCartesiansOption,
  cloneDraftPoints,
} from '../../Utils/areaDraft'
import { createShape, ShapeType, type ShapeParams, type ShapeVertices } from './shape'

import type { AddPolylineVolumeOptions, PolylineVolumeSnapshot, PolylineVolumeStyleOptions, UpdatePolylineVolumeProperties } from '../../Types'
export type { AddPolylineVolumeOptions, PolylineVolumeSnapshot, PolylineVolumeStyleOptions, UpdatePolylineVolumeProperties }

/** 折线路径顶点：[经度, 纬度, 高度(米)?]，至少 2 点 */
export type PolylineVolumeLngLatTuple = readonly [lng: number, lat: number, height?: number]

interface PolylineVolumeRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

const DEFAULT_COLOR = '#00bcd4'
const DEFAULT_OUTLINE = '#ffffff'

/** 下拉与 `ShapeType` 对齐的默认截面参数（米） */
export function defaultShapeParamsForType(shapeType: ShapeType): ShapeParams {
  switch (shapeType) {
    case ShapeType.CIRCLE:
      return { type: ShapeType.CIRCLE, radius: 20, segments: 32 }
    case ShapeType.ELLIPSE:
      return { type: ShapeType.ELLIPSE, radiusX: 25, radiusY: 15, segments: 32 }
    case ShapeType.HEXAGON:
      return { type: ShapeType.HEXAGON, radius: 18, pointUp: true }
    case ShapeType.OCTAGON:
      return { type: ShapeType.OCTAGON, radius: 18, pointUp: true }
    case ShapeType.RECTANGLE:
      return { type: ShapeType.RECTANGLE, width: 30, height: 16 }
    case ShapeType.SQUARE:
      return { type: ShapeType.SQUARE, size: 22 }
    case ShapeType.DIAMOND:
      return { type: ShapeType.DIAMOND, diagonalX: 28, diagonalY: 20 }
    case ShapeType.TRIANGLE:
      return { type: ShapeType.TRIANGLE, radius: 20, pointUp: true }
    case ShapeType.STAR:
      return { type: ShapeType.STAR, outerRadius: 22, innerRadius: 9 }
    case ShapeType.CROSS:
      return { type: ShapeType.CROSS, armWidth: 6, armLength: 22 }
    case ShapeType.CAPSULE:
      return { type: ShapeType.CAPSULE, width: 14, height: 28, segments: 24 }
    case ShapeType.I_SHAPE:
      return { type: ShapeType.I_SHAPE, width: 20, height: 28, flangeWidth: 8 }
    case ShapeType.L_SHAPE:
      return { type: ShapeType.L_SHAPE, width: 22, height: 22, thickness: 8 }
    case ShapeType.RING:
      return { type: ShapeType.RING, outerRadius: 20, innerRadius: 10, segments: 48 }
    default:
      return { type: ShapeType.CIRCLE, radius: 20, segments: 32 }
  }
}

export function parseShapeTypeKey(raw: unknown): ShapeType {
  const s = typeof raw === 'string' ? raw : ShapeType.CIRCLE
  const vals = Object.values(ShapeType) as string[]
  return vals.includes(s) ? (s as ShapeType) : ShapeType.CIRCLE
}

export function resolveShapeParamsFromTargetData(td: Record<string, unknown>, shapeType: ShapeType): ShapeParams {
  const p = td.shapeParams
  if (p && typeof p === 'object' && !Array.isArray(p) && 'type' in (p as object)) {
    return p as ShapeParams
  }
  return defaultShapeParamsForType(shapeType)
}

export function buildShapeVerticesFromTargetData(td: Record<string, unknown>): ShapeVertices {
  const shapeType = parseShapeTypeKey(td.shapeType)
  const params = resolveShapeParamsFromTargetData(td, shapeType)
  return createShape(params)
}

function normalizePositionsInput(
  raw: PolylineVolumeLngLatTuple[] | number[][] | { longitude: number; latitude: number; height?: number }[],
  minRows = 2,
): number[][] {
  const out: number[][] = []
  for (const row of raw) {
    if (row && typeof row === 'object' && !Array.isArray(row) && 'longitude' in row) {
      const p = row as { longitude: number; latitude: number; height?: number }
      if (!Number.isFinite(Number(p.longitude)) || !Number.isFinite(Number(p.latitude))) continue
      out.push([Number(p.longitude), Number(p.latitude), Number(p.height ?? 0)])
      continue
    }
    const a = row as readonly number[]
    if (a.length < 2 || !Number.isFinite(Number(a[0])) || !Number.isFinite(Number(a[1]))) continue
    const h = a.length >= 3 && Number.isFinite(Number(a[2])) ? Number(a[2]) : 0
    out.push([Number(a[0]), Number(a[1]), h])
  }
  if (out.length < minRows) return []
  return out
}

function positionsToCartesian3Array(rows: number[][]): Cesium.Cartesian3[] {
  return rows.map((r) => Cesium.Cartesian3.fromDegrees(r[0]!, r[1]!, r[2] ?? 0))
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

function parseCornerType(s: keyof typeof Cesium.CornerType | undefined): Cesium.CornerType {
  if (!s) return Cesium.CornerType.ROUNDED
  return Cesium.CornerType[s] ?? Cesium.CornerType.ROUNDED
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

function mergeTargetData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}
  return { ...data }
}

function syncPolylineVolumeTargetShape(
  td: Record<string, unknown>,
  shapeType: ShapeType,
  shapeParams: ShapeParams,
  polylinePositions: number[][],
): Record<string, unknown> {
  return {
    ...td,
    shapeType,
    shapeParams,
    polylinePositions,
  }
}

function applyVisualPropsToTargetData(
  td: Record<string, unknown>,
  options: AddPolylineVolumeOptions | UpdatePolylineVolumeProperties,
): void {
  if (options.color !== undefined) td.color = options.color
  if (options.alpha !== undefined) td.alpha = options.alpha
  if (options.fill !== undefined) td.fill = options.fill
  if (options.outline !== undefined) td.outline = options.outline
  if (options.outlineColor !== undefined) td.outlineColor = options.outlineColor
  if (options.outlineAlpha !== undefined) td.outlineAlpha = options.outlineAlpha
  if (options.outlineWidth !== undefined) td.outlineWidth = options.outlineWidth
  if (options.cornerType !== undefined) td.cornerType = options.cornerType
  if (options.granularity !== undefined) td.granularity = options.granularity
  if (options.style !== undefined) td.styleSnapshot = { ...(td.styleSnapshot as object), ...options.style }
}

function mergePolylineVolumeGraphics(
  pvg: Cesium.PolylineVolumeGraphics,
  positions: Cesium.Cartesian3[],
  shape: ShapeVertices,
  options: AddPolylineVolumeOptions | UpdatePolylineVolumeProperties,
  isCreate: boolean,
): void {
  pvg.positions = new Cesium.ConstantProperty(positions)
  pvg.shape = new Cesium.ConstantProperty(shape)

  const corner =
    (options as AddPolylineVolumeOptions).cornerType !== undefined
      ? parseCornerType((options as AddPolylineVolumeOptions).cornerType)
      : (options as UpdatePolylineVolumeProperties).cornerType !== undefined
        ? parseCornerType((options as UpdatePolylineVolumeProperties).cornerType)
        : undefined
  const cornerFinal =
    corner ??
    (options.style?.cornerType !== undefined ? options.style.cornerType : undefined) ??
    (isCreate ? Cesium.CornerType.ROUNDED : undefined)
  if (cornerFinal !== undefined) pvg.cornerType = new Cesium.ConstantProperty(cornerFinal)

  const gran =
    (options as AddPolylineVolumeOptions).granularity ??
    (options as UpdatePolylineVolumeProperties).granularity ??
    options.style?.granularity
  if (gran !== undefined) pvg.granularity = new Cesium.ConstantProperty(gran)

  const fill =
    (options as AddPolylineVolumeOptions).fill ??
    (options as UpdatePolylineVolumeProperties).fill ??
    (isCreate ? true : undefined)
  if (fill !== undefined) pvg.fill = new Cesium.ConstantProperty(fill)

  const col =
    toColor((options as AddPolylineVolumeOptions).color, (options as AddPolylineVolumeOptions).alpha) ??
    toColor((options as UpdatePolylineVolumeProperties).color as string | undefined, (options as UpdatePolylineVolumeProperties).alpha)
  if (col !== undefined) {
    pvg.material = new Cesium.ColorMaterialProperty(col)
  } else if (isCreate) {
    pvg.material = new Cesium.ColorMaterialProperty(colorFromString(DEFAULT_COLOR, 0.75))
  }

  const outline =
    (options as AddPolylineVolumeOptions).outline ??
    (options as UpdatePolylineVolumeProperties).outline ??
    (isCreate ? false : undefined)
  if (outline !== undefined) pvg.outline = new Cesium.ConstantProperty(outline)

  const oc =
    toColor((options as AddPolylineVolumeOptions).outlineColor, (options as AddPolylineVolumeOptions).outlineAlpha) ??
    toColor((options as UpdatePolylineVolumeProperties).outlineColor as string | undefined, (options as UpdatePolylineVolumeProperties).outlineAlpha)
  if (oc !== undefined) pvg.outlineColor = new Cesium.ConstantProperty(oc)
  else if (isCreate) {
    pvg.outlineColor = new Cesium.ConstantProperty(colorFromString(DEFAULT_OUTLINE, 0.9))
  }

  const ow =
    (options as AddPolylineVolumeOptions).outlineWidth ??
    (options as UpdatePolylineVolumeProperties).outlineWidth ??
    (isCreate ? 1 : undefined)
  if (ow !== undefined) pvg.outlineWidth = new Cesium.ConstantProperty(ow)

  if (options.style?.shadows !== undefined) {
    pvg.shadows = new Cesium.ConstantProperty(options.style.shadows)
  }
  if (options.style?.distanceDisplayCondition !== undefined) {
    pvg.distanceDisplayCondition = new Cesium.ConstantProperty(options.style.distanceDisplayCondition)
  }
}

function applyAreaDraftPolylineVolumeGraphics(
  rec: PolylineVolumeRecord,
  shape: ShapeVertices,
  options: AddPolylineVolumeOptions | UpdatePolylineVolumeProperties,
): void {
  const getPoints = (): Cesium.Cartesian3[] => getDraftPoints(rec)
  const pvg = rec.entity.polylineVolume ?? new Cesium.PolylineVolumeGraphics()
  pvg.positions = createDraftPolylinePositionsProperty(getPoints)
  pvg.shape = new Cesium.ConstantProperty(shape)

  const corner =
    (options as AddPolylineVolumeOptions).cornerType !== undefined
      ? parseCornerType((options as AddPolylineVolumeOptions).cornerType)
      : (options as UpdatePolylineVolumeProperties).cornerType !== undefined
        ? parseCornerType((options as UpdatePolylineVolumeProperties).cornerType)
        : parseCornerType(rec.targetData.cornerType as keyof typeof Cesium.CornerType | undefined)
  pvg.cornerType = new Cesium.ConstantProperty(corner)

  const gran =
    (options as AddPolylineVolumeOptions).granularity ??
    (options as UpdatePolylineVolumeProperties).granularity ??
    options.style?.granularity
  if (gran !== undefined) pvg.granularity = new Cesium.ConstantProperty(gran)

  const fill = (options as AddPolylineVolumeOptions).fill ?? (options as UpdatePolylineVolumeProperties).fill ?? true
  pvg.fill = new Cesium.ConstantProperty(fill)

  const col =
    toColor((options as AddPolylineVolumeOptions).color, (options as AddPolylineVolumeOptions).alpha) ??
    toColor((options as UpdatePolylineVolumeProperties).color as string | undefined, (options as UpdatePolylineVolumeProperties).alpha) ??
    toColor(String(rec.targetData.color ?? DEFAULT_COLOR), typeof rec.targetData.alpha === 'number' ? rec.targetData.alpha : 0.75)
  if (col !== undefined) pvg.material = new Cesium.ColorMaterialProperty(col)

  const outline =
    (options as AddPolylineVolumeOptions).outline ?? (options as UpdatePolylineVolumeProperties).outline ?? false
  pvg.outline = new Cesium.ConstantProperty(outline)

  const oc =
    toColor((options as AddPolylineVolumeOptions).outlineColor, (options as AddPolylineVolumeOptions).outlineAlpha) ??
    toColor((options as UpdatePolylineVolumeProperties).outlineColor as string | undefined, (options as UpdatePolylineVolumeProperties).outlineAlpha) ??
    toColor(DEFAULT_OUTLINE, 0.9)
  if (oc !== undefined) pvg.outlineColor = new Cesium.ConstantProperty(oc)

  const ow =
    (options as AddPolylineVolumeOptions).outlineWidth ??
    (options as UpdatePolylineVolumeProperties).outlineWidth ??
    1
  pvg.outlineWidth = new Cesium.ConstantProperty(ow)

  if (options.style?.shadows !== undefined) {
    pvg.shadows = new Cesium.ConstantProperty(options.style.shadows)
  }
  if (options.style?.distanceDisplayCondition !== undefined) {
    pvg.distanceDisplayCondition = new Cesium.ConstantProperty(options.style.distanceDisplayCondition)
  }

  rec.entity.polylineVolume = pvg
}

function commitAreaDraftPolylineVolumeRecord(rec: PolylineVolumeRecord): boolean {
  const rows = normalizePositionsInput((rec.targetData.polylinePositions as number[][]) ?? [])
  if (rows.length < 2) return false

  const shapeType = parseShapeTypeKey(rec.targetData.shapeType)
  const shapeParams = resolveShapeParamsFromTargetData(rec.targetData, shapeType)
  let shape: ShapeVertices
  try {
    shape = createShape(shapeParams)
  } catch {
    shape = createShape(defaultShapeParamsForType(ShapeType.CIRCLE))
  }

  const pvg = rec.entity.polylineVolume ?? (rec.entity.polylineVolume = new Cesium.PolylineVolumeGraphics())
  const commitOpts: AddPolylineVolumeOptions = {
    positions: rows,
    shapeType: String(rec.targetData.shapeType ?? ShapeType.CIRCLE),
    shapeParams,
    cornerType: rec.targetData.cornerType as AddPolylineVolumeOptions['cornerType'],
    granularity: rec.targetData.granularity as number | undefined,
    color: typeof rec.targetData.color === 'string' ? rec.targetData.color : DEFAULT_COLOR,
    alpha: typeof rec.targetData.alpha === 'number' ? rec.targetData.alpha : 0.75,
    fill: rec.targetData.fill as boolean | undefined,
    outline: rec.targetData.outline as boolean | undefined,
    outlineColor: typeof rec.targetData.outlineColor === 'string' ? rec.targetData.outlineColor : DEFAULT_OUTLINE,
    outlineAlpha: typeof rec.targetData.outlineAlpha === 'number' ? rec.targetData.outlineAlpha : 0.9,
    outlineWidth: typeof rec.targetData.outlineWidth === 'number' ? rec.targetData.outlineWidth : 1,
    style: rec.targetData.styleSnapshot as PolylineVolumeStyleOptions | undefined,
  }
  mergePolylineVolumeGraphics(pvg, positionsToCartesian3Array(rows), shape, commitOpts, false)
  clearAreaDraftTargetData(rec.targetData)
  rec.draftPoints = undefined
  return true
}

/**
 * 基础绘制 — 折线体（`Entity` + `PolylineVolumeGraphics`）。
 */
export default class PolylineVolume {
  private readonly data = new Map<string, PolylineVolumeRecord>()

  private isRecordAlive(rec: PolylineVolumeRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): PolylineVolumeRecord | undefined {
    const rec = this.data.get(id)
    if (!rec) return undefined
    if (!this.isRecordAlive(rec)) {
      this.data.delete(id)
      return undefined
    }
    return rec
  }

  add(viewer: Viewer, options: AddPolylineVolumeOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('pvl')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const rows = normalizePositionsInput(options.positions as number[][])
    if (rows.length < 2) return undefined

    const shapeType = parseShapeTypeKey(options.shapeType ?? options.targetData?.shapeType)
    const shapeParams = options.shapeParams ?? resolveShapeParamsFromTargetData(mergeTargetData(options.targetData), shapeType)
    let shape: ShapeVertices
    try {
      shape = createShape(shapeParams)
    } catch {
      shape = createShape(defaultShapeParamsForType(ShapeType.CIRCLE))
    }

    const positions = positionsToCartesian3Array(rows)
    const td = mergeTargetData(options.targetData)
    const mergedTd = syncPolylineVolumeTargetShape(td, shapeType, shapeParams, rows)

    const pvg = new Cesium.PolylineVolumeGraphics()
    mergePolylineVolumeGraphics(pvg, positions, shape, options, true)

    const entity = new Cesium.Entity({
      id,
      polylineVolume: pvg,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    const rec: PolylineVolumeRecord = { viewer, entity, targetData: mergedTd }
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  private addAreaDraft(viewer: Viewer, id: string, options: AddPolylineVolumeOptions): Entity | undefined {
    const draftCarts = (options as AddPolylineVolumeOptions & DraftCartesiansOption).draftCartesians
    const rows = draftCarts?.length
      ? draftCarts.map((c) => {
          const carto = Cesium.Cartographic.fromCartesian(c)
          return [
            Cesium.Math.toDegrees(carto.longitude),
            Cesium.Math.toDegrees(carto.latitude),
            carto.height,
          ] as number[]
        })
      : normalizePositionsInput(options.positions as number[][], 1)
    if (rows.length < 1) return undefined

    const shapeType = parseShapeTypeKey(options.shapeType ?? options.targetData?.shapeType)
    const shapeParams =
      options.shapeParams ?? resolveShapeParamsFromTargetData(mergeTargetData(options.targetData), shapeType)
    let shape: ShapeVertices
    try {
      shape = createShape(shapeParams)
    } catch {
      shape = createShape(defaultShapeParamsForType(ShapeType.CIRCLE))
    }

    const td = mergeTargetData(options.targetData)
    markAreaDraftTargetData(td)
    const mergedTd = syncPolylineVolumeTargetShape(td, shapeType, shapeParams, rows)

    const entity = new Cesium.Entity({
      id,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    const rec: PolylineVolumeRecord = { viewer, entity, targetData: mergedTd }
    setDraftPoints(rec, positionsToCartesian3Array(rows))
    applyAreaDraftPolylineVolumeGraphics(rec, shape, options)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  updatePolylineVolume(id: string, properties: UpdatePolylineVolumeProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const td = rec.targetData
    const p = properties

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyDraftPatchToTargetData(rec, p)
      applyVisualPropsToTargetData(td, p)
      const shapeType = parseShapeTypeKey(rec.targetData.shapeType)
      const shapeParams = resolveShapeParamsFromTargetData(rec.targetData, shapeType)
      const draftCarts = (p as UpdatePolylineVolumeProperties & DraftCartesiansOption).draftCartesians
      if (draftCarts?.length) {
        setDraftPoints(rec, cloneDraftPoints(draftCarts))
        const rows = draftCarts.map((c) => {
          const carto = Cesium.Cartographic.fromCartesian(c)
          return [
            Cesium.Math.toDegrees(carto.longitude),
            Cesium.Math.toDegrees(carto.latitude),
            carto.height,
          ] as number[]
        })
        rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
      } else if (p.positions !== undefined) {
        const rows = normalizePositionsInput(p.positions as number[][], 1)
        if (rows.length < 1) return false
        setDraftPoints(rec, positionsToCartesian3Array(rows))
        rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
      } else {
        const pts = getDraftPoints(rec)
        if (pts.length >= 2) {
          const rows = pts.map((c) => {
            const carto = Cesium.Cartographic.fromCartesian(c)
            return [
              Cesium.Math.toDegrees(carto.longitude),
              Cesium.Math.toDegrees(carto.latitude),
              carto.height,
            ] as number[]
          })
          rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
        }
      }
      return commitAreaDraftPolylineVolumeRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

    const pvg = rec.entity.polylineVolume ?? (rec.entity.polylineVolume = new Cesium.PolylineVolumeGraphics())

    let rows = normalizePositionsInput(
      (rec.targetData.polylinePositions as number[][]) ?? [],
    )
    if (properties.positions !== undefined) {
      const next = normalizePositionsInput(properties.positions as number[][])
      if (next.length >= 2) rows = next
    }

    const shapeType = properties.shapeType !== undefined ? parseShapeTypeKey(properties.shapeType) : parseShapeTypeKey(rec.targetData.shapeType)
    const shapeParams =
      properties.shapeParams !== undefined
        ? properties.shapeParams
        : resolveShapeParamsFromTargetData(
            { ...rec.targetData, shapeType },
            shapeType,
          )
    let shape: ShapeVertices
    try {
      shape = createShape(shapeParams)
    } catch {
      shape = createShape(defaultShapeParamsForType(ShapeType.CIRCLE))
    }

    mergePolylineVolumeGraphics(pvg, positionsToCartesian3Array(rows), shape, properties, false)
    applyVisualPropsToTargetData(rec.targetData, properties)

    if (properties.show !== undefined) rec.entity.show = properties.show
    if (properties.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(properties.description)
    }
    if (properties.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...properties.targetData }
    }
    rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
    if (rec.viewer.scene.requestRenderMode) rec.viewer.scene.requestRender()
    return true
  }

  private applyDraftPatchToTargetData(
    rec: PolylineVolumeRecord,
    p: UpdatePolylineVolumeProperties,
  ): void {
    applyVisualPropsToTargetData(rec.targetData, p)
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    const shapeType =
      p.shapeType !== undefined ? parseShapeTypeKey(p.shapeType) : parseShapeTypeKey(rec.targetData.shapeType)
    const shapeParams =
      p.shapeParams !== undefined
        ? p.shapeParams
        : resolveShapeParamsFromTargetData({ ...rec.targetData, shapeType }, shapeType)
    const rows = p.positions !== undefined
      ? normalizePositionsInput(p.positions as number[][], 1)
      : ((rec.targetData.polylinePositions as number[][]) ?? [])
    rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
  }

  private updateAreaDraft(rec: PolylineVolumeRecord, p: UpdatePolylineVolumeProperties): boolean {
    markAreaDraftTargetData(rec.targetData)
    this.applyDraftPatchToTargetData(rec, p)

    const shapeType = parseShapeTypeKey(rec.targetData.shapeType)
    let shapeParams = resolveShapeParamsFromTargetData(rec.targetData, shapeType)

    const draftCarts = (p as UpdatePolylineVolumeProperties & DraftCartesiansOption).draftCartesians
    if (draftCarts?.length) {
      setDraftPoints(rec, cloneDraftPoints(draftCarts))
      const rows = draftCarts.map((c) => {
        const carto = Cesium.Cartographic.fromCartesian(c)
        return [
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height,
        ] as number[]
      })
      if (p.shapeParams !== undefined) shapeParams = p.shapeParams
      rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
    } else if (p.positions !== undefined) {
      const rows = normalizePositionsInput(p.positions as number[][], 1)
      if (rows.length < 1) return false
      setDraftPoints(rec, positionsToCartesian3Array(rows))
      if (p.shapeParams !== undefined) shapeParams = p.shapeParams
      rec.targetData = syncPolylineVolumeTargetShape(rec.targetData, shapeType, shapeParams, rows)
    }

    let shape: ShapeVertices
    try {
      shape = createShape(shapeParams)
    } catch {
      shape = createShape(defaultShapeParamsForType(ShapeType.CIRCLE))
    }

    applyAreaDraftPolylineVolumeGraphics(rec, shape, p)

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updatePolylineVolumes(updates: Array<{ id: string } & UpdatePolylineVolumeProperties>): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u
      return { id, success: this.updatePolylineVolume(id, rest) }
    })
  }

  getPolylineVolume(id: string): PolylineVolumeSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const pvg = rec.entity.polylineVolume
    const posArr = (rec.targetData.polylinePositions as number[][]) ?? []
    const fill = pvg ? sampleProperty<boolean>(pvg.fill) : undefined
    const outline = pvg ? sampleProperty<boolean>(pvg.outline) : undefined
    let colorCss: string | undefined
    let outlineColorCss: string | undefined
    if (pvg?.material && 'color' in (pvg.material as object)) {
      const cmp = pvg.material as Cesium.ColorMaterialProperty
      colorCss = colorToCss(sampleProperty<Color>(cmp.color))
    }
    if (pvg?.outlineColor) {
      outlineColorCss = colorToCss(sampleProperty<Color>(pvg.outlineColor))
    }
    const owTd = rec.targetData.outlineWidth
    const ow =
      typeof owTd === 'number' && Number.isFinite(owTd)
        ? owTd
        : pvg
          ? sampleProperty<number>(pvg.outlineWidth)
          : undefined
    const desc = sampleProperty<string>(rec.entity.description)

    return {
      id: rec.entity.id,
      positions: posArr.map((r) => (r.length >= 3 ? [r[0]!, r[1]!, r[2]!] : [r[0]!, r[1]!, 0])),
      positionsCount: posArr.length,
      shapeType: String(rec.targetData.shapeType ?? ShapeType.CIRCLE),
      show: rec.entity.show,
      fill,
      colorCss,
      outline,
      outlineColorCss,
      outlineWidth: ow,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllPolylineVolumes(viewer?: Viewer): PolylineVolumeSnapshot[] {
    const out: PolylineVolumeSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getPolylineVolume(id)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
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
