/**
 * 扩散雷达 Primitive 批量绘制类。
 *
 * 与单体 Entity 共享参数、几何和动画计算，底层使用 Primitive 绘制。
 */
import * as Cesium from "cesium";
import { createPrimitivesFromSpec } from "../common/effect-geometry";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import {
  createDiffusionRadarAnimationState,
  createDiffusionRadarWaveStateKey,
  type DiffusionRadarAnimationState,
} from "./animation";
import {
  createDiffusionRadarStaticGeometry,
  createDiffusionRadarWaveGeometry,
} from "./geometry";
import {
  resolveDiffusionRadarOptions,
  type DiffusionRadarAddOptions,
  type DiffusionRadarResolvedOptions,
  type DiffusionRadarUpdateOptions,
} from ".";

type DiffusionRadarSourceOptions = DiffusionRadarAddOptions & { id: string };

interface DiffusionRadarPrimitiveRecord {
  viewer: Cesium.Viewer;
  id: string;
  /** 用户原始参数，用于合并增量更新。 */
  sourceOptions: DiffusionRadarSourceOptions;
  /** 几何和动画使用的 Cesium 解析参数。 */
  options: DiffusionRadarResolvedOptions;
  /** 填充面和边界线 Primitive。 */
  staticPrimitives: Cesium.Primitive[];
  /** 动态波纹 Primitive，动画状态变化时按量化键重建。 */
  wavePrimitive?: Cesium.Primitive;
  waveStateKey?: string;
  animation: DiffusionRadarAnimationState;
}

interface DiffusionRadarPrimitiveBucket {
  ids: Set<string>;
  removeListener: () => void;
}

/** 多个扩散雷达 Primitive 绘制类。 */
export default class DiffusionRadarCollection {
  private readonly records = new Map<string, DiffusionRadarPrimitiveRecord>();
  private readonly buckets = new Map<Cesium.Viewer, DiffusionRadarPrimitiveBucket>();

  /** 新增一个扩散雷达 Primitive，并返回 id。 */
  add(viewer: Cesium.Viewer, options: DiffusionRadarAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;

    const id = options.id ?? createSpecialEffectId("diffusion-radar-primitive");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    const record = this.createRecord(viewer, sourceOptions);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增扩散雷达 Primitive，并返回创建成功的 id。 */
  addMany(viewer: Cesium.Viewer, options: DiffusionRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增扩散雷达 Primitive，并返回创建成功的 id。 */
  addRadars(viewer: Cesium.Viewer, options: DiffusionRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新一个扩散雷达 Primitive。 */
  update(id: string, options: DiffusionRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.buckets.get(record.viewer)?.ids.delete(id);

    const sourceOptions = { ...record.sourceOptions, ...options, id };
    const nextRecord = this.createRecord(record.viewer, sourceOptions, record.animation.startTime);
    this.records.set(id, nextRecord);
    this.ensureBucket(record.viewer).ids.add(id);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置一个扩散雷达 Primitive 的显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    record.options.show = visible;
    record.sourceOptions.show = visible;
    [...record.staticPrimitives, record.wavePrimitive].forEach((primitive) => {
      if (primitive) primitive.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 根据特效 id 获取 Primitive 列表。 */
  get(id: string): Cesium.Primitive[] | undefined {
    const record = this.records.get(id);
    return record ? [...record.staticPrimitives, ...(record.wavePrimitive ? [record.wavePrimitive] : [])] : undefined;
  }

  /** 获取所有 id，可按 Viewer 过滤。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 移除一个扩散雷达 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空扩散雷达 Primitive，可按 Viewer 过滤。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理的全部扩散雷达 Primitive。 */
  destroy(): void {
    this.clear();
  }

  private createRecord(
    viewer: Cesium.Viewer,
    sourceOptions: DiffusionRadarSourceOptions,
    startTime?: number,
  ): DiffusionRadarPrimitiveRecord {
    const options = resolveDiffusionRadarOptions(sourceOptions);
    const staticPrimitives = createPrimitivesFromSpec(
      viewer,
      options.id,
      createDiffusionRadarStaticGeometry(options),
      options.show,
    );
    const animation = createDiffusionRadarAnimationState(startTime);
    const wavePrimitiveState = this.createWavePrimitive(viewer, options, animation);

    return {
      viewer,
      id: options.id,
      sourceOptions,
      options,
      staticPrimitives,
      wavePrimitive: wavePrimitiveState.primitive,
      waveStateKey: wavePrimitiveState.stateKey,
      animation,
    };
  }

  private removeRecordPrimitives(record: DiffusionRadarPrimitiveRecord): void {
    [...record.staticPrimitives, record.wavePrimitive].forEach((primitive) => {
      if (primitive) removePrimitive(record.viewer, primitive);
    });
    record.staticPrimitives = [];
    record.wavePrimitive = undefined;
    record.waveStateKey = undefined;
  }

  private ensureBucket(viewer: Cesium.Viewer): DiffusionRadarPrimitiveBucket {
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
    let hasVisibleWave = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;

      const nextStateKey = createDiffusionRadarWaveStateKey(record.options, record.animation);
      if (nextStateKey !== record.waveStateKey) {
        removePrimitive(record.viewer, record.wavePrimitive);
        const wavePrimitiveState = this.createWavePrimitive(record.viewer, record.options, record.animation);
        record.wavePrimitive = wavePrimitiveState.primitive;
        record.waveStateKey = wavePrimitiveState.stateKey;
      }

      if (record.wavePrimitive) record.wavePrimitive.show = record.options.show;
      hasVisibleWave = hasVisibleWave || record.options.show;
    });

    if (hasVisibleWave) requestSceneRender(viewer);
  }

  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener();
    this.buckets.delete(viewer);
  }

  private createWavePrimitive(
    viewer: Cesium.Viewer,
    options: DiffusionRadarResolvedOptions,
    animation: DiffusionRadarAnimationState,
  ): { primitive?: Cesium.Primitive; stateKey: string } {
    const stateKey = createDiffusionRadarWaveStateKey(options, animation);
    const [primitive] = createPrimitivesFromSpec(
      viewer,
      `${options.id}-wave`,
      createDiffusionRadarWaveGeometry(options, animation),
      options.show,
    );
    return { primitive, stateKey };
  }
}
