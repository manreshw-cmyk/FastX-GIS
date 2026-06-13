/**
 * 多边形扩散墙材质与几何工具。
 * 参考 freexdemo 墙体实现：外部传入多点经纬度，内部闭合后生成 WallGeometry 所需点位与高度数组。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsPositionInput,
  getColorValue,
  registerCesiumMaterial,
  toCartesian3Array,
  toCartographic,
} from "../shared";

type PolygonDiffusionWallGeometryAttributes = Cesium.GeometryAttributes & {
  radialDirection?: Cesium.GeometryAttribute;
  upDirection?: Cesium.GeometryAttribute;
  wallLocal?: Cesium.GeometryAttribute;
};

export type PolygonDiffusionWallAnimatedAppearance = Cesium.MaterialAppearance & {
  uniforms: PolygonDiffusionWallAnimatedAppearanceUniforms;
};

/** 多边形扩散墙自定义材质类型。 */
export const POLYGON_DIFFUSION_WALL_MATERIAL_TYPE = "FastXPolygonDiffusionWallMaterial";

/** 多边形扩散墙材质参数。 */
export interface PolygonDiffusionWallMaterialOptions {
  /** 墙体主色。 */
  color: Cesium.Color;
  /** 一轮向上扩散动画耗时，单位：毫秒。 */
  duration: number;
}

/** 多边形墙体几何参数。 */
export interface PolygonDiffusionWallGeometryOptions {
  /** 多边形底部经纬度点位，至少三个点。 */
  positions?: readonly SpecialEffectsPositionInput[];
  /** 正多边形扩散中心点，用于复刻参考项目的中心点扩散墙。 */
  center?: SpecialEffectsPositionInput;
  /** 正多边形最大扩散半径，单位：米。 */
  radius?: number;
  /** 正多边形边数。 */
  edge?: number;
  /** 扩散速度，参考项目按每帧 radius * speed / 1000 推进。 */
  speed?: number;
  /** 正多边形最小扩散半径，单位：米。 */
  minRadius?: number;
  /** 当前扩散半径，内部动画状态。 */
  currentRadius?: number;
  /** 当前墙体高度，内部动画状态。 */
  currentHeight?: number;
  /** 墙体高度，单位：米，默认 800。 */
  height?: number;
  /** 每个点的底部高度数组，优先级高于点位自带高度。 */
  minimumHeights?: readonly number[];
  /** 每个点的顶部高度数组，优先级高于 height。 */
  maximumHeights?: readonly number[];
}

/** WallGeometry 与 Entity.wall 共用的标准墙体数据。 */
export interface PolygonDiffusionWallGeometryData {
  /** 已闭合的外部点位。 */
  positions: SpecialEffectsPositionInput[];
  /** 已转换的 Cartesian3 点位。 */
  cartesians: Cesium.Cartesian3[];
  /** 底部高度数组。 */
  minimumHeights: number[];
  /** 顶部高度数组。 */
  maximumHeights: number[];
  /** 统一墙高。 */
  height: number;
}

/** 正多边形扩散墙动画状态参数。 */
/** 中心扩散墙 Primitive 使用的 GPU 动画几何数据。 */
export interface PolygonDiffusionWallAnimatedGeometryData {
  /** 静态几何，顶点真实扩散由 shader 根据动画进度计算。 */
  geometry: Cesium.Geometry;
  /** 最大扩散范围的外圈点，用于计算包围球。 */
  boundingPositions: Cesium.Cartesian3[];
}

/** 中心扩散墙 Appearance 每帧读取的动画 uniform。 */
export interface PolygonDiffusionWallAnimatedAppearanceUniforms {
  /** 动画进度，范围 0 到 1。 */
  u_diffusionTime: number;
  /** 最小扩散半径，单位：米。 */
  u_minRadius: number;
  /** 最大扩散半径，单位：米。 */
  u_maxRadius: number;
  /** 最大墙高，单位：米。 */
  u_height: number;
}

export interface PolygonDiffusionWallAnimationOptions {
  /** 正多边形扩散中心点。 */
  center?: SpecialEffectsPositionInput;
  /** 最大扩散半径，单位：米。 */
  radius: number;
  /** 墙体初始高度，单位：米。 */
  height: number;
  /** 扩散速度。 */
  speed: number;
  /** 最小扩散半径，单位：米。 */
  minRadius: number;
  /** 当前扩散半径，单位：米。 */
  currentRadius: number;
  /** 当前墙体高度，单位：米。 */
  currentHeight: number;
}

