/**
 * 空域绘制管理器：`start` 鼠标逐点绘制（固定 Entity）；`draw` 数据回显（可选 Entity / Primitive）。
 *
 * 挂载：`FastX.AreaManager`（内部 `new AreaManager(FastX 各 Draw 单例)`）。
 * 也可 `new AreaManager({ point: FastX.Point, ... })` 单独使用。
 */
import * as Cesium from 'cesium'
import type { Cartesian3, Entity, Viewer } from 'cesium'
import {
  createRandomXgxId,
  screenDrawingBufferToWorldCartesian3,
} from '../Coordinates'
import Point from '../Draw/Point'
import Label from '../Draw/Label'
import LabelCollection from '../Draw/Label/LabelCollection'
import Billboard from '../Draw/Billboard'
import BillboardCollection from '../Draw/Billboard/BillboardCollection'
import Model from '../Draw/Model'
import ModelCollection from '../Draw/Model/ModelCollection'
import PolyLine from '../Draw/PolyLine'
import PolyLineCollection from '../Draw/PolyLine/PolyLineCollection'
import Polygon from '../Draw/Polygon'
import PolygonCollection from '../Draw/Polygon/PolygonCollection'
import StraightArrow from '../Draw/StraightArrow'
import StraightArrowCollection from '../Draw/StraightArrow/StraightArrowCollection'
import FineStraightArrow from '../Draw/FineStraightArrow'
import FineStraightArrowCollection from '../Draw/FineStraightArrow/FineStraightArrowCollection'
import CurveArrow from '../Draw/CurveArrow'
import CurveArrowCollection from '../Draw/CurveArrow/CurveArrowCollection'
import AttackDirectionArrow from '../Draw/AttackDirectionArrow'
import AttackDirectionArrowCollection from '../Draw/AttackDirectionArrow/AttackDirectionArrowCollection'
import DoubleArrow from '../Draw/DoubleArrow'
import DoubleArrowCollection from '../Draw/DoubleArrow/DoubleArrowCollection'
import SwallowtailAttackArrow from '../Draw/SwallowtailAttackArrow'
import SwallowtailAttackArrowCollection from '../Draw/SwallowtailAttackArrow/SwallowtailAttackArrowCollection'
import PincerArrow from '../Draw/PincerArrow'
import PincerArrowCollection from '../Draw/PincerArrow/PincerArrowCollection'
import Circle from '../Draw/Circle'
import CircleCollection from '../Draw/Circle/CircleCollection'
import Rectangle from '../Draw/Rectangle'
import RectangleCollection from '../Draw/Rectangle/RectangleCollection'
import Sector from '../Draw/Sector'
import SectorCollection from '../Draw/Sector/SectorCollection'
import Corridor from '../Draw/Corridor'
import CorridorCollection from '../Draw/Corridor/CorridorCollection'
import Cylinder from '../Draw/Cylinder'
import CylinderCollection from '../Draw/Cylinder/CylinderCollection'
import Ellipsoid from '../Draw/Ellipsoid'
import EllipsoidCollection from '../Draw/Ellipsoid/EllipsoidCollection'
import Wall from '../Draw/Wall'
import Runway from '../Draw/Runway'
import RunwayCollection from '../Draw/Runway/RunwayCollection'
import Box from '../Draw/Box'
import BoxCollection from '../Draw/Box/BoxCollection'
import PolylineVolume from '../Draw/PolylineVolume'
import PolylineVolumeCollection from '../Draw/PolylineVolume/PolylineVolumeCollection'
import Plane from '../Draw/Plane'
import PlaneCollection from '../Draw/Plane/PlaneCollection'
import Path from '../Draw/Path'
import PointCollection from '../Draw/Point/PointCollection'
import {
  buildCommitOptions,
  buildShapeDrawOptions,
  isDraftTargetData,
  newDraftId,
  resolveDraftOps,
  supportsClassDraft,
} from './draftBridge'
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
  AddPathOptions,
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
  AreaDrawDirectParams,
  AreaDrawOutput,
  AreaDrawPreviewStyle,
  AreaDrawPublishCallback,
  AreaDrawRenderMode,
  AreaDrawShapeType,
  AreaDrawStartParams,
  AreaManagerDrawApis,
  AreaManagerEntityApis,
  AreaManagerOptions,
  AreaManagerPrimitiveApis,
  AreaShapeInteractionRule,
  LngLatHeight,
} from '../Types'
import {
  cartesianToLngLat,
  colorFromCss,
  positionInputToTuple,
  positionsTupleToArray,
  snapRadialDraftCursor,
  snapSectorDraftCursor,
} from '../Utils/geoDraw'

// --- shape interaction rules ---

