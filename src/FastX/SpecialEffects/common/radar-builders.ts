/**
 * SpecialEffects 雷达、视锥和范围类特效几何规格。
 * 这些方法只负责生成面片和线框，不直接操作 Viewer，便于 Entity 和 Primitive 共用。
 */
import * as Cesium from "cesium";
import {
  EffectRenderSpec,
  ResolvedSpatialEffectOptions,
  closeLine,
  createCircleLocalPoints,
  createLocalFrame,
  createParaboloidGrid,
  createRectangleLocalPoints,
  createSectorLocalPoints,
  createSphericalGrid,
  gridToFaces,
  gridToLines,
  localPointsToWorld,
  localToWorld,
} from "./effect-geometry";

/** 空中雷达和普通圆锥参数。 */
export interface ConeLikeSpecOptions extends ResolvedSpatialEffectOptions {
  /** 圆锥高度或探测长度，单位：米。 */
  length: number;
  /** 底部半径，单位：米。 */
  bottomRadius: number;
  /** 内部辅助环半径，单位：米。 */
  innerRadius?: number;
  /** 内部辅助环和连接线颜色；不传时使用 lineColor。 */
  innerLineColor?: Cesium.Color;
  /** 是否填充锥体面。 */
  fill?: boolean;
}

/** 扩散雷达参数。 */
export interface DiffusionRadarSpecOptions extends ResolvedSpatialEffectOptions {
  /** 最大扩散半径，单位：米。 */
  radius: number;
  /** 扇形角度，单位：度。360 表示圆形扩散。 */
  angle: number;
  /** 同时显示的扩散圈数量。 */
  waveCount: number;
}

/** 瞄准特效参数。 */
export interface AimEffectSpecOptions extends ResolvedSpatialEffectOptions {
  /** 瞄准起点。 */
  source: Cesium.Cartesian3;
  /** 瞄准目标点。 */
  target: Cesium.Cartesian3;
  /** 外圈半径，单位：米。 */
  outsideRadius: number;
  /** 内圈半径，单位：米。 */
  insideRadius: number;
}

/** 锥体扫描参数。 */
export interface ConicalScannerSpecOptions extends ResolvedSpatialEffectOptions {
  /** 扫描高度，单位：米。 */
  height: number;
  /** 内半径，单位：米。 */
  innerRadius: number;
  /** 外半径，单位：米。 */
  outerRadius: number;
  /** 扫描扇形角度，单位：度。 */
  angle: number;
}

/** 双面视锥体参数。 */
export interface DoubleFrustumSpecOptions extends ResolvedSpatialEffectOptions {
  /** 近平面距离，单位：米。 */
  near: number;
  /** 远平面距离，单位：米。 */
  far: number;
  /** 垂直视场角，单位：度。 */
  fov: number;
  /** 宽高比。 */
  aspectRatio: number;
}

/** 抛物面雷达参数。 */
export interface ParabolaRadarSpecOptions extends ResolvedSpatialEffectOptions {
  /** 底部半径，单位：米。 */
  radius: number;
  /** 抛物面高度，单位：米。 */
  height: number;
  /** 径向分段数。 */
  radialSegments: number;
}

/** 环锥扫描体参数。 */
export interface RingConeSpecOptions extends ResolvedSpatialEffectOptions {
  /** 探测半径，单位：米。 */
  radius: number;
  /** 最小仰角，单位：度。 */
  minElevationAngle: number;
  /** 最大仰角，单位：度。 */
  maxElevationAngle: number;
}

/** 扫描雷达/火力范围球面扇区参数。 */
export interface SphericalSectorSpecOptions extends ResolvedSpatialEffectOptions {
  /** 探测半径，单位：米。 */
  radius: number;
  /** 最小水平角，单位：度。 */
  minHoriAngle: number;
  /** 最大水平角，单位：度。 */
  maxHoriAngle: number;
  /** 最小垂直角，单位：度。 */
  minVertAngle: number;
  /** 最大垂直角，单位：度。 */
  maxVertAngle: number;
  /** 水平分段数。 */
  horiSegments: number;
  /** 垂直分段数。 */
  vertSegments: number;
  /** 是否显示扫描面。 */
  scanVisible?: boolean;
  /** 扫描面颜色。 */
  scanColor?: Cesium.Color;
}

