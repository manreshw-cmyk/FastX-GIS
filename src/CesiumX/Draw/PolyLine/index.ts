/**
 * Entity 折线 / 折线体 / 墙体。
 * - 箭头线：仅 **整条折线 + 末端箭头**，使用 `PolylineArrowMaterialProperty`（Cesium 原生），无附加 Entity、无 Billboard。
 * - 贴地：默认 **不** 贴地。`polylineClampToGround: 1` 或线型 `clamp_ground`（贴地实线）时按 `clampToGround: true` 解析；`0` 或不传为不贴地。仍受顶点数/弦长硬上限保护，超限则降级并写入 `targetData`。
 */

import * as Cesium from "cesium";
import type { Color, Entity, MaterialProperty, Property, Viewer } from "cesium";
import { createRandomXgxId, type LngLatHeight } from "../../Coordinates";

// ==================== 常量配置 ====================
/** 贴地折线细分角度下限（越大越稀、越省内存） */
const CLAMP_POLYLINE_MIN_GRANULARITY_RAD = Cesium.Math.toRadians(16);
const POLYLINE_GRANULARITY_FLOOR_RAD = Cesium.Math.toRadians(0.05);

const AUTO_CLAMP_MAX_CHORD_LENGTH_M = 1_200_000;

const HARD_CLAMP_MAX_VERTICES = 400;
const HARD_CLAMP_MAX_CHORD_LENGTH_M = 6_000_000;

// 流动线默认值
const DEFAULT_FLOW_CYCLE = 4;
const DEFAULT_FLOW_TRAIL = 0.35;
const DEFAULT_FLOW_REPEAT_BASE = 6;

// 纹理尺寸
const TEXTURE_WIDTH = 256;
const GRADIENT_TEXTURE_WIDTH = 256;

// ==================== 类型定义 ====================
export type PolylineLngLatTuple = readonly [
  lng: number,
  lat: number,
  height?: number,
];
export type PolylineGeometryMode = "polyline" | "polylineVolume" | "wall";

export type PolylineLineKind =
  | "solid"
  | "clamp_ground"
  | "dashed"
  | "outline"
  | "glowing"
  | "flowing"
  | "gradient"
  | "arrow"
  | "volume_block"
  | "volume_tube"
  | "wall";

export interface PolylineStyleOptions {
  width?: number;
  granularity?: number;
  depthFailMaterial?: MaterialProperty | Color;
  arcType?: Cesium.ArcType;
  clampToGround?: boolean;
  shadows?: Cesium.ShadowMode;
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  classificationType?: Cesium.ClassificationType;
  zIndex?: number;
}

export interface DashedPolylineParams {
  gapColor?: string;
  gapAlpha?: number;
  dashLength?: number;
  dashPattern?: number;
}

export interface OutlinePolylineParams {
  outlineColor?: string;
  outlineAlpha?: number;
  outlineWidth?: number;
}

export interface GlowingPolylineParams {
  glowPower?: number;
  taperPower?: number;
}

export interface FlowingPolylineParams {
  imageUrl?: string;
  flowColor?: string;
  flowColorAlpha?: number;
  flowCycleSeconds?: number;
  trailLength?: number;
  repeat?: boolean;
  repeatAlongLine?: number;
}

export interface GradientPolylineParams {
  polylineMaterialColorTexture?: string;
  imageUrl?: string;
}

/** 历史兼容：底层仅支持末端箭头，其它取值忽略 */
export type ArrowPlacementType =
  | "single_end"
  | "single_middle"
  | "segment_mid"
  | "vertex_skip_start";

export interface ArrowPolylineParams {
  /** 已忽略，仅末端箭头 */
  type?: ArrowPlacementType;
  placement?: ArrowPlacementType;
  /** 作为折线宽度使用（含箭头比例） */
  arrowSize?: number;
  arrowColor?: string;
  arrowAlpha?: number;
}

export interface VolumeBlockParams {
  blockWidth?: number;
  baseHeight?: number;
  extrudeHeight?: number;
}

export interface VolumeTubeParams {
  radius?: number;
  polylineVolumeSmooth?: number;
}

export interface WallParams {
  baseHeight?: number;
  extrudeHeight?: number;
}

/** 折线是否贴地：0 否，1 是（与 `clamp_ground` 线型等价于请求贴地） */
export type PolylineClampToGroundFlag = 0 | 1;

export interface AddPolylineOptions {
  id?: string;
  positions: readonly PolylineLngLatTuple[] | readonly Cesium.Cartesian3[];
  lineKind?: PolylineLineKind;
  color?: string;
  alpha?: number;
  width?: number;
  /** 0=不贴地，1=贴地；默认 0。与 `clampToGround` 二选一优先级：本字段为 0/1 时优先于未传的 `clampToGround`（见 `effectiveClampToGroundRequest`） */
  polylineClampToGround?: PolylineClampToGroundFlag;
  clampToGround?: boolean;
  arcType?: keyof typeof Cesium.ArcType | Cesium.ArcType;
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType;
  style?: PolylineStyleOptions;
  dashed?: DashedPolylineParams;
  outline?: OutlinePolylineParams;
  glowing?: GlowingPolylineParams;
  flowing?: FlowingPolylineParams;
  gradient?: GradientPolylineParams;
  volumeBlock?: VolumeBlockParams;
  volumeTube?: VolumeTubeParams;
  wall?: WallParams;
  arrow?: ArrowPolylineParams;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
}

