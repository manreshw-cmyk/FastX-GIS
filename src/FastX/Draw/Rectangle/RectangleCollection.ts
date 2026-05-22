import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { RectangleCollectionAddItem, RectangleCollectionEntry, RectangleCollectionSnapshot, RectangleCollectionStoredData } from '../../Types'
export type { RectangleCollectionAddItem, RectangleCollectionEntry, RectangleCollectionSnapshot, RectangleCollectionStoredData }

type Bucket = {
  collection: Cesium.PrimitiveCollection
  items: Map<string, RectangleCollectionEntry>
}

function normalizeDegrees(w: number, s: number, e: number, n: number): Cesium.Rectangle | undefined {
  let west = Number(w)
  let south = Number(s)
  let east = Number(e)
  let north = Number(n)
  if (![west, south, east, north].every((x) => Number.isFinite(x))) return undefined
  if (west > east) {
    const t = west
    west = east
    east = t
  }
  if (south > north) {
    const t = south
    south = north
    north = t
  }
  return Cesium.Rectangle.fromDegrees(west, south, east, north)
}

function buildPrimitive(data: RectangleCollectionStoredData): Primitive {
  const rect = normalizeDegrees(data.west, data.south, data.east, data.north)
  if (!rect) {
    throw new Error('RectangleCollection: 边界无效')
  }

  const instance = new Cesium.GeometryInstance({
    geometry: new Cesium.RectangleGeometry({
      rectangle: rect,
      height: 0,
      extrudedHeight: data.topHeight || 0,
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
    geometryInstances: instance,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
    }),
    asynchronous: false,
  })

  const ext = primitive as Primitive & { entityData?: Record<string, unknown> }
  ext.entityData = data.targetData
  return primitive
}

/**
 * 批量矩形（`RectangleGeometry` + `Primitive`）单例：首参 `viewer`，按视图分桶。
 */
export default class RectangleCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(collection)
      b = { collection, items: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: RectangleCollectionEntry } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const entry = bucket?.items.get(id)
    if (!bucket || !entry) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, entry }
  }

  addRectangles(viewer: Viewer, dataList: RectangleCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(dataList) || dataList.length === 0) return []

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const created: string[] = []
    for (const raw of dataList) {
      const id = raw.id?.trim() ? raw.id.trim() : createRandomXgxId('rcc')
      if (b.items.has(id)) {
        console.warn(`RectangleCollection: id 已存在，跳过: ${id}`)
        continue
      }
      const rect = normalizeDegrees(raw.west, raw.south, raw.east, raw.north)
      if (!rect) {
        console.warn('RectangleCollection: 边界无效，跳过一项')
        continue
      }

      const targetData: Record<string, unknown> = {
        ...(raw.entityData ?? {}),
        ...(raw.targetData ?? {}),
      }

      const data: RectangleCollectionStoredData = {
        id,
        west: Cesium.Math.toDegrees(rect.west),
        south: Cesium.Math.toDegrees(rect.south),
        east: Cesium.Math.toDegrees(rect.east),
        north: Cesium.Math.toDegrees(rect.north),
        topHeight: raw.topHeight ?? 0,
        color: raw.color ?? '#FFFFFF',
        opacity: raw.opacity ?? 1,
        show: raw.show ?? true,
        targetData,
      }

      try {
        const primitive = buildPrimitive(data)
        b.collection.add(primitive)
        b.items.set(id, { data, primitive })
        this.idOwner.set(id, viewer)
        created.push(id)
      } catch (e) {
        console.warn('RectangleCollection: 构建 Primitive 失败，跳过一项', e)
      }
    }
    return created
  }

  removeRectangle(id: string): void {
    this.remove(id)
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    bucket.collection.remove(entry.primitive)
    bucket.items.delete(id)
    this.idOwner.delete(id)
  }

  removeAll(viewer?: Viewer): void {
    this.clear(viewer)
  }

  clear(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      if (!viewer.isDestroyed()) b.collection.removeAll()
      for (const id of b.items.keys()) this.idOwner.delete(id)
      b.items.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.items.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }

  destroy(): void {
    this.clear()
  }

  setVisibility(id: string, show: boolean): void {
    const hit = this.resolve(id)
    if (!hit) return
    hit.entry.primitive.show = show
    hit.entry.data.show = show
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.items.forEach((entry) => {
        entry.primitive.show = show
        entry.data.show = show
      })
    }
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (b) walk(b)
      return
    }
    this.buckets.forEach(walk)
  }

  updateColor(id: string, color?: string, opacity?: number): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    const data = entry.data
    if (color) data.color = color
    if (opacity !== undefined) data.opacity = opacity
    bucket.collection.remove(entry.primitive)
    const prim = buildPrimitive(data)
    bucket.collection.add(prim)
    entry.primitive = prim
    bucket.items.set(id, entry)
  }

  getIdRectangle(id: string): RectangleCollectionEntry | undefined {
    return this.resolve(id)?.entry
  }

  getRectangleAll(viewer?: Viewer): Map<string, RectangleCollectionEntry> | undefined {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b || b.items.size === 0) return undefined
      return new Map(b.items)
    }
    if (this.idOwner.size === 0) return undefined
    const merged = new Map<string, RectangleCollectionEntry>()
    for (const b of this.buckets.values()) {
      for (const [id, e] of b.items) merged.set(id, e)
    }
    return merged.size ? merged : undefined
  }

  getRectangle(id: string): RectangleCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { data } = hit.entry
    return {
      id: data.id,
      west: data.west,
      south: data.south,
      east: data.east,
      north: data.north,
      topHeight: data.topHeight,
      color: data.color,
      opacity: data.opacity,
      show: data.show,
      targetData: { ...data.targetData },
    }
  }

  getAllRectangles(viewer?: Viewer): RectangleCollectionSnapshot[] {
    const out: RectangleCollectionSnapshot[] = []
    const ids = viewer ? [...(this.buckets.get(viewer)?.items.keys() ?? [])] : [...this.idOwner.keys()]
    for (const id of ids) {
      const s = this.getRectangle(id)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    if (viewer) return this.buckets.get(viewer)?.items.size ?? 0
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? [...b.items.keys()] : []
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
        for (const id of b.items.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }
}
