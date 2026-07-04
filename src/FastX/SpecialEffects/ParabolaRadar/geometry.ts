import * as Cesium from "cesium";
import { createLocalFrame, localToWorld, type LocalPoint } from "../common/effect-geometry";
import type { ParabolaRadarResolvedOptions } from ".";

const RADIAL_GRID_TARGET_COUNT = 36;
const SCAN_BLADE_RADIAL_STEP_RATIO = 6;
const SCAN_BLADE_OUTER_EDGE_RATIO = 8;

/** 抛物面雷达面片。 */
export interface ParabolaRadarFaceSpec {
  positions: Cesium.Cartesian3[];
  color: Cesium.Color;
}

/** 抛物面雷达网格线。 */
export interface ParabolaRadarLineSpec {
  positions: Cesium.Cartesian3[];
  color: Cesium.Color;
  width: number;
}

/** 静态弧面和网格几何数据。 */
export interface ParabolaRadarStaticGeometrySpec {
  faces: ParabolaRadarFaceSpec[];
  lines: ParabolaRadarLineSpec[];
}

/** 创建单个抛物面雷达的弧面和网格。 */
export function createParabolaRadarStaticGeometry(
  options: ParabolaRadarResolvedOptions,
): ParabolaRadarStaticGeometrySpec {
  const matrix = createLocalFrame(options);
  return {
    faces: createDomeSurfaceFaces(options, matrix),
    lines: createDomeGridLines(options, matrix),
  };
}

/** 创建按数量均分的扫描叶片面片。 */
export function createParabolaRadarScanBladeFaces(
  options: ParabolaRadarResolvedOptions,
  angle: number,
  color = options.scanBladeColor,
): ParabolaRadarFaceSpec[] {
  const matrix = createLocalFrame(options);
  const count = Math.max(1, Math.floor(options.scanBladeCount));
  return Array.from({ length: count }, (_, index) => ({
    positions: createScanBladePositions(angle + (360 / count) * index, options, matrix),
    color,
  }));
}

function createDomeSurfaceFaces(
  options: ParabolaRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): ParabolaRadarFaceSpec[] {
  const faces: ParabolaRadarFaceSpec[] = [];
  for (let row = 0; row < options.verticalSegments; row += 1) {
    for (let col = 0; col < options.horizontalSegments; col += 1) {
      faces.push({
        positions: domePatchPositions(options, matrix, row, col),
        color: options.surfaceColor,
      });
    }
  }
  return faces;
}

function createDomeGridLines(
  options: ParabolaRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): ParabolaRadarLineSpec[] {
  const lines: ParabolaRadarLineSpec[] = [];
  for (let row = 1; row <= options.verticalSegments; row += 1) {
    const currentRadius = (options.radius * row) / options.verticalSegments;
    lines.push({
      positions: domeCirclePositions(currentRadius, options, matrix),
      color: options.gridColor,
      width: options.gridLineWidth,
    });
  }

  const radialLineStep = Math.max(1, Math.floor(options.horizontalSegments / RADIAL_GRID_TARGET_COUNT));
  for (let col = 0; col < options.horizontalSegments; col += radialLineStep) {
    const angle = (360 * col) / options.horizontalSegments;
    const positions: Cesium.Cartesian3[] = [];
    for (let row = 0; row <= options.verticalSegments; row += 1) {
      const currentRadius = (options.radius * row) / options.verticalSegments;
      positions.push(domeWorldPoint(currentRadius, angle, options, matrix));
    }
    lines.push({ positions, color: options.gridColor, width: options.gridLineWidth });
  }

  return lines;
}

function domePatchPositions(
  options: ParabolaRadarResolvedOptions,
  matrix: Cesium.Matrix4,
  row: number,
  col: number,
): Cesium.Cartesian3[] {
  const innerRowRadius = (options.radius * row) / options.verticalSegments;
  const outerRowRadius = (options.radius * (row + 1)) / options.verticalSegments;
  const startAngle = (360 * col) / options.horizontalSegments;
  const endAngle = (360 * (col + 1)) / options.horizontalSegments;

  if (row === 0) {
    return [
      domeWorldPoint(innerRowRadius, startAngle, options, matrix),
      domeWorldPoint(outerRowRadius, endAngle, options, matrix),
      domeWorldPoint(outerRowRadius, startAngle, options, matrix),
    ];
  }

  return [
    domeWorldPoint(innerRowRadius, startAngle, options, matrix),
    domeWorldPoint(innerRowRadius, endAngle, options, matrix),
    domeWorldPoint(outerRowRadius, endAngle, options, matrix),
    domeWorldPoint(outerRowRadius, startAngle, options, matrix),
  ];
}

function domeCirclePositions(
  currentRadius: number,
  options: ParabolaRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = [];
  for (let i = 0; i <= options.horizontalSegments; i += 1) {
    positions.push(domeWorldPoint(currentRadius, (360 * i) / options.horizontalSegments, options, matrix));
  }
  return positions;
}

function createScanBladePositions(
  angle: number,
  options: ParabolaRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const bladeRadialSteps = Math.max(8, Math.ceil(options.horizontalSegments / SCAN_BLADE_RADIAL_STEP_RATIO));
  const halfAngle = options.scanBladeAngle / 2;
  const outerEdgeSteps = Math.max(2, Math.ceil(options.horizontalSegments / SCAN_BLADE_OUTER_EDGE_RATIO));
  const positions: Cesium.Cartesian3[] = [];

  // 点序：地面径向边 -> 顶部外弧边 -> 弧面径向边。
  for (let i = 0; i <= bladeRadialSteps; i += 1) {
    const radius = clamp((options.radius * i) / bladeRadialSteps, 0, options.radius);
    positions.push(circlePoint(radius, angle - halfAngle, 0, matrix));
  }

  for (let i = 1; i <= outerEdgeSteps; i += 1) {
    const t = i / outerEdgeSteps;
    const edgeAngle = angle - halfAngle + options.scanBladeAngle * t;
    positions.push(domeWorldPoint(options.radius, edgeAngle, options, matrix));
  }

  for (let i = bladeRadialSteps; i >= 0; i -= 1) {
    const radius = clamp((options.radius * i) / bladeRadialSteps, 0, options.radius);
    positions.push(domeWorldPoint(radius, angle + halfAngle, options, matrix));
  }

  return positions;
}

function domeWorldPoint(
  radius: number,
  angle: number,
  options: Pick<ParabolaRadarResolvedOptions, "radius" | "domeHeight">,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3 {
  return circlePoint(radius, angle, domeHeightAtRadius(radius, options.radius, options.domeHeight), matrix);
}

function domeHeightAtRadius(radius: number, maxRadius: number, domeHeight: number): number {
  const t = clamp(radius / Math.max(1, maxRadius), 0, 1);
  const crown = Math.sin(Math.PI * t) * domeHeight * 0.74;
  const shoulder = Math.sin(Math.PI * Math.min(t, 0.5)) * domeHeight * 0.24;
  return Math.max(0, crown + shoulder);
}

function circlePoint(radius: number, angle: number, z: number, matrix: Cesium.Matrix4): Cesium.Cartesian3 {
  const rad = Cesium.Math.toRadians(angle);
  const point: LocalPoint = [Math.cos(rad) * radius, Math.sin(rad) * radius, z];
  return localToWorld(point, matrix);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