const SHAPE_RULES: Record<AreaDrawShapeType, AreaShapeInteractionRule> = {
  point: { mode: 'single', minPoints: 1, interactive: true, supportsPrimitive: true },
  label: { mode: 'single', minPoints: 1, interactive: true, supportsPrimitive: true },
  billboard: { mode: 'single', minPoints: 1, interactive: true, supportsPrimitive: true },
  model: { mode: 'single', minPoints: 1, interactive: true, supportsPrimitive: false },
  polyline: { mode: 'polyline', minPoints: 2, interactive: true, supportsPrimitive: true },
  polygon: { mode: 'polyline', minPoints: 3, interactive: true, supportsPrimitive: true },
  straightArrow: { mode: 'twoClick', minPoints: 2, interactive: true, supportsPrimitive: true },
  fineStraightArrow: { mode: 'twoClick', minPoints: 2, interactive: true, supportsPrimitive: true },
  curveArrow: { mode: 'polyline', minPoints: 2, interactive: true, supportsPrimitive: true },
  attackDirectionArrow: { mode: 'polyline', minPoints: 3, interactive: true, supportsPrimitive: true },
  doubleArrow: { mode: 'polyline', minPoints: 3, interactive: true, supportsPrimitive: true },
  swallowtailAttackArrow: { mode: 'polyline', minPoints: 3, interactive: true, supportsPrimitive: true },
  pincerArrow: { mode: 'polyline', minPoints: 3, interactive: true, supportsPrimitive: true },
  corridor: { mode: 'polyline', minPoints: 2, interactive: true, supportsPrimitive: true },
  wall: { mode: 'polyline', minPoints: 2, interactive: true, supportsPrimitive: false },
  polylineVolume: { mode: 'polyline', minPoints: 2, interactive: true, supportsPrimitive: true },
  rectangle: { mode: 'twoClick', minPoints: 2, interactive: true, supportsPrimitive: true },
  circle: { mode: 'twoClick', minPoints: 2, interactive: true, supportsPrimitive: true },
  runway: { mode: 'twoClick', minPoints: 2, interactive: true, supportsPrimitive: true },
  ellipsoid: { mode: 'fourClick', minPoints: 4, interactive: true, supportsPrimitive: true },
  box: { mode: 'single', minPoints: 1, interactive: true, supportsPrimitive: true },
  plane: { mode: 'single', minPoints: 1, interactive: true, supportsPrimitive: true },
  cylinder: { mode: 'threeClick', minPoints: 3, interactive: true, supportsPrimitive: true },
  sector: { mode: 'threeClick', minPoints: 3, interactive: true, supportsPrimitive: true },
  path: { mode: 'single', minPoints: 0, interactive: false, supportsPrimitive: false },
}

function getShapeRule(shapeType: AreaDrawShapeType): AreaShapeInteractionRule {
  return SHAPE_RULES[shapeType]
}

function usesMultiClickAutoFinish(shapeType: AreaDrawShapeType): boolean {
  const m = SHAPE_RULES[shapeType].mode
  return m === 'twoClick' || m === 'threeClick' || m === 'fourClick'
}

const DRAFT_ENTITY_CURSOR_SHAPES = new Set<AreaDrawShapeType>([
  'label',
  'billboard',
  'model',
  'box',
  'plane',
])

const SINGLE_CLICK_PLACE_SHAPES = new Set<AreaDrawShapeType>([
  ...DRAFT_ENTITY_CURSOR_SHAPES,
  'point',
])

function usesDraftEntityCursor(shapeType: AreaDrawShapeType): boolean {
  return DRAFT_ENTITY_CURSOR_SHAPES.has(shapeType)
}

function usesSingleClickPlace(shapeType: AreaDrawShapeType): boolean {
  return SINGLE_CLICK_PLACE_SHAPES.has(shapeType)
}

// --- draw overlay ---
// 空域管理仅维护锚点/跟随小圆点（id 前缀 fastx-area-draw-temp-）；几何草稿由各 Draw 类 areaDraft 负责。

const TEMP_PREFIX = 'fastx-area-draw-temp-'

interface SceneAaSnapshot {
  fxaaEnabled: boolean
}

/** 仅切换 FXAA；不在绘制中改 MSAA（运行时改 MSAA 易引发整屏闪烁） */
function pushPreviewAntialias(viewer: Viewer): SceneAaSnapshot {
  const scene = viewer.scene
  const snap: SceneAaSnapshot = {
    fxaaEnabled: scene.postProcessStages.fxaa.enabled,
  }
  scene.postProcessStages.fxaa.enabled = true
  return snap
}

function popPreviewAntialias(viewer: Viewer, snap: SceneAaSnapshot): void {
  if (viewer.isDestroyed()) return
  viewer.scene.postProcessStages.fxaa.enabled = snap.fxaaEnabled
}

function requestSceneRender(viewer: Viewer): void {
  viewer.scene.requestRender()
}

function previewPointOptions(
  color: string,
  pixelSize: number,
  outlineColor: string,
  outlineWidth: number,
): Cesium.PointGraphics.ConstructorOptions {
  return {
    color: colorFromCss(color),
    pixelSize,
    outlineColor: colorFromCss(outlineColor),
    outlineWidth: Math.max(outlineWidth, 2),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 8.0e6, 0.9),
  }
}

type MergedPreviewStyle = Required<
  Pick<
    AreaDrawPreviewStyle,
    'anchorPointColor' | 'anchorPointPixelSize' | 'cursorPointColor' | 'cursorPointPixelSize'
  >
>

