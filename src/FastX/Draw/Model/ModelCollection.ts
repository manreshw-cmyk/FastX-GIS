import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type {
  ModelCollectionAddItem,
  ModelCollectionOrientationDegrees,
  ModelCollectionSnapshot,
  ModelCollectionUpdateEntry,
  ModelCollectionUpdateProps,
} from '../../Types'
export type {
  ModelCollectionAddItem,
  ModelCollectionOrientationDegrees,
  ModelCollectionSnapshot,
  ModelCollectionUpdateEntry,
  ModelCollectionUpdateProps,
}

type ModelMeta = {
  id: string
  position: Cesium.Cartesian3
  orientationDeg: ModelCollectionOrientationDegrees
  heightReference: Cesium.HeightReference
  scale: number
  minimumPixelSize: number
  maximumScale?: number
  uri: string
  model: Cesium.Model
  _targetData?: Record<string, unknown>
}

type Bucket = {
  primitives: Map<string, ModelMeta>
}

type PreparedModelAdd = {
  index: number
  id: string
  position: Cesium.Cartesian3
  orientation: ModelCollectionOrientationDegrees
  uri: string
  show: boolean
  scale: number
  minimumPixelSize: number
  maximumScale?: number
  heightReferenceKey: keyof typeof Cesium.HeightReference
  targetData: Record<string, unknown>
}

function parseHeightRef(s: keyof typeof Cesium.HeightReference | undefined): Cesium.HeightReference {
  if (!s) return Cesium.HeightReference.NONE
  return Cesium.HeightReference[s] ?? Cesium.HeightReference.NONE
}

function orientationFromAddItem(item: ModelCollectionAddItem): ModelCollectionOrientationDegrees {
  return {
    heading: item.headingDegrees !== undefined ? Number(item.headingDegrees) : 0,
    pitch: item.pitchDegrees !== undefined ? Number(item.pitchDegrees) : 0,
    roll: item.rollDegrees !== undefined ? Number(item.rollDegrees) : 0,
  }
}

function mergeOrientationDeg(
  current: ModelCollectionOrientationDegrees,
  patch: ModelCollectionUpdateProps,
): ModelCollectionOrientationDegrees {
  return {
    heading:
      patch.headingDegrees !== undefined && Number.isFinite(Number(patch.headingDegrees))
        ? Number(patch.headingDegrees)
        : current.heading,
    pitch:
      patch.pitchDegrees !== undefined && Number.isFinite(Number(patch.pitchDegrees))
        ? Number(patch.pitchDegrees)
        : current.pitch,
    roll:
      patch.rollDegrees !== undefined && Number.isFinite(Number(patch.rollDegrees))
        ? Number(patch.rollDegrees)
        : current.roll,
  }
}

/**
 * 在给定地心坐标位置处，按航向/俯仰/横滚（度）生成模型 `modelMatrix`（与 `Transforms.headingPitchRollToFixedFrame` 一致）。
 */
export function computeModelCollectionModelMatrix(
  position: Cesium.Cartesian3,
  orientationDeg: ModelCollectionOrientationDegrees,
): Cesium.Matrix4 {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(orientationDeg.heading),
    Cesium.Math.toRadians(orientationDeg.pitch),
    Cesium.Math.toRadians(orientationDeg.roll),
  )
  return Cesium.Transforms.headingPitchRollToFixedFrame(position, hpr)
}

function syncOrientationToTargetData(meta: ModelMeta): void {
  const o = meta.orientationDeg
  meta._targetData = {
    ...(meta._targetData ?? {}),
    headingDegrees: o.heading,
    pitchDegrees: o.pitch,
    rollDegrees: o.roll,
  }
}

/**
 * 批量 glTF 模型（`Model.fromGltfAsync` Primitive），按 `viewer` 分桶。
 */
