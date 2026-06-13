/**
 * 单视锥体 Primitive 批量绘制类。
 * 使用 FrustumGeometry 和 FrustumOutlineGeometry 批量绘制视锥体。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import type { SingleViewFrustumAddOptions, SingleViewFrustumUpdateOptions } from ".";
import { mergeOptions, resolveOptions } from ".";
import {
  createSingleViewFrustumFillGeometry,
  createSingleViewFrustumOutlineGeometry,
  type SingleViewFrustumResolvedOptions,
} from "./geometry";

/** 单视锥体 Primitive 记录。 */
interface SingleViewFrustumPrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 填充 Primitive。 */
  fillPrimitive: Cesium.Primitive;
  /** 轮廓 Primitive。 */
  outlinePrimitive: Cesium.Primitive;
  /** 当前解析后的参数。 */
  options: SingleViewFrustumResolvedOptions & { outlineWidth: number };
}

/** 单视锥体 Primitive 批量绘制类。 */
export default class SingleViewFrustumCollection {
  /** 所有 Primitive 记录。 */
  private readonly records = new Map<string, SingleViewFrustumPrimitiveRecord>();
  /** id 所属 Viewer。 */
  private readonly idOwner = new Map<string, Cesium.Viewer>();

  /** 批量新增单视锥体，返回成功创建的 id。 */
  addFrustums(viewer: Cesium.Viewer, options: SingleViewFrustumAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个单视锥体 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: SingleViewFrustumAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId("single-view-frustum-primitive");
    if (this.records.has(id)) return undefined;
    const record = this.createRecord(viewer, resolveOptions(options));
    this.records.set(id, record);
    this.idOwner.set(id, viewer);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定单视锥体 Primitive。 */
  update(id: string, options: SingleViewFrustumUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.fillPrimitive);
    removePrimitive(record.viewer, record.outlinePrimitive);
    this.records.set(id, this.createRecord(record.viewer, mergeOptions(record.options, options)));
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定单视锥体 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.fillPrimitive.show = visible;
    record.outlinePrimitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定单视锥体 Primitive。 */
  get(id: string): { fillPrimitive: Cesium.Primitive; outlinePrimitive: Cesium.Primitive } | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    return {
      fillPrimitive: record.fillPrimitive,
      outlinePrimitive: record.outlinePrimitive,
    };
  }

  /** 获取当前管理的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    if (!viewer) return [...this.records.keys()];
    return [...this.idOwner.entries()].filter(([, owner]) => owner === viewer).map(([id]) => id);
  }

  /** 删除指定单视锥体 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.fillPrimitive);
    removePrimitive(record.viewer, record.outlinePrimitive);
    this.records.delete(id);
    this.idOwner.delete(id);
    return true;
  }

  /** 清空所有单视锥体 Primitive；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的所有单视锥体 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建 Primitive 记录。 */
  private createRecord(
    viewer: Cesium.Viewer,
    options: SingleViewFrustumResolvedOptions & { outlineWidth: number },
  ): SingleViewFrustumPrimitiveRecord {
    const fillPrimitive = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: createSingleViewFrustumFillGeometry(options),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(options.fillColor),
        },
      }),
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true,
      }),
      asynchronous: false,
      show: options.show,
    });
    const outlinePrimitive = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: createSingleViewFrustumOutlineGeometry(options),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(options.outlineColor),
        },
      }),
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true,
      }),
      asynchronous: false,
      show: options.show,
    });
    viewer.scene.primitives.add(fillPrimitive);
    viewer.scene.primitives.add(outlinePrimitive);
    return { viewer, fillPrimitive, outlinePrimitive, options };
  }
}
