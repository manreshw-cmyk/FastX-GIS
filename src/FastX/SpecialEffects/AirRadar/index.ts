/**
 * 空中扫描雷达特效。
 * Entity 类用于单体绘制，AirRadarCollection 用于 Primitive 批量绘制。
 * 锥体线框/面片叠加绕锥轴旋转的扫描扇面，形成动态雷达扫描效果。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import {
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCesiumColor,
} from "../shared";
import {
  createEntitiesFromSpec,
  createLocalFrame,
  createCircleLocalPoints,
  localPointsToWorld,
  localToWorld,
  resolveSpatialOptions,
  type ResolvedSpatialEffectOptions,
} from "../common/effect-geometry";
import { buildConeLikeSpec, type ConeLikeSpecOptions } from "../common/radar-builders";
export interface AirRadarAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 雷达发射点，通常为飞机或卫星位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0，锥体沿局部 -Z 方向展开。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 雷达锥体颜色。默认 rgba(255,255,0,0.1)。 */
  color?: SpecialEffectsColorInput;
  /** 雷达轮廓线颜色。默认 rgba(0,255,0,0.8)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 扫描扇面颜色。默认 rgba(0,255,120,0.35)。 */
  scanColor?: SpecialEffectsColorInput;
  /** 扫描旋转速度，单位：度/秒。默认 60。 */
  scanSpeed?: number;
  /** 扫描扇面张角，单位：度。默认 24。 */
  scanAngle?: number;
  /** 轮廓线宽度，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 几何分段数。默认 96。 */
  segments?: number;
  /** 探测长度，单位：米。默认 200000。 */
  length?: number;
  /** 雷达张角，单位：度。默认 30。 */
  angle?: number;
  /** 底部半径，单位：米；不传时按 angle 和 length 自动计算。 */
  bottomRadius?: number;
  /** 内部辅助环半径，单位：米。 */
  innerRadius?: number;
  /** 是否显示半透明面。默认 true。 */
  fill?: boolean;
  /** 是否显示。默认 true。 */
  show?: boolean;
  /** 动画开始时间戳；更新时传入可保持扫描相位连续。 */
  startTime?: number;
}

/** 空中扫描雷达更新参数。 */
export type AirRadarUpdateOptions = Partial<Omit<AirRadarAddOptions, "id">>;

/** 空中扫描雷达解析参数。 */
export type AirRadarResolvedOptions = Omit<
  AirRadarAddOptions,
  "position" | "color" | "lineColor" | "scanColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    length: number;
    bottomRadius: number;
    innerRadius: number;
    fill: boolean;
    scanColor: Cesium.Color;
    scanSpeed: number;
    scanAngle: number;
    startTime: number;
  };

/** 空中扫描雷达内部记录。 */
interface AirRadarRecord {
  viewer: Cesium.Viewer;
  id: string;
  entities: Cesium.Entity[];
  options: AirRadarResolvedOptions;
  removeRenderListener: () => void;
}

