/**
 * 扇弧形雷达扫描特效。
 * 基于 Cesium 局部椭球扇区绘制外层扇弧形，并叠加内部扇弧形扫描块。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import {
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  removePrimitive,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";
import { createSectorArcRadarScanMaterial } from "./material";

/** 外层扇弧形默认填充色。 */
export const DEFAULT_SECTOR_ARC_RADAR_SCAN_COLOR = new Cesium.Color(0, 110 / 255, 1, 0.5);
/** 外层扇弧形默认轮廓颜色。 */
export const DEFAULT_SECTOR_ARC_RADAR_SCAN_LINE_COLOR = new Cesium.Color(1, 0, 0, 1);
/** 内部扫描块默认填充色。 */
export const DEFAULT_SECTOR_ARC_RADAR_SCAN_BLOCK_COLOR = Cesium.Color.YELLOW;
/** 内部扫描块默认轮廓颜色。 */
export const DEFAULT_SECTOR_ARC_RADAR_SCAN_BLOCK_LINE_COLOR = new Cesium.Color(50 / 255, 204 / 255, 92 / 255, 1);

/** 与视域分析扇形椭球轮廓一致的垂直锥角偏移。 */
const VIEW_SHED_CONE_OFFSET_DEGREES = 7.75;
/** 默认垂直张角，保持与视域分析默认值一致。 */
const DEFAULT_VERTICAL_ANGLE = 60;
/** Cesium 椭球锥角上下界必须留有间隔，垂直张角不能无限增大。 */
const MAX_VERTICAL_ANGLE = 82;
/** 扫描块相对外层扇弧形的半径外扩比例，用于避免共面深度闪烁。 */
const SCAN_SURFACE_OFFSET_RATIO = 0.002;
/** 扇弧形几何时钟角平移量，避开 Cesium 椭球纹理坐标 0/1 接缝。 */
const CLOCK_SEAM_OFFSET_DEGREES = 180;
/** 扫描模式切换时的短暂隐藏区间比例。 */
const SCAN_SWITCH_HIDE_RATIO = 0.04;
/** 扫描动画状态量化精度，降低真实几何扫描块的重建频率。 */
const SCAN_STATE_PROGRESS_STEPS = 180;

/** 扇弧形渲染层级。 */
export type SectorArcRadarRenderLayer = "outer" | "scan";

/** 扇弧形雷达扫描新增参数。 */
export interface SectorArcRadarScanAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 扇弧形顶点位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 外层扇弧形纯色填充色。默认 rgba(0,110,255,0.5)。 */
  color?: SpecialEffectsColorInput;
  /** 外层扇弧形轮廓颜色。默认 #ff0000。 */
  lineColor?: SpecialEffectsColorInput;
  /** 扇弧形半径，单位：米。默认 3000。 */
  maxRadius?: number;
  /** 水平张角，单位：度。默认 90。 */
  angle?: number;
  /** 垂直张角，单位：度。默认 60。 */
  verticalAngle?: number;
  /** 轮廓细分数，数值越大弧线越平滑。默认 128。 */
  segments?: number;
  /** 径向细分数。默认 32。 */
  radialSegments?: number;
  /** 是否显示内部扫描扇弧形块。默认 true。 */
  scanVisible?: boolean;
  /** 内部扫描扇弧形块填充色。默认 #ffff00。 */
  scanColor?: SpecialEffectsColorInput;
  /** 内部扫描扇弧形块轮廓颜色。默认 #32cc5c。 */
  scanLineColor?: SpecialEffectsColorInput;
  /** 内部扫描扇弧形块占外层扇弧形的比例，取值 0~1。默认 0.18。 */
  scanAngleRatio?: number;
  /** 扫描动画完整循环时长，单位：毫秒。默认 6000。 */
  duration?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
  /** 动画开始时间戳；更新时用于保持动画相位连续。 */
  startTime?: number;
}

