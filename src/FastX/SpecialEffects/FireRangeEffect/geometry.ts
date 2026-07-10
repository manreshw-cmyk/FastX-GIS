import * as Cesium from "cesium";
import { createLocalFrame, localToWorld, type LocalPoint } from "../common/effect-geometry";
import type { FireRangeEffectResolvedOptions } from ".";

const ENTITY_MAX_HORI_SEGMENTS = 36;
const ENTITY_MAX_VERT_SEGMENTS = 18;
const ENTITY_MAX_RADIAL_SEGMENTS = 12;

/** 火力范围 Entity 填充面。 */
export interface FireRangeFaceSpec {
  positions: Cesium.Cartesian3[];
  color: Cesium.Color;
}

/** 火力范围 Entity 线。 */
export interface FireRangeWorldLineSpec {
  positions: Cesium.Cartesian3[];
  color: Cesium.Color;
  width: number;
}

/** 单个 Entity 火力范围效果需要绘制的全部几何。 */
export interface FireRangeEntityGeometrySpec {
  faces: FireRangeFaceSpec[];
  lines: FireRangeWorldLineSpec[];
}

/** 火力范围填充面网格。 */
export interface FireRangeSurfaceMesh {
  positions: LocalPoint[];
  st: number[];
  indices: number[];
}

/** 火力范围网格线或轮廓线。 */
export interface FireRangeLineSpec {
  positions: LocalPoint[];
  color: Cesium.Color;
  width: number;
}

/** 单个火力范围效果需要绘制的全部几何。 */
export interface FireRangeGeometrySpec {
  modelMatrix: Cesium.Matrix4;
  surface?: FireRangeSurfaceMesh;
  gridLines: FireRangeLineSpec[];
  outlineLines: FireRangeLineSpec[];
}

interface SurfaceVertex {
  point: LocalPoint;
  radialRatio: number;
  verticalRatio: number;
}

/** 创建从顶点向外发散、远端为弧形竖墙的火力范围几何。 */
export function createFireRangeGeometry(options: FireRangeEffectResolvedOptions): FireRangeGeometrySpec {
  const modelMatrix = createLocalFrame(options);
  return {
    modelMatrix,
    surface: options.fillVisible ? createSurfaceMesh(options) : undefined,
    gridLines: options.gridVisible ? createFarWallGridLines(options) : [],
    outlineLines: options.outlineVisible ? createOutlineLines(options) : [],
  };
}

/** 创建单体 Entity 使用的火力范围几何。 */
export function createFireRangeEntityGeometry(options: FireRangeEffectResolvedOptions): FireRangeEntityGeometrySpec {
  const matrix = createLocalFrame(options);
  const sampled = {
    ...options,
    horiPointNum: Math.min(options.horiPointNum, ENTITY_MAX_HORI_SEGMENTS),
    vertPointNum: Math.min(options.vertPointNum, ENTITY_MAX_VERT_SEGMENTS),
    radialPointNum: Math.min(options.radialPointNum, ENTITY_MAX_RADIAL_SEGMENTS),
  };
  const localLines = [
    ...(options.gridVisible ? createFarWallGridLines(options) : []),
    ...(options.outlineVisible ? createOutlineLines(options) : []),
  ];

  return {
    faces: options.fillVisible ? createEntitySurfaceFaces(sampled, matrix) : [],
    lines: localLines.map((line) => ({
      positions: line.positions.map((point) => localToWorld(point, matrix)),
      color: line.color,
      width: line.width,
    })),
  };
}

function createSurfaceMesh(options: FireRangeEffectResolvedOptions): FireRangeSurfaceMesh {
  const mesh: FireRangeSurfaceMesh = { positions: [], st: [], indices: [] };

  appendGridSurface(
    mesh,
    options.vertPointNum,
    options.horiPointNum,
    (row, col) => {
      const verticalRatio = row / options.vertPointNum;
      const horizontalRatio = col / options.horiPointNum;
      return {
        point: farWallPoint(options, horizontalRatio, verticalRatio),
        radialRatio: 1,
        verticalRatio,
      };
    },
  );

  appendFanSurface(mesh, options, 0);
  appendFanSurface(mesh, options, 1);
  appendSideSurface(mesh, options, 0);
  appendSideSurface(mesh, options, 1);

  return mesh;
}

