/**
 * 空中扫描雷达 Primitive 批量绘制类。
 * 批量效果和 AirRadar 单体类保持一致：圆锥线框/面片叠加动态扫描扇面。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import {
  createCircleLocalPoints,
  createFacePrimitiveFromLocalPoints,
  createLocalFrame,
  createPrimitivesFromSpec,
} from "../common/effect-geometry";
import { buildConeLikeSpec, type ConeLikeSpecOptions } from "../common/radar-builders";
import type { AirRadarAddOptions, AirRadarResolvedOptions, AirRadarUpdateOptions } from ".";
import { calcAirRadarScanOffset, resolveAirRadarOptions } from ".";

/** 空中扫描雷达 Primitive 记录。 */
interface AirRadarPrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 特效唯一 id。 */
  id: string;
  /** 圆锥面片和线框 Primitive。 */
  primitives: Cesium.Primitive[];
  /** 动态扫描扇面 Primitive。 */
  scanPrimitive: Cesium.Primitive;
  /** 扫描扇面基础姿态矩阵，不包含动画旋转。 */
  scanBaseMatrix: Cesium.Matrix4;
  /** 已解析参数。 */
  options: AirRadarResolvedOptions;
}

/** Viewer 分桶，用于维护扫描动画刷新监听。 */
interface AirRadarPrimitiveBucket {
  /** 当前 Viewer 下管理的 id 集合。 */
  ids: Set<string>;
  /** 移除 preRender 动画监听。 */
  removeListener: () => void;
}

/** 空中扫描雷达 Primitive 批量绘制类。 */
export default class AirRadarCollection {
  /** 当前类管理的全部 Primitive 记录。 */
  private readonly records = new Map<string, AirRadarPrimitiveRecord>();
  /** 按 Viewer 分桶维护动画刷新监听。 */
  private readonly buckets = new Map<Cesium.Viewer, AirRadarPrimitiveBucket>();

  /** 批量新增空中扫描雷达 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: AirRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个空中扫描雷达 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: AirRadarAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId("air-scan-radar-primitive");
    if (this.records.has(id)) return undefined;

    const resolvedOptions = resolveAirRadarOptions({ ...options, id });
    const record = this.createRecord(viewer, resolvedOptions);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定空中扫描雷达 Primitive。 */
  update(id: string, options: AirRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.buckets.get(record.viewer)?.ids.delete(id);
    const nextOptions = resolveAirRadarOptions({
      id,
      position: options.position ?? record.options.position,
      heading: options.heading ?? record.options.heading,
      pitch: options.pitch ?? record.options.pitch,
      roll: options.roll ?? record.options.roll,
      scale: options.scale ?? record.options.scale,
      color: options.color ?? record.options.color,
      lineColor: options.lineColor ?? record.options.lineColor,
      scanColor: options.scanColor ?? record.options.scanColor,
      scanSpeed: options.scanSpeed ?? record.options.scanSpeed,
      scanAngle: options.scanAngle ?? record.options.scanAngle,
      lineWidth: options.lineWidth ?? record.options.lineWidth,
      segments: options.segments ?? record.options.segments,
      length: options.length ?? record.options.length,
      angle: options.angle ?? record.options.angle,
      bottomRadius: options.bottomRadius ?? record.options.bottomRadius,
      innerRadius: options.innerRadius ?? record.options.innerRadius,
      fill: options.fill ?? record.options.fill,
      show: options.show ?? record.options.show,
      startTime: record.options.startTime,
    });
    const nextRecord = this.createRecord(record.viewer, nextOptions);
    this.records.set(id, nextRecord);
    this.ensureBucket(record.viewer).ids.add(id);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定空中扫描雷达显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.primitives.forEach((primitive) => {
      primitive.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定空中扫描雷达 Primitive 集合。 */
  get(id: string): Cesium.Primitive[] | undefined {
    return this.records.get(id)?.primitives;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定空中扫描雷达。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecordPrimitives(record);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空全部空中扫描雷达；传入 viewer 时只清空该 Viewer 下的对象。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前实例管理的全部空中扫描雷达。 */
  destroy(): void {
    this.clear();
  }

  /** 创建圆锥和扫描面 Primitive 记录。 */
  private createRecord(viewer: Cesium.Viewer, options: AirRadarResolvedOptions): AirRadarPrimitiveRecord {
    const coneSpec = buildConeLikeSpec(options as ConeLikeSpecOptions);
    const primitives = createPrimitivesFromSpec(viewer, options.id, coneSpec, options.show);
    const scanBaseMatrix = createLocalFrame(options);
    const scanPrimitive = this.createScanPrimitive(options, scanBaseMatrix);
    viewer.scene.primitives.add(scanPrimitive);
    primitives.push(scanPrimitive);
    return { viewer, id: options.id, primitives, scanPrimitive, scanBaseMatrix, options };
  }

  /** 创建扫描扇面 Primitive，几何保持局部坐标，动画时只更新 modelMatrix。 */
  private createScanPrimitive(options: AirRadarResolvedOptions, modelMatrix: Cesium.Matrix4): Cesium.Primitive {
    const half = options.scanAngle / 2;
    const arcSegments = Math.max(4, Math.ceil((options.scanAngle / 360) * Math.max(8, options.segments / 4)));
    const localPositions = [
      [0, 0, 0] as const,
      ...createCircleLocalPoints(options.bottomRadius, arcSegments, -options.length, -half, half),
    ];
    return createFacePrimitiveFromLocalPoints(
      `${options.id}-scan`,
      localPositions,
      options.scanColor,
      modelMatrix,
      options.show,
    );
  }

  /** 移除记录下的全部 Primitive。 */
  private removeRecordPrimitives(record: AirRadarPrimitiveRecord): void {
    record.primitives.forEach((primitive) => removePrimitive(record.viewer, primitive));
  }

  /** 获取或创建 Viewer 动画分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): AirRadarPrimitiveBucket {
    let bucket = this.buckets.get(viewer);
    if (!bucket) {
      const listener = () => this.updateAnimation(viewer);
      viewer.scene.preRender.addEventListener(listener);
      bucket = {
        ids: new Set(),
        removeListener: () => {
          if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(listener);
        },
      };
      this.buckets.set(viewer, bucket);
    }
    return bucket;
  }

  /** 更新当前 Viewer 下全部可见空中扫描雷达的扫描扇面矩阵。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    let hasVisible = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record?.options.show) return;
      const rotation = Cesium.Matrix4.fromRotationTranslation(
        Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(calcAirRadarScanOffset(record.options))),
      );
      record.scanPrimitive.modelMatrix = Cesium.Matrix4.multiply(
        record.scanBaseMatrix,
        rotation,
        record.scanPrimitive.modelMatrix,
      );
      hasVisible = true;
    });
    if (hasVisible) requestSceneRender(viewer);
  }

  /** 清理没有记录的 Viewer 分桶。 */
  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener();
    this.buckets.delete(viewer);
  }
}
