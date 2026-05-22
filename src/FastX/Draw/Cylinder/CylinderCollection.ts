import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

export interface CylinderCollectionAddItem {
  id?: string
  longitude: number
  latitude: number
  height?: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface CylinderCollectionStoredData {
  id: string
  longitude: number
  latitude: number
  height: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface CylinderCollectionEntry {
  data: CylinderCollectionStoredData
  primitive: Primitive
}

export interface CylinderCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

type Bucket = {
  collection: Cesium.PrimitiveCollection
  items: Map<string, CylinderCollectionEntry>
}

function validCylinderDims(length: number, topR: number, bottomR: number): boolean {
  return Number.isFinite(length) && length > 0 && topR >= 0 && bottomR >= 0 && (topR > 0 || bottomR > 0)
}

function toFiniteNumber(n: unknown): number | undefined {
  if (n === null || n === undefined || n === '') return undefined
  if (typeof n === 'bigint') {
    const x = Number(n)
    return Number.isFinite(x) ? x : undefined
  }
  if (typeof n === 'string') {
    const t = n.trim().replace(/，/g, '.').replace(/,/g, '.')
    if (t === '') return undefined
    const x = Number(t)
    return Number.isFinite(x) ? x : undefined
  }
  if (typeof n === 'number') return Number.isFinite(n) ? n : undefined
  const x = Number(n)
  return Number.isFinite(x) ? x : undefined
}

/** `a-input-number` 清空为 `null`；字符串经纬/长度也兼容 */
function asStrictLength(n: unknown): number | undefined {
  const x = toFiniteNumber(n)
  if (x === undefined || x <= 0) return undefined
  return x
}

function asRadius(n: unknown): number {
  if (n === null || n === undefined || n === '') return 0
  const x = toFiniteNumber(n)
  if (x === undefined) return NaN
  return x >= 0 ? x : NaN
}

function asLngLat(n: unknown): number | undefined {
  return toFiniteNumber(n)
}

function asHeightM(n: unknown): number {
  return toFiniteNumber(n) ?? 0
}

function idFromRaw(raw: CylinderCollectionAddItem): string {
  const v = (raw as { id?: unknown }).id
  if (v === undefined || v === null) return createRandomXgxId('cyc')
  const s = String(v).trim()
  return s ? s : createRandomXgxId('cyc')
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function colorFromCssSafe(css: string | undefined, opacity: number): Cesium.Color {
  const o = Number.isFinite(opacity) ? clamp01(opacity) : 1
  try {
    return Cesium.Color.fromCssColorString(css || '#FFFFFF').withAlpha(o)
  } catch {
    return Cesium.Color.WHITE.withAlpha(o)
  }
}

function buildModelMatrix(
  center: Cesium.Cartesian3,
  ellipsoid: Cesium.Ellipsoid,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
): Cesium.Matrix4 {
  /** API 为 `eastNorthUpToFixedFrame(origin, ellipsoid?, result?)`，第三参是 Matrix4，切勿再传 ellipsoid（会把椭球当 result 写入 → not extensible） */
  const enu = new Cesium.Matrix4()
  Cesium.Transforms.eastNorthUpToFixedFrame(center, ellipsoid, enu)
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(headingDeg),
    Cesium.Math.toRadians(pitchDeg),
    Cesium.Math.toRadians(rollDeg),
  )
  const rot3 = Cesium.Matrix3.fromHeadingPitchRoll(hpr, new Cesium.Matrix3())
  const rot4 = Cesium.Matrix4.fromRotationTranslation(rot3, Cesium.Cartesian3.ZERO, new Cesium.Matrix4())
  return Cesium.Matrix4.multiply(enu, rot4, new Cesium.Matrix4())
}

function buildPrimitive(data: CylinderCollectionStoredData, ellipsoid: Cesium.Ellipsoid): Primitive {
  if (!validCylinderDims(data.length, data.topRadius, data.bottomRadius)) {
    throw new Error('CylinderCollection: 尺寸无效')
  }
  const center = Cesium.Cartesian3.fromDegrees(data.longitude, data.latitude, data.height, ellipsoid)
  const modelMatrix = buildModelMatrix(center, ellipsoid, data.headingDegrees, data.pitchDegrees, data.rollDegrees)

  const instance = new Cesium.GeometryInstance({
    geometry: new Cesium.CylinderGeometry({
      length: data.length,
      topRadius: data.topRadius,
      bottomRadius: data.bottomRadius,
      slices: 128,
      vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
    }),
    modelMatrix,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorFromCssSafe(data.color, data.opacity)),
      show: new Cesium.ShowGeometryInstanceAttribute(data.show ?? true),
    },
    id: { xgxCylinderCollectionId: data.id },
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
 * 批量圆柱 / 圆锥（`CylinderGeometry` + `Primitive`）单例：首参 `viewer`，按视图分桶。
 */
export default class CylinderCollection {
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
    } else if (
      typeof viewer.scene.primitives.contains === 'function' &&
      !viewer.scene.primitives.contains(b.collection)
    ) {
      /** 子集合若已不在根 `primitives` 上（被外部 remove 或随内部状态失效），原实例可能已不可写，需换新集合并清桶内索引 */
      for (const id of b.items.keys()) this.idOwner.delete(id)
      b.items.clear()
      const next = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(next)
      b.collection = next
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; entry: CylinderCollectionEntry } | undefined {
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

  addCylinders(viewer: Viewer, dataList: CylinderCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(dataList) || dataList.length === 0) return []

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const ellipsoid = viewer.scene.globe.ellipsoid
    const created: string[] = []
    for (const raw of dataList) {
      const id = idFromRaw(raw)
      if (b.items.has(id)) {
        console.warn(`CylinderCollection: id 已存在，跳过: ${id}`)
        continue
      }

      const length = asStrictLength(raw.length)
      const topR = asRadius(raw.topRadius)
      const bottomR = asRadius(raw.bottomRadius)
      const lng = asLngLat(raw.longitude)
      const lat = asLngLat(raw.latitude)
      if (
        lng === undefined ||
        lat === undefined ||
        length === undefined ||
        !Number.isFinite(topR) ||
        !Number.isFinite(bottomR) ||
        !validCylinderDims(length, topR, bottomR)
      ) {
        console.warn('CylinderCollection: 参数无效，跳过一项', {
          id,
          lng,
          lat,
          length,
          topR,
          bottomR,
          rawLng: raw.longitude,
          rawLat: raw.latitude,
          rawLen: raw.length,
          rawTop: raw.topRadius,
          rawBot: raw.bottomRadius,
        })
        continue
      }

      const targetData: Record<string, unknown> = {
        ...(raw.entityData ?? {}),
        ...(raw.targetData ?? {}),
      }

      const hd = toFiniteNumber(raw.headingDegrees) ?? 0
      const pd = toFiniteNumber(raw.pitchDegrees) ?? 0
      const rd = toFiniteNumber(raw.rollDegrees) ?? 0
      const opacityRaw = toFiniteNumber(raw.opacity)
      const opacity = opacityRaw !== undefined ? clamp01(opacityRaw) : 1

      const data: CylinderCollectionStoredData = {
        id,
        longitude: lng,
        latitude: lat,
        height: asHeightM(raw.height),
        length,
        topRadius: topR,
        bottomRadius: bottomR,
        headingDegrees: hd,
        pitchDegrees: pd,
        rollDegrees: rd,
        color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : '#3388ff',
        opacity,
        show: raw.show ?? true,
        targetData,
      }

      try {
        const primitive = buildPrimitive(data, ellipsoid)
        b.collection.add(primitive)
        b.items.set(id, { data, primitive })
        this.idOwner.set(id, viewer)
        created.push(id)
      } catch (e) {
        console.warn('CylinderCollection: 构建 Primitive 失败，跳过一项', e instanceof Error ? e.message : e)
      }
    }
    return created
  }

  removeCylinder(id: string): void {
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
    const ellipsoid = hit.viewer.scene.globe.ellipsoid
    bucket.collection.remove(entry.primitive)
    const prim = buildPrimitive(data, ellipsoid)
    bucket.collection.add(prim)
    entry.primitive = prim
    bucket.items.set(id, entry)
  }

  getIdCylinder(id: string): CylinderCollectionEntry | undefined {
    return this.resolve(id)?.entry
  }

  getCylinderAll(viewer?: Viewer): Map<string, CylinderCollectionEntry> | undefined {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b || b.items.size === 0) return undefined
      return new Map(b.items)
    }
    if (this.idOwner.size === 0) return undefined
    const merged = new Map<string, CylinderCollectionEntry>()
    for (const b of this.buckets.values()) {
      for (const [id, e] of b.items) merged.set(id, e)
    }
    return merged.size ? merged : undefined
  }

  getCylinder(id: string): CylinderCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { data } = hit.entry
    return {
      id: data.id,
      longitude: data.longitude,
      latitude: data.latitude,
      height: data.height,
      length: data.length,
      topRadius: data.topRadius,
      bottomRadius: data.bottomRadius,
      headingDegrees: data.headingDegrees,
      pitchDegrees: data.pitchDegrees,
      rollDegrees: data.rollDegrees,
      color: data.color,
      opacity: data.opacity,
      show: data.show,
      targetData: { ...data.targetData },
    }
  }

  getAllCylinders(viewer?: Viewer): CylinderCollectionSnapshot[] {
    const out: CylinderCollectionSnapshot[] = []
    const ids = viewer ? [...(this.buckets.get(viewer)?.items.keys() ?? [])] : [...this.idOwner.keys()]
    for (const id of ids) {
      const s = this.getCylinder(id)
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
