import * as Cesium from 'cesium'
import type { Color, Entity, Property, Viewer } from 'cesium'
import { createRandomXgxId, type LngLatHeight } from '../../Coordinates'
import {
  AREA_DRAFT_TARGET_KEY,
  type AddPlotArrowOptions,
  type PlotArrowKind,
  type PlotArrowShapeOptions,
  type PlotArrowSnapshot,
  type PlotArrowStyleOptions,
  type PlotArrowVertexInput,
  type UpdatePlotArrowProperties,
} from '../../Types'
import { buildPlotArrowGeometry } from './geometry'

/** Entity 模式下缓存的单个箭头运行时状态。 */
interface PlotArrowRecord {
  /** 所属 Viewer，用于清理和按 Viewer 查询。 */
  viewer: Viewer
  /** 主 Entity，首个面片直接挂在这里。 */
  entity: Entity
  /** 额外面片或轮廓线 Entity，例如双箭头会拆成多个面。 */
  extraEntities: Entity[]
  /** 箭头类型，决定几何生成规则。 */
  kind: PlotArrowKind
  /** 原始控制点，统一保存为世界坐标。 */
  positions: Cesium.Cartesian3[]
  /** 样式、业务数据和空域草稿标记。 */
  targetData: Record<string, unknown>
}

function colorFromString(css: string, alpha = 1): Color {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha)
}

function toColor(c: string | Color | undefined, alpha?: number): Color | undefined {
  if (c === undefined) return undefined
  if (c instanceof Cesium.Color) return alpha !== undefined ? c.withAlpha(alpha) : c
  return colorFromString(c, alpha ?? 1)
}

function colorToCss(c: Color | undefined): string | undefined {
  if (!c) return undefined
  return typeof (c as { toCssColorString?: () => string }).toCssColorString === 'function'
    ? (c as Color & { toCssColorString: () => string }).toCssColorString()
    : undefined
}

function sampleProperty<T>(p: Property | undefined, time = Cesium.JulianDate.now()): T | undefined {
  if (!p || typeof (p as Cesium.Property).getValue !== 'function') return undefined
  return (p as Cesium.Property).getValue(time) as T | undefined
}

function vertexToCartesian3(v: PlotArrowVertexInput | number[], result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (v instanceof Cesium.Cartesian3) return Cesium.Cartesian3.clone(v, result)
  if (Array.isArray(v)) {
    return Cesium.Cartesian3.fromDegrees(Number(v[0]), Number(v[1]), Number(v[2] ?? 0), undefined, result)
  }
  const p = v as LngLatHeight
  return Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.height ?? 0, undefined, result)
}

function positionsToCartesian3Array(positions: PlotArrowVertexInput[] | number[][], minVertices = 2): Cesium.Cartesian3[] | undefined {
  if (!Array.isArray(positions) || positions.length < minVertices) return undefined
  return positions.map((position) => vertexToCartesian3(position as PlotArrowVertexInput | number[]))
}

function cartesianToTuple(point: Cesium.Cartesian3): number[] {
  const carto = Cesium.Cartographic.fromCartesian(point)
  return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), carto.height]
}

function cloneTargetData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}
  return { ...data }
}

function isDraftTargetData(td: Record<string, unknown>): boolean {
  return td[AREA_DRAFT_TARGET_KEY] === true
}

function shapeOptionsFromTargetData(td: Record<string, unknown>): PlotArrowShapeOptions {
  return {
    width: typeof td.width === 'number' ? td.width : undefined,
    headWidthRatio: typeof td.headWidthRatio === 'number' ? td.headWidthRatio : undefined,
    headLengthRatio: typeof td.headLengthRatio === 'number' ? td.headLengthRatio : undefined,
    neckWidthRatio: typeof td.neckWidthRatio === 'number' ? td.neckWidthRatio : undefined,
    tailWidthRatio: typeof td.tailWidthRatio === 'number' ? td.tailWidthRatio : undefined,
    swallowTailRatio: typeof td.swallowTailRatio === 'number' ? td.swallowTailRatio : undefined,
    curveSegments: typeof td.curveSegments === 'number' ? td.curveSegments : undefined,
    curveTension: typeof td.curveTension === 'number' ? td.curveTension : undefined,
  }
}

