import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { PolygonCollectionAddItem, PolygonCollectionEntry, PolygonCollectionSnapshot, PolygonCollectionStoredData } from '../../Types'
export type { PolygonCollectionAddItem, PolygonCollectionEntry, PolygonCollectionSnapshot, PolygonCollectionStoredData }

type Bucket = {
  collection: Cesium.PrimitiveCollection
  polygons: Map<string, PolygonCollectionEntry>
}

function positionsToCartesian(positions: number[][]): Cesium.Cartesian3[] {
  return positions.map((pos) =>
    Cesium.Cartesian3.fromDegrees(Number(pos[0]), Number(pos[1]), Number(pos[2]) || 0),
  )
}

function buildPrimitive(data: PolygonCollectionStoredData): Primitive {
  const positions = positionsToCartesian(data.positions)
  const polygonInstance = new Cesium.GeometryInstance({
    geometry: new Cesium.PolygonGeometry({
      polygonHierarchy: new Cesium.PolygonHierarchy(positions),
      extrudedHeight: data.topHeight || 0,
      perPositionHeight: true,
      vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
    }),
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        Cesium.Color.fromCssColorString(data.color || '#FFFFFF').withAlpha(data.opacity ?? 1),
      ),
      show: new Cesium.ShowGeometryInstanceAttribute(data.show ?? true),
    },
    id: data.id,
  })

  const primitive = new Cesium.Primitive({
    geometryInstances: polygonInstance,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: true,
    }),
    asynchronous: false,
  })

  const ext = primitive as Primitive & { entityData?: Record<string, unknown> }
  ext.entityData = data.targetData
  return primitive
}

/**
 * 批量多边形（`PolygonGeometry` + `Primitive`）单例：首参传入 `viewer`，按 viewer 分桶；由旧版 `PolygonCollection.js` / `PolygonManager` 改造。
 */
export default class PolygonCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(collection)
      b = { collection, polygons: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: PolygonCollectionEntry } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const entry = bucket?.polygons.get(id)
    if (!bucket || !entry) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, entry }
  }

  /**
   * 批量添加多边形（与旧版 `addPolygons(dataList)` 行为一致，增加首参 `viewer`）。
   */
  addPolygons(viewer: Viewer, dataList: PolygonCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(dataList) || dataList.length === 0) return []

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const created: string[] = []
    for (const raw of dataList) {
      const id = raw.id?.trim() ? raw.id.trim() : createRandomXgxId('pgc')
      if (b.polygons.has(id)) {
        console.warn(`PolygonCollection: id 已存在，跳过: ${id}`)
        continue
      }
      if (!Array.isArray(raw.positions) || raw.positions.length < 3) {
        console.warn('PolygonCollection: positions 至少需要 3 个顶点，跳过一项')
        continue
      }

      const targetData: Record<string, unknown> = {
        ...(raw.entityData ?? {}),
        ...(raw.targetData ?? {}),
      }

      const data: PolygonCollectionStoredData = {
        id,
        positions: raw.positions.map((p) => [Number(p[0]), Number(p[1]), Number(p[2]) || 0]),
        topHeight: raw.topHeight ?? 0,
        color: raw.color ?? '#FFFFFF',
        opacity: raw.opacity ?? 1,
        show: raw.show ?? true,
        targetData,
      }

      const primitive = buildPrimitive(data)
      b.collection.add(primitive)
      b.polygons.set(id, { data, primitive })
      this.idOwner.set(id, viewer)
      created.push(id)
    }
    return created
  }

  /** 与旧版 `removePolygon(id)` 一致 */
  removePolygon(id: string): void {
    this.remove(id)
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    bucket.collection.remove(entry.primitive)
    bucket.polygons.delete(id)
    this.idOwner.delete(id)
  }

  /** 与旧版 `removeAll()` 一致；可传 `viewer` 只清空该视图 */
  removeAll(viewer?: Viewer): void {
    this.clear(viewer)
  }

  clear(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      if (!viewer.isDestroyed()) b.collection.removeAll()
      for (const id of b.polygons.keys()) this.idOwner.delete(id)
      b.polygons.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.polygons.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }

  destroy(): void {
    this.clear()
  }

  /** 与旧版 `setVisibility(id, show)` 一致 */
  setVisibility(id: string, show: boolean): void {
    const hit = this.resolve(id)
    if (!hit) return
    hit.entry.primitive.show = show
    hit.entry.data.show = show
  }

  /** 与旧版 `setAllVisibility(show)` 一致；可传 `viewer` 只作用于该视图 */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const applyBucket = (b: Bucket) => {
      b.polygons.forEach((entry) => {
        entry.primitive.show = show
        entry.data.show = show
      })
    }
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (b) applyBucket(b)
      return
    }
    this.buckets.forEach(applyBucket)
  }

  /** 与旧版 `updateColor(id, color?, opacity?)` 一致：重建 Primitive */
  updateColor(id: string, color?: string, opacity?: number): void {
    const hit = this.resolve(id)
    if (!hit) return

    const { bucket, entry } = hit
    const data = entry.data
    if (color) data.color = color
    if (opacity !== undefined) data.opacity = opacity

    bucket.collection.remove(entry.primitive)

    const newPrimitive = buildPrimitive(data)
    bucket.collection.add(newPrimitive)
    entry.primitive = newPrimitive
    bucket.polygons.set(id, entry)
  }

  /** 与旧版 `getIdPolygon(id)` 一致 */
  getIdPolygon(id: string): PolygonCollectionEntry | undefined {
    return this.resolve(id)?.entry
  }

  /**
   * 与旧版 `getPolygonAll()` 一致：无数据时 `undefined`；有数据时返回 `Map`。
   * 传入 `viewer` 时仅返回该视图下的实例。
   */
  getPolygonAll(viewer?: Viewer): Map<string, PolygonCollectionEntry> | undefined {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b || b.polygons.size === 0) return undefined
      return new Map(b.polygons)
    }
    if (this.idOwner.size === 0) return undefined
    const merged = new Map<string, PolygonCollectionEntry>()
    for (const b of this.buckets.values()) {
      for (const [id, e] of b.polygons) merged.set(id, e)
    }
    return merged.size ? merged : undefined
  }

  getPolygon(id: string): PolygonCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { data } = hit.entry
    return {
      id: data.id,
      positions: data.positions.map((p) => [...p]),
      topHeight: data.topHeight,
      color: data.color,
      opacity: data.opacity,
      show: data.show,
      targetData: { ...data.targetData },
      vertexCount: data.positions.length,
    }
  }

  getAllPolygons(viewer?: Viewer): PolygonCollectionSnapshot[] {
    const out: PolygonCollectionSnapshot[] = []
    const ids = viewer ? [...(this.buckets.get(viewer)?.polygons.keys() ?? [])] : [...this.idOwner.keys()]
    for (const id of ids) {
      const s = this.getPolygon(id)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    if (viewer) {
      return this.buckets.get(viewer)?.polygons.size ?? 0
    }
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? [...b.polygons.keys()] : []
    }
    return [...this.idOwner.keys()]
  }

  setSpecifyVisibility(id: string, show: boolean): void {
    this.setVisibility(id, show)
  }

  pruneInvalid(): number {
    let n = 0
    for (const [viewer, b] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of b.polygons.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }
}
