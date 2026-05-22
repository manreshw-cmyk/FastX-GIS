import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { LabelCollectionAddItem, LabelCollectionSnapshot, LabelCollectionUpdateEntry, LabelCollectionUpdateProps } from '../../Types'
export type { LabelCollectionAddItem, LabelCollectionSnapshot, LabelCollectionUpdateEntry, LabelCollectionUpdateProps }

type LabelPrimitiveMeta = Cesium.Label & {
  _targetData?: Record<string, unknown>
}

type Bucket = {
  collection: Cesium.LabelCollection
  primitives: Map<string, Cesium.Label>
}

/**
 * 批量文字（`LabelCollection` primitive）单例：各方法首参传入 `viewer`。
 */
export default class LabelCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.LabelCollection({
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

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; prim: LabelPrimitiveMeta } | undefined {
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
    return { viewer, bucket, prim: raw as LabelPrimitiveMeta }
  }

  addLabels(viewer: Viewer, options: LabelCollectionAddItem[]): string[] {
    if (!Array.isArray(options) || options.length === 0) return []
    const b = this.ensureBucket(viewer)
    if (!b) return []

    const createdIds: string[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const {
        id = createRandomXgxId('lc'),
        show = true,
        positions,
        label = 'Label',
        font = 'normal 14px sans-serif',
        alpha = 1,
        fontColor = '#fff',
        outlineColor = '#000',
        outlineAlpha = 1,
        outlineWidth = 1,
        fontScale = 1,
        fontStyle = 'FILL_AND_OUTLINE',
        showBackground = false,
        backgroundColor = '#000',
        backgroundPaddingX = 0,
        backgroundPaddingY = 0,
        pixelOffsetX = 0,
        pixelOffsetY = 0,
        eyeOffset = Cesium.Cartesian3.ZERO,
        horizontalOrigin = 'CENTER',
        verticalOrigin = 'BASELINE',
        heightReference = 'NONE',
        disableDepthTestDistance = Number.POSITIVE_INFINITY,
        translucencyByDistance,
        pixelOffsetScaleByDistance,
        distanceDisplayCondition,
        scaleByDistance,
        targetData = {},
      } = item

      if (!Array.isArray(positions) || positions.length < 2) continue

      try {
        const styleKey =
          typeof Cesium.LabelStyle[fontStyle as keyof typeof Cesium.LabelStyle] === 'number'
            ? Cesium.LabelStyle[fontStyle as keyof typeof Cesium.LabelStyle]
            : Cesium.LabelStyle.FILL_AND_OUTLINE
        const primitive = b.collection.add({
          id,
          show,
          position: Cesium.Cartesian3.fromDegrees(
            Number(positions[0]),
            Number(positions[1]),
            Number(positions[2]) || 0,
          ),
          text: label,
          font,
          fillColor: Cesium.Color.fromCssColorString(fontColor).withAlpha(alpha),
          outlineColor: Cesium.Color.fromCssColorString(outlineColor).withAlpha(outlineAlpha),
          outlineWidth,
          scale: fontScale,
          style: styleKey,
          showBackground,
          backgroundColor: Cesium.Color.fromCssColorString(backgroundColor),
          backgroundPadding: new Cesium.Cartesian2(backgroundPaddingX, backgroundPaddingY),
          pixelOffset: new Cesium.Cartesian2(pixelOffsetX, pixelOffsetY),
          eyeOffset,
          horizontalOrigin: Cesium.HorizontalOrigin[horizontalOrigin],
          verticalOrigin: Cesium.VerticalOrigin[verticalOrigin],
          translucencyByDistance,
          pixelOffsetScaleByDistance,
          distanceDisplayCondition,
          scaleByDistance,
          heightReference: Cesium.HeightReference[heightReference],
          disableDepthTestDistance,
        }) as LabelPrimitiveMeta

        primitive._targetData = { ...targetData }
        b.primitives.set(id, primitive)
        this.idOwner.set(id, viewer)
        createdIds.push(id)
      } catch (error) {
        console.error(`LabelCollection: 添加第${index}个Label失败:`, error)
      }
    }
    return createdIds
  }

  updateLabel(id: string, properties: LabelCollectionUpdateProps): boolean {
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

    if (properties.fontColor !== undefined) {
      const a = properties.alpha !== undefined ? properties.alpha : 1
      primitive.fillColor = Cesium.Color.fromCssColorString(properties.fontColor).withAlpha(a)
    }

    if (properties.outlineColor !== undefined) {
      const oa = properties.outlineAlpha !== undefined ? properties.outlineAlpha : 1
      primitive.outlineColor = Cesium.Color.fromCssColorString(properties.outlineColor).withAlpha(oa)
    }

    if (properties.backgroundColor !== undefined) {
      primitive.backgroundColor = Cesium.Color.fromCssColorString(properties.backgroundColor)
    }

    if (properties.font !== undefined) primitive.font = properties.font
    if (properties.label !== undefined) primitive.text = properties.label
    if (properties.outlineWidth !== undefined) primitive.outlineWidth = properties.outlineWidth
    if (properties.fontScale !== undefined) primitive.scale = properties.fontScale
    if (properties.show !== undefined) primitive.show = properties.show

    if (properties.pixelOffsetX !== undefined) {
      primitive.pixelOffset = new Cesium.Cartesian2(properties.pixelOffsetX, primitive.pixelOffset.y)
    }
    if (properties.pixelOffsetY !== undefined) {
      primitive.pixelOffset = new Cesium.Cartesian2(primitive.pixelOffset.x, properties.pixelOffsetY)
    }

    if (properties.targetData !== undefined) {
      primitive._targetData = { ...(primitive._targetData ?? {}), ...properties.targetData }
    }

    return true
  }

  updateLabels(updates: LabelCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateLabel(id, rest) }))
  }

  getLabel(id: string): LabelCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const p = hit.prim
    const cartographic = Cesium.Cartographic.fromCartesian(p.position)
    return {
      id: String(p.id ?? id),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
      text: p.text,
      font: p.font,
      fillColor: p.fillColor,
      outlineColor: p.outlineColor,
      outlineWidth: p.outlineWidth,
      scale: p.scale,
      style: p.style,
      showBackground: p.showBackground,
      backgroundColor: p.backgroundColor,
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

  getAllLabels(viewer?: Viewer): LabelCollectionSnapshot[] {
    const out: LabelCollectionSnapshot[] = []
    for (const id of this.getAllIds(viewer)) {
      const s = this.getLabel(id)
      if (s) out.push(s)
    }
    return out
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.primitives.forEach((lab) => {
        lab.show = show
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
