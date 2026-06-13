/**
 * 瞄准特效。
 * Entity 类用于单体绘制，AimEffectCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { toCartesian3 } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildAimEffectSpec } from "../common/radar-builders";

/** 瞄准特效新增参数。 */
export interface AimEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 瞄准起点，通常为发射平台位置。 */
  source: SpecialEffectsPositionInput;
  /** 瞄准目标点。 */
  target: SpecialEffectsPositionInput;
  /** 起点到目标点连线颜色。默认 rgba(255,80,80,0.75)。 */
  color?: SpecialEffectsColorInput;
  /** 瞄准环和十字线颜色。默认 rgba(255,255,255,0.9)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 2。 */
  lineWidth?: number;
  /** 几何分段数。默认 96。 */
  segments?: number;
  /** 外圈半径，单位：米。默认 50000。 */
  outsideRadius?: number;
  /** 内圈半径，单位：米；不传时为外圈半径的 0.52。 */
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
  const outsideRadius = options.outsideRadius ?? 50000;
  const spatial = resolveSpatialOptions(
    {
      id: options.id,
      position: target,
      color: options.color,
      lineColor: options.lineColor,
      lineWidth: options.lineWidth ?? 2,
      segments: options.segments,
      show: options.show,
    },
    Cesium.Color.fromCssColorString("rgba(255,0,0,0.1)")!,
    Cesium.Color.fromCssColorString("rgba(255,255,255,1.0)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    source: toCartesian3(options.source),
    target,
    outsideRadius,
    insideRadius: options.insideRadius ?? outsideRadius * 0.52,
  };
}
