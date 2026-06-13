/**
 * 锥体扫描特效。
 * Entity 类用于单体绘制，ConicalScannerCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildConicalScannerSpec } from "../common/radar-builders";

/** 锥体扫描新增参数。 */
export interface ConicalScannerAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 锥体扫描中心点。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 扫描面颜色。默认 rgba(89,255,155,0.55)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 rgba(89,255,155,1)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 几何分段数。默认 96。 */
  segments?: number;
  /** 扫描高度，单位：米。默认 500000。 */
  height?: number;
  /** 内半径，单位：米。默认 20000。 */
  innerRadius?: number;
  /** 外半径，单位：米。默认 60000。 */
  outerRadius?: number;
  /** 扫描扇形角度，单位：度。默认 60。 */
  angle?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 锥体扫描更新参数。 */
export type ConicalScannerUpdateOptions = Partial<Omit<ConicalScannerAddOptions, "id">>;

/** 锥体扫描解析参数。 */
export type ConicalScannerResolvedOptions = Omit<
  ConicalScannerAddOptions,
  "position" | "color" | "lineColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    height: number;
    innerRadius: number;
    outerRadius: number;
    angle: number;
  };

/** 锥体扫描 Entity 单体绘制类。 */
export default class ConicalScanner extends RenderableEntityEffect<
  ConicalScannerAddOptions,
  ConicalScannerResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("conical-scanner", "FastX Conical Scanner", buildConicalScannerSpec, resolveConicalScannerOptions, viewer);
  }

  /** 批量新增锥体扫描 Entity，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: ConicalScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并锥体扫描默认参数。 */
export function resolveConicalScannerOptions(
  options: ConicalScannerAddOptions & { id: string },
): ConicalScannerResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(89,255,155,0.55)")!,
    Cesium.Color.fromCssColorString("rgba(89,255,155,1)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    height: options.height ?? 50000,
    innerRadius: options.innerRadius ?? 20000,
    outerRadius: options.outerRadius ?? 60000,
    angle: options.angle ?? 60,
  };
}
