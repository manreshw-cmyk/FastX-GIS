import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

export interface PlaneCollectionAddItem {
  id?: string
  positions: number[]
  dimensions?: [number, number]
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  color?: string
  alpha?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PlaneCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  dimensions?: [number, number]
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  color?: string
  alpha?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PlaneCollectionUpdateEntry extends PlaneCollectionUpdateProps {
  id: string
}

export interface PlaneCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  width: number
  planeHeight: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  colorCss: string
  show: boolean
  targetData: Record<string, unknown>
}

type Inst = {
  id: string
  longitude: number
  latitude: number
  height: number
  width: number
  heightDim: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  color: Cesium.Color
  show: boolean
  targetData: Record<string, unknown>
}

type Bucket = {
  primitive: Cesium.Primitive | undefined
  planes: Map<string, Inst>
}

const DEF_DIM: [number, number] = [200, 200]

function n(v: unknown, fb: number): number {
  const x = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(x) ? x : fb
}

function cssColor(c: Cesium.Color): string {
  return typeof c.toCssColorString === 'function' ? c.toCssColorString() : '#ffffff'
}

function toInstance(m: Inst): Cesium.GeometryInstance {
  const center = Cesium.Cartesian3.fromDegrees(m.longitude, m.latitude, m.height)
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center)
  const hpr = Cesium.HeadingPitchRoll.fromDegrees(m.headingDegrees, m.pitchDegrees, m.rollDegrees)
  const rot = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromHeadingPitchRoll(hpr), Cesium.Cartesian3.ZERO)
  /** Cesium 1.140+ `PlaneGeometry` 仅为单位 1×1 平面，尺寸通过缩放矩阵施加。 */
  const scale = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(m.width, m.heightDim, 1.0), new Cesium.Matrix4())
  const rotScale = Cesium.Matrix4.multiply(rot, scale, new Cesium.Matrix4())
  const modelMatrix = Cesium.Matrix4.multiply(enu, rotScale, new Cesium.Matrix4())
  const geometry = new Cesium.PlaneGeometry({
    vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
  })
  return new Cesium.GeometryInstance({
    geometry,
    id: m.id,
    modelMatrix,
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(m.color) },
  })
}

function snapshot(m: Inst): PlaneCollectionSnapshot {
  return {
    id: m.id,
    longitude: m.longitude,
    latitude: m.latitude,
    height: m.height,
    width: m.width,
    planeHeight: m.heightDim,
    headingDegrees: m.headingDegrees,
    pitchDegrees: m.pitchDegrees,
    rollDegrees: m.rollDegrees,
    colorCss: cssColor(m.color),
    show: m.show,
    targetData: { ...m.targetData },
  }
}

