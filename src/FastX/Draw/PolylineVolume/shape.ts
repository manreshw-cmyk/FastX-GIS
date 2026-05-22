/**
 * 折线体横截面形状工具库 (TypeScript)
 *
 * 所有方法返回 Cartesian2 数组，用于 Cesium 的 PolylineVolumeGraphics.shape 属性
 * 返回值格式：Cartesian2[]，数组最后一个元素通常是第一个点的副本，确保形状闭合
 *
 * 使用示例：
 * import { createCircleShape, createHexagonShape, createStarShape } from './polylineVolumeShapes'
 * const circleShape = createCircleShape(3.0)
 * const hexagonShape = createHexagonShape(2.5)
 * const starShape = createStarShape(3.0, 1.5)
 */

import * as Cesium from "cesium";

/**
 * 形状顶点数组类型
 */
export type ShapeVertices = Cesium.Cartesian2[];

/**
 * 创建圆形横截面
 * @param radius - 圆的半径（单位：米）
 * @param segments - 分段数，数值越大圆越平滑（推荐 16-64），默认 32
 * @returns 圆形顶点数组
 * @example
 * const circle = createCircleShape(3.0)
 * const smoothCircle = createCircleShape(3.0, 64)
 */
export function createCircleShape(
  radius: number,
  segments: number = 32,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }
  return vertices;
}

/**
 * 创建椭圆形横截面
 * @param radiusX - X轴半径（单位：米）
 * @param radiusY - Y轴半径（单位：米）
 * @param segments - 分段数，默认 32
 * @returns 椭圆形顶点数组
 * @example
 * const ellipse = createEllipseShape(4.0, 2.0)
 */
export function createEllipseShape(
  radiusX: number,
  radiusY: number,
  segments: number = 32,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = radiusX * Math.cos(angle);
    const y = radiusY * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }
  return vertices;
}

/**
 * 创建正六边形横截面
 * @param radius - 外接圆半径（单位：米）
 * @param pointUp - true: 一个角朝上；false: 一条边朝上，默认 true
 * @returns 六边形顶点数组
 * @example
 * const hexagonPointUp = createHexagonShape(3.0)      // 角朝上
 * const hexagonFlatTop = createHexagonShape(3.0, false) // 边朝上
 */
export function createHexagonShape(
  radius: number,
  pointUp: boolean = true,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  const startAngle = pointUp ? -Math.PI / 2 : 0;
  for (let i = 0; i < 6; i++) {
    const angle = startAngle + (i / 6) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }
  vertices.push(vertices[0]); // 闭合
  return vertices;
}

/**
 * 创建正八边形横截面
 * @param radius - 外接圆半径（单位：米）
 * @param pointUp - true: 一个角朝上；false: 一条边朝上，默认 true
 * @returns 八边形顶点数组
 * @example
 * const octagon = createOctagonShape(3.0)
 */
export function createOctagonShape(
  radius: number,
  pointUp: boolean = true,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  const startAngle = pointUp ? -Math.PI / 8 : 0;
  for (let i = 0; i < 8; i++) {
    const angle = startAngle + (i / 8) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }
  vertices.push(vertices[0]);
  return vertices;
}

/**
 * 创建矩形/方形横截面
 * @param width - 宽度（X轴方向，单位：米）
 * @param height - 高度（Y轴方向，单位：米）
 * @returns 矩形顶点数组
 * @example
 * const rectangle = createRectangleShape(4.0, 2.0)
 */
export function createRectangleShape(
  width: number,
  height: number,
): ShapeVertices {
  return [
    new Cesium.Cartesian2(-width / 2, -height / 2),
    new Cesium.Cartesian2(width / 2, -height / 2),
    new Cesium.Cartesian2(width / 2, height / 2),
    new Cesium.Cartesian2(-width / 2, height / 2),
    new Cesium.Cartesian2(-width / 2, -height / 2), // 闭合
  ];
}

/**
 * 创建正方形横截面（矩形特例）
 * @param size - 边长（单位：米）
 * @returns 正方形顶点数组
 * @example
 * const square = createSquareShape(3.0)
 */
export function createSquareShape(size: number): ShapeVertices {
  return createRectangleShape(size, size);
}

/**
 * 创建菱形横截面（旋转45°的正方形）
 * @param diagonalX - X轴对角线长度（单位：米）
 * @param diagonalY - Y轴对角线长度（单位：米）
 * @returns 菱形顶点数组
 * @example
 * const diamond = createDiamondShape(4.0, 3.0)
 */
