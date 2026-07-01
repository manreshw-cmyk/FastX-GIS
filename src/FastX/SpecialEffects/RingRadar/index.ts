/**
 * 环形雷达扫描特效。
 *
 * 单体绘制为内外双层三维弧形环带：内环 3 个垂直扫描叶片，外环 1 个垂直扫描叶片，
 * 外环叶片与内环第 1 个叶片同步重叠。
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
import { createLocalFrame, localToWorld, type LocalPoint } from "../common/effect-geometry";

const AUTO_SCAN_BLADE_ANGLE = 32;
const INNER_SCAN_BLADE_COUNT = 3;

const RING_RADAR_DEFAULTS = {
  innerRadius: 33_000,
  outerRadius: 66_000,
  innerDomeHeight: 9_000,
  outerDomeHeight: 18_000,
  scanSpeed: 45,
  scanBladeAngle: 0,
  horizontalSegments: 96,
  verticalSegments: 10,
  gridLineWidth: 1,
  outerSurfaceColor: "rgba(200,96,31,0.34)",
  outerGridColor: "rgba(200,96,31,0.78)",
  innerSurfaceColor: "rgba(0,255,72,0.38)",
  innerGridColor: "rgba(0,255,72,0.78)",
  scanBladeColor: "rgba(255,244,0,0.48)",
  scanBlink: false,
  show: true,
} as const;

/** 环形雷达扫描新增参数。 */
export interface RingRadarAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 雷达中心点。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 内环半径，单位：米。默认 33000。 */
  innerRadius?: number;
  /** 外环半径，单位：米。默认 66000；不传时为内环半径的 2 倍。 */
  outerRadius?: number;
  /** 内环弧形隆起高度，单位：米。默认 9000。 */
  innerDomeHeight?: number;
  /** 外环弧形隆起高度，单位：米。默认 18000。 */
  outerDomeHeight?: number;
  /** 内环弧面颜色。默认 rgba(0,255,72,0.38)。 */
  innerSurfaceColor?: SpecialEffectsColorInput;
  /** 内环弧面透明度，范围 0 到 1。 */
  innerSurfaceAlpha?: number;
  /** 内环网格线颜色。默认 rgba(0,255,72,0.78)。 */
  innerGridColor?: SpecialEffectsColorInput;
  /** 内环网格线透明度，范围 0 到 1。 */
  innerGridAlpha?: number;
  /** 外环弧面颜色。默认 rgba(200,96,31,0.34)。 */
  outerSurfaceColor?: SpecialEffectsColorInput;
  /** 外环弧面透明度，范围 0 到 1。 */
  outerSurfaceAlpha?: number;
  /** 外环网格线颜色。默认 rgba(200,96,31,0.78)。 */
  outerGridColor?: SpecialEffectsColorInput;
  /** 外环网格线透明度，范围 0 到 1。 */
  outerGridAlpha?: number;
  /** 扫描叶片颜色。默认 rgba(255,244,0,0.48)。 */
  scanBladeColor?: SpecialEffectsColorInput;
  /** 扫描叶片透明度，范围 0 到 1。 */
  scanBladeAlpha?: number;
  /** 扫描叶片角宽，单位：度。默认 0 表示使用内置推荐角宽 32 度。 */
  scanBladeAngle?: number;
  /** 扫描旋转速度，单位：度/秒。默认 45。 */
  scanSpeed?: number;
  /** 是否开启扫描叶片闪烁。默认 false。 */
  scanBlink?: boolean;
  /** 水平插值点数，数值越大曲面越圆滑。默认 96。 */
  horizontalSegments?: number;
  /** 垂直插值点数，数值越大网格越密。默认 10。 */
  verticalSegments?: number;
  /** 网格线宽，单位：像素。默认 1。 */
  gridLineWidth?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 环形雷达扫描更新参数。 */
export type RingRadarUpdateOptions = Partial<Omit<RingRadarAddOptions, "id">>;

