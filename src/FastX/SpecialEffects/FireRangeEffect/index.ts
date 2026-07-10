/**
 * 火力范围特效。
 *
 * 单体使用 Entity 绘制，批量使用 Primitive 绘制；二者复用同一套火力范围几何。
 * Entity 填充面使用单色，Primitive 填充面支持径向渐变。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import {
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";
import {
  createFireRangeEntityGeometry,
  type FireRangeFaceSpec,
  type FireRangeWorldLineSpec,
} from "./geometry";

const FIRE_RANGE_DEFAULTS = {
  radius: 10_000,
  minHoriAngle: -30,
  maxHoriAngle: 30,
  minVertAngle: 80,
  maxVertAngle: 100,
  horiPointNum: 360,
  vertPointNum: 180,
  radialPointNum: 48,
  gridHoriStep: 1,
  gridVertStep: 1,
  gridLineWidth: 1,
  outlineLineWidth: 1,
  apexColor: "rgba(20,40,255,0.58)",
  middleColor: "rgba(210,215,35,0.42)",
  farColor: "rgba(255,140,0,0.58)",
  gridColor: "rgba(255,86,0,0.95)",
  outlineColor: "rgba(255,0,0,0.9)",
  fillAlpha: 1,
  fillVisible: true,
  gridVisible: true,
  outlineVisible: true,
  show: true,
} as const;

/** 新增火力范围参数。 */
export interface FireRangeEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 火力范围顶点位置，支持经纬高数组、经纬高对象或 Cartesian3。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度，默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度，默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度，默认 0。 */
  roll?: number;
  /** 整体缩放，默认 1。 */
  scale?: number;
  /** 火力范围半径，单位：米，默认 10000。 */
  radius?: number;
  /** 最小水平角，单位：度，默认 -30。 */
  minHoriAngle?: number;
  /** 最大水平角，单位：度，默认 30。 */
  maxHoriAngle?: number;
  /** 最小垂直角，单位：度，默认 80；90 表示水平向前。 */
  minVertAngle?: number;
  /** 最大垂直角，单位：度，默认 100；90 表示水平向前。 */
  maxVertAngle?: number;
  /** 水平方向插值点数，数值越大远端弧墙越平滑，默认 360。 */
  horiPointNum?: number;
  /** 垂直方向插值点数，数值越大远端竖墙越平滑，默认 180。 */
  vertPointNum?: number;
  /** 顶点到远端之间的径向插值点数，影响填充面细腻程度，默认 48。 */
  radialPointNum?: number;
  /** 远端网格水平方向抽样步长，1 表示每个水平插值点都绘制网格线，默认 1。 */
  gridHoriStep?: number;
  /** 远端网格垂直方向抽样步长，1 表示每个垂直插值点都绘制网格线，默认 1。 */
  gridVertStep?: number;
  /** 顶点处渐变颜色，批量 Primitive 使用；默认 rgba(20,40,255,0.58)。 */
  apexColor?: SpecialEffectsColorInput;
  /** 单体 Entity 填充色，也是批量 Primitive 渐变中间色；默认 rgba(210,215,35,0.42)。 */
  middleColor?: SpecialEffectsColorInput;
  /** 远端弧墙渐变颜色，批量 Primitive 使用；默认 rgba(255,140,0,0.58)。 */
  farColor?: SpecialEffectsColorInput;
  /** 填充整体透明度倍率，范围 0 到 1，默认 1。 */
  fillAlpha?: number;
  /** 是否绘制填充面，默认 true。 */
  fillVisible?: boolean;
  /** 远端弧形竖墙网格线颜色，默认 rgba(255,86,0,0.95)。 */
  gridColor?: SpecialEffectsColorInput;
  /** 远端弧形竖墙网格线透明度，范围 0 到 1。 */
  gridAlpha?: number;
  /** 远端弧形竖墙网格线宽，单位：像素，默认 1。 */
  gridLineWidth?: number;
  /** 是否绘制远端弧形竖墙网格，默认 true。 */
  gridVisible?: boolean;
  /** 外轮廓线颜色，默认 rgba(255,0,0,0.9)。 */
  outlineColor?: SpecialEffectsColorInput;
  /** 外轮廓线透明度，范围 0 到 1。 */
  outlineAlpha?: number;
  /** 外轮廓线宽，单位：像素，默认 1。 */
  outlineLineWidth?: number;
  /** 是否绘制外轮廓线，默认 true。 */
  outlineVisible?: boolean;
  /** 是否显示，默认 true。 */
  show?: boolean;
}

/** 更新火力范围参数。 */
export type FireRangeEffectUpdateOptions = Partial<Omit<FireRangeEffectAddOptions, "id">>;

type FireRangeEffectSourceOptions = FireRangeEffectAddOptions & { id: string };

