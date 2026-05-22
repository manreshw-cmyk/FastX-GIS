import type { Viewer } from 'cesium'
import { registerCesiumXVueComponents } from './components'
import { Coordinates } from './Coordinates'
import { Layer } from './Layer'
import { MouseEvent } from './MouseEvent'
import Point from './Draw/Point'
import PointCollection from './Draw/Point/PointCollection'
import Label from './Draw/Label'
import LabelCollection from './Draw/Label/LabelCollection'
import PolyLine from './Draw/PolyLine'
import PolyLineCollection from './Draw/PolyLine/PolyLineCollection'
import Circle from './Draw/Circle'
import CircleCollection from './Draw/Circle/CircleCollection'
import Polygon from './Draw/Polygon'
import PolygonCollection from './Draw/Polygon/PolygonCollection'
import Sector from './Draw/Sector'
import SectorCollection from './Draw/Sector/SectorCollection'
import Rectangle from './Draw/Rectangle'
import RectangleCollection from './Draw/Rectangle/RectangleCollection'
import Cylinder from './Draw/Cylinder'
import CylinderCollection from './Draw/Cylinder/CylinderCollection'
import Corridor from './Draw/Corridor'
import CorridorCollection from './Draw/Corridor/CorridorCollection'
import Runway from './Draw/Runway'
import RunwayCollection from './Draw/Runway/RunwayCollection'
import Ellipsoid from './Draw/Ellipsoid'
import EllipsoidCollection from './Draw/Ellipsoid/EllipsoidCollection'
import Wall from './Draw/Wall'
import Billboard from './Draw/Billboard'
import BillboardCollection from './Draw/Billboard/BillboardCollection'
import Model from './Draw/Model'
import ModelCollection from './Draw/Model/ModelCollection'
import Box from './Draw/Box'
import BoxCollection from './Draw/Box/BoxCollection'
import PolylineVolume from './Draw/PolylineVolume'
import PolylineVolumeCollection from './Draw/PolylineVolume/PolylineVolumeCollection'
import Plane from './Draw/Plane'
import PlaneCollection from './Draw/Plane/PlaneCollection'
import Path from './Draw/Path'

export { Trajectory, Mover } from './Trajectory'
export {
  DEFAULT_PLAY_SPAN_SEC,
  ZERO_HMS,
  formatHmsFromSeconds,
  formatHmsFromJulianDelta,
  nowMs,
  defaultPlayEndMs,
  msToJulian,
  julianToMs,
  msFromIso,
  resolvePlayClockWindowFromMs,
  validatePlayClockRange,
  syncViewerClock,
} from './Utils'
export type { PlayClockWindow } from './Utils'
export type {
  TrajectoryKeyframe,
  TrajectoryLngLatKeyframe,
  TrajectoryOptions,
  MoverCallbacks,
  MoverOptions,
} from './Trajectory'

