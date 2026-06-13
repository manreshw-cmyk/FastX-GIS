/**
 * 抛物面雷达特效。
 * Entity 类用于单体绘制，ParabolaRadarCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildParabolaRadarSpec } from "../common/radar-builders";

/** 抛物面雷达新增参数。 */
export interface ParabolaRadarAddOptions {
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
  /** 抛物面颜色。默认 rgba(0,255,55,0.3)。 */
  color?: SpecialEffectsColorInput;
  /** 网格线颜色。默认 rgba(0,255,55,0.75)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 环向分段数。默认 96。 */
  segments?: number;
  /** 底部半径，单位：米。默认 100000。 */
  radius?: number;
  /** 抛物面高度，单位：米。默认 500000。 */
  height?: number;
  /** 径向分段数。默认 32。 */
  radialSegments?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 抛物面雷达更新参数。 */
export type ParabolaRadarUpdateOptions = Partial<Omit<ParabolaRadarAddOptions, "id">>;

/** 抛物面雷达解析参数。 */
export type ParabolaRadarResolvedOptions = Omit<
  ParabolaRadarAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    radius: number;
    height: number;
    radialSegments: number;
  };

/** 抛物面雷达 Entity 单体绘制类。 */
export default class ParabolaRadar extends RenderableEntityEffect<
  ParabolaRadarAddOptions,
  ParabolaRadarResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("parabola-radar", "FastX Parabola Radar", buildParabolaRadarSpec, resolveParabolaRadarOptions, viewer);
  }

  /** 批量新增抛物面雷达 Entity，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并抛物面雷达默认参数。 */
export function resolveParabolaRadarOptions(options: ParabolaRadarAddOptions & { id: string }): ParabolaRadarResolvedOptions {
  const spatial = resolveSpatialOptions(
    { ...options, segments: options.segments ?? 20 },
    Cesium.Color.fromCssColorString("rgba(0,255,0,0.1)")!,
    Cesium.Color.fromCssColorString("rgba(0,255,0,0.2)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    radius: options.radius ?? 100000,
    height: options.height ?? 30000,
    radialSegments: Math.max(4, Math.floor(options.radialSegments ?? 50)),
  };
}
