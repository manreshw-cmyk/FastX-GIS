import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

export interface BoxCollectionAddItem {
  id?: string
  positions: number[]
  /** 长宽高（米） */
  dimensions?: [number, number, number]
  show?: boolean
  color?: string
  alpha?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  targetData?: Record<string, unknown>
}

export interface BoxCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  dimensions?: [number, number, number]
  color?: string
  alpha?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface BoxCollectionUpdateEntry extends BoxCollectionUpdateProps {
  id: string
}

export interface BoxCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  dimensions: Cesium.Cartesian3
  color: Cesium.Color
  outline: boolean
  outlineColor: Cesium.Color
  outlineWidth: number
  show: boolean
  targetData: Record<string, unknown>
}

interface BoxPrimitiveMeta {
  id: string
  position: Cesium.Cartesian3
  dimensions: Cesium.Cartesian3
  outlineColor: Cesium.Color
  outlineWidth: number
  outline: boolean
  show: boolean
  _targetData?: Record<string, unknown>
  _primitive: Cesium.Primitive
}

type Bucket = {
  primitives: Map<string, BoxPrimitiveMeta>
}

function createBoxPrimitive(
  position: Cesium.Cartesian3,
  dimensions: Cesium.Cartesian3,
  fillColor: Cesium.Color,
): Cesium.Primitive {
  const geometry = Cesium.BoxGeometry.fromDimensions({
    vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL,
    dimensions,
  })
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position)
  const instance = new Cesium.GeometryInstance({
    geometry,
    modelMatrix,
  })
  return new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.MaterialAppearance({
      material: Cesium.Material.fromType('Color', { color: fillColor }),
      translucent: fillColor.alpha < 1,
      faceForward: true,
    }),
    asynchronous: false,
  })
}

/**
 * 批量盒子（`BoxGeometry` + `Primitive`），按 `viewer` 分桶。
 */