/** 四方锥体扫描参数。 */
export interface SquareConeSpecOptions extends ResolvedSpatialEffectOptions {
  /** 锥体高度，单位：米。 */
  height: number;
  /** 水平张角，单位：度。 */
  horiAngle: number;
  /** 垂直张角，单位：度。 */
  vertAngle: number;
}

/** 创建空中雷达或圆锥线框/面片。 */
export function buildConeLikeSpec(options: ConeLikeSpecOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const segments = options.segments;
  const apex = localToWorld([0, 0, 0], matrix);
  const base = localPointsToWorld(createCircleLocalPoints(options.bottomRadius, segments, -options.length), matrix);
  const faces = options.fill
    ? base.slice(0, -1).map((point, index) => ({
        positions: [apex, point, base[(index + 1) % (base.length - 1)]!],
        color: options.color,
      }))
    : [];
  const spokeStep = Math.max(1, Math.floor(segments / 12));
  const lines = [
    { positions: base, color: options.lineColor, width: options.lineWidth },
    ...base.slice(0, -1).filter((_, index) => index % spokeStep === 0).map((point) => ({
      positions: [apex, point],
      color: options.lineColor,
      width: options.lineWidth,
    })),
  ];
  if (options.innerRadius && options.innerRadius > 0) {
    const innerRing = localPointsToWorld(createCircleLocalPoints(options.innerRadius, segments, -options.length), matrix);
    lines.push({
      positions: innerRing,
      color: options.innerLineColor ?? options.lineColor,
      width: options.lineWidth,
    });
    const innerLineStep = Math.max(1, Math.floor(segments / 24));
    innerRing.slice(0, -1).forEach((point, index) => {
      if (index % innerLineStep === 0) {
        lines.push({
          positions: [point, base[index]!],
          color: options.innerLineColor ?? options.lineColor,
          width: options.lineWidth,
        });
      }
    });
  }
  return { faces, lines };
}

/** 创建扩散雷达规格。 */
export function buildDiffusionRadarSpec(options: DiffusionRadarSpecOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const isCircle = options.angle >= 359.9;
  const shape = isCircle
    ? localPointsToWorld(createCircleLocalPoints(options.radius, options.segments, 0), matrix)
    : localPointsToWorld(createSectorLocalPoints(options.radius, options.angle, options.segments, 0), matrix);
  const faces = [{ positions: isCircle ? shape.slice(0, -1) : shape, color: options.color }];
  const lines = [
    { positions: isCircle ? shape : closeLine([...shape]), color: options.lineColor, width: options.lineWidth },
  ];
  for (let i = 1; i <= options.waveCount; i += 1) {
    const radius = (options.radius * i) / options.waveCount;
    const points = isCircle
      ? localPointsToWorld(createCircleLocalPoints(radius, options.segments, 0), matrix)
      : localPointsToWorld(createCircleLocalPoints(radius, options.segments, 0, -options.angle / 2, options.angle / 2), matrix);
    lines.push({ positions: points, color: options.lineColor.withAlpha(Math.max(0.15, 0.7 - i * 0.12)), width: options.lineWidth });
  }
  return { faces, lines };
}

