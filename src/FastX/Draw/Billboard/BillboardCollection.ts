import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import { svgMarkupToDataUri } from './svgDataUri'

export interface BillboardCollectionAddItem {
  id?: string
  positions: number[]
  /** 图片 URL 或 data URI */
  image?: string
  /** 原始 SVG XML */
  svg?: string
  show?: boolean
  scale?: number
  color?: string
  alpha?: number
  width?: number
  height?: number
  pixelOffsetX?: number
  pixelOffsetY?: number
  horizontalOrigin?: keyof typeof Cesium.HorizontalOrigin
  verticalOrigin?: keyof typeof Cesium.VerticalOrigin
  heightReference?: keyof typeof Cesium.HeightReference
  disableDepthTestDistance?: number
  targetData?: Record<string, unknown>
}

export interface BillboardCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  image?: string
  svg?: string
  scale?: number
  color?: string
  alpha?: number
  width?: number
  heightPx?: number
  pixelOffsetX?: number
  pixelOffsetY?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface BillboardCollectionUpdateEntry extends BillboardCollectionUpdateProps {
  id: string
}

export interface BillboardCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  image: string
  scale: number
  color: Cesium.Color
  width?: number
  heightPx?: number
  show: boolean
  targetData: Record<string, unknown>
}

type BillboardPrimMeta = Cesium.Billboard & {
  _targetData?: Record<string, unknown>
}

type Bucket = {
  collection: Cesium.BillboardCollection
  primitives: Map<string, Cesium.Billboard>
}

function resolveItemImage(item: { image?: string; svg?: string }): string | undefined {
  if (item.image !== undefined && String(item.image).trim()) return String(item.image).trim()
  if (item.svg !== undefined && String(item.svg).trim()) return svgMarkupToDataUri(String(item.svg))
  return undefined
}

/**
 * 批量广告牌（`BillboardCollection` Primitive），按 `viewer` 分桶。
 */
export default class BillboardCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.BillboardCollection({
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

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; prim: BillboardPrimMeta } | undefined {
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
    return { viewer, bucket, prim: raw as BillboardPrimMeta }
  }

  addBillboards(viewer: Viewer, options: BillboardCollectionAddItem[]): string[] {
    if (!Array.isArray(options) || options.length === 0) return []
    const b = this.ensureBucket(viewer)
    if (!b) return []

    const createdIds: string[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const {
        id = createRandomXgxId('bbc'),
        positions,
        show = true,
        scale = 1,
        color = '#ffffff',
        alpha = 1,
        width,
        height,
        pixelOffsetX = 0,
        pixelOffsetY = 0,
        horizontalOrigin = 'CENTER',
        verticalOrigin = 'CENTER',
        heightReference = 'NONE',
        disableDepthTestDistance = Number.POSITIVE_INFINITY,
        targetData = {},
      } = item

      const image = resolveItemImage(item)
      if (!image || !Array.isArray(positions) || positions.length < 2) continue

      try {
        const prim = b.collection.add({
          id,
          show,
          position: Cesium.Cartesian3.fromDegrees(
            Number(positions[0]),
            Number(positions[1]),
            Number(positions[2]) || 0,
          ),
          image,
          scale,
          color: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
          width,
          height,
          pixelOffset: new Cesium.Cartesian2(pixelOffsetX, pixelOffsetY),
          horizontalOrigin: Cesium.HorizontalOrigin[horizontalOrigin],
          verticalOrigin: Cesium.VerticalOrigin[verticalOrigin],
          heightReference: Cesium.HeightReference[heightReference],
          disableDepthTestDistance,
        }) as BillboardPrimMeta

        prim._targetData = { ...targetData, imageUri: image }
        b.primitives.set(id, prim)
        this.idOwner.set(id, viewer)
        createdIds.push(id)
      } catch (error) {
        console.error(`BillboardCollection: 添加第${index}个失败:`, error)
      }
    }
    return createdIds
  }

  updateBillboard(id: string, properties: BillboardCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { prim: p } = hit

    if (properties.longitude !== undefined && properties.latitude !== undefined) {
      const h = properties.height !== undefined ? properties.height : 0
      p.position = Cesium.Cartesian3.fromDegrees(
        Number(properties.longitude),
        Number(properties.latitude),
        Number(h),
      )
    }

    const nextImg = resolveItemImage({ image: properties.image, svg: properties.svg })
    if (nextImg !== undefined) {
      p.image = nextImg
      p._targetData = { ...(p._targetData ?? {}), imageUri: nextImg }
    }

    if (properties.color !== undefined) {
      const a = properties.alpha !== undefined ? properties.alpha : p.color.alpha
      p.color = Cesium.Color.fromCssColorString(properties.color).withAlpha(a)
    } else if (properties.alpha !== undefined) {
      p.color = p.color.withAlpha(properties.alpha)
    }

    if (properties.scale !== undefined) p.scale = properties.scale
    if (properties.width !== undefined) p.width = properties.width
    if (properties.heightPx !== undefined) p.height = properties.heightPx
    if (properties.pixelOffsetX !== undefined) {
      p.pixelOffset = new Cesium.Cartesian2(properties.pixelOffsetX, p.pixelOffset.y)
    }
    if (properties.pixelOffsetY !== undefined) {
      p.pixelOffset = new Cesium.Cartesian2(p.pixelOffset.x, properties.pixelOffsetY)
    }
    if (properties.show !== undefined) p.show = properties.show

    if (properties.targetData !== undefined) {
      p._targetData = { ...(p._targetData ?? {}), ...properties.targetData }
    }

    return true
  }

  updateBillboards(updates: BillboardCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateBillboard(id, rest) }))
  }

  getBillboard(id: string): BillboardCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const p = hit.prim
    const cart = Cesium.Cartographic.fromCartesian(p.position)
    const img = typeof p.image === 'string' ? p.image : String(p.image ?? '')
    return {
      id: String(p.id ?? id),
      longitude: Cesium.Math.toDegrees(cart.longitude),
      latitude: Cesium.Math.toDegrees(cart.latitude),
      height: cart.height,
      image: img,
      scale: p.scale,
      color: p.color,
      width: p.width,
      heightPx: p.height,
      show: p.show,
      targetData: { ...(p._targetData ?? {}) },
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

  getAllBillboards(viewer?: Viewer): BillboardCollectionSnapshot[] {
    const out: BillboardCollectionSnapshot[] = []
    for (const id of this.getAllIds(viewer)) {
      const s = this.getBillboard(id)
      if (s) out.push(s)
    }
    return out
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.primitives.forEach((bb) => {
        bb.show = show
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
      for (const bid of b.primitives.keys()) this.idOwner.delete(bid)
      b.primitives.clear()
      return
    }
    for (const [v, buck] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(buck.collection)
      for (const bid of buck.primitives.keys()) this.idOwner.delete(bid)
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
        for (const bid of b.primitives.keys()) this.idOwner.delete(bid)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }

  destroy(): void {
    for (const [viewer, buck] of this.buckets) {
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(buck.collection)
      for (const bid of buck.primitives.keys()) this.idOwner.delete(bid)
    }
    this.buckets.clear()
  }
}
