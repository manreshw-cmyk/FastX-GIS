/**
 * 抛物面雷达特效。
 *
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
  calcParabolaRadarScanAlpha,
  calcParabolaRadarScanAngle,
  createParabolaRadarAnimationState,
  type ParabolaRadarAnimationState,
} from "./animation";
import {
  createParabolaRadarScanBladeFaces,
  createParabolaRadarStaticGeometry,
  type ParabolaRadarFaceSpec,
  type ParabolaRadarLineSpec,
} from "./geometry";

const PARABOLA_RADAR_DEFAULTS = {
  radius: 66_000,
  domeHeight: 18_000,
  scanBladeCount: 1,
  scanBladeAngle: 1,
  scanSpeed: 45,
  horizontalSegments: 96,
  verticalSegments: 10,
  gridLineWidth: 1,
  surfaceColor: "rgba(0,255,72,0.34)",
  gridColor: "rgba(0,255,72,0.78)",
  scanBladeColor: "rgba(255,0,0,0.48)",
  scanBlink: false,
  show: true,
} as const;

/** 新增抛物面雷达参数。 */
export interface ParabolaRadarAddOptions {
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
  /** 弧面半径，单位：米。默认 66000。 */
  radius?: number;
  /** 弧面高度，单位：米。默认 18000。 */
  domeHeight?: number;
  /** 弧面颜色。默认 rgba(0,255,72,0.34)。 */
  surfaceColor?: SpecialEffectsColorInput;
  /** 弧面透明度，范围 0 到 1。 */
  surfaceAlpha?: number;
  /** 网格线颜色。默认 rgba(0,255,72,0.78)。 */
  gridColor?: SpecialEffectsColorInput;
  /** 网格线透明度，范围 0 到 1。 */
  gridAlpha?: number;
  /** 网格线宽，单位：像素。默认 1。 */
  gridLineWidth?: number;
  /** 扫描叶片颜色。默认 rgba(255,0,0,0.48)。 */
  scanBladeColor?: SpecialEffectsColorInput;
  /** 扫描叶片透明度，范围 0 到 1。 */
  scanBladeAlpha?: number;
  /** 扫描叶片角宽，单位：度。默认 1。 */
  scanBladeAngle?: number;
  /** 扫描叶片数量。默认 1。 */
  scanBladeCount?: number;
  /** 扫描旋转速度，单位：度/秒。默认 45。 */
  scanSpeed?: number;
  /** 是否启用叶片闪烁。默认 false。 */
  scanBlink?: boolean;
  /** 水平插值点数。默认 96。 */
  horizontalSegments?: number;
  /** 垂直插值点数。默认 10。 */
  verticalSegments?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 更新抛物面雷达参数。 */
export type ParabolaRadarUpdateOptions = Partial<Omit<ParabolaRadarAddOptions, "id">>;

type ParabolaRadarSourceOptions = ParabolaRadarAddOptions & { id: string };

/** Cesium 可直接使用的抛物面雷达解析参数。 */
export interface ParabolaRadarResolvedOptions {
  id: string;
  position: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
  show: boolean;
  radius: number;
  domeHeight: number;
  surfaceColor: Cesium.Color;
  surfaceAlpha: number;
  gridColor: Cesium.Color;
  gridAlpha: number;
  gridLineWidth: number;
  scanBladeColor: Cesium.Color;
  scanBladeAlpha: number;
  scanBladeAngle: number;
  scanBladeCount: number;
  scanSpeed: number;
  scanBlink: boolean;
  horizontalSegments: number;
  verticalSegments: number;
}

interface ParabolaRadarRecord {
  viewer: Cesium.Viewer;
  id: string;
  /** 用户原始参数，用于合并增量更新。 */
  sourceOptions: ParabolaRadarSourceOptions;
  /** 几何和动画使用的 Cesium 解析参数。 */
  options: ParabolaRadarResolvedOptions;
  /** 当前特效 id 拥有的弧面、网格和扫描叶片 Entity。 */
  entities: Cesium.Entity[];
  /** 移除 preRender 场景刷新监听。 */
  removeTick: () => void;
}

/** 单个抛物面雷达 Entity 绘制类。 */
export default class ParabolaRadar {
  private readonly records = new Map<string, ParabolaRadarRecord>();

