/**
 * 空域管理 `start` 草稿共用工具（与 `AREA_DRAFT_TARGET_KEY` 配合）。
 * 各 Draw 类在 `areaDraft: true` 时使用；正式 `add` 路径不受影响。
 */
import * as Cesium from 'cesium'
import type { Cartesian3, Entity } from 'cesium'
import { AREA_DRAFT_TARGET_KEY } from '../Types'

export { AREA_DRAFT_TARGET_KEY }

export function isAreaDraftTargetData(td: Record<string, unknown>): boolean {
  return td[AREA_DRAFT_TARGET_KEY] === true
}

export function markAreaDraftTargetData(td: Record<string, unknown>): void {
  td[AREA_DRAFT_TARGET_KEY] = true
}

export function clearAreaDraftTargetData(td: Record<string, unknown>): void {
  delete td[AREA_DRAFT_TARGET_KEY]
}

export interface AreaDraftPointsHolder {
  draftPoints?: Cartesian3[]
}

export function cloneDraftPoints(points: Cartesian3[]): Cartesian3[] {
  return points.map((p) => Cesium.Cartesian3.clone(p))
}

/** 空域草稿顶点（世界坐标，避免经纬度往返导致光标与线尾错位） */
export type DraftCartesiansOption = { draftCartesians?: Cartesian3[] }

export function setDraftPoints(holder: AreaDraftPointsHolder, points: Cartesian3[]): void {
  holder.draftPoints = cloneDraftPoints(points)
}

export function getDraftPoints(holder: AreaDraftPointsHolder): Cartesian3[] {
  return holder.draftPoints ?? []
}

/** 折线草稿：不足 2 点时补重复点，避免 Cesium 报错 */
export function draftLinePositions(points: Cartesian3[], min = 2): Cartesian3[] {
  if (points.length >= min) return points
  if (points.length === 1) {
    const p = points[0]!
    return [p, Cesium.Cartesian3.clone(p)]
  }
  const z = Cesium.Cartesian3.ZERO
  return [z, Cesium.Cartesian3.clone(z)]
}

export function createDraftPositionProperty(
  getPoints: () => Cartesian3[],
): Cesium.PositionProperty {
  return new Cesium.CallbackPositionProperty(() => {
    const pts = getPoints()
    return pts.length ? Cesium.Cartesian3.clone(pts[pts.length - 1]!) : Cesium.Cartesian3.ZERO
  }, false)
}

export function createDraftPolylinePositionsProperty(
  getPoints: () => Cartesian3[],
): Cesium.Property {
  return new Cesium.CallbackProperty(() => draftLinePositions(getPoints()), false)
}

export function commitEntityPosition(entity: Entity, position: Cartesian3): void {
  entity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.clone(position))
}

export function commitEntityPolylinePositions(entity: Entity, positions: Cartesian3[]): void {
  const pl = entity.polyline
  if (!pl) return
  pl.positions = new Cesium.ConstantProperty(cloneDraftPoints(positions))
  pl.show = new Cesium.ConstantProperty(positions.length >= 2)
}

export function draftRadiusFromPoints(points: Cartesian3[]): number {
  if (points.length < 2) return 0
  return Math.max(0, Cesium.Cartesian3.distance(points[0]!, points[points.length - 1]!))
}

export function createDraftRadiusProperty(getPoints: () => Cartesian3[]): Cesium.Property {
  return new Cesium.CallbackProperty(() => {
    const r = draftRadiusFromPoints(getPoints())
    return r > 0 ? r : 0
  }, false)
}
