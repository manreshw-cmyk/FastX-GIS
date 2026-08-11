/**
 * 空域管理 ↔ 各 Draw 单类的草稿桥接（add / update / remove / commit）。
 */
import type { Cartesian3, Entity, Viewer } from 'cesium'
import * as Cesium from 'cesium'
import { createRandomXgxId } from '../Coordinates'
import { AREA_DRAFT_TARGET_KEY } from '../Types'
import type {
  AddBillboardOptions,
  AddBoxOptions,
  AddCircleOptions,
  AddCorridorOptions,
  AddAttackDirectionArrowOptions,
  AddCylinderOptions,
  AddCurveArrowOptions,
  AddDoubleArrowOptions,
  AddEllipsoidOptions,
  AddFineStraightArrowOptions,
  AddLabelOptions,
  AddModelOptions,
  AddPincerArrowOptions,
  AddPlaneOptions,
  AddPointOptions,
  AddPolygonOptions,
  AddPolylineOptions,
  AddPolylineVolumeOptions,
  AddRectangleOptions,
  AddRunwayOptions,
  AddSectorOptions,
  AddStraightArrowOptions,
  AddSwallowtailAttackArrowOptions,
  AddWallOptions,
  AreaDrawShapeType,
  AreaDrawStartParams,
  AreaManagerDrawApis,
  LngLatHeight,
} from '../Types'
import {
  bearingDegreesNorthClockwise,
  cartesianToLngLat,
  draftCylinderRadiiFromPoints,
  draftEllipsoidRadiiFromPoints,
  midpoint,
  radialDraftPoints,
  rectangleFromCorners,
  rectangleToBounds,
  snapSectorDraftCursor,
  toPolylineTuples,
} from '../Utils/geoDraw'

export const DRAFT_ID_PREFIX: Partial<Record<AreaDrawShapeType, string>> = {
  point: 'pt',
  label: 'lb',
  billboard: 'bb',
  model: 'md',
  polyline: 'pl',
  polygon: 'poly',
  straightArrow: 'sta',
  fineStraightArrow: 'fsa',
  curveArrow: 'cua',
  attackDirectionArrow: 'ada',
  doubleArrow: 'dba',
  swallowtailAttackArrow: 'saa',
  pincerArrow: 'pca',
  circle: 'cir',
  sector: 'sec',
  rectangle: 'rect',
  cylinder: 'cyl',
  runway: 'rw',
  corridor: 'cor',
  ellipsoid: 'ell',
  wall: 'wall',
  polylineVolume: 'plv',
  plane: 'plane',
  box: 'box',
}

export interface AreaDraftOps {
  add: (viewer: Viewer, opts: Record<string, unknown>) => Entity | undefined
  update: (id: string, opts: Record<string, unknown>) => boolean
  remove: (id: string) => void
  getEntity: (id: string) => Entity | undefined
  getTargetData: (id: string) => Record<string, unknown> | undefined
}

function cloneTargetData(td: unknown): Record<string, unknown> | undefined {
  if (!td || typeof td !== 'object') return undefined
  return { ...(td as Record<string, unknown>) }
}

function draftOpts<T>(o: Record<string, unknown>): T {
  return o as unknown as T
}

function lngLatAtGround(p: LngLatHeight): LngLatHeight {
  return { ...p, height: 0 }
}

/** 将 targetData 中的材质/样式字段提升到顶层，保证 syncShapeDraft / finish 每次都能带上 */
const PLOT_ARROW_HOIST_KEYS = [
  'color',
  'alpha',
  'showFill',
  'outline',
  'outlineColor',
  'outlineAlpha',
  'outlineWidth',
  'height',
  'clampToGround',
  'width',
  'headWidthRatio',
  'headLengthRatio',
  'neckWidthRatio',
  'tailWidthRatio',
  'swallowTailRatio',
  'curveSegments',
  'curveTension',
  'style',
] as const