/** 扇弧形雷达扫描更新参数。 */
export type SectorArcRadarScanUpdateOptions = Partial<Omit<SectorArcRadarScanAddOptions, "id">>;

/** 扇弧形雷达扫描解析后的参数。 */
export interface SectorArcRadarScanResolvedOptions {
  /** 唯一 id。 */
  id: string;
  /** 扇弧形顶点位置。 */
  position: Cesium.Cartesian3;
  /** 航向角，单位：度。 */
  heading: number;
  /** 俯仰角，单位：度。 */
  pitch: number;
  /** 翻滚角，单位：度。 */
  roll: number;
  /** 整体缩放。 */
  scale: number;
  /** 外层纯色填充色。 */
  color: Cesium.Color;
  /** 外层轮廓颜色。 */
  lineColor: Cesium.Color;
  /** 外层轮廓线宽。 */
  lineWidth: number;
  /** 扇弧形半径，单位：米。 */
  maxRadius: number;
  /** 水平张角，单位：度。 */
  angle: number;
  /** 垂直张角，单位：度。 */
  verticalAngle: number;
  /** 轮廓细分数。 */
  segments: number;
  /** 径向细分数。 */
  radialSegments: number;
  /** 是否显示内部扫描块。 */
  scanVisible: boolean;
  /** 内部扫描块填充色。 */
  scanColor: Cesium.Color;
  /** 内部扫描块轮廓色。 */
  scanLineColor: Cesium.Color;
  /** 内部扫描块尺寸比例。 */
  scanAngleRatio: number;
  /** 动画时长。 */
  duration: number;
  /** 是否显示。 */
  show: boolean;
  /** 动画开始时间戳。 */
  startTime: number;
}

/** 扇弧形椭球角度范围。 */
export interface SectorArcRadarAngles {
  /** 最小水平时钟角，弧度。 */
  minimumClock: number;
  /** 最大水平时钟角，弧度。 */
  maximumClock: number;
  /** 最小垂直锥角，弧度。 */
  minimumCone: number;
  /** 最大垂直锥角，弧度。 */
  maximumCone: number;
}

/** 扫描块当前动画状态。 */
export interface SectorArcRadarScanState {
  /** 扫描模式：vertical 为上下扫描，horizontal 为右左扫描。 */
  mode: "vertical" | "horizontal";
  /** 当前模式下的扫描进度。 */
  progress: number;
  /** 当前帧是否显示扫描块。 */
  visible: boolean;
}

/** Primitive 路径下的扫描层对象。 */
export interface SectorArcRadarScanPrimitiveBundle {
  /** 承载 Shader 扫描效果的 Primitive。 */
  primitive: Cesium.Primitive;
  /** 当前扫描几何量化状态 key。 */
  stateKey: string;
}

/** 扇弧形雷达扫描单体内部记录。 */
interface SectorArcRadarScanRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 特效唯一 id。 */
  id: string;
  /** 外层扇弧形 Entity 集合。 */
  entities: Cesium.Entity[];
  /** 内部真实几何扫描块 Primitive。 */
  scanPrimitive?: Cesium.Primitive;
  /** 当前扫描几何量化状态 key。 */
  scanStateKey?: string;
  /** 解析后的参数。 */
  options: SectorArcRadarScanResolvedOptions;
  /** 移除动画刷新监听。 */
  removeRenderListener: () => void;
}

