/**
 * 多边形扩散墙特效。
 * 支持两种绘制方式：
 * 1. positions 多点围成固定多边形墙；
 * 2. center + radius + edge 生成参考项目同款正多边形扩散墙。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCesiumColor,
} from "../shared";
import {
  PolygonDiffusionWallGeometryData,
  PolygonDiffusionWallMaterialProperty,
  getPolygonDiffusionWallAnimatedState,
  registerPolygonDiffusionWallMaterial,
  resolvePolygonDiffusionWallGeometry,
} from "./material";

/** 多边形扩散墙新增参数。 */
export interface PolygonDiffusionWallAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 固定多边形底部经纬度点位，至少三个点；首尾不一致时 SDK 自动闭合。 */
  positions?: readonly SpecialEffectsPositionInput[];
  /** 正多边形扩散中心点，传入后使用参考项目同款扩散动画。 */
  center?: SpecialEffectsPositionInput;
  /** 墙体高度，单位：米；center 模式默认 100，positions 模式默认 800。 */
  height?: number;
  /** 正多边形最大扩散半径，单位：米，center 模式默认 1000。 */
  radius?: number;
  /** 正多边形边数，center 模式默认 64。 */
  edge?: number;
  /** 扩散速度，center 模式默认 5。 */
  speed?: number;
  /** 正多边形最小扩散半径，单位：米，center 模式默认 10。 */
  minRadius?: number;
  /** 每个顶点的顶部高度，优先级高于 height。 */
  maximumHeights?: readonly number[];
  /** 每个顶点的底部高度，默认使用点位自带高度。 */
  minimumHeights?: readonly number[];
  /** 墙体颜色，默认 yellow，与参考项目保持一致。 */
  color?: SpecialEffectsColorInput;
  /** 一轮材质动画耗时，单位：毫秒，默认 1600。 */
  duration?: number;
  /** 是否显示，默认 true。 */
  show?: boolean;
}

/** 多边形扩散墙更新参数。 */
export type PolygonDiffusionWallUpdateOptions = Partial<Omit<PolygonDiffusionWallAddOptions, "id">>;

/** 多边形扩散墙内部标准参数。 */
export interface PolygonDiffusionWallResolvedOptions {
  /** 固定多边形点位。 */
  positions?: readonly SpecialEffectsPositionInput[];
  /** 正多边形扩散中心点。 */
  center?: SpecialEffectsPositionInput;
  /** 墙体高度，单位：米。 */
  height: number;
  /** 正多边形最大扩散半径，单位：米。 */
  radius: number;
  /** 正多边形边数。 */
  edge: number;
  /** 扩散速度。 */
  speed: number;
  /** 正多边形最小扩散半径，单位：米。 */
  minRadius: number;
  /** 当前扩散半径，单位：米。 */
  currentRadius: number;
  /** 当前墙体高度，单位：米。 */
  currentHeight: number;
  /** 每个顶点的顶部高度。 */
  maximumHeights?: readonly number[];
  /** 每个顶点的底部高度。 */
  minimumHeights?: readonly number[];
  /** 墙体颜色。 */
  color: Cesium.Color;
  /** 材质动画耗时，单位：毫秒。 */
  duration: number;
  /** 是否显示。 */
  show: boolean;
}

/** 多边形扩散墙 Entity 记录。 */
interface PolygonDiffusionWallRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 扩散墙实体。 */
  entity: Cesium.Entity;
  /** 扩散墙动态材质。 */
  material: PolygonDiffusionWallMaterialProperty;
  /** 当前墙体几何数据。 */
  geometry: PolygonDiffusionWallGeometryData;
  /** 当前外部参数。 */
  options: PolygonDiffusionWallResolvedOptions;
  /** 中心扩散动画起始时间。 */
  startTime: number;
}