const MATERIAL_HOIST_KEYS: Partial<Record<AreaDrawShapeType, readonly string[]>> = {
  wall: [
    'materialType',
    'color',
    'imageUrl',
    'repeat',
    'gradientStartColor',
    'gradientEndColor',
    'gradientDirection',
    'colorStops',
    'style',
    'fill',
    'outline',
    'outlineColor',
    'outlineWidth',
  ],
  plane: [
    'materialType',
    'color',
    'alpha',
    'imageUrl',
    'videoUrl',
    'imageRepeat',
    'video',
    'fill',
    'outline',
    'outlineColor',
    'outlineAlpha',
    'outlineWidth',
  ],
  runway: [
    'materialMode',
    'flowImageUrl',
    'flowSpeed',
    'flowDirection',
    'color',
    'alpha',
    'showFill',
    'outline',
    'outlineColor',
    'outlineAlpha',
    'outlineWidth',
  ],
  straightArrow: PLOT_ARROW_HOIST_KEYS,
  fineStraightArrow: PLOT_ARROW_HOIST_KEYS,
  curveArrow: PLOT_ARROW_HOIST_KEYS,
  attackDirectionArrow: PLOT_ARROW_HOIST_KEYS,
  doubleArrow: PLOT_ARROW_HOIST_KEYS,
  swallowtailAttackArrow: PLOT_ARROW_HOIST_KEYS,
  pincerArrow: PLOT_ARROW_HOIST_KEYS,
}

function hoistMaterialFields(
  shapeType: AreaDrawShapeType,
  out: Record<string, unknown>,
  td: Record<string, unknown>,
): void {
  const keys = MATERIAL_HOIST_KEYS[shapeType]
  if (!keys) return
  for (const k of keys) {
    if (out[k] === undefined && td[k] !== undefined) out[k] = td[k]
  }
}

function baseOpts(params: AreaDrawStartParams): Record<string, unknown> {
  const { preview: _p, autoFinishOnSecondClick: _a, onAnchorChange: _o, ...rest } = params
  const out: Record<string, unknown> = { ...rest, targetData: cloneTargetData(params.targetData) }
  const td = params.targetData
  if (td && typeof td === 'object') hoistMaterialFields(params.shapeType, out, td as Record<string, unknown>)
  return out
}