/** 创建瞄准特效规格。 */
export function buildAimEffectSpec(options: AimEffectSpecOptions): EffectRenderSpec {
  const targetFrame = Cesium.Transforms.eastNorthUpToFixedFrame(options.target);
  const outside = localPointsToWorld(createCircleLocalPoints(options.outsideRadius, options.segments, 0), targetFrame);
  const inside = localPointsToWorld(createCircleLocalPoints(options.insideRadius, options.segments, 0), targetFrame);
  const crossSize = options.outsideRadius;
  const cross = [
    localPointsToWorld([[-crossSize, 0, 0], [-options.insideRadius, 0, 0]], targetFrame),
    localPointsToWorld([[options.insideRadius, 0, 0], [crossSize, 0, 0]], targetFrame),
    localPointsToWorld([[0, -crossSize, 0], [0, -options.insideRadius, 0]], targetFrame),
    localPointsToWorld([[0, options.insideRadius, 0], [0, crossSize, 0]], targetFrame),
  ];
  const faces = outside.slice(0, -1).map((point, index) => ({
    positions: [options.source, point, outside[(index + 1) % (outside.length - 1)]!],
    color: options.color,
  }));
  return {
    faces,
    lines: [
      { positions: [options.source, options.target], color: options.color, width: options.lineWidth },
      { positions: outside, color: options.lineColor, width: options.lineWidth },
      { positions: inside, color: options.lineColor, width: options.lineWidth },
      ...cross.map((positions) => ({ positions, color: options.lineColor, width: options.lineWidth })),
    ],
  };
}

/** 创建锥体扫描规格。 */
export function buildConicalScannerSpec(options: ConicalScannerSpecOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const outer = localPointsToWorld(createCircleLocalPoints(options.outerRadius, options.segments, 0, -options.angle / 2, options.angle / 2), matrix);
  const inner = localPointsToWorld(createCircleLocalPoints(options.innerRadius, options.segments, options.height, -options.angle / 2, options.angle / 2), matrix);
  const faces = [];
  for (let i = 0; i < outer.length - 1; i += 1) {
    faces.push({ positions: [inner[i]!, inner[i + 1]!, outer[i + 1]!, outer[i]!], color: options.color });
  }
  const lines = [
    { positions: outer, color: options.lineColor, width: options.lineWidth },
    { positions: inner, color: options.lineColor, width: options.lineWidth },
    { positions: [inner[0]!, outer[0]!], color: options.lineColor, width: options.lineWidth },
    { positions: [inner[inner.length - 1]!, outer[outer.length - 1]!], color: options.lineColor, width: options.lineWidth },
  ];
  return { faces, lines };
}

/** 创建双面视锥体规格。 */
export function buildDoubleFrustumSpec(options: DoubleFrustumSpecOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const nearHeight = Math.tan(Cesium.Math.toRadians(options.fov) / 2) * options.near * 2;
  const nearWidth = nearHeight * options.aspectRatio;
  const farHeight = Math.tan(Cesium.Math.toRadians(options.fov) / 2) * options.far * 2;
  const farWidth = farHeight * options.aspectRatio;
  const near = localPointsToWorld(createRectangleLocalPoints(nearWidth, nearHeight, -options.near), matrix);
  const far = localPointsToWorld(createRectangleLocalPoints(farWidth, farHeight, -options.far), matrix);
  const origin = localToWorld([0, 0, 0], matrix);
  const faces = [
    { positions: near, color: options.color },
    { positions: far, color: options.color },
    ...near.map((point, index) => ({ positions: [origin, point, far[index]!], color: options.color })),
  ];
  const lines = [
    { positions: closeLine([...near]), color: options.lineColor, width: options.lineWidth },
    { positions: closeLine([...far]), color: options.lineColor, width: options.lineWidth },
    ...near.map((point, index) => ({ positions: [point, far[index]!], color: options.lineColor, width: options.lineWidth })),
    ...far.map((point) => ({ positions: [origin, point], color: options.lineColor, width: options.lineWidth })),
  ];
  return { faces, lines };
}

/** 创建抛物面雷达规格。 */
export function buildParabolaRadarSpec(options: ParabolaRadarSpecOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const grid = createParaboloidGrid(options.radius, options.height, options.radialSegments, options.segments, matrix);
  const scan = localPointsToWorld([[0, 0, options.height], [options.radius, 0, 0], [0, 0, 0]], matrix);
  return {
    faces: [...gridToFaces(grid, options.color), { positions: scan, color: Cesium.Color.YELLOW.withAlpha(0.25) }],
    lines: gridToLines(grid, options.lineColor, options.lineWidth, Math.max(1, Math.floor(options.radialSegments / 6)), Math.max(1, Math.floor(options.segments / 16))),
  };
}

