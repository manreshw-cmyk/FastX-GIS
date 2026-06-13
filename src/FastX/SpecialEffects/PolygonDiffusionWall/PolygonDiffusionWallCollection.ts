/**
 * 多边形扩散墙 Primitive 批量绘制类。
 * positions 模式用于批量固定墙体，center 模式用于复刻参考项目的正多边形扩散墙动画。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import type {
  PolygonDiffusionWallAddOptions,
  PolygonDiffusionWallResolvedOptions,
  PolygonDiffusionWallUpdateOptions,
} from ".";
import {
  patchPolygonDiffusionWallOptions,
  resolvePolygonDiffusionWallOptions,
} from ".";
import {
  PolygonDiffusionWallAnimatedAppearance,
  PolygonDiffusionWallGeometryData,
  createPolygonDiffusionWallAnimatedAppearance,
  createPolygonDiffusionWallAnimatedGeometry,
  createPolygonDiffusionWallMaterial,
  getPolygonDiffusionWallAnimationProgress,
  resolvePolygonDiffusionWallGeometry,
} from "./material";

/** 批量扩散墙内部标准参数。 */
type PolygonDiffusionWallResolvedPrimitiveOptions = PolygonDiffusionWallResolvedOptions & {
  /** 唯一 id。 */
  id: string;
};

/** 多边形扩散墙 Primitive 记录。 */
interface PolygonDiffusionWallPrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** Primitive 对象。 */
  primitive: Cesium.Primitive;
  /** Primitive 材质。 */
  material: Cesium.Material;
  /** 中心扩散墙 GPU 动画 Appearance。 */
  animatedAppearance?: PolygonDiffusionWallAnimatedAppearance;
  /** 当前墙体几何数据。 */
  geometry: PolygonDiffusionWallGeometryData;
  /** 当前标准参数。 */
  options: PolygonDiffusionWallResolvedPrimitiveOptions;
  /** 动画开始时间戳。 */
  startTime: number;
}

/** Viewer 分桶，便于清理 preRender 动画监听。 */
interface PolygonDiffusionWallPrimitiveBucket {
  /** 当前 Viewer 管理的 id。 */
  ids: Set<string>;
  /** 移除 preRender 监听的函数。 */
  removeListener?: () => void;
}

