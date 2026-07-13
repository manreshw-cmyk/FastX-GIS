/**
 * 双圆锥环面扫描体特效。
 * Entity 类用于单体绘制，RingConeScannerCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import {
  createLocalFrame,
  localToWorld,
  resolveSpatialOptions,
  type EffectFaceSpec,
  type EffectLineSpec,
  type EffectRenderSpec,
  type LocalPoint,
  type ResolvedSpatialEffectOptions,
} from "../common/effect-geometry";

const DEFAULT_COLOR = Cesium.Color.fromCssColorString("rgba(255,55,125,0.85)")!;
const DEFAULT_LINE_COLOR = Cesium.Color.YELLOW;
const DEFAULT_HEIGHT = 500000;
const DEFAULT_MIN_GROUND_OPEN_ANGLE = 80;
const DEFAULT_MAX_GROUND_OPEN_ANGLE = 85;
const DEFAULT_EXCLUDE_ANGLE = 70;
const MIN_GROUND_OPEN_ANGLE = 1;
const MAX_GROUND_OPEN_ANGLE = 89.9;
const MAX_EXCLUDE_ANGLE = 179.9;
const MIN_SEGMENTS = 24;

/** 双圆锥环面扫描体新增参数。 */
export interface RingConeScannerAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 扫描体顶点位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 锥体高度，单位：米。默认 500000。 */
  height?: number;
  /** 与地面的最小张开角，单位：度。默认 80。角度越小，外圈半径越大。 */
  minGroundOpenAngle?: number;
  /** 与地面的最大张开角，单位：度。默认 85。角度越大，内圈半径越小。 */
  maxGroundOpenAngle?: number;
  /** 前侧排除角，单位：度。默认 70。 */
  frontExcludeAngle?: number;
  /** 后侧排除角，单位：度。默认 70。 */
  backExcludeAngle?: number;
  /** 环面填充色。默认 rgba(255,55,125,0.85)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 yellow。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 环向插值点数。默认 96。 */
  segments?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 双圆锥环面扫描体更新参数。 */
export type RingConeScannerUpdateOptions = Partial<Omit<RingConeScannerAddOptions, "id">>;

/** 双圆锥环面扫描体解析参数。 */
export type RingConeScannerResolvedOptions = Omit<
  RingConeScannerAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    height: number;
    minGroundOpenAngle: number;
    maxGroundOpenAngle: number;
    frontExcludeAngle: number;
    backExcludeAngle: number;
  };

interface AngleRange {
  start: number;
  end: number;
}

/** 双圆锥环面扫描体 Entity 单体绘制类。 */
export default class RingConeScanner extends RenderableEntityEffect<
  RingConeScannerAddOptions,
  RingConeScannerResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super(
      "ring-cone-scanner",
      "FastX Ring Cone Scanner",
      buildRingConeScannerSpec,
      resolveRingConeScannerOptions,
      viewer,
    );
  }

  /** 批量新增双圆锥环面扫描体 Entity，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: RingConeScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并双圆锥环面扫描体默认参数。 */
export function resolveRingConeScannerOptions(
  options: RingConeScannerAddOptions & { id: string },
): RingConeScannerResolvedOptions {
  const spatial = resolveSpatialOptions(options, DEFAULT_COLOR, DEFAULT_LINE_COLOR);
  const height = Math.max(1, options.height ?? DEFAULT_HEIGHT);
  const [minGroundOpenAngle, maxGroundOpenAngle] = normalizeGroundOpenAngles(
    options.minGroundOpenAngle,
    options.maxGroundOpenAngle,
  );

  return {
    ...options,
    ...spatial,
    id: options.id,
    height,
    minGroundOpenAngle,
    maxGroundOpenAngle,
    frontExcludeAngle: normalizeExcludeAngle(options.frontExcludeAngle ?? DEFAULT_EXCLUDE_ANGLE),
    backExcludeAngle: normalizeExcludeAngle(options.backExcludeAngle ?? DEFAULT_EXCLUDE_ANGLE),
    segments: Math.max(MIN_SEGMENTS, spatial.segments),
  };
}