/** 鼠标锚点 + 跟随点 → 各形状草稿/提交参数 */
export function buildShapeDrawOptions(
  shapeType: AreaDrawShapeType,
  anchors: Cartesian3[],
  cursor: Cartesian3 | null,
  params: AreaDrawStartParams,
  areaDraft: boolean,
): Record<string, unknown> | null {
  const base = baseOpts(params)
  const pts = cursor ? [...anchors, cursor] : [...anchors]

  switch (shapeType) {
    case 'point':
    case 'label':
    case 'billboard':
    case 'model': {
      if (pts.length < 1) return null
      return { ...base, areaDraft, position: lngLatAtGround(cartesianToLngLat(pts[pts.length - 1]!)) }
    }
    case 'polyline':
    case 'corridor':
    case 'wall':
    case 'polylineVolume': {
      if (pts.length < 1) return null
      return {
        ...base,
        areaDraft,
        positions: toPolylineTuples(pts),
        draftCartesians: pts.map((p) => Cesium.Cartesian3.clone(p)),
      }
    }
    case 'polygon': {
      if (pts.length < 1) return null
      return { ...base, areaDraft, positions: pts.map(cartesianToLngLat) }
    }
    case 'straightArrow':
    case 'fineStraightArrow':
    case 'curveArrow':
    case 'attackDirectionArrow':
    case 'doubleArrow':
    case 'swallowtailAttackArrow':
    case 'pincerArrow': {
      if (pts.length < 1) return null
      return {
        ...base,
        areaDraft,
        positions: toPolylineTuples(pts),
        draftCartesians: pts.map((p) => Cesium.Cartesian3.clone(p)),
      }
    }
    case 'rectangle': {
      if (pts.length < 1) return null
      if (pts.length >= 2) {
        return { ...base, areaDraft, ...rectangleToBounds(rectangleFromCorners(pts[0]!, pts[1]!)) }
      }
      const p = cartesianToLngLat(pts[0]!)
      return { ...base, areaDraft, west: p.longitude, east: p.longitude, south: p.latitude, north: p.latitude }
    }
    case 'circle': {
      if (anchors.length < 1) return null
      const circlePts = radialDraftPoints(anchors, cursor)
      const center = cartesianToLngLat(circlePts[0]!)
      const radius =
        circlePts.length >= 2 ? Cesium.Cartesian3.distance(circlePts[0]!, circlePts[1]!) : 0
      return {
        ...base,
        areaDraft,
        center,
        radius,
        draftVertices: circlePts.map(cartesianToLngLat),
        draftCartesians: circlePts.map((p) => Cesium.Cartesian3.clone(p)),
      }
    }
    case 'runway': {
      if (pts.length < 1) return null
      const positions =
        pts.length >= 2
          ? [cartesianToLngLat(pts[0]!), cartesianToLngLat(pts[1]!)]
          : [cartesianToLngLat(pts[0]!), cartesianToLngLat(pts[0]!)]
      return { ...base, areaDraft, positions }
    }
    case 'ellipsoid': {
      if (anchors.length < 1) return null
      const ellipsoidPts = radialDraftPoints(anchors, cursor)
      const { x, y, z } = draftEllipsoidRadiiFromPoints(ellipsoidPts)
      return {
        ...base,
        areaDraft,
        position: cartesianToLngLat(ellipsoidPts[0]!),
        radii: new Cesium.Cartesian3(Math.max(x, 1), Math.max(y, 1), Math.max(z, 1)),
        draftCartesians: ellipsoidPts.map((p) => Cesium.Cartesian3.clone(p)),
      }
    }
    case 'cylinder': {
      if (anchors.length < 1) return null
      const cylinderPts = radialDraftPoints(anchors, cursor)
      const { bottom: bottomRadius, top: topRadius } = draftCylinderRadiiFromPoints(cylinderPts)
      const lenParam = params.length as number | undefined
      const length =
        typeof lenParam === 'number' && Number.isFinite(lenParam) && lenParam > 0
          ? lenParam
          : Math.max(bottomRadius, topRadius, 1)
      return {
        ...base,
        areaDraft,
        center: cartesianToLngLat(cylinderPts[0]!),
        length,
        topRadius,
        bottomRadius,
        draftCartesians: cylinderPts.map((p) => Cesium.Cartesian3.clone(p)),
      }
    }
    case 'box': {
      if (pts.length < 1) return null
      const dims = params.dimensions as [number, number, number] | undefined
      if (pts.length >= 2) {
        const dist = Cesium.Cartesian3.distance(pts[0]!, pts[1]!)
        return {
          ...base,
          areaDraft,
          position: lngLatAtGround(cartesianToLngLat(midpoint(pts[0]!, pts[1]!))),
          dimensions: dims ?? [dist, dist, dist * 0.5],
        }
      }
      return {
        ...base,
        areaDraft,
        position: lngLatAtGround(cartesianToLngLat(pts[0]!)),
        dimensions: dims,
      }
    }
    case 'plane': {
      if (pts.length < 1) return null
      const dims = params.dimensions as { width: number; height: number } | undefined
      if (pts.length >= 2) {
        const span = Cesium.Cartesian3.distance(pts[0]!, pts[1]!)
        return {
          ...base,
          areaDraft,
          position: lngLatAtGround(cartesianToLngLat(pts[0]!)),
          dimensions: dims ?? { width: span, height: span },
        }
      }
      return {
        ...base,
        areaDraft,
        position: lngLatAtGround(cartesianToLngLat(pts[0]!)),
        dimensions: dims,
      }
    }
    case 'sector': {
      if (anchors.length < 1) return null
      const sectorCursor =
        cursor && anchors.length >= 2 ? snapSectorDraftCursor(anchors, cursor) : cursor
      const sectorPts = sectorCursor ? [...anchors, sectorCursor] : [...anchors]
      const center = cartesianToLngLat(sectorPts[0]!)
      const draftVertices = sectorPts.map(cartesianToLngLat)
      const radius =
        sectorPts.length >= 2 ? Cesium.Cartesian3.distance(sectorPts[0]!, sectorPts[1]!) : 0
      const draft: Record<string, unknown> = { ...base, areaDraft, center, radius, draftVertices }
      if (anchors.length >= 2 && sectorPts.length >= 2) {
        draft.startAzimuthDegrees = bearingDegreesNorthClockwise(sectorPts[0]!, sectorPts[1]!)
      }
      if (anchors.length >= 2 && sectorPts.length >= 3) {
        draft.endAzimuthDegrees = bearingDegreesNorthClockwise(sectorPts[0]!, sectorPts[2]!)
      }
      return draft
    }
    default:
      return null
  }
}