export { Layer, Coordinates, MouseEvent, registerCesiumXVueComponents }
export { createRandomXgxId } from './Coordinates'
export { default as Point } from './Draw/Point'
export { default as PointCollection } from './Draw/Point/PointCollection'
export { default as Label } from './Draw/Label'
export { default as LabelCollection } from './Draw/Label/LabelCollection'
export { default as PolyLine } from './Draw/PolyLine'
export { default as PolyLineCollection } from './Draw/PolyLine/PolyLineCollection'
export { default as Circle } from './Draw/Circle'
export { default as CircleCollection } from './Draw/Circle/CircleCollection'
export { default as Polygon } from './Draw/Polygon'
export { default as PolygonCollection } from './Draw/Polygon/PolygonCollection'
export { default as Sector } from './Draw/Sector'
export { default as SectorCollection } from './Draw/Sector/SectorCollection'
export { default as Rectangle } from './Draw/Rectangle'
export { default as RectangleCollection } from './Draw/Rectangle/RectangleCollection'
export { default as Cylinder } from './Draw/Cylinder'
export { default as CylinderCollection } from './Draw/Cylinder/CylinderCollection'
export { default as Corridor } from './Draw/Corridor'
export { default as CorridorCollection } from './Draw/Corridor/CorridorCollection'
export { default as Runway } from './Draw/Runway'
export { default as RunwayCollection } from './Draw/Runway/RunwayCollection'
export { default as Ellipsoid } from './Draw/Ellipsoid'
export { default as EllipsoidCollection } from './Draw/Ellipsoid/EllipsoidCollection'
export { default as Wall } from './Draw/Wall'
export { default as Billboard } from './Draw/Billboard'
export { default as BillboardCollection } from './Draw/Billboard/BillboardCollection'
export { default as Model } from './Draw/Model'
export { default as ModelCollection } from './Draw/Model/ModelCollection'
export { default as Box } from './Draw/Box'
export { default as BoxCollection } from './Draw/Box/BoxCollection'
export { default as PolylineVolume } from './Draw/PolylineVolume'
export { default as PolylineVolumeCollection } from './Draw/PolylineVolume/PolylineVolumeCollection'
export { defaultShapeParamsForType, parseShapeTypeKey } from './Draw/PolylineVolume'
export { default as Plane } from './Draw/Plane'
export { default as PlaneCollection } from './Draw/Plane/PlaneCollection'
export { default as Path } from './Draw/Path'
export {
  PlaneMaterialType,
  DEFAULT_PLANE_VIDEO,
  normalizePlaneVideoOptions,
} from './Draw/Plane'
export type {
  PointCollectionAddItem,
  PointCollectionSnapshot,
  PointCollectionUpdateEntry,
  PointCollectionUpdateProps,
} from './Draw/Point/PointCollection'
export type {
  LabelCollectionAddItem,
  LabelCollectionSnapshot,
  LabelCollectionUpdateEntry,
  LabelCollectionUpdateProps,
} from './Draw/Label/LabelCollection'
export type { CoordinatesApi } from './Coordinates'
export type { MouseEventListenOptions, MouseEventPickPayload, MouseEventPickedEntity } from './MouseEvent'
export type * from './Layer/types'
export type { XMapConfig } from './components/x-map.types'
export type {
  AddPointOptions,
  PointPositionInput,
  PointPositionsTuple,
  PointSnapshot,
  PointStyleOptions,
  UpdatePointProperties,
} from './Draw/Point'
export type {
  AddLabelOptions,
  LabelPositionsTuple,
  LabelSnapshot,
  LabelStyleOptions,
  UpdateLabelProperties,
} from './Draw/Label'
export type {
  AddPolylineOptions,
  ArrowPlacementType,
  ArrowPolylineParams,
  DashedPolylineParams,
  FlowingPolylineParams,
  GlowingPolylineParams,
  GradientPolylineParams,
  OutlinePolylineParams,
  PolylineClampToGroundFlag,
  PolylineGeometryMode,
  PolylineLineKind,
  PolylineLngLatTuple,
  PolylineSnapshot,
  PolylineStyleOptions,
  UpdatePolylineProperties,
  VolumeBlockParams,
  VolumeTubeParams,
  WallParams,
} from './Draw/PolyLine'
export { resolvePolylineCartesians } from './Draw/PolyLine'
export { PolylineMaterialType } from './Draw/PolyLine/PolyLineCollection'
export type {
  PolyLineCollectionAddItem,
  PolyLineCollectionSnapshot,
  PolyLineCollectionUpdateEntry,
  PolyLineCollectionUpdateMaterialProps,
  PolyLineCollectionUpdateProps,
  PolylineMaterialTypeValue,
} from './Draw/PolyLine/PolyLineCollection'
export type {
  AddCircleOptions,
  CircleCenterInput,
  CircleCenterTuple,
  CircleSnapshot,
  CircleStyleOptions,
  UpdateCircleProperties,
} from './Draw/Circle'
export type {
  CircleCollectionAddItem,
  CircleCollectionSnapshot,
  CircleCollectionUpdateEntry,
  CircleCollectionUpdateOptions,
} from './Draw/Circle'
export type {
  AddPolygonOptions,
  PolygonLngLatTuple,
  PolygonSnapshot,
  PolygonStyleOptions,
  PolygonVertexInput,
  UpdatePolygonProperties,
} from './Draw/Polygon'
export type {
  PolygonCollectionAddItem,
  PolygonCollectionEntry,
  PolygonCollectionSnapshot,
  PolygonCollectionStoredData,
} from './Draw/Polygon/PolygonCollection'
export type {
  AddSectorOptions,
  SectorSnapshot,
  SectorStyleOptions,
  UpdateSectorProperties,
} from './Draw/Sector'
export type {
  SectorCollectionAddItem,
  SectorCollectionEntry,
  SectorCollectionSnapshot,
  SectorCollectionStoredData,
} from './Draw/Sector/SectorCollection'
export type {
  AddRectangleOptions,
  RectangleSnapshot,
  RectangleStyleOptions,
  UpdateRectangleProperties,
} from './Draw/Rectangle'
export type {
  RectangleCollectionAddItem,
  RectangleCollectionEntry,
  RectangleCollectionSnapshot,
  RectangleCollectionStoredData,
} from './Draw/Rectangle/RectangleCollection'
export type {
  AddCylinderOptions,
  CylinderCenterInput,
  CylinderCenterTuple,
  CylinderSnapshot,
  CylinderStyleOptions,
  UpdateCylinderProperties,
} from './Draw/Cylinder'
export type {
  CylinderCollectionAddItem,
  CylinderCollectionEntry,
  CylinderCollectionSnapshot,
  CylinderCollectionStoredData,
} from './Draw/Cylinder/CylinderCollection'
export type {
  AddCorridorOptions,
  CorridorLngLatTuple,
  CorridorSnapshot,
  CorridorStyleOptions,
  CorridorVertexInput,
  UpdateCorridorProperties,
} from './Draw/Corridor'
export type {
  CorridorCollectionAddItem,
  CorridorCollectionEntry,
  CorridorCollectionSnapshot,
  CorridorCollectionStoredData,
  CorridorCollectionUpdateEntry,
  CorridorCollectionUpdateProps,
} from './Draw/Corridor/CorridorCollection'
export type {
  AddRunwayOptions,
  RunwayFlowBandStyle,
  RunwayFlowStAxis,
  RunwayLngLatTuple,
  RunwayMaterialMode,
  RunwaySnapshot,
  RunwayStyleOptions,
  RunwayVertexInput,
  UpdateRunwayProperties,
} from './Draw/Runway'
export type {
  RunwayCollectionAddItem,
  RunwayCollectionEntry,
  RunwayCollectionSnapshot,
  RunwayCollectionStoredData,
  RunwayCollectionUpdateEntry,
  RunwayCollectionUpdateProps,
} from './Draw/Runway/RunwayCollection'
export type {
  AddEllipsoidOptions,
  EllipsoidSnapshot,
  EllipsoidStyleOptions,
  PositionInput,
  UpdateEllipsoidProperties,
} from './Draw/Ellipsoid'
export type {
  EllipsoidCollectionAddItem,
  EllipsoidCollectionSnapshot,
  EllipsoidCollectionUpdateEntry,
  EllipsoidCollectionUpdateProps,
} from './Draw/Ellipsoid/EllipsoidCollection'
export type {
  AddWallOptions,
  ColorStop,
  GradientMaterialOptions,
  ImageMaterialOptions,
  MaterialType,
  Position3D,
  UpdateWallProperties,
  WallPosition,
  WallSnapshot,
  WallStyleOptions,
} from './Draw/Wall'
export type {
  AddBillboardOptions,
  BillboardPositionsTuple,
  BillboardSnapshot,
  BillboardStyleOptions,
  UpdateBillboardProperties,
} from './Draw/Billboard'
export type {
  BillboardCollectionAddItem,
  BillboardCollectionSnapshot,
  BillboardCollectionUpdateEntry,
  BillboardCollectionUpdateProps,
} from './Draw/Billboard/BillboardCollection'
export type {
  AddModelOptions,
  ModelPositionsTuple,
  ModelSnapshot,
  ModelStyleOptions,
  UpdateModelProperties,
} from './Draw/Model'
export type {
  ModelCollectionAddItem,
  ModelCollectionOrientationDegrees,
  ModelCollectionSnapshot,
  ModelCollectionUpdateEntry,
  ModelCollectionUpdateProps,
} from './Draw/Model/ModelCollection'
export { computeModelCollectionModelMatrix } from './Draw/Model/ModelCollection'
export type {
  AddBoxOptions,
  BoxDimensionsInput,
  BoxSnapshot,
  BoxStyleOptions,
  BoxPositionsTuple,
  UpdateBoxProperties,
} from './Draw/Box'
export type {
  BoxCollectionAddItem,
  BoxCollectionSnapshot,
  BoxCollectionUpdateEntry,
  BoxCollectionUpdateProps,
} from './Draw/Box/BoxCollection'
export type {
  AddPolylineVolumeOptions,
  PolylineVolumeLngLatTuple,
  PolylineVolumeSnapshot,
  PolylineVolumeStyleOptions,
  UpdatePolylineVolumeProperties,
} from './Draw/PolylineVolume'
export type {
  PolylineVolumeCollectionAddItem,
  PolylineVolumeCollectionSnapshot,
  PolylineVolumeCollectionUpdateEntry,
  PolylineVolumeCollectionUpdateProps,
} from './Draw/PolylineVolume/PolylineVolumeCollection'
export type {
  AddPlaneOptions,
  PlaneCenterInput,
  PlaneMaterialTypeValue,
  PlanePositionsTuple,
  PlaneSnapshot,
  PlaneStyleOptions,
  PlaneVideoOptions,
  LegacyPlaneVideoOptions,
  UpdatePlaneProperties,
} from './Draw/Plane'
export type {
  PlaneCollectionAddItem,
  PlaneCollectionSnapshot,
  PlaneCollectionUpdateEntry,
  PlaneCollectionUpdateProps,
} from './Draw/Plane/PlaneCollection'
export type {
  AddPathOptions,
  PathSnapshot,
  PathStyleOptions,
  UpdatePathProperties,
} from './Draw/Path'