const DEFAULT_PREVIEW_STYLE: MergedPreviewStyle = {
  anchorPointColor: '#22cc44',
  anchorPointPixelSize: 8,
  cursorPointColor: '#22cc44',
  cursorPointPixelSize: 10,
}

function mergePreviewStyle(preview?: AreaDrawPreviewStyle): MergedPreviewStyle {
  return { ...DEFAULT_PREVIEW_STYLE, ...preview }
}

function addAnchorMarker(
  viewer: Viewer,
  cartesian: Cartesian3,
  index: number,
  ps: MergedPreviewStyle,
  preview?: AreaDrawPreviewStyle,
): Entity {
  return viewer.entities.add({
    id: `${TEMP_PREFIX}anchor-${index}-${Date.now()}`,
    position: cartesian,
    point: previewPointOptions(
      ps.anchorPointColor,
      ps.anchorPointPixelSize,
      preview?.anchorPointOutlineColor ?? '#ffffff',
      preview?.anchorPointOutlineWidth ?? 2,
    ),
  })
}

function addOrMoveCursorMarker(
  viewer: Viewer,
  cartesian: Cartesian3,
  ps: MergedPreviewStyle,
  preview: AreaDrawPreviewStyle | undefined,
  existing: Entity | null,
): Entity {
  if (existing) {
    existing.position = new Cesium.ConstantPositionProperty(cartesian)
    return existing
  }
  return viewer.entities.add({
    id: `${TEMP_PREFIX}cursor-${Date.now()}`,
    position: cartesian,
    point: previewPointOptions(
      ps.cursorPointColor,
      ps.cursorPointPixelSize,
      preview?.cursorPointOutlineColor ?? '#ffffff',
      preview?.cursorPointOutlineWidth ?? 2,
    ),
  })
}

function removePreviewEntity(viewer: Viewer, entity: Entity | null): void {
  if (entity) viewer.entities.remove(entity)
}

function removeAllOverlayEntities(viewer: Viewer, entities: Entity[]): void {
  for (const e of entities) {
    viewer.entities.remove(e)
  }
}

// --- entity params → collection item ---

function stripDrawMeta(params: AreaDrawDirectParams): Record<string, unknown> {
  const { shapeType: _s, preview: _p, autoFinishOnSecondClick: _a, renderMode: _r, ...rest } = params
  return rest
}

function llhListFromUnknown(positions: unknown): number[][] | null {
  if (!Array.isArray(positions) || positions.length === 0) return null
  return positionsTupleToArray(positions as LngLatHeight[])
}

function toCollectionItem(shapeType: AreaDrawShapeType, params: AreaDrawDirectParams): unknown | null {
  const rest = stripDrawMeta(params)

  switch (shapeType) {
    case 'point':
    case 'label':
    case 'billboard': {
      const positions =
        positionInputToTuple(rest.position as Parameters<typeof positionInputToTuple>[0]) ??
        (Array.isArray(rest.positions) ? (rest.positions as number[]) : null)
      if (!positions || positions.length < 2) return null
      return { ...rest, positions }
    }
    case 'polyline':
    case 'polygon':
    case 'straightArrow':
    case 'fineStraightArrow':
    case 'curveArrow':
    case 'attackDirectionArrow':
    case 'doubleArrow':
    case 'swallowtailAttackArrow':
    case 'pincerArrow':
    case 'corridor':
    case 'wall':
    case 'polylineVolume': {
      const positions = llhListFromUnknown(rest.positions)
      if (!positions) return null
      const item = { ...rest, positions }
      if (shapeType === 'polygon') {
        return {
          ...item,
          opacity: (rest.alpha as number | undefined) ?? (rest.opacity as number | undefined) ?? 0.5,
        }
      }
      return item
    }
    case 'circle': {
      const positions =
        positionInputToTuple(rest.center as Parameters<typeof positionInputToTuple>[0]) ??
        positionInputToTuple(rest.position as Parameters<typeof positionInputToTuple>[0])
      if (!positions || rest.radius == null) return null
      return { ...rest, positions, alpha: rest.alpha }
    }
    case 'rectangle':
      return {
        id: rest.id,
        west: rest.west,
        south: rest.south,
        east: rest.east,
        north: rest.north,
        topHeight: rest.extrudedHeight,
        color: rest.color,
        opacity: rest.alpha,
        show: rest.show,
        targetData: rest.targetData,
        entityData: rest.targetData,
      }
    case 'sector': {
      const center = positionInputToTuple(rest.center as Parameters<typeof positionInputToTuple>[0])
      if (!center || rest.radius == null) return null
      return {
        ...rest,
        center,
        opacity: rest.alpha,
        segments: rest.arcSegments,
        topHeight: rest.extrudedHeight,
        entityData: rest.targetData,
      }
    }
    case 'runway': {
      const positions = llhListFromUnknown(rest.positions)
      if (!positions || positions.length < 2) return null
      return { ...rest, positions, opacity: rest.alpha }
    }
    case 'cylinder': {
      const positions = positionInputToTuple(rest.center as Parameters<typeof positionInputToTuple>[0])
      if (!positions) return null
      return {
        id: rest.id,
        longitude: positions[0],
        latitude: positions[1],
        height: positions[2],
        length: rest.length,
        topRadius: rest.topRadius,
        bottomRadius: rest.bottomRadius,
        color: rest.color,
        opacity: rest.alpha,
        show: rest.show,
        targetData: rest.targetData,
      }
    }
    case 'ellipsoid': {
      const positions = positionInputToTuple(rest.position as Parameters<typeof positionInputToTuple>[0])
      if (!positions) return null
      const r = typeof rest.radii === 'number' ? rest.radii : 10_000
      return {
        ...rest,
        positions,
        radii: [r, r, r] as [number, number, number],
        alpha: rest.alpha,
      }
    }
    case 'box': {
      const positions = positionInputToTuple(rest.position as Parameters<typeof positionInputToTuple>[0])
      if (!positions) return null
      return { ...rest, positions, opacity: rest.alpha }
    }
    case 'plane': {
      const positions = positionInputToTuple(rest.position as Parameters<typeof positionInputToTuple>[0])
      if (!positions) return null
      return { ...rest, positions, opacity: rest.alpha }
    }
    default:
      return null
  }
}

