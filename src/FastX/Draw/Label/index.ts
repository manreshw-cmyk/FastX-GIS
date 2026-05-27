import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type { PointPositionInput, PointPositionsTuple } from '../Point'

import type { AddLabelOptions, LabelSnapshot, LabelStyleOptions, UpdateLabelProperties } from '../../Types'
import {
  type AreaDraftPointsHolder,
  clearAreaDraftTargetData,
  commitEntityPosition,
  createDraftPositionProperty,
  getDraftPoints,
  isAreaDraftTargetData,
  markAreaDraftTargetData,
  setDraftPoints,
} from '../../Utils/areaDraft'
export type { AddLabelOptions, LabelSnapshot, LabelStyleOptions, UpdateLabelProperties }

export type LabelPositionsTuple = PointPositionsTuple

interface LabelRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
}

function resolveUpdateCartesian(p: UpdateLabelProperties): Cesium.Cartesian3 | undefined {
  if (p.position !== undefined) return toCartesian3(p.position)
  if (p.positions !== undefined) {
    if (p.positions.length < 2) return undefined
    return positionFromTuple(p.positions)
  }
  if (p.longitude !== undefined && p.latitude !== undefined) {
    const h = p.height !== undefined ? p.height : 0
    return Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), Number(h))
  }
  return undefined
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

function positionFromTuple(positions: LabelPositionsTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  const h = positions[2] ?? 0
  return Cesium.Cartesian3.fromDegrees(Number(positions[0]), Number(positions[1]), Number(h), undefined, result)
}

function resolveAddCartesian(options: AddLabelOptions): Cesium.Cartesian3 | undefined {
  if (options.position !== undefined && options.positions !== undefined) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.positions !== undefined && options.positions.length >= 2) {
    return positionFromTuple(options.positions)
  }
  return undefined
}

function parseLabelStyle(
  s: keyof typeof Cesium.LabelStyle | Cesium.LabelStyle | undefined,
  fallback: Cesium.LabelStyle,
): Cesium.LabelStyle {
  if (s === undefined) return fallback
  if (typeof s === 'number') return s
  return Cesium.LabelStyle[s] ?? fallback
}

function parseHoriz(s: keyof typeof Cesium.HorizontalOrigin | undefined): Cesium.HorizontalOrigin {
  if (!s) return Cesium.HorizontalOrigin.CENTER
  return Cesium.HorizontalOrigin[s] ?? Cesium.HorizontalOrigin.CENTER
}

function parseVert(s: keyof typeof Cesium.VerticalOrigin | undefined): Cesium.VerticalOrigin {
  if (!s) return Cesium.VerticalOrigin.BASELINE
  return Cesium.VerticalOrigin[s] ?? Cesium.VerticalOrigin.BASELINE
}

function parseHeightRef(s: keyof typeof Cesium.HeightReference | undefined): Cesium.HeightReference {
  if (!s) return Cesium.HeightReference.NONE
  return Cesium.HeightReference[s] ?? Cesium.HeightReference.NONE
}

