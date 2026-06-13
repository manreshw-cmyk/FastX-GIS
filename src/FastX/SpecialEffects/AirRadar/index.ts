/**
 * 空中雷达特效。
 * Entity 类用于单体绘制，AirRadarCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildConeLikeSpec } from "../common/radar-builders";

/** 空中雷达新增参数。 */
export interface AirRadarAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 雷达发射点，通常为飞机或卫星位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0，锥体沿局部 -Z 方向展开。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 雷达锥体颜色。默认 rgba(0,255,120,0.18)。 */
  color?: SpecialEffectsColorInput;
  /** 雷达轮廓线颜色。默认 rgba(255,255,255,0.35)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 轮廓线宽度，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 几何分段数。默认 96。 */
  segments?: number;
  /** 探测长度，单位：米。默认 100000。 */
  length?: number;
  /** 雷达张角，单位：度。默认 30。 */
  angle?: number;
  /** 底部半径，单位：米；不传时按 angle 和 length 自动计算。 */
  bottomRadius?: number;
  /** 内部辅助环半径，单位：米。 */
  innerRadius?: number;
  /** 是否显示半透明面。默认 true。 */
  fill?: boolean;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 空中雷达更新参数。 */
export type AirRadarUpdateOptions = Partial<Omit<AirRadarAddOptions, "id">>;

/** 空中雷达解析参数。 */
export type AirRadarResolvedOptions = Omit<
  AirRadarAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    length: number;
    bottomRadius: number;
    innerRadius: number;
    fill: boolean;
  };

/** 空中雷达 Entity 单体绘制类。 */
export default class AirRadar extends RenderableEntityEffect<AirRadarAddOptions, AirRadarResolvedOptions> {
  constructor(viewer?: Cesium.Viewer) {
    super("air-radar", "FastX Air Radar", buildConeLikeSpec, resolveAirRadarOptions, viewer);
  }

  /** 批量新增空中雷达 Entity，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: AirRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并空中雷达默认参数。 */
export function resolveAirRadarOptions(options: AirRadarAddOptions & { id: string }): AirRadarResolvedOptions {
  const length = options.length ?? 200000;
  const angle = options.angle ?? 30;
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(255,255,0,0.1)")!,
    Cesium.Color.fromCssColorString("rgba(0,255,0,0.8)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    length,
    angle,
    bottomRadius: options.bottomRadius ?? Math.tan(Cesium.Math.toRadians(angle) / 2) * length,
    innerRadius: options.innerRadius ?? 0,
    fill: options.fill ?? true,
  };
}
