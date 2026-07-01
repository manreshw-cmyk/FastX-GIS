/**
 * 圆锥扫描特效。
 * Entity 单体类和 Primitive 批量类共用同一套线框规格，支持圆锥填充和扫描环独立显隐。
 */
import * as Cesium from "cesium";
import { toCesiumColor, type SpecialEffectsColorInput, type SpecialEffectsPositionInput } from "../shared";
import { RenderableEntityEffect } from "../common/renderable-effect";
import {
  createCircleLocalPoints,
  createLocalFrame,
  localPointsToWorld,
  localToWorld,
  resolveSpatialOptions,
  type EffectFaceSpec,
  type EffectLineSpec,
  type EffectRenderSpec,
  type LocalPoint,
  type ResolvedSpatialEffectOptions,
} from "../common/effect-geometry";

/** 圆锥扫描特效新增参数。 */
export interface ConeEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 圆锥顶点位置，支持 [longitude, latitude, height]。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 0。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0，圆锥沿局部 -Z 方向展开。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 整体缩放。默认 1。 */
  scale?: number;
  /** 圆锥母线和底部外圈线颜色。默认 rgba(255,0,0,1)。 */
  coneLineColor?: SpecialEffectsColorInput;
  /** 扫描环、辅助环和径向线颜色。默认 rgba(0,255,0,1)。 */
  scanLineColor?: SpecialEffectsColorInput;
  /** 圆锥面填充色。默认 rgba(0,255,255,0.25)。 */
  coneFillColor?: SpecialEffectsColorInput;
  /** 是否填充圆锥背景。默认 false。 */
  showConeFill?: boolean;
  /** 是否显示圆锥母线、底部外圈和填充面。默认 true。 */
  showCone?: boolean;
  /** 是否显示扫描环、辅助环和径向线。默认 true。 */
  showScan?: boolean;
  /** 线宽，单位：像素。默认 1。 */
  lineWidth?: number;
  /** 线框密度，同时控制圆锥母线、扫描环和径向线数量。默认 280。 */
  segments?: number;
  /** 圆锥高度，单位：米。默认 500000。 */
  height?: number;
  /** 圆锥底部半径，单位：米。默认 100000。 */
  baseRadius?: number;
  /** 扫描环半径，单位：米。默认 70000，可小于或大于 baseRadius。 */
  scanRadius?: number;
  /** 是否显示整体特效。默认 true。 */
  show?: boolean;
}

/** 圆锥扫描特效更新参数。 */
export type ConeEffectUpdateOptions = Partial<Omit<ConeEffectAddOptions, "id">>;

/** 圆锥扫描特效解析参数。 */
export type ConeEffectResolvedOptions = Omit<
  ConeEffectAddOptions,
  "position" | "coneLineColor" | "scanLineColor" | "coneFillColor" | "height"
> &
  ResolvedSpatialEffectOptions & {
    id: string;
    /** 圆锥高度，单位：米。 */
    height: number;
    /** 圆锥底部半径，单位：米。 */
    baseRadius: number;
    /** 扫描环半径，单位：米。 */
    scanRadius: number;
    /** 圆锥线颜色。 */
    coneLineColor: Cesium.Color;
    /** 扫描环线颜色。 */
    scanLineColor: Cesium.Color;
    /** 圆锥填充色。 */
    coneFillColor: Cesium.Color;
    /** 是否填充圆锥背景。 */
    showConeFill: boolean;
    /** 是否绘制圆锥本体。 */
    showCone: boolean;
    /** 是否绘制扫描环。 */
    showScan: boolean;
  };

/** 圆锥扫描特效 Entity 单体绘制类。 */
export default class ConeEffect extends RenderableEntityEffect<ConeEffectAddOptions, ConeEffectResolvedOptions> {
  constructor(viewer?: Cesium.Viewer) {
    super("cone-effect", "FastX Cone Scan Effect", buildConeEffectSpec, resolveConeEffectOptions, viewer);
  }

  /** 批量新增圆锥扫描特效 Entity，返回成功创建的 id。 */
  addCones(viewer: Cesium.Viewer, options: ConeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }
}