/** 多边形扩散墙单体 Entity 绘制类。 */
export default class PolygonDiffusionWall {
  /** 兼容默认 Viewer 构造方式。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的扩散墙记录。 */
  private readonly records = new Map<string, PolygonDiffusionWallRecord>();
  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
    registerPolygonDiffusionWallMaterial();
  }

  /** 新增一个多边形扩散墙，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: PolygonDiffusionWallAddOptions): string | undefined;
  add(options: PolygonDiffusionWallAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | PolygonDiffusionWallAddOptions,
    maybeOptions?: PolygonDiffusionWallAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved || !hasValidGeometry(resolved.options)) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("polygon-diffusion-wall");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const recordOptions = resolvePolygonDiffusionWallOptions(options);
    const geometry = resolvePolygonDiffusionWallGeometry(recordOptions);
    const material = new PolygonDiffusionWallMaterialProperty({
      color: recordOptions.color,
      duration: recordOptions.duration,
    });
    const startTime = Date.now();
    const readGeometry = (): PolygonDiffusionWallGeometryData => this.resolveCurrentGeometry(id, geometry);
    const entity = viewer.entities.add({
      id,
      name: "FastX Polygon Diffusion Wall",
      show: recordOptions.show,
      wall: recordOptions.center
        ? {
            positions: new Cesium.CallbackProperty(() => readGeometry().cartesians, false),
            material,
          }
        : {
            positions: geometry.cartesians,
            minimumHeights: geometry.minimumHeights,
            maximumHeights: geometry.maximumHeights,
            material,
          },
    });

    this.records.set(id, { viewer, entity, material, geometry, options: recordOptions, startTime });
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定多边形扩散墙。 */
  update(id: string, options: PolygonDiffusionWallUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record || !record.entity.wall) return false;
    if (options.positions && options.positions.length < 3) return false;

    patchPolygonDiffusionWallOptions(record.options, options);
    record.geometry = resolvePolygonDiffusionWallGeometry(record.options);
    if (options.positions || options.center || typeof options.height === "number" || options.maximumHeights || options.minimumHeights) {
      if (record.options.center) {
        record.startTime = Date.now();
        record.entity.wall.positions = new Cesium.CallbackProperty(() => this.resolveCurrentGeometry(id, record.geometry).cartesians, false);
        record.entity.wall.minimumHeights = undefined;
        record.entity.wall.maximumHeights = undefined;
      } else {
        record.entity.wall.positions = new Cesium.ConstantProperty(record.geometry.cartesians);
        record.entity.wall.minimumHeights = new Cesium.ConstantProperty(record.geometry.minimumHeights);
        record.entity.wall.maximumHeights = new Cesium.ConstantProperty(record.geometry.maximumHeights);
      }
    }
    if (options.color) record.material.color = record.options.color;
    if (typeof options.duration === "number") record.material.duration = record.options.duration;
    if (typeof options.show === "boolean") record.entity.show = record.options.show;

    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定多边形扩散墙显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定多边形扩散墙 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 获取当前管理的全部扩散墙 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.entries()]
      .filter(([, record]) => !viewer || record.viewer === viewer)
      .map(([id]) => id);
  }

  /** 删除指定多边形扩散墙。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removeEntity(record.viewer, record.entity);
    this.records.delete(id);
    return true;
  }

  /** 清空所有多边形扩散墙；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的所有多边形扩散墙。 */
  destroy(): void {
    this.clear();
  }

  /** 解析默认 Viewer 调用和显式 Viewer 调用两种参数形式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | PolygonDiffusionWallAddOptions,
    maybeOptions?: PolygonDiffusionWallAddOptions,
  ): { viewer: Cesium.Viewer; options: PolygonDiffusionWallAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as PolygonDiffusionWallAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  /** 按当前时间计算中心扩散墙几何，固定多边形直接复用缓存。 */
  private resolveCurrentGeometry(id: string, fallback: PolygonDiffusionWallGeometryData): PolygonDiffusionWallGeometryData {
    const record = this.records.get(id);
    if (!record?.options.center) return record?.geometry ?? fallback;
    const state = getPolygonDiffusionWallAnimatedState(record.startTime, record.options);
    return resolvePolygonDiffusionWallGeometry({
      ...record.options,
      currentRadius: state.currentRadius,
      currentHeight: state.currentHeight,
    });
  }
}

/** 将外部参数标准化为内部记录。 */
export function resolvePolygonDiffusionWallOptions(options: PolygonDiffusionWallAddOptions): PolygonDiffusionWallResolvedOptions {
  const isCenterMode = !!options.center;
  const height = options.height ?? (isCenterMode ? 100 : 800);
  const minRadius = options.minRadius ?? 10;
  return {
    positions: options.positions,
    center: options.center,
    height,
    radius: options.radius ?? 1000,
    edge: Math.max(3, Math.floor(options.edge ?? 64)),
    speed: options.speed ?? 5,
    minRadius,
    currentRadius: minRadius,
    currentHeight: height,
    maximumHeights: options.maximumHeights,
    minimumHeights: options.minimumHeights,
    color: toCesiumColor(options.color, Cesium.Color.YELLOW),
    duration: options.duration ?? 1600,
    show: options.show ?? true,
  };
}

/** 合并多边形扩散墙更新参数。 */
export function patchPolygonDiffusionWallOptions(
  target: PolygonDiffusionWallResolvedOptions,
  options: PolygonDiffusionWallUpdateOptions,
): void {
  if (options.positions) {
    target.positions = options.positions;
    target.center = undefined;
  }
  if (options.center) {
    target.center = options.center;
    target.positions = undefined;
  }
  if (typeof options.height === "number") {
    target.height = options.height;
    target.currentHeight = options.height;
    target.maximumHeights = undefined;
  }
  if (typeof options.radius === "number") target.radius = options.radius;
  if (typeof options.edge === "number") target.edge = Math.max(3, Math.floor(options.edge));
  if (typeof options.speed === "number") target.speed = options.speed;
  if (typeof options.minRadius === "number") {
    target.minRadius = options.minRadius;
    target.currentRadius = options.minRadius;
  }
  if (options.maximumHeights) target.maximumHeights = options.maximumHeights;
  if (options.minimumHeights) target.minimumHeights = options.minimumHeights;
  if (options.color) target.color = toCesiumColor(options.color, target.color);
  if (typeof options.duration === "number") target.duration = options.duration;
  if (typeof options.show === "boolean") target.show = options.show;
}

/** 判断外部参数是否能构成可绘制墙体。 */
function hasValidGeometry(options: PolygonDiffusionWallAddOptions): boolean {
  return !!options.center || !!(options.positions && options.positions.length >= 3);
}

/** 推进中心点扩散动画，并避免同一 Cesium 帧重复推进。 */