// --- entity / primitive draw dispatch ---

function drawWithEntity(
  viewer: Viewer,
  apis: AreaManagerEntityApis,
  params: AreaDrawDirectParams,
): Entity | undefined {
  if (!viewer || viewer.isDestroyed()) return undefined

  const rest = stripDrawMeta(params)
  const opts = rest as unknown

  switch (params.shapeType) {
    case 'point':
      return apis.point.add(viewer, opts as AddPointOptions)
    case 'label':
      return apis.label.add(viewer, opts as AddLabelOptions)
    case 'billboard':
      return apis.billboard.add(viewer, opts as AddBillboardOptions)
    case 'model':
      return apis.model.add(viewer, opts as AddModelOptions)
    case 'polyline':
      return apis.polyLine.add(viewer, opts as AddPolylineOptions)
    case 'polygon':
      return apis.polygon.add(viewer, opts as AddPolygonOptions)
    case 'straightArrow':
      return apis.straightArrow.add(viewer, opts as AddStraightArrowOptions)
    case 'fineStraightArrow':
      return apis.fineStraightArrow.add(viewer, opts as AddFineStraightArrowOptions)
    case 'curveArrow':
      return apis.curveArrow.add(viewer, opts as AddCurveArrowOptions)
    case 'attackDirectionArrow':
      return apis.attackDirectionArrow.add(viewer, opts as AddAttackDirectionArrowOptions)
    case 'doubleArrow':
      return apis.doubleArrow.add(viewer, opts as AddDoubleArrowOptions)
    case 'swallowtailAttackArrow':
      return apis.swallowtailAttackArrow.add(viewer, opts as AddSwallowtailAttackArrowOptions)
    case 'pincerArrow':
      return apis.pincerArrow.add(viewer, opts as AddPincerArrowOptions)
    case 'rectangle':
      return apis.rectangle.add(viewer, opts as AddRectangleOptions)
    case 'circle':
      return apis.circle.add(viewer, opts as AddCircleOptions)
    case 'sector':
      return apis.sector.add(viewer, opts as AddSectorOptions)
    case 'corridor':
      return apis.corridor.add(viewer, opts as AddCorridorOptions)
    case 'cylinder':
      return apis.cylinder.add(viewer, opts as AddCylinderOptions)
    case 'ellipsoid':
      return apis.ellipsoid.add(viewer, opts as AddEllipsoidOptions)
    case 'wall':
      return apis.wall.add(viewer, opts as AddWallOptions)
    case 'runway':
      return apis.runway.add(viewer, opts as AddRunwayOptions)
    case 'box':
      return apis.box.add(viewer, opts as AddBoxOptions)
    case 'polylineVolume':
      return apis.polylineVolume.add(viewer, opts as AddPolylineVolumeOptions)
    case 'plane':
      return apis.plane.add(viewer, opts as AddPlaneOptions)
    case 'path':
      return apis.path.add(viewer, opts as AddPathOptions)
    default:
      return undefined
  }
}

function firstPrimitiveId(ids: string[], explicitId?: string): string | undefined {
  if (ids.length > 0) return ids[0]
  return explicitId?.trim() || undefined
}

