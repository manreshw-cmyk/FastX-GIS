import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type { PointPositionInput } from '../Point'
import { svgMarkupToDataUri } from './svgDataUri'

import type { AddBillboardOptions, BillboardPositionsTuple, BillboardSnapshot, BillboardStyleOptions, UpdateBillboardProperties } from '../../Types'
export type { AddBillboardOptions, BillboardPositionsTuple, BillboardSnapshot, BillboardStyleOptions, UpdateBillboardProperties }

interface BillboardRecord {
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

function positionFromTuple(positions: BillboardPositionsTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  const h = positions[2] ?? 0
  return Cesium.Cartesian3.fromDegrees(Number(positions[0]), Number(positions[1]), Number(h), undefined, result)
}

function resolveAddCartesian(options: AddBillboardOptions): Cesium.Cartesian3 | undefined {
  if (options.position !== undefined && options.positions !== undefined) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.positions !== undefined && options.positions.length >= 2) {
    return positionFromTuple(options.positions)
  }
  return undefined
}

function resolveImageUri(options: { image?: string; svg?: string }): string | undefined {
  if (options.image !== undefined && String(options.image).trim()) {
    return String(options.image).trim()
  }
  if (options.svg !== undefined && String(options.svg).trim()) {
    return svgMarkupToDataUri(String(options.svg))
  }
  return undefined
}

function parseHoriz(s: keyof typeof Cesium.HorizontalOrigin | undefined): Cesium.HorizontalOrigin {
  if (!s) return Cesium.HorizontalOrigin.CENTER
  return Cesium.HorizontalOrigin[s] ?? Cesium.HorizontalOrigin.CENTER
}

function parseVert(s: keyof typeof Cesium.VerticalOrigin | undefined): Cesium.VerticalOrigin {
  if (!s) return Cesium.VerticalOrigin.CENTER
  return Cesium.VerticalOrigin[s] ?? Cesium.VerticalOrigin.CENTER
}

function parseHeightRef(s: keyof typeof Cesium.HeightReference | undefined): Cesium.HeightReference {
  if (!s) return Cesium.HeightReference.NONE
  return Cesium.HeightReference[s] ?? Cesium.HeightReference.NONE
}

function mergeBillboardGraphics(
  bg: Cesium.BillboardGraphics,
  options: AddBillboardOptions | UpdateBillboardProperties,
  imageUri: string | undefined,
  isCreate: boolean,
): void {
  const defaults = { scale: 1, color: Cesium.Color.WHITE }
  if (imageUri !== undefined) {
    bg.image = new Cesium.ConstantProperty(imageUri)
  }
  const st = options.style
  const scale = st?.scale ?? (options as AddBillboardOptions).scale ?? (isCreate ? defaults.scale : undefined)
  if (scale !== undefined) bg.scale = new Cesium.ConstantProperty(scale)

  const col = st?.color ?? toColor((options as AddBillboardOptions).color, (options as AddBillboardOptions).alpha)
  if (col !== undefined) bg.color = new Cesium.ConstantProperty(col)
  else if (isCreate) bg.color = new Cesium.ConstantProperty(defaults.color)

  const po = st?.pixelOffset ?? (() => {
    const p = (options as AddBillboardOptions).pixelOffset
    return p !== undefined ? new Cesium.Cartesian2(p[0], p[1]) : undefined
  })()
  if (po !== undefined) bg.pixelOffset = new Cesium.ConstantProperty(po)

  if (st?.eyeOffset !== undefined) bg.eyeOffset = new Cesium.ConstantProperty(st.eyeOffset)
  const ho = st?.horizontalOrigin ?? (() => {
    const k = (options as AddBillboardOptions).horizontalOrigin
    return k !== undefined ? parseHoriz(k) : undefined
  })()
  if (ho !== undefined) bg.horizontalOrigin = new Cesium.ConstantProperty(ho)
  else if (isCreate) bg.horizontalOrigin = new Cesium.ConstantProperty(Cesium.HorizontalOrigin.CENTER)

  const vo = st?.verticalOrigin ?? (() => {
    const k = (options as AddBillboardOptions).verticalOrigin
    return k !== undefined ? parseVert(k) : undefined
  })()
  if (vo !== undefined) bg.verticalOrigin = new Cesium.ConstantProperty(vo)
  else if (isCreate) bg.verticalOrigin = new Cesium.ConstantProperty(Cesium.VerticalOrigin.CENTER)

  const hr =
    st?.heightReference ??
    (() => {
      const k = (options as AddBillboardOptions).heightReference
      return k !== undefined ? parseHeightRef(k) : undefined
    })()
  if (hr !== undefined) bg.heightReference = new Cesium.ConstantProperty(hr)
  else if (isCreate) bg.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)

  const rotDeg =
    (options as AddBillboardOptions).rotationDegrees ?? (options as UpdateBillboardProperties).rotationDegrees
  if (rotDeg !== undefined) {
    bg.rotation = new Cesium.ConstantProperty(Cesium.Math.toRadians(rotDeg))
  } else if (st?.rotation !== undefined) {
    bg.rotation = new Cesium.ConstantProperty(st.rotation)
  }
  if (st?.alignedAxis !== undefined) bg.alignedAxis = new Cesium.ConstantProperty(st.alignedAxis)
  if (st?.sizeInMeters !== undefined) bg.sizeInMeters = new Cesium.ConstantProperty(st.sizeInMeters)
  const w = st?.width ?? (options as AddBillboardOptions).width ?? (options as UpdateBillboardProperties).width
  if (w !== undefined) bg.width = new Cesium.ConstantProperty(w)
  const hPx =
    st?.height ??
    (options as AddBillboardOptions).imageHeight ??
    (options as UpdateBillboardProperties).imageHeight
  if (hPx !== undefined) bg.height = new Cesium.ConstantProperty(hPx)
  if (st?.scaleByDistance !== undefined) bg.scaleByDistance = new Cesium.ConstantProperty(st.scaleByDistance)
  if (st?.translucencyByDistance !== undefined) {
    bg.translucencyByDistance = new Cesium.ConstantProperty(st.translucencyByDistance)
  }
  if (st?.pixelOffsetScaleByDistance !== undefined) {
    bg.pixelOffsetScaleByDistance = new Cesium.ConstantProperty(st.pixelOffsetScaleByDistance)
  }
  if (st?.distanceDisplayCondition !== undefined) {
    bg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.disableDepthTestDistance !== undefined) {
    bg.disableDepthTestDistance = new Cesium.ConstantProperty(st.disableDepthTestDistance)
  }
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