export interface UpdatePolylineProperties {
  positions?: readonly PolylineLngLatTuple[] | readonly Cesium.Cartesian3[];
  lineKind?: PolylineLineKind;
  color?: string | Color;
  alpha?: number;
  width?: number;
  polylineClampToGround?: PolylineClampToGroundFlag;
  clampToGround?: boolean;
  arcType?: keyof typeof Cesium.ArcType | Cesium.ArcType;
  cornerType?: keyof typeof Cesium.CornerType | Cesium.CornerType;
  style?: PolylineStyleOptions;
  dashed?: DashedPolylineParams;
  outline?: OutlinePolylineParams;
  glowing?: GlowingPolylineParams;
  flowing?: FlowingPolylineParams;
  gradient?: GradientPolylineParams;
  volumeBlock?: VolumeBlockParams;
  volumeTube?: VolumeTubeParams;
  wall?: WallParams;
  arrow?: ArrowPolylineParams;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
}

export interface PolylineSnapshot {
  id: string;
  lineKind: PolylineLineKind;
  geometryMode: PolylineGeometryMode;
  positions: LngLatHeight[];
  width: number;
  /** 请求贴地标记：0 否，1 是（线型 `clamp_ground` 或 API `polylineClampToGround:1`） */
  polylineClampToGround: PolylineClampToGroundFlag;
  clampToGround: boolean;
  arcType: string;
  cornerType?: string;
  colorCss?: string;
  show: boolean;
  dashed?: DashedPolylineParams;
  outline?: OutlinePolylineParams;
  glowing?: GlowingPolylineParams;
  flowing?: FlowingPolylineParams;
  gradient?: GradientPolylineParams;
  volumeBlock?: VolumeBlockParams;
  volumeTube?: VolumeTubeParams;
  wall?: WallParams;
  arrow?: ArrowPolylineParams;
  targetData: Record<string, unknown>;
  description?: string;
}

interface PolylineRecord {
  viewer: Viewer;
  entity: Entity;
  extraEntities: Entity[];
  targetData: Record<string, unknown>;
  lineKind: PolylineLineKind;
  geometryMode: PolylineGeometryMode;
  flowEpoch: Cesium.JulianDate;
}

// ==================== 工具函数 ====================

function colorFromString(css: string, alpha = 1): Color {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha);
}

function toColor(
  c: string | Color | undefined,
  alpha?: number,
): Color | undefined {
  if (!c) return undefined;
  if (c instanceof Cesium.Color) {
    return alpha !== undefined ? c.withAlpha(alpha) : c;
  }
  try {
    return colorFromString(c, alpha ?? 1);
  } catch {
    console.warn(`[PolyLine] Invalid color: ${c}`);
    return undefined;
  }
}

function parseArcType(
  s: keyof typeof Cesium.ArcType | Cesium.ArcType | undefined,
): Cesium.ArcType {
  if (s === undefined) return Cesium.ArcType.GEODESIC;
  if (typeof s === "number") return s;
  return Cesium.ArcType[s] ?? Cesium.ArcType.GEODESIC;
}

function parseCornerType(
  s: keyof typeof Cesium.CornerType | Cesium.CornerType | undefined,
): Cesium.CornerType {
  if (s === undefined) return Cesium.CornerType.ROUNDED;
  if (typeof s === "number") return s;
  return Cesium.CornerType[s] ?? Cesium.CornerType.ROUNDED;
}

function sampleProperty<T>(
  p: Property | undefined,
  time = Cesium.JulianDate.now(),
): T | undefined {
  if (!p || typeof (p as Cesium.Property).getValue !== "function")
    return undefined;
  return (p as Cesium.Property).getValue(time) as T | undefined;
}

function colorToCss(c: Color | undefined): string | undefined {
  if (!c) return undefined;
  if (
    typeof (c as { toCssColorString?: () => string }).toCssColorString ===
    "function"
  ) {
    return (c as Color & { toCssColorString: () => string }).toCssColorString();
  }
  return undefined;
}

function isCartesian3Array(a: unknown): a is Cesium.Cartesian3[] {
  return Array.isArray(a) && a.length > 0 && a[0] instanceof Cesium.Cartesian3;
}

export function resolvePolylineCartesians(
  positions: readonly PolylineLngLatTuple[] | readonly Cesium.Cartesian3[],
): Cesium.Cartesian3[] | undefined {
  if (!positions || positions.length < 2) return undefined;
  if (isCartesian3Array(positions as unknown[])) {
    return (positions as Cesium.Cartesian3[]).map((p) =>
      Cesium.Cartesian3.clone(p),
    );
  }
  const out: Cesium.Cartesian3[] = [];
  for (const t of positions as readonly PolylineLngLatTuple[]) {
    const h = t[2] ?? 0;
    out.push(Cesium.Cartesian3.fromDegrees(t[0], t[1], h));
  }
  return out;
}

function cartesiansToLngLatHeightArray(
  positions: Cesium.Cartesian3[],
): LngLatHeight[] {
  return positions.map((p) => {
    const c = Cesium.Cartographic.fromCartesian(p);
    return {
      longitude: Cesium.Math.toDegrees(c.longitude),
      latitude: Cesium.Math.toDegrees(c.latitude),
      height: c.height,
    };
  });
}

function geometryModeForKind(kind: PolylineLineKind): PolylineGeometryMode {
  if (kind === "wall") return "wall";
  if (kind === "volume_block" || kind === "volume_tube")
    return "polylineVolume";
  return "polyline";
}

function clearAllLineGraphics(entity: Entity): void {
  entity.polyline = undefined;
  entity.polylineVolume = undefined;
  entity.wall = undefined;
}

function withUniformHeights(
  cartesians: Cesium.Cartesian3[],
  heightM: number,
): Cesium.Cartesian3[] {
  return cartesians.map((p) => {
    const c = Cesium.Cartographic.fromCartesian(p);
    return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightM);
  });
}