function mergeLabelGraphics(
  lg: Cesium.LabelGraphics,
  options: AddLabelOptions | UpdateLabelProperties,
  isCreate: boolean,
): void {
  const defaults = {
    text: 'Label',
    font: '14px sans-serif',
    fill: Cesium.Color.WHITE,
    outline: Cesium.Color.BLACK,
    outlineWidth: 1,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    scale: 1,
  }

  if (isCreate) {
    lg.text = new Cesium.ConstantProperty(options.text ?? defaults.text)
    lg.font = new Cesium.ConstantProperty(options.font ?? defaults.font)
    const fillCss = (options as AddLabelOptions).fillColor ?? (options as AddLabelOptions).fontColor
    const alpha = (options as AddLabelOptions).alpha ?? 1
    const fillCol = toColor(fillCss, alpha) ?? defaults.fill
    lg.fillColor = new Cesium.ConstantProperty(fillCol)
    const oc = toColor(options.outlineColor as string | undefined, options.outlineAlpha) ?? defaults.outline
    lg.outlineColor = new Cesium.ConstantProperty(oc)
    lg.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth ?? defaults.outlineWidth)
    lg.style = new Cesium.ConstantProperty(parseLabelStyle(options.style as keyof typeof Cesium.LabelStyle | undefined, defaults.style))
    lg.showBackground = new Cesium.ConstantProperty(options.showBackground ?? false)
    const bg = toColor(options.backgroundColor as string | undefined, 1)
    if (bg !== undefined) lg.backgroundColor = new Cesium.ConstantProperty(bg)
    const pad = options.backgroundPadding
    if (pad !== undefined) {
      lg.backgroundPadding = new Cesium.ConstantProperty(new Cesium.Cartesian2(pad[0], pad[1]))
    }
    const po = options.pixelOffset
    lg.pixelOffset = new Cesium.ConstantProperty(
      po !== undefined ? new Cesium.Cartesian2(po[0], po[1]) : Cesium.Cartesian2.ZERO,
    )
    lg.scale = new Cesium.ConstantProperty(options.scale ?? defaults.scale)
    lg.horizontalOrigin = new Cesium.ConstantProperty(parseHoriz(options.horizontalOrigin))
    lg.verticalOrigin = new Cesium.ConstantProperty(parseVert(options.verticalOrigin))
    lg.heightReference = new Cesium.ConstantProperty(parseHeightRef(options.heightReference))
    lg.disableDepthTestDistance = new Cesium.ConstantProperty(
      options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
    )
    return
  }

  if (options.text !== undefined) lg.text = new Cesium.ConstantProperty(options.text)
  if (options.font !== undefined) lg.font = new Cesium.ConstantProperty(options.font)
  const fillSrc = options.fillColor ?? options.fontColor
  if (fillSrc !== undefined || options.alpha !== undefined) {
    const a = options.alpha ?? 1
    const col = toColor(fillSrc as string | Color | undefined, a)
    if (col) lg.fillColor = new Cesium.ConstantProperty(col)
  }
  const ocUp = toColor(options.outlineColor as string | Color | undefined, options.outlineAlpha)
  if (ocUp !== undefined) lg.outlineColor = new Cesium.ConstantProperty(ocUp)
  if (options.outlineWidth !== undefined) lg.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth)
  if (options.style !== undefined) {
    lg.style = new Cesium.ConstantProperty(
      parseLabelStyle(options.style as keyof typeof Cesium.LabelStyle | undefined, Cesium.LabelStyle.FILL_AND_OUTLINE),
    )
  }
  if (options.showBackground !== undefined) lg.showBackground = new Cesium.ConstantProperty(options.showBackground)
  const bgUp = toColor(options.backgroundColor as string | Color | undefined, 1)
  if (bgUp !== undefined) lg.backgroundColor = new Cesium.ConstantProperty(bgUp)
  if (options.backgroundPadding !== undefined) {
    const pad = options.backgroundPadding
    lg.backgroundPadding = new Cesium.ConstantProperty(new Cesium.Cartesian2(pad[0], pad[1]))
  }
  if (options.pixelOffset !== undefined) {
    const po = options.pixelOffset
    lg.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(po[0], po[1]))
  }
  if (options.scale !== undefined) lg.scale = new Cesium.ConstantProperty(options.scale)
  if (options.horizontalOrigin !== undefined) {
    lg.horizontalOrigin = new Cesium.ConstantProperty(parseHoriz(options.horizontalOrigin))
  }
  if (options.verticalOrigin !== undefined) {
    lg.verticalOrigin = new Cesium.ConstantProperty(parseVert(options.verticalOrigin))
  }
  if (options.heightReference !== undefined) {
    lg.heightReference = new Cesium.ConstantProperty(parseHeightRef(options.heightReference))
  }
  if (options.disableDepthTestDistance !== undefined) {
    lg.disableDepthTestDistance = new Cesium.ConstantProperty(options.disableDepthTestDistance)
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

/**
 * 基础绘制 — 文字标签（`Entity` + `LabelGraphics`），API 与 `Point` 对齐思路：
 * `add` / `addLabels`、`updateLabel`、`getLabel` / `getAllLabels`、`clear`、`pruneInvalid` 等。
 */
export default class Label {
  private readonly data = new Map<string, LabelRecord>()

  private isRecordAlive(rec: LabelRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): LabelRecord | undefined {
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

  add(viewer: Viewer, options: AddLabelOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id : createRandomXgxId('lbl')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const position = resolveAddCartesian(options)
    if (!position) return undefined

    const lg = new Cesium.LabelGraphics()
    mergeLabelGraphics(lg, options, true)

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      label: lg,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)
    this.data.set(id, { viewer, entity, targetData: this.cloneTargetData(options.targetData) })
    return entity
  }

  private addAreaDraft(viewer: Viewer, id: string, options: AddLabelOptions): Entity | undefined {
    const position = resolveAddCartesian(options)
    if (!position) return undefined

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    const lg = new Cesium.LabelGraphics()
    mergeLabelGraphics(lg, options, true)

    const rec: LabelRecord = {
      viewer,
      entity: new Cesium.Entity({ id, show: options.show !== false }),
      targetData: td,
    }
    setDraftPoints(rec, [position])
    rec.entity.position = createDraftPositionProperty(() => getDraftPoints(rec))
    rec.entity.label = lg
    if (options.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(rec.entity)
    this.data.set(id, rec)
    return rec.entity
  }

  private applyLabelPatch(rec: LabelRecord, p: UpdateLabelProperties): void {
    const lg = rec.entity.label ?? (rec.entity.label = new Cesium.LabelGraphics())
    const patch: UpdateLabelProperties & { _fillCss?: string } = { ...p }
    if (p.fillColor !== undefined || p.fontColor !== undefined) {
      patch._fillCss = (p.fillColor ?? p.fontColor) as string
    }
    mergeLabelGraphics(lg, patch, false)
  }

  private commitAreaDraft(rec: LabelRecord, p: UpdateLabelProperties): boolean {
    const pts = getDraftPoints(rec)
    const pos = resolveUpdateCartesian(p) ?? (pts.length ? pts[pts.length - 1] : undefined)
    if (!pos) return false
    commitEntityPosition(rec.entity, pos)
    clearAreaDraftTargetData(rec.targetData)
    delete rec.draftPoints
    this.applyLabelPatch(rec, p)
    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(p.description)
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    return true
  }

  private updateAreaDraft(rec: LabelRecord, p: UpdateLabelProperties): boolean {
    markAreaDraftTargetData(rec.targetData)
    const pos = resolveUpdateCartesian(p)
    if (pos) setDraftPoints(rec, [pos])
    else if (!getDraftPoints(rec).length) {
      const cur = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
      if (cur) setDraftPoints(rec, [cur])
    }
    rec.entity.position = createDraftPositionProperty(() => getDraftPoints(rec))
    this.applyLabelPatch(rec, p)
    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(p.description)
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    return true
  }

  addBatch(viewer: Viewer, items: AddLabelOptions[]): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed()) return { succeeded: [], failedIds: [] }
    const succeeded: Entity[] = []
    const failedIds: string[] = []
    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId('lbl')
      const e = this.add(viewer, { ...item, id: resolvedId })
      if (e) succeeded.push(e)
      else failedIds.push(resolvedId)
    }
    return { succeeded, failedIds }
  }

  /** 批量添加，入参形态贴近旧版 `LabelCollection#addLabels` 的数组项（`positions`、`label` 文本等可映射到本类字段） */
  addLabels(viewer: Viewer, items: AddLabelOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const createdIds: string[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const id = item.id?.trim() ? item.id : createRandomXgxId('lbl')
      const ent = this.add(viewer, { ...item, id })
      if (ent) createdIds.push(id)
    }
    return createdIds
  }

  updateLabel(id: string, properties: UpdateLabelProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false

    const p = properties
    const td = rec.targetData
    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      return this.commitAreaDraft(rec, p)
    }
    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p)
    }

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

    this.applyLabelPatch(rec, p)

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(p.description)
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    return true
  }

  updateLabels(updates: Array<{ id: string } & UpdateLabelProperties>): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u
      return { id, success: this.updateLabel(id, rest) }
    })
  }

  getLabel(id: string): LabelSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos) return null
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const lg = rec.entity.label
    const text = lg ? sampleProperty<string>(lg.text) : undefined
    const font = lg ? sampleProperty<string>(lg.font) : undefined
    const fill = lg ? sampleProperty<Color>(lg.fillColor) : undefined
    const outlineColor = lg ? sampleProperty<Color>(lg.outlineColor) : undefined
    const outlineWidth = lg ? sampleProperty<number>(lg.outlineWidth) : undefined
    const scale = lg ? sampleProperty<number>(lg.scale) : undefined
    const style = lg ? sampleProperty<Cesium.LabelStyle>(lg.style) : undefined
    const showBg = lg ? sampleProperty<boolean>(lg.showBackground) : undefined
    const bg = lg ? sampleProperty<Color>(lg.backgroundColor) : undefined
    const pix = lg ? sampleProperty<Cesium.Cartesian2>(lg.pixelOffset) : undefined
    const desc = sampleProperty<string>(rec.entity.description)

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      text: text ?? '',
      font,
      fillColorCss: colorToCss(fill),
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      scale,
      style: style !== undefined ? String(style) : undefined,
      showBackground: showBg,
      backgroundColorCss: colorToCss(bg),
      pixelOffsetX: pix?.x,
      pixelOffsetY: pix?.y,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllLabels(viewer?: Viewer): LabelSnapshot[] {
    const out: LabelSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getLabel(id)
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