/** 多边形扩散墙 Primitive 批量绘制类。 */
export default class PolygonDiffusionWallCollection {
  /** 所有 Primitive 记录。 */
  private readonly records = new Map<string, PolygonDiffusionWallPrimitiveRecord>();
  /** 按 Viewer 分桶，避免全局动画循环扫描无关实例。 */
  private readonly buckets = new Map<Cesium.Viewer, PolygonDiffusionWallPrimitiveBucket>();
  /** 批量新增多边形扩散墙，返回成功创建的 id 列表。 */
  addWalls(viewer: Cesium.Viewer, options: PolygonDiffusionWallAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个多边形扩散墙 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: PolygonDiffusionWallAddOptions): string | undefined {
    if (!isValidViewer(viewer) || !hasValidGeometry(options)) return undefined;
    const id = options.id ?? createSpecialEffectId("polygon-diffusion-wall-primitive");
    if (this.records.has(id)) return undefined;

    const resolved = { ...resolvePolygonDiffusionWallOptions(options), id };
    const record = this.createRecord(viewer, resolved);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定多边形扩散墙 Primitive。 */
  update(id: string, options: PolygonDiffusionWallUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    if (options.positions && options.positions.length < 3) return false;

    patchPolygonDiffusionWallOptions(record.options, options);
    if (options.color) record.material.uniforms.color = record.options.color;
    if (typeof options.duration === "number") record.options.duration = options.duration;
    if (typeof options.show === "boolean") record.primitive.show = record.options.show;
    if (
      options.positions ||
      options.center ||
      typeof options.height === "number" ||
      typeof options.radius === "number" ||
      typeof options.edge === "number" ||
      options.maximumHeights ||
      options.minimumHeights
    ) {
      record.geometry = resolvePolygonDiffusionWallGeometry(record.options);
      this.rebuild(id, record);
    }
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定多边形扩散墙 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.primitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定多边形扩散墙 Primitive。 */
  get(id: string): Cesium.Primitive | undefined {
    return this.records.get(id)?.primitive;
  }

  /** 获取当前管理的 id 列表；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    if (!viewer) return [...this.records.keys()];
    return [...(this.buckets.get(viewer)?.ids ?? [])];
  }

  /** 删除指定多边形扩散墙 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.primitive);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空多边形扩散墙 Primitive；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的所有多边形扩散墙 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建 Primitive 记录并加入场景。 */
  private createRecord(
    viewer: Cesium.Viewer,
    options: PolygonDiffusionWallResolvedPrimitiveOptions,
  ): PolygonDiffusionWallPrimitiveRecord {
    const geometry = resolvePolygonDiffusionWallGeometry(options);
    const material = createPolygonDiffusionWallMaterial({
      color: options.color,
      duration: options.duration,
    });
    const startTime = Date.now();
    const primitiveInfo = this.createPrimitive(options, geometry, material, startTime);
    const primitive = primitiveInfo.primitive;
    viewer.scene.primitives.add(primitive);
    return { viewer, primitive, material, animatedAppearance: primitiveInfo.animatedAppearance, geometry, options, startTime };
  }

  /** 创建墙体 Primitive。 */
  private createPrimitive(
    options: PolygonDiffusionWallResolvedPrimitiveOptions,
    geometry: PolygonDiffusionWallGeometryData,
    material: Cesium.Material,
    startTime: number,
  ): { primitive: Cesium.Primitive; animatedAppearance?: PolygonDiffusionWallAnimatedAppearance } {
    if (options.center) {
      const animatedGeometry = createPolygonDiffusionWallAnimatedGeometry(options);
      const appearance = createPolygonDiffusionWallAnimatedAppearance(material, {
        u_diffusionTime: getPolygonDiffusionWallAnimationProgress(startTime, options),
        u_minRadius: options.minRadius,
        u_maxRadius: options.radius,
        u_height: options.height,
      });
      return {
        primitive: new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({
            id: options.id,
            geometry: animatedGeometry.geometry,
          }),
          appearance,
          asynchronous: false,
          show: options.show,
        }),
        animatedAppearance: appearance,
      };
    }

    const wallGeometryOptions = {
      positions: geometry.cartesians,
      minimumHeights: geometry.minimumHeights,
      maximumHeights: geometry.maximumHeights,
      vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    };

    return {
      primitive: new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          id: options.id,
          geometry: new Cesium.WallGeometry(wallGeometryOptions),
        }),
        appearance: new Cesium.MaterialAppearance({
          material,
          faceForward: true,
        }),
        asynchronous: false,
        show: options.show,
      }),
    };
  }

  /** 重新构建几何变化后的 Primitive。 */
  private rebuild(id: string, record: PolygonDiffusionWallPrimitiveRecord): void {
    removePrimitive(record.viewer, record.primitive);
    const primitiveInfo = this.createPrimitive(record.options, record.geometry, record.material, record.startTime);
    record.primitive = primitiveInfo.primitive;
    record.animatedAppearance = primitiveInfo.animatedAppearance;
    record.viewer.scene.primitives.add(record.primitive);
    this.records.set(id, record);
  }

  /** 获取或创建 Viewer 分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): PolygonDiffusionWallPrimitiveBucket {
    let bucket = this.buckets.get(viewer);
    if (!bucket) {
      const listener = () => this.updateAnimation(viewer);
      viewer.scene.preRender.addEventListener(listener);
      bucket = { ids: new Set(), removeListener: () => viewer.scene.preRender.removeEventListener(listener) };
      this.buckets.set(viewer, bucket);
    }
    return bucket;
  }

  /** 更新当前 Viewer 下所有扩散墙的动画 uniform 和中心扩散几何。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    let hasUpdate = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;
      const progress = getPolygonDiffusionWallAnimationProgress(record.startTime, record.options);
      record.material.uniforms.time = progress;
      if (record.animatedAppearance) {
        record.animatedAppearance.uniforms.u_diffusionTime = progress;
        record.animatedAppearance.uniforms.u_minRadius = record.options.minRadius;
        record.animatedAppearance.uniforms.u_maxRadius = record.options.radius;
        record.animatedAppearance.uniforms.u_height = record.options.height;
      }
      hasUpdate = true;
    });
    if (hasUpdate) requestSceneRender(viewer);
  }

  /** 清理没有记录的 Viewer 分桶。 */
  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener?.();
    this.buckets.delete(viewer);
  }

}

/** 判断外部参数是否能构成可绘制墙体。 */
function hasValidGeometry(options: PolygonDiffusionWallAddOptions): boolean {
  return !!options.center || !!(options.positions && options.positions.length >= 3);
}
