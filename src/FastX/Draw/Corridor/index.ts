import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId, type LngLatHeight } from '../../Coordinates'
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

import type { AddCorridorOptions, CorridorSnapshot, CorridorStyleOptions, UpdateCorridorProperties } from '../../Types'
export type { AddCorridorOptions, CorridorSnapshot, CorridorStyleOptions, UpdateCorridorProperties }

/** 廊道中心线顶点：[经度, 纬度, 高度?]（度 / 米） */
export type CorridorLngLatTuple = readonly [lng: number, lat: number, height?: number]

/** 顶点：笛卡尔、经纬高对象或三元组 */
export type CorridorVertexInput = Cesium.Cartesian3 | LngLatHeight | CorridorLngLatTuple

interface CorridorRecord extends AreaDraftPointsHolder {
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

function vertexToCartesian3(v: CorridorVertexInput, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
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

function lineToCartesian3Array(
  line: CorridorVertexInput[],
  minVertices = 2,
): Cesium.Cartesian3[] | undefined {
  if (!Array.isArray(line) || line.length < minVertices) return undefined
  return line.map((p) => vertexToCartesian3(p))
}

function resolveDraftLineCartesians(
  options: { positions?: CorridorVertexInput[] } & DraftCartesiansOption,
  minVertices = 1,
): Cesium.Cartesian3[] | undefined {
  if (options.draftCartesians?.length) return cloneDraftPoints(options.draftCartesians)
  if (options.positions !== undefined) return lineToCartesian3Array(options.positions, minVertices)
  return undefined
}

/** 从 `targetData.positions` 还原为 `number[][]`（与 `getValue` 采样失败时作回退） */
function positionsFromTargetData(td: Record<string, unknown>): number[][] {
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

function cornerTypeSnapshotFromRecord(
  sampled: Cesium.CornerType | undefined,
  td: Record<string, unknown>,
): string | undefined {
  if (sampled !== undefined) return cornerTypeToKey(sampled)
  const raw = td.cornerType
  if (raw === 'ROUNDED' || raw === 'MITERED' || raw === 'BEVELED') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return cornerTypeToKey(raw as Cesium.CornerType)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return cornerTypeToKey(parseCornerType(raw as keyof typeof Cesium.CornerType))
  }
  return undefined
}

function lineToNumberTuples(line: CorridorVertexInput[]): number[][] {
  const out: number[][] = []
  for (const v of line) {
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

function parseCornerType(
  s: keyof typeof Cesium.CornerType | Cesium.CornerType | undefined,
): Cesium.CornerType {
  if (s === undefined) return Cesium.CornerType.ROUNDED
  if (typeof s === 'number') return s
  return Cesium.CornerType[s] ?? Cesium.CornerType.ROUNDED
}

function cornerTypeToKey(ct: Cesium.CornerType | undefined): string | undefined {
  if (ct === undefined) return undefined
  const e = Cesium.CornerType
  if (ct === e.ROUNDED) return 'ROUNDED'
  if (ct === e.MITERED) return 'MITERED'
  if (ct === e.BEVELED) return 'BEVELED'
  return String(ct)
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

function readCorridorMaterialColor(corridor: Cesium.CorridorGraphics): Color | undefined {
  const mat = corridor.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function mergeCorridorGraphics(
  cg: Cesium.CorridorGraphics,
  opts: {
    positions: Cesium.Cartesian3[]
    width: number
    height: number
    extrudedHeight?: number
    cornerType: Cesium.CornerType
    fillColor: Color
    showFill: boolean
    outline: boolean
    outlineColor: Color
    outlineWidth: number
    style?: CorridorStyleOptions
  },
  isCreate: boolean,
): void {
  cg.positions = new Cesium.ConstantProperty(opts.positions)
  cg.width = new Cesium.ConstantProperty(opts.width)
  cg.height = new Cesium.ConstantProperty(opts.height)
  cg.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  cg.extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)

  if (opts.extrudedHeight !== undefined && Number.isFinite(opts.extrudedHeight)) {
    cg.extrudedHeight = new Cesium.ConstantProperty(opts.extrudedHeight)
  } else {
    cg.extrudedHeight = undefined
  }

  cg.cornerType = new Cesium.ConstantProperty(opts.cornerType)
  if (opts.style?.granularity !== undefined) {
    cg.granularity = new Cesium.ConstantProperty(opts.style.granularity)
  } else if (isCreate) {
    cg.granularity = undefined
  }
  cg.fill = new Cesium.ConstantProperty(opts.showFill)
  cg.material = new Cesium.ColorMaterialProperty(opts.fillColor)
  cg.outline = new Cesium.ConstantProperty(opts.outline)
  cg.outlineColor = new Cesium.ConstantProperty(opts.outlineColor)
  cg.outlineWidth = new Cesium.ConstantProperty(opts.outlineWidth)

  const st = opts.style
  if (st?.shadows !== undefined) cg.shadows = new Cesium.ConstantProperty(st.shadows)
  if (st?.distanceDisplayCondition !== undefined) {
    cg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.classificationType !== undefined) {
    cg.classificationType = new Cesium.ConstantProperty(st.classificationType)
  }
  if (st?.zIndex !== undefined) cg.zIndex = new Cesium.ConstantProperty(st.zIndex)
}

function resolveCorridorStyleFromTargetData(td: Record<string, unknown>): {
  width: number
  height: number
  extrudedHeight?: number
  cornerType: Cesium.CornerType
  fillColor: Color
  showFill: boolean
  outline: boolean
  outlineColor: Color
  outlineWidth: number
  style?: CorridorStyleOptions
} {
  const showFill = td.showFill !== false
  const alpha = typeof td.alpha === 'number' ? td.alpha : 1
  const fillColor =
    toColor(String(td.color ?? '#00b96b'), showFill ? alpha : 0) ??
    Cesium.Color.LIME.withAlpha(showFill ? alpha : 0)
  const outline = td.outline !== false
  const outlineColor =
    toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
    Cesium.Color.WHITE
  const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
  const width = typeof td.width === 'number' ? td.width : 1
  const height = typeof td.height === 'number' ? td.height : 0
  const extrRaw = td.extrudedHeight
  const extrudedHeight =
    typeof extrRaw === 'number' && Number.isFinite(extrRaw) ? extrRaw : undefined
  const cornerType =
    typeof td.cornerType === 'number'
      ? (td.cornerType as Cesium.CornerType)
      : parseCornerType(td.cornerType as keyof typeof Cesium.CornerType)
  return {
    width,
    height,
    extrudedHeight,
    cornerType,
    fillColor,
    showFill,
    outline,
    outlineColor,
    outlineWidth,
    style: td.styleSnapshot as CorridorStyleOptions | undefined,
  }
}

function applyAreaDraftCorridorGraphics(rec: CorridorRecord): void {
  const st = resolveCorridorStyleFromTargetData(rec.targetData)
  const getPoints = (): Cesium.Cartesian3[] => getDraftPoints(rec)
  const corridor = new Cesium.CorridorGraphics()
  corridor.positions = createDraftPolylinePositionsProperty(getPoints)
  corridor.width = new Cesium.ConstantProperty(st.width)
  corridor.height = new Cesium.ConstantProperty(st.height)
  corridor.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  corridor.extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  if (st.extrudedHeight !== undefined && Number.isFinite(st.extrudedHeight)) {
    corridor.extrudedHeight = new Cesium.ConstantProperty(st.extrudedHeight)
  }
  corridor.cornerType = new Cesium.ConstantProperty(st.cornerType)
  corridor.fill = new Cesium.ConstantProperty(st.showFill)
  corridor.material = new Cesium.ColorMaterialProperty(st.fillColor)
  corridor.outline = new Cesium.ConstantProperty(st.outline)
  corridor.outlineColor = new Cesium.ConstantProperty(st.outlineColor)
  corridor.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth)
  const style = st.style
  if (style?.granularity !== undefined) {
    corridor.granularity = new Cesium.ConstantProperty(style.granularity)
  }
  if (style?.shadows !== undefined) corridor.shadows = new Cesium.ConstantProperty(style.shadows)
  if (style?.distanceDisplayCondition !== undefined) {
    corridor.distanceDisplayCondition = new Cesium.ConstantProperty(style.distanceDisplayCondition)
  }
  if (style?.classificationType !== undefined) {
    corridor.classificationType = new Cesium.ConstantProperty(style.classificationType)
  }
  if (style?.zIndex !== undefined) corridor.zIndex = new Cesium.ConstantProperty(style.zIndex)
  rec.entity.corridor = corridor
}

function commitAreaDraftCorridorRecord(rec: CorridorRecord): boolean {
  const positionsNums = rec.targetData.positions as number[][] | undefined
  if (!positionsNums?.length) return false
  const line = lineToCartesian3Array(
    positionsNums.map((t) => [Number(t[0]), Number(t[1]), Number(t[2] ?? 0)] as CorridorLngLatTuple),
  )
  if (!line) return false

  const st = resolveCorridorStyleFromTargetData(rec.targetData)
  const cg = rec.entity.corridor ?? (rec.entity.corridor = new Cesium.CorridorGraphics())
  mergeCorridorGraphics(
    cg,
    {
      positions: line,
      width: st.width,
      height: st.height,
      extrudedHeight: st.extrudedHeight,
      cornerType: st.cornerType,
      fillColor: st.fillColor,
      showFill: st.showFill,
      outline: st.outline,
      outlineColor: st.outlineColor,
      outlineWidth: st.outlineWidth,
      style: st.style,
    },
    false,
  )
  clearAreaDraftTargetData(rec.targetData)
  rec.draftPoints = undefined
  return true
}

/**
 * 廊道（`Entity` + `CorridorGraphics`）。单例：首参传入 `viewer`。
 */
export default class Corridor {
  private readonly data = new Map<string, CorridorRecord>()

  private isRecordAlive(rec: CorridorRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): CorridorRecord | undefined {
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

  add(viewer: Viewer, options: AddCorridorOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('cor')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const w = Number(options.width)
    if (!Number.isFinite(w) || w <= 0) return undefined

    const cartesianLine = lineToCartesian3Array(options.positions)
    if (!cartesianLine) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const fillColor =
      toColor(options.color ?? '#00b96b', showFill ? alpha : 0) ??
      Cesium.Color.LIME.withAlpha(showFill ? alpha : 0)
    const outline = options.outline !== false
    const outlineColor =
      toColor(options.outlineColor ?? '#ffffff', options.outlineAlpha ?? 1) ?? Cesium.Color.WHITE
    const outlineWidth = options.outlineWidth ?? 2
    const height = options.height ?? 0
    const extrudedHeight = options.extrudedHeight
    const cornerType = parseCornerType(options.cornerType)

    const corridor = new Cesium.CorridorGraphics()
    mergeCorridorGraphics(
      corridor,
      {
        positions: cartesianLine,
        width: w,
        height,
        extrudedHeight:
          extrudedHeight !== undefined && Number.isFinite(extrudedHeight) ? extrudedHeight : undefined,
        cornerType,
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
      corridor,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const td = this.cloneTargetData(options.targetData)
    td.positions = lineToNumberTuples(options.positions)
    td.width = w
    td.height = height
    td.extrudedHeight = extrudedHeight ?? 0
    td.cornerType = cornerType
    td.color = options.color ?? '#00b96b'
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

  private addAreaDraft(viewer: Viewer, id: string, options: AddCorridorOptions): Entity | undefined {
    const w = Number(options.width)
    if (!Number.isFinite(w) || w <= 0) return undefined

    const cartesianLine = resolveDraftLineCartesians(options, 1)
    if (!cartesianLine) return undefined

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    td.positions = cartesianLine.map((c) => {
      const carto = Cesium.Cartographic.fromCartesian(c)
      return [
        Cesium.Math.toDegrees(carto.longitude),
        Cesium.Math.toDegrees(carto.latitude),
        carto.height,
      ] as number[]
    })
    td.width = w
    td.height = options.height ?? 0
    td.extrudedHeight = options.extrudedHeight ?? 0
    td.cornerType = parseCornerType(options.cornerType)
    td.color = options.color ?? '#00b96b'
    td.alpha = options.alpha ?? 1
    td.showFill = options.showFill !== false
    td.outline = options.outline !== false
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

    const rec: CorridorRecord = { viewer, entity, targetData: td }
    setDraftPoints(rec, cartesianLine)
    applyAreaDraftCorridorGraphics(rec)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  addCorridors(viewer: Viewer, items: AddCorridorOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const rid = item.id?.trim() ? item.id.trim() : createRandomXgxId('cor')
        const e = this.add(viewer, { ...item, id: rid })
        if (e) ids.push(rid)
      } catch (e) {
        console.error(`[FastX.Draw.Corridor] addCorridors 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updateCorridor(id: string, properties: UpdateCorridorProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      const line = resolveDraftLineCartesians(p, 1)
      if (line?.length) {
        td.positions = line.map((c) => {
          const carto = Cesium.Cartographic.fromCartesian(c)
          return [
            Cesium.Math.toDegrees(carto.longitude),
            Cesium.Math.toDegrees(carto.latitude),
            carto.height,
          ] as number[]
        })
        setDraftPoints(rec, line)
      } else if (p.positions !== undefined) {
        const fromPos = lineToCartesian3Array(p.positions, 1)
        if (!fromPos) return false
        td.positions = lineToNumberTuples(p.positions)
        setDraftPoints(rec, fromPos)
      }
      return commitAreaDraftCorridorRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

    if (p.targetData !== undefined) Object.assign(td, p.targetData)

    if (p.positions !== undefined) {
      const line = lineToCartesian3Array(p.positions)
      if (!line) return false
      td.positions = lineToNumberTuples(p.positions)
    }
    if (p.width !== undefined) td.width = p.width
    if (p.height !== undefined) td.height = p.height
    if (p.extrudedHeight !== undefined) td.extrudedHeight = p.extrudedHeight
    if (p.cornerType !== undefined) td.cornerType = parseCornerType(p.cornerType)
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

    const cg = rec.entity.corridor ?? (rec.entity.corridor = new Cesium.CorridorGraphics())
    const needRebuild = p.positions !== undefined

    const positionsNums = td.positions as number[][] | undefined
    const lineCartesian =
      needRebuild && positionsNums
        ? lineToCartesian3Array(
            positionsNums.map((t) => [Number(t[0]), Number(t[1]), Number(t[2] ?? 0)] as CorridorLngLatTuple),
          )
        : undefined

    const showFill = td.showFill !== false
    const alpha = typeof td.alpha === 'number' ? td.alpha : 1
    const fillColor =
      toColor(String(td.color ?? '#00b96b'), showFill ? alpha : 0) ??
      Cesium.Color.LIME.withAlpha(showFill ? alpha : 0)
    const outline = td.outline !== false
    const outlineColor =
      toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
      Cesium.Color.WHITE
    const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
    const width = typeof td.width === 'number' ? td.width : sampleProperty<number>(cg.width) ?? 1
    const height = typeof td.height === 'number' ? td.height : sampleProperty<number>(cg.height) ?? 0
    const extrRaw = td.extrudedHeight
    const extrudedHeight =
      typeof extrRaw === 'number' && Number.isFinite(extrRaw) ? extrRaw : sampleProperty<number>(cg.extrudedHeight)
    const cornerType =
      typeof td.cornerType === 'number'
        ? (td.cornerType as Cesium.CornerType)
        : parseCornerType(td.cornerType as keyof typeof Cesium.CornerType)

    const needCorridor =
      needRebuild ||
      p.width !== undefined ||
      p.height !== undefined ||
      p.extrudedHeight !== undefined ||
      p.cornerType !== undefined ||
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.showFill !== undefined ||
      p.outline !== undefined ||
      p.outlineColor !== undefined ||
      p.outlineAlpha !== undefined ||
      p.outlineWidth !== undefined ||
      p.style !== undefined

    if (needCorridor) {
      let positions: Cesium.Cartesian3[] | undefined
      if (lineCartesian) {
        positions = lineCartesian
      } else {
        const arr = sampleProperty<Cesium.Cartesian3[]>(cg.positions)
        if (!arr?.length) return false
        positions = arr
      }
      mergeCorridorGraphics(
        cg,
        {
          positions,
          width,
          height,
          extrudedHeight:
            extrudedHeight !== undefined && Number.isFinite(extrudedHeight) ? extrudedHeight : undefined,
          cornerType,
          fillColor,
          showFill,
          outline,
          outlineColor,
          outlineWidth,
          style: td.styleSnapshot as CorridorStyleOptions | undefined,
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

  private applyStylePatchToTargetData(rec: CorridorRecord, p: UpdateCorridorProperties): void {
    const td = rec.targetData
    if (p.targetData !== undefined) Object.assign(td, p.targetData)
    if (p.width !== undefined) td.width = p.width
    if (p.height !== undefined) td.height = p.height
    if (p.extrudedHeight !== undefined) td.extrudedHeight = p.extrudedHeight
    if (p.cornerType !== undefined) td.cornerType = parseCornerType(p.cornerType)
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

  private updateAreaDraft(rec: CorridorRecord, p: UpdateCorridorProperties): boolean {
    const td = rec.targetData
    markAreaDraftTargetData(td)
    this.applyStylePatchToTargetData(rec, p)

    const line = resolveDraftLineCartesians(p, 1)
    if (line?.length) {
      setDraftPoints(rec, line)
      td.positions = line.map((c) => {
        const carto = Cesium.Cartographic.fromCartesian(c)
        return [
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height,
        ] as number[]
      })
    } else if (p.positions !== undefined) {
      const fromPos = lineToCartesian3Array(p.positions, 1)
      if (!fromPos) return false
      setDraftPoints(rec, fromPos)
      td.positions = lineToNumberTuples(p.positions)
    }

    applyAreaDraftCorridorGraphics(rec)

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updateCorridors(updates: Array<{ id: string } & UpdateCorridorProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateCorridor(id, rest) }))
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

  getCorridor(id: string): CorridorSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const cg = rec.entity.corridor
    const posArr = cg ? sampleProperty<Cesium.Cartesian3[]>(cg.positions) : undefined
    const positions: number[][] = []
    if (posArr?.length) {
      for (const c of posArr) {
        const carto = Cesium.Cartographic.fromCartesian(c)
        positions.push([
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height,
        ])
      }
    }
    if (positions.length === 0) {
      const fb = positionsFromTargetData(rec.targetData)
      for (const row of fb) positions.push(row)
    }
    const fillCol = cg ? readCorridorMaterialColor(cg) : undefined
    const outline = cg ? sampleProperty<boolean>(cg.outline) : undefined
    const outlineColor = cg ? sampleProperty<Color>(cg.outlineColor) : undefined
    const outlineWidth = cg ? sampleProperty<number>(cg.outlineWidth) : undefined
    const width = cg ? sampleProperty<number>(cg.width) : undefined
    const height = cg ? sampleProperty<number>(cg.height) : undefined
    const extruded = cg ? sampleProperty<number>(cg.extrudedHeight) : undefined
    const cornerTypeSampled = cg ? sampleProperty<Cesium.CornerType>(cg.cornerType) : undefined
    const cornerKey = cornerTypeSnapshotFromRecord(cornerTypeSampled, rec.targetData)
    const desc = sampleProperty<string>(rec.entity.description)
    const rawShowFill = rec.targetData.showFill

    return {
      id: rec.entity.id,
      positions,
      vertexCount: positions.length,
      width: typeof width === 'number' ? width : Number(rec.targetData.width) || 0,
      height: typeof height === 'number' ? height : Number(rec.targetData.height) || 0,
      extrudedHeight:
        typeof extruded === 'number' ? extruded : Number(rec.targetData.extrudedHeight) || 0,
      cornerType: cornerKey,
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

  getAllCorridors(viewer?: Viewer): CorridorSnapshot[] {
    const out: CorridorSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getCorridor(id)
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
