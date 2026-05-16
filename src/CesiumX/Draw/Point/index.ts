import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId, type LngLatHeight } from '../../Coordinates'

/** 与 `PointCollection` 一致：[经度, 纬度, 高度?]（度 / 米） */
export type PointPositionsTuple = readonly [lng: number, lat: number, height?: number]

/** 点位置：世界坐标或经纬度（度）+ 高（米） */
export type PointPositionInput = Cesium.Cartesian3 | LngLatHeight

/** 点图元样式（与 `PointGraphics` 常用字段对齐） */
export interface PointStyleOptions {
  pixelSize?: number
  color?: Color
  outlineColor?: Color
  outlineWidth?: number
  heightReference?: Cesium.HeightReference
  disableDepthTestDistance?: number
  scaleByDistance?: Cesium.NearFarScalar
  translucencyByDistance?: Cesium.NearFarScalar
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

/**
 * 添加点参数（`Entity` + `PointGraphics`）。
 * - 位置：`position` 或 `positions` 二选一（`positions` 与旧版 PointCollection 一致）。
 * - `id` 可省略，将自动生成。
 * - `color` / `outlineColor` 支持 CSS 色串，配合 `alpha` / `outlineAlpha`。
 * - `targetData`：业务自定义属性，内部深拷贝合并，不参与 Cesium 渲染。
 */
export interface AddPointOptions {
  id?: string
  position?: PointPositionInput
  positions?: PointPositionsTuple
  style?: PointStyleOptions
  /** CSS 颜色，如 `#ff0000` */
  color?: string
  alpha?: number
  pixelSize?: number
  /** 是否绘制轮廓；`false` 时等效 `outlineWidth: 0` */
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  /** 自定义业务数据（对应原 `primitive._targetData`） */
  targetData?: Record<string, unknown>
}

/** `updatePoint` / `updatePoints` 可写字段 */
export interface UpdatePointProperties {
  longitude?: number
  latitude?: number
  height?: number
  /** 优先于 lon/lat/height */
  position?: PointPositionInput
  positions?: PointPositionsTuple
  color?: string | Color
  alpha?: number
  pixelSize?: number
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PointStyleOptions
}

/** `getPoint` / `getAllPoints` 返回的纯数据快照 */
export interface PointSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  colorCss?: string
  pixelSize?: number
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

interface PointRecord {
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

function positionFromTuple(positions: PointPositionsTuple, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  const h = positions[2] ?? 0
  return Cesium.Cartesian3.fromDegrees(Number(positions[0]), Number(positions[1]), Number(h), undefined, result)
}

function resolveAddCartesian(options: AddPointOptions): Cesium.Cartesian3 | undefined {
  if (options.position !== undefined && options.positions !== undefined) return undefined
  if (options.position !== undefined) return toCartesian3(options.position)
  if (options.positions !== undefined && options.positions.length >= 2) {
    return positionFromTuple(options.positions)
  }
  return undefined
}

function buildStyleFromAddOptions(options: AddPointOptions): PointStyleOptions | undefined {
  const s: PointStyleOptions = { ...(options.style ?? {}) }
  if (options.pixelSize !== undefined) s.pixelSize = options.pixelSize
  const col = toColor(options.color, options.alpha)
  if (col) s.color = col
  const oc = toColor(options.outlineColor, options.outlineAlpha)
  if (oc) s.outlineColor = oc
  if (options.outlineWidth !== undefined) s.outlineWidth = options.outlineWidth
  return Object.keys(s).length ? s : options.style
}

function mergePointGraphics(
  pointGraphics: Cesium.PointGraphics,
  style: PointStyleOptions | undefined,
  options: { outline?: boolean; outlineWidth?: number } | undefined,
  isCreate: boolean,
): void {
  const defaults = {
    pixelSize: 10,
    color: Cesium.Color.YELLOW,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
  }
  const px = style?.pixelSize ?? (isCreate ? defaults.pixelSize : undefined)
  if (px !== undefined) pointGraphics.pixelSize = new Cesium.ConstantProperty(px)

  const col = style?.color ?? (isCreate ? defaults.color : undefined)
  if (col !== undefined) pointGraphics.color = new Cesium.ConstantProperty(col)

  const oc = style?.outlineColor ?? (isCreate ? defaults.outlineColor : undefined)
  if (oc !== undefined) pointGraphics.outlineColor = new Cesium.ConstantProperty(oc)

  const ow0 = style?.outlineWidth
  if (options?.outline === false) {
    pointGraphics.outlineWidth = new Cesium.ConstantProperty(0)
  } else if (ow0 !== undefined) {
    pointGraphics.outlineWidth = new Cesium.ConstantProperty(ow0)
  } else if (options?.outline === true && isCreate) {
    pointGraphics.outlineWidth = new Cesium.ConstantProperty(1)
  } else if (isCreate) {
    pointGraphics.outlineWidth = new Cesium.ConstantProperty(defaults.outlineWidth)
  }

  if (style?.heightReference !== undefined) {
    pointGraphics.heightReference = new Cesium.ConstantProperty(style.heightReference)
  }
  if (style?.disableDepthTestDistance !== undefined) {
    pointGraphics.disableDepthTestDistance = new Cesium.ConstantProperty(style.disableDepthTestDistance)
  }
  if (style?.scaleByDistance !== undefined) {
    pointGraphics.scaleByDistance = new Cesium.ConstantProperty(style.scaleByDistance)
  }
  if (style?.translucencyByDistance !== undefined) {
    pointGraphics.translucencyByDistance = new Cesium.ConstantProperty(style.translucencyByDistance)
  }
  if (style?.distanceDisplayCondition !== undefined) {
    pointGraphics.distanceDisplayCondition = new Cesium.ConstantProperty(style.distanceDisplayCondition)
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
 * 基础绘制 — 点（`Entity` + `PointGraphics`），API 形态参考 `PointCollection`：
 * `addPoints`、`targetData`、`updatePoint`/`updatePoints`、`getPoint`/`getAllPoints`、`getCount`、`setAllVisibility` 等。
 * 内部 `Map<id, { viewer, entity, targetData }>`；清空 `entities` 后请 `pruneInvalid()`。
 */
export default class Point {
  private readonly data = new Map<string, PointRecord>()

  private isRecordAlive(rec: PointRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): PointRecord | undefined {
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

  /**
   * 添加一个点。`id` 已存在或 `entities` 中已有同 id 时返回 `undefined`。
   */
  add(viewer: Viewer, options: AddPointOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id : createRandomXgxId('pt')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    const position = resolveAddCartesian(options)
    if (!position) return undefined
    const mergedStyle = buildStyleFromAddOptions(options)
    const pointGraphics = new Cesium.PointGraphics()
    mergePointGraphics(pointGraphics, mergedStyle, options, true)

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      point: pointGraphics,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)
    this.data.set(id, { viewer, entity, targetData: this.cloneTargetData(options.targetData) })
    return entity
  }

  /**
   * 批量添加（与 `add` 相同语义）。
   */
  addBatch(
    viewer: Viewer,
    items: AddPointOptions[],
  ): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed()) return { succeeded: [], failedIds: [] }
    const succeeded: Entity[] = []
    const failedIds: string[] = []
    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId('pt')
      const e = this.add(viewer, { ...item, id: resolvedId })
      if (e) succeeded.push(e)
      else failedIds.push(resolvedId)
    }
    return { succeeded, failedIds }
  }