export function createDiamondShape(
  diagonalX: number,
  diagonalY: number,
): ShapeVertices {
  return [
    new Cesium.Cartesian2(0, -diagonalY / 2),
    new Cesium.Cartesian2(diagonalX / 2, 0),
    new Cesium.Cartesian2(0, diagonalY / 2),
    new Cesium.Cartesian2(-diagonalX / 2, 0),
    new Cesium.Cartesian2(0, -diagonalY / 2),
  ];
}

/**
 * 创建正三角形横截面（等边三角形）
 * @param radius - 外接圆半径（单位：米）
 * @param pointUp - true: 一个角朝上；false: 一条边朝上，默认 true
 * @returns 三角形顶点数组
 * @example
 * const triangle = createTriangleShape(3.0)
 */
export function createTriangleShape(
  radius: number,
  pointUp: boolean = true,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  const startAngle = pointUp ? -Math.PI / 2 : Math.PI / 6;
  for (let i = 0; i < 3; i++) {
    const angle = startAngle + (i / 3) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }
  vertices.push(vertices[0]);
  return vertices;
}

/**
 * 创建五角星形横截面
 * @param outerRadius - 外顶点半径（单位：米）
 * @param innerRadius - 内凹点半径（单位：米）
 * @returns 星形顶点数组
 * @example
 * const star = createStarShape(3.0, 1.5)
 */
export function createStarShape(
  outerRadius: number,
  innerRadius: number,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }
  vertices.push(vertices[0]);
  return vertices;
}

/**
 * 创建十字形横截面
 * @param armWidth - 臂宽（单位：米）
 * @param armLength - 臂长（单位：米）
 * @returns 十字形顶点数组
 * @example
 * const cross = createCrossShape(1.0, 4.0)
 */
export function createCrossShape(
  armWidth: number,
  armLength: number,
): ShapeVertices {
  const w = armWidth / 2;
  const l = armLength / 2;
  return [
    new Cesium.Cartesian2(-w, -l),
    new Cesium.Cartesian2(w, -l),
    new Cesium.Cartesian2(w, -w),
    new Cesium.Cartesian2(l, -w),
    new Cesium.Cartesian2(l, w),
    new Cesium.Cartesian2(w, w),
    new Cesium.Cartesian2(w, l),
    new Cesium.Cartesian2(-w, l),
    new Cesium.Cartesian2(-w, w),
    new Cesium.Cartesian2(-l, w),
    new Cesium.Cartesian2(-l, -w),
    new Cesium.Cartesian2(-w, -w),
    new Cesium.Cartesian2(-w, -l),
  ];
}

/**
 * 胶囊形横截面参数接口
 */
export interface CapsuleShapeOptions {
  width: number; // 总宽度（单位：米）
  height: number; // 总高度（单位：米）
  segments?: number; // 半圆的分段数，默认 16
}

/**
 * 创建胶囊形横截面（两端半圆 + 矩形中部）
 * @param width - 总宽度（单位：米）
 * @param height - 总高度（单位：米）
 * @param segments - 半圆的分段数，默认 16
 * @returns 胶囊形顶点数组
 * @example
 * const capsule = createCapsuleShape(6.0, 2.0)
 * const smoothCapsule = createCapsuleShape(6.0, 2.0, 32)
 */
export function createCapsuleShape(
  width: number,
  height: number,
  segments: number = 16,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];
  const radius = height / 2;
  const halfWidth = width / 2 - radius;

  if (halfWidth <= 0) {
    // 如果宽度不足，退化为圆形
    return createCircleShape(radius, segments);
  }

  // 右侧半圆（从 -90° 到 90°）
  for (let i = 0; i <= segments; i++) {
    const angle = -Math.PI / 2 + (i / segments) * Math.PI;
    const x = halfWidth + radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }

  // 左侧半圆（从 90° 到 270°）
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI / 2 + (i / segments) * Math.PI;
    const x = -halfWidth + radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }

  vertices.push(vertices[0]);
  return vertices;
}

/**
 * 工字形横截面参数接口
 */
export interface IShapeOptions {
  width: number; // 总宽度（单位：米）
  height: number; // 总高度（单位：米）
  flangeWidth: number; // 翼缘宽度（单位：米）
}

/**
 * 创建工字形横截面 (I-beam)
 * @param width - 总宽度（单位：米）
 * @param height - 总高度（单位：米）
 * @param flangeWidth - 翼缘宽度（单位：米）
 * @returns 工字形顶点数组
 * @example
 * const iShape = createIShape(4.0, 6.0, 1.5)
 */