/** 多边形扩散墙按时间推导出的当前动画状态。 */
export interface PolygonDiffusionWallAnimatedState {
  /** 当前扩散进度，范围 0 到 1。 */
  progress: number;
  /** 当前扩散半径，单位：米。 */
  currentRadius: number;
  /** 当前墙体高度，单位：米。 */
  currentHeight: number;
}

/** 多边形扩散墙动态材质属性，用于 Entity.wall.material。 */
export class PolygonDiffusionWallMaterialProperty implements Cesium.MaterialProperty {
  /** Cesium 材质变更事件。 */
  readonly definitionChanged = new Cesium.Event();
  /** 动态材质每帧都会更新 time uniform。 */
  readonly isConstant = false;
  /** 墙体主色。 */
  color: Cesium.Color;
  /** 动画时长，单位：毫秒。 */
  duration: number;
  /** 动画开始时间戳。 */
  readonly startTime = Date.now();

  constructor(options: PolygonDiffusionWallMaterialOptions) {
    registerPolygonDiffusionWallMaterial();
    this.color = options.color;
    this.duration = options.duration;
  }

  /** 返回 Cesium 材质类型。 */
  getType(_time: Cesium.JulianDate): string {
    return POLYGON_DIFFUSION_WALL_MATERIAL_TYPE;
  }

  /** 返回当前帧材质 uniform。 */
  getValue(time: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    const nextResult = result ?? {};
    nextResult.color = getColorValue(this.color, time, Cesium.Color.YELLOW, nextResult.color as Cesium.Color);
    nextResult.time = getPolygonDiffusionWallTime(this.startTime, this.duration);
    return nextResult;
  }

  /** 判断两个材质属性是否等价。 */
  equals(other?: Cesium.MaterialProperty): boolean {
    return (
      this === other ||
      (other instanceof PolygonDiffusionWallMaterialProperty &&
        Cesium.Color.equals(this.color, other.color) &&
        this.duration === other.duration)
    );
  }
}

/** 注册多边形扩散墙材质，重复调用会被共享工具过滤。 */
export function registerPolygonDiffusionWallMaterial(): void {
  registerCesiumMaterial(
    POLYGON_DIFFUSION_WALL_MATERIAL_TYPE,
    { color: Cesium.Color.YELLOW, time: 0 },
    `
      uniform vec4 color;
      uniform float time;

      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = materialInput.st;
        material.diffuse = color.rgb * 2.0;
        material.alpha = color.a * (1.0 - fract(st.t)) * 0.8;
        return material;
      }
    `,
  );
}

/** 创建 Primitive 使用的多边形扩散墙材质。 */
export function createPolygonDiffusionWallMaterial(options: PolygonDiffusionWallMaterialOptions): Cesium.Material {
  registerPolygonDiffusionWallMaterial();
  return Cesium.Material.fromType(POLYGON_DIFFUSION_WALL_MATERIAL_TYPE, {
    color: Cesium.Color.clone(options.color),
    time: 0,
  });
}

/** 计算多边形扩散墙动画进度，返回 0 到 1 的循环值。 */
/** 创建中心扩散墙 Primitive 使用的自定义 Appearance。 */
export function createPolygonDiffusionWallAnimatedAppearance(
  material: Cesium.Material,
  uniforms: PolygonDiffusionWallAnimatedAppearanceUniforms,
): PolygonDiffusionWallAnimatedAppearance {
  const appearance = new Cesium.MaterialAppearance({
    material,
    faceForward: true,
    translucent: true,
    vertexShaderSource: POLYGON_DIFFUSION_WALL_ANIMATED_VERTEX_SHADER,
    fragmentShaderSource: POLYGON_DIFFUSION_WALL_ANIMATED_FRAGMENT_SHADER,
    renderState: {
      depthTest: { enabled: true },
      depthMask: false,
    },
  }) as PolygonDiffusionWallAnimatedAppearance;
  appearance.uniforms = uniforms;
  return appearance;
}

export function getPolygonDiffusionWallTime(startTime: number, duration: number): number {
  const safeDuration = Math.max(16, duration);
  return ((Date.now() - startTime) % safeDuration) / safeDuration;
}