/** 扇弧形雷达扫描 Entity 单体绘制类。 */
export default class SectorArcRadarScan {
  /** 兼容 new SectorArcRadarScan(viewer).add(options) 的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的扇弧形雷达扫描记录。 */
  private readonly records = new Map<string, SectorArcRadarScanRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
  }

  /** 新增一个扇弧形雷达扫描，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: SectorArcRadarScanAddOptions): string | undefined;
  add(options: SectorArcRadarScanAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | SectorArcRadarScanAddOptions,
    maybeOptions?: SectorArcRadarScanAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;

    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("sector-arc-radar-scan");
    if (this.records.has(id) || viewer.entities.getById(`${id}-outer`)) return undefined;

    const effectOptions = resolveSectorArcRadarScanOptions({ ...options, id });
    const record = this.createRecord(viewer, effectOptions);
    this.records.set(id, record);
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增扇弧形雷达扫描 Entity，返回成功创建的 id。 */
  addScans(viewer: Cesium.Viewer, options: SectorArcRadarScanAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 更新指定扇弧形雷达扫描。 */
  update(id: string, options: SectorArcRadarScanUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecord(record);
    const nextOptions = resolveSectorArcRadarScanOptions({
      ...record.options,
      ...options,
      id,
      position: options.position ?? record.options.position,
      startTime: record.options.startTime,
    });
    const nextRecord = this.createRecord(record.viewer, nextOptions);
    this.records.set(id, nextRecord);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定扇弧形雷达扫描显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entities.forEach((entity) => {
      entity.show = visible;
    });
    if (record.scanPrimitive) record.scanPrimitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定扇弧形雷达扫描对应的渲染对象集合。 */
  get(id: string): Array<Cesium.Entity | Cesium.Primitive> | undefined {
    const record = this.records.get(id);
    return record ? [...record.entities, ...(record.scanPrimitive ? [record.scanPrimitive] : [])] : undefined;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定扇弧形雷达扫描。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecord(record);
    this.records.delete(id);
    return true;
  }

  /** 清空全部扇弧形雷达扫描；传入 viewer 时只清空该 Viewer 下的对象。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的全部扇弧形雷达扫描。 */
  destroy(): void {
    this.clear();
  }

  /** 创建外层填充与内部扫描块 Entity。 */
  private createRecord(viewer: Cesium.Viewer, options: SectorArcRadarScanResolvedOptions): SectorArcRadarScanRecord {
    const entities = [createSectorArcRadarOuterEntity(viewer, options)];
    const scanBundle = createSectorArcRadarScanPrimitive(`${options.id}-scan`, options, options.show);
    if (scanBundle) viewer.scene.primitives.add(scanBundle.primitive);

    const record: SectorArcRadarScanRecord = {
      viewer,
      id: options.id,
      entities,
      scanPrimitive: scanBundle?.primitive,
      scanStateKey: scanBundle?.stateKey,
      options,
      removeRenderListener: () => undefined,
    };
    const listener = () => this.updateScanAnimation(record);
    if (options.scanVisible) {
      viewer.scene.preRender.addEventListener(listener);
      record.removeRenderListener = () => {
        if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(listener);
      };
    }
    return record;
  }

  /** 移除记录下全部 Entity 和动画监听。 */
  private removeRecord(record: SectorArcRadarScanRecord): void {
    record.removeRenderListener();
    record.entities.forEach((entity) => removeEntity(record.viewer, entity));
    removePrimitive(record.viewer, record.scanPrimitive);
  }

  /** 按量化动画状态更新真实扫描块几何。 */
  private updateScanAnimation(record: SectorArcRadarScanRecord): void {
    if (!record.options.scanVisible) return;
    const state = calcSectorArcRadarScanState(record.options);
    const nextStateKey = createSectorArcRadarScanStateKey(state);
    if (nextStateKey === record.scanStateKey) {
      if (record.scanPrimitive) record.scanPrimitive.show = record.options.show && state.visible;
      if (record.options.show && state.visible) requestSceneRender(record.viewer);
      return;
    }

    removePrimitive(record.viewer, record.scanPrimitive);
    const scanBundle = createSectorArcRadarScanPrimitive(`${record.id}-scan`, record.options, record.options.show, state);
    record.scanPrimitive = scanBundle?.primitive;
    record.scanStateKey = nextStateKey;
    if (scanBundle) record.viewer.scene.primitives.add(scanBundle.primitive);
    if (record.options.show && state.visible) requestSceneRender(record.viewer);
  }

  /** 兼容 add(viewer, options) 和 new Class(viewer).add(options) 两种调用方式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | SectorArcRadarScanAddOptions,
    maybeOptions?: SectorArcRadarScanAddOptions,
  ): { viewer: Cesium.Viewer; options: SectorArcRadarScanAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as SectorArcRadarScanAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}

/** 合并扇弧形雷达扫描默认参数。 */
export function resolveSectorArcRadarScanOptions(
  options: SectorArcRadarScanAddOptions & { id: string },
): SectorArcRadarScanResolvedOptions {
  return {
    id: options.id,
    position: toCartesian3(options.position),
    heading: options.heading ?? 0,
    pitch: options.pitch ?? 0,
    roll: options.roll ?? 0,
    scale: normalizePositiveNumber(options.scale, 1),
    color: toCesiumColor(options.color, DEFAULT_SECTOR_ARC_RADAR_SCAN_COLOR),
    lineColor: toCesiumColor(options.lineColor, DEFAULT_SECTOR_ARC_RADAR_SCAN_LINE_COLOR),
    lineWidth: 1,
    maxRadius: normalizePositiveNumber(options.maxRadius, 3000),
    angle: clampNumber(options.angle ?? 90, 1, 359),
    verticalAngle: clampNumber(options.verticalAngle ?? DEFAULT_VERTICAL_ANGLE, 1, MAX_VERTICAL_ANGLE),
    segments: Math.max(8, Math.floor(options.segments ?? 128)),
    radialSegments: Math.max(2, Math.floor(options.radialSegments ?? 32)),
    scanVisible: options.scanVisible ?? true,
    scanColor: toCesiumColor(options.scanColor, DEFAULT_SECTOR_ARC_RADAR_SCAN_BLOCK_COLOR),
    scanLineColor: toCesiumColor(options.scanLineColor, DEFAULT_SECTOR_ARC_RADAR_SCAN_BLOCK_LINE_COLOR),
    scanAngleRatio: clampNumber(options.scanAngleRatio ?? 0.18, 0.02, 1),
    duration: normalizePositiveNumber(options.duration, 6000),
    show: options.show ?? true,
    startTime: options.startTime ?? Date.now(),
  };
}

/** 创建外层扇弧形 Entity，包含纯色填充和轮廓。 */
export function createSectorArcRadarOuterEntity(
  viewer: Cesium.Viewer,
  options: SectorArcRadarScanResolvedOptions,
): Cesium.Entity {
  const radius = getSectorArcRadarEntityRadius(options, "outer");
  const angles = createSectorArcRadarOuterAngles(options);
  return viewer.entities.add({
    id: `${options.id}-outer`,
    name: "FastX Sector Arc Radar Scan Outer",
    show: options.show,
    position: options.position,
    orientation: createSectorArcRadarSketchOrientation(options),
    ellipsoid: {
      radii: new Cesium.Cartesian3(radius, radius, radius),
      innerRadii: new Cesium.Cartesian3(0.01, 0.01, 0.01),
      minimumClock: angles.minimumClock,
      maximumClock: angles.maximumClock,
      minimumCone: angles.minimumCone,
      maximumCone: angles.maximumCone,
      fill: true,
      material: new Cesium.ColorMaterialProperty(options.color),
      outline: true,
      outlineColor: options.lineColor,
      outlineWidth: options.lineWidth,
      subdivisions: options.segments,
      stackPartitions: options.radialSegments,
      slicePartitions: options.radialSegments,
    },
  });
}

/** 创建 Primitive 路径使用的外层纯色填充 Primitive。 */
export function createSectorArcRadarFillPrimitive(
  id: string,
  options: SectorArcRadarScanResolvedOptions,
  color = options.color,
  angles = createSectorArcRadarOuterAngles(options),
  show = true,
  layer: SectorArcRadarRenderLayer = "outer",
): Cesium.Primitive {
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: createSectorArcRadarFillGeometry(options, angles, layer),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: color.alpha < 1,
      closed: false,
    }),
    asynchronous: false,
    modelMatrix: createSectorArcRadarSketchModelMatrix(options),
    show,
  });
}