const pointApi = new Point()
const pointCollectionApi = new PointCollection()
const labelApi = new Label()
const labelCollectionApi = new LabelCollection()
const polyLineApi = new PolyLine()
const polyLineCollectionApi = new PolyLineCollection()
const circleApi = new Circle()
const circleCollectionApi = new CircleCollection()
const polygonApi = new Polygon()
const polygonCollectionApi = new PolygonCollection()
const sectorApi = new Sector()
const sectorCollectionApi = new SectorCollection()
const rectangleApi = new Rectangle()
const rectangleCollectionApi = new RectangleCollection()
const cylinderApi = new Cylinder()
const cylinderCollectionApi = new CylinderCollection()
const corridorApi = new Corridor()
const corridorCollectionApi = new CorridorCollection()
const runwayApi = new Runway()
const runwayCollectionApi = new RunwayCollection()
const ellipsoidApi = new Ellipsoid()
const ellipsoidCollectionApi = new EllipsoidCollection()
const wallApi = new Wall()
const billboardApi = new Billboard()
const billboardCollectionApi = new BillboardCollection()
const modelApi = new Model()
const modelCollectionApi = new ModelCollection()
const boxApi = new Box()
const boxCollectionApi = new BoxCollection()
const polylineVolumeApi = new PolylineVolume()
const polylineVolumeCollectionApi = new PolylineVolumeCollection()
const planeApi = new Plane()
const planeCollectionApi = new PlaneCollection()
const pathApi = new Path()

