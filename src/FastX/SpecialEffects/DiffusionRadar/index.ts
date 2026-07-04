/**
 * 扩散雷达特效。
 *
 * 通过 startAngle 和 endAngle 同时支持扇形和圆形扩散范围。
 * 单体绘制使用 Entity，批量绘制使用 Primitive。
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
  calcDiffusionRadarWaveState,
  createDiffusionRadarAnimationState,
  type DiffusionRadarAnimationState,
} from "./animation";
import {
  createDiffusionRadarStaticGeometry,
  createDiffusionRadarWavePositions,
} from "./geometry";

const FULL_CIRCLE_DEGREES = 360;
const FULL_CIRCLE_EPSILON = 0.001;

const DIFFUSION_RADAR_DEFAULTS = {
  radius: 400_000,
  startAngle: 0,
  endAngle: 360,
  waveCount: 4,
  duration: 2_200,
  segments: 128,
  lineWidth: 2,
  color: "rgba(0,214,255,0.22)",
  lineColor: "rgba(0,255,255,0.85)",
  show: true,
} as const;

/** 新增扩散雷达参数。 */
export interface DiffusionRadarAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 雷达中心点位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 扩散半径，单位：米。默认 400000。 */
  radius?: number;
  /** 起始角度，单位：度。默认 0。 */
  startAngle?: number;
  /** 结束角度，单位：度。默认 360；与起始角度形成 360 度范围时为圆形。 */
  endAngle?: number;
  /** 扩散范围填充颜色。默认 rgba(0,214,255,0.22)。 */
  color?: SpecialEffectsColorInput;
  /** 扩散范围填充透明度，范围 0 到 1。 */
  colorAlpha?: number;
  /** 波纹和边界线颜色。默认 rgba(0,255,255,0.85)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 波纹和边界线透明度，范围 0 到 1。 */
  lineAlpha?: number;
  /** 波纹和边界线宽，单位：像素。默认 2。 */
  lineWidth?: number;
  /** 几何分段数。默认 128。 */
  segments?: number;
  /** 同时显示的波纹数量。默认 4。 */
  waveCount?: number;
  /** 单条波纹扩散一轮的时长，单位：毫秒。默认 2200。 */
  duration?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 更新扩散雷达参数。 */
export type DiffusionRadarUpdateOptions = Partial<Omit<DiffusionRadarAddOptions, "id">>;

type DiffusionRadarSourceOptions = DiffusionRadarAddOptions & { id: string };

/** Cesium 可直接使用的扩散雷达解析参数。 */
export interface DiffusionRadarResolvedOptions {
  id: string;
  position: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
  show: boolean;
  radius: number;
  startAngle: number;
  endAngle: number;
  angleSpan: number;
  isCircle: boolean;
  color: Cesium.Color;
  colorAlpha: number;
  lineColor: Cesium.Color;
  lineAlpha: number;
  lineWidth: number;
  segments: number;
  waveCount: number;
  duration: number;
}

interface DiffusionRadarRecord {
  viewer: Cesium.Viewer;
  id: string;
  /** 用户原始参数，用于合并增量更新。 */
  sourceOptions: DiffusionRadarSourceOptions;
  /** 几何和动画使用的 Cesium 解析参数。 */
  options: DiffusionRadarResolvedOptions;
  /** 当前特效 id 拥有的填充面、边界线和波纹 Entity。 */
  entities: Cesium.Entity[];
  /** 波纹动画状态。 */
  animation: DiffusionRadarAnimationState;
  /** 移除 preRender 场景刷新监听。 */
  removeTick: () => void;
}

/** 单个扩散雷达 Entity 绘制类。 */
export default class DiffusionRadar {
  private readonly records = new Map<string, DiffusionRadarRecord>();

  constructor(private readonly defaultViewer?: Cesium.Viewer) {}

