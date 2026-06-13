/**
 * 单视锥体特效。
 * Entity 类用于单体绘制，SingleViewFrustumCollection 用于 Primitive 批量绘制。
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
  computeSingleViewFrustumVertices,
  getSingleViewFrustumFaces,
  getSingleViewFrustumLines,
  type SingleViewFrustumResolvedOptions,
} from "./geometry";

/** 单视锥体新增参数。 */
export interface SingleViewFrustumAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 视锥体相机位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 180。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 垂直视场角，单位：度。默认 30。 */
  fov?: number;
  /** 近裁剪面距离，单位：米。默认 10。 */
  near?: number;
  /** 远裁剪面距离，单位：米。默认 3000。 */
  far?: number;
  /** 宽高比。默认 1.4。 */
  aspectRatio?: number;
  /** 面填充色。默认 aqua，透明度 0.3。 */
  fillColor?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 white。 */
  outlineColor?: SpecialEffectsColorInput;
  /** 轮廓线宽度。默认 1。 */
  outlineWidth?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 单视锥体更新参数。 */
export type SingleViewFrustumUpdateOptions = Partial<Omit<SingleViewFrustumAddOptions, "id">>;

/** 单视锥体 Entity 记录。 */
interface SingleViewFrustumRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 面实体集合。 */
  faceEntities: Cesium.Entity[];
  /** 线实体集合。 */
  lineEntities: Cesium.Entity[];
  /** 当前解析后的参数。 */
  options: SingleViewFrustumResolvedOptions & { outlineWidth: number };
}

/** 单视锥体单体 Entity 绘制类。 */
export default class SingleViewFrustum {
  /** 兼容旧调用方式时保存的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的单视锥体 Entity。 */
  private readonly records = new Map<string, SingleViewFrustumRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
  }

  /** 新增一个单视锥体，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: SingleViewFrustumAddOptions): string | undefined;
  add(options: SingleViewFrustumAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | SingleViewFrustumAddOptions,
    maybeOptions?: SingleViewFrustumAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("single-view-frustum");
    if (this.records.has(id)) return undefined;
    const record = this.createRecord(viewer, id, resolveOptions(options));
    this.records.set(id, record);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定单视锥体。 */
  update(id: string, options: SingleViewFrustumUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecordEntities(record);
    const nextOptions = mergeOptions(record.options, options);
    this.records.set(id, this.createRecord(record.viewer, id, nextOptions));
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定单视锥体显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.faceEntities.forEach((entity) => {
      entity.show = visible;
    });
    record.lineEntities.forEach((entity) => {
      entity.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定单视锥体的 Entity 集合。 */
  get(id: string): { faces: Cesium.Entity[]; lines: Cesium.Entity[] } | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    return { faces: record.faceEntities, lines: record.lineEntities };
  }

  /** 获取指定单视锥体轮廓顶点。 */
  getVertices(id: string): Cesium.Cartesian3[] {
    const record = this.records.get(id);
    if (!record) return [];
    return Object.values(computeSingleViewFrustumVertices(record.options));
  }

  /** 删除指定单视锥体。 */
  /** 获取当前管理的全部单视锥体 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.entries()]
      .filter(([, record]) => !viewer || record.viewer === viewer)
      .map(([id]) => id);
  }

  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecordEntities(record);
    this.records.delete(id);
    return true;
  }

  /** 清空所有单视锥体；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.records.forEach((record, id) => {
      if (!viewer || viewer === record.viewer) {
        this.removeRecordEntities(record);
        this.records.delete(id);
      }
    });
  }

  /** 销毁当前类管理的所有单视锥体。 */
  destroy(): void {
    this.clear();
  }

  /** 创建 Entity 记录。 */
  private createRecord(
    viewer: Cesium.Viewer,
    id: string,
    options: SingleViewFrustumResolvedOptions & { outlineWidth: number },
  ): SingleViewFrustumRecord {
    const vertices = computeSingleViewFrustumVertices(options);
    const faceEntities = getSingleViewFrustumFaces(vertices).map((positions, index) =>
      viewer.entities.add({
        id: `${id}-face-${index}`,
        name: "FastX Single View Frustum Face",
        show: options.show,
        polygon: {
          hierarchy: positions,
          material: options.fillColor,
          perPositionHeight: true,
        },
      }),
    );
    const lineEntities = getSingleViewFrustumLines(vertices).map((positions, index) =>
      viewer.entities.add({
        id: `${id}-line-${index}`,
        name: "FastX Single View Frustum Line",
        show: options.show,
        polyline: {
          positions,
          width: options.outlineWidth,
          material: options.outlineColor,
        },
      }),
    );
    return { viewer, faceEntities, lineEntities, options };
  }

  /** 删除一个记录下的所有 Entity。 */
  private removeRecordEntities(record: SingleViewFrustumRecord): void {
    record.faceEntities.forEach((entity) => removeEntity(record.viewer, entity));
    record.lineEntities.forEach((entity) => removeEntity(record.viewer, entity));
  }

  /** 解析 Point 风格和旧版构造器风格参数。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | SingleViewFrustumAddOptions,
    maybeOptions?: SingleViewFrustumAddOptions,
  ): { viewer: Cesium.Viewer; options: SingleViewFrustumAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as SingleViewFrustumAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}

/** 合并单视锥体默认参数。 */
export function resolveOptions(
  options: SingleViewFrustumAddOptions,
): SingleViewFrustumResolvedOptions & { outlineWidth: number } {
  return {
    position: toCartesian3(options.position),
    heading: options.heading ?? 0,
    pitch: options.pitch ?? 180,
    roll: options.roll ?? 0,
    fov: options.fov ?? 30,
    near: options.near ?? 10,
    far: options.far ?? 3000,
    aspectRatio: options.aspectRatio ?? 1.4,
    fillColor: toCesiumColor(options.fillColor, Cesium.Color.AQUA.withAlpha(0.3)),
    outlineColor: toCesiumColor(options.outlineColor, Cesium.Color.WHITE),
    outlineWidth: options.outlineWidth ?? 1,
    show: options.show ?? true,
  };
}

/** 合并更新参数。 */
export function mergeOptions(
  base: SingleViewFrustumResolvedOptions & { outlineWidth: number },
  patch: SingleViewFrustumUpdateOptions,
): SingleViewFrustumResolvedOptions & { outlineWidth: number } {
  return {
    ...base,
    position: patch.position ? toCartesian3(patch.position) : base.position,
    heading: patch.heading ?? base.heading,
    pitch: patch.pitch ?? base.pitch,
    roll: patch.roll ?? base.roll,
    fov: patch.fov ?? base.fov,
    near: patch.near ?? base.near,
    far: patch.far ?? base.far,
    aspectRatio: patch.aspectRatio ?? base.aspectRatio,
    fillColor: patch.fillColor ? toCesiumColor(patch.fillColor, base.fillColor) : base.fillColor,
    outlineColor: patch.outlineColor ? toCesiumColor(patch.outlineColor, base.outlineColor) : base.outlineColor,
    outlineWidth: patch.outlineWidth ?? base.outlineWidth,
    show: patch.show ?? base.show,
  };
}
