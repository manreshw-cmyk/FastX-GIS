import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import {
  type PlotArrowCollectionAddItem,
  type PlotArrowCollectionSnapshot,
  type PlotArrowCollectionUpdateEntry,
  type PlotArrowCollectionUpdateProps,
  type PlotArrowKind,
  type PlotArrowShapeOptions,
} from '../../Types'
import { buildPlotArrowGeometry, minPointsForPlotArrow } from './geometry'

/** Primitive 模式下保存的箭头参数快照，用于查询和局部重建。 */
interface PlotArrowStoredData {
  /** 箭头唯一 id。 */
  id: string
  /** 箭头类型，决定几何生成规则。 */
  kind: PlotArrowKind
  /** 控制点，经纬高数组。 */
  positions: number[][]
  /** 面填充颜色。 */
  color: string
  /** 面填充透明度。 */
  alpha: number
  /** 当前对象是否显示。 */
  show: boolean
  /** 是否填充面。 */
  showFill: boolean
  /** 是否绘制轮廓线。 */
  outline: boolean
  /** 轮廓线颜色。 */
  outlineColor: string
  /** 轮廓线透明度。 */
  outlineAlpha: number
  /** 轮廓线宽度。 */
  outlineWidth: number
  /** 固定绘制高度，不传时使用控制点高度。 */
  height?: number
  /** 是否贴地绘制。 */
  clampToGround: boolean
  /** 箭头形状比例参数。 */
  shapeOptions: PlotArrowShapeOptions
  /** 业务数据。 */
  targetData: Record<string, unknown>
}

/** 单个箭头对应的 Primitive 和轮廓线集合。 */
interface PlotArrowCollectionEntry {
  data: PlotArrowStoredData
  primitive: Primitive
  outlines: Primitive[]
}

/** 每个 Viewer 对应一个 PrimitiveCollection 和一组箭头索引。 */
type Bucket = {
  collection: Cesium.PrimitiveCollection
  arrows: Map<string, PlotArrowCollectionEntry>
}

function positionsToCartesian(positions: readonly number[][]): Cesium.Cartesian3[] {
  return positions.map((pos) => Cesium.Cartesian3.fromDegrees(Number(pos[0]), Number(pos[1]), Number(pos[2] ?? 0)))
}

function cartesianToTuple(point: Cesium.Cartesian3): number[] {
  const carto = Cesium.Cartographic.fromCartesian(point)
  return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), carto.height]
}

function normalizePositions(positions: unknown): number[][] | null {
  if (!Array.isArray(positions)) return null
  const out: number[][] = []
  for (const item of positions) {
    if (item instanceof Cesium.Cartesian3) {
      out.push(cartesianToTuple(item))
      continue
    }
    if (Array.isArray(item) && item.length >= 2) {
      out.push([Number(item[0]), Number(item[1]), Number(item[2] ?? 0)])
      continue
    }
    if (item && typeof item === 'object' && 'longitude' in item && 'latitude' in item) {
      const p = item as { longitude: number; latitude: number; height?: number }
      out.push([Number(p.longitude), Number(p.latitude), Number(p.height ?? 0)])
    }
  }
  return out.length ? out : null
}

function shapeOptionsFromItem(item: PlotArrowCollectionAddItem | PlotArrowCollectionUpdateProps): PlotArrowShapeOptions {
  return {
    width: item.width,
    headWidthRatio: item.headWidthRatio,
    headLengthRatio: item.headLengthRatio,
    neckWidthRatio: item.neckWidthRatio,
    tailWidthRatio: item.tailWidthRatio,
    swallowTailRatio: item.swallowTailRatio,
    curveSegments: item.curveSegments,
    curveTension: item.curveTension,
  }
}

function mergeShapeOptions(base: PlotArrowShapeOptions, patch: PlotArrowShapeOptions): PlotArrowShapeOptions {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
  }
}

function buildPrimitive(data: PlotArrowStoredData): { primitive: Primitive; polygons: number[][][] } | null {
  const built = buildPlotArrowGeometry(
    data.kind,
    positionsToCartesian(data.positions),
    data.shapeOptions,
    data.height,
  )
  if (!built) return null

  const instances = built.polygons.map((polygon, index) => new Cesium.GeometryInstance({
    id: `${data.id}:${index}`,
    geometry: new Cesium.PolygonGeometry({
      polygonHierarchy: new Cesium.PolygonHierarchy(polygon),
      perPositionHeight: !data.clampToGround,
      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
    }),
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        Cesium.Color.fromCssColorString(data.color).withAlpha(data.showFill ? data.alpha : 0),
      ),
      show: new Cesium.ShowGeometryInstanceAttribute(data.show),
    },
  }))

  const primitive = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
    }),
    asynchronous: false,
  })
  ;(primitive as Primitive & { entityData?: Record<string, unknown> }).entityData = data.targetData
  return { primitive, polygons: built.polygons.map((polygon) => polygon.map(cartesianToTuple)) }
}