function copyShapeOptions(td: Record<string, unknown>, patch: PlotArrowShapeOptions): void {
  const keys: Array<keyof PlotArrowShapeOptions> = [
    'width',
    'headWidthRatio',
    'headLengthRatio',
    'neckWidthRatio',
    'tailWidthRatio',
    'swallowTailRatio',
    'curveSegments',
    'curveTension',
  ]
  for (const key of keys) {
    if (patch[key] !== undefined) td[key] = patch[key]
  }
}

function styleFromTargetData(td: Record<string, unknown>): {
  color: Color
  showFill: boolean
  outline: boolean
  outlineColor: Color
  outlineWidth: number
  height?: number
  clampToGround: boolean
  style?: PlotArrowStyleOptions
} {
  const showFill = td.showFill !== false
  const alpha = typeof td.alpha === 'number' ? td.alpha : 0.55
  const color = toColor(String(td.color ?? '#ffcc33'), showFill ? alpha : 0) ?? Cesium.Color.YELLOW.withAlpha(showFill ? alpha : 0)
  const outline = td.outline !== false
  const outlineAlpha = typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1
  const outlineColor = toColor(String(td.outlineColor ?? '#ffffff'), outlineAlpha) ?? Cesium.Color.WHITE
  const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
  const height = typeof td.height === 'number' && Number.isFinite(td.height) ? td.height : undefined
  const clampToGround = td.clampToGround === true
  return {
    color,
    showFill,
    outline,
    outlineColor,
    outlineWidth,
    height,
    clampToGround,
    style: td.styleSnapshot as PlotArrowStyleOptions | undefined,
  }
}

function applyPatchToTargetData(td: Record<string, unknown>, patch: AddPlotArrowOptions | UpdatePlotArrowProperties): void {
  if (patch.targetData !== undefined) Object.assign(td, patch.targetData)
  copyShapeOptions(td, patch)
  if (patch.height !== undefined) td.height = patch.height
  if (patch.clampToGround !== undefined) td.clampToGround = patch.clampToGround
  if (patch.color !== undefined) td.color = patch.color instanceof Cesium.Color ? colorToCss(patch.color) : patch.color
  if (patch.alpha !== undefined) td.alpha = patch.alpha
  if (patch.showFill !== undefined) td.showFill = patch.showFill
  if (patch.outline !== undefined) td.outline = patch.outline
  if (patch.outlineColor !== undefined) {
    td.outlineColor = patch.outlineColor instanceof Cesium.Color ? colorToCss(patch.outlineColor) : patch.outlineColor
  }
  if (patch.outlineAlpha !== undefined) td.outlineAlpha = patch.outlineAlpha
  if (patch.outlineWidth !== undefined) td.outlineWidth = patch.outlineWidth
  if (patch.style !== undefined) td.styleSnapshot = { ...(td.styleSnapshot as object), ...patch.style }
}

function createPolygonGraphics(
  positions: Cesium.Cartesian3[],
  style: ReturnType<typeof styleFromTargetData>,
): Cesium.PolygonGraphics {
  const polygon = new Cesium.PolygonGraphics()
  polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(positions))
  polygon.fill = new Cesium.ConstantProperty(style.showFill)
  polygon.material = new Cesium.ColorMaterialProperty(style.color)
  polygon.outline = new Cesium.ConstantProperty(false)
  polygon.perPositionHeight = new Cesium.ConstantProperty(!style.clampToGround && style.style?.perPositionHeight !== false)
  if (style.clampToGround) {
    polygon.height = undefined
  }
  if (style.style?.arcType !== undefined) polygon.arcType = new Cesium.ConstantProperty(style.style.arcType)
  if (style.style?.granularity !== undefined) polygon.granularity = new Cesium.ConstantProperty(style.style.granularity)
  if (style.style?.shadows !== undefined) polygon.shadows = new Cesium.ConstantProperty(style.style.shadows)
  if (style.style?.distanceDisplayCondition !== undefined) {
    polygon.distanceDisplayCondition = new Cesium.ConstantProperty(style.style.distanceDisplayCondition)
  }
  if (style.style?.classificationType !== undefined) {
    polygon.classificationType = new Cesium.ConstantProperty(style.style.classificationType)
  }
  if (style.style?.zIndex !== undefined) polygon.zIndex = new Cesium.ConstantProperty(style.style.zIndex)
  return polygon
}