function drawWithPrimitive(
  viewer: Viewer,
  apis: AreaManagerPrimitiveApis,
  params: AreaDrawDirectParams,
): string | undefined {
  if (!viewer || viewer.isDestroyed()) return undefined

  const { shapeType } = params
  const rule = getShapeRule(shapeType)
  if (!rule.supportsPrimitive) {
    console.warn(
      `[AreaManager] shapeType="${shapeType}" 无 Primitive Collection，已忽略 renderMode: 'primitive'`,
    )
    return undefined
  }

  const item = toCollectionItem(shapeType, params)
  if (!item) return undefined

  const id = (params.id as string | undefined)?.trim() || createRandomXgxId('am')
  const withId = { ...(item as object), id }

  switch (shapeType as AreaDrawShapeType) {
    case 'point':
      return firstPrimitiveId(apis.pointCollection.addPoints(viewer, [withId as never]), id)
    case 'label':
      return firstPrimitiveId(apis.labelCollection.addLabels(viewer, [withId as never]), id)
    case 'billboard':
      return firstPrimitiveId(apis.billboardCollection.addBillboards(viewer, [withId as never]), id)
    case 'polyline':
      return firstPrimitiveId(apis.polyLineCollection.addPolylines(viewer, [withId as never]), id)
    case 'polygon':
      return firstPrimitiveId(apis.polygonCollection.addPolygons(viewer, [withId as never]), id)
    case 'straightArrow':
      return firstPrimitiveId(apis.straightArrowCollection.addStraightArrows(viewer, [withId as never]), id)
    case 'fineStraightArrow':
      return firstPrimitiveId(apis.fineStraightArrowCollection.addFineStraightArrows(viewer, [withId as never]), id)
    case 'curveArrow':
      return firstPrimitiveId(apis.curveArrowCollection.addCurveArrows(viewer, [withId as never]), id)
    case 'attackDirectionArrow':
      return firstPrimitiveId(apis.attackDirectionArrowCollection.addAttackDirectionArrows(viewer, [withId as never]), id)
    case 'doubleArrow':
      return firstPrimitiveId(apis.doubleArrowCollection.addDoubleArrows(viewer, [withId as never]), id)
    case 'swallowtailAttackArrow':
      return firstPrimitiveId(apis.swallowtailAttackArrowCollection.addSwallowtailAttackArrows(viewer, [withId as never]), id)
    case 'pincerArrow':
      return firstPrimitiveId(apis.pincerArrowCollection.addPincerArrows(viewer, [withId as never]), id)
    case 'circle':
      return firstPrimitiveId(apis.circleCollection.addCircles(viewer, [withId as never]), id)
    case 'rectangle':
      return firstPrimitiveId(apis.rectangleCollection.addRectangles(viewer, [withId as never]), id)
    case 'sector':
      return firstPrimitiveId(apis.sectorCollection.addSectors(viewer, [withId as never]), id)
    case 'corridor':
      return firstPrimitiveId(apis.corridorCollection.addCorridors(viewer, [withId as never]), id)
    case 'cylinder':
      return firstPrimitiveId(apis.cylinderCollection.addCylinders(viewer, [withId as never]), id)
    case 'ellipsoid':
      return firstPrimitiveId(apis.ellipsoidCollection.addEllipsoids(viewer, [withId as never]), id)
    case 'runway':
      return firstPrimitiveId(apis.runwayCollection.addRunways(viewer, [withId as never]), id)
    case 'box':
      return firstPrimitiveId(apis.boxCollection.addBoxes(viewer, [withId as never]), id)
    case 'polylineVolume':
      return firstPrimitiveId(apis.polylineVolumeCollection.addPolylineVolumes(viewer, [withId as never]), id)
    case 'plane':
      return firstPrimitiveId(apis.planeCollection.addPlanes(viewer, [withId as never]), id)
    default:
      return undefined
  }
}

// --- AreaManager ---

function createDefaultDrawApis(): AreaManagerDrawApis {
  return {
    point: new Point(),
    pointCollection: new PointCollection(),
    label: new Label(),
    labelCollection: new LabelCollection(),
    billboard: new Billboard(),
    billboardCollection: new BillboardCollection(),
    model: new Model(),
    modelCollection: new ModelCollection(),
    polyLine: new PolyLine(),
    polyLineCollection: new PolyLineCollection(),
    polygon: new Polygon(),
    polygonCollection: new PolygonCollection(),
    straightArrow: new StraightArrow(),
    straightArrowCollection: new StraightArrowCollection(),
    fineStraightArrow: new FineStraightArrow(),
    fineStraightArrowCollection: new FineStraightArrowCollection(),
    curveArrow: new CurveArrow(),
    curveArrowCollection: new CurveArrowCollection(),
    attackDirectionArrow: new AttackDirectionArrow(),
    attackDirectionArrowCollection: new AttackDirectionArrowCollection(),
    doubleArrow: new DoubleArrow(),
    doubleArrowCollection: new DoubleArrowCollection(),
    swallowtailAttackArrow: new SwallowtailAttackArrow(),
    swallowtailAttackArrowCollection: new SwallowtailAttackArrowCollection(),
    pincerArrow: new PincerArrow(),
    pincerArrowCollection: new PincerArrowCollection(),
    circle: new Circle(),
    circleCollection: new CircleCollection(),
    rectangle: new Rectangle(),
    rectangleCollection: new RectangleCollection(),
    sector: new Sector(),
    sectorCollection: new SectorCollection(),
    corridor: new Corridor(),
    corridorCollection: new CorridorCollection(),
    cylinder: new Cylinder(),
    cylinderCollection: new CylinderCollection(),
    ellipsoid: new Ellipsoid(),
    ellipsoidCollection: new EllipsoidCollection(),
    wall: new Wall(),
    runway: new Runway(),
    runwayCollection: new RunwayCollection(),
    box: new Box(),
    boxCollection: new BoxCollection(),
    polylineVolume: new PolylineVolume(),
    polylineVolumeCollection: new PolylineVolumeCollection(),
    plane: new Plane(),
    planeCollection: new PlaneCollection(),
    path: new Path(),
  }
}

