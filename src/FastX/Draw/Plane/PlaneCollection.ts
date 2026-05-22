import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import {
  DEFAULT_IMAGE_REPEAT,
  PlaneMaterialType,
  applyPlaneVideoOptions,
  buildPlaneMaterialForPrimitive,
  buildPlaneModelMatrix,
  disposePlaneVideoElement,
  normalizePlaneVideoOptions,
  resolvePlaneVideoOptions,
  type LegacyPlaneVideoOptions,
  type PlaneMaterialTypeValue,
  type PlaneVideoOptions,
  type VideoEndedListener,
} from './planeShared'

export interface PlaneCollectionAddItem {
  id?: string
  positions: number[]
  dimensions?: [number, number]
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  materialType?: PlaneMaterialTypeValue
  color?: string
  alpha?: number
  imageUrl?: string
  videoUrl?: string
  video?: PlaneVideoOptions
  imageRepeat?: { x: number; y: number }
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
  materialType?: PlaneMaterialTypeValue
  color?: string
  alpha?: number
  imageUrl?: string
  videoUrl?: string
  video?: PlaneVideoOptions
  imageRepeat?: { x: number; y: number }
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
  materialType: PlaneMaterialTypeValue
  colorCss: string
  imageUrl?: string
  videoUrl?: string
  video?: PlaneVideoOptions
  imageRepeat?: { x: number; y: number }
  show: boolean
  targetData: Record<string, unknown>
}

interface PlanePrimitiveMeta {
  id: string
  longitude: number
  latitude: number
  height: number
  width: number
  heightDim: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  materialType: PlaneMaterialTypeValue
  color: string
  alpha: number
  imageUrl?: string
  videoUrl?: string
  imageRepeat: { x: number; y: number }
  show: boolean
  targetData: Record<string, unknown>
  _primitive: Cesium.Primitive
  _videoElement?: HTMLVideoElement
  _videoEndedListener?: VideoEndedListener
  _videoOptions?: PlaneVideoOptions
}

type Bucket = {
  primitives: Map<string, PlanePrimitiveMeta>
}

const DEF_DIM: [number, number] = [200, 200]

function n(v: unknown, fb: number): number {
  const x = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(x) ? x : fb
}

function resolveMaterialType(raw: unknown, fb: PlaneMaterialTypeValue): PlaneMaterialTypeValue {
  if (
    raw === PlaneMaterialType.COLOR ||
    raw === PlaneMaterialType.IMAGE ||
    raw === PlaneMaterialType.VIDEO
  ) {
    return raw
  }
  return fb
}

function createPlanePrimitive(meta: PlanePrimitiveMeta): Cesium.Primitive {
  const vertexFormat = Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat
  const geometry = new Cesium.PlaneGeometry({ vertexFormat })
  const modelMatrix = buildPlaneModelMatrix(
    meta.longitude,
    meta.latitude,
    meta.height,
    meta.width,
    meta.heightDim,
    meta.headingDegrees,
    meta.pitchDegrees,
    meta.rollDegrees,
  )
  const { material, translucent, videoElement, videoEndedListener } = buildPlaneMaterialForPrimitive(
    {
      materialType: meta.materialType,
      color: meta.color,
      alpha: meta.alpha,
      imageUrl: meta.imageUrl,
      videoUrl: meta.videoUrl,
      video: meta._videoOptions,
      imageRepeat: meta.imageRepeat,
    },
    meta._videoElement,
    meta._videoEndedListener,
  )
  if (videoElement) {
    meta._videoElement = videoElement
    meta._videoEndedListener = videoEndedListener
  }

  const instance = new Cesium.GeometryInstance({ geometry, modelMatrix })
  return new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.MaterialAppearance({
      material,
      translucent,
      closed: false,
      faceForward: true,
    }),
    asynchronous: false,
  })
}

function snapshotFromMeta(m: PlanePrimitiveMeta): PlaneCollectionSnapshot {
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
    materialType: m.materialType,
    colorCss: m.color,
    imageUrl: m.imageUrl,
    videoUrl: m.videoUrl,
    video: m._videoOptions ? { ...m._videoOptions } : undefined,
    imageRepeat: { ...m.imageRepeat },
    show: m.show,
    targetData: { ...m.targetData },
  }
}

