import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { CorridorCollectionAddItem, CorridorCollectionEntry, CorridorCollectionSnapshot, CorridorCollectionStoredData, CorridorCollectionUpdateEntry, CorridorCollectionUpdateProps } from '../../Types'
export type { CorridorCollectionAddItem, CorridorCollectionEntry, CorridorCollectionSnapshot, CorridorCollectionStoredData, CorridorCollectionUpdateEntry, CorridorCollectionUpdateProps }

type Bucket = {
  collection: Cesium.PrimitiveCollection
  corridors: Map<string, CorridorCollectionEntry>
}

function positionsToCartesian(positions: number[][]): Cesium.Cartesian3[] {
  return positions.map((pos) =>
    Cesium.Cartesian3.fromDegrees(Number(pos[0]), Number(pos[1]), Number(pos[2]) || 0),
  )
}

function parseCornerType(
  s: keyof typeof Cesium.CornerType | Cesium.CornerType | undefined,
): Cesium.CornerType {
  if (s === undefined) return Cesium.CornerType.ROUNDED
  if (typeof s === 'number') return s
  return Cesium.CornerType[s] ?? Cesium.CornerType.ROUNDED
}

function cornerTypeToKey(ct: Cesium.CornerType): string {
  const e = Cesium.CornerType
  if (ct === e.ROUNDED) return 'ROUNDED'
  if (ct === e.MITERED) return 'MITERED'
  if (ct === e.BEVELED) return 'BEVELED'
  return String(ct)
}

function buildPrimitive(data: CorridorCollectionStoredData): Primitive | undefined {
  const positions = positionsToCartesian(data.positions)
  if (positions.length < 2) return undefined

  const h0 = data.height ?? 0
  const h1 = data.extrudedHeight ?? h0

  const geometry = new Cesium.CorridorGeometry({
    positions,
    width: data.width,
    height: h0,
    extrudedHeight: h1,
    cornerType: data.cornerType,
    vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
  })

  const polygonInstance = new Cesium.GeometryInstance({
    geometry,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        Cesium.Color.fromCssColorString(data.color || '#00b96b').withAlpha(data.opacity ?? 1),
      ),
      show: new Cesium.ShowGeometryInstanceAttribute(data.show ?? true),
    },
    id: { corridorCollectionId: data.id },
  })

  const primitive = new Cesium.Primitive({
    geometryInstances: polygonInstance,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: Math.abs(h1 - h0) > 1e-3,
    }),
    asynchronous: false,
  })

  const ext = primitive as Primitive & { entityData?: Record<string, unknown> }
  ext.entityData = data.targetData
  return primitive
}

/**
 * 批量廊道（`CorridorGeometry` + `Primitive`）单例：首参传入 `viewer`，按 viewer 分桶。
 */