function resolveDrawRenderMode(params: AreaDrawDirectParams): AreaDrawRenderMode {
  return params.renderMode ?? 'entity'
}

function pickCartesianAt(viewer: Viewer, db: Cesium.Cartesian2): Cartesian3 | null {
  const hit = screenDrawingBufferToWorldCartesian3(viewer, db)
  return hit ? Cesium.Cartesian3.clone(hit) : null
}

/** 绘制期禁用拖拽类相机操作，保留滚轮/双指缩放 */
function suspendCameraDragInputs(
  controller: Cesium.ScreenSpaceCameraController,
): () => void {
  const snap = {
    zoomEventTypes: controller.zoomEventTypes,
    rotateEventTypes: controller.rotateEventTypes,
    tiltEventTypes: controller.tiltEventTypes,
    translateEventTypes: controller.translateEventTypes,
    lookEventTypes: controller.lookEventTypes,
  }
  controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH]
  controller.rotateEventTypes = undefined
  controller.translateEventTypes = undefined
  controller.lookEventTypes = undefined
  // 绘制期保留中键拖拽（倾斜），仅关闭左键旋转与右键拖拽缩放
  controller.tiltEventTypes = Cesium.CameraEventType.MIDDLE_DRAG
  return () => {
    controller.zoomEventTypes = snap.zoomEventTypes
    controller.rotateEventTypes = snap.rotateEventTypes
    controller.tiltEventTypes = snap.tiltEventTypes
    controller.translateEventTypes = snap.translateEventTypes
    controller.lookEventTypes = snap.lookEventTypes
  }
}

export default class AreaManager {
  private readonly apis: AreaManagerDrawApis

  private viewer: Viewer | null = null
  private isDrawing = false
  private currentParams: AreaDrawStartParams | null = null
  private previewStyle: MergedPreviewStyle = mergePreviewStyle()
  private publishCallback: AreaDrawPublishCallback | null = null

  private collectedPoints: Cartesian3[] = []
  private tempAnchorEntities: Entity[] = []
  private tempCursorEntity: Entity | null = null
  /** start 时保存的场景抗锯齿状态，resetSession 时恢复 */
  private previewAaSnapshot: SceneAaSnapshot | null = null

  /** 空域草稿：各 Draw 单类 `add(areaDraft)`，finish 提交 / cancel remove */
  private draftId: string | null = null
  private draftEntityCreated = false
  private drawInputDispose: (() => void) | null = null
  private drawFinishGuard = false

  constructor(options?: AreaManagerOptions) {
    this.apis = { ...createDefaultDrawApis(), ...options }
  }

  getDrawApis(): Readonly<AreaManagerDrawApis> {
    return this.apis
  }

  publish(callback: AreaDrawPublishCallback): void {
    this.publishCallback = callback
  }

  unpublish(): void {
    this.publishCallback = null
  }

  start(viewer: Viewer, params: AreaDrawStartParams): boolean {
    if (this.isDrawing) return false
    if (!viewer || viewer.isDestroyed()) return false

    if (!getShapeRule(params.shapeType).interactive) return false

    this.viewer = viewer
    this.isDrawing = true
    this.currentParams = { ...params }
    this.previewStyle = mergePreviewStyle(params.preview)
    this.collectedPoints = []
    this.draftId = null
    this.draftEntityCreated = false
    if (supportsClassDraft(params.shapeType)) {
      this.draftId = newDraftId(params.shapeType, params.id)
    }
    this.clearPreviewOverlay()
    if (params.preview?.antialias !== false) {
      this.previewAaSnapshot = pushPreviewAntialias(viewer)
    }
    this.registerMouseEvents()
    return true
  }

  /**
   * 数据回显绘制（非鼠标交互）。按数据量通过 `renderMode` 选择 Entity 或 Primitive 批量渲染。
   * @param params.renderMode `'entity'`（默认）| `'primitive'`
   */
  draw(viewer: Viewer, params: AreaDrawDirectParams): AreaDrawOutput | undefined {
    const renderMode = resolveDrawRenderMode(params)
    const rule = getShapeRule(params.shapeType)

    if (renderMode === 'primitive') {
      if (!rule.supportsPrimitive) {
        console.warn(`[AreaManager] "${params.shapeType}" 无 Collection，回退 entity`)
        const entity = drawWithEntity(viewer, this.apis, { ...params, renderMode: 'entity' })
        if (!entity) return undefined
        return { id: entity.id, renderMode: 'entity', entity }
      }
      const id = drawWithPrimitive(viewer, this.apis, params)
      if (!id) return undefined
      return { id, renderMode: 'primitive' }
    }

    const entity = drawWithEntity(viewer, this.apis, params)
    if (!entity) return undefined
    return { id: entity.id, renderMode: 'entity', entity }
  }

  end(): void {
    if (!this.isDrawing) return
    if (this.canFinish()) this.finishDraw()
    else this.cancel()
  }

  cancel(): void {
    if (!this.isDrawing) return
    this.resetSession()
  }

  clearEvents(): void {
    this.unregisterMouseEvents()
  }

  get active(): boolean {
    return this.isDrawing
  }

