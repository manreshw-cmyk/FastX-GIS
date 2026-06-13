/**
 * 单视锥体几何工具。
 * 提供 Entity 面/线绘制和 Primitive 几何绘制共用的视锥体计算方法。
 */
import * as Cesium from "cesium";

/** 单视锥体已解析参数。 */
export interface SingleViewFrustumResolvedOptions {
  /** 视锥体相机位置。 */
  position: Cesium.Cartesian3;
  /** 航向角，单位：度。 */
  heading: number;
  /** 俯仰角，单位：度。 */
  pitch: number;
  /** 翻滚角，单位：度。 */
  roll: number;
  /** 垂直视场角，单位：度。 */
  fov: number;
  /** 近裁剪面距离，单位：米。 */
  near: number;
  /** 远裁剪面距离，单位：米。 */
  far: number;
  /** 宽高比。 */
  aspectRatio: number;
  /** 面填充色。 */
  fillColor: Cesium.Color;
  /** 轮廓线颜色。 */
  outlineColor: Cesium.Color;
  /** 是否显示。 */
  show: boolean;
}

/** 单视锥体 8 个顶点。 */
export interface SingleViewFrustumVertices {
  /** 近裁剪面左上点。 */
  nearTopLeft: Cesium.Cartesian3;
  /** 近裁剪面右上点。 */
  nearTopRight: Cesium.Cartesian3;
  /** 近裁剪面右下点。 */
  nearBottomRight: Cesium.Cartesian3;
  /** 近裁剪面左下点。 */
  nearBottomLeft: Cesium.Cartesian3;
  /** 远裁剪面左上点。 */
  farTopLeft: Cesium.Cartesian3;
  /** 远裁剪面右上点。 */
  farTopRight: Cesium.Cartesian3;
  /** 远裁剪面右下点。 */
  farBottomRight: Cesium.Cartesian3;
  /** 远裁剪面左下点。 */
  farBottomLeft: Cesium.Cartesian3;
}

/** 创建透视视锥体参数。 */
export function createSingleViewFrustum(options: SingleViewFrustumResolvedOptions): Cesium.PerspectiveFrustum {
  return new Cesium.PerspectiveFrustum({
    fov: Cesium.Math.toRadians(options.fov),
    aspectRatio: options.aspectRatio,
    near: options.near,
    far: options.far,
  });
}

/** 根据位置和姿态角创建四元数。 */
export function createSingleViewFrustumOrientation(options: SingleViewFrustumResolvedOptions): Cesium.Quaternion {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(options.heading),
    Cesium.Math.toRadians(options.pitch),
    Cesium.Math.toRadians(options.roll),
  );
  return Cesium.Transforms.headingPitchRollQuaternion(options.position, hpr);
}

/** 创建视锥体填充几何。 */
export function createSingleViewFrustumFillGeometry(options: SingleViewFrustumResolvedOptions): Cesium.FrustumGeometry {
  return new Cesium.FrustumGeometry({
    frustum: createSingleViewFrustum(options),
    origin: options.position,
    orientation: createSingleViewFrustumOrientation(options),
    vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
  });
}

/** 创建视锥体轮廓几何。 */
export function createSingleViewFrustumOutlineGeometry(
  options: SingleViewFrustumResolvedOptions,
): Cesium.FrustumOutlineGeometry {
  return new Cesium.FrustumOutlineGeometry({
    frustum: createSingleViewFrustum(options),
    origin: options.position,
    orientation: createSingleViewFrustumOrientation(options),
  });
}

