/**
 * FastX 全部 interface 唯一定义处；新增 interface 请按下方模块注释块添加。
 * 使用：`import type { PointSnapshot } from '@/FastX'` 或 `import type { PointSnapshot } from '@/FastX/Types'`。
 * 运行时：`window.FastX.Types` 为占位对象（interface 仅编译期存在）。
 */

import type {
  Camera,
  Cartesian3,
  CesiumTerrainProvider,
  Color,
  GridImageryProvider,
  JulianDate,
  MaterialProperty,
  Primitive,
  UrlTemplateImageryProvider,
  Viewer,
} from 'cesium'
import type * as Cesium from 'cesium'
import type { ShapeParams, ShapeType } from '../Draw/PolylineVolume/shape'
import type Point from '../Draw/Point'
import type PointCollection from '../Draw/Point/PointCollection'
import type Label from '../Draw/Label'
import type LabelCollection from '../Draw/Label/LabelCollection'
import type Billboard from '../Draw/Billboard'
import type BillboardCollection from '../Draw/Billboard/BillboardCollection'
import type Model from '../Draw/Model'
import type ModelCollection from '../Draw/Model/ModelCollection'
import type PolyLine from '../Draw/PolyLine'
import type PolyLineCollection from '../Draw/PolyLine/PolyLineCollection'
import type Polygon from '../Draw/Polygon'
import type PolygonCollection from '../Draw/Polygon/PolygonCollection'
import type Circle from '../Draw/Circle'
import type CircleCollection from '../Draw/Circle/CircleCollection'
import type Rectangle from '../Draw/Rectangle'
import type RectangleCollection from '../Draw/Rectangle/RectangleCollection'
import type Sector from '../Draw/Sector'
import type SectorCollection from '../Draw/Sector/SectorCollection'
import type Corridor from '../Draw/Corridor'
import type CorridorCollection from '../Draw/Corridor/CorridorCollection'
import type Cylinder from '../Draw/Cylinder'
import type CylinderCollection from '../Draw/Cylinder/CylinderCollection'
import type Ellipsoid from '../Draw/Ellipsoid'
import type EllipsoidCollection from '../Draw/Ellipsoid/EllipsoidCollection'
import type Wall from '../Draw/Wall'
import type Runway from '../Draw/Runway'
import type RunwayCollection from '../Draw/Runway/RunwayCollection'
import type Box from '../Draw/Box'
import type BoxCollection from '../Draw/Box/BoxCollection'
import type PolylineVolume from '../Draw/PolylineVolume'
import type PolylineVolumeCollection from '../Draw/PolylineVolume/PolylineVolumeCollection'
import type Plane from '../Draw/Plane'
import type PlaneCollection from '../Draw/Plane/PlaneCollection'
import type Path from '../Draw/Path'

// --- Utils / timelineClock (Utils/timelineClock.ts) ---

export interface PlayClockWindow {
  start: JulianDate
  end: JulianDate
  durationSec: number
}

// --- Coordinates (Coordinates/index.ts) ---

export interface LngLatHeight {
  longitude: number
  latitude: number
  height: number
}