  get pointCount(): number {
    return this.collectedPoints.length
  }

  get shapeType(): AreaDrawShapeType | null {
    return this.currentParams?.shapeType ?? null
  }

  /**
   * 绘制期在 `scene.canvas` 上新建独立 `ScreenSpaceEventHandler`（与 tszx-ui `MouseHandler` 一致）。
   * 勿挂到 `viewer.screenSpaceEventHandler`：其与相机 `CameraEventAggregator` 的 handler 并存时右键结束不可靠。
   */
  private registerMouseEvents(): void {
    if (!this.viewer) return
    this.unregisterMouseEvents()

    const viewer = this.viewer
    const canvas = viewer.scene.canvas
    const restoreCamera = suspendCameraDragInputs(viewer.scene.screenSpaceCameraController)
    const handler = new Cesium.ScreenSpaceEventHandler(canvas)

    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const cartesian = pickCartesianAt(viewer, e.position)
      if (cartesian) this.onDrawLeftClick(cartesian)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!this.isDrawing) return
      const cartesian = pickCartesianAt(viewer, e.endPosition)
      if (cartesian) this.updatePreview(cartesian)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => this.handleDrawFinish(), Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    const blockBrowserMenu = (e: Event) => e.preventDefault()
    canvas.addEventListener('contextmenu', blockBrowserMenu, { capture: true })