  /** 新增一个扩散雷达 Entity，并返回 id。 */
  add(viewer: Cesium.Viewer, options: DiffusionRadarAddOptions): string | undefined;
  add(options: DiffusionRadarAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | DiffusionRadarAddOptions,
    maybeOptions?: DiffusionRadarAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;

    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("diffusion-radar");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    this.records.set(id, this.createRecord(viewer, sourceOptions));
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增扩散雷达 Entity，并返回创建成功的 id。 */
  addMany(viewer: Cesium.Viewer, options: DiffusionRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增扩散雷达 Entity，并返回创建成功的 id。 */
  addRadars(viewer: Cesium.Viewer, options: DiffusionRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新一个扩散雷达 Entity。 */
  update(id: string, options: DiffusionRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    record.removeTick();

    const sourceOptions = { ...record.sourceOptions, ...options, id };
    this.records.set(id, this.createRecord(record.viewer, sourceOptions, record.animation.startTime));
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置一个扩散雷达 Entity 的显隐。 */
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

  /** 根据特效 id 获取 Entity 列表。 */
  get(id: string): Cesium.Entity[] | undefined {
    return this.records.get(id)?.entities;
  }

  /** 获取所有 id，可按 Viewer 过滤。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 移除一个扩散雷达 Entity。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    record.removeTick();
    this.records.delete(id);
    return true;
  }

  /** 清空扩散雷达，可按 Viewer 过滤。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理的全部扩散雷达。 */
  destroy(): void {
    this.clear();
  }

  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | DiffusionRadarAddOptions,
    maybeOptions?: DiffusionRadarAddOptions,
  ): { viewer: Cesium.Viewer; options: DiffusionRadarAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as DiffusionRadarAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  private createRecord(
    viewer: Cesium.Viewer,
    sourceOptions: DiffusionRadarSourceOptions,
    startTime?: number,
  ): DiffusionRadarRecord {
    const options = resolveDiffusionRadarOptions(sourceOptions);
    const animation = createDiffusionRadarAnimationState(startTime);
    const entities = createDiffusionRadarEntities(viewer, options, animation);
    const removeTick = this.createRenderInvalidator(viewer, options.id);
    return {
      viewer,
      id: options.id,
      sourceOptions,
      options,
      entities,
      animation,
      removeTick,
    };
  }

  private removeRecordEntities(record: DiffusionRadarRecord): void {
    record.entities.forEach((entity) => removeEntity(record.viewer, entity));
  }

  private createRenderInvalidator(viewer: Cesium.Viewer, id: string): () => void {
    const listener = () => {
      const record = this.records.get(id);
      if (record?.options.show && !viewer.isDestroyed()) requestSceneRender(viewer);
    };
    viewer.scene.preRender.addEventListener(listener);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(listener);
    };
  }
}

/** 将用户参数解析为 Cesium 可直接使用的值。 */
export function resolveDiffusionRadarOptions(
  options: DiffusionRadarAddOptions & { id: string },
): DiffusionRadarResolvedOptions {
  const color = resolveColor(options.color, DIFFUSION_RADAR_DEFAULTS.color, options.colorAlpha);
  const lineColor = resolveColor(options.lineColor, DIFFUSION_RADAR_DEFAULTS.lineColor, options.lineAlpha);
  const angleRange = resolveAngleRange(options.startAngle, options.endAngle);

  return {
    id: options.id,
    position: toCartesian3(options.position),
    heading: finiteNumber(options.heading, 0),
    pitch: finiteNumber(options.pitch, 0),
    roll: finiteNumber(options.roll, 0),
    scale: positiveNumber(options.scale, 1),
    show: options.show ?? DIFFUSION_RADAR_DEFAULTS.show,
    radius: positiveNumber(options.radius, DIFFUSION_RADAR_DEFAULTS.radius),
    ...angleRange,
    color,
    colorAlpha: color.alpha,
    lineColor,
    lineAlpha: lineColor.alpha,
    lineWidth: positiveNumber(options.lineWidth, DIFFUSION_RADAR_DEFAULTS.lineWidth),
    segments: integerAtLeast(options.segments, DIFFUSION_RADAR_DEFAULTS.segments, 8),
    waveCount: integerAtLeast(options.waveCount, DIFFUSION_RADAR_DEFAULTS.waveCount, 1),
    duration: positiveNumber(options.duration, DIFFUSION_RADAR_DEFAULTS.duration),
  };
}

function createDiffusionRadarEntities(
  viewer: Cesium.Viewer,
  options: DiffusionRadarResolvedOptions,
  animation: DiffusionRadarAnimationState,
): Cesium.Entity[] {
  const staticGeometry = createDiffusionRadarStaticGeometry(options);
  return [
    ...staticGeometry.faces.map((face, index) =>
      viewer.entities.add({
        id: `${options.id}-surface-${index}`,
        name: "FastX Diffusion Radar Surface",
        show: options.show,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(face.positions),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.clone(face.color)),
          perPositionHeight: true,
        },
      }),
    ),
    ...staticGeometry.lines.map((line, index) =>
      viewer.entities.add({
        id: `${options.id}-outline-${index}`,
        name: "FastX Diffusion Radar Outline",
        show: options.show,
        polyline: {
          positions: line.positions,
          width: line.width,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.clone(line.color)),
          arcType: Cesium.ArcType.NONE,
        },
      }),
    ),
    ...createDiffusionRadarWaveEntities(viewer, options, animation),
  ];
}