function createEntitySurfaceFaces(
  options: FireRangeEffectResolvedOptions,
  matrix: Cesium.Matrix4,
): FireRangeFaceSpec[] {
  const faces: FireRangeFaceSpec[] = [];
  const fillColor = applyAlpha(options.middleColor, options.fillAlpha);
  appendEntityGridFaces(
    faces,
    options.vertPointNum,
    options.horiPointNum,
    fillColor,
    (row, col) => farWallPoint(options, col / options.horiPointNum, row / options.vertPointNum),
    matrix,
  );
  appendEntityGridFaces(
    faces,
    options.radialPointNum,
    options.horiPointNum,
    fillColor,
    (row, col) =>
      scaledFarWallPoint(options, col / options.horiPointNum, 0, row / options.radialPointNum),
    matrix,
  );
  appendEntityGridFaces(
    faces,
    options.radialPointNum,
    options.horiPointNum,
    fillColor,
    (row, col) =>
      scaledFarWallPoint(options, col / options.horiPointNum, 1, row / options.radialPointNum),
    matrix,
  );
  appendEntityGridFaces(
    faces,
    options.radialPointNum,
    options.vertPointNum,
    fillColor,
    (row, col) =>
      scaledFarWallPoint(options, 0, col / options.vertPointNum, row / options.radialPointNum),
    matrix,
  );
  appendEntityGridFaces(
    faces,
    options.radialPointNum,
    options.vertPointNum,
    fillColor,
    (row, col) =>
      scaledFarWallPoint(options, 1, col / options.vertPointNum, row / options.radialPointNum),
    matrix,
  );
  return faces;
}

function appendEntityGridFaces(
  faces: FireRangeFaceSpec[],
  rowSegments: number,
  colSegments: number,
  color: Cesium.Color,
  getPoint: (row: number, col: number) => LocalPoint,
  matrix: Cesium.Matrix4,
): void {
  const faceColor = Cesium.Color.clone(color);
  for (let row = 0; row < rowSegments; row += 1) {
    for (let col = 0; col < colSegments; col += 1) {
      faces.push({
        positions: [
          localToWorld(getPoint(row, col), matrix),
          localToWorld(getPoint(row, col + 1), matrix),
          localToWorld(getPoint(row + 1, col + 1), matrix),
          localToWorld(getPoint(row + 1, col), matrix),
        ],
        color: faceColor,
      });
    }
  }
}

function appendFanSurface(
  mesh: FireRangeSurfaceMesh,
  options: FireRangeEffectResolvedOptions,
  verticalRatio: number,
): void {
  appendGridSurface(
    mesh,
    options.radialPointNum,
    options.horiPointNum,
    (row, col) => {
      const radialRatio = row / options.radialPointNum;
      const horizontalRatio = col / options.horiPointNum;
      return {
        point: scaledFarWallPoint(options, horizontalRatio, verticalRatio, radialRatio),
        radialRatio,
        verticalRatio,
      };
    },
  );
}

function appendSideSurface(
  mesh: FireRangeSurfaceMesh,
  options: FireRangeEffectResolvedOptions,
  horizontalRatio: number,
): void {
  appendGridSurface(
    mesh,
    options.radialPointNum,
    options.vertPointNum,
    (row, col) => {
      const radialRatio = row / options.radialPointNum;
      const verticalRatio = col / options.vertPointNum;
      return {
        point: scaledFarWallPoint(options, horizontalRatio, verticalRatio, radialRatio),
        radialRatio,
        verticalRatio,
      };
    },
  );
}

function appendGridSurface(
  mesh: FireRangeSurfaceMesh,
  rowSegments: number,
  colSegments: number,
  getVertex: (row: number, col: number) => SurfaceVertex,
): void {
  const baseIndex = mesh.positions.length;
  for (let row = 0; row <= rowSegments; row += 1) {
    for (let col = 0; col <= colSegments; col += 1) {
      const vertex = getVertex(row, col);
      mesh.positions.push(vertex.point);
      mesh.st.push(vertex.radialRatio, vertex.verticalRatio);
    }
  }

  const stride = colSegments + 1;
  for (let row = 0; row < rowSegments; row += 1) {
    for (let col = 0; col < colSegments; col += 1) {
      const a = baseIndex + row * stride + col;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      mesh.indices.push(a, b, c, a, c, d);
    }
  }
}

