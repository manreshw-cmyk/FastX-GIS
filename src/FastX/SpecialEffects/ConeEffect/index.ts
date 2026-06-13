/**
 * 圆锥特效。
 * Entity 类用于单体绘制，ConeEffectCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import { toCesiumColor, type SpecialEffectsColorInput, type SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildConeLikeSpec } from "../common/radar-builders";

/** 圆锥特效新增参数。 */
export interface ConeEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 圆锥顶点位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0，圆锥沿局部 -Z 方向展开。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 圆锥面颜色。默认 rgba(255,180,0,0.18)。 */
  color?: SpecialEffectsColorInput;
  /** 圆锥线框颜色。默认 rgba(255,220,120,0.85)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 内圈和径向连接线颜色，默认 rgba(0,255,0,1)。 */
  innerLineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 几何分段数。默认 96。 */
  segments?: number;
  /** 圆锥高度，单位：米。默认 500000。 */
  height?: number;
  /** 底部半径，单位：米。默认 100000。 */
  bottomRadius?: number;
  /** 内部辅助环半径，单位：米。默认 70000。 */
  innerRadius?: number;
  /** 是否显示半透明面。默认 false。 */
  fill?: boolean;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 圆锥特效更新参数。 */
export type ConeEffectUpdateOptions = Partial<Omit<ConeEffectAddOptions, "id">>;

/** 圆锥特效解析参数。 */
export type ConeEffectResolvedOptions = Omit<
  ConeEffectAddOptions,
  "position" | "color" | "lineColor" | "height"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    length: number;
    bottomRadius: number;
    innerRadius: number;
    innerLineColor: Cesium.Color;
    fill: boolean;
  };

/** 圆锥特效 Entity 单体绘制类。 */
export default class ConeEffect extends RenderableEntityEffect<ConeEffectAddOptions, ConeEffectResolvedOptions> {
  constructor(viewer?: Cesium.Viewer) {
    super("cone-effect", "FastX Cone Effect", buildConeLikeSpec, resolveConeEffectOptions, viewer);
  }

  /** 批量新增圆锥特效 Entity，返回成功创建的 id。 */
  addCones(viewer: Cesium.Viewer, options: ConeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并圆锥特效默认参数。 */
export function resolveConeEffectOptions(options: ConeEffectAddOptions & { id: string }): ConeEffectResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(255,0,0,0.0)")!,
    Cesium.Color.fromCssColorString("rgba(255,0,0,1)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    length: options.height ?? 500000,
    bottomRadius: options.bottomRadius ?? 100000,
    innerRadius: options.innerRadius ?? 70000,
    innerLineColor: toCesiumColor(options.innerLineColor, Cesium.Color.LIME),
    fill: options.fill ?? false,
  };
}