export default class ModelCollection {
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

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; meta: ModelMeta } | undefined {
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

  /**
   * 批量加载模型（异步）。先校验 id 与参数，再并行 `fromGltfAsync`，最后统一挂到场景。
   * 成功项返回 id 列表；失败项在控制台输出并跳过。
   */
  async addModels(viewer: Viewer, options: ModelCollectionAddItem[]): Promise<string[]> {
    if (!Array.isArray(options) || options.length === 0) return []
    const b = this.ensureBucket(viewer)
    if (!b || viewer.isDestroyed()) return []

    const prepared: PreparedModelAdd[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const id = item.id?.trim() ? item.id.trim() : createRandomXgxId('mc')
      const {
        positions,
        uri,
        show = true,
        scale = 1,
        minimumPixelSize = 0,
        maximumScale,
        heightReference = 'NONE',
        targetData = {},
      } = item

      if (!uri?.trim() || !Array.isArray(positions) || positions.length < 2) continue
      if (this.idOwner.has(id)) {
        console.warn(`ModelCollection: ID "${id}" 已存在，跳过`)
        continue
      }

      const height = positions[2] !== undefined ? Number(positions[2]) : 0
      const position = Cesium.Cartesian3.fromDegrees(Number(positions[0]), Number(positions[1]), height)
      prepared.push({
        index,
        id,
        position,
        orientation: orientationFromAddItem(item),
        uri: uri.trim(),
        show,
        scale,
        minimumPixelSize,
        maximumScale,
        heightReferenceKey: heightReference,
        targetData: { ...targetData, modelUri: uri.trim() },
      })
    }

    if (prepared.length === 0) return []

    const heightRefParsed = (p: PreparedModelAdd) => parseHeightRef(p.heightReferenceKey)

    const settled = await Promise.allSettled(
      prepared.map((p) =>
        Cesium.Model.fromGltfAsync({
          url: p.uri,
          modelMatrix: computeModelCollectionModelMatrix(p.position, p.orientation),
          scale: p.scale,
          minimumPixelSize: p.minimumPixelSize,
          maximumScale: p.maximumScale,
          heightReference: heightRefParsed(p),
          id: p.id,
        }),
      ),
    )

    const createdIds: string[] = []
    for (let i = 0; i < settled.length; i++) {
      const p = prepared[i]!
      const r = settled[i]!
      if (r.status === 'rejected') {
        console.error(`ModelCollection: 添加第${p.index}个模型失败:`, r.reason)
        continue
      }
      const model = r.value
      model.show = p.show
      viewer.scene.primitives.add(model)

      const hr = heightRefParsed(p)
      const meta: ModelMeta = {
        id: p.id,
        position: Cesium.Cartesian3.clone(p.position),
        orientationDeg: { ...p.orientation },
        heightReference: hr,
        scale: p.scale,
        minimumPixelSize: p.minimumPixelSize,
        maximumScale: p.maximumScale,
        uri: p.uri,
        model,
        _targetData: p.targetData,
      }
      syncOrientationToTargetData(meta)
      b.primitives.set(p.id, meta)
      this.idOwner.set(p.id, viewer)
      createdIds.push(p.id)
    }
    return createdIds
  }

  updateModel(id: string, properties: ModelCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    return this.updateModelResolved(hit, properties)
  }

  /**
   * 批量更新：每项只 resolve 一次，位置与朝向合并后最多写一次 `modelMatrix`。
   */
  updateModels(updates: ModelCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    const out: Array<{ id: string; success: boolean }> = []
    for (const u of updates) {
      const { id, ...rest } = u
      const hit = this.resolve(id)
      out.push({ id, success: hit ? this.updateModelResolved(hit, rest) : false })
    }
    return out
  }

  private updateModelResolved(
    hit: { viewer: Viewer; bucket: Bucket; meta: ModelMeta },
    properties: ModelCollectionUpdateProps,
  ): boolean {
    const { meta, viewer } = hit
    const m = meta.model

    let matrixDirty = false

    const lngRaw = properties.longitude !== undefined ? Number(properties.longitude) : undefined
    const latRaw = properties.latitude !== undefined ? Number(properties.latitude) : undefined
    const hRaw = properties.height !== undefined ? Number(properties.height) : undefined
    const lng = lngRaw !== undefined && Number.isFinite(lngRaw) ? lngRaw : undefined
    const lat = latRaw !== undefined && Number.isFinite(latRaw) ? latRaw : undefined
    const h = hRaw !== undefined && Number.isFinite(hRaw) ? hRaw : undefined

    if (lng !== undefined && lat !== undefined) {
      const finalH = h !== undefined ? h : Cesium.Cartographic.fromCartesian(meta.position).height
      meta.position = Cesium.Cartesian3.fromDegrees(lng, lat, finalH)
      matrixDirty = true
    } else if (h !== undefined) {
      const cart = Cesium.Cartographic.fromCartesian(meta.position)
      meta.position = Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(cart.longitude),
        Cesium.Math.toDegrees(cart.latitude),
        h,
      )
      matrixDirty = true
    }

    if (
      properties.headingDegrees !== undefined ||
      properties.pitchDegrees !== undefined ||
      properties.rollDegrees !== undefined
    ) {
      meta.orientationDeg = mergeOrientationDeg(meta.orientationDeg, properties)
      matrixDirty = true
    }

    if (matrixDirty) {
      m.modelMatrix = computeModelCollectionModelMatrix(meta.position, meta.orientationDeg)
    }

    if (properties.scale !== undefined) {
      meta.scale = properties.scale
      m.scale = properties.scale
    }
    if (properties.minimumPixelSize !== undefined) {
      meta.minimumPixelSize = properties.minimumPixelSize
      m.minimumPixelSize = properties.minimumPixelSize
    }
    if (properties.maximumScale !== undefined) {
      meta.maximumScale = properties.maximumScale
      m.maximumScale = properties.maximumScale
    }
    if (properties.show !== undefined) {
      m.show = properties.show
    }

    if (properties.heightReference !== undefined) {
      const hr = parseHeightRef(properties.heightReference)
      meta.heightReference = hr
      m.heightReference = hr
    }

    if (properties.targetData !== undefined) {
      meta._targetData = { ...(meta._targetData ?? {}), ...properties.targetData }
    }

    syncOrientationToTargetData(meta)

    if (properties.uri !== undefined && properties.uri.trim() && properties.uri.trim() !== meta.uri) {
      void this.reloadModel(viewer, meta, properties.uri.trim())
    }

    return true
  }

  private async reloadModel(viewer: Viewer, meta: ModelMeta, newUri: string): Promise<void> {
    if (viewer.isDestroyed()) return
    const oldModel = meta.model
    const wasShow = oldModel.show
    try {
      const model = await Cesium.Model.fromGltfAsync({
        url: newUri,
        modelMatrix: computeModelCollectionModelMatrix(meta.position, meta.orientationDeg),
        scale: meta.scale,
        minimumPixelSize: meta.minimumPixelSize,
        maximumScale: meta.maximumScale,
        heightReference: meta.heightReference,
        id: meta.id,
      })
      model.show = wasShow
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(oldModel)
        viewer.scene.primitives.add(model)
        meta.model = model
        meta.uri = newUri
        meta._targetData = { ...(meta._targetData ?? {}), modelUri: newUri }
        syncOrientationToTargetData(meta)
      }
    } catch (e) {
      console.error('ModelCollection: 重新加载模型失败', e)
    }
  }

  getModel(id: string): ModelCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { meta } = hit
    const cart = Cesium.Cartographic.fromCartesian(meta.position)
    const o = meta.orientationDeg
    return {
      id: meta.id,
      longitude: Cesium.Math.toDegrees(cart.longitude),
      latitude: Cesium.Math.toDegrees(cart.latitude),
      height: cart.height,
      uri: meta.uri,
      scale: meta.scale,
      minimumPixelSize: meta.minimumPixelSize,
      maximumScale: meta.maximumScale,
      show: meta.model.show,
      headingDegrees: o.heading,
      pitchDegrees: o.pitch,
      rollDegrees: o.roll,
      targetData: { ...(meta._targetData ?? {}) },
    }
  }

  getCount(viewer?: Viewer): number {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? b.primitives.size : 0
    }
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (!viewer) return [...this.idOwner.keys()]
    const b = this.buckets.get(viewer)
    if (!b) return []
    return [...b.primitives.keys()]
  }

  getAllModels(viewer?: Viewer): ModelCollectionSnapshot[] {
    const out: ModelCollectionSnapshot[] = []
    for (const id of this.getAllIds(viewer)) {
      const s = this.getModel(id)
      if (s) out.push(s)
    }
    return out
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.primitives.forEach((meta) => {
        meta.model.show = show
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
    if (!hit || hit.meta.model.show === show) return
    hit.meta.model.show = show
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { viewer, bucket, meta } = hit
    if (!viewer.isDestroyed()) {
      viewer.scene.primitives.remove(meta.model)
    }
    bucket.primitives.delete(id)
    this.idOwner.delete(id)
  }

  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      for (const meta of b.primitives.values()) {
        if (!viewer.isDestroyed()) viewer.scene.primitives.remove(meta.model)
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
      b.primitives.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) {
        for (const meta of b.primitives.values()) {
          v.scene.primitives.remove(meta.model)
        }
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }

  clear(viewer?: Viewer): void {
    this.removeAll(viewer)
  }

  pruneInvalid(): number {
    let n = 0
    for (const [viewer, b] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of b.primitives.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }

  destroy(): void {
    this.removeAll()
  }
}