function summarizeImageUri(uri: string | undefined, max = 96): string | undefined {
  if (!uri) return undefined
  if (uri.length <= max) return uri
  return `${uri.slice(0, max)}…`
}

/**
 * 基础绘制 — 广告牌（`Entity` + `BillboardGraphics`），API 形态对齐 `Point` / `Label`。
 */
export default class Billboard {
  private readonly data = new Map<string, BillboardRecord>()

  private isRecordAlive(rec: BillboardRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): BillboardRecord | undefined {
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

  add(viewer: Viewer, options: AddBillboardOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id : createRandomXgxId('bb')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    const position = resolveAddCartesian(options)
    if (!position) return undefined
    const imageUri = resolveImageUri(options)
    if (!imageUri) return undefined

    const bg = new Cesium.BillboardGraphics()
    mergeBillboardGraphics(bg, options, imageUri, true)

    const td = this.cloneTargetData(options.targetData)
    td.imageUri = imageUri
    if (options.rotationDegrees !== undefined) {
      td.rotationDegrees = options.rotationDegrees
    }

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      billboard: bg,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)
    this.data.set(id, { viewer, entity, targetData: td })
    return entity
  }

  addBatch(
    viewer: Viewer,
    items: AddBillboardOptions[],
  ): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed()) return { succeeded: [], failedIds: [] }
    const succeeded: Entity[] = []
    const failedIds: string[] = []
    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId('bb')
      const e = this.add(viewer, { ...item, id: resolvedId })
      if (e) succeeded.push(e)
      else failedIds.push(resolvedId)
    }
    return { succeeded, failedIds }
  }

  addBillboards(viewer: Viewer, items: AddBillboardOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id : createRandomXgxId('bb')
        const ent = this.add(viewer, { ...item, id })
        if (ent) ids.push(id)
      } catch (e) {
        console.error(`[FastX.Draw.Billboard] addBillboards 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updateBillboard(id: string, properties: UpdateBillboardProperties): boolean {
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

    const nextUri = resolveImageUri({ image: p.image, svg: p.svg })
    const bg = rec.entity.billboard ?? (rec.entity.billboard = new Cesium.BillboardGraphics())
    mergeBillboardGraphics(bg, p, nextUri, false)

    if (nextUri !== undefined) {
      rec.targetData = { ...rec.targetData, imageUri: nextUri }
    }

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(p.description)
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    if (p.rotationDegrees !== undefined) {
      rec.targetData = { ...rec.targetData, rotationDegrees: p.rotationDegrees }
    }
    return true
  }

  updateBillboards(updates: Array<{ id: string } & UpdateBillboardProperties>): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u
      return { id, success: this.updateBillboard(id, rest) }
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

  getBillboard(id: string): BillboardSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos) return null
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const bb = rec.entity.billboard
    const img = bb ? sampleProperty<string>(bb.image) : undefined
    const storedUri = typeof rec.targetData.imageUri === 'string' ? rec.targetData.imageUri : undefined
    const uriForSummary = img ?? storedUri
    const scale = bb ? sampleProperty<number>(bb.scale) : undefined
    const color = bb ? sampleProperty<Color>(bb.color) : undefined
    const width = bb ? sampleProperty<number>(bb.width) : undefined
    const heightPx = bb ? sampleProperty<number>(bb.height) : undefined
    const pix = bb ? sampleProperty<Cesium.Cartesian2>(bb.pixelOffset) : undefined
    const rotRad = bb ? sampleProperty<number>(bb.rotation) : undefined
    const rotationDegrees =
      rotRad !== undefined
        ? Cesium.Math.toDegrees(rotRad)
        : typeof rec.targetData.rotationDegrees === 'number' && Number.isFinite(rec.targetData.rotationDegrees)
          ? rec.targetData.rotationDegrees
          : undefined
    const desc = sampleProperty<string>(rec.entity.description)

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      imageSummary: summarizeImageUri(uriForSummary),
      scale,
      colorCss: colorToCss(color),
      width,
      heightPx,
      pixelOffsetX: pix?.x,
      pixelOffsetY: pix?.y,
      rotationDegrees,
      show: rec.entity.show,
      targetData: {
        ...rec.targetData,
        ...(uriForSummary ? { imageUri: uriForSummary } : {}),
        ...(rotationDegrees !== undefined ? { rotationDegrees } : {}),
      },
      description: desc,
    }
  }

  getAllBillboards(viewer?: Viewer): BillboardSnapshot[] {
    const out: BillboardSnapshot[] = []
    for (const bid of this.getIds(viewer)) {
      const s = this.getBillboard(bid)
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
