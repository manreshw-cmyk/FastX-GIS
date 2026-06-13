/**
 * 扫描雷达特效。
 * Entity 类用于单体绘制，ScanRadarCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import type { SpecialEffectsColorInput, SpecialEffectsPositionInput } from "../shared";
import { toCesiumColor } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import { resolveSpatialOptions, type ResolvedSpatialEffectOptions } from "../common/effect-geometry";
import { buildSphericalSectorSpec } from "../common/radar-builders";

/** 扫描雷达新增参数。 */
export interface ScanRadarAddOptions {
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
  /** 雷达体颜色。默认 rgba(255,255,0,0.5)。 */
  color?: SpecialEffectsColorInput;
  /** 网格线颜色。默认 rgba(255,255,255,0.45)。 */
  lineColor?: SpecialEffectsColorInput;
  /** 扫描面颜色。默认 rgba(0,255,110,0.45)。 */
  scanColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 水平方向分段数。默认 72。 */
  horiSegments?: number;
  /** 垂直方向分段数。默认 36。 */
  vertSegments?: number;
  /** 探测半径，单位：米。默认 1000000。 */
  radius?: number;
  /** 最小水平角，单位：度。默认 -45。 */
  minHoriAngle?: number;
  /** 最大水平角，单位：度。默认 45。 */
  maxHoriAngle?: number;
  /** 最小垂直角，单位：度。默认 0。 */
  minVertAngle?: number;
  /** 最大垂直角，单位：度。默认 45。 */
  maxVertAngle?: number;
  /** 是否显示扫描面。默认 true。 */
  scanVisible?: boolean;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 扫描雷达更新参数。 */
export type ScanRadarUpdateOptions = Partial<Omit<ScanRadarAddOptions, "id">>;

/** 扫描雷达解析参数。 */
export type ScanRadarResolvedOptions = Omit<
  ScanRadarAddOptions,
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

/** 扫描雷达 Entity 单体绘制类。 */
export default class ScanRadar extends RenderableEntityEffect<ScanRadarAddOptions, ScanRadarResolvedOptions> {
  constructor(viewer?: Cesium.Viewer) {
    super("scan-radar", "FastX Scan Radar", buildSphericalSectorSpec, resolveScanRadarOptions, viewer);
  }

  /** 批量新增扫描雷达 Entity，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: ScanRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并扫描雷达默认参数。 */
export function resolveScanRadarOptions(options: ScanRadarAddOptions & { id: string }): ScanRadarResolvedOptions {
  const spatial = resolveSpatialOptions(
    options,
    Cesium.Color.fromCssColorString("rgba(255,255,0,0.5)")!,
    Cesium.Color.fromCssColorString("rgba(255,0,0,1.0)")!,
  );
  return {
    ...options,
    ...spatial,
    id: options.id,
    radius: options.radius ?? 1000000,
    minHoriAngle: options.minHoriAngle ?? -30,
    maxHoriAngle: options.maxHoriAngle ?? 30,
    minVertAngle: options.minVertAngle ?? 0,
    maxVertAngle: options.maxVertAngle ?? 30,
    horiSegments: Math.max(4, Math.floor(options.horiSegments ?? 72)),
    vertSegments: Math.max(4, Math.floor(options.vertSegments ?? 36)),
    scanVisible: options.scanVisible ?? true,
    scanColor: toCesiumColor(options.scanColor, Cesium.Color.fromCssColorString("rgba(0,110,110,0.5)")!),
  };
}