function tryParseAddItem(item: PlaneCollectionAddItem, id: string): PlanePrimitiveMeta | undefined {
  const { positions: pos, dimensions: dim = DEF_DIM, targetData = {} } = item
  if (!Array.isArray(pos) || pos.length < 2) return undefined
  const lon = n(pos[0], NaN)
  const lat = n(pos[1], NaN)
  const h = pos[2] !== undefined ? n(pos[2], 0) : 0
  const w = n(dim[0], DEF_DIM[0])
  const hd = n(dim[1], DEF_DIM[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || w <= 0 || hd <= 0) return undefined

  const materialType = resolveMaterialType(
    item.materialType ?? targetData.materialType,
    PlaneMaterialType.COLOR,
  )
  const color = item.color ?? (typeof targetData.color === 'string' ? targetData.color : '#00bcd4')
  const alpha = n(item.alpha ?? targetData.alpha, 0.85)
  const imageUrl = (item.imageUrl ?? targetData.imageUrl) as string | undefined
  const videoUrl = (item.videoUrl ?? targetData.videoUrl) as string | undefined
  const videoOpts = resolvePlaneVideoOptions(
    (item.video ?? targetData.video) as PlaneVideoOptions | undefined,
  )
  const repRaw = item.imageRepeat ?? targetData.imageRepeat
  const imageRepeat =
    repRaw && typeof repRaw === 'object'
      ? { x: n((repRaw as { x?: number }).x, 1), y: n((repRaw as { y?: number }).y, 1) }
      : { ...DEFAULT_IMAGE_REPEAT }
  const draft: PlanePrimitiveMeta = {
    id,
    longitude: lon,
    latitude: lat,
    height: h,
    width: w,
    heightDim: hd,
    headingDegrees: n(item.headingDegrees, 0),
    pitchDegrees: n(item.pitchDegrees, 0),
    rollDegrees: n(item.rollDegrees, 0),
    materialType,
    color,
    alpha,
    imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : undefined,
    videoUrl: typeof videoUrl === 'string' && videoUrl.trim() ? videoUrl.trim() : undefined,
    imageRepeat,
    show: item.show !== false,
    targetData: {
      ...targetData,
      materialType,
      color,
      alpha,
      imageUrl: imageUrl ?? undefined,
      videoUrl: videoUrl ?? undefined,
      video: materialType === PlaneMaterialType.VIDEO ? { ...videoOpts } : undefined,
      imageRepeat,
    },
    _primitive: null as unknown as Cesium.Primitive,
    _videoOptions: materialType === PlaneMaterialType.VIDEO ? videoOpts : undefined,
  }

  try {
    draft._primitive = createPlanePrimitive(draft)
    return draft
  } catch (e) {
    console.error(`PlaneCollection: 实例 ${id} 创建失败`, e)
    disposePlaneVideoElement(draft._videoElement)
    return undefined
  }
}

function needsMaterialRebuild(p: PlaneCollectionUpdateProps): boolean {
  return (
    p.materialType !== undefined ||
    p.color !== undefined ||
    p.alpha !== undefined ||
    p.imageUrl !== undefined ||
    p.videoUrl !== undefined ||
    p.imageRepeat !== undefined
  )
}

function needsVideoRuntimePatch(p: PlaneCollectionUpdateProps): boolean {
  return p.video !== undefined
}

function needsGeometryRebuild(p: PlaneCollectionUpdateProps): boolean {
  return (
    p.longitude !== undefined ||
    p.latitude !== undefined ||
    p.height !== undefined ||
    p.dimensions !== undefined ||
    p.headingDegrees !== undefined ||
    p.pitchDegrees !== undefined ||
    p.rollDegrees !== undefined
  )
}

/**
 * 批量平面：每个实例独立 `Primitive` + `MaterialAppearance`，支持纯色/图片/视频材质。
 */
export default class PlaneCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      b = { primitives: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; meta: PlanePrimitiveMeta } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const meta = bucket?.primitives.get(id)
    if (!bucket || !meta) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, meta }
  }

  private rebuildPrimitive(viewer: Viewer, meta: PlanePrimitiveMeta, show?: boolean): void {
    disposePlaneVideoElement(meta._videoElement, meta._videoEndedListener)
    meta._videoElement = undefined
    meta._videoEndedListener = undefined
    if (!viewer.isDestroyed()) {
      viewer.scene.primitives.remove(meta._primitive)
    }
    meta._primitive = createPlanePrimitive(meta)
    meta._primitive.show = show !== undefined ? show : meta.show
  }

  addPlanes(viewer: Viewer, options: PlaneCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(options) || options.length === 0) return []
    const b = this.ensureBucket(viewer)
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
      viewer.scene.primitives.add(meta._primitive)
      b.primitives.set(id, meta)
      this.idOwner.set(id, viewer)
      out.push(id)
    }
    return out
  }

  updatePlane(id: string, p: PlaneCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { viewer, meta: m } = hit

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

    if (p.materialType !== undefined) {
      m.materialType = resolveMaterialType(p.materialType, m.materialType)
    }
    if (p.color !== undefined) m.color = p.color
    if (p.alpha !== undefined) m.alpha = n(p.alpha, m.alpha)
    if (p.imageUrl !== undefined) {
      m.imageUrl = p.imageUrl.trim() ? p.imageUrl.trim() : undefined
    }
    if (p.videoUrl !== undefined) {
      m.videoUrl = p.videoUrl.trim() ? p.videoUrl.trim() : undefined
    }
    if (p.video !== undefined || p.materialType === PlaneMaterialType.VIDEO) {
      m._videoOptions = resolvePlaneVideoOptions(
        normalizePlaneVideoOptions((p.video ?? m._videoOptions) as LegacyPlaneVideoOptions),
      )
    } else if (p.materialType !== undefined) {
      m._videoOptions = undefined
    }
    if (p.imageRepeat !== undefined) {
      m.imageRepeat = {
        x: n(p.imageRepeat.x, m.imageRepeat.x),
        y: n(p.imageRepeat.y, m.imageRepeat.y),
      }
    }
    const videoEl = m._videoElement
    if (
      needsVideoRuntimePatch(p) &&
      m.materialType === PlaneMaterialType.VIDEO &&
      videoEl &&
      m._videoOptions
    ) {
      m._videoEndedListener = applyPlaneVideoOptions(videoEl, m._videoOptions, m._videoEndedListener)
      if (!viewer.isDestroyed()) viewer.scene.requestRender()
    }

    if (needsMaterialRebuild(p) || needsGeometryRebuild(p)) {
      this.rebuildPrimitive(viewer, m, p.show)
    }

    if (p.show !== undefined) {
      m.show = p.show
      m._primitive.show = p.show
    }

    if (p.targetData !== undefined) {
      m.targetData = { ...m.targetData, ...p.targetData }
    }

    m.targetData = {
      ...m.targetData,
      materialType: m.materialType,
      color: m.color,
      alpha: m.alpha,
      imageUrl: m.imageUrl,
      videoUrl: m.videoUrl,
      video: m._videoOptions,
      imageRepeat: m.imageRepeat,
      longitude: m.longitude,
      latitude: m.latitude,
      height: m.height,
      dimensions: [m.width, m.heightDim],
    }

    return true
  }

  updatePlanes(updates: PlaneCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updatePlane(id, rest) }))
  }

  getPlaneVideoElement(id: string): HTMLVideoElement | undefined {
    return this.resolve(id)?.meta._videoElement
  }

  playPlaneVideo(id: string): boolean {
    const el = this.getPlaneVideoElement(id)
    if (!el) return false
    void el.play().catch(() => {})
    return true
  }

  pausePlaneVideo(id: string): boolean {
    const el = this.getPlaneVideoElement(id)
    if (!el) return false
    el.pause()
    return true
  }

  restartPlaneVideo(id: string): boolean {
    const el = this.getPlaneVideoElement(id)
    if (!el) return false
    el.currentTime = 0
    void el.play().catch(() => {})
    return true
  }

  applyPlaneVideoOptions(id: string, video?: PlaneVideoOptions | LegacyPlaneVideoOptions): boolean {
    const hit = this.resolve(id)
    const videoEl = hit?.meta._videoElement
    if (!hit || !videoEl) return false
    const m = hit.meta
    const opts = resolvePlaneVideoOptions(normalizePlaneVideoOptions(video ?? m._videoOptions))
    m._videoOptions = { ...opts }
    m._videoEndedListener = applyPlaneVideoOptions(videoEl, opts, m._videoEndedListener)
    if (!hit.viewer.isDestroyed()) hit.viewer.scene.requestRender()
    return true
  }

  getPlane(id: string): PlaneCollectionSnapshot | null {
    const hit = this.resolve(id)
    return hit ? snapshotFromMeta(hit.meta) : null
  }

  getAllPlanes(viewer?: Viewer): PlaneCollectionSnapshot[] {
    return this.getAllIds(viewer)
      .map((id) => this.getPlane(id))
      .filter((s): s is PlaneCollectionSnapshot => s !== null)
  }

  getCount(viewer?: Viewer): number {
    return viewer ? (this.buckets.get(viewer)?.primitives.size ?? 0) : this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (!viewer) return [...this.idOwner.keys()]
    return [...(this.buckets.get(viewer)?.primitives.keys() ?? [])]
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.primitives.forEach((m) => {
        m.show = show
        m._primitive.show = show
      })
    }
    if (viewer) {
      const b = this.buckets.get(viewer)
      if (b) walk(b)
      return
    }
    this.buckets.forEach(walk)
  }

  setSpecifyVisibility(id: string, show: boolean): void {
    const hit = this.resolve(id)
    if (!hit) return
    hit.meta.show = show
    hit.meta._primitive.show = show
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { viewer, bucket, meta } = hit
    disposePlaneVideoElement(meta._videoElement, meta._videoEndedListener)
    if (!viewer.isDestroyed()) viewer.scene.primitives.remove(meta._primitive)
    bucket.primitives.delete(id)
    this.idOwner.delete(id)
  }

  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      for (const prim of b.primitives.values()) {
        disposePlaneVideoElement(prim._videoElement, prim._videoEndedListener)
        if (!viewer.isDestroyed()) viewer.scene.primitives.remove(prim._primitive)
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
      b.primitives.clear()
      return
    }
    for (const [v, buck] of this.buckets) {
      if (!v.isDestroyed()) {
        for (const prim of buck.primitives.values()) {
          disposePlaneVideoElement(prim._videoElement, prim._videoEndedListener)
          v.scene.primitives.remove(prim._primitive)
        }
      }
      for (const id of buck.primitives.keys()) this.idOwner.delete(id)
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
        for (const id of bk.primitives.keys()) this.idOwner.delete(id)
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