export function createIShape(
  width: number,
  height: number,
  flangeWidth: number,
): ShapeVertices {
  const w = width / 2;
  const h = height / 2;
  const fw = flangeWidth / 2;

  return [
    new Cesium.Cartesian2(-fw, -h),
    new Cesium.Cartesian2(fw, -h),
    new Cesium.Cartesian2(fw, -h + fw),
    new Cesium.Cartesian2(w, -h + fw),
    new Cesium.Cartesian2(w, -h + fw * 2),
    new Cesium.Cartesian2(fw, -h + fw * 2),
    new Cesium.Cartesian2(fw, h - fw * 2),
    new Cesium.Cartesian2(w, h - fw * 2),
    new Cesium.Cartesian2(w, h - fw),
    new Cesium.Cartesian2(fw, h - fw),
    new Cesium.Cartesian2(fw, h),
    new Cesium.Cartesian2(-fw, h),
    new Cesium.Cartesian2(-fw, h - fw),
    new Cesium.Cartesian2(-w, h - fw),
    new Cesium.Cartesian2(-w, h - fw * 2),
    new Cesium.Cartesian2(-fw, h - fw * 2),
    new Cesium.Cartesian2(-fw, -h + fw * 2),
    new Cesium.Cartesian2(-w, -h + fw * 2),
    new Cesium.Cartesian2(-w, -h + fw),
    new Cesium.Cartesian2(-fw, -h + fw),
    new Cesium.Cartesian2(-fw, -h),
  ];
}

/**
 * L形横截面参数接口
 */
export interface LShapeOptions {
  width: number; // 总宽度（X轴方向，单位：米）
  height: number; // 总高度（Y轴方向，单位：米）
  thickness: number; // 臂厚（单位：米）
}

/**
 * 创建 L 形横截面
 * @param width - 总宽度（X轴方向，单位：米）
 * @param height - 总高度（Y轴方向，单位：米）
 * @param thickness - 臂厚（单位：米）
 * @returns L形顶点数组
 * @example
 * const lShape = createLShape(4.0, 4.0, 1.0)
 */
export function createLShape(
  width: number,
  height: number,
  thickness: number,
): ShapeVertices {
  const w = width / 2;
  const h = height / 2;
  const t = thickness;

  return [
    new Cesium.Cartesian2(-w, -h),
    new Cesium.Cartesian2(-w + t, -h),
    new Cesium.Cartesian2(-w + t, h - t),
    new Cesium.Cartesian2(w, h - t),
    new Cesium.Cartesian2(w, h),
    new Cesium.Cartesian2(-w, h),
    new Cesium.Cartesian2(-w, -h),
  ];
}

/**
 * 圆环形横截面参数接口
 */
export interface RingShapeOptions {
  outerRadius: number; // 外圆半径（单位：米）
  innerRadius: number; // 内圆半径（单位：米，必须小于 outerRadius）
  segments?: number; // 分段数，默认 32
}

/**
 * 创建圆环/环形横截面
 * @param outerRadius - 外圆半径（单位：米）
 * @param innerRadius - 内圆半径（单位：米，必须小于 outerRadius）
 * @param segments - 分段数，默认 32
 * @returns 环形顶点数组（外圆逆时针 + 内圆顺时针）
 * @note 注意：Cesium 的 PolylineVolume 本身不支持挖孔，此形状渲染为外圆轮廓+内圆轮廓叠加
 * @example
 * const ring = createRingShape(5.0, 3.0)
 */
export function createRingShape(
  outerRadius: number,
  innerRadius: number,
  segments: number = 32,
): ShapeVertices {
  const vertices: Cesium.Cartesian2[] = [];

  // 外圆（逆时针）
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = outerRadius * Math.cos(angle);
    const y = outerRadius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }

  // 内圆（顺时针，用于挖孔效果）
  for (let i = segments; i >= 0; i--) {
    const angle = (i / segments) * Math.PI * 2;
    const x = innerRadius * Math.cos(angle);
    const y = innerRadius * Math.sin(angle);
    vertices.push(new Cesium.Cartesian2(x, y));
  }

  vertices.push(vertices[0]);
  return vertices;
}

/**
 * 多边形横截面参数接口
 */
export interface PolygonShapeOptions {
  points: Array<{ x: number; y: number }>; // 多边形顶点坐标数组
}