/** 根据参考项目的每帧推进速度，换算当前连续动画进度。 */
export function getPolygonDiffusionWallAnimationProgress(
  startTime: number,
  options: Pick<PolygonDiffusionWallAnimationOptions, "radius" | "height" | "speed" | "minRadius">,
): number {
  const radiusStep = (options.radius * options.speed) / 1000;
  const heightStep = (options.height * options.speed) / 1000;
  const radiusFrames = radiusStep > 0 ? Math.max(1, (options.radius - options.minRadius) / radiusStep) : 1;
  const heightFrames = heightStep > 0 ? Math.max(1, options.height / heightStep) : 1;
  const cycleFrames = Math.max(1, Math.min(radiusFrames, heightFrames));
  const elapsedFrames = (Date.now() - startTime) / (1000 / 60);
  return (elapsedFrames % cycleFrames) / cycleFrames;
}

/** 计算当前多边形扩散墙半径和高度，避免维护逐帧可变状态。 */
export function getPolygonDiffusionWallAnimatedState(
  startTime: number,
  options: Pick<PolygonDiffusionWallAnimationOptions, "radius" | "height" | "speed" | "minRadius">,
): PolygonDiffusionWallAnimatedState {
  const progress = getPolygonDiffusionWallAnimationProgress(startTime, options);
  return {
    progress,
    currentRadius: Cesium.Math.lerp(options.minRadius, options.radius, progress),
    currentHeight: Cesium.Math.lerp(options.height, 0, progress),
  };
}

/** 标准化墙体几何数据，确保多边形闭合且高度数组长度一致。 */
export function resolvePolygonDiffusionWallGeometry(options: PolygonDiffusionWallGeometryOptions): PolygonDiffusionWallGeometryData {
  if (options.center) {
    const height = options.currentHeight ?? options.height ?? 100;
    const positions = createRegularPolygonPositions(
      options.center,
      options.edge ?? 64,
      options.currentRadius ?? options.minRadius ?? 10,
      height,
    );
    return {
      positions,
      cartesians: positions,
      minimumHeights: new Array(positions.length).fill(0),
      maximumHeights: new Array(positions.length).fill(height),
      height,
    };
  }

  const positions = closePolygonPositions(options.positions ?? []);
  const height = options.height ?? 800;
  return {
    positions,
    cartesians: toCartesian3Array(positions),
    minimumHeights: resolveWallMinimumHeights(positions, options.minimumHeights),
    maximumHeights: resolveWallMaximumHeights(positions, height, options.maximumHeights, options.minimumHeights),
    height,
  };
}