  constructor(private readonly defaultViewer?: Cesium.Viewer) {}

  /** 新增一个抛物面雷达 Entity，并返回 id。 */
  add(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions): string | undefined;
  add(options: ParabolaRadarAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | ParabolaRadarAddOptions,
    maybeOptions?: ParabolaRadarAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;

    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("parabola-radar");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    this.records.set(id, this.createRecord(viewer, sourceOptions));
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增抛物面雷达 Entity，并返回创建成功的 id。 */
  addMany(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增抛物面雷达 Entity，并返回创建成功的 id。 */
  addRadars(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新一个抛物面雷达 Entity。 */
  update(id: string, options: ParabolaRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    record.removeTick();

    const sourceOptions = { ...record.sourceOptions, ...options, id };
    this.records.set(id, this.createRecord(record.viewer, sourceOptions));
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置一个抛物面雷达 Entity 的显隐。 */
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

  /** 移除一个抛物面雷达 Entity。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    record.removeTick();
    this.records.delete(id);
    return true;
  }

  /** 清空抛物面雷达，可按 Viewer 过滤。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理的全部抛物面雷达。 */
  destroy(): void {
    this.clear();
  }

  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | ParabolaRadarAddOptions,
    maybeOptions?: ParabolaRadarAddOptions,
  ): { viewer: Cesium.Viewer; options: ParabolaRadarAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as ParabolaRadarAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  private removeRecordEntities(record: ParabolaRadarRecord): void {
    record.entities.forEach((entity) => removeEntity(record.viewer, entity));
  }

  /** 解析参数并创建单个雷达所需的全部 Entity。 */
  private createRecord(viewer: Cesium.Viewer, sourceOptions: ParabolaRadarSourceOptions): ParabolaRadarRecord {
    const options = resolveParabolaRadarOptions(sourceOptions);
    const entities = createParabolaRadarEntities(viewer, sourceOptions.id, options);
    const removeTick = this.createRenderInvalidator(viewer, sourceOptions.id);
    return {
      viewer,
      id: sourceOptions.id,
      sourceOptions,
      options,
      entities,
      removeTick,
    };
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
export function resolveParabolaRadarOptions(
  options: ParabolaRadarAddOptions & { id: string },
): ParabolaRadarResolvedOptions {
  const surfaceColor = resolveColor(
    options.surfaceColor,
    PARABOLA_RADAR_DEFAULTS.surfaceColor,
    options.surfaceAlpha,
  );
  const gridColor = resolveColor(options.gridColor, PARABOLA_RADAR_DEFAULTS.gridColor, options.gridAlpha);
  const scanBladeColor = resolveColor(
    options.scanBladeColor,
    PARABOLA_RADAR_DEFAULTS.scanBladeColor,
    options.scanBladeAlpha,
  );
  const horizontalSegments = integerAtLeast(
    options.horizontalSegments,
    PARABOLA_RADAR_DEFAULTS.horizontalSegments,
    16,
  );
  const verticalSegments = integerAtLeast(options.verticalSegments, PARABOLA_RADAR_DEFAULTS.verticalSegments, 2);
  const gridLineWidth = positiveNumber(options.gridLineWidth, PARABOLA_RADAR_DEFAULTS.gridLineWidth);

  return {
    id: options.id,
    position: toCartesian3(options.position),
    heading: finiteNumber(options.heading, 0),
    pitch: finiteNumber(options.pitch, 0),
    roll: finiteNumber(options.roll, 0),
    scale: positiveNumber(options.scale, 1),
    show: options.show ?? PARABOLA_RADAR_DEFAULTS.show,
    radius: positiveNumber(options.radius, PARABOLA_RADAR_DEFAULTS.radius),
    domeHeight: positiveNumber(options.domeHeight, PARABOLA_RADAR_DEFAULTS.domeHeight),
    surfaceColor,
    surfaceAlpha: surfaceColor.alpha,
    gridColor,
    gridAlpha: gridColor.alpha,
    gridLineWidth,
    scanBladeColor,
    scanBladeAlpha: scanBladeColor.alpha,
    scanBladeAngle: clamp(finiteNumber(options.scanBladeAngle, PARABOLA_RADAR_DEFAULTS.scanBladeAngle), 1, 120),
    scanBladeCount: integerAtLeast(options.scanBladeCount, PARABOLA_RADAR_DEFAULTS.scanBladeCount, 1),
    scanSpeed: finiteNumber(options.scanSpeed, PARABOLA_RADAR_DEFAULTS.scanSpeed),
    scanBlink: options.scanBlink ?? PARABOLA_RADAR_DEFAULTS.scanBlink,
    horizontalSegments,
    verticalSegments,
  };
}

function createParabolaRadarEntities(
  viewer: Cesium.Viewer,
  id: string,
  options: ParabolaRadarResolvedOptions,
): Cesium.Entity[] {
  const staticGeometry = createParabolaRadarStaticGeometry(options);
  const animation = createParabolaRadarAnimationState();
  return [
    ...staticGeometry.faces.map((face, index) =>
      createFaceEntity(viewer, `${id}-surface-${index}`, "FastX Parabola Radar Surface", face, options.show),
    ),
    ...staticGeometry.lines.map((line, index) =>
      createLineEntity(viewer, `${id}-grid-${index}`, "FastX Parabola Radar Grid", line, options.show),
    ),
    ...createScanBladeEntities(viewer, id, options, animation),
  ];
}

function createFaceEntity(
  viewer: Cesium.Viewer,
  id: string,
  name: string,
  face: ParabolaRadarFaceSpec,
  show: boolean,
): Cesium.Entity {
  return viewer.entities.add({
    id,
    name,
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
  name: string,
  line: ParabolaRadarLineSpec,
  show: boolean,
): Cesium.Entity {
  return viewer.entities.add({
    id,
    name,
    show,
    polyline: {
      positions: line.positions,
      width: line.width,
      material: new Cesium.ColorMaterialProperty(Cesium.Color.clone(line.color)),
      arcType: Cesium.ArcType.NONE,
    },
  });
}

function createScanBladeEntities(
  viewer: Cesium.Viewer,
  id: string,
  options: ParabolaRadarResolvedOptions,
  animation: ParabolaRadarAnimationState,
): Cesium.Entity[] {
  const material = animatedScanBladeMaterial(options, animation);
  return createParabolaRadarScanBladeFaces(options, 0).map((_face, index) =>
    viewer.entities.add({
      id: `${id}-scan-blade-${index}`,
      name: "FastX Parabola Radar Scan Blade",
      show: options.show,
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const angle = calcParabolaRadarScanAngle(options, animation);
          return new Cesium.PolygonHierarchy(
            createParabolaRadarScanBladeFaces(options, angle)[index]?.positions ?? [],
          );
        }, false),
        material,
        perPositionHeight: true,
      },
    }),
  );
}

function animatedScanBladeMaterial(
  options: ParabolaRadarResolvedOptions,
  animation: ParabolaRadarAnimationState,
): Cesium.ColorMaterialProperty {
  return new Cesium.ColorMaterialProperty(
    new Cesium.CallbackProperty((_time, result) => {
      const out = Cesium.Color.clone(options.scanBladeColor, result);
      out.alpha = calcParabolaRadarScanAlpha(options.scanBladeAlpha, options.scanBlink, animation);
      return out;
    }, false),
  );
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

function clamp01(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
