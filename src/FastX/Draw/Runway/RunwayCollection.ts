import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

/** 批量跑道：与廊道批量相同，仅允许 **2** 个顶点（起点、终点）；无流动材质，仅实体几何 + 实例色。 */
export interface RunwayCollectionAddItem {
  id?: string
  /** `[[lng,lat,h?],[lng,lat,h?]]` 恰好 2 点 */
  positions: number[][]
  width: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface RunwayCollectionStoredData {
  id: string
  positions: number[][]
  width: number
  height: number
  extrudedHeight: number
  cornerType: Cesium.CornerType
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface RunwayCollectionEntry {
  data: RunwayCollectionStoredData
  primitive: Primitive
}

export interface RunwayCollectionSnapshot {
  id: string
  positions: number[][]
  width: number
  height: number
  extrudedHeight: number
  cornerType: string
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
  vertexCount: number
}

export interface RunwayCollectionUpdateProps {
  positions?: number[][]
  width?: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string
  opacity?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface RunwayCollectionUpdateEntry extends RunwayCollectionUpdateProps {
  id: string
}

type Bucket = {
  collection: Cesium.PrimitiveCollection
  runways: Map<string, RunwayCollectionEntry>
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

function buildPrimitive(data: RunwayCollectionStoredData): Primitive | undefined {
  if (!Array.isArray(data.positions) || data.positions.length !== 2) return undefined
  const positions = positionsToCartesian(data.positions)

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
        Cesium.Color.fromCssColorString(data.color || '#6b7a8f').withAlpha(data.opacity ?? 1),
      ),
      show: new Cesium.ShowGeometryInstanceAttribute(data.show ?? true),
    },
    id: { runwayCollectionId: data.id },
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
 * 批量跑道（`CorridorGeometry` + `Primitive`），与廊道批量一致；每条 **仅 2 点**，无流动材质。
 */
export default class RunwayCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(collection)
      b = { collection, runways: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: RunwayCollectionEntry } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const entry = bucket?.runways.get(id)
    if (!bucket || !entry) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, entry }
  }

  addRunways(viewer: Viewer, dataList: RunwayCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(dataList) || dataList.length === 0) return []

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const created: string[] = []

    for (const raw of dataList) {
      const id = raw.id?.trim() ? raw.id.trim() : createRandomXgxId('rwc')
      if (b.runways.has(id)) {
        console.warn(`RunwayCollection: id 已存在，跳过: ${id}`)
        continue
      }
      if (!Array.isArray(raw.positions) || raw.positions.length !== 2) {
        console.warn('RunwayCollection: 每条跑道必须恰好 2 个顶点（起点、终点），跳过一项')
        continue
      }

      const targetData: Record<string, unknown> = {
        ...(raw.entityData ?? {}),
        ...(raw.targetData ?? {}),
      }

      const width = Number(raw.width)
      if (!Number.isFinite(width) || width <= 0) {
        console.warn('RunwayCollection: width 无效，跳过一项')
        continue
      }

      const data: RunwayCollectionStoredData = {
        id,
        positions: raw.positions.map((p) => [Number(p[0]), Number(p[1]), Number(p[2]) || 0]),
        width,
        height: raw.height ?? 0,
        extrudedHeight: raw.extrudedHeight ?? raw.height ?? 0,
        cornerType: parseCornerType(raw.cornerType),
        color: raw.color ?? '#6b7a8f',
        opacity: raw.opacity ?? 1,
        show: raw.show !== false,
        targetData,
      }

      try {
        const primitive = buildPrimitive(data)
        if (!primitive) continue
        b.collection.add(primitive)
        b.runways.set(id, { data, primitive })
        this.idOwner.set(id, viewer)
        created.push(id)
      } catch (e) {
        console.warn('RunwayCollection: 构建 Primitive 失败，跳过一项', e)
      }
    }
    return created
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { bucket, entry } = hit
    bucket.collection.remove(entry.primitive)
    bucket.runways.delete(id)
    this.idOwner.delete(id)
  }

  removeRunway(id: string): void {
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
      for (const id of b.runways.keys()) this.idOwner.delete(id)
      b.runways.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.runways.keys()) this.idOwner.delete(id)
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
      bucket.runways.forEach((entry) => {
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

  updateRunway(id: string, props: RunwayCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { bucket, entry } = hit
    const data = entry.data

    if (props.positions !== undefined) {
      if (!Array.isArray(props.positions) || props.positions.length !== 2) return false
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
    bucket.runways.set(id, entry)
    return true
  }

  updateRunways(updates: RunwayCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateRunway(id, rest) }))
  }

  getRunway(id: string): RunwayCollectionSnapshot | null {
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

  getAllRunways(viewer?: Viewer): RunwayCollectionSnapshot[] {
    const out: RunwayCollectionSnapshot[] = []
    const ids = viewer ? [...(this.buckets.get(viewer)?.runways.keys() ?? [])] : [...this.idOwner.keys()]
    for (const id of ids) {
      const s = this.getRunway(id)
      if (s) out.push(s)
    }
    return out
  }

  getRunwayEntry(id: string): RunwayCollectionEntry | undefined {
    return this.resolve(id)?.entry
  }

  getCount(viewer?: Viewer): number {
    if (viewer) {
      return this.buckets.get(viewer)?.runways.size ?? 0
    }
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? [...b.runways.keys()] : []
    }
    return [...this.idOwner.keys()]
  }

  pruneInvalid(): number {
    let n = 0
    for (const [viewer, b] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of b.runways.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }
}