/** 环形雷达扫描解析参数。 */
export interface RingRadarResolvedOptions {
  id: string;
  position: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
  scale: number;
  innerRadius: number;
  outerRadius: number;
  innerDomeHeight: number;
  outerDomeHeight: number;
  innerSurfaceColor: Cesium.Color;
  innerSurfaceAlpha: number;
  innerGridColor: Cesium.Color;
  innerGridAlpha: number;
  outerSurfaceColor: Cesium.Color;
  outerSurfaceAlpha: number;
  outerGridColor: Cesium.Color;
  outerGridAlpha: number;
  scanBladeColor: Cesium.Color;
  scanBladeAlpha: number;
  scanBladeAngle: number;
  activeScanBladeAngle: number;
  scanSpeed: number;
  scanBlink: boolean;
  horizontalSegments: number;
  verticalSegments: number;
  gridLineWidth: number;
  show: boolean;
}

interface RingRadarRecord {
  viewer: Cesium.Viewer;
  id: string;
  sourceOptions: RingRadarAddOptions & { id: string };
  options: RingRadarResolvedOptions;
  entities: Cesium.Entity[];
  removeTick: () => void;
}

interface RingRadarAnimationState {
  startTime: number;
}

/** 环形雷达扫描 Entity 单体绘制类。 */
export default class RingRadar {
  private readonly records = new Map<string, RingRadarRecord>();

  constructor(private readonly defaultViewer?: Cesium.Viewer) {}

