/**
 * SpecialEffects 空间特效几何构建工具。
 * 统一处理局部坐标转世界坐标、面片拆分、线框拆分和 Cesium 渲染对象创建。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  toCartesian3,
  toCesiumColor,
} from "../shared";

/** 特效姿态角，单位为度。 */
export interface EffectAttitudeOptions {
  /** 航向角，单位：度。 */
  heading?: number;
  /** 俯仰角，单位：度。 */
  pitch?: number;
  /** 翻滚角，单位：度。 */
  roll?: number;
  /** 整体缩放。 */
  scale?: number;
}

/** 空间特效通用参数。 */
export interface SpatialEffectOptions extends EffectAttitudeOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 特效中心点。 */
  position: SpecialEffectsPositionInput;
  /** 填充色。 */
  color?: SpecialEffectsColorInput;
  /** 轮廓线颜色。 */
  lineColor?: SpecialEffectsColorInput;
  /** 线宽，单位：像素。 */
  lineWidth?: number;
  /** 几何分段数，数值越大越圆滑。 */
  segments?: number;
  /** 是否显示。 */
  show?: boolean;
}

/** 已解析的空间特效通用参数。 */
export interface ResolvedSpatialEffectOptions {
  /** 特效中心点。 */
  position: Cesium.Cartesian3;
  /** 航向角，单位：度。 */
  heading: number;
  /** 俯仰角，单位：度。 */
  pitch: number;
  /** 翻滚角，单位：度。 */
  roll: number;
  /** 整体缩放。 */
  scale: number;
  /** 填充色。 */
  color: Cesium.Color;
  /** 轮廓线颜色。 */
  lineColor: Cesium.Color;
  /** 线宽，单位：像素。 */
  lineWidth: number;
  /** 几何分段数。 */
  segments: number;
  /** 是否显示。 */
  show: boolean;
}

/** 渲染面片定义。 */
export interface EffectFaceSpec {
  /** 面片顶点。 */
  positions: Cesium.Cartesian3[];
  /** 面片颜色。 */
  color: Cesium.Color;
}

/** 渲染线定义。 */
export interface EffectLineSpec {
  /** 线顶点。 */
  positions: Cesium.Cartesian3[];
  /** 线颜色。 */
  color: Cesium.Color;
  /** 线宽，单位：像素。 */
  width: number;
}

/** 特效渲染规格。 */
export interface EffectRenderSpec {
  /** 面片集合。 */
  faces: EffectFaceSpec[];
  /** 线集合。 */
  lines: EffectLineSpec[];
}

/** 局部坐标点。 */
export type LocalPoint = readonly [x: number, y: number, z: number];

/** 合并空间特效通用默认参数。 */
export function resolveSpatialOptions(
  options: SpatialEffectOptions,
  fallbackColor: Cesium.Color,
  fallbackLineColor: Cesium.Color,
): ResolvedSpatialEffectOptions {
  return {
    position: toCartesian3(options.position),
    heading: options.heading ?? 0,
    pitch: options.pitch ?? 0,
    roll: options.roll ?? 0,
    scale: options.scale ?? 1,
    color: toCesiumColor(options.color, fallbackColor),
    lineColor: toCesiumColor(options.lineColor, fallbackLineColor),
    lineWidth: options.lineWidth ?? 1,
    segments: Math.max(8, Math.floor(options.segments ?? 96)),
    show: options.show ?? true,
  };
}

/** 与 buildConeLikeSpec 一致：Entity 锥轴沿局部 -Z（CylinderGraphics 默认沿 +Z）。 */
export function createConeEntityOrientation(
  position: Cesium.Cartesian3,
  attitude: Pick<EffectAttitudeOptions, "heading" | "pitch" | "roll">,
): Cesium.Quaternion {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(attitude.heading ?? 0),
    Cesium.Math.toRadians(attitude.pitch ?? 0),
    Cesium.Math.toRadians(attitude.roll ?? 0),
  );
  const world = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
  const cylinderToConeAxis = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, Math.PI, new Cesium.Quaternion());
  return Cesium.Quaternion.multiply(world, cylinderToConeAxis, new Cesium.Quaternion());
}