function buildOutlinePrimitive(data: PlotArrowStoredData, ring: number[][], index: number): Primitive {
  const instance = new Cesium.GeometryInstance({
    id: `${data.id}:outline:${index}`,
    geometry: new Cesium.PolylineGeometry({
      positions: positionsToCartesian([...ring, ring[0]!]),
      width: data.outlineWidth,
      vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
      colors: new Array(ring.length + 1).fill(Cesium.Color.fromCssColorString(data.outlineColor).withAlpha(data.outlineAlpha)),
      colorsPerVertex: false,
    }),
  })
  return new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.PolylineColorAppearance({
      translucent: data.outlineAlpha < 1,
    }),
    asynchronous: false,
  })
}

/** 将当前箭头的轮廓线 Primitive 添加到同一个 Bucket。 */
function addOutlinePrimitives(bucket: Bucket, data: PlotArrowStoredData, polygons: number[][][]): Primitive[] {
  if (!data.outline) return []
  return polygons.map((polygon, index) => {
    const primitive = buildOutlinePrimitive(data, polygon, index)
    bucket.collection.add(primitive)
    return primitive
  })
}

/** 移除单个箭头的面 Primitive 和全部轮廓线 Primitive。 */
function removeEntryPrimitives(bucket: Bucket, entry: PlotArrowCollectionEntry): void {
  bucket.collection.remove(entry.primitive)
  for (const outline of entry.outlines) bucket.collection.remove(outline)
}

/**
 * 面状箭头 Primitive 批量绘制底座。
 * 每个箭头独立 Primitive，便于更新时局部重建。
 */
