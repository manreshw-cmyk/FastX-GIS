/**
 * 瞄准特效。
 * Entity 类用于单体绘制，AimEffectCollection 用于 Primitive 批量绘制。
 * 目标环平面会自动垂直于起点到目标点方向，形成真实空间锥体瞄准效果。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { toCartesian3 } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildAimEffectSpec } from "../common/radar-builders";

/** 默认连线颜色。 */
const DEFAULT_AIM_EFFECT_COLOR = Cesium.Color.fromCssColorString("rgba(255,0,0,0.4)")!;
/** 默认瞄准环和十字线颜色。 */
const DEFAULT_AIM_EFFECT_LINE_COLOR = Cesium.Color.WHITE;
/** 默认线宽，单位：像素。 */
const DEFAULT_AIM_EFFECT_LINE_WIDTH = 1;
/** 默认外圈半径，单位：米。 */
const DEFAULT_AIM_EFFECT_OUTSIDE_RADIUS = 50000;
/** 默认内圈半径，单位：米。 */
const DEFAULT_AIM_EFFECT_INSIDE_RADIUS = 1;

/** 瞄准特效新增参数。 */
export interface AimEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 瞄准起点，通常为发射平台或传感器位置。 */
  source: SpecialEffectsPositionInput;
  /** 瞄准目标点，目标环会围绕该点生成。 */
  target: SpecialEffectsPositionInput;
  /** 起点到目标点连线及锥体面颜色。默认 rgba(255,0,0,0.4)。 */
  color?: SpecialEffectsColorInput;
  /** 瞄准环和十字线颜色。默认 #ffffff。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 几何分段数。默认 96。 */
  segments?: number;
  /** 外圈半径，单位：米。默认 50000。 */
  outsideRadius?: number;
  /** 内圈半径，单位：米。默认 1。 */
  insideRadius?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 瞄准特效更新参数。 */
export type AimEffectUpdateOptions = Partial<Omit<AimEffectAddOptions, "id">>;

/** 瞄准特效解析参数。 */
export type AimEffectResolvedOptions = Omit<
  AimEffectAddOptions,
  "source" | "target" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    source: Cesium.Cartesian3;
    target: Cesium.Cartesian3;
    outsideRadius: number;
    insideRadius: number;
  };

/** 瞄准特效 Entity 单体绘制类。 */
export default class AimEffect extends RenderableEntityEffect<AimEffectAddOptions, AimEffectResolvedOptions> {
  constructor(viewer?: Cesium.Viewer) {
    super("aim-effect", "FastX Aim Effect", buildAimEffectSpec, resolveAimEffectOptions, viewer);
  }

  /** 批量新增瞄准特效 Entity，返回成功创建的 id。 */
  addEffects(viewer: Cesium.Viewer, options: AimEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并瞄准特效默认参数。 */
export function resolveAimEffectOptions(options: AimEffectAddOptions & { id: string }): AimEffectResolvedOptions {
  const target = toCartesian3(options.target);
  const outsideRadius = normalizePositiveNumber(options.outsideRadius, DEFAULT_AIM_EFFECT_OUTSIDE_RADIUS);
  const insideRadius = Math.min(
    normalizePositiveNumber(options.insideRadius, DEFAULT_AIM_EFFECT_INSIDE_RADIUS),
    outsideRadius,
  );
  const spatial = resolveSpatialOptions(
    {
      id: options.id,
      position: target,
      color: options.color,
      lineColor: options.lineColor,
      lineWidth: options.lineWidth ?? DEFAULT_AIM_EFFECT_LINE_WIDTH,
      segments: options.segments,
      show: options.show,
    },
    DEFAULT_AIM_EFFECT_COLOR,
    DEFAULT_AIM_EFFECT_LINE_COLOR,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    source: toCartesian3(options.source),
    target,
    outsideRadius,
    insideRadius,
  };
}

/** 规整正数参数，避免半径传入 0、负数或 NaN 后生成异常几何。 */
function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}