export interface DrawingBufferPoint {
  x: number
  y: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface DmsAxis {
  degrees: number
  minutes: number
  seconds: number
  /** 经度：E/W；纬度：N/S */
  hemisphere: 'E' | 'W' | 'N' | 'S'
}

export interface LngLatDms {
  longitude: DmsAxis
  latitude: DmsAxis
}

// --- Draw / Point 关联 type（interface 字段引用，定义处仍见 Draw/Point/index.ts）---
export type PointPositionsTuple = readonly [lng: number, lat: number, height?: number]
export type PointPositionInput = Cartesian3 | LngLatHeight

// --- Draw / 关联 type 别名（interface 字段引用，各子模块仍 re-export）---
export type BoxPositionsTuple = PointPositionsTuple
export type BoxDimensionsInput = Cartesian3 | readonly [number, number, number]
export type BillboardPositionsTuple = PointPositionsTuple
export type LabelPositionsTuple = PointPositionsTuple
export type ModelPositionsTuple = PointPositionsTuple
export type PlanePositionsTuple = PointPositionsTuple
export type CircleCenterTuple = readonly [lng: number, lat: number, height?: number]
export type CircleCenterInput = Cartesian3 | LngLatHeight
export type CylinderCenterTuple = readonly [lng: number, lat: number, height?: number]
export type CylinderCenterInput = Cartesian3 | LngLatHeight
export type CorridorLngLatTuple = readonly [lng: number, lat: number, height?: number]
export type CorridorVertexInput = Cartesian3 | LngLatHeight | CorridorLngLatTuple
export type PolygonLngLatTuple = readonly [lng: number, lat: number, height?: number]
export type PolygonVertexInput = Cartesian3 | LngLatHeight | PolygonLngLatTuple
export type PolylineVolumeLngLatTuple = readonly [lng: number, lat: number, height?: number]
export type PolylineLngLatTuple = readonly [lng: number, lat: number, height?: number]
export type PolylineGeometryMode = 'polyline' | 'polylineVolume' | 'wall'
export type PolylineLineKind =
  | 'solid'
  | 'clamp_ground'
  | 'dashed'
  | 'outline'
  | 'glowing'
  | 'flowing'
  | 'gradient'
  | 'arrow'
  | 'volume_block'
  | 'volume_tube'
  | 'wall'
export type ArrowPlacementType = 'head' | 'tail' | 'both'
export type PolylineClampToGroundFlag = 0 | 1
export type PositionInput = Cartesian3 | LngLatHeight
export type PlaneCenterInput = Cartesian3 | LngLatHeight
export type RunwayLngLatTuple = readonly [lng: number, lat: number, height?: number]
export type RunwayVertexInput = Cartesian3 | LngLatHeight | RunwayLngLatTuple
export type RunwayMaterialMode = 'flowColor' | 'flowImage'
export type RunwayFlowBandStyle = 'single' | 'multi'
export type RunwayFlowStAxis = 'x' | 'y'
export type ModelCollectionOrientationDegrees = { heading: number; pitch: number; roll: number }
/** 与 `PlaneMaterialType` 一致，见 Draw/Plane/planeShared.ts */
export type PlaneMaterialTypeValue = 'color' | 'image' | 'video'
export type VideoEndedListener = () => void
/** 与 `PolylineMaterialType` 一致，见 Draw/PolyLine/PolyLineCollection.ts */
export type PolylineMaterialTypeValue = 'Color' | 'PolylineDash' | 'PolylineArrow'
export type MaterialType =
  | 'color'
  | 'gradientVertical'
  | 'gradientHorizontal'
  | 'gradientMultiColor'
  | 'imageRepeat'
  | 'imageStretch'
export type Position3D = readonly [lng: number, lat: number, height: number]
export type WallPosition = LngLatHeight | Position3D | Cartesian3
export type MouseEventPickedEntity = unknown
// --- Draw / Billboard / BillboardCollection (Draw/Billboard/BillboardCollection.ts) ---

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

// --- Draw / Billboard / index (Draw/Billboard/index.ts) ---

export interface BillboardStyleOptions {
  scale?: number
  pixelOffset?: Cesium.Cartesian2
  eyeOffset?: Cesium.Cartesian3
  horizontalOrigin?: Cesium.HorizontalOrigin
  verticalOrigin?: Cesium.VerticalOrigin
  heightReference?: Cesium.HeightReference
  color?: Color
  rotation?: number
  alignedAxis?: Cesium.Cartesian3
  width?: number
  height?: number
  sizeInMeters?: boolean
  scaleByDistance?: Cesium.NearFarScalar
  translucencyByDistance?: Cesium.NearFarScalar
  pixelOffsetScaleByDistance?: Cesium.NearFarScalar
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  disableDepthTestDistance?: number
}

export interface AddBillboardOptions {
  id?: string
  position?: PointPositionInput
  positions?: BillboardPositionsTuple
  /** 图片 URL 或 data URI（含 SVG data URI） */
  image?: string
  /** 原始 SVG XML，内部转为 data URI */
  svg?: string
  style?: BillboardStyleOptions
  /** CSS 颜色，乘到贴图上 */
  color?: string
  alpha?: number
  scale?: number
  pixelOffset?: readonly [number, number]
  horizontalOrigin?: keyof typeof Cesium.HorizontalOrigin
  verticalOrigin?: keyof typeof Cesium.VerticalOrigin
  heightReference?: keyof typeof Cesium.HeightReference
  width?: number
  /** 贴图像素高度（与位置高度区分） */
  imageHeight?: number
  /**
   * 绕贴图平面法向的旋转角（度），传入 Cesium 时转为弧度（与 `Billboard#rotation` 一致，正值为逆时针）。
   * 示例页 UI 约定：可按地图理解「0° 为正北向、逆时针增大」；与指北针一致的几何效果需结合相机与 `alignedAxis` 等，本封装未改 Cesium 默认旋转语义。
   */
  rotationDegrees?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  areaDraft?: boolean
}

export interface UpdateBillboardProperties {
  longitude?: number
  latitude?: number
  height?: number
  position?: PointPositionInput
  positions?: BillboardPositionsTuple
  image?: string
  svg?: string
  color?: string | Color
  alpha?: number
  scale?: number
  pixelOffset?: readonly [number, number]
  horizontalOrigin?: keyof typeof Cesium.HorizontalOrigin
  verticalOrigin?: keyof typeof Cesium.VerticalOrigin
  heightReference?: keyof typeof Cesium.HeightReference
  width?: number
  imageHeight?: number
  rotationDegrees?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: BillboardStyleOptions
  areaDraft?: boolean
}

export interface BillboardSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  /** 当前贴图源摘要（过长 data URI 会截断，完整值见 `targetData.imageUri`） */
  imageSummary?: string
  scale?: number
  colorCss?: string
  width?: number
  heightPx?: number
  pixelOffsetX?: number
  pixelOffsetY?: number
  /** 旋转角（度）；示例页约定 0° 正北、逆时针，底层见 `AddBillboardOptions.rotationDegrees` */
  rotationDegrees?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Box / BoxCollection (Draw/Box/BoxCollection.ts) ---

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

// --- Draw / Box / index (Draw/Box/index.ts) ---

export interface BoxStyleOptions {
  dimensions?: Cesium.Cartesian3
  heightReference?: Cesium.HeightReference
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  shadows?: Cesium.ShadowMode
}

export interface AddBoxOptions {
  id?: string
  position?: PointPositionInput
  positions?: BoxPositionsTuple
  /** 空域管理鼠标绘制草稿 */
  areaDraft?: boolean
  /** 长宽高（米），默认 [200, 200, 200] */
  dimensions?: BoxDimensionsInput
  style?: BoxStyleOptions
  color?: string
  alpha?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  fill?: boolean
  show?: boolean
  description?: string
  heightReference?: keyof typeof Cesium.HeightReference
  targetData?: Record<string, unknown>
}

export interface UpdateBoxProperties {
  areaDraft?: boolean
  longitude?: number
  latitude?: number
  height?: number
  position?: PointPositionInput
  positions?: BoxPositionsTuple
  dimensions?: BoxDimensionsInput
  color?: string | Color
  alpha?: number
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  fill?: boolean
  show?: boolean
  description?: string
  heightReference?: keyof typeof Cesium.HeightReference
  targetData?: Record<string, unknown>
  style?: BoxStyleOptions
}

export interface BoxSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  dimensions: { x: number; y: number; z: number }
  fillColorCss?: string
  outlineColorCss?: string
  outlineWidth?: number
  outline?: boolean
  fill?: boolean
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Circle / CircleCollection (Draw/Circle/CircleCollection.ts) ---

export interface CircleCollectionAddItem {
  id?: string
  show?: boolean
  /** 圆心 [lng, lat, height?]（度 / 米） */
  positions: number[]
  /**
   * 半径（千米），与旧版 `CircleCollecation.js` 一致，内部 `* 1000` 转为米传入 `CircleGeometry`。
   */
  radius?: number
  extrudedHeight?: number
  color?: string
  alpha?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  stRotation?: number
  numberOfVerticalLines?: number
  targetData?: Record<string, unknown>
}

export interface CircleCollectionUpdateOptions {
  show?: boolean
  positions?: number[]
  radius?: number
  extrudedHeight?: number
  color?: string
  alpha?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  targetData?: Record<string, unknown>
}

export interface CircleCollectionUpdateEntry {
  id: string
  options?: CircleCollectionUpdateOptions
}

export interface CircleCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  /** 半径（千米），与入参一致 */
  radiusKm: number
  extrudedHeight: number
  show: boolean
  alpha: number
  outline: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Circle / index (Draw/Circle/index.ts) ---

export interface CircleStyleOptions {
  heightReference?: Cesium.HeightReference
  /**
   * 对应 `EllipseGraphics.height`（米，相对圆心位置的高度偏移）。
   * 若完全不设置 `ellipse.height` 且开启填充，Cesium 会把椭圆走「贴地几何」分支并 **强制关闭 outline**（引擎 `GeometryUpdater` 行为）。
   * 内部默认 `0`，一般无需传。
   */
  ellipseHeight?: number
  rotation?: number
  granularity?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  classificationType?: Cesium.ClassificationType
  zIndex?: number
}

export interface AddCircleOptions {
  id?: string
  position?: CircleCenterInput
  center?: CircleCenterInput
  positions?: CircleCenterTuple
  /** 空域管理草稿顶点（如圆心 + 半径控制点） */
  draftVertices?: readonly LngLatHeight[]
  /** 空域管理鼠标绘制草稿：放宽圆心/半径校验 */
  areaDraft?: boolean
  /** 半径（米）；`areaDraft` 时可为 0 */
  radius: number
  style?: CircleStyleOptions
  color?: string
  alpha?: number
  /** 是否填充（false 时等效透明填充，仍可显示轮廓） */
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateCircleProperties {
  /** 传 `false` 且原为草稿时，提交为正式圆（`ConstantProperty` 图形） */
  areaDraft?: boolean
  center?: CircleCenterInput
  longitude?: number
  latitude?: number
  height?: number
  position?: CircleCenterInput
  positions?: CircleCenterTuple
  draftVertices?: readonly LngLatHeight[]
  radius?: number
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: CircleStyleOptions
}

export interface CircleSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  /** 半径（米） */
  radius: number
  colorCss?: string
  /** 是否显示填充（来自 targetData） */
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Corridor / CorridorCollection (Draw/Corridor/CorridorCollection.ts) ---

export interface CorridorCollectionAddItem {
  id?: string
  /** 中心线 [[lng, lat, h?], ...]，至少 2 点；`CorridorGeometry` 会将中心线投影到椭球面再应用 `height` / `extrudedHeight`。 */
  positions: number[][]
  width: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface CorridorCollectionStoredData {
  id: string
  positions: number[][]
  width: number
  height: number
  extrudedHeight: number
  cornerType: Cesium.CornerType
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface CorridorCollectionEntry {
  data: CorridorCollectionStoredData
  primitive: Primitive
}

export interface CorridorCollectionSnapshot {
  id: string
  positions: number[][]
  width: number
  height: number
  extrudedHeight: number
  cornerType: string
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
  vertexCount: number
}

export interface CorridorCollectionUpdateProps {
  positions?: number[][]
  width?: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string
  opacity?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface CorridorCollectionUpdateEntry extends CorridorCollectionUpdateProps {
  id: string
}

// --- Draw / Corridor / index (Draw/Corridor/index.ts) ---

export interface CorridorStyleOptions {
  granularity?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  classificationType?: Cesium.ClassificationType
  zIndex?: number
}

export interface AddCorridorOptions {
  id?: string
  positions: CorridorVertexInput[]
  /** 空域管理鼠标绘制草稿：放宽顶点数校验，取消时 `remove(id)` 即可不留痕 */
  areaDraft?: boolean
  width: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  style?: CorridorStyleOptions
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateCorridorProperties {
  positions?: CorridorVertexInput[]
  /** 传 `false` 且原为草稿时，提交为正式廊道（仍须 ≥2 顶点） */
  areaDraft?: boolean
  width?: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: CorridorStyleOptions
}

export interface CorridorSnapshot {
  id: string
  positions: number[][]
  vertexCount: number
  width: number
  height: number
  extrudedHeight: number
  cornerType?: string
  colorCss?: string
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Cylinder / CylinderCollection (Draw/Cylinder/CylinderCollection.ts) ---

export interface CylinderCollectionAddItem {
  id?: string
  longitude: number
  latitude: number
  height?: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface CylinderCollectionStoredData {
  id: string
  longitude: number
  latitude: number
  height: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface CylinderCollectionEntry {
  data: CylinderCollectionStoredData
  primitive: Primitive
}

export interface CylinderCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Cylinder / index (Draw/Cylinder/index.ts) ---

export interface CylinderStyleOptions {
  slices?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

export interface AddCylinderOptions {
  id?: string
  position?: CylinderCenterInput
  center?: CylinderCenterInput
  positions?: CylinderCenterTuple
  areaDraft?: boolean
  /** 与 `center: { longitude, latitude, height }` 等价；勿与 `position` / `center` / `positions` 混用（若后者有值则优先用后者） */
  longitude?: number
  latitude?: number
  height?: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  style?: CylinderStyleOptions
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateCylinderProperties {
  areaDraft?: boolean
  longitude?: number
  latitude?: number
  height?: number
  position?: CylinderCenterInput
  center?: CylinderCenterInput
  positions?: CylinderCenterTuple
  length?: number
  topRadius?: number
  bottomRadius?: number
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: CylinderStyleOptions
}

export interface CylinderSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  length: number
  topRadius: number
  bottomRadius: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  colorCss?: string
  /** 填充透明度（来自材质 alpha，便于表单回显） */
  fillAlpha?: number
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  /** 轮廓色透明度 */
  outlineAlpha?: number
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Ellipsoid / EllipsoidCollection (Draw/Ellipsoid/EllipsoidCollection.ts) ---

export interface EllipsoidCollectionAddItem {
  id?: string;
  /** 中心点位置 [经度, 纬度, 高度] */
  positions: number[];
  /** 半径 [x, y, z] 米，默认 [10000, 10000, 10000] */
  radii?: [number, number, number];
  show?: boolean;
  /** 填充颜色 CSS 字符串 */
  color?: string;
  /** 填充透明度 0-1 */
  alpha?: number;
  /** 轮廓开关 */
  outline?: boolean;
  /** 轮廓颜色 CSS 字符串 */
  outlineColor?: string;
  /** 轮廓透明度 0-1 */
  outlineAlpha?: number;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 业务数据 */
  targetData?: Record<string, unknown>;
}

export interface EllipsoidCollectionUpdateProps {
  longitude?: number;
  latitude?: number;
  height?: number;
  radii?: [number, number, number];
  color?: string;
  alpha?: number;
  outline?: boolean;
  outlineColor?: string;
  outlineAlpha?: number;
  outlineWidth?: number;
  show?: boolean;
  targetData?: Record<string, unknown>;
}

export interface EllipsoidCollectionUpdateEntry extends EllipsoidCollectionUpdateProps {
  id: string;
}

export interface EllipsoidCollectionSnapshot {
  id: string;
  longitude: number;
  latitude: number;
  height: number;
  radii: Cesium.Cartesian3;
  color: Cesium.Color;
  outline: boolean;
  outlineColor: Cesium.Color;
  outlineWidth: number;
  show: boolean;
  targetData: Record<string, unknown>;
}

// --- Draw / Ellipsoid / index (Draw/Ellipsoid/index.ts) ---

export interface EllipsoidStyleOptions {
  /** 立方体各方向半径（米），默认 [10000, 10000, 10000] */
  radii?: Cesium.Cartesian3;
  /** 填充材质颜色 */
  material?: Color | Cesium.Material;
  /** 轮廓颜色 */
  outlineColor?: Color;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否与地形贴合 */
  heightReference?: Cesium.HeightReference;
  /** 距离显示条件 */
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  /** 是否显示 */
  show?: boolean;
  /** 透明度（0-1） */
  alpha?: number;
}

export interface AddEllipsoidOptions {
  id?: string;
  areaDraft?: boolean;
  /** 中心点位置 */
  position: PositionInput;
  /** 椭球体样式 */
  style?: EllipsoidStyleOptions;
  /** CSS 颜色字符串（优先级低于 style.material） */
  color?: string;
  /** 透明度（0-1） */
  alpha?: number;
  /** 半径（快捷设置，如果同时指定 radii，则优先 style.radii） */
  radii?: Cesium.Cartesian3 | number;
  /** 是否显示轮廓 */
  outline?: boolean;
  /** 轮廓颜色（CSS 颜色字符串） */
  outlineColor?: string;
  /** 轮廓透明度 */
  outlineAlpha?: number;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否显示 */
  show?: boolean;
  /** 描述信息 */
  description?: string;
  /** 业务自定义数据 */
  targetData?: Record<string, unknown>;
}

export interface UpdateEllipsoidProperties {
  areaDraft?: boolean;
  /** 中心点位置 */
  position?: PositionInput;
  /** 半径 */
  radii?: Cesium.Cartesian3 | number;
  /** 材质主色 */
  color?: string | Color;
  /** 材质透明度 */
  alpha?: number;
  /** 轮廓开关 */
  outline?: boolean;
  /** 轮廓颜色 */
  outlineColor?: string | Color;
  /** 轮廓透明度 */
  outlineAlpha?: number;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否显示 */
  show?: boolean;
  /** 描述 */
  description?: string;
  /** 业务数据 */
  targetData?: Record<string, unknown>;
  /** 完整样式 */
  style?: EllipsoidStyleOptions;
}

export interface EllipsoidSnapshot {
  id: string;
  /** 中心点经度（度） */
  longitude: number;
  /** 中心点纬度（度） */
  latitude: number;
  /** 中心点高度（米） */
  height: number;
  /** 半径（米） */
  radii: { x: number; y: number; z: number };
  /** 材质颜色（CSS 格式） */
  materialCss?: string;
  /** 轮廓颜色（CSS 格式） */
  outlineColorCss?: string;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否启用轮廓（采样自 `EllipsoidGraphics.outline`） */
  outline?: boolean;
  /** 是否显示 */
  show: boolean;
  /** 业务数据 */
  targetData: Record<string, unknown>;
  /** 描述 */
  description?: string;
}

// --- Draw / Label / LabelCollection (Draw/Label/LabelCollection.ts) ---

export interface LabelCollectionAddItem {
  id?: string
  show?: boolean
  positions: number[]
  /** 显示文本（与旧版 `label` 字段一致） */
  label?: string
  font?: string
  alpha?: number
  fontColor?: string
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  fontScale?: number
  /** `FILL` | `OUTLINE` | `FILL_AND_OUTLINE` */
  fontStyle?: keyof typeof Cesium.LabelStyle
  showBackground?: boolean
  backgroundColor?: string
  backgroundPaddingX?: number
  backgroundPaddingY?: number
  pixelOffsetX?: number
  pixelOffsetY?: number
  eyeOffset?: Cesium.Cartesian3
  horizontalOrigin?: keyof typeof Cesium.HorizontalOrigin
  verticalOrigin?: keyof typeof Cesium.VerticalOrigin
  translucencyByDistance?: Cesium.NearFarScalar
  pixelOffsetScaleByDistance?: Cesium.NearFarScalar
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  scaleByDistance?: Cesium.NearFarScalar
  heightReference?: keyof typeof Cesium.HeightReference
  disableDepthTestDistance?: number
  targetData?: Record<string, unknown>
}

export interface LabelCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  label?: string
  font?: string
  fontColor?: string
  alpha?: number
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  fontScale?: number
  backgroundColor?: string
  pixelOffsetX?: number
  pixelOffsetY?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface LabelCollectionUpdateEntry extends LabelCollectionUpdateProps {
  id: string
}

export interface LabelCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  text: string
  font: string
  fillColor: Cesium.Color
  outlineColor: Cesium.Color
  outlineWidth: number
  scale: number
  style: Cesium.LabelStyle
  showBackground: boolean
  backgroundColor: Cesium.Color
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Label / index (Draw/Label/index.ts) ---

export interface LabelStyleOptions {
  font?: string
  fillColor?: Color
  outlineColor?: Color
  outlineWidth?: number
  style?: Cesium.LabelStyle
  showBackground?: boolean
  backgroundColor?: Color
  backgroundPadding?: Cesium.Cartesian2
  pixelOffset?: Cesium.Cartesian2
  eyeOffset?: Cesium.Cartesian3
  horizontalOrigin?: Cesium.HorizontalOrigin
  verticalOrigin?: Cesium.VerticalOrigin
  scale?: number
  heightReference?: Cesium.HeightReference
  disableDepthTestDistance?: number
  scaleByDistance?: Cesium.NearFarScalar
  translucencyByDistance?: Cesium.NearFarScalar
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

export interface AddLabelOptions {
  id?: string
  position?: PointPositionInput
  positions?: LabelPositionsTuple
  text?: string
  font?: string
  /** CSS 填充色，与 `fontColor` 等价取其一 */
  fillColor?: string
  fontColor?: string
  alpha?: number
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  /** `FILL` | `OUTLINE` | `FILL_AND_OUTLINE` */
  style?: keyof typeof Cesium.LabelStyle | Cesium.LabelStyle
  showBackground?: boolean
  backgroundColor?: string
  backgroundPadding?: readonly [number, number]
  pixelOffset?: readonly [number, number]
  scale?: number
  horizontalOrigin?: keyof typeof Cesium.HorizontalOrigin
  verticalOrigin?: keyof typeof Cesium.VerticalOrigin
  heightReference?: keyof typeof Cesium.HeightReference
  disableDepthTestDistance?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  areaDraft?: boolean
}

export interface UpdateLabelProperties {
  longitude?: number
  latitude?: number
  height?: number
  position?: PointPositionInput
  positions?: LabelPositionsTuple
  text?: string
  font?: string
  fillColor?: string | Color
  fontColor?: string | Color
  alpha?: number
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  style?: keyof typeof Cesium.LabelStyle | Cesium.LabelStyle
  showBackground?: boolean
  backgroundColor?: string | Color
  backgroundPadding?: readonly [number, number]
  pixelOffset?: readonly [number, number]
  scale?: number
  horizontalOrigin?: keyof typeof Cesium.HorizontalOrigin
  verticalOrigin?: keyof typeof Cesium.VerticalOrigin
  heightReference?: keyof typeof Cesium.HeightReference
  disableDepthTestDistance?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  areaDraft?: boolean
}

export interface LabelSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  text: string
  font?: string
  fillColorCss?: string
  outlineColorCss?: string
  outlineWidth?: number
  scale?: number
  style?: string
  showBackground?: boolean
  backgroundColorCss?: string
  pixelOffsetX?: number
  pixelOffsetY?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Model / ModelCollection (Draw/Model/ModelCollection.ts) ---

export interface ModelCollectionAddItem {
  id?: string
  positions: number[]
  uri: string
  show?: boolean
  scale?: number
  minimumPixelSize?: number
  maximumScale?: number
  heightReference?: keyof typeof Cesium.HeightReference
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  targetData?: Record<string, unknown>
}

export interface ModelCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  uri?: string
  scale?: number
  minimumPixelSize?: number
  maximumScale?: number
  heightReference?: keyof typeof Cesium.HeightReference
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface ModelCollectionUpdateEntry extends ModelCollectionUpdateProps {
  id: string
}

export interface ModelCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  uri: string
  scale: number
  minimumPixelSize: number
  maximumScale?: number
  show: boolean
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  targetData: Record<string, unknown>
}

// --- Draw / Model / index (Draw/Model/index.ts) ---

export interface ModelStyleOptions {
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  heightReference?: Cesium.HeightReference;
  silhouetteColor?: Color;
  silhouetteSize?: number;
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  shadows?: Cesium.ShadowMode;
}

export interface AddModelOptions {
  id?: string;
  position?: PointPositionInput;
  positions?: ModelPositionsTuple;
  uri: string;
  style?: ModelStyleOptions;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  heightReference?: keyof typeof Cesium.HeightReference;
  /**
   * 航向角（度），与 Cesium `HeadingPitchRoll` / `Transforms.headingPitchRollQuaternion` 一致：
   * 0° 朝北，**顺时针**增大（俯视地图）；例如 **+90° 朝东**。
   */
  headingDegrees?: number;
  /**
   * 俯仰角（度）：**正为抬头**（机头向上），**负为俯冲**（机头向下）。
   */
  pitchDegrees?: number;
  /**
   * 横滚角（度）：**正为右倾**（右翼向下），**负为左倾**（左翼向下）。
   */
  rollDegrees?: number;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
  areaDraft?: boolean;
}

export interface UpdateModelProperties {
  longitude?: number;
  latitude?: number;
  height?: number;
  position?: PointPositionInput;
  positions?: ModelPositionsTuple;
  uri?: string;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  heightReference?: keyof typeof Cesium.HeightReference;
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
  style?: ModelStyleOptions;
  areaDraft?: boolean;
}

export interface ModelSnapshot {
  id: string;
  longitude: number;
  latitude: number;
  height: number;
  uri?: string;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  /** 航向角（度），见 `AddModelOptions.headingDegrees` */
  headingDegrees?: number;
  /** 俯仰角（度），正抬头、负俯冲，见 `AddModelOptions.pitchDegrees` */
  pitchDegrees?: number;
  /** 横滚角（度），正右倾、负左倾，见 `AddModelOptions.rollDegrees` */
  rollDegrees?: number;
  show: boolean;
  targetData: Record<string, unknown>;
  description?: string;
}

// --- Draw / Path / index (Draw/Path/index.ts) ---

export interface PathStyleOptions {
  width?: number
  leadTime?: number
  trailTime?: number
  resolution?: number
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

export interface AddPathOptions {
  id?: string
  /** 时间采样位置（通常来自 `Trajectory#getPositionProperty()`） */
  position: Cesium.PositionProperty
  /** 可见时间窗；不传则始终可见 */
  availability?: Cesium.TimeIntervalCollection
  style?: PathStyleOptions
  width?: number
  color?: string
  alpha?: number
  leadTime?: number
  trailTime?: number
  resolution?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdatePathProperties {
  position?: Cesium.PositionProperty
  availability?: Cesium.TimeIntervalCollection
  style?: PathStyleOptions
  width?: number
  color?: string | Color
  alpha?: number
  leadTime?: number
  trailTime?: number
  resolution?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface PathSnapshot {
  id: string
  width: number
  leadTime: number
  trailTime: number
  resolution: number
  colorCss?: string
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Plane / PlaneCollection (Draw/Plane/PlaneCollection.ts) ---

export interface PlaneCollectionAddItem {
  id?: string
  positions: number[]
  dimensions?: [number, number]
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  materialType?: PlaneMaterialTypeValue
  color?: string
  alpha?: number
  imageUrl?: string
  videoUrl?: string
  video?: PlaneVideoOptions
  imageRepeat?: { x: number; y: number }
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PlaneCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  dimensions?: [number, number]
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  materialType?: PlaneMaterialTypeValue
  color?: string
  alpha?: number
  imageUrl?: string
  videoUrl?: string
  video?: PlaneVideoOptions
  imageRepeat?: { x: number; y: number }
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PlaneCollectionUpdateEntry extends PlaneCollectionUpdateProps {
  id: string
}

export interface PlaneCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  width: number
  planeHeight: number
  headingDegrees: number
  pitchDegrees: number
  rollDegrees: number
  materialType: PlaneMaterialTypeValue
  colorCss: string
  imageUrl?: string
  videoUrl?: string
  video?: PlaneVideoOptions
  imageRepeat?: { x: number; y: number }
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Plane / index (Draw/Plane/index.ts) ---

export interface PlaneStyleOptions {
  materialType?: PlaneMaterialTypeValue;
  /** 图片 / 视频 URL（`image` / `video`） */
  imageUrl?: string;
  videoUrl?: string;
  /** 视频播放参数（仅 `video`） */
  video?: PlaneVideoOptions;
  /** 图片平铺重复（仅 `image`） */
  imageRepeat?: { x: number; y: number };
  shadows?: Cesium.ShadowMode;
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
}

export interface AddPlaneOptions {
  id?: string;
  areaDraft?: boolean;
  position?: PlaneCenterInput;
  positions?: PlanePositionsTuple;
  /** 平面宽、高（米） */
  dimensions?: { width: number; height: number };
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
  style?: PlaneStyleOptions;
  /** 填充材质类型，默认 `color` */
  materialType?: PlaneMaterialTypeValue;
  color?: string;
  alpha?: number;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
  fill?: boolean;
  outline?: boolean;
  outlineColor?: string;
  outlineAlpha?: number;
  outlineWidth?: number;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
}

export interface UpdatePlaneProperties {
  areaDraft?: boolean;
  longitude?: number;
  latitude?: number;
  height?: number;
  position?: PlaneCenterInput;
  positions?: PlanePositionsTuple;
  dimensions?: { width: number; height: number };
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
  materialType?: PlaneMaterialTypeValue;
  color?: string | Color;
  alpha?: number;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
  fill?: boolean;
  outline?: boolean;
  outlineColor?: string | Color;
  outlineAlpha?: number;
  outlineWidth?: number;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
  style?: PlaneStyleOptions;
}

export interface PlaneSnapshot {
  id: string;
  longitude: number;
  latitude: number;
  height: number;
  width: number;
  planeHeight: number;
  headingDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  materialType: PlaneMaterialTypeValue;
  colorCss?: string;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
  fill?: boolean;
  outline?: boolean;
  outlineColorCss?: string;
  outlineWidth?: number;
  show: boolean;
  targetData: Record<string, unknown>;
  description?: string;
}

// --- Draw / Plane / planeShared (Draw/Plane/planeShared.ts) ---

export interface PlaneVideoOptions {
  /** 是否播放（创建/更新后生效；默认 true） */
  playing?: boolean;
  /** 循环播放 */
  loop?: boolean;
  /** 静音（播放时建议 true，便于通过浏览器自动播放策略） */
  muted?: boolean;
  /** 播放倍速，默认 1 */
  playbackRate?: number;
  /**
   * 播放次数：0 表示不限制（由 loop 决定是否循环）；
   * >0 时每次自然结束计 1 次，达到后暂停
   */
  playCount?: number;
  /** 浏览器原生视频控件 */
  showControls?: boolean;
  /** 预加载 */
  preload?: "auto" | "metadata" | "none";
}

export type LegacyPlaneVideoOptions = PlaneVideoOptions & {
  autoplay?: boolean
  startPaused?: boolean
}

export interface PlaneMaterialBuildInput {
  materialType: PlaneMaterialTypeValue;
  color?: string;
  alpha?: number;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions | LegacyPlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
}

export interface PlaneMaterialBuildResult {
  material: Cesium.Material;
  translucent: boolean;
  videoElement?: HTMLVideoElement;
  videoEndedListener?: VideoEndedListener;
}

export interface PlaneStyleLike {
  materialType?: PlaneMaterialTypeValue;
  color?: string | Cesium.Color;
  alpha?: number;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions | LegacyPlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
}

export interface PlaneMaterialSource extends PlaneStyleLike {
  materialType?: PlaneMaterialTypeValue;
  targetData?: Record<string, unknown>;
  style?: PlaneStyleLike;
}

// --- Draw / Point / PointCollection (Draw/Point/PointCollection.ts) ---

export interface PointCollectionAddItem {
  id?: string
  positions: number[]
  show?: boolean
  color?: string
  alpha?: number
  targetData?: Record<string, unknown>
  pixelSize?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
}

export interface PointCollectionUpdateProps {
  longitude?: number
  latitude?: number
  height?: number
  color?: string
  alpha?: number
  pixelSize?: number
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PointCollectionUpdateEntry extends PointCollectionUpdateProps {
  id: string
}

export interface PointCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  color: Cesium.Color
  pixelSize: number
  outline: boolean
  outlineColor: Cesium.Color
  outlineWidth: number
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Point / index (Draw/Point/index.ts) ---

export interface PointStyleOptions {
  pixelSize?: number
  color?: Color
  outlineColor?: Color
  outlineWidth?: number
  heightReference?: Cesium.HeightReference
  disableDepthTestDistance?: number
  scaleByDistance?: Cesium.NearFarScalar
  translucencyByDistance?: Cesium.NearFarScalar
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

export interface AddPointOptions {
  id?: string
  position?: PointPositionInput
  positions?: PointPositionsTuple
  style?: PointStyleOptions
  /** CSS 颜色，如 `#ff0000` */
  color?: string
  alpha?: number
  pixelSize?: number
  /** 是否绘制轮廓；`false` 时等效 `outlineWidth: 0` */
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  /** 自定义业务数据（对应原 `primitive._targetData`） */
  targetData?: Record<string, unknown>
  areaDraft?: boolean
}

export interface UpdatePointProperties {
  longitude?: number
  latitude?: number
  height?: number
  /** 优先于 lon/lat/height */
  position?: PointPositionInput
  positions?: PointPositionsTuple
  color?: string | Color
  alpha?: number
  pixelSize?: number
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PointStyleOptions
  /** 传 `false` 且原为草稿时，提交为正式点 */
  areaDraft?: boolean
}

export interface PointSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  colorCss?: string
  pixelSize?: number
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / PolyLine / PolyLineCollection (Draw/PolyLine/PolyLineCollection.ts) ---

export interface PolyLineCollectionAddItem {
  id?: string
  positions: number[][]
  show?: boolean
  width?: number
  color?: string
  alpha?: number
  materialType?: PolylineMaterialTypeValue
  materialOptions?: Record<string, unknown>
  targetData?: Record<string, unknown>
  clampToGround?: boolean
  arcType?: Cesium.ArcType
}

export interface PolyLineCollectionUpdateMaterialProps {
  materialType?: PolylineMaterialTypeValue
  color?: string
  alpha?: number
  [key: string]: unknown
}

export interface PolyLineCollectionUpdateProps {
  positions?: number[][]
  width?: number
  color?: string
  alpha?: number
  show?: boolean
  arcType?: Cesium.ArcType
  clampToGround?: boolean
  targetData?: Record<string, unknown>
}

export interface PolyLineCollectionUpdateEntry extends PolyLineCollectionUpdateProps {
  id: string
}

export interface PolyLineCollectionSnapshot {
  id: string
  positions: number[][]
  width: number
  color: string
  alpha: number
  show: boolean
  arcType: Cesium.ArcType
  clampToGround: boolean
  targetData: Record<string, unknown>
  positionsCount: number
  length: number
}

// --- Draw / PolyLine / index (Draw/PolyLine/index.ts) ---

export interface PolylineStyleOptions {
  width?: number;
  granularity?: number;
  depthFailMaterial?: MaterialProperty | Color;
  arcType?: Cesium.ArcType;
  clampToGround?: boolean;
  shadows?: Cesium.ShadowMode;
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  classificationType?: Cesium.ClassificationType;
  zIndex?: number;
}

export interface DashedPolylineParams {
  gapColor?: string;
  gapAlpha?: number;
  dashLength?: number;
  dashPattern?: number;
}

export interface OutlinePolylineParams {
  outlineColor?: string;
  outlineAlpha?: number;
  outlineWidth?: number;
}

export interface GlowingPolylineParams {
  glowPower?: number;
  taperPower?: number;
}

export interface FlowingPolylineParams {
  imageUrl?: string;
  flowColor?: string;
  flowColorAlpha?: number;
  flowCycleSeconds?: number;
  trailLength?: number;
  repeat?: boolean;
  repeatAlongLine?: number;
}

export interface GradientPolylineParams {
  polylineMaterialColorTexture?: string;
  imageUrl?: string;
}

export interface ArrowPolylineParams {
  /** 已忽略，仅末端箭头 */
  type?: ArrowPlacementType;
  placement?: ArrowPlacementType;
  /** 作为折线宽度使用（含箭头比例） */
  arrowSize?: number;
  arrowColor?: string;
  arrowAlpha?: number;
}

export interface VolumeBlockParams {
  blockWidth?: number;
  baseHeight?: number;
  extrudeHeight?: number;
}

export interface VolumeTubeParams {
  radius?: number;
  polylineVolumeSmooth?: number;
}

export interface WallParams {
  baseHeight?: number;
  extrudeHeight?: number;
}

export interface AddPolylineOptions {
  id?: string;
  positions: readonly PolylineLngLatTuple[] | readonly Cesium.Cartesian3[];
  /** 空域管理鼠标绘制草稿：放宽顶点数校验，取消时 `remove(id)` 即可不留痕 */
  areaDraft?: boolean;
  lineKind?: PolylineLineKind;
  color?: string;
  alpha?: number;
  width?: number;
  /** 0=不贴地，1=贴地；默认 0。与 `clampToGround` 二选一优先级：本字段为 0/1 时优先于未传的 `clampToGround`（见 `effectiveClampToGroundRequest`） */
  polylineClampToGround?: PolylineClampToGroundFlag;
  clampToGround?: boolean;
  arcType?: keyof typeof Cesium.ArcType | Cesium.ArcType;
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType;
  style?: PolylineStyleOptions;
  dashed?: DashedPolylineParams;
  outline?: OutlinePolylineParams;
  glowing?: GlowingPolylineParams;
  flowing?: FlowingPolylineParams;
  gradient?: GradientPolylineParams;
  volumeBlock?: VolumeBlockParams;
  volumeTube?: VolumeTubeParams;
  wall?: WallParams;
  arrow?: ArrowPolylineParams;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
}

export interface UpdatePolylineProperties {
  positions?: readonly PolylineLngLatTuple[] | readonly Cesium.Cartesian3[];
  /** 传 `false` 且原为草稿时，提交为正式折线（仍须 ≥2 顶点） */
  areaDraft?: boolean;
  lineKind?: PolylineLineKind;
  color?: string | Color;
  alpha?: number;
  width?: number;
  polylineClampToGround?: PolylineClampToGroundFlag;
  clampToGround?: boolean;
  arcType?: keyof typeof Cesium.ArcType | Cesium.ArcType;
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType;
  style?: PolylineStyleOptions;
  dashed?: DashedPolylineParams;
  outline?: OutlinePolylineParams;
  glowing?: GlowingPolylineParams;
  flowing?: FlowingPolylineParams;
  gradient?: GradientPolylineParams;
  volumeBlock?: VolumeBlockParams;
  volumeTube?: VolumeTubeParams;
  wall?: WallParams;
  arrow?: ArrowPolylineParams;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
}

export interface PolylineSnapshot {
  id: string;
  lineKind: PolylineLineKind;
  geometryMode: PolylineGeometryMode;
  positions: LngLatHeight[];
  width: number;
  /** 请求贴地标记：0 否，1 是（线型 `clamp_ground` 或 API `polylineClampToGround:1`） */
  polylineClampToGround: PolylineClampToGroundFlag;
  clampToGround: boolean;
  arcType: string;
  cornerType?: string;
  colorCss?: string;
  show: boolean;
  dashed?: DashedPolylineParams;
  outline?: OutlinePolylineParams;
  glowing?: GlowingPolylineParams;
  flowing?: FlowingPolylineParams;
  gradient?: GradientPolylineParams;
  volumeBlock?: VolumeBlockParams;
  volumeTube?: VolumeTubeParams;
  wall?: WallParams;
  arrow?: ArrowPolylineParams;
  targetData: Record<string, unknown>;
  description?: string;
}

// --- Draw / Polygon / PolygonCollection (Draw/Polygon/PolygonCollection.ts) ---

export interface PolygonCollectionAddItem {
  id?: string
  /** 多边形顶点 [[lng, lat, h?], ...]，至少 3 个点 */
  positions: number[][]
  /** 拉伸高度（米），与旧版 `topHeight` 一致 */
  topHeight?: number
  color?: string
  opacity?: number
  show?: boolean
  /** 与旧版 `entityData` 一致，存入 `targetData` */
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface PolygonCollectionStoredData {
  id: string
  positions: number[][]
  topHeight: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface PolygonCollectionEntry {
  data: PolygonCollectionStoredData
  primitive: Primitive
}

export interface PolygonCollectionSnapshot {
  id: string
  positions: number[][]
  topHeight: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
  vertexCount: number
}

// --- Draw / Polygon / index (Draw/Polygon/index.ts) ---

export interface PolygonStyleOptions {
  /**
   * 为 `true`（默认）时，各顶点使用自身高度（`positions` 中的高程）构成顶面；
   * 为 `false` 时走贴顶面逻辑，顶点高度由 `PolygonGraphics.height` 等统一控制。
   */
  perPositionHeight?: boolean
  arcType?: Cesium.ArcType
  granularity?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  classificationType?: Cesium.ClassificationType
  zIndex?: number
}

/** 空域管理 `start` 草稿写入 `targetData` 的标记键（`getAllPolygons` 等会过滤） */
export const AREA_DRAFT_TARGET_KEY = '__areaDraft'

export interface AddPolygonOptions {
  id?: string
  positions: PolygonVertexInput[]
  /** 空域管理鼠标绘制草稿：放宽顶点数校验，取消时 `remove(id)` 即可不留痕 */
  areaDraft?: boolean
  style?: PolygonStyleOptions
  /**
   * 整块多边形沿法线/挤出方向的拉伸高度（米），映射 `PolygonGraphics.extrudedHeight`；全环共用一个数值。
   */
  extrudedHeight?: number
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdatePolygonProperties {
  positions?: PolygonVertexInput[]
  /** 传 `false` 且原为草稿时，提交为正式多边形（仍须 ≥3 顶点） */
  areaDraft?: boolean
  extrudedHeight?: number
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PolygonStyleOptions
}

export interface PolygonSnapshot {
  id: string
  /** 外环顶点 [lng, lat, h][] */
  positions: number[][]
  vertexCount: number
  extrudedHeight: number
  colorCss?: string
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / PolylineVolume / PolylineVolumeCollection (Draw/PolylineVolume/PolylineVolumeCollection.ts) ---

export interface PolylineVolumeCollectionAddItem {
  id?: string
  positions: number[][]
  shapeType?: ShapeType | string
  shapeParams?: ShapeParams
  cornerType?: keyof typeof Cesium.CornerType
  granularity?: number
  color?: string
  alpha?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PolylineVolumeCollectionUpdateProps {
  positions?: number[][]
  shapeType?: ShapeType | string
  shapeParams?: ShapeParams
  cornerType?: keyof typeof Cesium.CornerType
  granularity?: number
  color?: string
  alpha?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface PolylineVolumeCollectionUpdateEntry extends PolylineVolumeCollectionUpdateProps {
  id: string
}

export interface PolylineVolumeCollectionSnapshot {
  id: string
  positions: number[][]
  positionsCount: number
  shapeType: string
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / PolylineVolume / index (Draw/PolylineVolume/index.ts) ---

export interface PolylineVolumeStyleOptions {
  cornerType?: Cesium.CornerType
  granularity?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
}

export interface AddPolylineVolumeOptions {
  id?: string
  /** 路径顶点（度 / 米），至少 2 项 */
  positions: PolylineVolumeLngLatTuple[] | number[][]
  /** 空域管理鼠标绘制草稿：放宽顶点数校验，取消时 `remove(id)` 即可不留痕 */
  areaDraft?: boolean
  shapeType?: ShapeType | string
  /** 传给 `createShape` 的参数；缺省时按 `shapeType` 使用内置默认尺寸 */
  shapeParams?: ShapeParams
  style?: PolylineVolumeStyleOptions
  cornerType?: keyof typeof Cesium.CornerType
  granularity?: number
  /** 填充色 CSS */
  color?: string
  alpha?: number
  fill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdatePolylineVolumeProperties {
  positions?: PolylineVolumeLngLatTuple[] | number[][]
  /** 传 `false` 且原为草稿时，提交为正式折线体（仍须 ≥2 顶点） */
  areaDraft?: boolean
  shapeType?: ShapeType | string
  shapeParams?: ShapeParams
  cornerType?: keyof typeof Cesium.CornerType
  granularity?: number
  color?: string | Color
  alpha?: number
  fill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PolylineVolumeStyleOptions
}

export interface PolylineVolumeSnapshot {
  id: string
  /** 路径顶点 [lng, lat, h?][] */
  positions: number[][]
  positionsCount: number
  shapeType: string
  show: boolean
  fill?: boolean
  outline?: boolean
  colorCss?: string
  outlineColorCss?: string
  outlineWidth?: number
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / PolylineVolume / shape (Draw/PolylineVolume/shape.ts) ---

export interface CapsuleShapeOptions {
  width: number; // 总宽度（单位：米）
  height: number; // 总高度（单位：米）
  segments?: number; // 半圆的分段数，默认 16
}

export interface IShapeOptions {
  width: number; // 总宽度（单位：米）
  height: number; // 总高度（单位：米）
  flangeWidth: number; // 翼缘宽度（单位：米）
}

export interface LShapeOptions {
  width: number; // 总宽度（X轴方向，单位：米）
  height: number; // 总高度（Y轴方向，单位：米）
  thickness: number; // 臂厚（单位：米）
}

export interface RingShapeOptions {
  outerRadius: number; // 外圆半径（单位：米）
  innerRadius: number; // 内圆半径（单位：米，必须小于 outerRadius）
  segments?: number; // 分段数，默认 32
}

export interface PolygonShapeOptions {
  points: Array<{ x: number; y: number }>; // 多边形顶点坐标数组
}

// --- Draw / Rectangle / RectangleCollection (Draw/Rectangle/RectangleCollection.ts) ---

export interface RectangleCollectionAddItem {
  id?: string
  west: number
  south: number
  east: number
  north: number
  topHeight?: number
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface RectangleCollectionStoredData {
  id: string
  west: number
  south: number
  east: number
  north: number
  topHeight: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface RectangleCollectionEntry {
  data: RectangleCollectionStoredData
  primitive: Primitive
}

export interface RectangleCollectionSnapshot {
  id: string
  west: number
  south: number
  east: number
  north: number
  topHeight: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Rectangle / index (Draw/Rectangle/index.ts) ---

export interface RectangleStyleOptions {
  height?: number
  rotation?: number
  stRotation?: number
  granularity?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  classificationType?: Cesium.ClassificationType
  zIndex?: number
}

export interface AddRectangleOptions {
  id?: string
  areaDraft?: boolean
  /** 西、南、东、北边界（度） */
  west: number
  south: number
  east: number
  north: number
  style?: RectangleStyleOptions
  extrudedHeight?: number
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateRectangleProperties {
  areaDraft?: boolean
  west?: number
  south?: number
  east?: number
  north?: number
  extrudedHeight?: number
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: RectangleStyleOptions
}

export interface RectangleSnapshot {
  id: string
  west: number
  south: number
  east: number
  north: number
  extrudedHeight: number
  colorCss?: string
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Runway / RunwayCollection (Draw/Runway/RunwayCollection.ts) ---

export interface RunwayCollectionAddItem {
  id?: string
  /** `[[lng,lat,h?],[lng,lat,h?]]` 恰好 2 点 */
  positions: number[][]
  width: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface RunwayCollectionStoredData {
  id: string
  positions: number[][]
  width: number
  height: number
  extrudedHeight: number
  cornerType: Cesium.CornerType
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface RunwayCollectionEntry {
  data: RunwayCollectionStoredData
  primitive: Primitive
}

export interface RunwayCollectionSnapshot {
  id: string
  positions: number[][]
  width: number
  height: number
  extrudedHeight: number
  cornerType: string
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
  vertexCount: number
}

export interface RunwayCollectionUpdateProps {
  positions?: number[][]
  width?: number
  height?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string
  opacity?: number
  show?: boolean
  targetData?: Record<string, unknown>
}

export interface RunwayCollectionUpdateEntry extends RunwayCollectionUpdateProps {
  id: string
}

// --- Draw / Runway / index (Draw/Runway/index.ts) ---

export interface RunwayStyleOptions {
  granularity?: number
  shadows?: Cesium.ShadowMode
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition
  classificationType?: Cesium.ClassificationType
  zIndex?: number
}

export interface AddRunwayOptions {
  id?: string
  areaDraft?: boolean
  /** 起点、终点，长度须为 2（与廊道 `positions` 一致） */
  positions?: RunwayVertexInput[]
  /** 兼容：与 `latitude`/`height` 组成起点，`end*` 组成终点 */
  longitude?: number
  latitude?: number
  height?: number
  endLongitude?: number
  endLatitude?: number
  endHeight?: number
  width: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  style?: RunwayStyleOptions
  materialMode?: RunwayMaterialMode
  flowSpeed?: number
  /** 流动条纹：`single` 一条带沿长度走；`multi` 多条（见 `flowBandCount`） */
  flowBandStyle?: RunwayFlowBandStyle
  /** `multi` 时沿长度方向的条纹数量，约 1～64，默认 8 */
  flowBandCount?: number
  /** 沿中心线采样用 `st.x` 还是 `st.y` */
  flowStAxis?: RunwayFlowStAxis
  /**
   * 为 true 时对长度 UV 做 `1.0 - coord`（与几何默认方向相反时再开）。
   * 默认 false：亮带随时间沿廊道**第一个顶点 → 第二个顶点**方向推进。
   */
  flowLengthFlip?: boolean
  flowImageUrl?: string
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateRunwayProperties {
  areaDraft?: boolean
  positions?: RunwayVertexInput[]
  longitude?: number
  latitude?: number
  height?: number
  endLongitude?: number
  endLatitude?: number
  endHeight?: number
  width?: number
  extrudedHeight?: number
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: RunwayStyleOptions
  materialMode?: RunwayMaterialMode
  flowSpeed?: number
  flowBandStyle?: RunwayFlowBandStyle
  flowBandCount?: number
  flowStAxis?: RunwayFlowStAxis
  flowLengthFlip?: boolean
  flowImageUrl?: string
}

export interface RunwaySnapshot {
  id: string
  positions: number[][]
  vertexCount: number
  /** 中点（展示用） */
  longitude: number
  latitude: number
  height: number
  width: number
  extrudedHeight: number
  cornerType?: string
  materialMode: RunwayMaterialMode
  flowSpeed: number
  flowBandStyle: RunwayFlowBandStyle
  flowBandCount: number
  flowStAxis: RunwayFlowStAxis
  flowLengthFlip: boolean
  flowImageUrl?: string
  colorCss?: string
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Sector / SectorCollection (Draw/Sector/SectorCollection.ts) ---

export interface SectorCollectionAddItem {
  id?: string
  /** 圆心 [lng, lat, height?]（度 / 米） */
  center: number[]
  /** 半径（米） */
  radius: number
  startAzimuthDegrees: number
  endAzimuthDegrees: number
  /** 圆弧分段，默认 32 */
  segments?: number
  topHeight?: number
  color?: string
  opacity?: number
  show?: boolean
  entityData?: Record<string, unknown>
  targetData?: Record<string, unknown>
}

export interface SectorCollectionStoredData {
  id: string
  center: [number, number, number]
  radius: number
  startAzimuthDegrees: number
  endAzimuthDegrees: number
  segments: number
  topHeight: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

export interface SectorCollectionEntry {
  data: SectorCollectionStoredData
  primitive: Primitive
}

export interface SectorCollectionSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  radius: number
  startAzimuthDegrees: number
  endAzimuthDegrees: number
  segments: number
  topHeight: number
  color: string
  opacity: number
  show: boolean
  targetData: Record<string, unknown>
}

// --- Draw / Sector / index (Draw/Sector/index.ts) ---

export interface AddSectorOptions {
  id?: string
  areaDraft?: boolean
  position?: CircleCenterInput
  center?: CircleCenterInput
  positions?: CircleCenterTuple
  draftVertices?: readonly LngLatHeight[]
  /** 半径（米）；`areaDraft` 时可为 0 */
  radius: number
  /** 起始方位角（度），自北顺时针；草稿定半径阶段可省略 */
  startAzimuthDegrees?: number
  /** 结束方位角（度），自北顺时针；可小于起始角，内部按跨越 360° 展开 */
  endAzimuthDegrees?: number
  /** 圆弧分段数，越大弧边越平滑，默认 32 */
  arcSegments?: number
  style?: PolygonStyleOptions
  extrudedHeight?: number
  color?: string
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
}

export interface UpdateSectorProperties {
  areaDraft?: boolean
  longitude?: number
  latitude?: number
  height?: number
  position?: CircleCenterInput
  center?: CircleCenterInput
  positions?: CircleCenterTuple
  draftVertices?: readonly LngLatHeight[]
  radius?: number
  startAzimuthDegrees?: number
  endAzimuthDegrees?: number
  arcSegments?: number
  extrudedHeight?: number
  color?: string | Color
  alpha?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string | Color
  outlineAlpha?: number
  outlineWidth?: number
  show?: boolean
  description?: string
  targetData?: Record<string, unknown>
  style?: PolygonStyleOptions
}

export interface SectorSnapshot {
  id: string
  longitude: number
  latitude: number
  height: number
  radius: number
  startAzimuthDegrees: number
  endAzimuthDegrees: number
  arcSegments: number
  extrudedHeight: number
  colorCss?: string
  showFill: boolean
  outline?: boolean
  outlineColorCss?: string
  outlineWidth?: number
  show: boolean
  targetData: Record<string, unknown>
  description?: string
}

// --- Draw / Wall / index (Draw/Wall/index.ts) ---

export interface ColorStop {
  /** 位置（0-1） */
  position: number;
  /** 颜色（支持CSS字符串或Cesium.Color） */
  color: string | Cesium.Color;
  /** 透明度（0-1），可选，会叠加到颜色上 */
  alpha?: number;
}

export interface GradientMaterialOptions {
  /** 起始颜色（用于双色渐变） */
  startColor?: string | Cesium.Color;
  /** 结束颜色（用于双色渐变） */
  endColor?: string | Cesium.Color;
  /** 多色渐变颜色节点列表（用于多色渐变） */
  colorStops?: ColorStop[];
}

export interface ImageMaterialOptions {
  /** 图片URL */
  url: string;
  /** 透明度（0-1），默认1 */
  alpha?: number;
  /** 颜色调制（默认白色） */
  color?: Cesium.Color;
}

export interface WallStyleOptions {
  /** 材质类型 */
  type?: MaterialType;
  /** 纯色材质配置（type='color'时使用） */
  color?: string | Cesium.Color;
  /** 渐变材质配置（type='gradientVertical'/'gradientHorizontal'/'gradientMultiColor'时使用） */
  gradient?: GradientMaterialOptions;
  /** 图片材质配置（type='imageRepeat'/'imageStretch'时使用） */
  image?: ImageMaterialOptions;
  /** 图片重复次数（仅 type='imageRepeat' 时有效） */
  repeat?: { x: number; y: number };
  /** 是否显示轮廓 */
  outline?: boolean;
  /** 轮廓颜色 */
  outlineColor?: Cesium.Color | string;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否填充 */
  fill?: boolean;
  /** 粒度（弧度） */
  granularity?: number;
  /** 最大高度数组 */
  maximumHeights?: number[];
  /** 最小高度数组 */
  minimumHeights?: number[];
  /** 分类类型 */
  classificationType?: Cesium.ClassificationType;
  /** Z轴索引 */
  zIndex?: number;
  /** 距离显示条件 */
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
}

export interface AddWallOptions {
  id?: string;
  /** 轮廓点数组（至少2个点） */
  positions: WallPosition[];
  /** 空域管理鼠标绘制草稿：放宽顶点数校验，取消时 `remove(id)` 即可不留痕 */
  areaDraft?: boolean;
  style?: WallStyleOptions;

  // ========== 快捷方式 ==========
  /** 快捷方式：材质类型 */
  materialType?: MaterialType;
  /** 快捷方式：纯色（CSS颜色字符串） */
  color?: string;
  /** 快捷方式：图片URL */
  imageUrl?: string;
  /** 快捷方式：渐变起始颜色 */
  gradientStartColor?: string | Cesium.Color;
  /** 快捷方式：渐变结束颜色 */
  gradientEndColor?: string | Cesium.Color;
  /** 快捷方式：渐变方向（默认vertical） */
  gradientDirection?: "vertical" | "horizontal";
  /** 快捷方式：多色渐变颜色节点 */
  colorStops?: ColorStop[];
  /** 图片平铺重复（仅 imageRepeat；与 style.repeat 二选一即可） */
  repeat?: { x: number; y: number };

  /** 墙体高度（米），当 positions 为二维点时使用 */
  height?: number;
  /** 拉伸高度（米），从地面拉伸到此高度 */
  extrudedHeight?: number;
  /** 是否贴地 */
  clampToGround?: boolean;
  show?: boolean;
  description?: string;
  /** 自定义业务数据 */
  targetData?: Record<string, unknown>;
}

export interface UpdateWallProperties {
  positions?: WallPosition[];
  /** 传 `false` 且原为草稿时，提交为正式墙体（仍须 ≥2 顶点） */
  areaDraft?: boolean;
  materialType?: MaterialType;
  color?: string | Cesium.Color;
  imageUrl?: string;
  repeat?: { x: number; y: number };
  gradientStartColor?: string | Cesium.Color;
  gradientEndColor?: string | Cesium.Color;
  gradientDirection?: "vertical" | "horizontal";
  colorStops?: ColorStop[];
  height?: number;
  extrudedHeight?: number;
  clampToGround?: boolean;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
  style?: WallStyleOptions;
  fill?: boolean;
  outline?: boolean;
  outlineColor?: string | Cesium.Color;
  outlineWidth?: number;
}

export interface WallSnapshot {
  id: string;
  positions: Cesium.Cartesian3[];
  materialType: MaterialType;
  colorCss?: string;
  imageUrl?: string;
  repeat?: { x: number; y: number };
  gradientStartColorCss?: string;
  gradientEndColorCss?: string;
  gradientDirection?: "vertical" | "horizontal";
  colorStops?: Array<{ position: number; colorCss: string; alpha?: number }>;
  height?: number;
  extrudedHeight?: number;
  clampToGround: boolean;
  show: boolean;
  targetData: Record<string, unknown>;
  description?: string;
  fill: boolean;
  outline: boolean;
  outlineWidth?: number;
}

// --- Layer / gridImagery (Layer/gridImagery.ts) ---

export interface LayerGridStyleOptions {
  /** 每瓦片网格划分数，越小越疏。 @default 4 */
  cells?: number
  /** 网格线颜色（CSS），如 `rgba(160,160,160,0.35)` */
  lineColor?: string
  /** 瓦片底色（CSS）；`transparent` 表示不铺底 */
  backgroundColor?: string
  /** 光晕线宽；默认 0 关闭 Cesium 粗光晕 */
  glowWidth?: number
}

// --- Layer / types (Layer/types.ts) ---

export interface LayerCenter {
  longitude: number
  latitude: number
  height: number
}

export interface LayerCameraOrientation {
  headingDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
}

export interface LayerInitialCameraOptions {
  /** 为 true 时使用 flyTo，否则 setView。 @default false */
  useAnimation?: boolean
  /** flyTo 时长（秒）。 @default 2 */
  duration?: number
  /** 透传给 Camera.flyTo 的其它字段（如 easingFunction、maximumHeight 等），会与 destination/orientation 合并。 */
  flyToOverrides?: Omit<Parameters<Camera['flyTo']>[0], 'destination' | 'orientation' | 'duration'>
}

export interface LayerPerformanceInitConfig {
  /** 按需渲染。 */
  requestRenderMode?: boolean
  /** 与 requestRenderMode 配合，超过该时间（秒）强制渲染一帧。 */
  maximumRenderTimeChange?: number
  /** 使用浏览器建议分辨率（Viewer 属性）。 */
  useBrowserRecommendedResolution?: boolean
  /** 在场景左上角显示 Cesium 内置 FPS。 */
  showFps?: boolean
  /** WebGL 多重采样（若 Viewer/context 支持）。 */
  msaaSamples?: number
}

export interface LayerUiInitConfig {
  /** 是否显示简易比例尺（自绘 DOM，非 Cesium 内置控件）。 @default false */
  showScaleBar?: boolean
  /** 是否显示当前大致缩放层级文字。 @default false */
  showTileLevelOverlay?: boolean
  /** 是否显示简易罗盘（自绘 DOM，指示相机航向）。 @default false */
  showCompassOverlay?: boolean
  /** 是否显示 cesium-navigation 导航罗盘（左下角，位于比例尺上方）。 @default false */
  showNavigationControl?: boolean
  /** 画布鼠标 CSS cursor，如 `grab`、`pointer`、`crosshair`。 */
  initialCursor?: string
}

export interface LayerInitConfig {
  mapName?: string
  ionAccessToken?: string

  /** 地图中心：经纬高（度 / 米）。 */
  center: LayerCenter
  /** 相机朝向（度）；默认 pitch -45° 俯视。 */
  orientation?: LayerCameraOrientation
  /** 初次定位：无动画 setView 或有动画 flyTo。 */
  initialCamera?: LayerInitialCameraOptions

  /** 初始化完成后是否自动叠加网格影像层。 @default false */
  showGridAtStartup?: boolean
  /** 简化网格样式（线色、疏密等）；未传则用 Layer 内置细灰线默认。 */
  gridStyle?: LayerGridStyleOptions
  /** 完整 GridImageryProvider 参数，与 `gridStyle` 合并且本字段优先。 */
  gridAtStartupOptions?: GridImageryProvider.ConstructorOptions

  performance?: LayerPerformanceInitConfig
  ui?: LayerUiInitConfig

  imageryUrlTemplate: string
  imageryProviderOptions?: Omit<UrlTemplateImageryProvider.ConstructorOptions, 'url'>
  terrainUrl?: string
  terrainProviderOptions?: CesiumTerrainProvider.ConstructorOptions
  depthTestAgainstTerrain?: boolean
  viewerOptions?: Viewer.ConstructorOptions
}

export interface ImageryLayerInsertOptions {
  insertIndex?: number
}

export interface ImageryLayerVisualParams {
  alpha?: number
  brightness?: number
  contrast?: number
  /** 弧度，与 Cesium.ImageryLayer.hue 一致；也可用 degreesToRadians 在外部换算。 */
  hue?: number
  saturation?: number
  gamma?: number
  nightAlpha?: number
  dayAlpha?: number
}

export interface LayerOverviewMapOptions {
  width?: number
  height?: number
  /** 与主视图相机高度比例，用于鹰眼相机高度（粗略）。 @default 8 */
  heightRatio?: number
  /**
   * 是否双向同步：为 `true`（默认）时主图驱动鹰眼，且可在鹰眼拖拽/滚轮操作主图；
   * 为 `false` 时仅主图→鹰眼，鹰眼不反向影响主图。
   * @default true
   */
  bidirectionalSync?: boolean
  /** 若未传则尝试从主视图首层影像复制 url 模板（UrlTemplateImageryProvider）。 */
  imageryUrlTemplate?: string
  imageryProviderOptions?: Omit<UrlTemplateImageryProvider.ConstructorOptions, 'url'>
}

// --- AreaManager (areaManager/index.ts) ---

/** 与 Draw 各子模块一一对应；`path` 仅支持 `draw` 直接回显（需 `position` 时间属性） */
export type AreaDrawShapeType =
  | 'point'
  | 'label'
  | 'billboard'
  | 'model'
  | 'polyline'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'sector'
  | 'corridor'
  | 'cylinder'
  | 'ellipsoid'
  | 'wall'
  | 'runway'
  | 'box'
  | 'polylineVolume'
  | 'plane'
  | 'path'

export type AreaDrawInteractionMode = 'single' | 'twoClick' | 'threeClick' | 'fourClick' | 'polyline'

/**
 * `draw()` 回显时的落库方式（仅 `draw` 使用，`start` 鼠标绘制固定为 Entity）：
 * - `entity` → 各 Draw 类 `add`
 * - `primitive` → 各 `*Collection` 批量 Primitive
 */
export type AreaDrawRenderMode = 'entity' | 'primitive'

/** 鼠标绘制时的预览样式（锚点 / 跟随点 / 预览线面） */
export interface AreaDrawPreviewStyle {
  /** 已点击固定锚点颜色，默认 `#22cc44` */
  anchorPointColor?: string
  anchorPointPixelSize?: number
  anchorPointOutlineColor?: string
  anchorPointOutlineWidth?: number
  /** 鼠标跟随点颜色，默认 `#22cc44` */
  cursorPointColor?: string
  cursorPointPixelSize?: number
  cursorPointOutlineColor?: string
  cursorPointOutlineWidth?: number
  /** 预览线/面颜色 */
  lineColor?: string
  lineWidth?: number
  fillColor?: string
  fillAlpha?: number
  outlineColor?: string
  outlineWidth?: number
  /**
   * `start` 鼠标预览期间提升场景抗锯齿（FXAA + MSAA），`end`/`cancel` 后恢复；
   * 默认 `true`。
   */
  antialias?: boolean
}

/** 鼠标交互 `start()` 入参（逐点绘制，固定走 Entity，不含 `renderMode`） */
export interface AreaDrawStartParams {
  shapeType: AreaDrawShapeType
  id?: string
  targetData?: Record<string, unknown>
  preview?: AreaDrawPreviewStyle
  /** 矩形/圆：第二点左键后是否自动结束（默认 true） */
  autoFinishOnSecondClick?: boolean
  /** 每新增一个锚点后回调（用于页面同步顶点列表等） */
  /** 第二参数为已落锚点数；mousemove 预览时 points 含光标且 anchorCount 为锚点数 */
  onAnchorChange?: (points: LngLatHeight[], anchorCount?: number) => void
  /** 折线/多边形最终样式，会传给对应 Draw 类 */
  color?: string
  alpha?: number
  width?: number
  showFill?: boolean
  outline?: boolean
  outlineColor?: string
  outlineAlpha?: number
  outlineWidth?: number
  style?: Record<string, unknown>
  description?: string
  show?: boolean
  [key: string]: unknown
}

/** 数据回显 `draw()` 入参：在 `AreaDrawStartParams` 基础上增加 `renderMode` */
export interface AreaDrawDirectParams extends AreaDrawStartParams {
  /** 按数据量选择回显方式，默认 `entity` */
  renderMode?: AreaDrawRenderMode
}

export interface AreaDrawResult {
  id: string
  shapeType: AreaDrawShapeType
  /** 鼠标 `start` 完成恒为 `entity`；`draw` 完成与入参 `renderMode` 一致 */
  renderMode: AreaDrawRenderMode
  /** `entity` 时有值；`primitive` 时通过 id 访问 Collection */
  entity?: import('cesium').Entity
}

/** `draw()` 返回值 */
export interface AreaDrawOutput {
  id: string
  renderMode: AreaDrawRenderMode
  entity?: import('cesium').Entity
}

export type AreaDrawPublishCallback = (result: AreaDrawResult) => void

export interface AreaShapeInteractionRule {
  mode: AreaDrawInteractionMode
  minPoints: number
  interactive: boolean
  /** `draw({ renderMode: 'primitive' })` 是否可用 */
  supportsPrimitive: boolean
}

/** AreaManager 注入的 Entity 绘制 API（各 Draw 子模块） */
export interface AreaManagerEntityApis {
  point: Point
  label: Label
  billboard: Billboard
  model: Model
  polyLine: PolyLine
  polygon: Polygon
  circle: Circle
  rectangle: Rectangle
  sector: Sector
  corridor: Corridor
  cylinder: Cylinder
  ellipsoid: Ellipsoid
  wall: Wall
  runway: Runway
  box: Box
  polylineVolume: PolylineVolume
  plane: Plane
  path: Path
}

/** AreaManager 注入的 Primitive 批量 API（各 Collection 类） */
export interface AreaManagerPrimitiveApis {
  pointCollection: PointCollection
  labelCollection: LabelCollection
  billboardCollection: BillboardCollection
  modelCollection: ModelCollection
  polyLineCollection: PolyLineCollection
  polygonCollection: PolygonCollection
  circleCollection: CircleCollection
  rectangleCollection: RectangleCollection
  sectorCollection: SectorCollection
  corridorCollection: CorridorCollection
  cylinderCollection: CylinderCollection
  ellipsoidCollection: EllipsoidCollection
  runwayCollection: RunwayCollection
  boxCollection: BoxCollection
  polylineVolumeCollection: PolylineVolumeCollection
  planeCollection: PlaneCollection
}

export interface AreaManagerDrawApis extends AreaManagerEntityApis, AreaManagerPrimitiveApis {}

export type AreaManagerOptions = Partial<AreaManagerDrawApis>

// --- MouseEvent (MouseEvent/index.ts) ---

export interface MouseEventPickPayload {
  longitude: number
  latitude: number
  height: number
  /** 绘图缓冲像素坐标（与 Coordinates 拾取一致） */
  x: number
  y: number
  /** 仅滚轮回调中赋值 */
  wheelDelta?: number
}

export interface MouseEventListenOptions {
  onLeftClick?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onLeftDoubleClick?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onLeftDown?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onLeftUp?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onRightClick?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onRightDoubleClick?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onRightDown?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onRightUp?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onMiddleClick?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onMiddleDown?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  onMiddleUp?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  /** 鼠标移动（绘图缓冲坐标拾取） */
  onMouseMove?: (pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void
  /** 第二参数恒为 `undefined`；滚轮增量在 `pick.wheelDelta` */
  onWheel?: (pick: MouseEventPickPayload, entity: undefined) => void
}

// --- Mover (Trajectory/Mover.ts) ---

export interface MoverCallbacks {
  onStart?: () => void
  onStop?: () => void
  onPause?: () => void
  onResume?: () => void
  onComplete?: () => void
  onLoop?: () => void
  onTimeUpdate?: (time: Cesium.JulianDate, progress: number) => void
}

export interface MoverOptions {
  speedMultiplier?: number
  loop?: boolean
  /** 非循环时的播放次数，默认 1；`loop` 为 true 时忽略 */
  playCount?: number
  autoStart?: boolean
}

// --- Trajectory (Trajectory/Trajectory.ts) ---

export interface TrajectoryKeyframe {
  position: Cesium.Cartesian3
  /** 相对 `startTime` 的秒数 */
  timeSeconds: number
}

export interface TrajectoryLngLatKeyframe {
  longitude: number
  latitude: number
  height?: number
  timeSeconds?: number
}

export interface TrajectoryOptions {
  startTime?: Cesium.JulianDate
  /** 时钟终点；与 `durationSeconds` 二选一，优先用二者中较大的区间 */
  endTime?: Cesium.JulianDate
  /** 时钟活动区间（秒）；不小于最后一帧 `timeSeconds` */
  durationSeconds?: number
  /** 插值阶数：1 线性，≥2 埃尔米特 */
  interpolationDegree?: number
}

// --- components / x-map (components/x-map.types.ts) ---

export interface XMapConfig {
  /** 业务地图名，对应 `LayerInitConfig.mapName`。 */
  mapName?: string
  /** 初始中心：经纬度（度）+ 相机高度（米）。 */
  center: LayerCenter
  /** 相机朝向（度）；俯视台湾可设 `pitchDegrees: -90`。 */
  orientation?: LayerCameraOrientation
  /** XYZ / 模板瓦片地址。 */
  imageryUrlTemplate: string
  /** 地形服务地址；不传则 `initMap` 使用椭球地形。 */
  terrainUrl?: string
  /** 首次相机定位是否飞入等。 */
  initialCamera?: LayerInitialCameraOptions
  /** 是否在初始化时创建鹰眼；默认不创建，由「鹰眼」等功能页调用 `setOverviewMapVisible` 开启。 */
  showOverview?: boolean
  /** 鹰眼是否与主图双向操作（拖拽/滚轮改主图）。 @default true */
  overviewBidirectionalSync?: boolean
  overviewWidth?: number
  overviewHeight?: number
  /** 鹰眼相机高度 ≈ 主图高度 ÷ 该值。 */
  overviewHeightRatio?: number
  depthTestAgainstTerrain?: boolean

  /** 初始化完成后是否叠加经纬网格影像层。 @default false */
  showGridAtStartup?: boolean
  /** 简化网格样式；未传则用 Layer 内置细灰线、低密度默认。 */
  gridStyle?: LayerGridStyleOptions
  /** 完整 GridImageryProvider 参数，与 `gridStyle` 合并且本字段优先。 */
  gridAtStartupOptions?: GridImageryProvider.ConstructorOptions
  /**
   * 抗锯齿总开关（与常见 Cesium 写法对齐）：
   * - **MSAA**：通过 Viewer 构造参数 `msaaSamples`（默认 `4`，更高更吃性能；可用 `viewerOptions.msaaSamples` 覆盖）。
   * - **FXAA**：Viewer 构造器无 `fxaa` 字段，需在 `Viewer` 创建后设置 `viewer.scene.postProcessStages.fxaa.enabled`（本组件在 `initMap` 之后替你设为与该项一致）。
   * - 另补充 **WebGL** `contextOptions.webgl.antialias`（画布级），与上两者叠加。
   * 未传或 `true` 视为开启；显式 `false` 时关 FXAA、MSAA 置 `1`、WebGL `antialias` 为 `false`。
   * @default true
   */
  antialias?: boolean
  /** 透传给 `Layer.initMap` 的 `viewerOptions`（会与根据 `antialias` 生成的选项深度合并）。 */
  viewerOptions?: Viewer.ConstructorOptions
}

/** 挂载于 `window.FastX.Types` */
const Types = Object.freeze({})
export default Types