function createDiffusionRadarWaveEntities(
  viewer: Cesium.Viewer,
  options: DiffusionRadarResolvedOptions,
  animation: DiffusionRadarAnimationState,
): Cesium.Entity[] {
  return Array.from({ length: options.waveCount }, (_, index) =>
    viewer.entities.add({
      id: `${options.id}-wave-${index}`,
      name: "FastX Diffusion Radar Wave",
      show: options.show,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const wave = calcDiffusionRadarWaveState(options, animation, index);
          return createDiffusionRadarWavePositions(options, wave.radius);
        }, false),
        width: options.lineWidth,
        material: createWaveMaterial(options, animation, index),
        arcType: Cesium.ArcType.NONE,
      },
    }),
  );
}

function createWaveMaterial(
  options: DiffusionRadarResolvedOptions,
  animation: DiffusionRadarAnimationState,
  index: number,
): Cesium.ColorMaterialProperty {
  return new Cesium.ColorMaterialProperty(
    new Cesium.CallbackProperty((_time, result) => {
      const wave = calcDiffusionRadarWaveState(options, animation, index);
      const color = Cesium.Color.clone(options.lineColor, result);
      color.alpha = wave.alpha;
      return color;
    }, false),
  );
}

function resolveAngleRange(startAngle?: number, endAngle?: number): {
  startAngle: number;
  endAngle: number;
  angleSpan: number;
  isCircle: boolean;
} {
  const rawStart = finiteNumber(startAngle, DIFFUSION_RADAR_DEFAULTS.startAngle);
  const start = normalizeAngle(rawStart);
  const rawEnd = finiteNumber(endAngle, DIFFUSION_RADAR_DEFAULTS.endAngle);
  let span = rawEnd - rawStart;
  while (span <= 0) span += FULL_CIRCLE_DEGREES;
  span = span >= FULL_CIRCLE_DEGREES - FULL_CIRCLE_EPSILON ? FULL_CIRCLE_DEGREES : span;
  const angleSpan = clamp(span, FULL_CIRCLE_EPSILON, FULL_CIRCLE_DEGREES);
  return {
    startAngle: start,
    endAngle: start + angleSpan,
    angleSpan,
    isCircle: angleSpan >= FULL_CIRCLE_DEGREES - FULL_CIRCLE_EPSILON,
  };
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

function normalizeAngle(angle: number): number {
  return ((angle % FULL_CIRCLE_DEGREES) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
}

function clamp01(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
