/**
 * 扇弧形雷达扫描 Primitive 批量绘制类。
 * 外层使用纯色填充和轮廓 Primitive，内部扫描块使用 Shader Uniform 驱动动画。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import type {
  SectorArcRadarScanAddOptions,
  SectorArcRadarScanResolvedOptions,
  SectorArcRadarScanUpdateOptions,
} from ".";
import {
  calcSectorArcRadarScanState,
  createSectorArcRadarFillPrimitive,
  createSectorArcRadarOutlinePrimitive,
  createSectorArcRadarScanPrimitive,
  createSectorArcRadarScanStateKey,
  resolveSectorArcRadarScanOptions,
} from ".";

/** 扇弧形雷达扫描 Primitive 内部记录。 */
interface SectorArcRadarScanPrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 特效唯一 id。 */
  id: string;
  /** 外层填充和轮廓 Primitive。 */
  outerPrimitives: Cesium.Primitive[];
  /** Shader 扫描层 Primitive。 */
  scanPrimitive?: Cesium.Primitive;
  /** 当前扫描几何量化状态 key。 */
  scanStateKey?: string;
  /** 解析后的参数。 */
  options: SectorArcRadarScanResolvedOptions;
}

/** Viewer 动画分桶。 */
interface SectorArcRadarScanPrimitiveBucket {
  /** 当前 Viewer 下需要动画刷新的特效 id。 */
  ids: Set<string>;
  /** 移除 preRender 监听。 */
  removeListener: () => void;
}

/** 扇弧形雷达扫描 Primitive 批量绘制类。 */
export default class SectorArcRadarScanCollection {
  /** 当前类管理的全部 Primitive 记录。 */
  private readonly records = new Map<string, SectorArcRadarScanPrimitiveRecord>();
  /** 按 Viewer 分桶维护动画监听。 */
  private readonly buckets = new Map<Cesium.Viewer, SectorArcRadarScanPrimitiveBucket>();

  /** 批量新增扇弧形雷达扫描 Primitive，返回成功创建的 id。 */
  addScans(viewer: Cesium.Viewer, options: SectorArcRadarScanAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个扇弧形雷达扫描 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: SectorArcRadarScanAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId("sector-arc-radar-scan-primitive");
    if (this.records.has(id)) return undefined;

    const effectOptions = resolveSectorArcRadarScanOptions({ ...options, id });
    const record = this.createRecord(viewer, effectOptions);
    this.records.set(id, record);
    if (effectOptions.scanVisible) this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定扇弧形雷达扫描 Primitive。 */
  update(id: string, options: SectorArcRadarScanUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.buckets.get(record.viewer)?.ids.delete(id);
    const nextOptions = resolveSectorArcRadarScanOptions({
      ...record.options,
      ...options,
      id,
      position: options.position ?? record.options.position,
      startTime: record.options.startTime,
    });
    const nextRecord = this.createRecord(record.viewer, nextOptions);
    this.records.set(id, nextRecord);
    if (nextOptions.scanVisible) this.ensureBucket(record.viewer).ids.add(id);
    this.cleanupBucket(record.viewer);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定扇弧形雷达扫描 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    [...record.outerPrimitives, record.scanPrimitive].forEach((primitive) => {
      if (!primitive) return;
      primitive.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定扇弧形雷达扫描 Primitive 集合。 */
  get(id: string): Cesium.Primitive[] | undefined {
    const record = this.records.get(id);
    return record ? [...record.outerPrimitives, ...(record.scanPrimitive ? [record.scanPrimitive] : [])] : undefined;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定扇弧形雷达扫描 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecordPrimitives(record);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空全部扇弧形雷达扫描 Primitive；传入 viewer 时只清空该 Viewer 下的对象。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的全部扇弧形雷达扫描 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建外层填充、轮廓和首帧扫描块 Primitive。 */
  private createRecord(
    viewer: Cesium.Viewer,
    options: SectorArcRadarScanResolvedOptions,
  ): SectorArcRadarScanPrimitiveRecord {
    const outerPrimitives = [
      createSectorArcRadarFillPrimitive(`${options.id}-outer-fill`, options, options.color, undefined, options.show),
      createSectorArcRadarOutlinePrimitive(`${options.id}-outer-outline`, options, options.show),
    ];
    outerPrimitives.forEach((primitive) => viewer.scene.primitives.add(primitive));

    const scanBundle = createSectorArcRadarScanPrimitive(`${options.id}-scan`, options, options.show);
    if (scanBundle) viewer.scene.primitives.add(scanBundle.primitive);

    return {
      viewer,
      id: options.id,
      outerPrimitives,
      scanPrimitive: scanBundle?.primitive,
      scanStateKey: scanBundle?.stateKey,
      options,
    };
  }

  /** 移除记录下的全部 Primitive。 */
  private removeRecordPrimitives(record: SectorArcRadarScanPrimitiveRecord): void {
    [...record.outerPrimitives, record.scanPrimitive].forEach((primitive) => {
      if (!primitive) return;
      removePrimitive(record.viewer, primitive);
    });
    record.scanPrimitive = undefined;
    record.scanStateKey = undefined;
  }

  /** 获取或创建 Viewer 动画分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): SectorArcRadarScanPrimitiveBucket {
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

  /** 按当前动画状态刷新内部扫描块 Primitive。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    let hasAnimatedScan = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record?.options.scanVisible) return;
      const state = calcSectorArcRadarScanState(record.options);
      const nextStateKey = createSectorArcRadarScanStateKey(state);
      if (nextStateKey === record.scanStateKey) {
        if (record.scanPrimitive) record.scanPrimitive.show = record.options.show && state.visible;
        hasAnimatedScan = hasAnimatedScan || (record.options.show && state.visible);
        return;
      }

      removePrimitive(record.viewer, record.scanPrimitive);
      const scanBundle = createSectorArcRadarScanPrimitive(`${record.id}-scan`, record.options, record.options.show, state);
      record.scanPrimitive = scanBundle?.primitive;
      record.scanStateKey = scanBundle?.stateKey ?? nextStateKey;
      if (scanBundle) viewer.scene.primitives.add(scanBundle.primitive);
      hasAnimatedScan = hasAnimatedScan || (record.options.show && state.visible);
    });
    if (hasAnimatedScan) requestSceneRender(viewer);
  }

  /** 清理没有记录的 Viewer 动画分桶。 */
  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener();
    this.buckets.delete(viewer);
  }
}
