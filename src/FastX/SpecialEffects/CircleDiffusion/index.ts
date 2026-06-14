/**
 * 圆扩散。
 * 使用贴地 Ellipse + 自定义材质，在世界坐标系下保持固定米制半径，不随相机缩放变化。
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
import { CircleDiffusionMaterialProperty, registerCircleDiffusionMaterial } from "./material";

/** 圆扩散新增参数。 */
export interface CircleDiffusionAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 扩散中心点。 */
  position: SpecialEffectsPositionInput;
  /** 扩散颜色。默认 rgba(0,255,0,1)。 */
  color?: SpecialEffectsColorInput;
  /** 最大扩散半径，单位：米。 */
  maxRadius?: number;
  /** 一轮扩散动画耗时，单位：毫秒。 */
  duration?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 圆扩散更新参数。 */
export type CircleDiffusionUpdateOptions = Partial<Omit<CircleDiffusionAddOptions, "id">>;

interface CircleDiffusionRecord {
  viewer: Cesium.Viewer;
  entity: Cesium.Entity;
  material: CircleDiffusionMaterialProperty;
  maxRadius: number;
  removeRenderListener: () => void;
}

const DEFAULT_CIRCLE_DIFFUSION_RADIUS = 1000;
const DEFAULT_CIRCLE_DIFFUSION_DURATION = 2000;

/** 圆扩散，在贴地 Ellipse 上绘制动态扩散扫描圈。 */
export default class CircleDiffusion {
  private readonly defaultViewer?: Cesium.Viewer;
  private readonly records = new Map<string, CircleDiffusionRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
    registerCircleDiffusionMaterial();
  }

  /** 新增圆扩散，支持 add(viewer, options) 和 new CircleDiffusion(viewer).add(options) 两种调用方式。 */
  add(viewer: Cesium.Viewer, options: CircleDiffusionAddOptions): string | undefined;
  add(options: CircleDiffusionAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | CircleDiffusionAddOptions,
    maybeOptions?: CircleDiffusionAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("circle-diffusion");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const maxRadius = normalizeCircleDiffusionRadius(options.maxRadius);
    const material = new CircleDiffusionMaterialProperty({
      color: toCesiumColor(options.color, Cesium.Color.LIME),
      duration: options.duration ?? DEFAULT_CIRCLE_DIFFUSION_DURATION,
    });
    const entity = viewer.entities.add({
      id,
      name: "FastX Circle Diffusion",
      position: toCartesian3(options.position),
      show: options.show ?? true,
      ellipse: {
        semiMinorAxis: maxRadius,
        semiMajorAxis: maxRadius,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        material,
      },
    });

    const record: CircleDiffusionRecord = {
      viewer,
      entity,
      material,
      maxRadius,
      removeRenderListener: this.bindRenderLoop(viewer, id),
    };
    this.records.set(id, record);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定圆扩散的位置、颜色、半径、动画时长或显隐状态。 */
  update(id: string, options: CircleDiffusionUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record || !record.entity.ellipse) return false;

    let shouldRestart = false;
    if (options.position !== undefined) {
      record.entity.position = new Cesium.ConstantPositionProperty(toCartesian3(options.position));
    }
    if (options.color !== undefined) record.material.color = toCesiumColor(options.color, record.material.color);
    if (typeof options.duration === "number") {
      record.material.duration = options.duration;
    }
    if (typeof options.maxRadius === "number") {
      const maxRadius = normalizeCircleDiffusionRadius(options.maxRadius, record.maxRadius);
      record.maxRadius = maxRadius;
      record.entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(maxRadius);
      record.entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(maxRadius);
      shouldRestart = true;
    }
    if (typeof options.show === "boolean") record.entity.show = options.show;
    if (shouldRestart) record.material.restart();
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定圆扩散显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定圆扩散对应的 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 获取当前管理的全部圆扩散 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.entries()]
      .filter(([, record]) => !viewer || record.viewer === viewer)
      .map(([id]) => id);
  }

  /** 删除指定圆扩散并解绑动画刷新监听。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.removeRenderListener();
    removeEntity(record.viewer, record.entity);
    this.records.delete(id);
    return true;
  }

  /** 清空全部圆扩散；传入 viewer 时只清空该 Viewer 下的圆扩散。 */
  clear(viewer?: Cesium.Viewer): void {
    for (const [id, record] of [...this.records]) {
      if (!viewer || record.viewer === viewer) {
        record.removeRenderListener();
        removeEntity(record.viewer, record.entity);
        this.records.delete(id);
      }
    }
  }

  /** 销毁当前实例管理的全部圆扩散。 */
  destroy(): void {
    this.clear();
  }

  /** 兼容显式传 viewer 和构造函数传 viewer 两种调用方式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | CircleDiffusionAddOptions,
    maybeOptions?: CircleDiffusionAddOptions,
  ): { viewer: Cesium.Viewer; options: CircleDiffusionAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as CircleDiffusionAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  /** 动态材质依赖时间 Uniform，requestRenderMode 下需要持续请求下一帧。 */
  private bindRenderLoop(viewer: Cesium.Viewer, id: string): () => void {
    const listener = () => {
      const record = this.records.get(id);
      if (record?.entity.show) requestSceneRender(viewer);
    };
    viewer.scene.preRender.addEventListener(listener);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(listener);
    };
  }
}

/** 规整扩散半径，避免非法半径导致 Ellipse 几何异常。 */
export function normalizeCircleDiffusionRadius(
  radius: number | undefined,
  fallback = DEFAULT_CIRCLE_DIFFUSION_RADIUS,
): number {
  return Number.isFinite(radius) && Number(radius) > 0 ? Number(radius) : fallback;
}