function createFarWallGridLines(options: FireRangeEffectResolvedOptions): FireRangeLineSpec[] {
  const lines: FireRangeLineSpec[] = [];
  const horizontalIndices = steppedIndices(options.horiPointNum, options.gridHoriStep);
  const verticalIndices = steppedIndices(options.vertPointNum, options.gridVertStep);

  verticalIndices.forEach((rowIndex) => {
    const verticalRatio = rowIndex / options.vertPointNum;
    lines.push({
      positions: Array.from({ length: options.horiPointNum + 1 }, (_, col) =>
        farWallPoint(options, col / options.horiPointNum, verticalRatio),
      ),
      color: options.gridColor,
      width: options.gridLineWidth,
    });
  });

  horizontalIndices.forEach((colIndex) => {
    const horizontalRatio = colIndex / options.horiPointNum;
    lines.push({
      positions: Array.from({ length: options.vertPointNum + 1 }, (_, row) =>
        farWallPoint(options, horizontalRatio, row / options.vertPointNum),
      ),
      color: options.gridColor,
      width: options.gridLineWidth,
    });
  });

  return lines;
}

function createOutlineLines(options: FireRangeEffectResolvedOptions): FireRangeLineSpec[] {
  const apex: LocalPoint = [0, 0, 0];
  const farWallCorners = [
    farWallPoint(options, 0, 0),
    farWallPoint(options, 1, 0),
    farWallPoint(options, 0, 1),
    farWallPoint(options, 1, 1),
  ];

  return [
    createFarWallArcLine(options, 0),
    createFarWallArcLine(options, 1),
    createFarWallVerticalLine(options, 0),
    createFarWallVerticalLine(options, 1),
    ...farWallCorners.map((corner) => ({
      positions: [apex, corner],
      color: options.outlineColor,
      width: options.outlineLineWidth,
    })),
  ];
}

function createFarWallArcLine(options: FireRangeEffectResolvedOptions, verticalRatio: number): FireRangeLineSpec {
  return {
    positions: Array.from({ length: options.horiPointNum + 1 }, (_, index) =>
      farWallPoint(options, index / options.horiPointNum, verticalRatio),
    ),
    color: options.outlineColor,
    width: options.outlineLineWidth,
  };
}

function createFarWallVerticalLine(options: FireRangeEffectResolvedOptions, horizontalRatio: number): FireRangeLineSpec {
  return {
    positions: Array.from({ length: options.vertPointNum + 1 }, (_, index) =>
      farWallPoint(options, horizontalRatio, index / options.vertPointNum),
    ),
    color: options.outlineColor,
    width: options.outlineLineWidth,
  };
}

function scaledFarWallPoint(
  options: FireRangeEffectResolvedOptions,
  horizontalRatio: number,
  verticalRatio: number,
  radialRatio: number,
): LocalPoint {
  const point = farWallPoint(options, horizontalRatio, verticalRatio);
  return [point[0] * radialRatio, point[1] * radialRatio, point[2] * radialRatio];
}

function farWallPoint(
  options: FireRangeEffectResolvedOptions,
  horizontalRatio: number,
  verticalRatio: number,
): LocalPoint {
  const heading = Cesium.Math.toRadians(lerp(options.minHoriAngle, options.maxHoriAngle, horizontalRatio));
  const polar = Cesium.Math.toRadians(lerp(options.minVertAngle, options.maxVertAngle, verticalRatio));
  const horizontalRadius = options.radius * Math.sin(polar);
  return [
    Math.cos(heading) * horizontalRadius,
    Math.sin(heading) * horizontalRadius,
    options.radius * Math.cos(polar),
  ];
}

function steppedIndices(maxIndex: number, step: number): number[] {
  const indices: number[] = [];
  const safeStep = Math.max(1, Math.floor(step));
  for (let index = 0; index <= maxIndex; index += safeStep) {
    indices.push(index);
  }
  if (indices[indices.length - 1] !== maxIndex) indices.push(maxIndex);
  return indices;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function applyAlpha(color: Cesium.Color, alpha: number): Cesium.Color {
  const next = Cesium.Color.clone(color);
  next.alpha *= alpha;
  return next;
}