export class PlotArrowCollectionBase {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  constructor(
    protected readonly kind: PlotArrowKind,
    private readonly idPrefix: string,
  ) {}

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let bucket = this.buckets.get(viewer)
    if (!bucket) {
      bucket = { collection: new Cesium.PrimitiveCollection(), arrows: new Map() }
      viewer.scene.primitives.add(bucket.collection)
      this.buckets.set(viewer, bucket)
    }
    return bucket
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: PlotArrowCollectionEntry } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const entry = bucket?.arrows.get(id)
    if (!bucket || !entry) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, entry }
  }

  /**
   * 批量添加 Primitive 箭头。
   * @param viewer Cesium Viewer 实例。
   * @param items 多个箭头配置；无效项会被跳过。
   */
  addArrows(viewer: Viewer, items: PlotArrowCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const bucket = this.ensureBucket(viewer)
    if (!bucket) return []

    const ids: string[] = []
    for (const item of items) {
      const id = item.id?.trim() ? item.id.trim() : createRandomXgxId(this.idPrefix)
      if (bucket.arrows.has(id)) continue
      const positions = normalizePositions(item.positions)
      if (!positions || positions.length < minPointsForPlotArrow(this.kind)) continue
      const targetData = { ...(item.targetData ?? {}) }
      const data: PlotArrowStoredData = {
        id,
        kind: item.kind ?? this.kind,
        positions,
        color: item.color ?? '#ffcc33',
        alpha: item.alpha ?? 0.55,
        show: item.show ?? true,
        showFill: item.showFill !== false,
        outline: item.outline !== false,
        outlineColor: item.outlineColor ?? '#ffffff',
        outlineAlpha: item.outlineAlpha ?? 1,
        outlineWidth: item.outlineWidth ?? 2,
        height: item.height,
        clampToGround: item.clampToGround === true,
        shapeOptions: shapeOptionsFromItem(item),
        targetData,
      }
      const built = buildPrimitive(data)
      if (!built) continue
      bucket.collection.add(built.primitive)
      const outlines = addOutlinePrimitives(bucket, data, built.polygons)
      bucket.arrows.set(id, { data, primitive: built.primitive, outlines })
      this.idOwner.set(id, viewer)
      ids.push(id)
    }
    return ids
  }

  /**
   * 更新指定箭头，并重建对应 Primitive。
   * @param id 箭头唯一 id。
   * @param patch 需要覆盖的控制点、样式或业务数据。
   */
  updatePlotArrow(id: string, patch: PlotArrowCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { bucket, entry } = hit
    const data = entry.data

    if (patch.positions !== undefined) {
      const positions = normalizePositions(patch.positions)
      if (!positions || positions.length < minPointsForPlotArrow(data.kind)) return false
      data.positions = positions
    }
    if (patch.color !== undefined) {
      data.color = patch.color instanceof Cesium.Color ? patch.color.toCssColorString() : patch.color
    }
    if (patch.alpha !== undefined) data.alpha = patch.alpha
    if (patch.show !== undefined) data.show = patch.show
    if (patch.showFill !== undefined) data.showFill = patch.showFill
    if (patch.outline !== undefined) data.outline = patch.outline
    if (patch.outlineColor !== undefined) {
      data.outlineColor = patch.outlineColor instanceof Cesium.Color ? patch.outlineColor.toCssColorString() : patch.outlineColor
    }
    if (patch.outlineAlpha !== undefined) data.outlineAlpha = patch.outlineAlpha
    if (patch.outlineWidth !== undefined) data.outlineWidth = patch.outlineWidth
    if (patch.height !== undefined) data.height = patch.height
    if (patch.clampToGround !== undefined) data.clampToGround = patch.clampToGround
    if (patch.targetData !== undefined) data.targetData = { ...data.targetData, ...patch.targetData }
    data.shapeOptions = mergeShapeOptions(data.shapeOptions, shapeOptionsFromItem(patch))

    removeEntryPrimitives(bucket, entry)

    const built = buildPrimitive(data)
    if (!built) return false
    bucket.collection.add(built.primitive)
    entry.primitive = built.primitive
    entry.outlines = addOutlinePrimitives(bucket, data, built.polygons)
    return true
  }

  /**
   * 批量更新箭头。
   * @param updates 更新项列表，每项必须包含 id。
   */
  updateArrows(updates: PlotArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return updates.map((update) => {
      const { id, ...patch } = update
      return { id, success: this.updatePlotArrow(id, patch) }
    })
  }

  /** 查询指定箭头的快照数据。 */
  getPlotArrow(id: string): PlotArrowCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const data = hit.entry.data
    const built = buildPlotArrowGeometry(data.kind, positionsToCartesian(data.positions), data.shapeOptions, data.height)
    const polygons = built?.polygons.map((polygon) => polygon.map(cartesianToTuple)) ?? []
    return {
      id: data.id,
      kind: data.kind,
      positions: data.positions.map((point) => [...point]),
      polygons,
      vertexCount: polygons.reduce((sum, polygon) => sum + polygon.length, 0),
      colorCss: data.color,
      showFill: data.showFill,
      outline: data.outline,
      outlineColorCss: data.outlineColor,
      outlineWidth: data.outlineWidth,
      height: data.height,
      clampToGround: data.clampToGround,
      show: data.show,
      targetData: { ...data.targetData },
    }
  }

  /**
   * 查询全部 Primitive 箭头快照。
   * @param viewer 可选，传入后只返回该 Viewer 下的对象。
   */
  getAllPlotArrows(viewer?: Viewer): PlotArrowCollectionSnapshot[] {
    const ids = viewer ? [...(this.buckets.get(viewer)?.arrows.keys() ?? [])] : [...this.idOwner.keys()]
    return ids.map((id) => this.getPlotArrow(id)).filter((item): item is PlotArrowCollectionSnapshot => !!item)
  }

  /** 获取当前 Primitive 箭头数量，可按 Viewer 过滤。 */
  getCount(viewer?: Viewer): number {
    if (viewer) return this.buckets.get(viewer)?.arrows.size ?? 0
    return this.idOwner.size
  }

  /** 获取全部箭头 id，可按 Viewer 过滤。 */
  getAllIds(viewer?: Viewer): string[] {
    if (viewer) return [...(this.buckets.get(viewer)?.arrows.keys() ?? [])]
    return [...this.idOwner.keys()]
  }

  /**
   * 设置指定箭头显隐；会同步面 Primitive 和轮廓线 Primitive。
   * @param id 箭头唯一 id。
   * @param show 是否显示。
   */
  setVisibility(id: string, show: boolean): void {
    const hit = this.resolve(id)
    if (!hit) return
    hit.entry.primitive.show = show
    for (const outline of hit.entry.outlines) outline.show = show
    hit.entry.data.show = show
  }

  /** 兼容旧示例命名：设置指定箭头显隐。 */
  setSpecifyVisibility(id: string, show: boolean): void {
    this.setVisibility(id, show)
  }

  /**
   * 批量设置箭头显隐。
   * @param show 是否显示。
   * @param viewer 可选，传入后只处理该 Viewer 下的箭头。
   */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const apply = (bucket: Bucket) => {
      bucket.arrows.forEach((entry) => {
        entry.primitive.show = show
        for (const outline of entry.outlines) outline.show = show
        entry.data.show = show
      })
    }
    if (viewer) {
      const bucket = this.buckets.get(viewer)
      if (bucket) apply(bucket)
      return
    }
    this.buckets.forEach(apply)
  }

  /**
   * 删除指定箭头，并从 PrimitiveCollection 中移除面和轮廓。
   * @param id 箭头唯一 id。
   */
  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    removeEntryPrimitives(hit.bucket, hit.entry)
    hit.bucket.arrows.delete(id)
    this.idOwner.delete(id)
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
    if (viewer !== undefined) {
      const bucket = this.buckets.get(viewer)
      if (!bucket) return
      if (!viewer.isDestroyed()) bucket.collection.removeAll()
      for (const id of bucket.arrows.keys()) this.idOwner.delete(id)
      bucket.arrows.clear()
      return
    }
    for (const [v, bucket] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(bucket.collection)
      for (const id of bucket.arrows.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }

  /** 销毁当前管理器内的所有 Primitive 箭头。 */
  destroy(): void {
    this.clear()
  }

  /** 清理已经销毁的 Viewer 对应缓存。 */
  pruneInvalid(): number {
    let count = 0
    for (const [viewer, bucket] of [...this.buckets]) {
      if (!viewer.isDestroyed()) continue
      for (const id of bucket.arrows.keys()) this.idOwner.delete(id)
      this.buckets.delete(viewer)
      count++
    }
    return count
  }
}