/** 创建 Primitive 路径使用的扇弧形轮廓 Primitive。 */
export function createSectorArcRadarOutlinePrimitive(
  id: string,
  options: SectorArcRadarScanResolvedOptions,
  show = true,
  angles = createSectorArcRadarOuterAngles(options),
  color = options.lineColor,
  layer: SectorArcRadarRenderLayer = "outer",
): Cesium.Primitive {
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: createSectorArcRadarOutlineGeometry(options, angles, layer),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: color.alpha < 1,
    }),
    asynchronous: false,
    modelMatrix: createSectorArcRadarSketchModelMatrix(options),
    show,
  });
}

/** 创建 Primitive 路径使用的 Shader 扫描层。 */
export function createSectorArcRadarScanPrimitive(
  id: string,
  options: SectorArcRadarScanResolvedOptions,
  show = true,
  state = calcSectorArcRadarScanState(options),
): SectorArcRadarScanPrimitiveBundle | undefined {
  if (!options.scanVisible) return undefined;
  const angles = createSectorArcRadarScanAngles(options, state);
  const material = createSectorArcRadarScanMaterial(options);
  const primitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: createSectorArcRadarScanGeometry(options, angles),
    }),
    appearance: new Cesium.MaterialAppearance({
      material,
      faceForward: true,
      flat: true,
      translucent: true,
      closed: false,
    }),
    asynchronous: false,
    modelMatrix: createSectorArcRadarSketchModelMatrix(options),
    show: show && state.visible,
  });
  return { primitive, stateKey: createSectorArcRadarScanStateKey(state) };
}

