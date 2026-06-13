/**
 * 双圆锥环面扫描体特效。
 * Entity 类用于单体绘制，RingConeScannerCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildRingConeSpec } from "../common/radar-builders";

/** 双圆锥环面扫描体新增参数。 */
export interface RingConeScannerAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 扫描体中心点。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 环面颜色。默认 rgba(89,255,155,0.55)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 rgba(89,255,155,1)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 环向分段数。默认 96。 */
  segments?: number;
  /** 探测半径，单位：米。默认 500000。 */
  radius?: number;
  /** 最小仰角，单位：度。默认 45。 */
  minElevationAngle?: number;
  /** 最大仰角，单位：度。默认 60。 */
  maxElevationAngle?: number;
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
    radius: number;
    minElevationAngle: number;
    maxElevationAngle: number;
  };

/** 双圆锥环面扫描体 Entity 单体绘制类。 */
export default class RingConeScanner extends RenderableEntityEffect<
  RingConeScannerAddOptions,
  RingConeScannerResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("ring-cone-scanner", "FastX Ring Cone Scanner", buildRingConeSpec, resolveRingConeScannerOptions, viewer);
  }

  /** 批量新增双圆锥环面扫描体 Entity，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: RingConeScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并双圆锥环面扫描体默认参数。 */
export function resolveRingConeScannerOptions(options: RingConeScannerAddOptions & { id: string }): RingConeScannerResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(255,55,125,0.85)")!,
    Cesium.Color.fromCssColorString("rgba(255,255,0,1)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    radius: options.radius ?? Cesium.Ellipsoid.WGS84.maximumRadius,
    minElevationAngle: options.minElevationAngle ?? 50,
    maxElevationAngle: options.maxElevationAngle ?? 60,
  };
}