/** 创建单体 Entity 使用的双圆锥环面扫描体规格。 */
export function buildRingConeScannerSpec(options: RingConeScannerResolvedOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const apex = localToWorld([0, 0, 0], matrix);
  const outerRadius = getConeRadius(options.height, options.minGroundOpenAngle);
  const innerRadius = getConeRadius(options.height, options.maxGroundOpenAngle);
  const ranges = createIncludedAngleRanges(options.frontExcludeAngle, options.backExcludeAngle);
  const faces: EffectFaceSpec[] = [];
  const lines: EffectLineSpec[] = [];

  ranges.forEach((range) => {
    const span = range.end - range.start;
    const segmentCount = Math.max(2, Math.round((options.segments * span) / 360));
    const outer = createWorldArc(outerRadius, -options.height, range, segmentCount, matrix);
    const inner = createWorldArc(innerRadius, -options.height, range, segmentCount, matrix);

    for (let index = 0; index < segmentCount; index += 1) {
      faces.push({ positions: [apex, outer[index]!, outer[index + 1]!], color: options.color });
      faces.push({ positions: [apex, inner[index + 1]!, inner[index]!], color: options.color });
      faces.push({
        positions: [inner[index]!, inner[index + 1]!, outer[index + 1]!, outer[index]!],
        color: options.color,
      });
    }

    lines.push({ positions: outer, color: options.lineColor, width: options.lineWidth });
    lines.push({ positions: inner, color: options.lineColor, width: options.lineWidth });
    lines.push({ positions: [inner[0]!, outer[0]!], color: options.lineColor, width: options.lineWidth });
    lines.push({
      positions: [inner[inner.length - 1]!, outer[outer.length - 1]!],
      color: options.lineColor,
      width: options.lineWidth,
    });
    lines.push({ positions: [apex, outer[0]!], color: options.lineColor, width: options.lineWidth });
    lines.push({ positions: [apex, outer[outer.length - 1]!], color: options.lineColor, width: options.lineWidth });
  });

  return { faces, lines };
}

/** 规整与地面张开角，保证外圈角小、内圈角大。 */
function normalizeGroundOpenAngles(minAngle?: number, maxAngle?: number): [number, number] {
  const first = clampNumber(minAngle ?? DEFAULT_MIN_GROUND_OPEN_ANGLE, MIN_GROUND_OPEN_ANGLE, MAX_GROUND_OPEN_ANGLE);
  const second = clampNumber(maxAngle ?? DEFAULT_MAX_GROUND_OPEN_ANGLE, MIN_GROUND_OPEN_ANGLE, MAX_GROUND_OPEN_ANGLE);
  return first <= second ? [first, second] : [second, first];
}

/** 规整前后排除角，避免单侧排除超过半圆造成几何反转。 */
function normalizeExcludeAngle(angle: number): number {
  return clampNumber(angle, 0, MAX_EXCLUDE_ANGLE);
}

/** 根据锥体高度和与地面夹角计算截面半径。 */
function getConeRadius(height: number, groundOpenAngle: number): number {
  return height / Math.tan(Cesium.Math.toRadians(groundOpenAngle));
}

/** 根据前后排除角计算需要保留的左右两个角度区间。0 度为局部 +Y 前方，180 度为后方。 */
function createIncludedAngleRanges(frontExcludeAngle: number, backExcludeAngle: number): AngleRange[] {
  if (frontExcludeAngle <= 0 && backExcludeAngle <= 0) {
    return [{ start: 0, end: 360 }];
  }

  const frontHalf = frontExcludeAngle / 2;
  const backHalf = backExcludeAngle / 2;
  const ranges: AngleRange[] = [
    { start: frontHalf, end: 180 - backHalf },
    { start: 180 + backHalf, end: 360 - frontHalf },
  ];
  return ranges.filter((range) => range.end - range.start > 0.1);
}

/** 创建指定角度区间的世界坐标圆弧点。 */
function createWorldArc(
  radius: number,
  z: number,
  range: AngleRange,
  segments: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const points: Cesium.Cartesian3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = Cesium.Math.toRadians(range.start + ((range.end - range.start) * index) / segments);
    points.push(localToWorld(createArcLocalPoint(radius, z, angle), matrix));
  }
  return points;
}

/** 以局部 +Y 为前方创建圆弧点。 */
function createArcLocalPoint(radius: number, z: number, angle: number): LocalPoint {
  return [Math.sin(angle) * radius, Math.cos(angle) * radius, z];
}

/** 限制数值范围。 */
function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