function tryParseAddItem(item: PlaneCollectionAddItem, id: string): Inst | undefined {
  const { positions: pos, dimensions: dim = DEF_DIM, targetData = {} } = item
  if (!Array.isArray(pos) || pos.length < 2) return undefined
  const lon = n(pos[0], NaN)
  const lat = n(pos[1], NaN)
  const h = pos[2] !== undefined ? n(pos[2], 0) : 0
  const w = n(dim[0], DEF_DIM[0])
  const hd = n(dim[1], DEF_DIM[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || w <= 0 || hd <= 0) return undefined
  return {
    id,
    longitude: lon,
    latitude: lat,
    height: h,
    width: w,
    heightDim: hd,
    headingDegrees: n(item.headingDegrees, 0),
    pitchDegrees: n(item.pitchDegrees, 0),
    rollDegrees: n(item.rollDegrees, 0),
    color: Cesium.Color.fromCssColorString(item.color ?? '#00bcd4').withAlpha(n(item.alpha, 0.85)),
    show: item.show !== false,
    targetData: { ...targetData },
  }
}

/**
 * 批量平面：`PlaneGeometry` + 单 `Primitive` 多实例 + `PerInstanceColorAppearance`。
 * 增删改显隐对该 viewer 桶全量重建 Primitive。
 */
export default class PlaneCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private bucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      b = { primitive: undefined, planes: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private hit(id: string): { viewer: Viewer; bucket: Bucket; meta: Inst } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const meta = bucket?.planes.get(id)
    if (!bucket || !meta) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, meta }
  }

  private rebuild(viewer: Viewer, bucket: Bucket): void {
    if (viewer.isDestroyed()) return
    if (bucket.primitive) {
      viewer.scene.primitives.remove(bucket.primitive)
      bucket.primitive = undefined
    }
    const list: Cesium.GeometryInstance[] = []
    for (const m of bucket.planes.values()) {
      if (!m.show) continue
      try {
        list.push(toInstance(m))
      } catch (e) {
        console.error(`PlaneCollection: 实例 ${m.id} 几何失败`, e)
      }
    }
    if (!list.length) return
    let translucent = false
    for (const m of bucket.planes.values()) {
      if (m.show && m.color.alpha < 1) {
        translucent = true
        break
      }
    }
    bucket.primitive = new Cesium.Primitive({
      geometryInstances: list,
      appearance: new Cesium.PerInstanceColorAppearance({ closed: false, translucent, flat: false }),
      asynchronous: false,
    })
    viewer.scene.primitives.add(bucket.primitive)
  }

  addPlanes(viewer: Viewer, options: PlaneCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(options) || options.length === 0) return []
    const b = this.bucket(viewer)
    if (!b) return []
    const out: string[] = []
    for (let i = 0; i < options.length; i++) {
      const item = options[i]!
      const id = item.id?.trim() || createRandomXgxId('plcol')
      if (this.idOwner.has(id)) {
        console.warn(`PlaneCollection: ID "${id}" 已存在，跳过`)
        continue
      }
      const meta = tryParseAddItem(item, id)
      if (!meta) continue
      b.planes.set(id, meta)
      this.idOwner.set(id, viewer)
      out.push(id)
    }
    if (out.length) this.rebuild(viewer, b)
    return out
  }

  updatePlane(id: string, p: PlaneCollectionUpdateProps): boolean {
    const h = this.hit(id)
    if (!h) return false
    const { viewer, bucket, meta: m } = h
    if (p.longitude !== undefined) m.longitude = n(p.longitude, m.longitude)
    if (p.latitude !== undefined) m.latitude = n(p.latitude, m.latitude)
    if (p.height !== undefined) m.height = n(p.height, m.height)
    if (p.dimensions !== undefined) {
      m.width = n(p.dimensions[0], m.width)
      m.heightDim = n(p.dimensions[1], m.heightDim)
    }
    if (p.headingDegrees !== undefined) m.headingDegrees = n(p.headingDegrees, 0)
    if (p.pitchDegrees !== undefined) m.pitchDegrees = n(p.pitchDegrees, 0)
    if (p.rollDegrees !== undefined) m.rollDegrees = n(p.rollDegrees, 0)
    if (p.color !== undefined || p.alpha !== undefined) {
      const css = p.color ?? cssColor(m.color)
      const base = Cesium.Color.fromCssColorString(css)
      const a = p.alpha !== undefined && Number.isFinite(p.alpha) ? p.alpha : m.color.alpha
      m.color = base.withAlpha(a)
    }
    if (p.show !== undefined) m.show = p.show
    if (p.targetData !== undefined) m.targetData = { ...m.targetData, ...p.targetData }
    this.rebuild(viewer, bucket)
    return true
  }

  updatePlanes(updates: PlaneCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updatePlane(id, rest) }))
  }

  getPlane(id: string): PlaneCollectionSnapshot | null {
    const h = this.hit(id)
    return h ? snapshot(h.meta) : null
  }

  getAllPlanes(viewer?: Viewer): PlaneCollectionSnapshot[] {
    return this.getAllIds(viewer)
      .map((id) => this.getPlane(id))
      .filter((s): s is PlaneCollectionSnapshot => s !== null)
  }

  getCount(viewer?: Viewer): number {
    return viewer ? (this.buckets.get(viewer)?.planes.size ?? 0) : this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (!viewer) return [...this.idOwner.keys()]
    return [...(this.buckets.get(viewer)?.planes.keys() ?? [])]
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const run = (v: Viewer, bk: Bucket) => {
      bk.planes.forEach((m) => {
        m.show = show
      })
      this.rebuild(v, bk)
    }
    if (viewer) {
      const bk = this.buckets.get(viewer)
      if (bk) run(viewer, bk)
      return
    }
    for (const [v, bk] of this.buckets) {
      if (!v.isDestroyed()) run(v, bk)
    }
  }

  setSpecifyVisibility(id: string, show: boolean): void {
    const h = this.hit(id)
    if (!h) return
    h.meta.show = show
    this.rebuild(h.viewer, h.bucket)
  }

  remove(id: string): void {
    const h = this.hit(id)
    if (!h) return
    h.bucket.planes.delete(id)
    this.idOwner.delete(id)
    this.rebuild(h.viewer, h.bucket)
  }

  removeAll(viewer?: Viewer): void {
    const dropPrim = (v: Viewer, bk: Bucket) => {
      if (bk.primitive && !v.isDestroyed()) {
        v.scene.primitives.remove(bk.primitive)
        bk.primitive = undefined
      }
    }
    if (viewer !== undefined) {
      const bk = this.buckets.get(viewer)
      if (!bk) return
      for (const id of bk.planes.keys()) this.idOwner.delete(id)
      bk.planes.clear()
      dropPrim(viewer, bk)
      return
    }
    for (const [v, bk] of this.buckets) {
      for (const id of bk.planes.keys()) this.idOwner.delete(id)
      bk.planes.clear()
      dropPrim(v, bk)
    }
    this.buckets.clear()
  }

  clear(viewer?: Viewer): void {
    this.removeAll(viewer)
  }

  pruneInvalid(): number {
    let nOut = 0
    for (const [viewer, bk] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of bk.planes.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        nOut++
      }
    }
    return nOut
  }

  destroy(): void {
    this.removeAll()
  }
}