export default class BoxCollection {
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

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; prim: BoxPrimitiveMeta } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const prim = bucket?.primitives.get(id)
    if (!bucket || !prim) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, prim }
  }

  addBoxes(viewer: Viewer, options: BoxCollectionAddItem[]): string[] {
    if (!Array.isArray(options) || options.length === 0) return []
    if (viewer.isDestroyed()) return []
    const b = this.ensureBucket(viewer)
    if (!b) return []

    const createdIds: string[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const {
        id = createRandomXgxId('bc'),
        positions,
        dimensions: dimArr = [200, 200, 200],
        show = true,
        color = '#00bcd4',
        alpha = 0.75,
        outline: _outline = true,
        outlineColor = '#ffffff',
        outlineAlpha = 0.9,
        outlineWidth = 1,
        targetData = {},
      } = item

      if (!Array.isArray(positions) || positions.length < 2) continue
      if (this.idOwner.has(id)) {
        console.warn(`BoxCollection: ID "${id}" 已存在，跳过`)
        continue
      }

      try {
        const height = positions[2] !== undefined ? Number(positions[2]) : 0
        const position = Cesium.Cartesian3.fromDegrees(Number(positions[0]), Number(positions[1]), height)
        const dimensions = new Cesium.Cartesian3(dimArr[0] ?? 200, dimArr[1] ?? 200, dimArr[2] ?? 200)
        const fillColor = Cesium.Color.fromCssColorString(color).withAlpha(alpha)
        const outlineCol = Cesium.Color.fromCssColorString(outlineColor).withAlpha(outlineAlpha)

        const primitive = createBoxPrimitive(position, dimensions, fillColor)
        primitive.show = show
        viewer.scene.primitives.add(primitive)

        const meta: BoxPrimitiveMeta = {
          id,
          position,
          dimensions,
          outlineColor: outlineCol,
          outlineWidth,
          outline: _outline,
          show,
          _targetData: { ...targetData },
          _primitive: primitive,
        }
        b.primitives.set(id, meta)
        this.idOwner.set(id, viewer)
        createdIds.push(id)
      } catch (error) {
        console.error(`BoxCollection: 添加第${index}个失败:`, error)
      }
    }
    return createdIds
  }

  updateBox(id: string, properties: BoxCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { prim, viewer } = hit

    let newPos = prim.position
    let newDim = prim.dimensions
    let newColor = (prim._primitive.appearance.material as Cesium.Material).uniforms.color as Cesium.Color
    let needsRebuild = false

    if (properties.longitude !== undefined && properties.latitude !== undefined) {
      const h = properties.height !== undefined ? properties.height : Cesium.Cartographic.fromCartesian(prim.position).height
      newPos = Cesium.Cartesian3.fromDegrees(
        Number(properties.longitude),
        Number(properties.latitude),
        Number(h),
      )
      needsRebuild = true
    }

    if (properties.dimensions !== undefined && properties.dimensions.length === 3) {
      newDim = new Cesium.Cartesian3(
        Number(properties.dimensions[0]),
        Number(properties.dimensions[1]),
        Number(properties.dimensions[2]),
      )
      needsRebuild = true
    }

    if (properties.color !== undefined) {
      const a = properties.alpha !== undefined ? properties.alpha : newColor.alpha
      newColor = Cesium.Color.fromCssColorString(properties.color).withAlpha(a)
      needsRebuild = true
    } else if (properties.alpha !== undefined) {
      newColor = newColor.withAlpha(properties.alpha)
      needsRebuild = true
    }

    if (properties.outlineColor !== undefined) {
      const oa = properties.outlineAlpha !== undefined ? properties.outlineAlpha : prim.outlineColor.alpha
      prim.outlineColor = Cesium.Color.fromCssColorString(properties.outlineColor).withAlpha(oa)
    } else if (properties.outlineAlpha !== undefined) {
      prim.outlineColor = prim.outlineColor.withAlpha(properties.outlineAlpha)
    }

    if (properties.outlineWidth !== undefined) {
      prim.outlineWidth = properties.outlineWidth
    }

    if (needsRebuild) {
      const newPrimitive = createBoxPrimitive(newPos, newDim, newColor)
      newPrimitive.show = properties.show !== undefined ? properties.show : prim.show
      viewer.scene.primitives.remove(prim._primitive)
      viewer.scene.primitives.add(newPrimitive)
      prim.position = newPos
      prim.dimensions = newDim
      prim._primitive = newPrimitive
    }

    if (properties.show !== undefined) {
      prim.show = properties.show
      prim._primitive.show = properties.show
    }

    if (properties.targetData !== undefined) {
      prim._targetData = { ...(prim._targetData ?? {}), ...properties.targetData }
    }

    return true
  }

  updateBoxes(updates: BoxCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateBox(id, rest) }))
  }

  getBox(id: string): BoxCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { prim } = hit
    const cart = Cesium.Cartographic.fromCartesian(prim.position)
    const materialColor = (prim._primitive.appearance.material as Cesium.Material).uniforms.color as Cesium.Color
    return {
      id: prim.id,
      longitude: Cesium.Math.toDegrees(cart.longitude),
      latitude: Cesium.Math.toDegrees(cart.latitude),
      height: cart.height,
      dimensions: prim.dimensions,
      color: materialColor,
      outline: prim.outlineWidth > 0,
      outlineColor: prim.outlineColor,
      outlineWidth: prim.outlineWidth,
      show: prim.show,
      targetData: { ...(prim._targetData ?? {}) },
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

  getAllBoxes(viewer?: Viewer): BoxCollectionSnapshot[] {
    const out: BoxCollectionSnapshot[] = []
    for (const bid of this.getAllIds(viewer)) {
      const s = this.getBox(bid)
      if (s) out.push(s)
    }
    return out
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.primitives.forEach((p) => {
        p.show = show
        p._primitive.show = show
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
    hit.prim._primitive.show = show
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { viewer, bucket, prim } = hit
    if (!viewer.isDestroyed()) viewer.scene.primitives.remove(prim._primitive)
    bucket.primitives.delete(id)
    this.idOwner.delete(id)
  }

  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      for (const prim of b.primitives.values()) {
        if (!viewer.isDestroyed()) viewer.scene.primitives.remove(prim._primitive)
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
      b.primitives.clear()
      return
    }
    for (const [v, buck] of this.buckets) {
      if (!v.isDestroyed()) {
        for (const prim of buck.primitives.values()) {
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