export default class CorridorCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(collection)
      b = { collection, corridors: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: CorridorCollectionEntry } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const entry = bucket?.corridors.get(id)
    if (!bucket || !entry) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, entry }
  }

  addCorridors(viewer: Viewer, dataList: CorridorCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(dataList) || dataList.length === 0) return []

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const created: string[] = []
    for (const raw of dataList) {
      const id = raw.id?.trim() ? raw.id.trim() : createRandomXgxId('crc')
      if (b.corridors.has(id)) {
        console.warn(`CorridorCollection: id 已存在，跳过: ${id}`)
        continue
      }
      if (!Array.isArray(raw.positions) || raw.positions.length < 2) {
        console.warn('CorridorCollection: positions 至少需要 2 个顶点，跳过一项')
        continue
      }

      const targetData: Record<string, unknown> = {
        ...(raw.entityData ?? {}),
        ...(raw.targetData ?? {}),
      }

      const width = Number(raw.width)
      if (!Number.isFinite(width) || width <= 0) {
        console.warn('CorridorCollection: width 无效，跳过一项')
        continue
      }

      const data: CorridorCollectionStoredData = {
        id,
        positions: raw.positions.map((p) => [Number(p[0]), Number(p[1]), Number(p[2]) || 0]),
        width,
        height: raw.height ?? 0,
        extrudedHeight: raw.extrudedHeight ?? raw.height ?? 0,
        cornerType: parseCornerType(raw.cornerType),
        color: raw.color ?? '#00b96b',
        opacity: raw.opacity ?? 1,
        show: raw.show ?? true,
        targetData,
      }

      try {
        const primitive = buildPrimitive(data)
        if (!primitive) continue
        b.collection.add(primitive)
        b.corridors.set(id, { data, primitive })
        this.idOwner.set(id, viewer)
        created.push(id)
      } catch (e) {
        console.warn('CorridorCollection: 构建 Primitive 失败，跳过一项', e)
      }
    }
    return created
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    bucket.collection.remove(entry.primitive)
    bucket.corridors.delete(id)
    this.idOwner.delete(id)
  }

  removeCorridor(id: string): void {
    this.remove(id)
  }

  removeAll(viewer?: Viewer): void {
    this.clear(viewer)
  }

  clear(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      if (!viewer.isDestroyed()) b.collection.removeAll()
      for (const id of b.corridors.keys()) this.idOwner.delete(id)
      b.corridors.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.corridors.keys()) this.idOwner.delete(id)
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
    const applyBucket = (bucket: Bucket) => {
      bucket.corridors.forEach((entry) => {
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

  setSpecifyVisibility(id: string, show: boolean): void {
    this.setVisibility(id, show)
  }

  /** 更新颜色/透明度：重建 Primitive */
  updateColor(id: string, color?: string, opacity?: number): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    const data = entry.data
    if (color) data.color = color
    if (opacity !== undefined) data.opacity = opacity
    bucket.collection.remove(entry.primitive)
    const next = buildPrimitive(data)
    if (!next) return
    bucket.collection.add(next)
    entry.primitive = next
    bucket.corridors.set(id, entry)
  }

  updateCorridor(id: string, props: CorridorCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { bucket, entry } = hit
    const data = entry.data

    if (props.positions !== undefined) {
      if (!Array.isArray(props.positions) || props.positions.length < 2) return false
      data.positions = props.positions.map((p) => [Number(p[0]), Number(p[1]), Number(p[2]) || 0])
    }
    if (props.width !== undefined) {
      const w = Number(props.width)
      if (!Number.isFinite(w) || w <= 0) return false
      data.width = w
    }
    if (props.height !== undefined) data.height = props.height
    if (props.extrudedHeight !== undefined) data.extrudedHeight = props.extrudedHeight
    if (props.cornerType !== undefined) data.cornerType = parseCornerType(props.cornerType)
    if (props.color !== undefined) data.color = props.color
    if (props.opacity !== undefined) data.opacity = props.opacity
    if (props.show !== undefined) data.show = props.show
    if (props.targetData !== undefined && typeof props.targetData === 'object') {
      data.targetData = { ...data.targetData, ...props.targetData }
    }

    bucket.collection.remove(entry.primitive)
    const next = buildPrimitive(data)
    if (!next) return false
    bucket.collection.add(next)
    entry.primitive = next
    bucket.corridors.set(id, entry)
    return true
  }

  updateCorridors(updates: CorridorCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateCorridor(id, rest) }))
  }

  getCorridor(id: string): CorridorCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { data } = hit.entry
    return {
      id: data.id,
      positions: data.positions.map((p) => [...p]),
      width: data.width,
      height: data.height,
      extrudedHeight: data.extrudedHeight,
      cornerType: cornerTypeToKey(data.cornerType),
      color: data.color,
      opacity: data.opacity,
      show: data.show,
      targetData: { ...data.targetData },
      vertexCount: data.positions.length,
    }
  }

  getAllCorridors(viewer?: Viewer): CorridorCollectionSnapshot[] {
    const out: CorridorCollectionSnapshot[] = []
    const ids = viewer ? [...(this.buckets.get(viewer)?.corridors.keys() ?? [])] : [...this.idOwner.keys()]
    for (const id of ids) {
      const s = this.getCorridor(id)
      if (s) out.push(s)
    }
    return out
  }

  getCorridorEntry(id: string): CorridorCollectionEntry | undefined {
    return this.resolve(id)?.entry
  }

  getCount(viewer?: Viewer): number {
    if (viewer) {
      return this.buckets.get(viewer)?.corridors.size ?? 0
    }
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? [...b.corridors.keys()] : []
    }
    return [...this.idOwner.keys()]
  }

  pruneInvalid(): number {
    let n = 0
    for (const [viewer, b] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of b.corridors.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }
}