function positionsOnEllipsoidSurface(
  cartesians: Cesium.Cartesian3[],
): Cesium.Cartesian3[] {
  return withUniformHeights(cartesians, 0);
}

function disposeExtraEntities(viewer: Viewer, extras: Entity[]): void {
  if (!viewer || viewer.isDestroyed()) {
    extras.length = 0;
    return;
  }
  for (const e of extras) {
    if (viewer.entities.contains(e)) viewer.entities.remove(e);
  }
  extras.length = 0;
}

function polylineChordLengthMeters(
  points: readonly Cesium.Cartesian3[],
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Cesium.Cartesian3.distance(points[i - 1]!, points[i]!);
    if (total > AUTO_CLAMP_MAX_CHORD_LENGTH_M) return total;
  }
  return total;
}

function lngLatSnapshotToCartesians(
  snap: readonly LngLatHeight[],
): Cesium.Cartesian3[] {
  return snap.map((p) =>
    Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.height ?? 0),
  );
}

// ==================== 纹理生成 ====================

function parseColorTextureStops(
  spec: string,
): { t: number; css: string }[] | undefined {
  const parts = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 4 || parts.length % 2 !== 0) return undefined;
  const out: { t: number; css: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const t = Number(parts[i]);
    const css = parts[i + 1] ?? "";
    if (!Number.isFinite(t) || !css.startsWith("#")) return undefined;
    out.push({ t, css });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function createGradientCanvasDataUrl(
  stops: { t: number; css: string }[],
  widthPx = GRADIENT_TEXTURE_WIDTH,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const grd = ctx.createLinearGradient(0, 0, widthPx, 0);
  for (const s of stops) {
    grd.addColorStop(Math.min(1, Math.max(0, s.t)), s.css);
  }
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, widthPx, 1);
  return canvas.toDataURL("image/png");
}

