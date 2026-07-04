/**
 * 抛物面雷达 Primitive 批量绘制类。
 *
 * 批量绘制与单体 Entity 共享参数、几何和动画计算，
 * 底层使用 Primitive 绘制。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import { createPrimitivesFromSpec } from "../common/effect-geometry";
import {
  calcParabolaRadarScanAlpha,
  calcParabolaRadarScanAngle,
  createParabolaRadarAnimationState,
  createParabolaRadarScanStateKey,
  type ParabolaRadarAnimationState,
} from "./animation";
import {
  createParabolaRadarScanBladeFaces,
  createParabolaRadarStaticGeometry,
} from "./geometry";
import {
  resolveParabolaRadarOptions,
  type ParabolaRadarAddOptions,
  type ParabolaRadarResolvedOptions,
  type ParabolaRadarUpdateOptions,
} from ".";

type ParabolaRadarSourceOptions = ParabolaRadarAddOptions & { id: string };

interface ParabolaRadarPrimitiveRecord {
  viewer: Cesium.Viewer;
  id: string;
  /** 用户原始参数，用于合并增量更新。 */
  sourceOptions: ParabolaRadarSourceOptions;
  options: ParabolaRadarResolvedOptions;
  /** 弧面和网格 Primitive。 */
  staticPrimitives: Cesium.Primitive[];
  /** 动态扫描 Primitive，动画状态变化时按量化键重建。 */
  scanPrimitive?: Cesium.Primitive;
  scanStateKey?: string;
  animation: ParabolaRadarAnimationState;
}

interface ParabolaRadarPrimitiveBucket {
  ids: Set<string>;
  removeListener: () => void;
}

/** 多个抛物面雷达 Primitive 绘制类。 */
export default class ParabolaRadarCollection {
  private readonly records = new Map<string, ParabolaRadarPrimitiveRecord>();
  private readonly buckets = new Map<Cesium.Viewer, ParabolaRadarPrimitiveBucket>();

  /** 新增一个抛物面雷达 Primitive，并返回 id。 */
  add(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;

    const id = options.id ?? createSpecialEffectId("parabola-radar-primitive");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    const resolvedOptions = resolveParabolaRadarOptions(sourceOptions);
    const record = this.createRecord(viewer, sourceOptions, resolvedOptions);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增抛物面雷达 Primitive，并返回创建成功的 id。 */
  addMany(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增抛物面雷达 Primitive，并返回创建成功的 id。 */
  addRadars(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新一个抛物面雷达 Primitive。 */
  update(id: string, options: ParabolaRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.buckets.get(record.viewer)?.ids.delete(id);

    const sourceOptions = { ...record.sourceOptions, ...options, id };
    const resolvedOptions = resolveParabolaRadarOptions(sourceOptions);
    const nextRecord = this.createRecord(record.viewer, sourceOptions, resolvedOptions, record.animation.startTime);
    this.records.set(id, nextRecord);
    this.ensureBucket(record.viewer).ids.add(id);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置一个抛物面雷达 Primitive 的显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    record.options.show = visible;
    record.sourceOptions.show = visible;
    [...record.staticPrimitives, record.scanPrimitive].forEach((primitive) => {
      if (primitive) primitive.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 根据特效 id 获取 Primitive 列表。 */
  get(id: string): Cesium.Primitive[] | undefined {
    const record = this.records.get(id);
    return record ? [...record.staticPrimitives, ...(record.scanPrimitive ? [record.scanPrimitive] : [])] : undefined;
  }

  /** 获取所有 id，可按 Viewer 过滤。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 移除一个抛物面雷达 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空抛物面雷达 Primitive，可按 Viewer 过滤。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理的全部抛物面雷达 Primitive。 */
  destroy(): void {
    this.clear();
  }

  private createRecord(
    viewer: Cesium.Viewer,
    sourceOptions: ParabolaRadarSourceOptions,
    options: ParabolaRadarResolvedOptions,
    startTime?: number,
  ): ParabolaRadarPrimitiveRecord {
    const staticGeometry = createParabolaRadarStaticGeometry(options);
    const staticPrimitives = createPrimitivesFromSpec(viewer, options.id, staticGeometry, options.show);
    const animation = createParabolaRadarAnimationState(startTime);
    const scanPrimitiveState = this.createScanPrimitive(viewer, options, animation);

    return {
      viewer,
      id: options.id,
      sourceOptions,
      options,
      staticPrimitives,
      scanPrimitive: scanPrimitiveState.primitive,
      scanStateKey: scanPrimitiveState.stateKey,
      animation,
    };
  }

  private removeRecordPrimitives(record: ParabolaRadarPrimitiveRecord): void {
    [...record.staticPrimitives, record.scanPrimitive].forEach((primitive) => {
      if (primitive) removePrimitive(record.viewer, primitive);
    });
    record.staticPrimitives = [];
    record.scanPrimitive = undefined;
    record.scanStateKey = undefined;
  }

  private ensureBucket(viewer: Cesium.Viewer): ParabolaRadarPrimitiveBucket {
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

  private updateAnimation(viewer: Cesium.Viewer): void {
    let hasVisibleScan = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;

      const nextStateKey = createParabolaRadarScanStateKey(record.options, record.animation);
      if (nextStateKey !== record.scanStateKey) {
        removePrimitive(record.viewer, record.scanPrimitive);
        const scanPrimitiveState = this.createScanPrimitive(record.viewer, record.options, record.animation);
        record.scanPrimitive = scanPrimitiveState.primitive;
        record.scanStateKey = scanPrimitiveState.stateKey;
      }

      if (record.scanPrimitive) record.scanPrimitive.show = record.options.show;
      hasVisibleScan = hasVisibleScan || record.options.show;
    });

    if (hasVisibleScan) requestSceneRender(viewer);
  }

  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener();
    this.buckets.delete(viewer);
  }

  private createScanPrimitive(
    viewer: Cesium.Viewer,
    options: ParabolaRadarResolvedOptions,
    animation: ParabolaRadarAnimationState,
  ): { primitive?: Cesium.Primitive; stateKey: string } {
    const color = Cesium.Color.clone(options.scanBladeColor);
    color.alpha = calcParabolaRadarScanAlpha(options.scanBladeAlpha, options.scanBlink, animation);
    const angle = calcParabolaRadarScanAngle(options, animation);
    const faces = createParabolaRadarScanBladeFaces(options, angle, color);
    const stateKey = createParabolaRadarScanStateKey(options, animation);
    const [primitive] = createPrimitivesFromSpec(viewer, `${options.id}-scan-blade`, { faces, lines: [] }, options.show);
    return { primitive, stateKey };
  }
}