export function buildCommitOptions(
  shapeType: AreaDrawShapeType,
  anchors: Cartesian3[],
  params: AreaDrawStartParams,
): Record<string, unknown> | null {
  return buildShapeDrawOptions(shapeType, anchors, null, params, false)
}

export function resolveDraftOps(shapeType: AreaDrawShapeType, apis: AreaManagerDrawApis): AreaDraftOps | null {
  switch (shapeType) {
    case 'point':
      return {
        add: (v, o) => apis.point.add(v, draftOpts<AddPointOptions>(o)),
        update: (id, o) => apis.point.updatePoint(id, o),
        remove: (id) => apis.point.remove(id),
        getEntity: (id) => apis.point.getEntity(id),
        getTargetData: (id) => apis.point.getTargetData(id),
      }
    case 'label':
      return {
        add: (v, o) => apis.label.add(v, draftOpts<AddLabelOptions>(o)),
        update: (id, o) => apis.label.updateLabel(id, o),
        remove: (id) => apis.label.remove(id),
        getEntity: (id) => apis.label.getEntity(id),
        getTargetData: (id) => apis.label.getTargetData(id),
      }
    case 'billboard':
      return {
        add: (v, o) => apis.billboard.add(v, draftOpts<AddBillboardOptions>(o)),
        update: (id, o) => apis.billboard.updateBillboard(id, o),
        remove: (id) => apis.billboard.remove(id),
        getEntity: (id) => apis.billboard.getEntity(id),
        getTargetData: (id) => apis.billboard.getTargetData(id),
      }
    case 'model':
      return {
        add: (v, o) => apis.model.add(v, draftOpts<AddModelOptions>(o)),
        update: (id, o) => apis.model.updateModel(id, o),
        remove: (id) => apis.model.remove(id),
        getEntity: (id) => apis.model.getEntity(id),
        getTargetData: (id) => apis.model.getTargetData(id),
      }
    case 'polyline':
      return {
        add: (v, o) => apis.polyLine.add(v, draftOpts<AddPolylineOptions>(o)),
        update: (id, o) => apis.polyLine.updatePolyline(id, o),
        remove: (id) => apis.polyLine.remove(id),
        getEntity: (id) => apis.polyLine.getEntity(id),
        getTargetData: (id) => apis.polyLine.getTargetData(id),
      }
    case 'polygon':
      return {
        add: (v, o) => apis.polygon.add(v, draftOpts<AddPolygonOptions>(o)),
        update: (id, o) => apis.polygon.updatePolygon(id, o),
        remove: (id) => apis.polygon.remove(id),
        getEntity: (id) => apis.polygon.getEntity(id),
        getTargetData: (id) => apis.polygon.getTargetData(id),
      }
    case 'straightArrow':
      return {
        add: (v, o) => apis.straightArrow.add(v, draftOpts<AddStraightArrowOptions>(o)),
        update: (id, o) => apis.straightArrow.updateStraightArrow(id, o),
        remove: (id) => apis.straightArrow.remove(id),
        getEntity: (id) => apis.straightArrow.getEntity(id),
        getTargetData: (id) => apis.straightArrow.getTargetData(id),
      }
    case 'fineStraightArrow':
      return {
        add: (v, o) => apis.fineStraightArrow.add(v, draftOpts<AddFineStraightArrowOptions>(o)),
        update: (id, o) => apis.fineStraightArrow.updateFineStraightArrow(id, o),
        remove: (id) => apis.fineStraightArrow.remove(id),
        getEntity: (id) => apis.fineStraightArrow.getEntity(id),
        getTargetData: (id) => apis.fineStraightArrow.getTargetData(id),
      }
    case 'curveArrow':
      return {
        add: (v, o) => apis.curveArrow.add(v, draftOpts<AddCurveArrowOptions>(o)),
        update: (id, o) => apis.curveArrow.updateCurveArrow(id, o),
        remove: (id) => apis.curveArrow.remove(id),
        getEntity: (id) => apis.curveArrow.getEntity(id),
        getTargetData: (id) => apis.curveArrow.getTargetData(id),
      }
    case 'attackDirectionArrow':
      return {
        add: (v, o) => apis.attackDirectionArrow.add(v, draftOpts<AddAttackDirectionArrowOptions>(o)),
        update: (id, o) => apis.attackDirectionArrow.updateAttackDirectionArrow(id, o),
        remove: (id) => apis.attackDirectionArrow.remove(id),
        getEntity: (id) => apis.attackDirectionArrow.getEntity(id),
        getTargetData: (id) => apis.attackDirectionArrow.getTargetData(id),
      }
    case 'doubleArrow':
      return {
        add: (v, o) => apis.doubleArrow.add(v, draftOpts<AddDoubleArrowOptions>(o)),
        update: (id, o) => apis.doubleArrow.updateDoubleArrow(id, o),
        remove: (id) => apis.doubleArrow.remove(id),
        getEntity: (id) => apis.doubleArrow.getEntity(id),
        getTargetData: (id) => apis.doubleArrow.getTargetData(id),
      }
    case 'swallowtailAttackArrow':
      return {
        add: (v, o) => apis.swallowtailAttackArrow.add(v, draftOpts<AddSwallowtailAttackArrowOptions>(o)),
        update: (id, o) => apis.swallowtailAttackArrow.updateSwallowtailAttackArrow(id, o),
        remove: (id) => apis.swallowtailAttackArrow.remove(id),
        getEntity: (id) => apis.swallowtailAttackArrow.getEntity(id),
        getTargetData: (id) => apis.swallowtailAttackArrow.getTargetData(id),
      }
    case 'pincerArrow':
      return {
        add: (v, o) => apis.pincerArrow.add(v, draftOpts<AddPincerArrowOptions>(o)),
        update: (id, o) => apis.pincerArrow.updatePincerArrow(id, o),
        remove: (id) => apis.pincerArrow.remove(id),
        getEntity: (id) => apis.pincerArrow.getEntity(id),
        getTargetData: (id) => apis.pincerArrow.getTargetData(id),
      }
    case 'circle':
      return {
        add: (v, o) => apis.circle.add(v, draftOpts<AddCircleOptions>(o)),
        update: (id, o) => apis.circle.updateCircle(id, o),
        remove: (id) => apis.circle.remove(id),
        getEntity: (id) => apis.circle.getEntity(id),
        getTargetData: (id) => apis.circle.getTargetData(id),
      }
    case 'rectangle':
      return {
        add: (v, o) => apis.rectangle.add(v, draftOpts<AddRectangleOptions>(o)),
        update: (id, o) => apis.rectangle.updateRectangle(id, o),
        remove: (id) => apis.rectangle.remove(id),
        getEntity: (id) => apis.rectangle.getEntity(id),
        getTargetData: (id) => apis.rectangle.getTargetData(id),
      }
    case 'sector':
      return {
        add: (v, o) => apis.sector.add(v, draftOpts<AddSectorOptions>(o)),
        update: (id, o) => apis.sector.updateSector(id, o),
        remove: (id) => apis.sector.remove(id),
        getEntity: (id) => apis.sector.getEntity(id),
        getTargetData: (id) => apis.sector.getTargetData(id),
      }
    case 'cylinder':
      return {
        add: (v, o) => apis.cylinder.add(v, draftOpts<AddCylinderOptions>(o)),
        update: (id, o) => apis.cylinder.updateCylinder(id, o),
        remove: (id) => apis.cylinder.remove(id),
        getEntity: (id) => apis.cylinder.getEntity(id),
        getTargetData: (id) => apis.cylinder.getTargetData(id),
      }
    case 'runway':
      return {
        add: (v, o) => apis.runway.add(v, draftOpts<AddRunwayOptions>(o)),
        update: (id, o) => apis.runway.updateRunway(id, o),
        remove: (id) => apis.runway.remove(id),
        getEntity: (id) => apis.runway.getEntity(id),
        getTargetData: (id) => apis.runway.getTargetData(id),
      }
    case 'corridor':
      return {
        add: (v, o) => apis.corridor.add(v, draftOpts<AddCorridorOptions>(o)),
        update: (id, o) => apis.corridor.updateCorridor(id, o),
        remove: (id) => apis.corridor.remove(id),
        getEntity: (id) => apis.corridor.getEntity(id),
        getTargetData: (id) => apis.corridor.getTargetData(id),
      }
    case 'ellipsoid':
      return {
        add: (v, o) => apis.ellipsoid.add(v, draftOpts<AddEllipsoidOptions>(o)),
        update: (id, o) => apis.ellipsoid.updateEllipsoid(id, o),
        remove: (id) => apis.ellipsoid.remove(id),
        getEntity: (id) => apis.ellipsoid.getEntity(id),
        getTargetData: (id) => apis.ellipsoid.getTargetData(id),
      }
    case 'wall':
      return {
        add: (v, o) => apis.wall.add(v, draftOpts<AddWallOptions>(o)),
        update: (id, o) => apis.wall.updateWall(id, o),
        remove: (id) => apis.wall.remove(id),
        getEntity: (id) => apis.wall.getEntity(id),
        getTargetData: (id) => apis.wall.getTargetData(id),
      }
    case 'polylineVolume':
      return {
        add: (v, o) => apis.polylineVolume.add(v, draftOpts<AddPolylineVolumeOptions>(o)),
        update: (id, o) => apis.polylineVolume.updatePolylineVolume(id, o),
        remove: (id) => apis.polylineVolume.remove(id),
        getEntity: (id) => apis.polylineVolume.getEntity(id),
        getTargetData: (id) => apis.polylineVolume.getTargetData(id),
      }
    case 'plane':
      return {
        add: (v, o) => apis.plane.add(v, draftOpts<AddPlaneOptions>(o)),
        update: (id, o) => apis.plane.updatePlane(id, o),
        remove: (id) => apis.plane.remove(id),
        getEntity: (id) => apis.plane.getEntity(id),
        getTargetData: (id) => apis.plane.getTargetData(id),
      }
    case 'box':
      return {
        add: (v, o) => apis.box.add(v, draftOpts<AddBoxOptions>(o)),
        update: (id, o) => apis.box.updateBox(id, o),
        remove: (id) => apis.box.remove(id),
        getEntity: (id) => apis.box.getEntity(id),
        getTargetData: (id) => apis.box.getTargetData(id),
      }
    default:
      return null
  }
}

export function supportsClassDraft(shapeType: AreaDrawShapeType): boolean {
  return shapeType !== 'path' && shapeType in DRAFT_ID_PREFIX
}

export function isDraftTargetData(td: Record<string, unknown> | undefined): boolean {
  return td?.[AREA_DRAFT_TARGET_KEY] === true
}

export function newDraftId(shapeType: AreaDrawShapeType, explicit?: string): string {
  const prefix = DRAFT_ID_PREFIX[shapeType] ?? 'am'
  return explicit?.trim() || createRandomXgxId(prefix)
}

export function anchorsToLngLatList(anchors: Cartesian3[]): LngLatHeight[] {
  return anchors.map(cartesianToLngLat)
}

export { toPolylineTuples }