function createOutlineGraphics(
  ring: Cesium.Cartesian3[],
  style: ReturnType<typeof styleFromTargetData>,
): Cesium.PolylineGraphics {
  return new Cesium.PolylineGraphics({
    positions: new Cesium.ConstantProperty([...ring, ring[0]!]),
    width: new Cesium.ConstantProperty(style.outlineWidth),
    material: new Cesium.ColorMaterialProperty(style.outlineColor),
    clampToGround: new Cesium.ConstantProperty(style.clampToGround),
  })
}

/**
 * 面状箭头 Entity 绘制底座。
 * 具体箭头类只指定 `kind`，所有状态管理和空域草稿逻辑在这里统一维护。
 */
export class PlotArrowEntityBase {
  private readonly data = new Map<string, PlotArrowRecord>()

  constructor(
    protected readonly kind: PlotArrowKind,
    private readonly idPrefix: string,
  ) {}

  private isRecordAlive(rec: PlotArrowRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  protected takeIfAlive(id: string): PlotArrowRecord | undefined {
    const rec = this.data.get(id)
    if (!rec) return undefined
    if (!this.isRecordAlive(rec)) {
      this.data.delete(id)
      return undefined
    }
    return rec
  }

  /**
   * 添加单个箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 箭头控制点、颜色、轮廓、贴地、高度等绘制参数。
   */
  add(viewer: Viewer, options: AddPlotArrowOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId(this.idPrefix)
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    const minVertices = options.areaDraft ? 1 : 2
    const positions = positionsToCartesian3Array(options.positions, minVertices)
    if (!positions) return undefined

    const td = cloneTargetData(options.targetData)
    td.kind = this.kind
    td.positions = positions.map(cartesianToTuple)
    td.color = options.color ?? '#ffcc33'
    td.alpha = options.alpha ?? 0.55
    td.showFill = options.showFill !== false
    td.outline = options.outline !== false
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = options.outlineWidth ?? 2
    td.height = options.height
    td.clampToGround = options.clampToGround === true
    if (options.style) td.styleSnapshot = { ...options.style }
    copyShapeOptions(td, options)
    if (options.areaDraft) td[AREA_DRAFT_TARGET_KEY] = true

    const entity = new Cesium.Entity({ id, show: options.show !== false })
    if (options.description !== undefined) entity.description = new Cesium.ConstantProperty(options.description)
    viewer.entities.add(entity)

    const rec: PlotArrowRecord = {
      viewer,
      entity,
      extraEntities: [],
      kind: this.kind,
      positions,
      targetData: td,
    }
    this.data.set(id, rec)
    this.renderRecord(rec)
    return entity
  }

  /**
   * 批量添加 Entity 箭头，失败项会跳过并继续处理后续数据。
   * @param viewer Cesium Viewer 实例。
   * @param items 多个箭头配置。
   */
  addArrows(viewer: Viewer, items: AddPlotArrowOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const id = item.id?.trim() ? item.id.trim() : createRandomXgxId(this.idPrefix)
        const entity = this.add(viewer, { ...item, id })
        if (entity) ids.push(id)
      } catch (error) {
        console.error(`[FastX.Draw.PlotArrow] addArrows 第 ${i} 项失败:`, error)
      }
    }
    return ids
  }

  /**
   * 更新指定箭头的控制点、样式或业务数据。
   * @param id 箭头唯一 id。
   * @param properties 需要覆盖的参数。
   */
  updatePlotArrow(id: string, properties: UpdatePlotArrowProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false

    if (properties.positions !== undefined) {
      const minVertices = properties.areaDraft === true || isDraftTargetData(rec.targetData) ? 1 : 2
      const next = positionsToCartesian3Array(properties.positions, minVertices)
      if (!next) return false
      rec.positions = next
      rec.targetData.positions = next.map(cartesianToTuple)
    }

    applyPatchToTargetData(rec.targetData, properties)

    if (properties.areaDraft === false && isDraftTargetData(rec.targetData)) {
      delete rec.targetData[AREA_DRAFT_TARGET_KEY]
    } else if (properties.areaDraft === true) {
      rec.targetData[AREA_DRAFT_TARGET_KEY] = true
    }

    if (properties.show !== undefined) rec.entity.show = properties.show
    if (properties.description !== undefined) rec.entity.description = new Cesium.ConstantProperty(properties.description)

    this.renderRecord(rec)
    return true
  }

  /** 获取指定箭头绑定的业务数据副本。 */
  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id)
    return rec ? { ...rec.targetData } : undefined
  }

  /**
   * 覆盖指定箭头的业务数据。
   * @param id 箭头唯一 id。
   * @param targetData 新业务数据，会整体替换旧值。
   */
  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = { ...targetData }
    return true
  }

  /**
   * 合并指定箭头的业务数据。
   * @param id 箭头唯一 id。
   * @param patch 需要合并进原数据的字段。
   */
  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = { ...rec.targetData, ...patch }
    return true
  }

  /** 查询指定箭头快照；空域草稿对象不会对外返回。 */
  getPlotArrow(id: string): PlotArrowSnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isDraftTargetData(rec.targetData)) return null
    const built = this.buildGeometry(rec)
    const style = styleFromTargetData(rec.targetData)
    const color = sampleProperty<Color>(rec.entity.polygon?.material instanceof Cesium.ColorMaterialProperty ? rec.entity.polygon.material.color : undefined)
    const desc = sampleProperty<string>(rec.entity.description)
    return {
      id: rec.entity.id,
      kind: rec.kind,
      positions: rec.positions.map(cartesianToTuple),
      polygons: built?.polygons.map((polygon) => polygon.map(cartesianToTuple)) ?? [],
      vertexCount: built?.polygons.reduce((sum, polygon) => sum + polygon.length, 0) ?? 0,
      colorCss: colorToCss(color ?? style.color),
      showFill: rec.targetData.showFill !== false,
      outline: rec.targetData.outline !== false,
      outlineColorCss: colorToCss(style.outlineColor),
      outlineWidth: style.outlineWidth,
      height: style.height,
      clampToGround: style.clampToGround,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    }
  }

  /**
   * 查询全部箭头快照。
   * @param viewer 可选，传入后只返回该 Viewer 下的对象。
   */
  getAllPlotArrows(viewer?: Viewer): PlotArrowSnapshot[] {
    const out: PlotArrowSnapshot[] = []
    for (const id of this.getAllIds(viewer)) {
      const snap = this.getPlotArrow(id)
      if (snap) out.push(snap)
    }
    return out
  }

  /** 获取当前箭头数量，可按 Viewer 过滤。 */
  getCount(viewer?: Viewer): number {
    return this.getAllIds(viewer).length
  }

  /** 获取全部箭头 id，可按 Viewer 过滤。 */
  getAllIds(viewer?: Viewer): string[] {
    const out: string[] = []
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      out.push(id)
    }
    return out
  }

  /** 获取底层主 Entity，便于业务侧挂载额外属性或定位。 */
  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity
  }

  /** 判断指定 id 的箭头是否仍然有效。 */
  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined
  }

  /**
   * 设置指定箭头显隐；会同步主面、附加面和轮廓线。
   * @param id 箭头唯一 id。
   * @param visible 是否显示。
   */
  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    this.applyVisibility(rec, visible)
    return true
  }

  /** 显示指定箭头。 */
  show(id: string): boolean {
    return this.setVisible(id, true)
  }

  /** 隐藏指定箭头。 */
  hide(id: string): boolean {
    return this.setVisible(id, false)
  }

  /**
   * 批量设置箭头显隐。
   * @param show 是否显示。
   * @param viewer 可选，传入后只处理该 Viewer 下的箭头。
   */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      this.applyVisibility(rec, show)
    }
  }

  /** 兼容旧示例命名：设置指定箭头显隐。 */
  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show)
  }

  /**
   * 删除指定箭头，并清理它的附加面和轮廓线。
   * @param id 箭头唯一 id。
   */
  remove(id: string): boolean {
    const rec = this.data.get(id)
    if (!rec) return false
    this.data.delete(id)
    if (!rec.viewer.isDestroyed()) {
      if (rec.viewer.entities.contains(rec.entity)) rec.viewer.entities.remove(rec.entity)
      for (const entity of rec.extraEntities) {
        if (rec.viewer.entities.contains(entity)) rec.viewer.entities.remove(entity)
      }
    }
    return true
  }

  /**
   * 批量删除指定 id 的箭头。
   * @param ids 箭头 id 列表。
   */
  removeBatch(ids: string[]): number {
    let count = 0
    for (const id of ids) {
      if (this.remove(id)) count++
    }
    return count
  }

  /** 兼容旧示例命名：清空箭头。 */
  removeAll(viewer?: Viewer): void {
    this.clear(viewer)
  }

  /**
   * 清空箭头。
   * @param viewer 可选，传入后只清空该 Viewer 下的箭头。
   */
  clear(viewer?: Viewer): void {
    for (const [id, rec] of [...this.data]) {
      if (viewer !== undefined && rec.viewer !== viewer) continue
      this.remove(id)
    }
  }

  /** 销毁当前管理器内的所有箭头。 */
  destroy(): void {
    this.clear()
  }

  /** 清理已经脱离 Viewer 或被外部删除的缓存记录。 */
  pruneInvalid(): number {
    let count = 0
    for (const [id, rec] of [...this.data]) {
      if (this.isRecordAlive(rec)) continue
      this.data.delete(id)
      count++
    }
    return count
  }

  /** 根据当前记录和样式参数重新生成箭头面片。 */
  private buildGeometry(rec: PlotArrowRecord) {
    const style = styleFromTargetData(rec.targetData)
    return buildPlotArrowGeometry(rec.kind, rec.positions, shapeOptionsFromTargetData(rec.targetData), style.height)
  }

  /** 同步主 Entity 和附加 Entity 的显隐状态。 */
  private applyVisibility(rec: PlotArrowRecord, show: boolean): void {
    rec.entity.show = show
    for (const entity of rec.extraEntities) entity.show = show
  }

  /** 将几何结果写回 Entity，并创建必要的附加面片和轮廓线。 */
  private renderRecord(rec: PlotArrowRecord): void {
    this.clearExtraEntities(rec)
    rec.entity.polygon = undefined
    rec.entity.polyline = undefined

    const built = this.buildGeometry(rec)
    if (!built) return

    const style = styleFromTargetData(rec.targetData)
    for (let i = 0; i < built.polygons.length; i++) {
      const polygon = built.polygons[i]!
      if (i === 0) {
        rec.entity.polygon = createPolygonGraphics(polygon, style)
      } else {
        const part = rec.viewer.entities.add({
          id: `${rec.entity.id}-part-${i}`,
          show: rec.entity.show,
          polygon: createPolygonGraphics(polygon, style),
        })
        rec.extraEntities.push(part)
      }

      if (style.outline) {
        const outline = rec.viewer.entities.add({
          id: `${rec.entity.id}-outline-${i}`,
          show: rec.entity.show,
          polyline: createOutlineGraphics(polygon, style),
        })
        rec.extraEntities.push(outline)
      }
    }
  }

  /** 清理由多面片或轮廓线产生的附加 Entity。 */
  private clearExtraEntities(rec: PlotArrowRecord): void {
    if (rec.viewer.isDestroyed()) {
      rec.extraEntities.length = 0
      return
    }
    for (const entity of rec.extraEntities) {
      if (rec.viewer.entities.contains(entity)) rec.viewer.entities.remove(entity)
    }
    rec.extraEntities.length = 0
  }
}