  /**
   * 批量加点，入参形态贴近旧版 `PointCollection#addPoints`（`positions`、`targetData`、字符串颜色等）。
   * @returns 成功创建的 id 列表（与参考实现一致，便于链式处理）
   */
  addPoints(viewer: Viewer, options: AddPointOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(options) || options.length === 0) {
      return []
    }
    const createdIds: string[] = []
    for (let i = 0; i < options.length; i++) {
      try {
        const item = options[i]!
        const id = item.id?.trim() ? item.id : createRandomXgxId('pt')
        const entity = this.add(viewer, { ...item, id })
        if (entity) createdIds.push(id)
      } catch (e) {
        console.error(`[XGX.Draw.Point] addPoints 第 ${i} 项失败:`, e)
      }
    }
    return createdIds
  }

  /**
   * 按 id 更新点（位置、样式、显隐、`targetData` 合并等），对应 `PointCollection#updatePoint`。
   */
  updatePoint(id: string, properties: UpdatePointProperties): boolean {
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

    const pg = rec.entity.point ?? (rec.entity.point = new Cesium.PointGraphics())
    if (
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.pixelSize !== undefined ||
      p.outline !== undefined ||
      p.outlineColor !== undefined ||
      p.outlineAlpha !== undefined ||
      p.outlineWidth !== undefined ||
      p.style !== undefined
    ) {
      const stylePatch: PointStyleOptions = { ...(p.style ?? {}) }
      const col = toColor(p.color as string | Color | undefined, p.alpha)
      if (col) stylePatch.color = col
      const oc = toColor(p.outlineColor as string | Color | undefined, p.outlineAlpha)
      if (oc) stylePatch.outlineColor = oc
      if (p.pixelSize !== undefined) stylePatch.pixelSize = p.pixelSize
      if (p.outlineWidth !== undefined) stylePatch.outlineWidth = p.outlineWidth
      mergePointGraphics(pg, stylePatch, { outline: p.outline, outlineWidth: p.outlineWidth }, false)
    }

    if (p.show !== undefined) {
      rec.entity.show = p.show
    }
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData }
    }
    return true
  }

  /**
   * 批量更新，对应 `PointCollection#updatePoints`。
   */
  updatePoints(updates: Array<{ id: string } & UpdatePointProperties>): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u
      return { id, success: this.updatePoint(id, rest) }
    })
  }

  /** 读取业务自定义数据 */
  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id)
    if (!rec) return undefined
    return { ...rec.targetData }
  }

  /** 整体替换 `targetData` */
  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = { ...targetData }
    return true
  }

  /** 合并写入 `targetData` */
  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = { ...rec.targetData, ...patch }
    return true
  }

  /** 对应 `PointCollection#getPoint`：经纬高 + 样式快照 + `targetData` */
  getPoint(id: string): PointSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec) return null
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position)
    if (!pos) return null
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const pg = rec.entity.point
    const pixelSize = pg ? sampleProperty<number>(pg.pixelSize) : undefined
    const color = pg ? sampleProperty<Color>(pg.color) : undefined
    const outlineColor = pg ? sampleProperty<Color>(pg.outlineColor) : undefined
    const outlineWidth = pg ? sampleProperty<number>(pg.outlineWidth) : undefined
    const desc = sampleProperty<string>(rec.entity.description)

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      colorCss: colorToCss(color),
      pixelSize,
      outline: outlineWidth !== undefined ? outlineWidth > 0 : undefined,
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  getAllPoints(viewer?: Viewer): PointSnapshot[] {
    const out: PointSnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const snap = this.getPoint(id)
      if (snap) out.push(snap)
    }
    return out
  }

  /** 与参考 `getCount` 一致 */
  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
  }

  /** 与参考 `getAllIds` 一致 */
  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer)
  }

  /**
   * 与参考 `setAllVisibility`：可限定某一 `viewer`。
   */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      rec.entity.show = show
    }
  }

  /** 与参考 `setSpecifyVisibility` 一致 */
  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show)
  }

  /** 与参考 `removeAll` 一致 */
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

  updateStyle(id: string, style: PointStyleOptions): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const pg = rec.entity.point ?? (rec.entity.point = new Cesium.PointGraphics())
    mergePointGraphics(pg, style, undefined, false)
    return true
  }

  setPosition(id: string, position: PointPositionInput): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.position = new Cesium.ConstantPositionProperty(toCartesian3(position))
    return true
  }

  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.show = visible
    return true
  }

  show(id: string): boolean {
    return this.setVisible(id, true)
  }

  hide(id: string): boolean {
    return this.setVisible(id, false)
  }

  setDescription(id: string, description: string): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.description = new Cesium.ConstantProperty(description)
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
