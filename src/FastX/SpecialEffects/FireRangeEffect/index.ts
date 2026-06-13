/**
 * 火力范围特效。
 * Entity 类用于单体绘制，FireRangeEffectCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { toCesiumColor } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildSphericalSectorSpec } from "../common/radar-builders";

/** 火力范围新增参数。 */
export interface FireRangeEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 火力范围中心点。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 范围面颜色。默认 rgba(255,255,0,0.5)。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。默认 red。 */
  lineColor?: SpecialEffectsColorInput;
  /** 扫描面颜色。默认 rgba(0,255,110,0.45)。 */
  scanColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 火力范围半径，单位：米。默认 10000。 */
  radius?: number;
  /** 最小水平角，单位：度。默认 -30。 */
  minHoriAngle?: number;
  /** 最大水平角，单位：度。默认 30。 */
  maxHoriAngle?: number;
  /** 最小垂直角，单位：度。默认 80。 */
  minVertAngle?: number;
  /** 最大垂直角，单位：度。默认 100。 */
  maxVertAngle?: number;
  /** 水平方向分段数。默认 72。 */
  horiSegments?: number;
  /** 垂直方向分段数。默认 36。 */
  vertSegments?: number;
  /** 是否显示扫描面。默认 true。 */
  scanVisible?: boolean;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 火力范围更新参数。 */
export type FireRangeEffectUpdateOptions = Partial<Omit<FireRangeEffectAddOptions, "id">>;

/** 火力范围解析参数。 */
export type FireRangeEffectResolvedOptions = Omit<
  FireRangeEffectAddOptions,
  "position" | "color" | "lineColor" | "scanColor"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    radius: number;
    minHoriAngle: number;
    maxHoriAngle: number;
    minVertAngle: number;
    maxVertAngle: number;
    horiSegments: number;
    vertSegments: number;
    scanVisible: boolean;
    scanColor: Cesium.Color;
  };

/** 火力范围 Entity 单体绘制类。 */
export default class FireRangeEffect extends RenderableEntityEffect<
  FireRangeEffectAddOptions,
  FireRangeEffectResolvedOptions
> {
  constructor(viewer?: Cesium.Viewer) {
    super("fire-range-effect", "FastX Fire Range Effect", buildSphericalSectorSpec, resolveFireRangeEffectOptions, viewer);
  }

  /** 批量新增火力范围 Entity，返回成功创建的 id。 */
  addRanges(viewer: Cesium.Viewer, options: FireRangeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并火力范围默认参数。 */
export function resolveFireRangeEffectOptions(
  options: FireRangeEffectAddOptions & { id: string },
): FireRangeEffectResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(255,255,0,0.5)")!,
    Cesium.Color.RED,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    radius: options.radius ?? 10000,
    minHoriAngle: options.minHoriAngle ?? -30,
    maxHoriAngle: options.maxHoriAngle ?? 30,
    minVertAngle: options.minVertAngle ?? 80,
    maxVertAngle: options.maxVertAngle ?? 100,
    horiSegments: Math.max(4, Math.floor(options.horiSegments ?? 360)),
    vertSegments: Math.max(4, Math.floor(options.vertSegments ?? 180)),
    scanVisible: options.scanVisible ?? true,
    scanColor: toCesiumColor(options.scanColor, Cesium.Color.fromCssColorString("rgba(0,255,110,0.45)")!),
  };
}