    this.drawInputDispose = () => {
      canvas.removeEventListener('contextmenu', blockBrowserMenu, { capture: true })
      if (!handler.isDestroyed()) handler.destroy()
      if (!viewer.isDestroyed()) restoreCamera()
    }
  }

  private unregisterMouseEvents(): void {
    this.drawInputDispose?.()
    this.drawInputDispose = null
  }

  /** 预览光标与草稿几何使用同一顶点（避免经纬度往返偏移） */
  private resolveDrawCursor(cartesian: Cartesian3): Cartesian3 {
    if (!this.currentParams) return cartesian
    const shape = this.currentParams.shapeType
    const anchors = this.collectedPoints
    if (shape === 'sector' && anchors.length >= 2) {
      return snapSectorDraftCursor(anchors, cartesian)
    }
    if (
      (shape === 'circle' || shape === 'cylinder' || shape === 'ellipsoid') &&
      anchors.length >= 1
    ) {
      return snapRadialDraftCursor(anchors, cartesian)
    }
    const polyFamily =
      shape === 'polyline' ||
      shape === 'corridor' ||
      shape === 'wall' ||
      shape === 'polylineVolume'
    if (polyFamily && anchors.length >= 1) {
      return Cesium.Cartesian3.clone(cartesian)
    }
    return cartesian
  }

  private onDrawLeftClick(cartesian: Cartesian3): void {
    if (!this.currentParams) return

    const { shapeType } = this.currentParams
    const rule = getShapeRule(shapeType)

    if (shapeType === 'sector' && this.collectedPoints.length === 2) {
      cartesian = snapSectorDraftCursor(this.collectedPoints, cartesian)
    } else if (
      (shapeType === 'circle' || shapeType === 'cylinder' || shapeType === 'ellipsoid') &&
      this.collectedPoints.length >= 1
    ) {
      cartesian = snapRadialDraftCursor(this.collectedPoints, cartesian)
    }

    if (rule.mode === 'single') {
      if (usesSingleClickPlace(shapeType)) {
        this.collectedPoints = [cartesian]
        this.finishDraw()
      } else {
        if (this.collectedPoints.length === 0) {
          this.addAnchorPoint(cartesian)
          this.updatePreview(cartesian)
        }
      }
      return
    }

    this.addAnchorPoint(cartesian)
    this.updatePreview(cartesian)

    const autoSecond = this.currentParams.autoFinishOnSecondClick !== false
    if (autoSecond && usesMultiClickAutoFinish(shapeType) && this.collectedPoints.length >= rule.minPoints) {
      this.finishDraw()
    }
  }

  private notifyAnchorChange(cursor?: Cartesian3): void {
    const cb = this.currentParams?.onAnchorChange
    if (!cb) return
    const anchorCount = this.collectedPoints.length
    const points = this.collectedPoints.map((p) => cartesianToLngLat(p))
    if (cursor) points.push(cartesianToLngLat(cursor))
    cb(points, anchorCount)
  }

  private addAnchorPoint(cartesian: Cartesian3): void {
    if (!this.viewer) return
    this.collectedPoints.push(cartesian)
    const entity = addAnchorMarker(
      this.viewer,
      cartesian,
      this.collectedPoints.length,
      this.previewStyle,
      this.currentParams?.preview,
    )
    this.tempAnchorEntities.push(entity)
    this.notifyAnchorChange()
  }

  private syncShapeDraft(current: Cartesian3): void {
    if (!this.viewer || !this.draftId || !this.currentParams) return
    const shape = this.currentParams.shapeType
    if (!supportsClassDraft(shape)) return

    const ops = resolveDraftOps(shape, this.apis)
    if (!ops) return

    const opts = buildShapeDrawOptions(shape, this.collectedPoints, current, this.currentParams, true)
    if (!opts) return
    opts.id = this.draftId

    if (!this.draftEntityCreated) {
      const entity = ops.add(this.viewer, opts)
      if (entity) this.draftEntityCreated = true
    } else {
      ops.update(this.draftId, opts)
    }

    if (this.viewer.scene.requestRenderMode) requestSceneRender(this.viewer)
  }

  private abandonShapeDraft(): void {
    if (!this.draftId || !this.draftEntityCreated || !this.currentParams) return
    const ops = resolveDraftOps(this.currentParams.shapeType, this.apis)
    if (!ops) return
    const td = ops.getTargetData(this.draftId)
    if (isDraftTargetData(td)) ops.remove(this.draftId)
    this.draftId = null
    this.draftEntityCreated = false
  }

  private updatePreview(current: Cartesian3): void {
    if (!this.viewer || !this.currentParams) return

    const shape = this.currentParams.shapeType
    const draftEntityCursor = usesDraftEntityCursor(shape)
    const drawCursor = this.resolveDrawCursor(current)

    if (!draftEntityCursor) {
      this.tempCursorEntity = addOrMoveCursorMarker(
        this.viewer,
        drawCursor,
        this.previewStyle,
        this.currentParams.preview,
        this.tempCursorEntity,
      )
    } else if (this.tempCursorEntity) {
      removePreviewEntity(this.viewer, this.tempCursorEntity)
      this.tempCursorEntity = null
    }

    if (getShapeRule(shape).mode === 'single' && !draftEntityCursor) {
      if (supportsClassDraft(shape)) {
        this.syncShapeDraft(drawCursor)
      }
      return
    }

    if (supportsClassDraft(shape)) {
      this.syncShapeDraft(drawCursor)
      if (shape === 'circle' || shape === 'sector' || shape === 'cylinder' || shape === 'ellipsoid') {
        this.notifyAnchorChange(drawCursor)
      }
    }

    if (this.viewer.scene.requestRenderMode) {
      requestSceneRender(this.viewer)
    }
  }

  private canFinish(): boolean {
    if (!this.currentParams) return false
    return this.collectedPoints.length >= getShapeRule(this.currentParams.shapeType).minPoints
  }

  /** 右键结束：顶点不足时仅提示，不取消绘制 */
  private handleDrawFinish(): void {
    if (!this.isDrawing || this.drawFinishGuard) return
    if (!this.canFinish()) return
    this.drawFinishGuard = true
    try {
      this.finishDraw()
    } finally {
      this.drawFinishGuard = false
    }
  }

  private finishDraw(): void {
    if (!this.viewer || !this.currentParams || !this.canFinish()) {
      this.cancel()
      return
    }

    const shape = this.currentParams.shapeType
    if (!this.draftId || !supportsClassDraft(shape)) {
      this.cancel()
      return
    }

    const ops = resolveDraftOps(shape, this.apis)
    if (!ops) {
      this.cancel()
      return
    }

    let commitOpts = buildCommitOptions(shape, this.collectedPoints, this.currentParams)
    if (!commitOpts) {
      this.cancel()
      return
    }
    commitOpts = { ...commitOpts, id: this.draftId, areaDraft: false }

    if (!this.draftEntityCreated) {
      const bootstrap = buildShapeDrawOptions(
        shape,
        this.collectedPoints,
        null,
        this.currentParams,
        true,
      )
      if (!bootstrap) {
        this.cancel()
        return
      }
      bootstrap.id = this.draftId
      const created = ops.add(this.viewer, bootstrap)
      if (!created) {
        this.cancel()
        return
      }
      this.draftEntityCreated = true
    }

    const ok = ops.update(this.draftId, commitOpts)
    if (!ok) {
      this.cancel()
      return
    }
    const entity = ops.getEntity(this.draftId)
    if (!entity) {
      this.cancel()
      return
    }
    const committedId = this.draftId
    this.draftId = null
    this.draftEntityCreated = false
    this.emitResult({ id: committedId, renderMode: 'entity', entity })
    this.resetSession()
  }

  private emitResult(output: AreaDrawOutput | undefined): void {
    if (!output || !this.currentParams || !this.publishCallback) return
    this.publishCallback({
      id: output.id,
      shapeType: this.currentParams.shapeType,
      renderMode: output.renderMode,
      entity: output.entity,
    })
  }

  private resetSession(): void {
    const onAnchor = this.currentParams?.onAnchorChange
    const v = this.viewer
    const aaSnap = this.previewAaSnapshot
    this.abandonShapeDraft()
    this.drawFinishGuard = false
    this.isDrawing = false
    this.currentParams = null
    this.collectedPoints = []
    this.clearPreviewOverlay()
    this.unregisterMouseEvents()
    if (v && !v.isDestroyed() && aaSnap) popPreviewAntialias(v, aaSnap)
    this.previewAaSnapshot = null
    this.viewer = null
    onAnchor?.([])
  }

  private clearPreviewOverlay(): void {
    if (!this.viewer) return
    removeAllOverlayEntities(this.viewer, this.tempAnchorEntities)
    this.tempAnchorEntities = []
    removePreviewEntity(this.viewer, this.tempCursorEntity)
    this.tempCursorEntity = null
  }
}