/** 创建局部坐标到世界坐标的转换矩阵。 */
export function createLocalFrame(options: Pick<ResolvedSpatialEffectOptions, "position" | "heading" | "pitch" | "roll" | "scale">): Cesium.Matrix4 {
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(options.position);
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(options.heading),
    Cesium.Math.toRadians(options.pitch),
    Cesium.Math.toRadians(options.roll),
  );
  const rotation = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromHeadingPitchRoll(hpr));
  const scale = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(options.scale, options.scale, options.scale));
  return Cesium.Matrix4.multiply(
    frame,
    Cesium.Matrix4.multiply(rotation, scale, new Cesium.Matrix4()),
    new Cesium.Matrix4(),
  );
}

/** 将局部坐标点转换为世界坐标点。 */
export function localToWorld(point: LocalPoint, matrix: Cesium.Matrix4): Cesium.Cartesian3 {
  return Cesium.Matrix4.multiplyByPoint(
    matrix,
    new Cesium.Cartesian3(point[0], point[1], point[2]),
    new Cesium.Cartesian3(),
  );
}

/** 将局部坐标点集合转换为世界坐标点集合。 */
export function localPointsToWorld(points: readonly LocalPoint[], matrix: Cesium.Matrix4): Cesium.Cartesian3[] {
  return points.map((point) => localToWorld(point, matrix));
}

/** 创建圆环局部点。 */
export function createCircleLocalPoints(
  radius: number,
  segments: number,
  z = 0,
  startDeg = 0,
  endDeg = 360,
): LocalPoint[] {
  const points: LocalPoint[] = [];
  const total = Math.max(2, segments);
  const start = Cesium.Math.toRadians(startDeg);
  const end = Cesium.Math.toRadians(endDeg);
  for (let i = 0; i <= total; i += 1) {
    const angle = start + ((end - start) * i) / total;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, z]);
  }
  return points;
}

/** 创建扇形局部面顶点。 */
export function createSectorLocalPoints(radius: number, angle: number, segments: number, z = 0): LocalPoint[] {
  const half = angle / 2;
  return [[0, 0, z], ...createCircleLocalPoints(radius, segments, z, -half, half)];
}

/** 创建矩形局部点，中心位于原点。 */
export function createRectangleLocalPoints(width: number, height: number, z: number): LocalPoint[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    [-halfWidth, -halfHeight, z],
    [halfWidth, -halfHeight, z],
    [halfWidth, halfHeight, z],
    [-halfWidth, halfHeight, z],
  ];
}

/** 将面片和线规格转换为 Entity。 */
export function createEntitiesFromSpec(
  viewer: Cesium.Viewer,
  id: string,
  spec: EffectRenderSpec,
  show: boolean,
  name: string,
): Cesium.Entity[] {
  const faces = spec.faces.map((face, index) =>
    viewer.entities.add({
      id: `${id}-face-${index}`,
      name: `${name} Face`,
      show,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(face.positions),
        material: face.color,
        perPositionHeight: true,
      },
    }),
  );
  const lines = spec.lines.map((line, index) =>
    viewer.entities.add({
      id: `${id}-line-${index}`,
      name: `${name} Line`,
      show,
      polyline: {
        positions: line.positions,
        width: line.width,
        material: line.color,
        arcType: Cesium.ArcType.NONE,
      },
    }),
  );
  return [...faces, ...lines];
}