/** 计算 Entity 绘制需要的视锥体顶点。 */
export function computeSingleViewFrustumVertices(options: SingleViewFrustumResolvedOptions): SingleViewFrustumVertices {
  const orientation = createSingleViewFrustumOrientation(options);
  const rotation = Cesium.Matrix3.fromQuaternion(orientation);
  const right = Cesium.Matrix3.multiplyByVector(rotation, Cesium.Cartesian3.UNIT_X, new Cesium.Cartesian3());
  const up = Cesium.Matrix3.multiplyByVector(rotation, Cesium.Cartesian3.UNIT_Y, new Cesium.Cartesian3());
  const direction = Cesium.Matrix3.multiplyByVector(
    rotation,
    Cesium.Cartesian3.negate(Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );

  const halfNearHeight = Math.tan(Cesium.Math.toRadians(options.fov) / 2) * options.near;
  const halfNearWidth = halfNearHeight * options.aspectRatio;
  const halfFarHeight = Math.tan(Cesium.Math.toRadians(options.fov) / 2) * options.far;
  const halfFarWidth = halfFarHeight * options.aspectRatio;
  const nearCenter = offsetByVector(options.position, direction, options.near);
  const farCenter = offsetByVector(options.position, direction, options.far);

  return {
    nearTopLeft: corner(nearCenter, up, halfNearHeight, right, -halfNearWidth),
    nearTopRight: corner(nearCenter, up, halfNearHeight, right, halfNearWidth),
    nearBottomRight: corner(nearCenter, up, -halfNearHeight, right, halfNearWidth),
    nearBottomLeft: corner(nearCenter, up, -halfNearHeight, right, -halfNearWidth),
    farTopLeft: corner(farCenter, up, halfFarHeight, right, -halfFarWidth),
    farTopRight: corner(farCenter, up, halfFarHeight, right, halfFarWidth),
    farBottomRight: corner(farCenter, up, -halfFarHeight, right, halfFarWidth),
    farBottomLeft: corner(farCenter, up, -halfFarHeight, right, -halfFarWidth),
  };
}

/** 将视锥体顶点按 polygon 面拆分。 */
export function getSingleViewFrustumFaces(vertices: SingleViewFrustumVertices): Cesium.Cartesian3[][] {
  return [
    [vertices.nearTopLeft, vertices.nearTopRight, vertices.nearBottomRight, vertices.nearBottomLeft],
    [vertices.farTopLeft, vertices.farTopRight, vertices.farBottomRight, vertices.farBottomLeft],
    [vertices.nearTopLeft, vertices.nearTopRight, vertices.farTopRight, vertices.farTopLeft],
    [vertices.nearBottomLeft, vertices.nearBottomRight, vertices.farBottomRight, vertices.farBottomLeft],
    [vertices.nearTopLeft, vertices.nearBottomLeft, vertices.farBottomLeft, vertices.farTopLeft],
    [vertices.nearTopRight, vertices.nearBottomRight, vertices.farBottomRight, vertices.farTopRight],
  ];
}

/** 将视锥体顶点按轮廓线拆分。 */
export function getSingleViewFrustumLines(vertices: SingleViewFrustumVertices): Cesium.Cartesian3[][] {
  return [
    [vertices.nearTopLeft, vertices.nearTopRight],
    [vertices.nearTopRight, vertices.nearBottomRight],
    [vertices.nearBottomRight, vertices.nearBottomLeft],
    [vertices.nearBottomLeft, vertices.nearTopLeft],
    [vertices.farTopLeft, vertices.farTopRight],
    [vertices.farTopRight, vertices.farBottomRight],
    [vertices.farBottomRight, vertices.farBottomLeft],
    [vertices.farBottomLeft, vertices.farTopLeft],
    [vertices.nearTopLeft, vertices.farTopLeft],
    [vertices.nearTopRight, vertices.farTopRight],
    [vertices.nearBottomRight, vertices.farBottomRight],
    [vertices.nearBottomLeft, vertices.farBottomLeft],
  ];
}

/** 沿指定方向偏移坐标。 */
function offsetByVector(origin: Cesium.Cartesian3, direction: Cesium.Cartesian3, distance: number): Cesium.Cartesian3 {
  const offset = Cesium.Cartesian3.multiplyByScalar(direction, distance, new Cesium.Cartesian3());
  return Cesium.Cartesian3.add(origin, offset, new Cesium.Cartesian3());
}

/** 根据上下、左右偏移计算裁剪面角点。 */
function corner(
  center: Cesium.Cartesian3,
  up: Cesium.Cartesian3,
  upDistance: number,
  right: Cesium.Cartesian3,
  rightDistance: number,
): Cesium.Cartesian3 {
  const upOffset = Cesium.Cartesian3.multiplyByScalar(up, upDistance, new Cesium.Cartesian3());
  const rightOffset = Cesium.Cartesian3.multiplyByScalar(right, rightDistance, new Cesium.Cartesian3());
  return Cesium.Cartesian3.add(Cesium.Cartesian3.add(center, upOffset, new Cesium.Cartesian3()), rightOffset, new Cesium.Cartesian3());
}
