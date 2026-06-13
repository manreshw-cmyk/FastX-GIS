/**
 * 四方锥体扫描特效。
 * Entity 类用于单体绘制，SquareConeScannerCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildSquareConeSpec } from "../common/radar-builders";

/** 四方锥体扫描新增参数。 */
export interface SquareConeScannerAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 四方锥体顶点位置。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0，四方锥体沿局部 -Z 方向展开。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 锥体面颜色。默认 rgba(89,255,155,0.55)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 rgba(89,255,155,1)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 锥体高度，单位：米。默认 500000。 */
  height?: number;
  /** 水平张角，单位：度。默认 30。 */
  horiAngle?: number;
  /** 垂直张角，单位：度。默认 30。 */
  vertAngle?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 四方锥体扫描更新参数。 */
export type SquareConeScannerUpdateOptions = Partial<Omit<SquareConeScannerAddOptions, "id">>;

/** 四方锥体扫描解析参数。 */
export type SquareConeScannerResolvedOptions = Omit<
  SquareConeScannerAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    height: number;
    horiAngle: number;
    vertAngle: number;
  };

/** 四方锥体扫描 Entity 单体绘制类。 */
export default class SquareConeScanner extends RenderableEntityEffect<
  SquareConeScannerAddOptions,
  SquareConeScannerResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("square-cone-scanner", "FastX Square Cone Scanner", buildSquareConeSpec, resolveSquareConeScannerOptions, viewer);
  }

  /** 批量新增四方锥体扫描 Entity，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: SquareConeScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并四方锥体扫描默认参数。 */
export function resolveSquareConeScannerOptions(
  options: SquareConeScannerAddOptions & { id: string },
): SquareConeScannerResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(0,255,0,0.15)")!,
    Cesium.Color.fromCssColorString("rgba(255,255,0,1)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    height: options.height ?? 500000,
    horiAngle: options.horiAngle ?? 18,
    vertAngle: options.vertAngle ?? 25,
  };
}
