import * as Cesium from 'cesium'
import type { Primitive, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { CircleCollectionAddItem, CircleCollectionSnapshot, CircleCollectionUpdateEntry, CircleCollectionUpdateOptions } from '../../Types'
export type { CircleCollectionAddItem, CircleCollectionSnapshot, CircleCollectionUpdateEntry, CircleCollectionUpdateOptions }

type PrimitiveExt = Primitive & {
  _id?: string
  _targetData?: Record<string, unknown>
  _center?: Cesium.Cartesian3
  _radius?: number
  _height?: number
  _extrudedHeight?: number
  _alpha?: number
  _outlineAlpha?: number
  _outlineWidth?: number
  _outlinePrimitive?: Primitive
  _stRotation?: number
  _numberOfVerticalLines?: number
  _granularity?: number
  _outlineInstanceId?: string
}

type Bucket = {
  collection: Cesium.PrimitiveCollection
  primitives: Map<string, PrimitiveExt>
}

/**
 * 批量圆（`CircleGeometry` / `CircleOutlineGeometry` + `Primitive`）单例，按 `viewer` 分桶；由旧版 `CircleCollecation.js` 改造。
 */
export default class CircleCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PrimitiveCollection()
      viewer.scene.primitives.add(collection)
      b = { collection, primitives: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; prim: PrimitiveExt } | undefined {
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

  private radiusMetersFromKm(radiusKm: number): number {
    return Number(radiusKm) * 1000
  }

  private getPrimitiveColorHex(primitive: PrimitiveExt, geometryInstanceId: string): string {
    try {
      if (primitive.isDestroyed()) return '#FF0000'
      const attributes = primitive.getGeometryInstanceAttributes(geometryInstanceId)
      const c = attributes?.color as Uint8Array | number[] | undefined
      if (c && c.length >= 4) {
        const r = c[0]!
        const g = c[1]!
        const b = c[2]!
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
      }
    } catch {
      /* ignore */
    }
    return '#FF0000'
  }

  private getOutlineColorHex(outlinePrimitive: Primitive, outlineInstanceId: string): string {
    try {
      if (outlinePrimitive.isDestroyed()) return '#000000'
      const attributes = outlinePrimitive.getGeometryInstanceAttributes(outlineInstanceId)
      const c = attributes?.color as Uint8Array | number[] | undefined
      if (c && c.length >= 4) {
        const r = c[0]!
        const g = c[1]!
        const b = c[2]!
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
      }
    } catch {
      /* ignore */
    }
    return '#000000'
  }

  addCircles(viewer: Viewer, options: CircleCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(options)) {
      console.error('CircleCollection: 类型不正确，请提供正确数据源类型！')
      return []
    }
    if (options.length === 0) {
      console.error('CircleCollection: 数据源为空！')
      return []
    }

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const createdIds: string[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const id = item.id?.trim() ? item.id.trim() : createRandomXgxId('cc')
      if (b.primitives.has(id)) {
        console.warn(`CircleCollection: id 已存在，跳过: ${id}`)
        continue
      }

      const {
        show = true,
        positions,
        radius = 1000,
        extrudedHeight = 0,
        color = '#ff0000',
        alpha = 0.5,
        outline = true,
        outlineColor = '#000000',
        outlineAlpha = 1,
        outlineWidth = 1,
        stRotation = 0,
        numberOfVerticalLines = 16,
        targetData = {},
      } = item

      if (!Array.isArray(positions) || positions.length < 2) {
        console.error('CircleCollection: 提供的坐标为空或不足！')
        continue
      }

      try {
        const lon = Number(positions[0])
        const lat = Number(positions[1])
        const h = Number(positions[2]) || 0
        const center = Cesium.Cartesian3.fromDegrees(lon, lat, h)
        const radiusM = this.radiusMetersFromKm(Number(radius))

        const circleGeometry = new Cesium.CircleGeometry({
          center,
          radius: radiusM,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
          ellipsoid: Cesium.Ellipsoid.WGS84,
          height: h,
          extrudedHeight,
          stRotation,
          granularity: Cesium.Math.RADIANS_PER_DEGREE,
        })

        const geometryInstance = new Cesium.GeometryInstance({
          id,
          geometry: circleGeometry,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromCssColorString(color).withAlpha(alpha),
            ),
          },
        })

        const useExtrudedAppearance = extrudedHeight > h
        const primitive = new Cesium.Primitive({
          geometryInstances: geometryInstance,
          appearance: useExtrudedAppearance
            ? new Cesium.PerInstanceColorAppearance({
                closed: true,
                translucent: true,
                flat: true,
              })
            : new Cesium.EllipsoidSurfaceAppearance({
                aboveGround: false,
              }),
          show,
          asynchronous: true,
          releaseGeometryInstances: false,
        }) as PrimitiveExt

        let outlinePrimitive: Primitive | undefined
        const outlineInstanceId = `${id}_outline`
        if (outline) {
          const outlineGeometry = new Cesium.CircleOutlineGeometry({
            center,
            height: h,
            radius: radiusM,
            extrudedHeight,
            numberOfVerticalLines: Number(numberOfVerticalLines),
          })
          const outlineColorValue = Cesium.Color.fromCssColorString(outlineColor).withAlpha(outlineAlpha)
          const outlineInstance = new Cesium.GeometryInstance({
            geometry: outlineGeometry,
            id: outlineInstanceId,
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(outlineColorValue),
            },
          })
          outlinePrimitive = new Cesium.Primitive({
            geometryInstances: outlineInstance,
            appearance: new Cesium.PerInstanceColorAppearance({
              flat: true,
              renderState: {
                lineWidth: Math.min(outlineWidth, 1),
              },
            }),
            show,
            asynchronous: true,
          })
          primitive._outlinePrimitive = outlinePrimitive
          primitive._outlineInstanceId = outlineInstanceId
          b.collection.add(outlinePrimitive)
        }

        primitive._id = id
        primitive._targetData = { ...targetData }
        primitive._center = Cesium.Cartesian3.clone(center)
        primitive._radius = Number(radius)
        primitive._height = h
        primitive._extrudedHeight = extrudedHeight
        primitive._alpha = alpha
        primitive._outlineAlpha = outlineAlpha
        primitive._outlineWidth = outlineWidth
        primitive._stRotation = stRotation
        primitive._numberOfVerticalLines = numberOfVerticalLines
        primitive._granularity = Cesium.Math.RADIANS_PER_DEGREE

        b.collection.add(primitive)
        b.primitives.set(id, primitive)
        this.idOwner.set(id, viewer)
        createdIds.push(id)
      } catch (error) {
        console.error(`CircleCollection: 添加第${index}个Circle失败:`, error)
      }
    }
    return createdIds
  }

  updateCircle(id: string, options: CircleCollectionUpdateOptions = {}): boolean {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`CircleCollection: 未找到ID为${id}的圆形`)
      return false
    }
    const { prim: primitive, viewer } = hit

    try {
      const currentCartographic = Cesium.Cartographic.fromCartesian(primitive._center!)
      const currentPositions = [
        Cesium.Math.toDegrees(currentCartographic.longitude),
        Cesium.Math.toDegrees(currentCartographic.latitude),
        currentCartographic.height,
      ]

      const currentColor = this.getPrimitiveColorHex(primitive, id)
      const outlineInstId = primitive._outlineInstanceId ?? `${id}_outline`
      const currentOutlineColor = primitive._outlinePrimitive
        ? this.getOutlineColorHex(primitive._outlinePrimitive, outlineInstId)
        : '#000000'

      const pos = options.positions
      const nextPositions =
        pos && Array.isArray(pos) && pos.length >= 2
          ? [Number(pos[0]), Number(pos[1]), pos.length >= 3 ? Number(pos[2]) : currentPositions[2]!]
          : currentPositions

      const updateItem: CircleCollectionAddItem = {
        id,
        show: options.show !== undefined ? options.show : primitive.show,
        positions: nextPositions,
        radius: options.radius !== undefined ? options.radius : primitive._radius,
        extrudedHeight: options.extrudedHeight !== undefined ? options.extrudedHeight : primitive._extrudedHeight,
        color: options.color !== undefined ? options.color : currentColor,
        alpha: options.alpha !== undefined ? options.alpha : primitive._alpha ?? 0.5,
        outline: options.outline !== undefined ? options.outline : !!primitive._outlinePrimitive,
        outlineColor: options.outlineColor !== undefined ? options.outlineColor : currentOutlineColor,
        outlineAlpha: options.outlineAlpha !== undefined ? options.outlineAlpha : primitive._outlineAlpha ?? 1,
        outlineWidth: options.outlineWidth !== undefined ? options.outlineWidth : primitive._outlineWidth ?? 1,
        targetData:
          options.targetData !== undefined
            ? { ...(primitive._targetData ?? {}), ...options.targetData }
            : { ...(primitive._targetData ?? {}) },
        stRotation: primitive._stRotation ?? 0,
        numberOfVerticalLines: primitive._numberOfVerticalLines ?? 16,
      }

      this.remove(id)
      this.addCircles(viewer, [updateItem])
      return true
    } catch (error) {
      console.error(`CircleCollection: 更新圆形${id}时发生错误:`, error)
      return false
    }
  }

  updateCircles(updates: CircleCollectionUpdateEntry[]): void {
    if (!Array.isArray(updates)) {
      console.error('CircleCollection: updates参数必须是数组')
      return
    }
    for (const { id, options } of updates) {
      try {
        if (!id) {
          console.error('CircleCollection: updates参数 ID为空')
          continue
        }
        this.updateCircle(id, options ?? {})
      } catch (error) {
        console.error('CircleCollection: 批量更新多个圆形报错--->', error)
      }
    }
  }

  getCircle(id: string): CircleCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const primitive = hit.prim
    const cartographic = Cesium.Cartographic.fromCartesian(primitive._center!)

    return {
      id: String(primitive._id ?? id),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
      radiusKm: primitive._radius ?? 0,
      extrudedHeight: primitive._extrudedHeight ?? 0,
      show: primitive.show,
      alpha: primitive._alpha ?? 0.5,
      outline: !!primitive._outlinePrimitive,
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

  getAllCircles(viewer?: Viewer): CircleCollectionSnapshot[] {
    const circles: CircleCollectionSnapshot[] = []
    for (const cid of this.getAllIds(viewer)) {
      const c = this.getCircle(cid)
      if (c) circles.push(c)
    }
    return circles
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (b: Bucket) => {
      b.primitives.forEach((primitive) => {
        primitive.show = show
        if (primitive._outlinePrimitive) primitive._outlinePrimitive.show = show
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
    if (!hit) {
      console.error('CircleCollection: 未找到对应圆形!')
      return
    }
    const primitive = hit.prim
    if (primitive.show === show) return
    primitive.show = show
    if (primitive._outlinePrimitive) primitive._outlinePrimitive.show = show
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    if (!id) {
      console.error('CircleCollection: id不能为空！')
      return
    }
    const { bucket, prim: primitive } = hit
    bucket.collection.remove(primitive)
    if (primitive._outlinePrimitive) {
      bucket.collection.remove(primitive._outlinePrimitive)
    }
    bucket.primitives.delete(id)
    this.idOwner.delete(id)
  }

  removeMany(ids: string[]): void {
    if (!Array.isArray(ids)) return
    for (const id of ids) this.remove(id)
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

  clear(viewer?: Viewer): void {
    this.removeAll(viewer)
  }

  destroy(): void {
    for (const [viewer, b] of this.buckets) {
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(b.collection)
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
}