/** 按参考项目逻辑推进正多边形扩散墙的当前半径和高度。 */
/** 创建中心扩散墙的 GPU 动画几何，避免每帧重建 WallGeometry。 */
export function createPolygonDiffusionWallAnimatedGeometry(
  options: PolygonDiffusionWallGeometryOptions,
): PolygonDiffusionWallAnimatedGeometryData {
  const center = options.center;
  if (!center) return createEmptyAnimatedGeometry();

  const edge = Math.max(3, Math.floor(options.edge ?? 64));
  const height = options.height ?? 100;
  const minRadius = Math.max(0, options.minRadius ?? 10);
  const maxRadius = Math.max(minRadius, options.radius ?? 1000);
  const centerCartesian = Cesium.Cartographic.toCartesian(toCartographic(center));
  const localFrame = Cesium.Transforms.eastNorthUpToFixedFrame(centerCartesian);
  const vertexCount = edge * 2;
  const positionValues = new Float64Array(vertexCount * 3);
  const normalValues = new Float32Array(vertexCount * 3);
  const stValues = new Float32Array(vertexCount * 2);
  const radialValues = new Float32Array(vertexCount * 3);
  const upValues = new Float32Array(vertexCount * 3);
  const wallLocalValues = new Float32Array(vertexCount * 2);
  const boundingPositions: Cesium.Cartesian3[] = [];
  const upDirection = Cesium.Matrix4.multiplyByPointAsVector(
    localFrame,
    Cesium.Cartesian3.UNIT_Z,
    new Cesium.Cartesian3(),
  );

  for (let index = 0; index < edge; index += 1) {
    const angle = (index / edge) * Cesium.Math.TWO_PI;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const bottomVertex = index * 2;
    const topVertex = bottomVertex + 1;
    const bottomPosition = localToWorld(localFrame, directionX * minRadius, directionY * minRadius, 0);
    const topPosition = localToWorld(localFrame, directionX * minRadius, directionY * minRadius, height);
    const boundingPosition = localToWorld(localFrame, directionX * maxRadius, directionY * maxRadius, height);
    const radialDirection = Cesium.Matrix4.multiplyByPointAsVector(
      localFrame,
      new Cesium.Cartesian3(directionX, directionY, 0),
      new Cesium.Cartesian3(),
    );

    writeCartesian(positionValues, bottomVertex, bottomPosition);
    writeCartesian(positionValues, topVertex, topPosition);
    writeVec3(normalValues, bottomVertex, radialDirection.x, radialDirection.y, radialDirection.z);
    writeVec3(normalValues, topVertex, radialDirection.x, radialDirection.y, radialDirection.z);
    writeVec3(radialValues, bottomVertex, radialDirection.x, radialDirection.y, radialDirection.z);
    writeVec3(radialValues, topVertex, radialDirection.x, radialDirection.y, radialDirection.z);
    writeVec3(upValues, bottomVertex, upDirection.x, upDirection.y, upDirection.z);
    writeVec3(upValues, topVertex, upDirection.x, upDirection.y, upDirection.z);
    writeVec2(stValues, bottomVertex, index / edge, 0);
    writeVec2(stValues, topVertex, index / edge, 1);
    writeVec2(wallLocalValues, bottomVertex, 0, 0);
    writeVec2(wallLocalValues, topVertex, 1, 1);
    boundingPositions.push(boundingPosition);
  }

  const indices: number[] = [];
  for (let index = 0; index < edge; index += 1) {
    const next = (index + 1) % edge;
    const currentBottom = index * 2;
    const currentTop = currentBottom + 1;
    const nextBottom = next * 2;
    const nextTop = nextBottom + 1;
    indices.push(currentBottom, nextBottom, currentTop, currentTop, nextBottom, nextTop);
  }

  const attributes: PolygonDiffusionWallGeometryAttributes = new Cesium.GeometryAttributes();
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: positionValues,
  });
  attributes.normal = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: normalValues,
  });
  attributes.st = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 2,
    values: stValues,
  });
  attributes.radialDirection = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: radialValues,
  });
  attributes.upDirection = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: upValues,
  });
  attributes.wallLocal = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 2,
    values: wallLocalValues,
  });

  return {
    geometry: new Cesium.Geometry({
      attributes,
      indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      boundingSphere: Cesium.BoundingSphere.fromPoints([centerCartesian, ...boundingPositions]),
    }),
    boundingPositions,
  };
}

/** 按中心点、半径和边数生成参考项目同款正多边形墙体顶点。 */
export function createRegularPolygonPositions(
  center: SpecialEffectsPositionInput,
  edge: number,
  radius: number,
  height: number,
): Cesium.Cartesian3[] {
  const safeEdge = Math.max(3, Math.floor(edge));
  const cartographic = toCartographic(center);
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0),
  );
  const positions: Cesium.Cartesian3[] = [];
  for (let index = 0; index < safeEdge; index += 1) {
    const angle = (index / safeEdge) * Cesium.Math.TWO_PI;
    positions.push(
      Cesium.Matrix4.multiplyByPoint(
        modelMatrix,
        new Cesium.Cartesian3(Math.cos(angle) * radius, Math.sin(angle) * radius, height),
        new Cesium.Cartesian3(),
      ),
    );
  }
  positions.push(Cesium.Cartesian3.clone(positions[0]!));
  return positions;
}

/** 闭合多边形点位；首尾相同则保持原样。 */
export function closePolygonPositions(positions: readonly SpecialEffectsPositionInput[]): SpecialEffectsPositionInput[] {
  if (positions.length < 3) return Array.from(positions);
  const result = Array.from(positions);
  if (!isSamePosition(result[0]!, result[result.length - 1]!)) result.push(result[0]!);
  return result;
}

/** 根据点位与显式底高数组计算底部高度。 */
export function resolveWallMinimumHeights(
  positions: readonly SpecialEffectsPositionInput[],
  minimumHeights?: readonly number[],
): number[] {
  if (minimumHeights?.length) return repeatLastHeight(minimumHeights, positions.length);
  return positions.map((position) => toCartographic(position).height ?? 0);
}

/** 根据点位、统一墙高与显式顶高数组计算顶部高度。 */
export function resolveWallMaximumHeights(
  positions: readonly SpecialEffectsPositionInput[],
  height: number,
  maximumHeights?: readonly number[],
  minimumHeights?: readonly number[],
): number[] {
  if (maximumHeights?.length) return repeatLastHeight(maximumHeights, positions.length);
  const baseHeights = resolveWallMinimumHeights(positions, minimumHeights);
  return baseHeights.map((baseHeight) => baseHeight + height);
}

