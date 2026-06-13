/**
 * 双面视锥体特效。
 * Entity 类用于单体绘制，DoubleViewFrustumCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildDoubleFrustumSpec } from "../common/radar-builders";

/** 双面视锥体新增参数。 */
export interface DoubleViewFrustumAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 视锥体相机位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 面填充色。默认 rgba(0,255,255,0.25)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 white。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 近平面距离，单位：米。默认 500000。 */
  near?: number;
  /** 远平面距离，单位：米。默认 1000000。 */
  far?: number;
  /** 垂直视场角，单位：度。默认 30。 */
  fov?: number;
  /** 宽高比。默认 2。 */
  aspectRatio?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 双面视锥体更新参数。 */
export type DoubleViewFrustumUpdateOptions = Partial<Omit<DoubleViewFrustumAddOptions, "id">>;

/** 双面视锥体解析参数。 */
export type DoubleViewFrustumResolvedOptions = Omit<
  DoubleViewFrustumAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    near: number;
    far: number;
    fov: number;
    aspectRatio: number;
  };

/** 双面视锥体 Entity 单体绘制类。 */
export default class DoubleViewFrustum extends RenderableEntityEffect<
  DoubleViewFrustumAddOptions,
  DoubleViewFrustumResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("double-view-frustum", "FastX Double View Frustum", buildDoubleFrustumSpec, resolveDoubleViewFrustumOptions, viewer);
  }

  /** 批量新增双面视锥体 Entity，返回成功创建的 id。 */
  addFrustums(viewer: Cesium.Viewer, options: DoubleViewFrustumAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并双面视锥体默认参数。 */
export function resolveDoubleViewFrustumOptions(
  options: DoubleViewFrustumAddOptions & { id: string },
): DoubleViewFrustumResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(0,255,255,0.25)")!,
    Cesium.Color.CYAN,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    near: options.near ?? 500000,
    far: options.far ?? 1000000,
    fov: options.fov ?? 30,
    aspectRatio: options.aspectRatio ?? 2,
  };
}
