/**
 * 电子围栏 Primitive 批量绘制类。
 * 使用 WallGeometry 绘制多个围栏，适合大量边界墙体同时渲染。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
  toCartesian3Array,
  toCesiumColor,
} from "../shared";
import type { ElectronicFenceAddOptions, ElectronicFenceUpdateOptions } from ".";
import { resolveMaximumHeights, resolveMinimumHeights } from ".";
import {
  ELECTRONIC_FENCE_DEFAULT_IMAGE,
  createElectronicFenceMaterial,
  getElectronicFenceTime,
  resolveElectronicFenceDirection,
} from "./material";

/** 批量围栏内部标准参数。 */
type ElectronicFenceResolvedOptions = Required<
  Omit<ElectronicFenceAddOptions, "id" | "color" | "image" | "maximumHeights" | "minimumHeights">
> & {
  /** 唯一 id。 */
  id: string;
  /** 围栏主色。 */
  color: Cesium.Color;
  /** 围栏贴图。 */
  image: string;
  /** 顶部高度数组。 */
  maximumHeights?: readonly number[];
  /** 底部高度数组。 */
  minimumHeights?: readonly number[];
};

/** 电子围栏 Primitive 记录。 */
interface ElectronicFencePrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** Primitive 对象。 */
  primitive: Cesium.Primitive;
  /** Primitive 材质。 */
  material: Cesium.Material;
  /** 当前标准参数。 */
  options: ElectronicFenceResolvedOptions;
  /** 动画开始时间戳。 */
  startTime: number;
}

/** Viewer 分桶，便于清理 preRender 动画监听。 */
interface ElectronicFencePrimitiveBucket {
  /** 当前 Viewer 下的围栏 id。 */
  ids: Set<string>;
  /** 移除 preRender 监听的函数。 */
  removeListener?: () => void;
}

/** 电子围栏 Primitive 批量绘制类。 */
export default class ElectronicFenceCollection {
  /** 所有 Primitive 记录。 */
  private readonly records = new Map<string, ElectronicFencePrimitiveRecord>();
  /** 按 Viewer 分桶，避免全局动画循环扫描无关实例。 */
  private readonly buckets = new Map<Cesium.Viewer, ElectronicFencePrimitiveBucket>();

  /** 批量新增电子围栏，返回成功创建的 id 列表。 */
  addFences(viewer: Cesium.Viewer, options: ElectronicFenceAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个电子围栏 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: ElectronicFenceAddOptions): string | undefined {
    if (!isValidViewer(viewer) || options.positions.length < 2) return undefined;
    const id = options.id ?? createSpecialEffectId("electronic-fence-primitive");
    if (this.records.has(id)) return undefined;

    const resolved = resolveElectronicFenceOptions(id, options);
    const record = this.createRecord(viewer, resolved);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定电子围栏 Primitive。 */
  update(id: string, options: ElectronicFenceUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    if (options.positions && options.positions.length < 2) return false;

    patchElectronicFenceOptions(record.options, options);
    if (options.color) record.material.uniforms.color = record.options.color;
    if (options.image) record.material.uniforms.image = record.options.image;
    if (typeof options.count === "number") record.material.uniforms.count = record.options.count;
    if (options.direction) {
      const flow = resolveElectronicFenceDirection(record.options.direction);
      record.material.uniforms.vertical = flow.vertical;
      record.material.uniforms.direction = flow.direction;
    }
    if (typeof options.show === "boolean") record.primitive.show = record.options.show;
    if (options.positions || typeof options.height === "number" || options.maximumHeights || options.minimumHeights) {
      this.rebuild(id, record);
    }
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定电子围栏 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.primitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定电子围栏 Primitive。 */
  get(id: string): Cesium.Primitive | undefined {
    return this.records.get(id)?.primitive;
  }

  /** 获取当前管理的 id 列表；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    if (!viewer) return [...this.records.keys()];
    return [...(this.buckets.get(viewer)?.ids ?? [])];
  }

  /** 删除指定电子围栏 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.primitive);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空电子围栏 Primitive；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的所有电子围栏 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建 Primitive 记录并加入场景。 */
  private createRecord(viewer: Cesium.Viewer, options: ElectronicFenceResolvedOptions): ElectronicFencePrimitiveRecord {
    const material = createElectronicFenceMaterial(options);
    const primitive = this.createPrimitive(options, material);
    viewer.scene.primitives.add(primitive);
    return { viewer, primitive, material, options, startTime: Date.now() };
  }

  /** 创建墙体 Primitive。 */
  private createPrimitive(options: ElectronicFenceResolvedOptions, material: Cesium.Material): Cesium.Primitive {
    return new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        id: options.id,
        geometry: new Cesium.WallGeometry({
          positions: toCartesian3Array(options.positions),
          maximumHeights: resolveMaximumHeights(options),
          minimumHeights: resolveMinimumHeights(options),
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

  /** 重新构建几何变化后的 Primitive。 */
  private rebuild(id: string, record: ElectronicFencePrimitiveRecord): void {
    removePrimitive(record.viewer, record.primitive);
    record.primitive = this.createPrimitive(record.options, record.material);
    record.viewer.scene.primitives.add(record.primitive);
    this.records.set(id, record);
  }

  /** 获取或创建 Viewer 分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): ElectronicFencePrimitiveBucket {
    let bucket = this.buckets.get(viewer);
    if (!bucket) {
      const listener = () => this.updateAnimation(viewer);
      viewer.scene.preRender.addEventListener(listener);
      bucket = { ids: new Set(), removeListener: () => viewer.scene.preRender.removeEventListener(listener) };
      this.buckets.set(viewer, bucket);
    }
    return bucket;
  }

  /** 更新当前 Viewer 下所有电子围栏动画 uniform。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;
      record.material.uniforms.time = getElectronicFenceTime(record.startTime, record.options.duration);
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

/** 将外部参数标准化为 Primitive 内部记录。 */
function resolveElectronicFenceOptions(id: string, options: ElectronicFenceAddOptions): ElectronicFenceResolvedOptions {
  return {
    id,
    positions: options.positions,
    height: options.height ?? 500,
    maximumHeights: options.maximumHeights,
    minimumHeights: options.minimumHeights,
    color: toCesiumColor(options.color, Cesium.Color.CYAN),
    image: options.image ?? ELECTRONIC_FENCE_DEFAULT_IMAGE,
    duration: options.duration ?? 1500,
    count: options.count ?? 3,
    direction: options.direction ?? "up",
    show: options.show ?? true,
  };
}

/** 合并电子围栏更新参数。 */
function patchElectronicFenceOptions(target: ElectronicFenceResolvedOptions, options: ElectronicFenceUpdateOptions): void {
  if (options.positions) target.positions = options.positions;
  if (typeof options.height === "number") {
    target.height = options.height;
    target.maximumHeights = undefined;
  }
  if (options.maximumHeights) target.maximumHeights = options.maximumHeights;
  if (options.minimumHeights) target.minimumHeights = options.minimumHeights;
  if (options.color) target.color = toCesiumColor(options.color, target.color);
  if (options.image) target.image = options.image;
  if (typeof options.duration === "number") target.duration = options.duration;
  if (typeof options.count === "number") target.count = options.count;
  if (options.direction) target.direction = options.direction;
  if (typeof options.show === "boolean") target.show = options.show;
}
