/**
 * 辐射圈 Primitive 批量绘制类。
 * 使用 Primitive 绘制多个辐射圈，适合批量点位扩散效果。
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
import type { RadiationCircleAddOptions, RadiationCircleUpdateOptions } from ".";
import {
  createRadiationCircleMaterial,
  getRadiationCircleGradient,
  getRadiationCircleTime,
} from "./material";

/** 辐射圈 Primitive 记录。 */
interface RadiationCirclePrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** Primitive 对象。 */
  primitive: Cesium.Primitive;
  /** Primitive 材质。 */
  material: Cesium.Material;
  /** 原始参数。 */
  options: Required<Omit<RadiationCircleAddOptions, "id" | "position" | "color">> & {
    id: string;
    position: RadiationCircleAddOptions["position"];
    color: Cesium.Color;
  };
  /** 动画起始时间。 */
  startTime: number;
}

/** Viewer 分桶。 */
interface RadiationCirclePrimitiveBucket {
  /** 当前 Viewer 管理的 id。 */
  ids: Set<string>;
  /** preRender 动画监听。 */
  removeListener?: () => void;
}

/** 辐射圈 Primitive 批量绘制类。 */
export default class RadiationCircleCollection {
  /** 所有 Primitive 记录。 */
  private readonly records = new Map<string, RadiationCirclePrimitiveRecord>();
  /** 按 Viewer 分桶，方便清理监听。 */
  private readonly buckets = new Map<Cesium.Viewer, RadiationCirclePrimitiveBucket>();

  /** 批量新增辐射圈，返回成功创建的 id。 */
  addCircles(viewer: Cesium.Viewer, options: RadiationCircleAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个辐射圈 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: RadiationCircleAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId("radiation-circle-primitive");
    if (this.records.has(id)) return undefined;
    const record = this.createRecord(viewer, {
      id,
      position: options.position,
      color: toCesiumColor(options.color, new Cesium.Color(0.0, 1.0, 1.0, 0.75)),
      maxRadius: options.maxRadius ?? 1000,
      duration: options.duration ?? 1000,
      count: options.count ?? 3,
      gradient: options.gradient ?? 0.5,
      show: options.show ?? true,
    });
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定辐射圈 Primitive。 */
  update(id: string, options: RadiationCircleUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    Object.assign(record.options, options);
    if (options.color) {
      record.options.color = toCesiumColor(options.color, record.options.color);
      record.material.uniforms.color = record.options.color;
    }
    if (typeof options.count === "number") record.material.uniforms.count = Math.max(1, options.count);
    if (typeof options.gradient === "number") record.material.uniforms.gradient = getRadiationCircleGradient(options.gradient);
    if (typeof options.show === "boolean") record.primitive.show = options.show;

    if (options.position || typeof options.maxRadius === "number") this.rebuild(id, record);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定辐射圈 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.primitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定辐射圈 Primitive。 */
  get(id: string): Cesium.Primitive | undefined {
    return this.records.get(id)?.primitive;
  }

  /** 获取当前管理的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    if (!viewer) return [...this.records.keys()];
    return [...(this.buckets.get(viewer)?.ids ?? [])];
  }

  /** 删除指定辐射圈 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.primitive);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空所有辐射圈 Primitive；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的所有辐射圈 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建 Primitive 记录。 */
  private createRecord(
    viewer: Cesium.Viewer,
    options: RadiationCirclePrimitiveRecord["options"],
  ): RadiationCirclePrimitiveRecord {
    const material = createRadiationCircleMaterial(options);
    const primitive = this.createPrimitive(options, material);
    viewer.scene.primitives.add(primitive);
    return { viewer, primitive, material, options, startTime: Date.now() };
  }

  /** 创建椭圆 Primitive。 */
  private createPrimitive(options: RadiationCirclePrimitiveRecord["options"], material: Cesium.Material): Cesium.Primitive {
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
  private rebuild(id: string, record: RadiationCirclePrimitiveRecord): void {
    removePrimitive(record.viewer, record.primitive);
    record.primitive = this.createPrimitive(record.options, record.material);
    record.viewer.scene.primitives.add(record.primitive);
    this.records.set(id, record);
  }

  /** 获取或创建 Viewer 分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): RadiationCirclePrimitiveBucket {
    let bucket = this.buckets.get(viewer);
    if (!bucket) {
      const listener = () => this.updateAnimation(viewer);
      viewer.scene.preRender.addEventListener(listener);
      bucket = { ids: new Set(), removeListener: () => viewer.scene.preRender.removeEventListener(listener) };
      this.buckets.set(viewer, bucket);
    }
    return bucket;
  }

  /** 更新当前 Viewer 下所有辐射圈动画 Uniform。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;
      record.material.uniforms.time = getRadiationCircleTime(record.startTime, record.options.duration);
    });
  }

  /** 清理没有记录的 Viewer 分桶。 */
  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener?.();
    this.buckets.delete(viewer);
  }
}