function resolveMapLayer(mapName?: string): Layer | null {
  const key = mapName?.trim()
  if (key) return Layer.getLayerByMapName(key) ?? null
  const names = Layer.getRegisteredMapNames()
  if (names.length === 1) return Layer.getLayerByMapName(names[0]!) ?? null
  return null
}

/**
 * 全局统一入口：运行时在 `main.ts` 中 `installXGXToWindow()` 后可通过 `window.FastX` 访问。
 * 各 `Draw/*` 为单例实例，复用内部 Map 与 Entity 引用。
 */
export const FastX = {
  Coordinates,
  Layer,
  MouseEvent,
  Point: pointApi,
  PointCollection: pointCollectionApi,
  Label: labelApi,
  LabelCollection: labelCollectionApi,
  PolyLine: polyLineApi,
  PolyLineCollection: polyLineCollectionApi,
  Circle: circleApi,
  CircleCollection: circleCollectionApi,
  Polygon: polygonApi,
  PolygonCollection: polygonCollectionApi,
  Sector: sectorApi,
  SectorCollection: sectorCollectionApi,
  Rectangle: rectangleApi,
  RectangleCollection: rectangleCollectionApi,
  Cylinder: cylinderApi,
  CylinderCollection: cylinderCollectionApi,
  Corridor: corridorApi,
  CorridorCollection: corridorCollectionApi,
  Runway: runwayApi,
  RunwayCollection: runwayCollectionApi,
  Ellipsoid: ellipsoidApi,
  EllipsoidCollection: ellipsoidCollectionApi,
  Wall: wallApi,
  Billboard: billboardApi,
  BillboardCollection: billboardCollectionApi,
  Model: modelApi,
  ModelCollection: modelCollectionApi,
  Box: boxApi,
  BoxCollection: boxCollectionApi,
  PolylineVolume: polylineVolumeApi,
  PolylineVolumeCollection: polylineVolumeCollectionApi,
  Plane: planeApi,
  PlaneCollection: planeCollectionApi,
  Path: pathApi,
  registerCesiumXVueComponents,
  /** 获取已按 `mapName` 注册的 `Layer`；未传名且仅有一个注册实例时返回该实例 */
  getLayer(mapName?: string): Layer | null {
    return resolveMapLayer(mapName)
  },
  getViewer(mapName?: string): Viewer | null {
    return resolveMapLayer(mapName)?.getViewer() ?? null
  },
  getMapName(mapName?: string): string | undefined {
    return resolveMapLayer(mapName)?.getMapName()
  },
  getRegisteredMapNames(): readonly string[] {
    return Layer.getRegisteredMapNames()
  },
} as const

export type XGXGlobal = typeof FastX

export function installXGXToWindow(): void {
  if (typeof window === 'undefined') return
  ;(window as Window & { FastX: XGXGlobal }).FastX = FastX
}
