/**
 * 四方视椎体特效。
 * Entity 类用于单体绘制，SquareConeScannerCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import { toCesiumColor, type SpecialEffectsColorInput, type SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildSquareConeSpec } from "../common/radar-builders";

const DEFAULT_FACE_COLOR = Cesium.Color.fromCssColorString("rgba(89,255,155,0.55)")!;
const DEFAULT_LINE_COLOR = Cesium.Color.fromCssColorString("rgba(89,255,155,1)")!;
const DEFAULT_BOTTOM_OUTLINE_COLOR = Cesium.Color.YELLOW;

/** 四方视椎体新增参数。 */
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
  /** 是否显示远端底面外框线。默认 true。 */
  bottomOutlineVisible?: boolean;
  /** 远端底面外框线颜色。默认 yellow。 */
  bottomOutlineColor?: SpecialEffectsColorInput;
  /** 远端底面外框线透明度，范围 0-1。默认 1。 */
  bottomOutlineAlpha?: number;
  /** 远端底面外框线宽度，单位：像素。默认 1。 */
  bottomOutlineWidth?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 四方视椎体更新参数。 */
export type SquareConeScannerUpdateOptions = Partial<Omit<SquareConeScannerAddOptions, "id">>;

/** 四方视椎体解析参数。 */
export type SquareConeScannerResolvedOptions = Omit<
  SquareConeScannerAddOptions,
  | "position"
  | "color"
  | "lineColor"
  | "bottomOutlineColor"
  | "bottomOutlineAlpha"
  | "bottomOutlineVisible"
  | "bottomOutlineWidth"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    height: number;
    horiAngle: number;
    vertAngle: number;
    bottomOutlineVisible: boolean;
    bottomOutlineColor: Cesium.Color;
    bottomOutlineWidth: number;
  };

/** 四方视椎体 Entity 单体绘制类。 */
export default class SquareConeScanner extends RenderableEntityEffect<
  SquareConeScannerAddOptions,
  SquareConeScannerResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("square-cone-scanner", "FastX Square Cone Scanner", buildSquareConeSpec, resolveSquareConeScannerOptions, viewer);
  }

  /** 批量新增四方视椎体 Entity，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: SquareConeScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并四方视椎体默认参数。 */
export function resolveSquareConeScannerOptions(
  options: SquareConeScannerAddOptions & { id: string },
): SquareConeScannerResolvedOptions {
  const spatial = resolveSpatialOptions(options, DEFAULT_FACE_COLOR, DEFAULT_LINE_COLOR);
  const bottomOutlineColor = toCesiumColor(options.bottomOutlineColor, DEFAULT_BOTTOM_OUTLINE_COLOR);
  if (typeof options.bottomOutlineAlpha === "number") {
    bottomOutlineColor.alpha = Cesium.Math.clamp(options.bottomOutlineAlpha, 0, 1);
  }

  return {
    ...options,
    ...spatial,
    id: options.id,
    height: options.height ?? 500000,
    horiAngle: options.horiAngle ?? 30,
    vertAngle: options.vertAngle ?? 30,
    bottomOutlineVisible: options.bottomOutlineVisible ?? true,
    bottomOutlineColor,
    bottomOutlineWidth: options.bottomOutlineWidth ?? 1,
  };
}
