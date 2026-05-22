import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { PointCollectionAddItem, PointCollectionSnapshot, PointCollectionUpdateEntry, PointCollectionUpdateProps } from '../../Types'
export type { PointCollectionAddItem, PointCollectionSnapshot, PointCollectionUpdateEntry, PointCollectionUpdateProps }

type PointPrimitiveMeta = Cesium.PointPrimitive & {
  outline: boolean
  outlineColor: Cesium.Color
  outlineWidth: number
  _targetData?: Record<string, unknown>
}

type Bucket = {
  collection: Cesium.PointPrimitiveCollection
  primitives: Map<string, Cesium.PointPrimitive>
}

/**
 * 批量点（`PointPrimitiveCollection`）单例：各方法首参传入 `viewer`，内部按 viewer 分桶管理。
 */
export default class PointCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PointPrimitiveCollection({
        modelMatrix: Cesium.Matrix4.IDENTITY,
        debugShowBoundingVolume: false,
        blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT,
      })
      viewer.scene.primitives.add(collection)
      b = { collection, primitives: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; prim: PointPrimitiveMeta } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const raw = bucket?.primitives.get(id)
    if (!bucket || !raw) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, prim: raw as PointPrimitiveMeta }
  }

  addPoints(viewer: Viewer, options: PointCollectionAddItem[]): string[] {
    if (!Array.isArray(options) || options.length === 0) return []
    const b = this.ensureBucket(viewer)
    if (!b) return []

    const createdIds: string[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const {
        id = createRandomXgxId('pc'),
        positions,
        show = true,
        color = '#ff0000',
        alpha = 1,
        targetData = {},
        pixelSize = 4,
        outline = true,
        outlineColor = '#ff0000',
        outlineAlpha = 1,
        outlineWidth = 1,
      } = item

      if (!Array.isArray(positions) || positions.length < 2) continue

      try {
        const primitive = b.collection.add({
          position: Cesium.Cartesian3.fromDegrees(
            Number(positions[0]),
            Number(positions[1]),
            Number(positions[2]) || 0,
          ),
          color: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
          pixelSize,
          outline,
          outlineColor: Cesium.Color.fromCssColorString(outlineColor).withAlpha(outlineAlpha),
          outlineWidth,
          id,
        }) as PointPrimitiveMeta

        primitive.show = show
        primitive._targetData = { ...targetData }
        b.primitives.set(id, primitive)
        this.idOwner.set(id, viewer)
        createdIds.push(id)
      } catch (error) {
        console.error(`PointCollection: 添加第${index}个点失败:`, error)
      }
    }
    return createdIds
  }

  updatePoint(id: string, properties: PointCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { prim: primitive } = hit

    if (properties.longitude !== undefined && properties.latitude !== undefined) {
      const height = properties.height !== undefined ? properties.height : 0
      primitive.position = Cesium.Cartesian3.fromDegrees(
        Number(properties.longitude),
        Number(properties.latitude),
        Number(height),
      )
    }

    if (properties.color !== undefined) {
      const a = properties.alpha !== undefined ? properties.alpha : 1
      primitive.color = Cesium.Color.fromCssColorString(properties.color).withAlpha(a)
    }

    if (properties.pixelSize !== undefined) primitive.pixelSize = properties.pixelSize
    if (properties.outline !== undefined) primitive.outline = properties.outline

    if (properties.outlineColor !== undefined) {
      const oa = properties.outlineAlpha !== undefined ? properties.outlineAlpha : 1
      primitive.outlineColor = Cesium.Color.fromCssColorString(properties.outlineColor).withAlpha(oa)
    }

    if (properties.outlineWidth !== undefined) primitive.outlineWidth = properties.outlineWidth
    if (properties.show !== undefined) primitive.show = properties.show

    if (properties.targetData !== undefined) {
      primitive._targetData = { ...(primitive._targetData ?? {}), ...properties.targetData }
    }

    return true
  }

  updatePoints(updates: PointCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updatePoint(id, rest) }))
  }

  getPoint(id: string): PointCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { prim: primitive } = hit

    const cartographic = Cesium.Cartographic.fromCartesian(primitive.position)
    return {
      id: String(primitive.id ?? id),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
      color: primitive.color,
      pixelSize: primitive.pixelSize,
      outline: primitive.outline,
      outlineColor: primitive.outlineColor,
      outlineWidth: primitive.outlineWidth,
      show: primitive.show,
      targetData: { ...(primitive._targetData ?? {}) },
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

  getAllPoints(viewer?: Viewer): PointCollectionSnapshot[] {
    const out: PointCollectionSnapshot[] = []
    const ids = this.getAllIds(viewer)
    for (const id of ids) {
      const p = this.getPoint(id)
      if (p) out.push(p)
    }
    return out
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (b: Bucket) => {
      b.primitives.forEach((p) => {
        p.show = show
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
    if (!hit || hit.prim.show === show) return
    hit.prim.show = show
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    hit.bucket.collection.remove(hit.prim)
    hit.bucket.primitives.delete(id)
    this.idOwner.delete(id)
  }

  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      if (!viewer.isDestroyed()) b.collection.removeAll()
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
      b.primitives.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }

  /** 移除已销毁 Viewer 对应的桶（与 `Point.pruneInvalid` 类似） */
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
    for (const [viewer, b] of this.buckets) {
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(b.collection)
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }
}