/** 判断两个点位在经纬高上是否一致。 */
function isSamePosition(first: SpecialEffectsPositionInput, second: SpecialEffectsPositionInput): boolean {
  const a = toCartographic(first);
  const b = toCartographic(second);
  return (
    Math.abs(a.longitude - b.longitude) < Cesium.Math.EPSILON12 &&
    Math.abs(a.latitude - b.latitude) < Cesium.Math.EPSILON12 &&
    Math.abs((a.height ?? 0) - (b.height ?? 0)) < Cesium.Math.EPSILON6
  );
}

/** 将高度数组补齐到点位长度，缺少时复用最后一个高度。 */
function repeatLastHeight(heights: readonly number[], length: number): number[] {
  const result = Array.from(heights);
  if (result.length === length - 1) result.push(result[0] ?? 0);
  const fallback = result[result.length - 1] ?? 0;
  while (result.length < length) result.push(fallback);
  return result.slice(0, length);
}

/** GPU 动画中心扩散墙顶点着色器。 */
const POLYGON_DIFFUSION_WALL_ANIMATED_VERTEX_SHADER = `
  in vec3 position3DHigh;
  in vec3 position3DLow;
  in vec3 normal;
  in vec2 st;
  in vec3 radialDirection;
  in vec3 upDirection;
  in vec2 wallLocal;
  in float batchId;

  uniform float u_diffusionTime;
  uniform float u_minRadius;
  uniform float u_maxRadius;
  uniform float u_height;

  out vec3 v_positionEC;
  out vec3 v_normalEC;
  out vec2 v_st;

  void main() {
    float radius = mix(u_minRadius, u_maxRadius, u_diffusionTime);
    float height = u_height * (1.0 - u_diffusionTime);
    vec3 animatedOffset = radialDirection * (radius - u_minRadius) + upDirection * (wallLocal.x * (height - u_height));
    vec4 p = czm_translateRelativeToEye(position3DHigh, position3DLow);
    p.xyz += animatedOffset;

    v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
    v_normalEC = czm_normal * normal;
    v_st = vec2(st.s, wallLocal.y);
    gl_Position = czm_modelViewProjectionRelativeToEye * p;
  }
`;

/** GPU 动画中心扩散墙片元着色器。 */
const POLYGON_DIFFUSION_WALL_ANIMATED_FRAGMENT_SHADER = `
  in vec3 v_positionEC;
  in vec3 v_normalEC;
  in vec2 v_st;

  void main() {
    vec3 positionToEyeEC = -v_positionEC;
    vec3 normalEC = normalize(v_normalEC);
  #ifdef FACE_FORWARD
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);
  #endif

    czm_materialInput materialInput;
    materialInput.normalEC = normalEC;
    materialInput.positionToEyeEC = positionToEyeEC;
    materialInput.st = v_st;
    czm_material material = czm_getMaterial(materialInput);
  #ifdef FLAT
    out_FragColor = vec4(material.diffuse + material.emission, material.alpha);
  #else
    out_FragColor = czm_phong(normalize(positionToEyeEC), material, czm_lightDirectionEC);
  #endif
  }
`;

/** 空几何兜底，避免非法参数时 Primitive 创建失败。 */
function createEmptyAnimatedGeometry(): PolygonDiffusionWallAnimatedGeometryData {
  return {
    geometry: new Cesium.Geometry({
      attributes: new Cesium.GeometryAttributes(),
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
    }),
    boundingPositions: [],
  };
}

/** 将局部 ENU 坐标转为世界坐标。 */
function localToWorld(frame: Cesium.Matrix4, x: number, y: number, z: number): Cesium.Cartesian3 {
  return Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(x, y, z), new Cesium.Cartesian3());
}

/** 写入 Cartesian3 顶点坐标。 */
function writeCartesian(values: Float64Array, index: number, position: Cesium.Cartesian3): void {
  const offset = index * 3;
  values[offset] = position.x;
  values[offset + 1] = position.y;
  values[offset + 2] = position.z;
}

/** 写入三维向量属性。 */
function writeVec3(values: Float32Array, index: number, x: number, y: number, z: number): void {
  const offset = index * 3;
  values[offset] = x;
  values[offset + 1] = y;
  values[offset + 2] = z;
}

/** 写入二维纹理坐标属性。 */
function writeVec2(values: Float32Array, index: number, x: number, y: number): void {
  const offset = index * 2;
  values[offset] = x;
  values[offset + 1] = y;
}

/** 写入四维自定义局部动画属性。 */