  /** 新增一个环形雷达扫描 Entity，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: RingRadarAddOptions): string | undefined;
  add(options: RingRadarAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | RingRadarAddOptions,
    maybeOptions?: RingRadarAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;

    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("ring-radar");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    const resolvedOptions = resolveRingRadarOptions(sourceOptions);
    const entities = createRingRadarEntities(viewer, id, resolvedOptions);
    const removeTick = this.createRenderInvalidator(viewer, id);

    this.records.set(id, {
      viewer,
      id,
      sourceOptions,
      options: resolvedOptions,
      entities,
      removeTick,
    });
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增环形雷达扫描 Entity，返回成功创建的 id。 */
  addMany(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增环形雷达扫描 Entity，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定环形雷达扫描 Entity。 */
  update(id: string, options: RingRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    record.removeTick();

    const sourceOptions = { ...record.sourceOptions, ...options, id };
    const resolvedOptions = resolveRingRadarOptions(sourceOptions);
    const entities = createRingRadarEntities(record.viewer, id, resolvedOptions);
    const removeTick = this.createRenderInvalidator(record.viewer, id);

    this.records.set(id, {
      ...record,
      sourceOptions,
      options: resolvedOptions,
      entities,
      removeTick,
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定环形雷达扫描显隐。 */
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

  /** 获取指定特效对应的 Entity 集合。 */
  get(id: string): Cesium.Entity[] | undefined {
    return this.records.get(id)?.entities;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定环形雷达扫描。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    record.removeTick();
    this.records.delete(id);
    return true;
  }

  /** 清空全部环形雷达扫描；传入 viewer 时只清空该 Viewer 下的特效。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部环形雷达扫描。 */
  destroy(): void {
    this.clear();
  }

  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | RingRadarAddOptions,
    maybeOptions?: RingRadarAddOptions,
  ): { viewer: Cesium.Viewer; options: RingRadarAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as RingRadarAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  private removeRecordEntities(record: RingRadarRecord): void {
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

/** 合并环形雷达扫描默认参数。 */
export function resolveRingRadarOptions(options: RingRadarAddOptions & { id: string }): RingRadarResolvedOptions {
  const innerRadius = positiveNumber(options.innerRadius, RING_RADAR_DEFAULTS.innerRadius);
  const outerRadiusInput = positiveNumber(options.outerRadius, innerRadius * 2);
  const outerRadius = outerRadiusInput > innerRadius ? outerRadiusInput : innerRadius * 2;
  const outerDomeHeight = positiveNumber(options.outerDomeHeight, RING_RADAR_DEFAULTS.outerDomeHeight);
  const innerDomeHeight = positiveNumber(
    options.innerDomeHeight,
    Math.min(outerDomeHeight * 0.5, innerRadius * 0.9),
  );
  const scanBladeAngle = clamp(
    finiteNumber(options.scanBladeAngle, RING_RADAR_DEFAULTS.scanBladeAngle),
    0,
    120,
  );

  const innerSurfaceColor = colorWithAlpha(
    options.innerSurfaceColor,
    RING_RADAR_DEFAULTS.innerSurfaceColor,
    options.innerSurfaceAlpha,
  );
  const innerGridColor = colorWithAlpha(
    options.innerGridColor,
    RING_RADAR_DEFAULTS.innerGridColor,
    options.innerGridAlpha,
  );
  const outerSurfaceColor = colorWithAlpha(
    options.outerSurfaceColor,
    RING_RADAR_DEFAULTS.outerSurfaceColor,
    options.outerSurfaceAlpha,
  );
  const outerGridColor = colorWithAlpha(
    options.outerGridColor,
    RING_RADAR_DEFAULTS.outerGridColor,
    options.outerGridAlpha,
  );
  const scanBladeColor = colorWithAlpha(
    options.scanBladeColor,
    RING_RADAR_DEFAULTS.scanBladeColor,
    options.scanBladeAlpha,
  );

  return {
    id: options.id,
    position: toCartesian3(options.position),
    heading: finiteNumber(options.heading, 0),
    pitch: finiteNumber(options.pitch, 0),
    roll: finiteNumber(options.roll, 0),
    scale: positiveNumber(options.scale, 1),
    innerRadius,
    outerRadius,
    innerDomeHeight,
    outerDomeHeight,
    innerSurfaceColor,
    innerSurfaceAlpha: innerSurfaceColor.alpha,
    innerGridColor,
    innerGridAlpha: innerGridColor.alpha,
    outerSurfaceColor,
    outerSurfaceAlpha: outerSurfaceColor.alpha,
    outerGridColor,
    outerGridAlpha: outerGridColor.alpha,
    scanBladeColor,
    scanBladeAlpha: scanBladeColor.alpha,
    scanBladeAngle,
    activeScanBladeAngle: scanBladeAngle === 0 ? AUTO_SCAN_BLADE_ANGLE : scanBladeAngle,
    scanSpeed: finiteNumber(options.scanSpeed, RING_RADAR_DEFAULTS.scanSpeed),
    scanBlink: options.scanBlink ?? RING_RADAR_DEFAULTS.scanBlink,
    horizontalSegments: integerAtLeast(options.horizontalSegments, RING_RADAR_DEFAULTS.horizontalSegments, 16),
    verticalSegments: integerAtLeast(options.verticalSegments, RING_RADAR_DEFAULTS.verticalSegments, 2),
    gridLineWidth: positiveNumber(options.gridLineWidth, RING_RADAR_DEFAULTS.gridLineWidth),
    show: options.show ?? RING_RADAR_DEFAULTS.show,
  };
}

function createRingRadarEntities(
  viewer: Cesium.Viewer,
  id: string,
  options: RingRadarResolvedOptions,
): Cesium.Entity[] {
  const entities: Cesium.Entity[] = [];
  const animation: RingRadarAnimationState = { startTime: Date.now() };
  const matrix = createLocalFrame(options);

  entities.push(
    ...createDomeSurface(
      viewer,
      `${id}-outer`,
      "FastX Ring Radar Outer Surface",
      options.outerRadius,
      options.outerDomeHeight,
      options.outerSurfaceColor,
      options,
      matrix,
    ),
  );
  entities.push(
    ...createDomeGrid(
      viewer,
      `${id}-outer`,
      "FastX Ring Radar Outer Grid",
      options.outerRadius,
      options.outerDomeHeight,
      options.outerGridColor,
      options,
      matrix,
    ),
  );
  entities.push(
    ...createDomeSurface(
      viewer,
      `${id}-inner`,
      "FastX Ring Radar Inner Surface",
      options.innerRadius,
      options.innerDomeHeight,
      options.innerSurfaceColor,
      options,
      matrix,
    ),
  );
  entities.push(
    ...createDomeGrid(
      viewer,
      `${id}-inner`,
      "FastX Ring Radar Inner Grid",
      options.innerRadius,
      options.innerDomeHeight,
      options.innerGridColor,
      options,
      matrix,
    ),
  );
  entities.push(
    createScanBlade(
      viewer,
      `${id}-outer-scan-blade`,
      "FastX Ring Radar Outer Scan Blade",
      options.outerRadius,
      options.outerDomeHeight,
      0,
      options,
      animation,
    ),
  );

  for (let index = 0; index < INNER_SCAN_BLADE_COUNT; index += 1) {
    entities.push(
      createScanBlade(
        viewer,
        `${id}-inner-scan-blade-${index}`,
        "FastX Ring Radar Inner Scan Blade",
        options.innerRadius,
        options.innerDomeHeight,
        (360 / INNER_SCAN_BLADE_COUNT) * index,
        options,
        animation,
      ),
    );
  }

  return entities;
}

function createDomeSurface(
  viewer: Cesium.Viewer,
  idPrefix: string,
  name: string,
  radius: number,
  domeHeight: number,
  color: Cesium.Color,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Entity[] {
  const entities: Cesium.Entity[] = [];
  const material = new Cesium.ColorMaterialProperty(Cesium.Color.clone(color));

  for (let row = 0; row < options.verticalSegments; row += 1) {
    for (let col = 0; col < options.horizontalSegments; col += 1) {
      entities.push(
        viewer.entities.add({
          id: `${idPrefix}-surface-${row}-${col}`,
          name,
          show: options.show,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(
              domePatchPositions(radius, domeHeight, options, matrix, row, col),
            ),
            material,
            perPositionHeight: true,
          },
        }),
      );
    }
  }

  return entities;
}

function createDomeGrid(
  viewer: Cesium.Viewer,
  idPrefix: string,
  name: string,
  radius: number,
  domeHeight: number,
  color: Cesium.Color,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Entity[] {
  const entities: Cesium.Entity[] = [];
  const material = new Cesium.ColorMaterialProperty(Cesium.Color.clone(color));

  for (let row = 1; row <= options.verticalSegments; row += 1) {
    const currentRadius = (radius * row) / options.verticalSegments;
    entities.push(
      addPolyline(
        viewer,
        `${idPrefix}-grid-ring-${row}`,
        domeCirclePositions(radius, domeHeight, currentRadius, options, matrix),
        material,
        options,
        name,
      ),
    );
  }

  const radialStep = Math.max(1, Math.floor(options.horizontalSegments / 36));
  for (let col = 0; col < options.horizontalSegments; col += radialStep) {
    const angle = (360 * col) / options.horizontalSegments;
    const positions: Cesium.Cartesian3[] = [];
    for (let row = 0; row <= options.verticalSegments; row += 1) {
      const currentRadius = (radius * row) / options.verticalSegments;
      positions.push(domeWorldPoint(currentRadius, angle, radius, domeHeight, matrix));
    }
    entities.push(
      addPolyline(viewer, `${idPrefix}-grid-radial-${col}`, positions, material, options, name),
    );
  }

  return entities;
}

function createScanBlade(
  viewer: Cesium.Viewer,
  id: string,
  name: string,
  radius: number,
  domeHeight: number,
  angleOffset: number,
  options: RingRadarResolvedOptions,
  animation: RingRadarAnimationState,
): Cesium.Entity {
  const material = animatedColorMaterial(options.scanBladeColor, options.scanBlink, animation);

  return viewer.entities.add({
    id,
    name,
    show: options.show,
    polygon: {
      hierarchy: new Cesium.CallbackProperty(() => {
        const matrix = createLocalFrame(options);
        const angle = scanAngle(options, animation) + angleOffset;
        return new Cesium.PolygonHierarchy(
          scanBladePositions(radius, domeHeight, angle, options, matrix),
        );
      }, false),
      material,
      perPositionHeight: true,
    },
  });
}

function addPolyline(
  viewer: Cesium.Viewer,
  id: string,
  positions: Cesium.Cartesian3[],
  material: Cesium.MaterialProperty,
  options: RingRadarResolvedOptions,
  name: string,
): Cesium.Entity {
  return viewer.entities.add({
    id,
    name,
    show: options.show,
    polyline: {
      positions,
      width: options.gridLineWidth,
      material,
      arcType: Cesium.ArcType.NONE,
    },
  });
}

function domePatchPositions(
  radius: number,
  domeHeight: number,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
  row: number,
  col: number,
): Cesium.Cartesian3[] {
  const innerRowRadius = (radius * row) / options.verticalSegments;
  const outerRowRadius = (radius * (row + 1)) / options.verticalSegments;
  const startAngle = (360 * col) / options.horizontalSegments;
  const endAngle = (360 * (col + 1)) / options.horizontalSegments;

  if (row === 0) {
    return [
      domeWorldPoint(innerRowRadius, startAngle, radius, domeHeight, matrix),
      domeWorldPoint(outerRowRadius, endAngle, radius, domeHeight, matrix),
      domeWorldPoint(outerRowRadius, startAngle, radius, domeHeight, matrix),
    ];
  }

  return [
    domeWorldPoint(innerRowRadius, startAngle, radius, domeHeight, matrix),
    domeWorldPoint(innerRowRadius, endAngle, radius, domeHeight, matrix),
    domeWorldPoint(outerRowRadius, endAngle, radius, domeHeight, matrix),
    domeWorldPoint(outerRowRadius, startAngle, radius, domeHeight, matrix),
  ];
}

function domeCirclePositions(
  radius: number,
  domeHeight: number,
  currentRadius: number,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = [];
  for (let i = 0; i <= options.horizontalSegments; i += 1) {
    positions.push(
      domeWorldPoint(currentRadius, (360 * i) / options.horizontalSegments, radius, domeHeight, matrix),
    );
  }
  return positions;
}

function scanBladePositions(
  radius: number,
  domeHeight: number,
  angle: number,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const radialSegments = Math.max(8, Math.ceil(options.horizontalSegments / 6));
  const halfAngle = options.activeScanBladeAngle / 2;
  const positions: Cesium.Cartesian3[] = [];

  for (let i = 0; i <= radialSegments; i += 1) {
    const r = (radius * i) / radialSegments;
    positions.push(circlePoint(r, angle - halfAngle, 0, matrix));
  }

  for (let i = radialSegments; i >= 0; i -= 1) {
    const r = (radius * i) / radialSegments;
    positions.push(domeWorldPoint(r, angle + halfAngle, radius, domeHeight, matrix));
  }

  return positions;
}

function domeWorldPoint(
  radius: number,
  angle: number,
  maxRadius: number,
  domeHeight: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3 {
  return circlePoint(radius, angle, domeHeightAtRadius(radius, maxRadius, domeHeight), matrix);
}

function domeHeightAtRadius(radius: number, maxRadius: number, domeHeight: number): number {
  const t = clamp(radius / Math.max(1, maxRadius), 0, 1);
  const crown = Math.sin(Math.PI * t) * domeHeight * 0.74;
  const shoulder = Math.sin(Math.PI * Math.min(t, 0.5)) * domeHeight * 0.24;
  return Math.max(0, crown + shoulder);
}

function circlePoint(
  radius: number,
  angle: number,
  z: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3 {
  const rad = Cesium.Math.toRadians(angle);
  const point: LocalPoint = [Math.cos(rad) * radius, Math.sin(rad) * radius, z];
  return localToWorld(point, matrix);
}

function animatedColorMaterial(
  color: Cesium.Color,
  blink: boolean,
  animation: RingRadarAnimationState,
): Cesium.ColorMaterialProperty {
  return new Cesium.ColorMaterialProperty(
    new Cesium.CallbackProperty((_time, result) => {
      const out = Cesium.Color.clone(color, result);
      if (blink) {
        const seconds = secondsFrom(animation);
        out.alpha *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(seconds * Math.PI * 3));
      }
      return out;
    }, false),
  );
}

function scanAngle(options: RingRadarResolvedOptions, animation: RingRadarAnimationState): number {
  return normalizeAngle(secondsFrom(animation) * options.scanSpeed);
}

function secondsFrom(animation: RingRadarAnimationState): number {
  return Math.max(0, (Date.now() - animation.startTime) / 1000);
}

function colorWithAlpha(
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

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