/** 将面片和线规格转换为 Primitive。 */
export function createPrimitivesFromSpec(
  viewer: Cesium.Viewer,
  id: string,
  spec: EffectRenderSpec,
  show: boolean,
): Cesium.Primitive[] {
  const primitives: Cesium.Primitive[] = [];
  const facePrimitive = createFacePrimitive(id, spec.faces, show);
  if (facePrimitive) {
    viewer.scene.primitives.add(facePrimitive);
    primitives.push(facePrimitive);
  }
  const linePrimitive = createLinePrimitive(id, spec.lines, show);
  if (linePrimitive) {
    viewer.scene.primitives.add(linePrimitive);
    primitives.push(linePrimitive);
  }
  return primitives;
}

/** 创建 Primitive 面片。 */
function createFacePrimitive(id: string, faces: EffectFaceSpec[], show: boolean): Cesium.Primitive | undefined {
  const instances = faces
    .filter((face) => face.positions.length >= 3)
    .map((face, index) =>
      new Cesium.GeometryInstance({
        id: `${id}-face-${index}`,
        geometry: createFaceGeometry(face.positions),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(toPrimitiveColor(face.color)),
        },
      }),
    );
  if (!instances.length) return undefined;
  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
      flat: true,
    }),
    asynchronous: false,
    show,
  });
}

/** 创建单个任意空间面片 Primitive。 */
export function createFacePrimitiveFromPositions(
  id: string,
  positions: Cesium.Cartesian3[],
  color: Cesium.Color,
  show: boolean,
): Cesium.Primitive {
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: createFaceGeometry(positions),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(toPrimitiveColor(color)),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
      flat: true,
    }),
    asynchronous: false,
    show,
  });
}

/** 创建局部坐标面片 Primitive，并通过 modelMatrix 放置到世界坐标。 */
export function createFacePrimitiveFromLocalPoints(
  id: string,
  points: readonly LocalPoint[],
  color: Cesium.Color,
  modelMatrix: Cesium.Matrix4,
  show: boolean,
): Cesium.Primitive {
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: createFaceGeometry(points.map((point) => new Cesium.Cartesian3(point[0], point[1], point[2]))),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(toPrimitiveColor(color)),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
      flat: true,
    }),
    asynchronous: false,
    modelMatrix: Cesium.Matrix4.clone(modelMatrix),
    show,
  });
}

/** 创建任意空间面片几何，按扇形三角剖分。 */
/** 创建局部坐标线 Primitive，并通过 modelMatrix 设置到世界坐标。 */
export function createLinePrimitiveFromLocalPoints(
  id: string,
  points: readonly LocalPoint[],
  color: Cesium.Color,
  width: number,
  modelMatrix: Cesium.Matrix4,
  show: boolean,
): Cesium.Primitive {
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: new Cesium.PolylineGeometry({
        positions: points.map((point) => new Cesium.Cartesian3(point[0], point[1], point[2])),
        width,
        arcType: Cesium.ArcType.NONE,
        vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(toPrimitiveColor(color)),
      },
    }),
    appearance: new Cesium.PolylineColorAppearance({
      translucent: true,
    }),
    asynchronous: false,
    modelMatrix: Cesium.Matrix4.clone(modelMatrix),
    show,
  });
}

function createFaceGeometry(positions: Cesium.Cartesian3[]): Cesium.Geometry {
  const values = new Float64Array(positions.length * 3);
  positions.forEach((position, index) => {
    values[index * 3] = position.x;
    values[index * 3 + 1] = position.y;
    values[index * 3 + 2] = position.z;
  });

  const indices: number[] = [];
  for (let index = 1; index < positions.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }

  const attributes = new Cesium.GeometryAttributes();
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values,
  });

  return new Cesium.Geometry({
    attributes,
    indices: positions.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromPoints(positions),
  });
}

/** 创建 Primitive 线框。 */
function createLinePrimitive(id: string, lines: EffectLineSpec[], show: boolean): Cesium.Primitive | undefined {
  const instances = lines
    .filter((line) => line.positions.length >= 2)
    .map((line, index) =>
      new Cesium.GeometryInstance({
        id: `${id}-line-${index}`,
        geometry: new Cesium.PolylineGeometry({
          positions: line.positions,
          width: line.width,
          arcType: Cesium.ArcType.NONE,
          vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(toPrimitiveColor(line.color)),
        },
      }),
    );
  if (!instances.length) return undefined;
  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({
      translucent: true,
    }),
    asynchronous: false,
    show,
  });
}

