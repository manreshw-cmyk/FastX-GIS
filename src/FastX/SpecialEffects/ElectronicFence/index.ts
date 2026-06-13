/**
 * 电子围栏特效。
 * Entity 类用于单体绘制，ElectronicFenceCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCartesian3Array,
  toCesiumColor,
} from "../shared";
import {
  ElectronicFenceMaterialProperty,
  registerElectronicFenceMaterial,
  resolveElectronicFenceDirection,
  type ElectronicFenceFlowDirection,
} from "./material";

export type { ElectronicFenceFlowDirection } from "./material";

/** 电子围栏新增参数。 */
export interface ElectronicFenceAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 围栏底部经纬度点位，至少传入两个点。 */
  positions: readonly SpecialEffectsPositionInput[];
  /** 围栏高度，单位：米，默认 500。 */
  height?: number;
  /** 每个顶点的顶部高度，优先级高于 height。 */
  maximumHeights?: readonly number[];
  /** 每个顶点的底部高度，默认全 0。 */
  minimumHeights?: readonly number[];
  /** 围栏颜色，默认 cyan。 */
  color?: SpecialEffectsColorInput;
  /** 围栏流动贴图地址，不传时使用内置默认贴图。 */
  image?: string;
  /** 一轮流动动画耗时，单位：毫秒，默认 1500。 */
  duration?: number;
  /** 贴图重复次数，默认 3。 */
  count?: number;
  /** 贴图流动方向，默认 up。 */
  direction?: ElectronicFenceFlowDirection;
  /** 是否显示，默认 true。 */
  show?: boolean;
}

/** 电子围栏更新参数。 */
export type ElectronicFenceUpdateOptions = Partial<Omit<ElectronicFenceAddOptions, "id">>;

/** 电子围栏 Entity 记录。 */
interface ElectronicFenceRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 围栏实体。 */
  entity: Cesium.Entity;
  /** 动态材质。 */
  material: ElectronicFenceMaterialProperty;
  /** 当前围栏点位。 */
  positions: readonly SpecialEffectsPositionInput[];
  /** 当前统一高度。 */
  height: number;
  /** 当前顶部高度数组。 */
  maximumHeights?: readonly number[];
  /** 当前底部高度数组。 */
  minimumHeights?: readonly number[];
}

/** 电子围栏单体 Entity 绘制类。 */
export default class ElectronicFence {
  /** 兼容默认 Viewer 构造方式。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的围栏记录。 */
  private readonly records = new Map<string, ElectronicFenceRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
    registerElectronicFenceMaterial();
  }

  /** 新增一个电子围栏，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: ElectronicFenceAddOptions): string | undefined;
  add(options: ElectronicFenceAddOptions): string | undefined;
  add(viewerOrOptions: Cesium.Viewer | ElectronicFenceAddOptions, maybeOptions?: ElectronicFenceAddOptions): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved || resolved.options.positions.length < 2) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("electronic-fence");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const material = this.createMaterial(options);
    const entity = viewer.entities.add({
      id,
      name: "FastX Electronic Fence",
      show: options.show ?? true,
      wall: {
        positions: toCartesian3Array(options.positions),
        maximumHeights: resolveMaximumHeights(options),
        minimumHeights: resolveMinimumHeights(options),
        material,
      },
    });

    this.records.set(id, {
      viewer,
      entity,
      material,
      positions: options.positions,
      height: options.height ?? 500,
      maximumHeights: options.maximumHeights,
      minimumHeights: options.minimumHeights,
    });
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定电子围栏。 */
  update(id: string, options: ElectronicFenceUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record || !record.entity.wall) return false;

    if (options.positions) {
      if (options.positions.length < 2) return false;
      record.positions = options.positions;
      record.entity.wall.positions = new Cesium.ConstantProperty(toCartesian3Array(options.positions));
    }
    if (typeof options.height === "number") {
      record.height = options.height;
      record.maximumHeights = undefined;
    }
    if (options.maximumHeights) record.maximumHeights = options.maximumHeights;
    if (options.minimumHeights) record.minimumHeights = options.minimumHeights;
    if (typeof options.height === "number" || options.maximumHeights || options.positions) {
      record.entity.wall.maximumHeights = new Cesium.ConstantProperty(
        resolveMaximumHeights({
          positions: record.positions,
          height: record.height,
          maximumHeights: record.maximumHeights,
        }),
      );
    }
    if (options.minimumHeights || options.positions) {
      record.entity.wall.minimumHeights = new Cesium.ConstantProperty(
        resolveMinimumHeights({
          positions: record.positions,
          minimumHeights: record.minimumHeights,
        }),
      );
    }
    if (options.color) record.material.color = toCesiumColor(options.color, record.material.color);
    if (options.image) record.material.image = options.image;
    if (typeof options.duration === "number") record.material.duration = options.duration;
    if (typeof options.count === "number") record.material.count = options.count;
    if (options.direction) {
      const flow = resolveElectronicFenceDirection(options.direction);
      record.material.vertical = flow.vertical;
      record.material.direction = flow.direction;
    }
    if (typeof options.show === "boolean") record.entity.show = options.show;

    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定电子围栏显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定电子围栏 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 获取当前管理的全部围栏 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.entries()]
      .filter(([, record]) => !viewer || record.viewer === viewer)
      .map(([id]) => id);
  }

  /** 删除指定电子围栏。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removeEntity(record.viewer, record.entity);
    this.records.delete(id);
    return true;
  }

  /** 清空所有电子围栏；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.records.forEach((record, id) => {
      if (!viewer || viewer === record.viewer) {
        removeEntity(record.viewer, record.entity);
        this.records.delete(id);
      }
    });
  }

  /** 销毁当前类管理的所有电子围栏。 */
  destroy(): void {
    this.clear();
  }

  /** 创建电子围栏动态材质。 */
  private createMaterial(options: ElectronicFenceAddOptions): ElectronicFenceMaterialProperty {
    return new ElectronicFenceMaterialProperty({
      color: toCesiumColor(options.color, Cesium.Color.CYAN),
      image: options.image,
      duration: options.duration ?? 1500,
      count: options.count ?? 3,
      direction: options.direction ?? "up",
    });
  }

  /** 解析默认 Viewer 调用和显式 Viewer 调用两种参数形式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | ElectronicFenceAddOptions,
    maybeOptions?: ElectronicFenceAddOptions,
  ): { viewer: Cesium.Viewer; options: ElectronicFenceAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as ElectronicFenceAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}

/** 计算每个围栏点的顶部高度。 */
export function resolveMaximumHeights(
  options: Pick<ElectronicFenceAddOptions, "positions" | "height" | "maximumHeights">,
): number[] {
  if (options.maximumHeights?.length) return Array.from(options.maximumHeights);
  return new Array(options.positions.length).fill(options.height ?? 500);
}

/** 计算每个围栏点的底部高度。 */
export function resolveMinimumHeights(
  options: Pick<ElectronicFenceAddOptions, "positions" | "minimumHeights">,
): number[] {
  if (options.minimumHeights?.length) return Array.from(options.minimumHeights);
  return new Array(options.positions.length).fill(0);
}
