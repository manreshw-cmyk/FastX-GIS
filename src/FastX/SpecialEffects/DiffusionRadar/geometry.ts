import * as Cesium from "cesium";
import {
  closeLine,
  createCircleLocalPoints,
  createLocalFrame,
  localPointsToWorld,
  localToWorld,
  type EffectRenderSpec,
  type LocalPoint,
} from "../common/effect-geometry";
import { calcDiffusionRadarWaveState, type DiffusionRadarAnimationState } from "./animation";
import type { DiffusionRadarResolvedOptions } from ".";

/** 创建扩散雷达静态面和边界线。 */
export function createDiffusionRadarStaticGeometry(options: DiffusionRadarResolvedOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const face = createFillPositions(options, matrix);
  return {
    faces: [{ positions: face, color: options.color }],
    lines: [
      {
        positions: createOutlinePositions(options, face, matrix),
        color: options.lineColor,
        width: options.lineWidth,
      },
    ],
  };
}

/** 创建当前帧的全部扩散波纹线。 */
export function createDiffusionRadarWaveGeometry(
  options: DiffusionRadarResolvedOptions,
  animation: DiffusionRadarAnimationState,
): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const lines = Array.from({ length: options.waveCount }, (_, index) => {
    const wave = calcDiffusionRadarWaveState(options, animation, index);
    const color = Cesium.Color.clone(options.lineColor);
    color.alpha = wave.alpha;
    return {
      positions: createWavePositions(options, Math.max(0.001, wave.radius), matrix),
      color,
      width: options.lineWidth,
    };
  });
  return { faces: [], lines };
}

/** 创建指定波纹的线坐标，供 Entity 动画回调复用。 */
export function createDiffusionRadarWavePositions(
  options: DiffusionRadarResolvedOptions,
  radius: number,
): Cesium.Cartesian3[] {
  return createWavePositions(options, Math.max(0.001, radius), createLocalFrame(options));
}

function createFillPositions(
  options: DiffusionRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const arc = createArcWorldPositions(options.radius, options, matrix);
  if (options.isCircle) return arc.slice(0, -1);
  return [localToWorld([0, 0, 0], matrix), ...arc];
}

function createOutlinePositions(
  options: DiffusionRadarResolvedOptions,
  face: Cesium.Cartesian3[],
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  return options.isCircle ? createArcWorldPositions(options.radius, options, matrix) : closeLine([...face]);
}

function createWavePositions(
  options: DiffusionRadarResolvedOptions,
  radius: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  return createArcWorldPositions(radius, options, matrix);
}

function createArcWorldPositions(
  radius: number,
  options: DiffusionRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const localPoints = createArcLocalPoints(radius, options);
  return localPointsToWorld(localPoints, matrix);
}

function createArcLocalPoints(radius: number, options: DiffusionRadarResolvedOptions): LocalPoint[] {
  return createCircleLocalPoints(
    radius,
    options.segments,
    0,
    options.startAngle,
    options.startAngle + options.angleSpan,
  );
}