/** 计算扇弧形椭球朝向，保持与视域分析 drawSketchEllipsoid 一致。 */
export function createSectorArcRadarSketchOrientation(options: SectorArcRadarScanResolvedOptions): Cesium.Quaternion {
  return Cesium.Transforms.headingPitchRollQuaternion(
    options.position,
    Cesium.HeadingPitchRoll.fromDegrees(options.heading - 90 - CLOCK_SEAM_OFFSET_DEGREES, options.pitch, options.roll),
  );
}

/** 创建 Primitive 椭球扇弧形的模型矩阵。 */
export function createSectorArcRadarSketchModelMatrix(options: SectorArcRadarScanResolvedOptions): Cesium.Matrix4 {
  return Cesium.Matrix4.fromTranslationQuaternionRotationScale(
    options.position,
    createSectorArcRadarSketchOrientation(options),
    new Cesium.Cartesian3(options.scale, options.scale, options.scale),
    new Cesium.Matrix4(),
  );
}

/** 创建外层扇弧形角度范围。 */
export function createSectorArcRadarOuterAngles(options: SectorArcRadarScanResolvedOptions): SectorArcRadarAngles {
  return {
    minimumClock: Cesium.Math.toRadians(CLOCK_SEAM_OFFSET_DEGREES - options.angle / 2),
    maximumClock: Cesium.Math.toRadians(CLOCK_SEAM_OFFSET_DEGREES + options.angle / 2),
    minimumCone: Cesium.Math.toRadians(options.verticalAngle + VIEW_SHED_CONE_OFFSET_DEGREES),
    maximumCone: Cesium.Math.toRadians(180 - options.verticalAngle - VIEW_SHED_CONE_OFFSET_DEGREES),
  };
}

