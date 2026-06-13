/**
 * 圆形扩散雷达特效。
 * Entity 类用于单体绘制，CircleDiffusionRadarCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildDiffusionRadarSpec } from "../common/radar-builders";

/** 圆形扩散雷达新增参数。 */
export interface CircleDiffusionRadarAddOptions {
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
  /** 圆形面颜色。默认 rgba(0,255,120,0.18)。 */
  color?: SpecialEffectsColorInput;
  /** 扩散波纹颜色。默认 rgba(0,255,120,0.9)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 波纹线宽，单位：像素。默认 2。 */
  lineWidth?: number;
  /** 几何分段数。默认 128。 */
  segments?: number;
  /** 最大扩散半径，单位：米。默认 10000。 */
  radius?: number;
  /** 同时显示的波纹圈数量。默认 4。 */
  waveCount?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 圆形扩散雷达更新参数。 */
export type CircleDiffusionRadarUpdateOptions = Partial<Omit<CircleDiffusionRadarAddOptions, "id">>;

/** 圆形扩散雷达解析参数。 */
export type CircleDiffusionRadarResolvedOptions = Omit<
  CircleDiffusionRadarAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    radius: number;
    angle: number;
    waveCount: number;
  };

/** 圆形扩散雷达 Entity 单体绘制类。 */
export default class CircleDiffusionRadar extends RenderableEntityEffect<
  CircleDiffusionRadarAddOptions,
  CircleDiffusionRadarResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("circle-diffusion-radar", "FastX Circle Diffusion Radar", buildDiffusionRadarSpec, resolveCircleDiffusionRadarOptions, viewer);
  }

  /** 批量新增圆形扩散雷达 Entity，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: CircleDiffusionRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并圆形扩散雷达默认参数。 */
export function resolveCircleDiffusionRadarOptions(
  options: CircleDiffusionRadarAddOptions & { id: string },
): CircleDiffusionRadarResolvedOptions {
  const spatial = resolveSpatialOptions(
    { ...options, lineWidth: options.lineWidth ?? 1, segments: options.segments ?? 128 },
    Cesium.Color.fromCssColorString("rgba(0,255,0,0.15)")!,
    Cesium.Color.fromCssColorString("rgba(255,255,255,0.1)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    radius: options.radius ?? 100000,
    angle: 360,
    waveCount: Math.max(1, Math.floor(options.waveCount ?? 5)),
  };
}
