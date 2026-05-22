import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type { ShapeParams } from './shape'
import { ShapeType } from './shape'
import {
  buildShapeVerticesFromTargetData,
  defaultShapeParamsForType,
  parseShapeTypeKey,
  resolveShapeParamsFromTargetData,
} from './index'

import type { PolylineVolumeCollectionAddItem, PolylineVolumeCollectionSnapshot, PolylineVolumeCollectionUpdateEntry, PolylineVolumeCollectionUpdateProps } from '../../Types'
export type { PolylineVolumeCollectionAddItem, PolylineVolumeCollectionSnapshot, PolylineVolumeCollectionUpdateEntry, PolylineVolumeCollectionUpdateProps }

type PVMeta = {
  id: string
  positions: Cesium.Cartesian3[]
  shapePositions: Cesium.Cartesian2[]
  cornerType: Cesium.CornerType
  granularity: number
  color: Cesium.Color
  primitive: Cesium.Primitive
  _targetData?: Record<string, unknown>
}

type Bucket = {
  primitives: Map<string, PVMeta>
}

function parseCornerType(s: keyof typeof Cesium.CornerType | undefined): Cesium.CornerType {
  if (!s) return Cesium.CornerType.ROUNDED
  return Cesium.CornerType[s] ?? Cesium.CornerType.ROUNDED
}

function normalizePositions(rows: number[][]): number[][] {
  const out: number[][] = []
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 2) continue
    if (!Number.isFinite(Number(r[0])) || !Number.isFinite(Number(r[1]))) continue
    const h = r.length >= 3 && Number.isFinite(Number(r[2])) ? Number(r[2]) : 0
    out.push([Number(r[0]), Number(r[1]), h])
  }
  return out
}

function toCartesianArray(rows: number[][]): Cesium.Cartesian3[] {
  return rows.map((r) => Cesium.Cartesian3.fromDegrees(r[0]!, r[1]!, r[2] ?? 0))
}

function createVolumePrimitive(
  positions: Cesium.Cartesian3[],
  shape: Cesium.Cartesian2[],
  opts: { cornerType: Cesium.CornerType; granularity: number; color: Cesium.Color; id: string },
): Cesium.Primitive {
  const geometry = new Cesium.PolylineVolumeGeometry({
    polylinePositions: positions,
    shapePositions: shape,
    cornerType: opts.cornerType,
    granularity: opts.granularity,
  })
  const instance = new Cesium.GeometryInstance({
    geometry,
    id: opts.id,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(opts.color),
    },
  })
  return new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: opts.color.alpha < 1,
      closed: true,
    }),
    asynchronous: false,
  })
}

function syncTdShape(
  td: Record<string, unknown>,
  shapeType: ShapeType,
  shapeParams: ShapeParams,
  polylinePositions: number[][],
): Record<string, unknown> {
  return {
    ...td,
    shapeType,
    shapeParams,
    polylinePositions,
  }
}

function metaToTd(meta: PVMeta): Record<string, unknown> {
  return { ...(meta._targetData ?? {}) }
}

/**
 * 批量折线体（`PolylineVolumeGeometry` + `Primitive`），按 `viewer` 分桶。
 */
export default class PolylineVolumeCollection {
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

