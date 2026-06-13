/**
 * 环形雷达扫描特效。
 * Entity 类用于单体绘制，RingRadarCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildRingRadarSpec } from "../common/radar-builders";

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
  /** 环面颜色。默认 rgba(0,255,55,0.3)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 rgba(0,255,55,0.75)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 环向分段数。默认 96。 */
  segments?: number;
  /** 外半径，单位：米。默认 66000。 */
  radius?: number;
  /** 内半径，单位：米。默认 60000。 */
  innerRadius?: number;
  /** 最小仰角，单位：度。默认 0。 */
  minElevationAngle?: number;
  /** 最大仰角，单位：度。默认 20。 */
  maxElevationAngle?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 环形雷达扫描更新参数。 */
export type RingRadarUpdateOptions = Partial<Omit<RingRadarAddOptions, "id">>;

/** 环形雷达扫描解析参数。 */
export type RingRadarResolvedOptions = Omit<
  RingRadarAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    radius: number;
    innerRadius: number;
    minElevationAngle: number;
    maxElevationAngle: number;
  };

/** 环形雷达扫描 Entity 单体绘制类。 */
export default class RingRadar extends RenderableEntityEffect<RingRadarAddOptions, RingRadarResolvedOptions> {
  constructor(viewer?: Cesium.Viewer) {
    super("ring-radar", "FastX Ring Radar", buildRingRadarSpec, resolveRingRadarOptions, viewer);
  }

  /** 批量新增环形雷达扫描 Entity，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并环形雷达扫描默认参数。 */
export function resolveRingRadarOptions(options: RingRadarAddOptions & { id: string }): RingRadarResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(0,255,55,0.3)")!,
    Cesium.Color.fromCssColorString("rgba(0,255,55,0.75)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    radius: options.radius ?? 66000,
    innerRadius: options.innerRadius ?? 60000,
    minElevationAngle: options.minElevationAngle ?? 0,
    maxElevationAngle: options.maxElevationAngle ?? 20,
  };
}