/** 计算当前扫描块真实几何角度范围。 */
export function createSectorArcRadarScanAngles(
  options: SectorArcRadarScanResolvedOptions,
  state = calcSectorArcRadarScanState(options),
): SectorArcRadarAngles {
  const outer = createSectorArcRadarOuterAngles(options);
  const span = getSectorArcRadarScanAngleSpan(options, outer);
  if (state.mode === "vertical") {
    const bottomStart = outer.maximumCone - span;
    const topStart = outer.minimumCone;
    const minimumCone = Cesium.Math.lerp(bottomStart, topStart, state.progress);
    return {
      minimumClock: outer.minimumClock,
      maximumClock: outer.maximumClock,
      minimumCone,
      maximumCone: minimumCone + span,
    };
  }

  const rightStart = outer.maximumClock - span;
  const leftStart = outer.minimumClock;
  const minimumClock = Cesium.Math.lerp(rightStart, leftStart, state.progress);
  return {
    minimumClock,
    maximumClock: minimumClock + span,
    minimumCone: outer.minimumCone,
    maximumCone: outer.maximumCone,
  };
}

/** 统一计算上下、左右扫描块的实际角跨度，保证两个扫描方向宽度一致。 */
function getSectorArcRadarScanAngleSpan(
  options: SectorArcRadarScanResolvedOptions,
  outer: SectorArcRadarAngles,
): number {
  const ratio = clampNumber(options.scanAngleRatio, 0.02, 1);
  const horizontalSpan = outer.maximumClock - outer.minimumClock;
  const verticalSpan = outer.maximumCone - outer.minimumCone;
  return Math.min(horizontalSpan, verticalSpan) * ratio;
}

/** 计算扫描块当前动画状态。 */
export function calcSectorArcRadarScanState(options: SectorArcRadarScanResolvedOptions): SectorArcRadarScanState {
  const hide = SCAN_SWITCH_HIDE_RATIO;
  const active = (1 - hide) / 4;
  const elapsed = ((Date.now() - options.startTime) % options.duration) / options.duration;

  if (elapsed < active) return { mode: "vertical", progress: elapsed / active, visible: true };
  if (elapsed < active * 2) return { mode: "vertical", progress: 1 - (elapsed - active) / active, visible: true };
  if (elapsed < active * 2 + hide) return { mode: "vertical", progress: 0, visible: false };
  if (elapsed < active * 3 + hide) {
    return { mode: "horizontal", progress: (elapsed - active * 2 - hide) / active, visible: true };
  }
  return { mode: "horizontal", progress: 1 - (elapsed - active * 3 - hide) / active, visible: true };
}

/** 生成扫描几何量化状态 key。 */
export function createSectorArcRadarScanStateKey(state: SectorArcRadarScanState): string {
  if (!state.visible) return `${state.mode}:hidden`;
  return `${state.mode}:${Math.round(clampNumber(state.progress, 0, 1) * SCAN_STATE_PROGRESS_STEPS)}`;
}

/** 创建扇弧形纯色填充几何。 */
export function createSectorArcRadarFillGeometry(
  options: SectorArcRadarScanResolvedOptions,
  angles = createSectorArcRadarOuterAngles(options),
  layer: SectorArcRadarRenderLayer = "outer",
  vertexFormat: Cesium.VertexFormat = Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
): Cesium.EllipsoidGeometry {
  const radius = getSectorArcRadarPrimitiveRadius(options, layer);
  return new Cesium.EllipsoidGeometry({
    radii: new Cesium.Cartesian3(radius, radius, radius),
    innerRadii: createSectorArcRadarInnerRadii(),
    minimumClock: angles.minimumClock,
    maximumClock: angles.maximumClock,
    minimumCone: angles.minimumCone,
    maximumCone: angles.maximumCone,
    stackPartitions: options.radialSegments,
    slicePartitions: options.radialSegments,
    vertexFormat,
  });
}

/** 创建带完整体块面的 Shader 扫描几何，并重写 st 使内外面扫描坐标一致。 */
export function createSectorArcRadarScanGeometry(
  options: SectorArcRadarScanResolvedOptions,
  angles = createSectorArcRadarScanAngles(options),
): Cesium.Geometry {
  const geometry = Cesium.EllipsoidGeometry.createGeometry(
    createSectorArcRadarFillGeometry(
      options,
      angles,
      "scan",
      Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    ),
  );
  if (!geometry) throw new Error("Failed to create sector arc radar scan geometry.");
  normalizeSectorArcRadarScanSt(geometry, angles);
  return geometry;
}