  private resolve(id: string): { viewer: Viewer; bucket: Bucket; meta: PVMeta } | undefined {
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

  addPolylineVolumes(viewer: Viewer, options: PolylineVolumeCollectionAddItem[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(options) || options.length === 0) return []
    const b = this.ensureBucket(viewer)
    if (!b) return []

    const created: string[] = []
    for (let i = 0; i < options.length; i++) {
      const item = options[i]!
      const {
        id = createRandomXgxId('pvcol'),
        positions,
        shapeType: stRaw,
        shapeParams: spIn,
        cornerType = 'ROUNDED',
        granularity = Cesium.Math.RADIANS_PER_DEGREE,
        color = '#00bcd4',
        alpha = 0.75,
        show = true,
        targetData = {},
      } = item

      const rows = normalizePositions(positions)
      if (rows.length < 2) continue
      if (this.idOwner.has(id)) {
        console.warn(`PolylineVolumeCollection: ID "${id}" 已存在，跳过`)
        continue
      }

      const shapeType = parseShapeTypeKey(stRaw ?? (targetData as { shapeType?: string }).shapeType)
      const shapeParams = spIn ?? resolveShapeParamsFromTargetData({ ...targetData, shapeType }, shapeType)
      const mergedTd = syncTdShape({ ...targetData }, shapeType, shapeParams, rows)
      let shape: Cesium.Cartesian2[]
      try {
        shape = buildShapeVerticesFromTargetData(mergedTd)
      } catch {
        const fallback = defaultShapeParamsForType(ShapeType.CIRCLE)
        shape = buildShapeVerticesFromTargetData(syncTdShape({ ...targetData }, ShapeType.CIRCLE, fallback, rows))
      }

      const cartPositions = toCartesianArray(rows)
      const fillColor = Cesium.Color.fromCssColorString(color).withAlpha(alpha)
      const ct = parseCornerType(cornerType)

      try {
        const prim = createVolumePrimitive(cartPositions, shape, {
          cornerType: ct,
          granularity,
          color: fillColor,
          id,
        })
        prim.show = show
        viewer.scene.primitives.add(prim)

        const meta: PVMeta = {
          id,
          positions: cartPositions.map((c) => Cesium.Cartesian3.clone(c)),
          shapePositions: shape.map((s) => Cesium.Cartesian2.clone(s)),
          cornerType: ct,
          granularity,
          color: fillColor,
          primitive: prim,
          _targetData: mergedTd,
        }
        b.primitives.set(id, meta)
        this.idOwner.set(id, viewer)
        created.push(id)
      } catch (e) {
        console.error(`PolylineVolumeCollection: 添加第 ${i} 项失败`, e)
      }
    }
    return created
  }

  private replacePrimitive(viewer: Viewer, meta: PVMeta): void {
    if (viewer.isDestroyed()) return
    const old = meta.primitive
    const prim = createVolumePrimitive(meta.positions, meta.shapePositions, {
      cornerType: meta.cornerType,
      granularity: meta.granularity,
      color: meta.color,
      id: meta.id,
    })
    prim.show = old.show
    viewer.scene.primitives.remove(old)
    viewer.scene.primitives.add(prim)
    meta.primitive = prim
  }

  updatePolylineVolume(id: string, properties: PolylineVolumeCollectionUpdateProps): boolean {
    const hit = this.resolve(id)
    if (!hit) return false
    const { viewer, meta } = hit

    let rows = normalizePositions((meta._targetData?.polylinePositions as number[][]) ?? [])
    if (properties.positions !== undefined) {
      const next = normalizePositions(properties.positions)
      if (next.length >= 2) rows = next
    }
    meta.positions = toCartesianArray(rows)

    const shapeType =
      properties.shapeType !== undefined
        ? parseShapeTypeKey(properties.shapeType)
        : parseShapeTypeKey(meta._targetData?.shapeType)
    const shapeParams =
      properties.shapeParams !== undefined
        ? properties.shapeParams
        : resolveShapeParamsFromTargetData({ ...(meta._targetData ?? {}), shapeType }, shapeType)
    const mergedTd = syncTdShape({ ...(meta._targetData ?? {}) }, shapeType, shapeParams, rows)
    let shape: Cesium.Cartesian2[]
    try {
      shape = buildShapeVerticesFromTargetData(mergedTd)
    } catch {
      shape = buildShapeVerticesFromTargetData(
        syncTdShape({ ...(meta._targetData ?? {}) }, ShapeType.CIRCLE, defaultShapeParamsForType(ShapeType.CIRCLE), rows),
      )
    }
    meta.shapePositions = shape.map((s) => Cesium.Cartesian2.clone(s))

    if (properties.cornerType !== undefined) {
      meta.cornerType = parseCornerType(properties.cornerType)
    }
    if (properties.granularity !== undefined && Number.isFinite(properties.granularity)) {
      meta.granularity = properties.granularity
    }
    if (properties.color !== undefined || properties.alpha !== undefined) {
      const css = properties.color ?? meta.color.toCssColorString?.() ?? '#00bcd4'
      const base = Cesium.Color.fromCssColorString(css)
      const a =
        properties.alpha !== undefined && Number.isFinite(properties.alpha) ? properties.alpha : meta.color.alpha
      meta.color = base.withAlpha(a)
    }

    meta._targetData = { ...mergedTd, ...(properties.targetData ?? {}) }

    this.replacePrimitive(viewer, meta)

    if (properties.show !== undefined) {
      meta.primitive.show = properties.show
    }
    return true
  }

  updatePolylineVolumes(
    updates: PolylineVolumeCollectionUpdateEntry[],
  ): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return []
    return updates.map(({ id, ...rest }) => ({ id, success: this.updatePolylineVolume(id, rest) }))
  }

  getPolylineVolume(id: string): PolylineVolumeCollectionSnapshot | null {
    const hit = this.resolve(id)
    if (!hit) return null
    const { meta } = hit
    const td = metaToTd(meta)
    const pos = (td.polylinePositions as number[][]) ?? []
    return {
      id: meta.id,
      positions: pos,
      positionsCount: pos.length,
      shapeType: String(td.shapeType ?? ShapeType.CIRCLE),
      show: meta.primitive.show,
      targetData: { ...td },
    }
  }

  getAllPolylineVolumes(viewer?: Viewer): PolylineVolumeCollectionSnapshot[] {
    const out: PolylineVolumeCollectionSnapshot[] = []
    for (const id of this.getAllIds(viewer)) {
      const s = this.getPolylineVolume(id)
      if (s) out.push(s)
    }
    return out
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

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (bucket: Bucket) => {
      bucket.primitives.forEach((m) => {
        m.primitive.show = show
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
    hit.meta.primitive.show = show
  }

  remove(id: string): void {
    const hit = this.resolve(id)
    if (!hit) return
    const { viewer, bucket, meta } = hit
    if (!viewer.isDestroyed()) {
      viewer.scene.primitives.remove(meta.primitive)
    }
    bucket.primitives.delete(id)
    this.idOwner.delete(id)
  }

  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer)
      if (!b) return
      for (const m of b.primitives.values()) {
        if (!viewer.isDestroyed()) viewer.scene.primitives.remove(m.primitive)
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id)
      b.primitives.clear()
      return
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) {
        for (const m of b.primitives.values()) {
          v.scene.primitives.remove(m.primitive)
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
