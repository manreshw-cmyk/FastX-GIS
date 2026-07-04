import * as Cesium from "cesium";
import { createLocalFrame, localToWorld, type LocalPoint } from "../common/effect-geometry";
import type { RingRadarResolvedOptions } from ".";

/** 环形雷达扫描叶片数量。 */
export const RING_RADAR_INNER_SCAN_BLADE_COUNT = 3;

/** 环形雷达弧面面片。 */
export interface RingRadarFaceSpec {
  positions: Cesium.Cartesian3[];
  color: Cesium.Color;
}

/** 环形雷达网格线。 */
export interface RingRadarLineSpec {
  positions: Cesium.Cartesian3[];
  color: Cesium.Color;
  width: number;
}

/** 环形雷达静态几何。 */
export interface RingRadarStaticGeometrySpec {
  faces: RingRadarFaceSpec[];
  lines: RingRadarLineSpec[];
}

/** 创建内外环弧面和网格的静态几何。 */
export function createRingRadarStaticGeometry(options: RingRadarResolvedOptions): RingRadarStaticGeometrySpec {
  const matrix = createLocalFrame(options);
  return {
    faces: [
      ...createDomeSurfaceFaces(options.outerRadius, options.outerDomeHeight, options.outerSurfaceColor, options, matrix),
      ...createDomeSurfaceFaces(options.innerRadius, options.innerDomeHeight, options.innerSurfaceColor, options, matrix),
    ],
    lines: [
      ...createDomeGridLines(options.outerRadius, options.outerDomeHeight, options.outerGridColor, options, matrix),
      ...createDomeGridLines(options.innerRadius, options.innerDomeHeight, options.innerGridColor, options, matrix),
    ],
  };
}

/** 创建四个扫描叶片面片：外环 1 个、内环 3 个。 */
export function createRingRadarScanBladeFaces(
  options: RingRadarResolvedOptions,
  angle: number,
  color = options.scanBladeColor,
): RingRadarFaceSpec[] {
  const matrix = createLocalFrame(options);
  return [
    {
      positions: createScanBladePositions(options.outerRadius, options.outerDomeHeight, angle, options, matrix),
      color,
    },
    ...Array.from({ length: RING_RADAR_INNER_SCAN_BLADE_COUNT }, (_, index) => ({
      positions: createScanBladePositions(
        options.innerRadius,
        options.innerDomeHeight,
        angle + (360 / RING_RADAR_INNER_SCAN_BLADE_COUNT) * index,
        options,
        matrix,
      ),
      color,
    })),
  ];
}

function createDomeSurfaceFaces(
  radius: number,
  domeHeight: number,
  color: Cesium.Color,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): RingRadarFaceSpec[] {
  const faces: RingRadarFaceSpec[] = [];
  for (let row = 0; row < options.verticalSegments; row += 1) {
    for (let col = 0; col < options.horizontalSegments; col += 1) {
      faces.push({
        positions: domePatchPositions(radius, domeHeight, options, matrix, row, col),
        color,
      });
    }
  }
  return faces;
}

function createDomeGridLines(
  radius: number,
  domeHeight: number,
  color: Cesium.Color,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): RingRadarLineSpec[] {
  const lines: RingRadarLineSpec[] = [];
  for (let row = 1; row <= options.verticalSegments; row += 1) {
    const currentRadius = (radius * row) / options.verticalSegments;
    lines.push({
      positions: domeCirclePositions(radius, domeHeight, currentRadius, options, matrix),
      color,
      width: options.gridLineWidth,
    });
  }

  const radialStep = Math.max(1, Math.floor(options.horizontalSegments / 36));
  for (let col = 0; col < options.horizontalSegments; col += radialStep) {
    const angle = (360 * col) / options.horizontalSegments;
    const positions: Cesium.Cartesian3[] = [];
    for (let row = 0; row <= options.verticalSegments; row += 1) {
      const currentRadius = (radius * row) / options.verticalSegments;
      positions.push(domeWorldPoint(currentRadius, angle, radius, domeHeight, matrix));
    }
    lines.push({ positions, color, width: options.gridLineWidth });
  }

  return lines;
}

function domePatchPositions(
  radius: number,
  domeHeight: number,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
  row: number,
  col: number,
): Cesium.Cartesian3[] {
  const innerRowRadius = (radius * row) / options.verticalSegments;
  const outerRowRadius = (radius * (row + 1)) / options.verticalSegments;
  const startAngle = (360 * col) / options.horizontalSegments;
  const endAngle = (360 * (col + 1)) / options.horizontalSegments;

  if (row === 0) {
    return [
      domeWorldPoint(innerRowRadius, startAngle, radius, domeHeight, matrix),
      domeWorldPoint(outerRowRadius, endAngle, radius, domeHeight, matrix),
      domeWorldPoint(outerRowRadius, startAngle, radius, domeHeight, matrix),
    ];
  }

  return [
    domeWorldPoint(innerRowRadius, startAngle, radius, domeHeight, matrix),
    domeWorldPoint(innerRowRadius, endAngle, radius, domeHeight, matrix),
    domeWorldPoint(outerRowRadius, endAngle, radius, domeHeight, matrix),
    domeWorldPoint(outerRowRadius, startAngle, radius, domeHeight, matrix),
  ];
}

function domeCirclePositions(
  radius: number,
  domeHeight: number,
  currentRadius: number,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = [];
  for (let i = 0; i <= options.horizontalSegments; i += 1) {
    positions.push(
      domeWorldPoint(currentRadius, (360 * i) / options.horizontalSegments, radius, domeHeight, matrix),
    );
  }
  return positions;
}

function createScanBladePositions(
  radius: number,
  domeHeight: number,
  angle: number,
  options: RingRadarResolvedOptions,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[] {
  const radialSegments = Math.max(8, Math.ceil(options.horizontalSegments / 6));
  const clampedRadius = Math.max(0, radius);
  const halfAngle = options.scanBladeAngle / 2;
  const edgeSegments = Math.max(2, Math.ceil(options.horizontalSegments / 8));
  const positions: Cesium.Cartesian3[] = [];

  for (let i = 0; i <= radialSegments; i += 1) {
    const r = clamp((clampedRadius * i) / radialSegments, 0, clampedRadius);
    positions.push(circlePoint(r, angle - halfAngle, 0, matrix));
  }

  for (let i = 1; i <= edgeSegments; i += 1) {
    const t = i / edgeSegments;
    const edgeAngle = angle - halfAngle + options.scanBladeAngle * t;
    positions.push(domeWorldPoint(clampedRadius, edgeAngle, clampedRadius, domeHeight, matrix));
  }

  for (let i = radialSegments; i >= 0; i -= 1) {
    const r = clamp((clampedRadius * i) / radialSegments, 0, clampedRadius);
    positions.push(domeWorldPoint(r, angle + halfAngle, clampedRadius, domeHeight, matrix));
  }

  return positions;
}

function domeWorldPoint(
  radius: number,
  angle: number,
  maxRadius: number,
  domeHeight: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3 {
  return circlePoint(radius, angle, domeHeightAtRadius(radius, maxRadius, domeHeight), matrix);
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