/**
 * 创建自定义多边形横截面
 * @param points - 多边形顶点坐标数组（相对于中心点，单位：米）
 * @returns 多边形顶点数组
 * @example
 * const customPolygon = createPolygonShape([
 *   { x: -2, y: -1 },
 *   { x: 2, y: -1 },
 *   { x: 1, y: 1 },
 *   { x: -1, y: 1 }
 * ])
 */
export function createPolygonShape(
  points: Array<{ x: number; y: number }>,
): ShapeVertices {
  if (points.length < 3) {
    throw new Error("多边形至少需要3个顶点");
  }
  const vertices = points.map((p) => new Cesium.Cartesian2(p.x, p.y));
  // 闭合形状
  vertices.push(vertices[0]);
  return vertices;
}

/**
 * 形状类型枚举
 */
export enum ShapeType {
  CIRCLE = "circle",
  ELLIPSE = "ellipse",
  HEXAGON = "hexagon",
  OCTAGON = "octagon",
  RECTANGLE = "rectangle",
  SQUARE = "square",
  DIAMOND = "diamond",
  TRIANGLE = "triangle",
  STAR = "star",
  CROSS = "cross",
  CAPSULE = "capsule",
  I_SHAPE = "iShape",
  L_SHAPE = "lShape",
  RING = "ring",
}

/**
 * 形状参数联合类型
 */
export type ShapeParams =
  | { type: ShapeType.CIRCLE; radius: number; segments?: number }
  | {
      type: ShapeType.ELLIPSE;
      radiusX: number;
      radiusY: number;
      segments?: number;
    }
  | { type: ShapeType.HEXAGON; radius: number; pointUp?: boolean }
  | { type: ShapeType.OCTAGON; radius: number; pointUp?: boolean }
  | { type: ShapeType.RECTANGLE; width: number; height: number }
  | { type: ShapeType.SQUARE; size: number }
  | { type: ShapeType.DIAMOND; diagonalX: number; diagonalY: number }
  | { type: ShapeType.TRIANGLE; radius: number; pointUp?: boolean }
  | { type: ShapeType.STAR; outerRadius: number; innerRadius: number }
  | { type: ShapeType.CROSS; armWidth: number; armLength: number }
  | {
      type: ShapeType.CAPSULE;
      width: number;
      height: number;
      segments?: number;
    }
  | {
      type: ShapeType.I_SHAPE;
      width: number;
      height: number;
      flangeWidth: number;
    }
  | {
      type: ShapeType.L_SHAPE;
      width: number;
      height: number;
      thickness: number;
    }
  | {
      type: ShapeType.RING;
      outerRadius: number;
      innerRadius: number;
      segments?: number;
    };

/**
 * 根据类型参数创建形状（工厂方法）
 * @param params - 形状参数对象
 * @returns 形状顶点数组
 * @example
 * const circle = createShape({ type: ShapeType.CIRCLE, radius: 3.0 })
 * const hexagon = createShape({ type: ShapeType.HEXAGON, radius: 2.5, pointUp: true })
 */
export function createShape(params: ShapeParams): ShapeVertices {
  switch (params.type) {
    case ShapeType.CIRCLE:
      return createCircleShape(params.radius, params.segments);
    case ShapeType.ELLIPSE:
      return createEllipseShape(
        params.radiusX,
        params.radiusY,
        params.segments,
      );
    case ShapeType.HEXAGON:
      return createHexagonShape(params.radius, params.pointUp);
    case ShapeType.OCTAGON:
      return createOctagonShape(params.radius, params.pointUp);
    case ShapeType.RECTANGLE:
      return createRectangleShape(params.width, params.height);
    case ShapeType.SQUARE:
      return createSquareShape(params.size);
    case ShapeType.DIAMOND:
      return createDiamondShape(params.diagonalX, params.diagonalY);
    case ShapeType.TRIANGLE:
      return createTriangleShape(params.radius, params.pointUp);
    case ShapeType.STAR:
      return createStarShape(params.outerRadius, params.innerRadius);
    case ShapeType.CROSS:
      return createCrossShape(params.armWidth, params.armLength);
    case ShapeType.CAPSULE:
      return createCapsuleShape(params.width, params.height, params.segments);
    case ShapeType.I_SHAPE:
      return createIShape(params.width, params.height, params.flangeWidth);
    case ShapeType.L_SHAPE:
      return createLShape(params.width, params.height, params.thickness);
    case ShapeType.RING:
      return createRingShape(
        params.outerRadius,
        params.innerRadius,
        params.segments,
      );
    default:
      throw new Error(`不支持的形状类型: ${params}`);
  }
}