/** Cesium 可直接使用的火力范围解析参数。 */
export interface FireRangeEffectResolvedOptions {
  id: string;
  position: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
  show: boolean;
  radius: number;
  minHoriAngle: number;
  maxHoriAngle: number;
  minVertAngle: number;
  maxVertAngle: number;
  horiPointNum: number;
  vertPointNum: number;
  radialPointNum: number;
  gridHoriStep: number;
  gridVertStep: number;
  apexColor: Cesium.Color;
  middleColor: Cesium.Color;
  farColor: Cesium.Color;
  fillAlpha: number;
  fillVisible: boolean;
  gridColor: Cesium.Color;
  gridAlpha: number;
  gridLineWidth: number;
  gridVisible: boolean;
  outlineColor: Cesium.Color;
  outlineAlpha: number;
  outlineLineWidth: number;
  outlineVisible: boolean;
}

interface FireRangeEffectRecord {
  viewer: Cesium.Viewer;
  id: string;
  /** 用户原始参数，用于合并增量更新。 */
  sourceOptions: FireRangeEffectSourceOptions;
  /** 几何和材质使用的解析参数。 */
  options: FireRangeEffectResolvedOptions;
  /** 当前火力范围拥有的填充面、网格线和外轮廓线 Entity。 */
  entities: Cesium.Entity[];
}

/** 单个火力范围 Entity 绘制类。 */
export default class FireRangeEffect {
  private readonly records = new Map<string, FireRangeEffectRecord>();

  constructor(private readonly defaultViewer?: Cesium.Viewer) {}