/** 合并圆锥扫描特效默认参数。 */
export function resolveConeEffectOptions(options: ConeEffectAddOptions & { id: string }): ConeEffectResolvedOptions {
  const coneLineColor = Cesium.Color.fromCssColorString("rgba(255,0,0,1)")!;
  const scanLineColor = Cesium.Color.fromCssColorString("rgba(0,255,0,1)")!;
  const coneFillColor = Cesium.Color.fromCssColorString("rgba(0,255,255,0.25)")!;
  const spatial = resolveSpatialOptions(options, coneFillColor, coneLineColor);
  const resolvedConeLineColor = toCesiumColor(options.coneLineColor, coneLineColor);

  return {
    ...options,
    ...spatial,
    id: options.id,
    height: options.height ?? 500000,
    baseRadius: options.baseRadius ?? 100000,
    scanRadius: options.scanRadius ?? 70000,
    coneLineColor: resolvedConeLineColor,
    scanLineColor: toCesiumColor(options.scanLineColor, scanLineColor),
    coneFillColor: toCesiumColor(options.coneFillColor, coneFillColor),
    lineColor: resolvedConeLineColor,
    showConeFill: options.showConeFill ?? false,
    showCone: options.showCone ?? true,
    showScan: options.showScan ?? true,
    segments: Math.max(32, Math.floor(options.segments ?? 280)),
  };
}

/** 构建圆锥扫描渲染规格，供 Entity 单体和 Primitive 批量共用。 */
export function buildConeEffectSpec(options: ConeEffectResolvedOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const segments = Math.max(32, Math.floor(options.segments));
  const apex = localToWorld([0, 0, 0], matrix);
  const baseRing = localPointsToWorld(createCircleLocalPoints(options.baseRadius, segments, -options.height), matrix);
  const scanRing = localPointsToWorld(createCircleLocalPoints(options.scanRadius, segments, -options.height), matrix);
  const faces: EffectFaceSpec[] = [];
  const lines: EffectLineSpec[] = [];

  if (options.showCone) {
    lines.push({ positions: baseRing, color: options.coneLineColor, width: options.lineWidth });
    lines.push(...createConeSpokes(apex, baseRing, options));
    if (options.showConeFill) faces.push(...createConeFaces(apex, baseRing, options));
  }

  if (options.showScan) {
    lines.push({ positions: scanRing, color: options.scanLineColor, width: options.lineWidth });
    lines.push(...createScanRingLines(options, matrix));
  }

  return { faces, lines };
}

/** 创建圆锥透明填充面。 */
function createConeFaces(
  apex: Cesium.Cartesian3,
  baseRing: Cesium.Cartesian3[],
  options: ConeEffectResolvedOptions,
): EffectFaceSpec[] {
  const faces: EffectFaceSpec[] = [];
  for (let index = 0; index < baseRing.length - 1; index += 1) {
    faces.push({
      positions: [apex, baseRing[index]!, baseRing[index + 1]!],
      color: options.coneFillColor,
    });
  }
  return faces;
}

/** 创建从圆锥顶点直达底部圆周的母线。 */
function createConeSpokes(
  apex: Cesium.Cartesian3,
  baseRing: Cesium.Cartesian3[],
  options: ConeEffectResolvedOptions,
): EffectLineSpec[] {
  const lines: EffectLineSpec[] = [];
  for (let index = 0; index < baseRing.length - 1; index += 1) {
    lines.push({
      positions: [apex, baseRing[index]!],
      color: options.coneLineColor,
      width: options.lineWidth,
    });
  }
  return lines;
}

/** 创建扫描环到圆锥底部外圈之间的辅助环线和径向线。 */
function createScanRingLines(options: ConeEffectResolvedOptions, matrix: Cesium.Matrix4): EffectLineSpec[] {
  const lines: EffectLineSpec[] = [];
  const ringCount = 4;

  for (let ringIndex = 1; ringIndex < ringCount; ringIndex += 1) {
    const radius = options.scanRadius + ((options.baseRadius - options.scanRadius) * ringIndex) / ringCount;
    lines.push({
      positions: localPointsToWorld(createCircleLocalPoints(radius, options.segments, -options.height), matrix),
      color: options.scanLineColor,
      width: options.lineWidth,
    });
  }

  for (let index = 0; index < options.segments; index += 1) {
    const angle = (Cesium.Math.TWO_PI * index) / options.segments;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const radial: LocalPoint[] = [
      [cos * options.baseRadius, sin * options.baseRadius, -options.height],
      [cos * options.scanRadius, sin * options.scanRadius, -options.height],
    ];
    lines.push({
      positions: localPointsToWorld(radial, matrix),
      color: options.scanLineColor,
      width: options.lineWidth,
    });
  }

  return lines;
}