/** 创建双圆锥环面扫描体规格。 */
export function buildRingConeSpec(options: RingConeSpecOptions): EffectRenderSpec {
  const grid = createSphericalGrid(
    options.radius,
    0,
    360,
    options.minElevationAngle,
    options.maxElevationAngle,
    options.segments,
    8,
    createLocalFrame(options),
  );
  return {
    faces: gridToFaces(grid, options.color),
    lines: gridToLines(grid, options.lineColor, options.lineWidth, 1, Math.max(1, Math.floor(options.segments / 16))),
  };
}

/** 创建环形雷达规格。 */
export function buildRingRadarSpec(options: RingConeSpecOptions & { innerRadius: number }): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const outer = localPointsToWorld(createCircleLocalPoints(options.radius, options.segments, 0), matrix);
  const inner = localPointsToWorld(createCircleLocalPoints(options.innerRadius, options.segments, 0), matrix);
  const top = localPointsToWorld(createCircleLocalPoints(options.radius * 0.72, options.segments, options.radius * 0.25), matrix);
  const faces = [];
  for (let i = 0; i < outer.length - 1; i += 1) {
    faces.push({ positions: [inner[i]!, inner[i + 1]!, outer[i + 1]!, outer[i]!], color: options.color });
  }
  return {
    faces,
    lines: [
      { positions: outer, color: options.lineColor, width: options.lineWidth },
      { positions: inner, color: options.lineColor, width: options.lineWidth },
      { positions: top, color: options.lineColor, width: options.lineWidth },
    ],
  };
}

/** 创建扫描雷达或火力范围球面扇区规格。 */
export function buildSphericalSectorSpec(options: SphericalSectorSpecOptions): EffectRenderSpec {
  const grid = createSphericalGrid(
    options.radius,
    options.minHoriAngle,
    options.maxHoriAngle,
    options.minVertAngle,
    options.maxVertAngle,
    options.horiSegments,
    options.vertSegments,
    createLocalFrame(options),
  );
  const faces = gridToFaces(grid, options.color);
  const lines = gridToLines(
    grid,
    options.lineColor,
    options.lineWidth,
    Math.max(1, Math.floor(options.vertSegments / 6)),
    Math.max(1, Math.floor(options.horiSegments / 12)),
  );
  if (options.scanVisible !== false) {
    const midHeading = (options.minHoriAngle + options.maxHoriAngle) / 2;
    const scanGrid = createSphericalGrid(
      options.radius,
      midHeading - 0.5,
      midHeading + 0.5,
      options.minVertAngle,
      options.maxVertAngle,
      1,
      options.vertSegments,
      createLocalFrame(options),
    );
    faces.push(...gridToFaces(scanGrid, options.scanColor ?? options.color));
  }
  return { faces, lines };
}

/** 创建四方锥体扫描规格。 */
export function buildSquareConeSpec(options: SquareConeSpecOptions): EffectRenderSpec {
  const matrix = createLocalFrame(options);
  const halfWidth = Math.tan(Cesium.Math.toRadians(options.horiAngle) / 2) * options.height;
  const halfHeight = Math.tan(Cesium.Math.toRadians(options.vertAngle) / 2) * options.height;
  const origin = localToWorld([0, 0, 0], matrix);
  const far = localPointsToWorld(
    [
      [-halfWidth, -halfHeight, -options.height],
      [halfWidth, -halfHeight, -options.height],
      [halfWidth, halfHeight, -options.height],
      [-halfWidth, halfHeight, -options.height],
    ],
    matrix,
  );
  return {
    faces: [
      { positions: far, color: options.color },
      ...far.map((point, index) => ({ positions: [origin, point, far[(index + 1) % far.length]!], color: options.color })),
    ],
    lines: [
      { positions: closeLine([...far]), color: options.lineColor, width: options.lineWidth },
      ...far.map((point) => ({ positions: [origin, point], color: options.lineColor, width: options.lineWidth })),
    ],
  };
}