function createFlowStripeDataUrl(trail: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const img = ctx.createImageData(TEXTURE_WIDTH, 1);
  const t = Math.min(0.95, Math.max(0.05, trail));
  const half = (TEXTURE_WIDTH * t) / 2;
  const cx = TEXTURE_WIDTH / 2;

  for (let x = 0; x < TEXTURE_WIDTH; x++) {
    const d = Math.abs(x - cx);
    let a = 1 - d / half;
    if (a < 0) a = 0;
    a = a * a;
    const i = x * 4;
    img.data[i] = 255;
    img.data[i + 1] = 255;
    img.data[i + 2] = 255;
    img.data[i + 3] = Math.floor(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

// ==================== 材质构建 ====================

function buildPolylineMaterial(
  kind: PolylineLineKind,
  color: Color,
  dashed: DashedPolylineParams | undefined,
  outline: OutlinePolylineParams | undefined,
  glowing: GlowingPolylineParams | undefined,
  flowing: FlowingPolylineParams | undefined,
  gradient: GradientPolylineParams | undefined,
  flowEpoch: Cesium.JulianDate,
): MaterialProperty {
  switch (kind) {
    case "dashed": {
      const m = new Cesium.PolylineDashMaterialProperty();
      m.color = new Cesium.ConstantProperty(color);
      const gap =
        toColor(dashed?.gapColor, dashed?.gapAlpha ?? 1) ??
        Cesium.Color.TRANSPARENT;
      m.gapColor = new Cesium.ConstantProperty(gap);
      m.dashLength = new Cesium.ConstantProperty(dashed?.dashLength ?? 16);
      m.dashPattern = new Cesium.ConstantProperty(dashed?.dashPattern ?? 255);
      return m;
    }
    case "outline": {
      const oc =
        toColor(outline?.outlineColor, outline?.outlineAlpha ?? 1) ??
        Cesium.Color.BLACK;
      return new Cesium.PolylineOutlineMaterialProperty({
        color,
        outlineColor: oc,
        outlineWidth: outline?.outlineWidth ?? 2,
      });
    }
    case "glowing":
      return new Cesium.PolylineGlowMaterialProperty({
        color,
        glowPower: glowing?.glowPower ?? 0.25,
        taperPower: glowing?.taperPower ?? 1,
      });
    case "flowing": {
      const img =
        flowing?.imageUrl?.trim() ||
        createFlowStripeDataUrl(flowing?.trailLength ?? DEFAULT_FLOW_TRAIL);
      const tint =
        toColor(
          flowing?.flowColor ?? "#ffffff",
          flowing?.flowColorAlpha ?? 1,
        ) ?? Cesium.Color.WHITE;
      const cycle = Math.max(
        0.25,
        flowing?.flowCycleSeconds ?? DEFAULT_FLOW_CYCLE,
      );
      const repeatBase = Math.max(
        1.5,
        flowing?.repeatAlongLine ?? DEFAULT_FLOW_REPEAT_BASE,
      );
      const repeatFlow = flowing?.repeat !== false;

      const imp = new Cesium.ImageMaterialProperty({
        image: img,
        transparent: true,
        color: new Cesium.ConstantProperty(tint),
      });

      imp.repeat = new Cesium.CallbackProperty((time) => {
        const t = time ?? Cesium.JulianDate.now();
        let u = Cesium.JulianDate.secondsDifference(t, flowEpoch) / cycle;
        if (repeatFlow) u -= Math.floor(u);
        else u = Math.min(1, Math.max(0, u));
        return new Cesium.Cartesian2(repeatBase + u, 1);
      }, false);
      return imp;
    }
    case "gradient": {
      const url =
        gradient?.imageUrl?.trim() ||
        (() => {
          const stops = gradient?.polylineMaterialColorTexture?.trim()
            ? parseColorTextureStops(gradient.polylineMaterialColorTexture)
            : undefined;
          if (!stops || stops.length < 2) {
            return createGradientCanvasDataUrl([
              { t: 0, css: "#00d4ff" },
              { t: 1, css: "#ff00ff" },
            ]);
          }
          return createGradientCanvasDataUrl(stops);
        })();
      return new Cesium.ImageMaterialProperty({
        image: url,
        transparent: true,
        color: new Cesium.ConstantProperty(color),
      });
    }
    case "arrow":
      return new Cesium.PolylineArrowMaterialProperty(color);
    case "solid":
    case "clamp_ground":
    default:
      return new Cesium.ColorMaterialProperty(color);
  }
}

/** 折线贴地请求：`clamp_ground` 线型、`polylineClampToGround:1` 或 `clampToGround`/style */
function effectiveClampToGroundRequest(
  lineKind: PolylineLineKind,
  options: AddPolylineOptions,
): boolean | undefined {
  if (lineKind === "clamp_ground") return true;
  const pc = options.polylineClampToGround;
  if (pc === 1) return true;
  if (pc === 0) return false;
  return options.clampToGround;
}

// ==================== 贴地安全判断 ====================

function isSafeToClamp(cartesians: readonly Cesium.Cartesian3[]): boolean {
  if (cartesians.length > HARD_CLAMP_MAX_VERTICES) return false;
  if (polylineChordLengthMeters(cartesians) > HARD_CLAMP_MAX_CHORD_LENGTH_M)
    return false;
  return true;
}

function resolveClampToGround(
  cartesians: readonly Cesium.Cartesian3[],
  style: PolylineStyleOptions | undefined,
  apiClamp: boolean | undefined,
  _viewer: Viewer,
  targetData: Record<string, unknown>,
): boolean {
  const safeToClamp = isSafeToClamp(cartesians);

  // 显式 true 需要检查安全
  if (apiClamp === true) {
    if (!safeToClamp) {
      targetData.clampToGroundDowngraded = true;
      targetData.clampDowngradeReason = "exceeds_hard_limits";
      return false;
    }
    return true;
  }

  if (apiClamp === false) return false;

  if (style?.clampToGround === true) {
    if (!safeToClamp) {
      targetData.clampToGroundDowngraded = true;
      targetData.clampDowngradeReason = "style_exceeds_hard_limits";
      return false;
    }
    return true;
  }

  if (style?.clampToGround === false) return false;

  // 未显式要求贴地：不自动推断（自动贴地易在量化地形下触发细分 OOM）
  return false;
}

/** 开启 requestRenderMode 时，贴地折线更新后补一帧渲染。 */
function requestRenderIfPolylineClampToGround(
  viewer: Viewer,
  entity: Entity,
): void {
  const pl = entity.polyline;
  if (!pl) return;
  if (sampleProperty<boolean>(pl.clampToGround) === true) {
    viewer.scene.requestRender();
  }
}

// ==================== 图形合并辅助 ====================

function mergePolylineGraphics(
  pl: Cesium.PolylineGraphics,
  style: PolylineStyleOptions | undefined,
  opts:
    | {
        width?: number;
        clampToGround?: boolean;
        arcType?: keyof typeof Cesium.ArcType | Cesium.ArcType;
      }
    | undefined,
  isCreate: boolean,
): void {
  const defaults = { width: 3, arcType: Cesium.ArcType.GEODESIC };
  const w =
    style?.width ?? opts?.width ?? (isCreate ? defaults.width : undefined);
  if (w !== undefined) pl.width = new Cesium.ConstantProperty(w);

  const clamp =
    opts?.clampToGround !== undefined
      ? opts.clampToGround
      : style?.clampToGround;

  const rawGranularity =
    style?.granularity ??
    (isCreate ? Cesium.Math.RADIANS_PER_DEGREE : undefined);
  const baseGranularity =
    rawGranularity !== undefined && rawGranularity > 0
      ? Math.max(rawGranularity, POLYLINE_GRANULARITY_FLOOR_RAD)
      : undefined;

  if (baseGranularity !== undefined) {
    const g =
      clamp === true
        ? Math.max(baseGranularity, CLAMP_POLYLINE_MIN_GRANULARITY_RAD)
        : baseGranularity;
    pl.granularity = new Cesium.ConstantProperty(g);
  } else if (isCreate) {
    const g =
      clamp === true
        ? Math.max(
            Cesium.Math.RADIANS_PER_DEGREE,
            CLAMP_POLYLINE_MIN_GRANULARITY_RAD,
          )
        : Math.max(
            Cesium.Math.RADIANS_PER_DEGREE,
            POLYLINE_GRANULARITY_FLOOR_RAD,
          );
    pl.granularity = new Cesium.ConstantProperty(g);
  }

  let arc =
    style?.arcType ??
    (opts?.arcType !== undefined
      ? parseArcType(opts.arcType)
      : isCreate
        ? defaults.arcType
        : undefined);
  if (clamp === true && arc === Cesium.ArcType.NONE) {
    arc = Cesium.ArcType.GEODESIC;
  }
  if (arc !== undefined) pl.arcType = new Cesium.ConstantProperty(arc);

  if (clamp !== undefined)
    pl.clampToGround = new Cesium.ConstantProperty(clamp);
  else if (isCreate) pl.clampToGround = new Cesium.ConstantProperty(false);

  if (style?.shadows !== undefined)
    pl.shadows = new Cesium.ConstantProperty(style.shadows);
  if (style?.distanceDisplayCondition !== undefined) {
    pl.distanceDisplayCondition = new Cesium.ConstantProperty(
      style.distanceDisplayCondition,
    );
  }
  if (style?.classificationType !== undefined) {
    pl.classificationType = new Cesium.ConstantProperty(
      style.classificationType,
    );
  }
  if (style?.zIndex !== undefined)
    pl.zIndex = new Cesium.ConstantProperty(style.zIndex);
  if (style?.depthFailMaterial !== undefined) {
    const df = style.depthFailMaterial;
    pl.depthFailMaterial =
      df instanceof Cesium.Color
        ? new Cesium.ColorMaterialProperty(df)
        : (df as MaterialProperty);
  }
}

function volumeGranularityFromSmooth(smooth?: number): number {
  const s = Math.max(1, smooth ?? 16);
  return Cesium.Math.toRadians(1 / s);
}

function computeCircleShape(radius: number): Cesium.Cartesian2[] {
  const r = Math.max(0.1, radius);
  const shape: Cesium.Cartesian2[] = [];
  for (let i = 0; i < 360; i += 18) {
    const rad = Cesium.Math.toRadians(i);
    shape.push(new Cesium.Cartesian2(r * Math.cos(rad), r * Math.sin(rad)));
  }
  return shape;
}

function computeBlockShape(
  halfWidth: number,
  height: number,
): Cesium.Cartesian2[] {
  const w = Math.max(0.1, halfWidth);
  const h = Math.max(0.1, height);
  return [
    new Cesium.Cartesian2(-w, 0),
    new Cesium.Cartesian2(w, 0),
    new Cesium.Cartesian2(w, h),
    new Cesium.Cartesian2(-w, h),
  ];
}

// ==================== 核心渲染逻辑 ====================

function mountGraphics(
  viewer: Viewer,
  mainEntity: Entity,
  extraEntities: Entity[],
  cartesians: Cesium.Cartesian3[],
  options: AddPolylineOptions,
  lineKind: PolylineLineKind,
  material: MaterialProperty,
  targetData: Record<string, unknown>,
): void {
  disposeExtraEntities(viewer, extraEntities);
  clearAllLineGraphics(mainEntity);
  const mode = geometryModeForKind(lineKind);

  if (mode === "wall") {
    const w = options.wall ?? {};
    const base = w.baseHeight ?? 0;
    const ext = w.extrudeHeight ?? 80;
    const wall = new Cesium.WallGraphics();
    wall.positions = new Cesium.ConstantProperty(
      positionsOnEllipsoidSurface(cartesians),
    );
    wall.minimumHeights = new Cesium.ConstantProperty(
      cartesians.map(() => base),
    );
    wall.maximumHeights = new Cesium.ConstantProperty(
      cartesians.map(() => base + ext),
    );
    wall.material = material;
    wall.outline = new Cesium.ConstantProperty(false);
    mainEntity.wall = wall;
    return;
  }

  if (mode === "polylineVolume") {
    const pvol = new Cesium.PolylineVolumeGraphics();
    if (lineKind === "volume_block") {
      const vb = options.volumeBlock ?? {};
      const bw = vb.blockWidth ?? 20;
      const bh = vb.baseHeight ?? 0;
      const eh = vb.extrudeHeight ?? 30;
      pvol.positions = new Cesium.ConstantProperty(
        withUniformHeights(cartesians, bh),
      );
      pvol.shape = new Cesium.ConstantProperty(computeBlockShape(bw / 2, eh));
    } else {
      const vt = options.volumeTube ?? {};
      const r = vt.radius ?? (options.width ?? 50) / 2;
      const smooth = vt.polylineVolumeSmooth ?? 20;
      pvol.positions = new Cesium.ConstantProperty(cartesians);
      pvol.shape = new Cesium.ConstantProperty(computeCircleShape(r));
      pvol.granularity = new Cesium.ConstantProperty(
        volumeGranularityFromSmooth(smooth),
      );
    }
    pvol.cornerType = new Cesium.ConstantProperty(
      parseCornerType(options.cornerType),
    );
    pvol.material = material;
    pvol.outline = new Cesium.ConstantProperty(false);
    mainEntity.polylineVolume = pvol;
    return;
  }

  const clampReq = effectiveClampToGroundRequest(lineKind, options);
  const clamp = resolveClampToGround(
    cartesians,
    options.style,
    clampReq,
    viewer,
    targetData,
  );
  const mergeOpts = {
    width: options.width,
    clampToGround: clamp,
    arcType: options.arcType,
  };
  const alpha = options.alpha ?? 1;
  const baseColor =
    toColor(options.color ?? "#00d4ff", alpha) ?? Cesium.Color.CYAN;

  if (lineKind === "arrow") {
    const arrowHead =
      toColor(options.arrow?.arrowColor, options.arrow?.arrowAlpha ?? alpha) ??
      baseColor;
    const mainW = options.width ?? 3;
    const w =
      options.arrow?.arrowSize !== undefined &&
      Number.isFinite(options.arrow.arrowSize)
        ? Math.max(0.5, Number(options.arrow.arrowSize))
        : Math.max(mainW, 4);
    const pl = new Cesium.PolylineGraphics();
    pl.positions = new Cesium.ConstantProperty(cartesians);
    pl.material = new Cesium.PolylineArrowMaterialProperty(arrowHead);
    mergePolylineGraphics(pl, options.style, { ...mergeOpts, width: w }, true);
    mainEntity.polyline = pl;
    return;
  }

  // 普通线型
  const pl = new Cesium.PolylineGraphics();
  pl.positions = new Cesium.ConstantProperty(cartesians);
  pl.material = material;
  mergePolylineGraphics(pl, options.style, mergeOpts, true);
  mainEntity.polyline = pl;
}

function rebuildMaterialAndMaybeGeometry(
  rec: PolylineRecord,
  cartesians: Cesium.Cartesian3[],
  td: Record<string, unknown>,
  lineKind: PolylineLineKind,
  flowEpoch: Cesium.JulianDate,
): void {
  const alpha = typeof td.alpha === "number" ? td.alpha : 1;
  const colorStr = typeof td.color === "string" ? td.color : "#00d4ff";
  const baseColor = toColor(colorStr, alpha) ?? Cesium.Color.CYAN;
  const material = buildPolylineMaterial(
    lineKind,
    baseColor,
    td.dashed as DashedPolylineParams,
    td.outline as OutlinePolylineParams,
    td.glowing as GlowingPolylineParams,
    td.flowing as FlowingPolylineParams,
    td.gradient as GradientPolylineParams,
    flowEpoch,
  );

  const opts: AddPolylineOptions = {
    positions: cartesians,
    lineKind,
    color: colorStr,
    alpha,
    width: typeof td.lineWidth === "number" ? td.lineWidth : undefined,
    clampToGround:
      typeof td.apiClampToGround === "boolean"
        ? td.apiClampToGround
        : undefined,
    arcType: td.arcType as AddPolylineOptions["arcType"],
    cornerType: td.cornerType as AddPolylineOptions["cornerType"],
    style: td.styleSnapshot as PolylineStyleOptions,
    dashed: td.dashed as DashedPolylineParams,
    outline: td.outline as OutlinePolylineParams,
    glowing: td.glowing as GlowingPolylineParams,
    flowing: td.flowing as FlowingPolylineParams,
    gradient: td.gradient as GradientPolylineParams,
    volumeBlock: td.volumeBlock as VolumeBlockParams,
    volumeTube: td.volumeTube as VolumeTubeParams,
    wall: td.wall as WallParams,
    arrow: lineKind === "arrow" ? (td.arrow as ArrowPolylineParams) : undefined,
    polylineClampToGround:
      typeof td.polylineClampToGround === "number"
        ? (td.polylineClampToGround as PolylineClampToGroundFlag)
        : undefined,
  };

  mountGraphics(
    rec.viewer,
    rec.entity,
    rec.extraEntities,
    cartesians,
    opts,
    lineKind,
    material,
    td,
  );
}

function readPositionsFromEntity(
  entity: Entity,
): Cesium.Cartesian3[] | undefined {
  const pl = entity.polyline;
  const pv = entity.polylineVolume;
  const w = entity.wall;
  const arr =
    (pl && sampleProperty<Cesium.Cartesian3[]>(pl.positions)) ||
    (pv && sampleProperty<Cesium.Cartesian3[]>(pv.positions)) ||
    (w && sampleProperty<Cesium.Cartesian3[]>(w.positions));
  if (!arr || arr.length < 2) return undefined;
  return arr;
}

function cloneTargetData(
  data?: Record<string, unknown>,
): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  return { ...data };
}

const KIND_SET = new Set<PolylineLineKind>([
  "solid",
  "clamp_ground",
  "dashed",
  "outline",
  "glowing",
  "flowing",
  "gradient",
  "arrow",
  "volume_block",
  "volume_tube",
  "wall",
]);

function normalizeKind(k: PolylineLineKind | undefined): PolylineLineKind {
  if (k && KIND_SET.has(k)) return k;
  return "solid";
}

// ==================== PolyLine 主类 ====================

export default class PolyLine {
  private readonly data = new Map<string, PolylineRecord>();

  private isRecordAlive(rec: PolylineRecord): boolean {
    if (rec.viewer.isDestroyed()) return false;
    return rec.viewer.entities.contains(rec.entity);
  }

  private takeIfAlive(id: string): PolylineRecord | undefined {
    const rec = this.data.get(id);
    if (!rec) return undefined;
    if (!this.isRecordAlive(rec)) {
      if (!rec.viewer.isDestroyed())
        disposeExtraEntities(rec.viewer, rec.extraEntities);
      this.data.delete(id);
      return undefined;
    }
    return rec;
  }

  add(viewer: Viewer, options: AddPolylineOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined;

    const id = options.id?.trim() ? options.id : createRandomXgxId("pl");
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined;

    const cartesians = resolvePolylineCartesians(options.positions);
    if (!cartesians) return undefined;

    const lineKind = normalizeKind(options.lineKind);
    const alpha = options.alpha ?? 1;
    const baseColor =
      toColor(options.color ?? "#00d4ff", alpha) ?? Cesium.Color.CYAN;
    const flowEpoch = Cesium.JulianDate.clone(Cesium.JulianDate.now());
    const material = buildPolylineMaterial(
      lineKind,
      baseColor,
      options.dashed,
      options.outline,
      options.glowing,
      options.flowing,
      options.gradient,
      flowEpoch,
    );

    const targetData = cloneTargetData(options.targetData);
    const entity = new Cesium.Entity({ id, show: options.show !== false });
    const extraEntities: Entity[] = [];

    mountGraphics(
      viewer,
      entity,
      extraEntities,
      cartesians,
      options,
      lineKind,
      material,
      targetData,
    );

    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description);
    }

    viewer.entities.add(entity);
    requestRenderIfPolylineClampToGround(viewer, entity);

    // 保存元数据
    targetData.lineKind = lineKind;
    targetData.geometryMode = geometryModeForKind(lineKind);
    targetData.color = options.color ?? "#00d4ff";
    targetData.alpha = alpha;
    targetData.arcType = options.arcType ?? "GEODESIC";
    targetData.cornerType = options.cornerType ?? "ROUNDED";
    const clampReq = effectiveClampToGroundRequest(lineKind, options);
    targetData.clampToGround = resolveClampToGround(
      cartesians,
      options.style,
      clampReq,
      viewer,
      targetData,
    );
    if (options.clampToGround !== undefined)
      targetData.apiClampToGround = options.clampToGround;
    targetData.polylineClampToGround =
      lineKind === "clamp_ground" || options.polylineClampToGround === 1 ? 1 : 0;
    targetData.lineWidth = options.width ?? 3;
    if (options.dashed) targetData.dashed = { ...options.dashed };
    if (options.outline) targetData.outline = { ...options.outline };
    if (options.glowing) targetData.glowing = { ...options.glowing };
    if (options.flowing) targetData.flowing = { ...options.flowing };
    if (options.gradient) targetData.gradient = { ...options.gradient };
    if (options.volumeBlock)
      targetData.volumeBlock = { ...options.volumeBlock };
    if (options.volumeTube) targetData.volumeTube = { ...options.volumeTube };
    if (options.wall) targetData.wall = { ...options.wall };
    if (options.style) targetData.styleSnapshot = { ...options.style };
    if (lineKind === "arrow" && options.arrow)
      targetData.arrow = { ...options.arrow };
    else delete targetData.arrow;

    targetData.positionsSnapshot = cartesiansToLngLatHeightArray(cartesians);

    this.data.set(id, {
      viewer,
      entity,
      extraEntities,
      targetData,
      lineKind,
      geometryMode: geometryModeForKind(lineKind),
      flowEpoch,
    });

    return entity;
  }

  addBatch(
    viewer: Viewer,
    items: AddPolylineOptions[],
  ): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed())
      return { succeeded: [], failedIds: [] };
    const succeeded: Entity[] = [];
    const failedIds: string[] = [];
    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId("pl");
      const e = this.add(viewer, { ...item, id: resolvedId });
      if (e) succeeded.push(e);
      else failedIds.push(resolvedId);
    }
    return { succeeded, failedIds };
  }

  addPolylines(viewer: Viewer, options: AddPolylineOptions[]): string[] {
    if (
      !viewer ||
      viewer.isDestroyed() ||
      !Array.isArray(options) ||
      options.length === 0
    )
      return [];
    const ids: string[] = [];
    for (let i = 0; i < options.length; i++) {
      try {
        const item = options[i]!;
        const id = item.id?.trim() ? item.id : createRandomXgxId("pl");
        const e = this.add(viewer, { ...item, id });
        if (e) ids.push(id);
      } catch (e) {
        console.error(`[PolyLine] addPolylines item ${i} failed:`, e);
      }
    }
    return ids;
  }

  updatePolyline(id: string, properties: UpdatePolylineProperties): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const p = properties;
    const td = rec.targetData;

    if (p.targetData !== undefined) Object.assign(td, p.targetData);
    if (p.color !== undefined)
      td.color =
        p.color instanceof Cesium.Color ? colorToCss(p.color) : p.color;
    if (p.alpha !== undefined) td.alpha = p.alpha;
    if (p.arcType !== undefined) td.arcType = p.arcType;
    if (p.cornerType !== undefined) td.cornerType = p.cornerType;
    if (p.clampToGround !== undefined) td.apiClampToGround = p.clampToGround;
    if (p.polylineClampToGround !== undefined)
      td.polylineClampToGround = p.polylineClampToGround;
    if (p.width !== undefined) td.lineWidth = p.width;
    if (p.dashed) td.dashed = { ...p.dashed };
    if (p.outline) td.outline = { ...p.outline };
    if (p.glowing) td.glowing = { ...p.glowing };
    if (p.flowing) td.flowing = { ...p.flowing };
    if (p.gradient) td.gradient = { ...p.gradient };
    if (p.volumeBlock) td.volumeBlock = { ...p.volumeBlock };
    if (p.volumeTube) td.volumeTube = { ...p.volumeTube };
    if (p.wall) td.wall = { ...p.wall };
    if (p.arrow !== undefined) td.arrow = p.arrow ? { ...p.arrow } : undefined;
    if (p.style)
      td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style };

    let cartesians: Cesium.Cartesian3[] | undefined;
    if (p.positions !== undefined) {
      const next = resolvePolylineCartesians(p.positions);
      if (!next) return false;
      cartesians = next;
      td.positionsSnapshot = cartesiansToLngLatHeightArray(next);
    } else {
      const snap = td.positionsSnapshot as LngLatHeight[] | undefined;
      if (snap && snap.length >= 2)
        cartesians = lngLatSnapshotToCartesians(snap);
      else cartesians = readPositionsFromEntity(rec.entity);
    }
    if (!cartesians) return false;

    const nextKind =
      p.lineKind !== undefined ? normalizeKind(p.lineKind) : rec.lineKind;
    if (p.lineKind !== undefined && nextKind !== "arrow") td.arrow = undefined;
    if (p.lineKind !== undefined) {
      td.polylineClampToGround = nextKind === "clamp_ground" ? 1 : 0;
    }
    if (p.polylineClampToGround !== undefined) {
      td.polylineClampToGround = p.polylineClampToGround;
    }

    const needMat =
      p.lineKind !== undefined ||
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.dashed !== undefined ||
      p.outline !== undefined ||
      p.glowing !== undefined ||
      p.flowing !== undefined ||
      p.gradient !== undefined ||
      p.volumeBlock !== undefined ||
      p.volumeTube !== undefined ||
      p.wall !== undefined ||
      p.arrow !== undefined ||
      p.clampToGround !== undefined ||
      p.polylineClampToGround !== undefined ||
      p.width !== undefined ||
      p.arcType !== undefined ||
      p.style !== undefined ||
      p.positions !== undefined;

    if (p.lineKind === "flowing" && rec.lineKind !== "flowing") {
      rec.flowEpoch = Cesium.JulianDate.clone(Cesium.JulianDate.now());
    }

    if (needMat) {
      rec.lineKind = nextKind;
      rec.geometryMode = geometryModeForKind(nextKind);
      td.lineKind = nextKind;
      td.geometryMode = rec.geometryMode;
      rebuildMaterialAndMaybeGeometry(
        rec,
        cartesians,
        td,
        nextKind,
        rec.flowEpoch,
      );
    }

    if (p.show !== undefined) {
      rec.entity.show = p.show;
      for (const ex of rec.extraEntities) ex.show = p.show;
    }
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description);
    }

    requestRenderIfPolylineClampToGround(rec.viewer, rec.entity);

    return true;
  }

  updatePolylines(
    updates: Array<{ id: string } & UpdatePolylineProperties>,
  ): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({
      id,
      success: this.updatePolyline(id, rest),
    }));
  }

  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id);
    return rec ? { ...rec.targetData } : undefined;
  }

  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...targetData };
    return true;
  }

  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...rec.targetData, ...patch };
    return true;
  }

  getPolyline(id: string): PolylineSnapshot | null {
    const rec = this.takeIfAlive(id);
    if (!rec) return null;

    const td = rec.targetData;
    const snap = td.positionsSnapshot as LngLatHeight[] | undefined;
    let positions: LngLatHeight[];

    if (snap && snap.length >= 2) {
      positions = snap.map((p) => ({ ...p }));
    } else {
      const arr = readPositionsFromEntity(rec.entity);
      if (!arr || arr.length < 2) return null;
      positions = cartesiansToLngLatHeightArray(arr);
    }

    const pl = rec.entity.polyline;
    const width =
      (pl && sampleProperty<number>(pl.width)) ??
      (typeof td.lineWidth === "number" ? td.lineWidth : 3);
    const clamp = pl
      ? (sampleProperty<boolean>(pl.clampToGround) ?? false)
      : td.clampToGround === true;
    const arc = pl ? sampleProperty<Cesium.ArcType>(pl.arcType) : undefined;
    const desc = sampleProperty<string>(rec.entity.description);

    const polylineClampToGround: PolylineClampToGroundFlag =
      td.polylineClampToGround === 1 ? 1 : 0;

    return {
      id: rec.entity.id,
      lineKind: rec.lineKind,
      geometryMode: rec.geometryMode,
      positions,
      width,
      polylineClampToGround,
      clampToGround: clamp,
      arcType:
        arc !== undefined
          ? ((Cesium.ArcType as unknown as Record<number, string>)[
              arc as number
            ] ?? String(arc))
          : String(td.arcType ?? "GEODESIC"),
      cornerType: typeof td.cornerType === "string" ? td.cornerType : undefined,
      colorCss: typeof td.color === "string" ? td.color : undefined,
      show: rec.entity.show,
      dashed: td.dashed as DashedPolylineParams,
      outline: td.outline as OutlinePolylineParams,
      glowing: td.glowing as GlowingPolylineParams,
      flowing: td.flowing as FlowingPolylineParams,
      gradient: td.gradient as GradientPolylineParams,
      volumeBlock: td.volumeBlock as VolumeBlockParams,
      volumeTube: td.volumeTube as VolumeTubeParams,
      wall: td.wall as WallParams,
      arrow: td.arrow as ArrowPolylineParams,
      targetData: { ...td },
      description: desc,
    };
  }

  getAllPolylines(viewer?: Viewer): PolylineSnapshot[] {
    const out: PolylineSnapshot[] = [];
    for (const id of this.getIds(viewer)) {
      const s = this.getPolyline(id);
      if (s) out.push(s);
    }
    return out;
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length;
  }

  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer);
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue;
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      rec.entity.show = show;
      for (const ex of rec.extraEntities) ex.show = show;
    }
  }

  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show);
  }

  removeAll(viewer?: Viewer): void {
    this.clear(viewer);
  }

  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity;
  }

  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined;
  }

  getIds(viewer?: Viewer): string[] {
    const out: string[] = [];
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue;
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      out.push(id);
    }
    return out;
  }

  updateStyle(id: string, style: PolylineStyleOptions): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    const pl = rec.entity.polyline;
    if (pl) mergePolylineGraphics(pl, style, undefined, false);
    rec.targetData.styleSnapshot = {
      ...(rec.targetData.styleSnapshot as object),
      ...style,
    };
    return true;
  }

  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.show = visible;
    for (const ex of rec.extraEntities) ex.show = visible;
    return true;
  }

  show(id: string): boolean {
    return this.setVisible(id, true);
  }

  hide(id: string): boolean {
    return this.setVisible(id, false);
  }

  setDescription(id: string, description: string): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.description = new Cesium.ConstantProperty(description);
    return true;
  }

  remove(id: string): boolean {
    const rec = this.data.get(id);
    if (!rec) return false;
    this.data.delete(id);
    if (!rec.viewer.isDestroyed()) {
      disposeExtraEntities(rec.viewer, rec.extraEntities);
      if (rec.viewer.entities.contains(rec.entity)) {
        rec.viewer.entities.remove(rec.entity);
      }
    }
    return true;
  }

  removeBatch(ids: string[]): number {
    let n = 0;
    for (const id of ids) {
      if (this.remove(id)) n += 1;
    }
    return n;
  }

  clear(viewer?: Viewer): void {
    const toRemove: string[] = [];
    for (const [id, rec] of this.data) {
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      toRemove.push(id);
    }
    for (const id of toRemove) this.remove(id);
  }

  pruneInvalid(): number {
    let n = 0;
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) {
        if (!rec.viewer.isDestroyed())
          disposeExtraEntities(rec.viewer, rec.extraEntities);
        this.data.delete(id);
        n += 1;
      }
    }
    return n;
  }

  destroy(): void {
    this.clear();
  }
}
