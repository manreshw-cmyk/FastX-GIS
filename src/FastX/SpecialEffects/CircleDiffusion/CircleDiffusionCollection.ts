/**
 * 圆扩散 Primitive 批量绘制类。
 * 使用 Primitive 绘制多个圆扩散，适合批量地表扩散扫描效果。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";
import type { CircleDiffusionAddOptions, CircleDiffusionUpdateOptions } from ".";
import { normalizeCircleDiffusionRadius } from ".";
import {
  createCircleDiffusionMaterial,
  getCircleDiffusionTime,
  normalizeCircleDiffusionDuration,
} from "./material";

/** 圆扩散 Primitive 默认半径，单位：米。 */
const DEFAULT_CIRCLE_DIFFUSION_RADIUS = 1000;
/** 圆扩散 Primitive 默认动画时长，单位：毫秒。 */
const DEFAULT_CIRCLE_DIFFUSION_DURATION = 2000;

/** 圆扩散 Primitive 已解析参数。 */
type CircleDiffusionPrimitiveOptions = Required<Omit<CircleDiffusionAddOptions, "id" | "position" | "color">> & {
  /** 唯一 id。 */
  id: string;
  /** 圆扩散中心位置。 */
  position: CircleDiffusionAddOptions["position"];
  /** 圆扩散颜色。 */
  color: Cesium.Color;
};

/** 圆扩散 Primitive 记录。 */
interface CircleDiffusionPrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** Primitive 对象。 */
  primitive: Cesium.Primitive;
  /** Primitive 材质。 */
  material: Cesium.Material;
  /** 已解析参数。 */
  options: CircleDiffusionPrimitiveOptions;
  /** 动画起始时间。 */
  startTime: number;
}

/** Viewer 分桶，用于按 Viewer 维护动画监听。 */
interface CircleDiffusionPrimitiveBucket {
  /** 当前 Viewer 下管理的 id 集合。 */
  ids: Set<string>;
  /** 移除 preRender 动画监听。 */
  removeListener: () => void;
}

/** 圆扩散 Primitive 批量绘制类。 */
export default class CircleDiffusionCollection {
  /** 当前类管理的圆扩散 Primitive。 */
  private readonly records = new Map<string, CircleDiffusionPrimitiveRecord>();
  /** 按 Viewer 分桶维护动画监听，避免重复绑定。 */
  private readonly buckets = new Map<Cesium.Viewer, CircleDiffusionPrimitiveBucket>();

  /** 批量新增圆扩散 Primitive，返回成功创建的 id。 */
  addCircles(viewer: Cesium.Viewer, options: CircleDiffusionAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个圆扩散 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: CircleDiffusionAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId("circle-diffusion-primitive");
    if (this.records.has(id)) return undefined;

    const record = this.createRecord(viewer, {
      id,
      position: options.position,
      color: toCesiumColor(options.color, Cesium.Color.LIME),
      maxRadius: normalizeCircleDiffusionRadius(options.maxRadius, DEFAULT_CIRCLE_DIFFUSION_RADIUS),
      duration: normalizeCircleDiffusionDuration(options.duration ?? DEFAULT_CIRCLE_DIFFUSION_DURATION),
      show: options.show ?? true,
    });
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定圆扩散 Primitive。 */
  update(id: string, options: CircleDiffusionUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    let shouldRebuild = false;
    if (options.position !== undefined) {
      record.options.position = options.position;
      shouldRebuild = true;
    }
    if (options.color !== undefined) {
      record.options.color = toCesiumColor(options.color, record.options.color);
      record.material.uniforms.color = record.options.color;
    }
    if (typeof options.duration === "number") {
      record.options.duration = normalizeCircleDiffusionDuration(options.duration);
      record.startTime = Date.now();
    }
    if (typeof options.maxRadius === "number") {
      record.options.maxRadius = normalizeCircleDiffusionRadius(options.maxRadius, record.options.maxRadius);
      shouldRebuild = true;
      record.startTime = Date.now();
    }
    if (typeof options.show === "boolean") {
      record.options.show = options.show;
      record.primitive.show = options.show;
    }
    if (shouldRebuild) this.rebuild(id, record);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定圆扩散 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.primitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定圆扩散 Primitive。 */
  get(id: string): Cesium.Primitive | undefined {
    return this.records.get(id)?.primitive;
  }

  /** 获取当前管理的全部圆扩散 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    if (!viewer) return [...this.records.keys()];
    return [...(this.buckets.get(viewer)?.ids ?? [])];
  }

  /** 删除指定圆扩散 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.primitive);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空全部圆扩散 Primitive；传入 viewer 时只清空该 Viewer 下的对象。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前实例管理的全部圆扩散 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建 Primitive 记录。 */
  private createRecord(
    viewer: Cesium.Viewer,
    options: CircleDiffusionPrimitiveOptions,
  ): CircleDiffusionPrimitiveRecord {
    const material = createCircleDiffusionMaterial(options);
    const primitive = this.createPrimitive(options, material);
    viewer.scene.primitives.add(primitive);
    return { viewer, primitive, material, options, startTime: Date.now() };
  }

  /** 创建圆扩散 Ellipse Primitive。 */
  private createPrimitive(options: CircleDiffusionPrimitiveOptions, material: Cesium.Material): Cesium.Primitive {
    return new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        id: options.id,
        geometry: new Cesium.EllipseGeometry({
          center: toCartesian3(options.position),
          semiMajorAxis: options.maxRadius,
          semiMinorAxis: options.maxRadius,
          vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
        }),
      }),
      appearance: new Cesium.MaterialAppearance({
        material,
        faceForward: true,
      }),
      asynchronous: false,
      show: options.show,
    });
  }

  /** 重建位置或半径变化后的 Primitive。 */
  private rebuild(id: string, record: CircleDiffusionPrimitiveRecord): void {
    removePrimitive(record.viewer, record.primitive);
    record.primitive = this.createPrimitive(record.options, record.material);
    record.viewer.scene.primitives.add(record.primitive);
    this.records.set(id, record);
  }

  /** 获取或创建 Viewer 分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): CircleDiffusionPrimitiveBucket {
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

  /** 更新当前 Viewer 下全部可见圆扩散的动画 Uniform。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    let hasVisible = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record?.primitive.show) return;
      record.material.uniforms.time = getCircleDiffusionTime(record.startTime, record.options.duration);
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