  /** 新增一个火力范围 Entity，并返回 id。 */
  add(viewer: Cesium.Viewer, options: FireRangeEffectAddOptions): string | undefined;
  add(options: FireRangeEffectAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | FireRangeEffectAddOptions,
    maybeOptions?: FireRangeEffectAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;

    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("fire-range-effect");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    this.records.set(id, this.createRecord(viewer, sourceOptions));
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增火力范围 Entity，并返回创建成功的 id。 */
  addMany(viewer: Cesium.Viewer, options: FireRangeEffectAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增火力范围 Entity，并返回创建成功的 id。 */
  addRanges(viewer: Cesium.Viewer, options: FireRangeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新一个火力范围 Entity，内部会按新参数重建几何。 */
  update(id: string, options: FireRangeEffectUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    const sourceOptions = { ...record.sourceOptions, ...options, id };
    this.records.set(id, this.createRecord(record.viewer, sourceOptions));
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定火力范围 Entity 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    record.options.show = visible;
    record.sourceOptions.show = visible;
    record.entities.forEach((entity) => {
      entity.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定火力范围对应的 Entity 集合。 */
  get(id: string): Cesium.Entity[] | undefined {
    return this.records.get(id)?.entities;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定火力范围 Entity。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    this.records.delete(id);
    return true;
  }

  /** 清空火力范围；传入 viewer 时只清空该 Viewer 下的效果。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部火力范围。 */
  destroy(): void {
    this.clear();
  }

  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | FireRangeEffectAddOptions,
    maybeOptions?: FireRangeEffectAddOptions,
  ): { viewer: Cesium.Viewer; options: FireRangeEffectAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as FireRangeEffectAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  private createRecord(viewer: Cesium.Viewer, sourceOptions: FireRangeEffectSourceOptions): FireRangeEffectRecord {
    const options = resolveFireRangeEffectOptions(sourceOptions);
    const entities = createFireRangeEntities(viewer, options);
    return {
      viewer,
      id: sourceOptions.id,
      sourceOptions,
      options,
      entities,
    };
  }

  private removeRecordEntities(record: FireRangeEffectRecord): void {
    record.entities.forEach((entity) => removeEntity(record.viewer, entity));
  }
}

/** 将用户参数解析为 Cesium 可直接使用的值。 */
export function resolveFireRangeEffectOptions(
  options: FireRangeEffectAddOptions & { id: string },
): FireRangeEffectResolvedOptions {
  const horizontalRange = resolveHorizontalRange(
    finiteNumber(options.minHoriAngle, FIRE_RANGE_DEFAULTS.minHoriAngle),
    finiteNumber(options.maxHoriAngle, FIRE_RANGE_DEFAULTS.maxHoriAngle),
  );
  const verticalRange = resolveOrderedRange(
    finiteNumber(options.minVertAngle, FIRE_RANGE_DEFAULTS.minVertAngle),
    finiteNumber(options.maxVertAngle, FIRE_RANGE_DEFAULTS.maxVertAngle),
  );
  const middleColor = resolveColor(options.middleColor, FIRE_RANGE_DEFAULTS.middleColor);
  const gridColor = resolveColor(options.gridColor, FIRE_RANGE_DEFAULTS.gridColor, options.gridAlpha);
  const outlineColor = resolveColor(options.outlineColor, FIRE_RANGE_DEFAULTS.outlineColor, options.outlineAlpha);
  const horiPointNum = integerAtLeast(options.horiPointNum, FIRE_RANGE_DEFAULTS.horiPointNum, 4);
  const vertPointNum = integerAtLeast(options.vertPointNum, FIRE_RANGE_DEFAULTS.vertPointNum, 4);

  return {
    id: options.id,
    position: toCartesian3(options.position),
    heading: finiteNumber(options.heading, 0),
    pitch: finiteNumber(options.pitch, 0),
    roll: finiteNumber(options.roll, 0),
    scale: positiveNumber(options.scale, 1),
    show: options.show ?? FIRE_RANGE_DEFAULTS.show,
    radius: positiveNumber(options.radius, FIRE_RANGE_DEFAULTS.radius),
    minHoriAngle: horizontalRange.min,
    maxHoriAngle: horizontalRange.max,
    minVertAngle: verticalRange.min,
    maxVertAngle: verticalRange.max,
    horiPointNum,
    vertPointNum,
    radialPointNum: integerAtLeast(options.radialPointNum, FIRE_RANGE_DEFAULTS.radialPointNum, 2),
    gridHoriStep: integerAtLeast(options.gridHoriStep, FIRE_RANGE_DEFAULTS.gridHoriStep, 1),
    gridVertStep: integerAtLeast(options.gridVertStep, FIRE_RANGE_DEFAULTS.gridVertStep, 1),
    apexColor: resolveColor(options.apexColor, FIRE_RANGE_DEFAULTS.apexColor),
    middleColor,
    farColor: resolveColor(options.farColor, FIRE_RANGE_DEFAULTS.farColor),
    fillAlpha: clamp01(options.fillAlpha) ?? FIRE_RANGE_DEFAULTS.fillAlpha,
    fillVisible: options.fillVisible ?? FIRE_RANGE_DEFAULTS.fillVisible,
    gridColor,
    gridAlpha: gridColor.alpha,
    gridLineWidth: positiveNumber(options.gridLineWidth, FIRE_RANGE_DEFAULTS.gridLineWidth),
    gridVisible: options.gridVisible ?? FIRE_RANGE_DEFAULTS.gridVisible,
    outlineColor,
    outlineAlpha: outlineColor.alpha,
    outlineLineWidth: positiveNumber(options.outlineLineWidth, FIRE_RANGE_DEFAULTS.outlineLineWidth),
    outlineVisible: options.outlineVisible ?? FIRE_RANGE_DEFAULTS.outlineVisible,
  };
}

function createFireRangeEntities(
  viewer: Cesium.Viewer,
  options: FireRangeEffectResolvedOptions,
): Cesium.Entity[] {
  const geometry = createFireRangeEntityGeometry(options);
  return [
    ...geometry.faces.map((face, index) =>
      createFaceEntity(viewer, `${options.id}-surface-${index}`, face, options.show),
    ),
    ...geometry.lines.map((line, index) =>
      createLineEntity(viewer, `${options.id}-line-${index}`, line, options.show),
    ),
  ];
}

function createFaceEntity(
  viewer: Cesium.Viewer,
  id: string,
  face: FireRangeFaceSpec,
  show: boolean,
): Cesium.Entity {
  return viewer.entities.add({
    id,
    name: "FastX Fire Range Surface",
    show,
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(face.positions),
      material: new Cesium.ColorMaterialProperty(Cesium.Color.clone(face.color)),
      perPositionHeight: true,
    },
  });
}

function createLineEntity(
  viewer: Cesium.Viewer,
  id: string,
  line: FireRangeWorldLineSpec,
  show: boolean,
): Cesium.Entity {
  return viewer.entities.add({
    id,
    name: "FastX Fire Range Line",
    show,
    polyline: {
      positions: line.positions,
      width: line.width,
      material: new Cesium.ColorMaterialProperty(Cesium.Color.clone(line.color)),
      arcType: Cesium.ArcType.NONE,
    },
  });
}

function resolveColor(
  color: SpecialEffectsColorInput | undefined,
  fallbackCssColor: string,
  alpha?: number,
): Cesium.Color {
  const fallback = Cesium.Color.fromCssColorString(fallbackCssColor)!;
  const resolved = toCesiumColor(color, fallback);
  return applyAlpha(resolved, clamp01(alpha));
}

function applyAlpha(color: Cesium.Color, alpha?: number): Cesium.Color {
  const next = Cesium.Color.clone(color);
  if (alpha !== undefined) next.alpha = alpha;
  return next;
}

function resolveHorizontalRange(minAngle: number, maxAngle: number): { min: number; max: number } {
  let max = maxAngle;
  while (max <= minAngle) max += 360;
  return { min: minAngle, max };
}

function resolveOrderedRange(first: number, second: number): { min: number; max: number } {
  if (first === second) return { min: first, max: first + 1 };
  return first < second ? { min: first, max: second } : { min: second, max: first };
}

function integerAtLeast(value: number | undefined, fallback: number, min: number): number {
  return Math.max(min, Math.floor(positiveNumber(value, fallback)));
}

function positiveNumber(value: number | undefined, fallback: number): number {
  const next = finiteNumber(value, fallback);
  return next > 0 ? next : fallback;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
}
