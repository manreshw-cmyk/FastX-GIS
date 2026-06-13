/**
 * SpecialEffects 共享工具。
 * 提供特效模块通用的坐标转换、颜色转换、材质注册和销毁工具。
 */
import * as Cesium from "cesium";

/** 经纬度高度数组，单位分别为度、度、米。 */
export type SpecialEffectsLngLatHeightTuple = readonly [
  longitude: number,
  latitude: number,
  height?: number,
];

/** 经纬度高度对象，单位分别为度、度、米。 */
export interface SpecialEffectsLngLatHeight {
  /** 经度，单位：度。 */
  longitude: number;
  /** 纬度，单位：度。 */
  latitude: number;
  /** 高度，单位：米。 */
  height?: number;
}

/** SDK 特效统一支持的坐标输入格式。 */
export type SpecialEffectsPositionInput =
  | Cesium.Cartesian3
  | SpecialEffectsLngLatHeightTuple
  | SpecialEffectsLngLatHeight;

/** SDK 特效统一支持的颜色输入格式。 */
export type SpecialEffectsColorInput = string | Cesium.Color;

let specialEffectsIdSeed = 1;
const registeredMaterialTypes = new Set<string>();

/** 判断坐标是否为经纬度高度数组。 */
function isLngLatHeightTuple(position: SpecialEffectsPositionInput): position is SpecialEffectsLngLatHeightTuple {
  return Array.isArray(position);
}

/** 创建特效实例默认 id。 */
export function createSpecialEffectId(prefix: string): string {
  specialEffectsIdSeed += 1;
  return `${prefix}-${Date.now()}-${specialEffectsIdSeed}`;
}

/** 将颜色字符串或 Cesium.Color 统一转换为 Cesium.Color。 */
export function toCesiumColor(
  color: SpecialEffectsColorInput | undefined,
  fallback: Cesium.Color,
): Cesium.Color {
  if (!color) return Cesium.Color.clone(fallback);
  if (color instanceof Cesium.Color) return Cesium.Color.clone(color);
  return Cesium.Color.fromCssColorString(color) ?? Cesium.Color.clone(fallback);
}

/** 将坐标输入统一转换为 Cartesian3。 */
export function toCartesian3(position: SpecialEffectsPositionInput): Cesium.Cartesian3 {
  if (position instanceof Cesium.Cartesian3) return Cesium.Cartesian3.clone(position);
  if (isLngLatHeightTuple(position)) {
    return Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2] ?? 0);
  }
  return Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height ?? 0);
}

/** 将坐标输入统一转换为 Cartographic。 */
export function toCartographic(position: SpecialEffectsPositionInput): Cesium.Cartographic {
  if (position instanceof Cesium.Cartesian3) return Cesium.Cartographic.fromCartesian(position);
  if (isLngLatHeightTuple(position)) {
    return Cesium.Cartographic.fromDegrees(position[0], position[1], position[2] ?? 0);
  }
  return Cesium.Cartographic.fromDegrees(position.longitude, position.latitude, position.height ?? 0);
}

/** 将一组坐标统一转换为 Cartesian3 数组。 */
export function toCartesian3Array(positions: readonly SpecialEffectsPositionInput[]): Cesium.Cartesian3[] {
  return positions.map((position) => toCartesian3(position));
}

/** 在 Cesium requestRenderMode 下主动刷新一帧。 */
export function requestSceneRender(viewer: Cesium.Viewer): void {
  viewer.scene.requestRender();
}

/** 从 Viewer 中移除并销毁后处理 Stage。 */
export function destroyPostProcessStage(
  viewer: Cesium.Viewer,
  stage?: Cesium.PostProcessStage | null,
): void {
  if (!stage) return;
  viewer.scene.postProcessStages.remove(stage);
  if (!stage.isDestroyed()) stage.destroy();
  requestSceneRender(viewer);
}

/** 从 Viewer 中移除实体。 */
export function removeEntity(viewer: Cesium.Viewer, entity?: Cesium.Entity | null): void {
  if (!entity || viewer.isDestroyed()) return;
  viewer.entities.remove(entity);
  requestSceneRender(viewer);
}

/** 从 Viewer 中移除 Primitive。 */
export function removePrimitive(viewer: Cesium.Viewer, primitive?: Cesium.Primitive | null): void {
  if (!primitive) return;
  viewer.scene.primitives.remove(primitive);
  requestSceneRender(viewer);
}

/** 判断 Viewer 是否可用。 */
export function isValidViewer(viewer: Cesium.Viewer | undefined | null): viewer is Cesium.Viewer {
  return !!viewer && !viewer.isDestroyed();
}

/** Cesium 内部材质缓存接口。 */
export type CesiumMaterialWithCache = typeof Cesium.Material & {
  _materialCache: {
    addMaterial: (
      type: string,
      options: {
        fabric: {
          type: string;
          uniforms: Record<string, unknown>;
          source: string;
        };
        translucent: (material?: Cesium.Material) => boolean;
      },
    ) => void;
    getMaterial: (type: string) => unknown;
  };
};

/** 注册自定义材质；重复调用不会覆盖已有材质类型。 */
export function registerCesiumMaterial(
  type: string,
  uniforms: Record<string, unknown>,
  source: string,
): void {
  const material = Cesium.Material as CesiumMaterialWithCache;
  if (registeredMaterialTypes.has(type) || material._materialCache.getMaterial(type)) return;
  material._materialCache.addMaterial(type, {
    fabric: {
      type,
      uniforms,
      source,
    },
    translucent: () => true,
  });
  registeredMaterialTypes.add(type);
}

/** 读取 Cesium.Property 颜色或静态颜色。 */
export function getColorValue(
  color: Cesium.Color | Cesium.Property | undefined,
  time: Cesium.JulianDate,
  fallback: Cesium.Color,
  result?: Cesium.Color,
): Cesium.Color {
  if (!color) return Cesium.Color.clone(fallback, result);
  if (color instanceof Cesium.Color) return Cesium.Color.clone(color, result);
  const propertyValue = color.getValue(time, result);
  return propertyValue instanceof Cesium.Color ? Cesium.Color.clone(propertyValue, result) : Cesium.Color.clone(fallback, result);
}