/** 创建闭合线。 */
export function closeLine<T>(points: T[]): T[] {
  return points.length > 0 ? [...points, points[0]!] : points;
}

/** 规整 Primitive 颜色，避免 Cesium 在读取 red/green/blue/alpha 时遇到空值。 */
function toPrimitiveColor(color: Cesium.Color | undefined): Cesium.Color {
  return color instanceof Cesium.Color ? color : Cesium.Color.WHITE;
}

/** 将连续网格点拆成四边形面片。 */
export function gridToFaces(grid: Cesium.Cartesian3[][], color: Cesium.Color): EffectFaceSpec[] {
  const faces: EffectFaceSpec[] = [];
  for (let row = 0; row < grid.length - 1; row += 1) {
    for (let col = 0; col < grid[row]!.length - 1; col += 1) {
      faces.push({
        positions: [grid[row]![col]!, grid[row]![col + 1]!, grid[row + 1]![col + 1]!, grid[row + 1]![col]!],
        color,
      });
    }
  }
  return faces;
}

/** 将连续网格点拆成经纬方向线。 */
export function gridToLines(
  grid: Cesium.Cartesian3[][],
  color: Cesium.Color,
  width: number,
  rowStep = 1,
  colStep = 1,
): EffectLineSpec[] {
  const lines: EffectLineSpec[] = [];
  for (let row = 0; row < grid.length; row += Math.max(1, rowStep)) {
    lines.push({ positions: grid[row]!, color, width });
  }
  const columnCount = grid[0]?.length ?? 0;
  for (let col = 0; col < columnCount; col += Math.max(1, colStep)) {
    lines.push({ positions: grid.map((row) => row[col]!).filter(Boolean), color, width });
  }
  return lines;
}

/** 在局部坐标中创建球面扇区网格。 */
export function createSphericalGrid(
  radius: number,
  minHeading: number,
  maxHeading: number,
  minElevation: number,
  maxElevation: number,
  headingSegments: number,
  elevationSegments: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[][] {
  const grid: Cesium.Cartesian3[][] = [];
  const headingCount = Math.max(2, headingSegments);
  const elevationCount = Math.max(2, elevationSegments);
  for (let y = 0; y <= elevationCount; y += 1) {
    const elevation = Cesium.Math.toRadians(minElevation + ((maxElevation - minElevation) * y) / elevationCount);
    const row: Cesium.Cartesian3[] = [];
    for (let x = 0; x <= headingCount; x += 1) {
      const heading = Cesium.Math.toRadians(minHeading + ((maxHeading - minHeading) * x) / headingCount);
      const r = radius * Math.cos(elevation);
      row.push(localToWorld([Math.cos(heading) * r, Math.sin(heading) * r, radius * Math.sin(elevation)], matrix));
    }
    grid.push(row);
  }
  return grid;
}

/** 在局部坐标中创建抛物面网格。 */
export function createParaboloidGrid(
  radius: number,
  height: number,
  radialSegments: number,
  angleSegments: number,
  matrix: Cesium.Matrix4,
): Cesium.Cartesian3[][] {
  const grid: Cesium.Cartesian3[][] = [];
  const rows = Math.max(2, radialSegments);
  const columns = Math.max(8, angleSegments);
  for (let row = 0; row <= rows; row += 1) {
    const r = (radius * row) / rows;
    const z = height * (1 - (r / radius) ** 2);
    const points: Cesium.Cartesian3[] = [];
    for (let col = 0; col <= columns; col += 1) {
      const angle = (Cesium.Math.TWO_PI * col) / columns;
      points.push(localToWorld([Math.cos(angle) * r, Math.sin(angle) * r, z], matrix));
    }
    grid.push(points);
  }
  return grid;
}
