import * as Cesium from 'cesium'
import type { Polyline, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'

import type { PolyLineCollectionAddItem, PolyLineCollectionSnapshot, PolyLineCollectionUpdateEntry, PolyLineCollectionUpdateMaterialProps, PolyLineCollectionUpdateProps } from '../../Types'
export type { PolyLineCollectionAddItem, PolyLineCollectionSnapshot, PolyLineCollectionUpdateEntry, PolyLineCollectionUpdateMaterialProps, PolyLineCollectionUpdateProps }

/** 线材质类型（与旧版 `PolyLineCollection.js` 一致） */
export const PolylineMaterialType = {
  COLOR: 'Color',
  DASH: 'PolylineDash',
  ARROW: 'PolylineArrow',
} as const

export type PolylineMaterialTypeValue = (typeof PolylineMaterialType)[keyof typeof PolylineMaterialType]

/** Cesium 运行时有 `arcType` / `clampToGround`，部分版本 `.d.ts` 未声明，此处与实现对齐 */
type TrackedPolyline = Polyline & {
  arcType?: Cesium.ArcType
  clampToGround?: boolean
  id?: string
  _show?: boolean
  _targetData?: Record<string, unknown>
  _positions?: number[][]
  _width?: number
  _color?: string
  _alpha?: number
  _materialType?: PolylineMaterialTypeValue
  _materialOptions?: Record<string, unknown>
  _arcType?: Cesium.ArcType
  _clampToGround?: boolean
}

type Bucket = {
  collection: Cesium.PolylineCollection
  lines: Map<string, TrackedPolyline>
}

/**
 * 批量折线（`Cesium.PolylineCollection`）单例：首参传入 `viewer`，与 `PointCollection` 一致按 viewer 分桶。
 */
export default class PolyLineCollection {
  private readonly buckets = new Map<Viewer, Bucket>()
  private readonly idOwner = new Map<string, Viewer>()

  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined
    let b = this.buckets.get(viewer)
    if (!b) {
      const collection = new Cesium.PolylineCollection({
        modelMatrix: Cesium.Matrix4.IDENTITY,
        debugShowBoundingVolume: false,
      })
      viewer.scene.primitives.add(collection)
      b = { collection, lines: new Map() }
      this.buckets.set(viewer, b)
    }
    return b
  }

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; line: TrackedPolyline } | undefined {
    const viewer = this.idOwner.get(id)
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id)
      return undefined
    }
    const bucket = this.buckets.get(viewer)
    const line = bucket?.lines.get(id)
    if (!bucket || !line) {
      this.idOwner.delete(id)
      return undefined
    }
    return { viewer, bucket, line }
  }

  private createMaterial(
    materialType: PolylineMaterialTypeValue,
    color: string,
    alpha: number,
    options: Record<string, unknown> = {},
  ): Cesium.Material | undefined {
    const baseColor = Cesium.Color.fromCssColorString(color).withAlpha(alpha)

    switch (materialType) {
      case PolylineMaterialType.COLOR:
        return Cesium.Material.fromType(materialType, {
          color: baseColor,
          ...options,
        } as unknown as Parameters<typeof Cesium.Material.fromType>[1])

      case PolylineMaterialType.DASH: {
        const gapColorRaw = options.gapColor
        const gapColor =
          gapColorRaw instanceof Cesium.Color
            ? gapColorRaw
            : typeof gapColorRaw === 'string'
              ? Cesium.Color.fromCssColorString(gapColorRaw)
              : Cesium.Color.TRANSPARENT
        return Cesium.Material.fromType(materialType, {
          color: baseColor,
          gapColor,
          dashLength: (options.dashLength as number) ?? 16.0,
          dashPattern: (options.dashPattern as number) ?? 255,
          ...options,
        } as unknown as Parameters<typeof Cesium.Material.fromType>[1])
      }

      case PolylineMaterialType.ARROW:
        return Cesium.Material.fromType(materialType, {
          color: baseColor,
          ...options,
        } as unknown as Parameters<typeof Cesium.Material.fromType>[1])

      default:
        return Cesium.Material.fromType(PolylineMaterialType.COLOR, {
          color: baseColor,
        } as unknown as Parameters<typeof Cesium.Material.fromType>[1])
    }
  }

  addPolylines(viewer: Viewer, options: PolyLineCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed()) return []
    if (!Array.isArray(options)) {
      console.error('PolylineCollection: 类型不正确，请提供正确数据源类型！')
      return []
    }
    if (options.length === 0) {
      console.error('PolylineCollection: 数据源为空！')
      return []
    }

    const b = this.ensureBucket(viewer)
    if (!b) return []

    const createdIds: string[] = []
    for (let index = 0; index < options.length; index++) {
      const item = options[index]!
      const {
        id = createRandomXgxId('plc'),
        positions = [],
        show = true,
        width = 5,
        color = '#c0c4cc',
        alpha = 1,
        materialType = PolylineMaterialType.COLOR,
        materialOptions = {},
        targetData = {},
        clampToGround = false,
        arcType = Cesium.ArcType.GEODESIC,
      } = item

      if (b.lines.has(id)) {
        console.warn(`PolylineCollection: id 已存在，跳过: ${id}`)
        continue
      }

      if (!Array.isArray(positions) || positions.length < 2) {
        console.warn(`PolylineCollection: 第${index}条线位置数据无效，已跳过`)
        continue
      }

      const cartesianPositions: Cesium.Cartesian3[] = []
      for (const pos of positions) {
        if (Array.isArray(pos) && pos.length >= 2) {
          const lon = Number(pos[0])
          const lat = Number(pos[1])
          const height = Number(pos[2]) || 0
          if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
            cartesianPositions.push(Cesium.Cartesian3.fromDegrees(lon, lat, height))
          }
        }
      }

      if (cartesianPositions.length < 2) {
        console.warn(`PolylineCollection: 第${index}条线有效点不足，已跳过`)
        continue
      }

      try {
        const material = this.createMaterial(materialType, color, alpha, materialOptions)
        if (!material) {
          console.warn(`PolylineCollection: 第${index}条线材质创建失败`)
          continue
        }

        const polyline = b.collection.add({
          positions: cartesianPositions,
          width,
          show,
          arcType,
          clampToGround,
          material,
        }) as TrackedPolyline

        polyline.id = id
        polyline._show = show
        polyline._targetData = { ...targetData }
        polyline._positions = positions.map((pos) => [...pos])
        polyline._width = width
        polyline._color = color
        polyline._alpha = alpha
        polyline._materialType = materialType
        polyline._materialOptions = { ...materialOptions }
        polyline._arcType = arcType
        polyline._clampToGround = clampToGround

        b.lines.set(id, polyline)
        this.idOwner.set(id, viewer)
        createdIds.push(id)
      } catch (error) {
        console.error(`PolylineCollection: 添加第${index}条线失败:`, error)
      }
    }

    return createdIds
  }

  updatePolylineMaterial(id: string, materialProps: PolyLineCollectionUpdateMaterialProps): boolean {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return false
    }
    const polyline = hit.line

    try {
      const {
        materialType = polyline._materialType ?? PolylineMaterialType.COLOR,
        color = polyline._color ?? '#c0c4cc',
        alpha = polyline._alpha ?? 1,
        ...options
      } = materialProps

      const material = this.createMaterial(
        materialType as PolylineMaterialTypeValue,
        color,
        alpha,
        options as Record<string, unknown>,
      )
      if (!material) return false

      polyline.material = material
      polyline._materialType = materialType as PolylineMaterialTypeValue
      polyline._color = color
      polyline._alpha = alpha
      polyline._materialOptions = options as Record<string, unknown>

      return true
    } catch (error) {
      console.error(`PolylineCollection: 更新线材质失败:`, error)
      return false
    }
  }

  updatePolyline(id: string, properties: PolyLineCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return false
    }
    const polyline = hit.line

    try {
      if (properties.positions !== undefined) {
        if (!Array.isArray(properties.positions) || properties.positions.length < 2) {
          console.error(`PolylineCollection: 位置数据无效`)
          return false
        }
        const cartesianPositions: Cesium.Cartesian3[] = []
        for (const pos of properties.positions) {
          if (pos.length >= 2) {
            cartesianPositions.push(
              Cesium.Cartesian3.fromDegrees(Number(pos[0]), Number(pos[1]), Number(pos[2]) || 0),
            )
          }
        }
        if (cartesianPositions.length >= 2) {
          polyline.positions = cartesianPositions
          polyline._positions = properties.positions.map((p) => [...p])
        }
      }

      if (properties.width !== undefined) {
        if (properties.width <= 0) {
          console.warn(`PolylineCollection: width 必须大于0`)
          return false
        }
        polyline.width = properties.width
        polyline._width = properties.width
      }

      if (properties.color !== undefined || properties.alpha !== undefined) {
        const color = properties.color !== undefined ? properties.color : polyline._color ?? '#c0c4cc'
        const alpha = properties.alpha !== undefined ? properties.alpha : polyline._alpha ?? 1
        try {
          polyline.material = Cesium.Material.fromType('Color', {
            color: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
          } as unknown as Parameters<typeof Cesium.Material.fromType>[1])
          polyline._color = color
          polyline._alpha = alpha
          polyline._materialType = PolylineMaterialType.COLOR
        } catch (error) {
          console.error(`PolylineCollection: 颜色格式错误: ${color}`)
          return false
        }
      }

      if (properties.show !== undefined) {
        polyline._show = properties.show
        polyline.show = properties.show
      }

      if (properties.arcType !== undefined) {
        polyline.arcType = properties.arcType
        polyline._arcType = properties.arcType
      }

      if (properties.clampToGround !== undefined) {
        polyline.clampToGround = properties.clampToGround
        polyline._clampToGround = properties.clampToGround
      }

      if (properties.targetData !== undefined) {
        if (typeof properties.targetData === 'object' && properties.targetData !== null) {
          polyline._targetData = { ...(polyline._targetData ?? {}), ...properties.targetData }
        } else {
          console.warn(`PolylineCollection: targetData 必须是对象`)
        }
      }

      return true
    } catch (error) {
      console.error(`PolylineCollection: 更新线 ${id} 失败:`, error)
      return false
    }
  }

  updatePolylines(updates: PolyLineCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) {
      console.error('PolylineCollection: 更新数据必须是数组')
      return []
    }
    return updates.map(({ id, ...properties }) => ({ id, success: this.updatePolyline(id, properties) }))
  }

  getPolyline(id: string): PolyLineCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const polyline = hit.line

    const positions: number[][] = []
    const raw = polyline.positions
    for (let i = 0; i < raw.length; i++) {
      const cartesian = raw[i]!
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      positions.push([
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
        cartographic.height,
      ])
    }

    return {
      id: String(polyline.id ?? id),
      positions,
      width: polyline._width ?? polyline.width,
      color: polyline._color ?? '#c0c4cc',
      alpha: polyline._alpha ?? 1,
      show: polyline._show ?? polyline.show,
      arcType: polyline._arcType ?? polyline.arcType ?? Cesium.ArcType.GEODESIC,
      clampToGround: polyline._clampToGround ?? polyline.clampToGround ?? false,
      targetData: { ...(polyline._targetData ?? {}) },
      positionsCount: positions.length,
      length: this.calculatePolylineLength(raw),
    }
  }

  private calculatePolylineLength(cartesianPositions: readonly Cesium.Cartesian3[]): number {
    let totalLength = 0
    for (let i = 0; i < cartesianPositions.length - 1; i++) {
      totalLength += Cesium.Cartesian3.distance(cartesianPositions[i]!, cartesianPositions[i + 1]!)
    }
    return totalLength
  }

  getCount(viewer?: Viewer): number {
    if (viewer) {
      const b = this.buckets.get(viewer)
      return b ? b.lines.size : 0
    }
    return this.idOwner.size
  }

  getAllIds(viewer?: Viewer): string[] {
    if (!viewer) return [...this.idOwner.keys()]
    const b = this.buckets.get(viewer)
    if (!b) return []
    return [...b.lines.keys()]
  }

  getAllPolylines(viewer?: Viewer): PolyLineCollectionSnapshot[] {
    const out: PolyLineCollectionSnapshot[] = []
    for (const id of this.getAllIds(viewer)) {
      const p = this.getPolyline(id)
      if (p) out.push(p)
    }
    return out
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (b: Bucket) => {
      b.lines.forEach((line) => {
        line._show = show
        line.show = show
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
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return
    }
    hit.line._show = show
    hit.line.show = show
  }

  addPointToPolyline(id: string, position: number[]): boolean {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return false
    }
    if (!Array.isArray(position) || position.length < 2) {
      console.error(`PolylineCollection: 位置数据无效`)
      return false
    }
    try {
      const currentPositions = hit.line._positions ?? []
      const newPositions = [...currentPositions, position]
      return this.updatePolyline(id, { positions: newPositions })
    } catch (error) {
      console.error(`PolylineCollection: 向线添加点失败:`, error)
      return false
    }
  }

  remove(id: string): boolean {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return false
    }
    if (!id) {
      console.error('PolylineCollection: id不能为空！')
      return false
    }
    try {
      const removed = hit.bucket.collection.remove(hit.line)
      if (removed) {
        hit.bucket.lines.delete(id)
        this.idOwner.delete(id)
        return true
      }
      return false
    } catch (error) {
      console.error(`PolylineCollection: 删除线 ${id} 失败:`, error)
      return false
    }
  }

  removeMultiple(ids: string[]): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(ids)) {
      console.error('PolylineCollection: ids必须是数组')
      return []
    }
    return ids.map((id) => ({ id, success: this.remove(id) }))
  }

  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      if (!viewer.isDestroyed()) b.collection.removeAll()
      for (const id of b.lines.keys()) this.idOwner.delete(id)
      b.lines.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) v.scene.primitives.remove(b.collection)
      for (const id of b.lines.keys()) this.idOwner.delete(id)
    }
    this.buckets.clear()
  }

  /** 与 `PointCollection#removeAll` 命名对齐 */
  clear(viewer?: Viewer): void {
    this.removeAll(viewer)
  }

  destroy(): void {
    this.removeAll()
  }

  pruneInvalid(): number {
    let n = 0
    for (const [viewer, b] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of b.lines.keys()) this.idOwner.delete(id)
        this.buckets.delete(viewer)
        n++
      }
    }
    return n
  }

  filterPolylines(filterFn: (data: PolyLineCollectionSnapshot) => boolean, viewer?: Viewer): string[] {
    if (typeof filterFn !== 'function') {
      console.error('PolylineCollection: filterFn必须是函数')
      return []
    }
    const result: string[] = []
    const ids = this.getAllIds(viewer)
    for (const id of ids) {
      const polylineData = this.getPolyline(id)
      if (polylineData && filterFn(polylineData)) result.push(id)
    }
    return result
  }

  updateTargetData(id: string, newData: Record<string, unknown>): boolean {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return false
    }
    if (typeof newData === 'object' && newData !== null) {
      hit.line._targetData = { ...(hit.line._targetData ?? {}), ...newData }
      return true
    }
    return false
  }

  getBoundingBox(id: string): {
    west: number
    east: number
    south: number
    north: number
    minHeight: number
    maxHeight: number
    center: number[]
  } | null {
    const hit = this.resolve(id)
    if (!hit) {
      console.error(`PolylineCollection: 未找到ID为 ${id} 的线!`)
      return null
    }
    const polyline = hit.line
    const positions = polyline._positions
    if (!positions || positions.length === 0) return null

    const west = Math.min(...positions.map((p) => p[0]!))
    const east = Math.max(...positions.map((p) => p[0]!))
    const south = Math.min(...positions.map((p) => p[1]!))
    const north = Math.max(...positions.map((p) => p[1]!))
    const minHeight = Math.min(...positions.map((p) => p[2] || 0))
    const maxHeight = Math.max(...positions.map((p) => p[2] || 0))

    return {
      west,
      east,
      south,
      north,
      minHeight,
      maxHeight,
      center: [(west + east) / 2, (south + north) / 2, (minHeight + maxHeight) / 2],
    }
  }
}