/** 创建扇弧形轮廓几何。 */
export function createSectorArcRadarOutlineGeometry(
  options: SectorArcRadarScanResolvedOptions,
  angles = createSectorArcRadarOuterAngles(options),
  layer: SectorArcRadarRenderLayer = "outer",
): Cesium.EllipsoidOutlineGeometry {
  const radius = getSectorArcRadarPrimitiveRadius(options, layer);
  return new Cesium.EllipsoidOutlineGeometry({
    radii: new Cesium.Cartesian3(radius, radius, radius),
    innerRadii: new Cesium.Cartesian3(0.01, 0.01, 0.01),
    minimumClock: angles.minimumClock,
    maximumClock: angles.maximumClock,
    minimumCone: angles.minimumCone,
    maximumCone: angles.maximumCone,
    subdivisions: options.segments,
    stackPartitions: options.radialSegments,
    slicePartitions: options.radialSegments,
  });
}

/** 计算 Primitive 几何半径；扫描层略微外扩，避免和外层填充面共面闪烁。 */
function getSectorArcRadarPrimitiveRadius(
  options: SectorArcRadarScanResolvedOptions,
  layer: SectorArcRadarRenderLayer,
): number {
  return options.maxRadius * (layer === "scan" ? 1 + SCAN_SURFACE_OFFSET_RATIO : 1);
}

/** 计算 Entity 路径真实显示半径。 */
function getSectorArcRadarEntityRadius(
  options: SectorArcRadarScanResolvedOptions,
  layer: SectorArcRadarRenderLayer,
): number {
  return getSectorArcRadarPrimitiveRadius(options, layer) * options.scale;
}

/** 创建近似实体扇弧形内半径，保证扫描体块和外层主体都完整闭合。 */
function createSectorArcRadarInnerRadii(): Cesium.Cartesian3 {
  return new Cesium.Cartesian3(0.01, 0.01, 0.01);
}

/** 将扫描几何的纹理坐标按顶点位置重建，避免内表面法线反向造成坐标折叠。 */
function normalizeSectorArcRadarScanSt(geometry: Cesium.Geometry, angles: SectorArcRadarAngles): void {
  const positions = geometry.attributes.position?.values;
  const st = geometry.attributes.st?.values;
  if (!positions || !st) return;

  const minZ = Math.cos(angles.maximumCone);
  const maxZ = Math.cos(angles.minimumCone);
  const spanZ = Math.max(maxZ - minZ, 0.0001);
  const clockSpan = Math.max(angles.maximumClock - angles.minimumClock, 0.0001);
  for (let stIndex = 0, positionIndex = 0; stIndex < st.length; stIndex += 2, positionIndex += 3) {
    const x = Number(positions[positionIndex]);
    const y = Number(positions[positionIndex + 1]);
    const z = Number(positions[positionIndex + 2]);
    const radius = Math.max(Math.hypot(x, y, z), 0.0001);
    const clock = normalizeClockAngle(Math.atan2(y, x), angles.minimumClock, angles.maximumClock);
    st[stIndex] = clampNumber((clock - angles.minimumClock) / clockSpan, 0, 1);
    st[stIndex + 1] = clampNumber((z / radius - minZ) / spanZ, 0, 1);
  }
}

/** 将 atan2 得到的时钟角归一到当前扇弧形角度范围内。 */
function normalizeClockAngle(clock: number, minimumClock: number, maximumClock: number): number {
  let nextClock = clock;
  while (nextClock < minimumClock) nextClock += Cesium.Math.TWO_PI;
  while (nextClock > maximumClock) nextClock -= Cesium.Math.TWO_PI;
  return clampNumber(nextClock, minimumClock, maximumClock);
}

/** 规整正数参数，避免非法半径、时长或缩放导致 Cesium 几何异常。 */
function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

/** 将数值限制在指定范围内。 */
function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