/** 空中扫描雷达 Entity 单体绘制类。 */
export default class AirRadar {
  private readonly defaultViewer?: Cesium.Viewer;
  private readonly records = new Map<string, AirRadarRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
  }

  add(viewer: Cesium.Viewer, options: AirRadarAddOptions): string | undefined;
  add(options: AirRadarAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | AirRadarAddOptions,
    maybeOptions?: AirRadarAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("air-radar");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const effectOptions = resolveAirRadarOptions({ ...options, id });
    const record = this.createRecord(viewer, effectOptions);
    this.records.set(id, record);
    requestSceneRender(viewer);
    return id;
  }

  addRadars(viewer: Cesium.Viewer, options: AirRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  update(id: string, options: AirRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecord(record);
    const prev = record.options;
    const nextOptions = resolveAirRadarOptions({
      id,
      position: options.position ?? prev.position,
      heading: options.heading !== undefined ? options.heading : prev.heading,
      pitch: options.pitch !== undefined ? options.pitch : prev.pitch,
      roll: options.roll !== undefined ? options.roll : prev.roll,
      scale: options.scale !== undefined ? options.scale : prev.scale,
      color: options.color ?? prev.color,
      lineColor: options.lineColor ?? prev.lineColor,
      scanColor: options.scanColor ?? prev.scanColor,
      scanSpeed: options.scanSpeed !== undefined ? options.scanSpeed : prev.scanSpeed,
      scanAngle: options.scanAngle !== undefined ? options.scanAngle : prev.scanAngle,
      lineWidth: options.lineWidth !== undefined ? options.lineWidth : prev.lineWidth,
      segments: options.segments !== undefined ? options.segments : prev.segments,
      length: options.length !== undefined ? options.length : prev.length,
      angle: options.angle !== undefined ? options.angle : prev.angle,
      bottomRadius: options.bottomRadius !== undefined ? options.bottomRadius : prev.bottomRadius,
      innerRadius: options.innerRadius !== undefined ? options.innerRadius : prev.innerRadius,
      fill: options.fill !== undefined ? options.fill : prev.fill,
      show: options.show !== undefined ? options.show : prev.show,
      startTime: prev.startTime,
    });
    const nextRecord = this.createRecord(record.viewer, nextOptions);
    this.records.set(id, nextRecord);
    requestSceneRender(record.viewer);
    return true;
  }

  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entities.forEach((entity) => {
      entity.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  get(id: string): Cesium.Entity[] | undefined {
    return this.records.get(id)?.entities;
  }

  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecord(record);
    this.records.delete(id);
    return true;
  }

  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  destroy(): void {
    this.clear();
  }

  private createRecord(viewer: Cesium.Viewer, options: AirRadarResolvedOptions): AirRadarRecord {
    const coneSpec = buildConeLikeSpec(options as ConeLikeSpecOptions);
    const entities = createEntitiesFromSpec(viewer, options.id, coneSpec, options.show, "FastX Air Scan Radar");
    const scanEntity = viewer.entities.add({
      id: `${options.id}-scan`,
      name: "FastX Air Scan Radar",
      show: options.show,
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const current = this.records.get(options.id)?.options ?? options;
          return new Cesium.PolygonHierarchy(calcAirRadarScanPositions(current));
        }, false),
        material: options.scanColor,
        perPositionHeight: true,
        outline: true,
        outlineColor: options.lineColor,
        outlineWidth: options.lineWidth,
      },
    });
    entities.push(scanEntity);

    const listener = () => {
      const record = this.records.get(options.id);
      if (record?.options.show) requestSceneRender(viewer);
    };
    viewer.scene.preRender.addEventListener(listener);

    return {
      viewer,
      id: options.id,
      entities,
      options,
      removeRenderListener: () => {
        if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(listener);
      },
    };
  }

  private removeRecord(record: AirRadarRecord): void {
    record.removeRenderListener();
    record.entities.forEach((entity) => removeEntity(record.viewer, entity));
  }

  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | AirRadarAddOptions,
    maybeOptions?: AirRadarAddOptions,
  ): { viewer: Cesium.Viewer; options: AirRadarAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as AirRadarAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}

/** 计算当前扫描扇面顶点（底边沿圆锥底圆弧线，扫描角仅做动画偏移）。 */
export function calcAirRadarScanPositions(options: AirRadarResolvedOptions): Cesium.Cartesian3[] {
  const matrix = calcAirRadarScanMatrix(options);
  const apex = localToWorld([0, 0, 0], matrix);
  const half = options.scanAngle / 2;
  const baseZ = -options.length;
  const arcSegments = Math.max(4, Math.ceil((options.scanAngle / 360) * Math.max(8, options.segments / 4)));
  const arcLocal = createCircleLocalPoints(
    options.bottomRadius,
    arcSegments,
    baseZ,
    -half,
    half,
  );
  const arcWorld = localPointsToWorld(arcLocal, matrix);
  return [apex, ...arcWorld];
}

/** 计算当前扫描扇面的世界变换矩阵。 */
export function calcAirRadarScanMatrix(options: AirRadarResolvedOptions): Cesium.Matrix4 {
  const rotation = Cesium.Matrix4.fromRotationTranslation(
    Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(calcAirRadarScanOffset(options))),
  );
  return Cesium.Matrix4.multiply(createLocalFrame(options), rotation, new Cesium.Matrix4());
}

/** 计算当前扫描扇面的旋转角度偏移，单位：度。 */
export function calcAirRadarScanOffset(options: AirRadarResolvedOptions): number {
  const elapsedSec = (Date.now() - options.startTime) / 1000;
  return (elapsedSec * options.scanSpeed) % 360;
}

/** 合并空中扫描雷达默认参数。 */
export function resolveAirRadarOptions(options: AirRadarAddOptions & { id: string }): AirRadarResolvedOptions {
  const length = options.length ?? 200000;
  const angle = options.angle ?? 30;
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(255,255,0,0.1)")!,
    Cesium.Color.fromCssColorString("rgba(0,255,0,0.8)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    length,
    angle,
    bottomRadius: options.bottomRadius ?? Math.tan(Cesium.Math.toRadians(angle) / 2) * length,
    innerRadius: options.innerRadius ?? 0,
    fill: options.fill ?? true,
    scanColor: toCesiumColor(options.scanColor, Cesium.Color.fromCssColorString("rgba(0,255,120,0.35)")!),
    scanSpeed: options.scanSpeed ?? 60,
    scanAngle: options.scanAngle ?? 24,
    startTime: options.startTime ?? Date.now(),
  };
}
