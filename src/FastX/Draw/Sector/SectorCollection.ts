import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import { computeSectorCartesianRing } from './sectorWedge'

import type { SectorCollectionAddItem, SectorCollectionEntry, SectorCollectionSnapshot, SectorCollectionStoredData } from '../../Types'
export type { SectorCollectionAddItem, SectorCollectionEntry, SectorCollectionSnapshot, SectorCollectionStoredData }

type Bucket = {
  collection: Cesium.PrimitiveCollection
  sectors: Map<string, SectorCollectionEntry>
}

function buildPrimitive(data: SectorCollectionStoredData): Primitive {
  const [lng, lat, h] = data.center
  const ringScratch: Cesium.Cartesian3[] = []
  const positions = computeSectorCartesianRing(
    lng,
    lat,
    h,
    data.radius,
    data.startAzimuthDegrees,
    data.endAzimuthDegrees,
    data.segments,
    ringScratch,
  )
  if (positions.length < 3) {
    throw new Error('SectorCollection: 扇形顶点不足')
  }

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
 * 批量扇形（`PolygonGeometry` + `Primitive`）单例：首参 `viewer`，按视图分桶。
 */
export default class SectorCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(collection)
      b = { collection, sectors: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: SectorCollectionEntry } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const entry = bucket?.sectors.get(id)
    if (!bucket || !entry) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, entry }
  }

  addSectors(viewer: Viewer, dataList: SectorCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(dataList) || dataList.length === 0) return []

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const created: string[] = []
    for (const raw of dataList) {
      const id = raw.id?.trim() ? raw.id.trim() : createRandomXgxId('scc')
      if (b.sectors.has(id)) {
        console.warn(`SectorCollection: id 已存在，跳过: ${id}`)
        continue
      }
      if (!Array.isArray(raw.center) || raw.center.length < 2) {
        console.warn('SectorCollection: center 无效，跳过一项')
        continue
      }
      const radius = Number(raw.radius)
      if (!Number.isFinite(radius) || radius <= 0) {
        console.warn('SectorCollection: radius 无效，跳过一项')
        continue
      }
      const sa = Number(raw.startAzimuthDegrees)
      const ea = Number(raw.endAzimuthDegrees)
      if (!Number.isFinite(sa) || !Number.isFinite(ea)) {
        console.warn('SectorCollection: 方位角无效，跳过一项')
        continue
      }

      const targetData: Record<string, unknown> = {
        ...(raw.entityData ?? {}),
        ...(raw.targetData ?? {}),
      }

      const data: SectorCollectionStoredData = {
        id,
        center: [Number(raw.center[0]), Number(raw.center[1]), Number(raw.center[2]) || 0],
        radius,
        startAzimuthDegrees: sa,
        endAzimuthDegrees: ea,
        segments: Math.max(2, Math.floor(raw.segments ?? 32)),
        topHeight: raw.topHeight ?? 0,
        color: raw.color ?? '#FFFFFF',
        opacity: raw.opacity ?? 1,
        show: raw.show ?? true,
        targetData,
      }

      try {
        const primitive = buildPrimitive(data)
        b.collection.add(primitive)
        b.sectors.set(id, { data, primitive })
        this.idOwner.set(id, viewer)
        created.push(id)
      } catch (e) {
        console.warn('SectorCollection: 构建 Primitive 失败，跳过一项', e)
      }
    }
    return created
  }

  removeSector(id: string): void {
    this.remove(id)
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    bucket.collection.remove(entry.primitive)
    bucket.sectors.delete(id)
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
      for (const id of b.sectors.keys()) this.idOwner.delete(id)
      b.sectors.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.sectors.keys()) this.idOwner.delete(id)
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
      bucket.sectors.forEach((entry) => {
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
    const newPrimitive = buildPrimitive(data)
    bucket.collection.add(newPrimitive)
    entry.primitive = newPrimitive
    bucket.sectors.set(id, entry)
  }

  getIdSector(id: string): SectorCollectionEntry | undefined {
    return this.resolve(id)?.entry
  }

  getSectorAll(viewer?: Viewer): Map<string, SectorCollectionEntry> | undefined {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b || b.sectors.size === 0) return undefined
      return new Map(b.sectors)
    }
    if (this.idOwner.size === 0) return undefined
    const merged = new Map<string, SectorCollectionEntry>()
    for (const b of this.buckets.values()) {
      for (const [id, e] of b.sectors) merged.set(id, e)
    }
    return merged.size ? merged : undefined
  }

  getSector(id: string): SectorCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { data } = hit.entry
    return {
      id: data.id,
      longitude: data.center[0]!,
      latitude: data.center[1]!,
      height: data.center[2]!,
      radius: data.radius,
      startAzimuthDegrees: data.startAzimuthDegrees,
      endAzimuthDegrees: data.endAzimuthDegrees,
      segments: data.segments,
      topHeight: data.topHeight,
      color: data.color,
      opacity: data.opacity,
      show: data.show,
      targetData: { ...data.targetData },
    }
  }

  getAllSectors(viewer?: Viewer): SectorCollectionSnapshot[] {
    const out: SectorCollectionSnapshot[] = []
    const ids = viewer ? [...(this.buckets.get(viewer)?.sectors.keys() ?? [])] : [...this.idOwner.keys()]
    for (const id of ids) {
      const s = this.getSector(id)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    if (viewer) return this.buckets.get(viewer)?.sectors.size ?? 0
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? [...b.sectors.keys()] : []
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
        for (const id of b.sectors.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }
}
