/**
 * 辐射圈特效。
 * Entity 类用于单体绘制，RadiationCircleCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";
import {
  RadiationCircleMaterialProperty,
  registerRadiationCircleMaterial,
} from "./material";

/** 辐射圈新增参数。 */
export interface RadiationCircleAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 辐射圈中心点。 */
  position: SpecialEffectsPositionInput;
  /** 辐射圈颜色。默认 rgba(0,255,255,0.75)。 */
  color?: SpecialEffectsColorInput;
  /** 最大辐射半径，单位：米。 */
  maxRadius?: number;
  /** 一轮扩散动画耗时，单位：毫秒。 */
  duration?: number;
  /** 同时显示的波纹数量。 */
  count?: number;
  /** 波纹渐变强度，0 到 1。 */
  gradient?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 辐射圈更新参数。 */
export type RadiationCircleUpdateOptions = Partial<Omit<RadiationCircleAddOptions, "id">>;

/** 辐射圈 Entity 记录。 */
interface RadiationCircleRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 辐射圈实体。 */
  entity: Cesium.Entity;
  /** 辐射圈动态材质。 */
  material: RadiationCircleMaterialProperty;
}

/** 辐射圈单体 Entity 绘制类。 */
export default class RadiationCircle {
  /** 兼容旧调用方式时保存的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的辐射圈 Entity。 */
  private readonly records = new Map<string, RadiationCircleRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
    registerRadiationCircleMaterial();
  }

  /** 新增一个辐射圈，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: RadiationCircleAddOptions): string | undefined;
  add(options: RadiationCircleAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | RadiationCircleAddOptions,
    maybeOptions?: RadiationCircleAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("radiation-circle");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const radius = options.maxRadius ?? 1000;
    const material = new RadiationCircleMaterialProperty({
      color: toCesiumColor(options.color, new Cesium.Color(0.0, 1.0, 1.0, 0.75)),
      duration: options.duration ?? 1000,
      count: options.count ?? 3,
      gradient: options.gradient ?? 0.5,
    });
    const entity = viewer.entities.add({
      id,
      name: "FastX Radiation Circle",
      position: toCartesian3(options.position),
      show: options.show ?? true,
      ellipse: {
        semiMinorAxis: new Cesium.ConstantProperty(radius),
        semiMajorAxis: new Cesium.ConstantProperty(radius),
        material,
      },
    });

    this.records.set(id, { viewer, entity, material });
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定辐射圈。 */
  update(id: string, options: RadiationCircleUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record || !record.entity.ellipse) return false;

    if (options.position) record.entity.position = new Cesium.ConstantPositionProperty(toCartesian3(options.position));
    if (options.color) record.material.color = toCesiumColor(options.color, record.material.color);
    if (typeof options.duration === "number") record.material.duration = options.duration;
    if (typeof options.count === "number") record.material.count = Math.max(1, options.count);
    if (typeof options.gradient === "number") record.material.gradient = Math.min(Math.max(options.gradient, 0), 1);
    if (typeof options.maxRadius === "number") {
      record.entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(options.maxRadius);
      record.entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(options.maxRadius);
    }
    if (typeof options.show === "boolean") record.entity.show = options.show;

    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定辐射圈显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定辐射圈 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 删除指定辐射圈。 */
  /** 获取当前管理的全部辐射圈 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.entries()]
      .filter(([, record]) => !viewer || record.viewer === viewer)
      .map(([id]) => id);
  }

  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removeEntity(record.viewer, record.entity);
    this.records.delete(id);
    return true;
  }

  /** 清空所有辐射圈；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.records.forEach((record, id) => {
      if (!viewer || viewer === record.viewer) {
        removeEntity(record.viewer, record.entity);
        this.records.delete(id);
      }
    });
  }

  /** 销毁当前类管理的所有辐射圈。 */
  destroy(): void {
    this.clear();
  }

  /** 解析 Point 风格和旧版构造器风格参数。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | RadiationCircleAddOptions,
    maybeOptions?: RadiationCircleAddOptions,
  ): { viewer: Cesium.Viewer; options: RadiationCircleAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as RadiationCircleAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}
