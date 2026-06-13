/**
 * 辐射圈材质。
 * 提供 Entity 材质属性和 Primitive 材质创建方法。
 */
import * as Cesium from "cesium";
import { getColorValue, registerCesiumMaterial } from "../shared";

/** 辐射圈自定义材质类型。 */
export const RADIATION_CIRCLE_MATERIAL_TYPE = "FastXRadiationCircleMaterial";

/** 辐射圈材质参数。 */
export interface RadiationCircleMaterialOptions {
  /** 辐射圈颜色。 */
  color: Cesium.Color;
  /** 一轮动画时长，单位：毫秒。 */
  duration: number;
  /** 同时显示的波纹数量。 */
  count: number;
  /** 波纹渐变强度，0 到 1。 */
  gradient: number;
}

/** 辐射圈动态材质属性，用于 Entity 绘制。 */
export class RadiationCircleMaterialProperty implements Cesium.MaterialProperty {
  /** 材质变化事件。 */
  readonly definitionChanged = new Cesium.Event();
  /** 是否为常量材质。 */
  readonly isConstant = false;
  /** 辐射圈颜色。 */
  color: Cesium.Color;
  /** 一轮动画时长，单位：毫秒。 */
  duration: number;
  /** 同时显示的波纹数量。 */
  count: number;
  /** 波纹渐变强度，0 到 1。 */
  gradient: number;
  /** 动画起始时间。 */
  readonly startTime = Date.now();

  constructor(options: RadiationCircleMaterialOptions) {
    this.color = options.color;
    this.duration = options.duration;
    this.count = Math.max(1, options.count);
    this.gradient = Math.min(Math.max(options.gradient, 0), 1);
  }

  /** 获取 Cesium 材质类型。 */
  getType(_time: Cesium.JulianDate): string {
    return RADIATION_CIRCLE_MATERIAL_TYPE;
  }

  /** 获取当前帧材质 Uniform。 */
  getValue(time: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    const nextResult = result ?? {};
    nextResult.color = getColorValue(this.color, time, Cesium.Color.WHITE, nextResult.color as Cesium.Color);
    nextResult.time = getRadiationCircleTime(this.startTime, this.duration);
    nextResult.count = this.count;
    nextResult.gradient = getRadiationCircleGradient(this.gradient);
    return nextResult;
  }

  /** 判断两个材质是否相同。 */
  equals(other?: Cesium.MaterialProperty): boolean {
    return (
      this === other ||
      (other instanceof RadiationCircleMaterialProperty && Cesium.Color.equals(this.color, other.color))
    );
  }
}

/** 注册辐射圈材质。 */
export function registerRadiationCircleMaterial(): void {
  registerCesiumMaterial(
    RADIATION_CIRCLE_MATERIAL_TYPE,
    {
      color: new Cesium.Color(0.0, 1.0, 1.0, 0.75),
      time: 1,
      count: 3,
      gradient: 0.5,
    },
    `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        material.diffuse = 1.5 * color.rgb;
        vec2 st = materialInput.st;
        vec3 str = materialInput.str;
        float dis = distance(st, vec2(0.5, 0.5));
        float per = fract(time);
        if (abs(str.z) > 0.001) {
          discard;
        }
        if (dis > 0.5) {
          discard;
        } else {
          float perDis = 0.5 / count;
          float disNum;
          float bl = 0.0;
          for (int i = 0; i <= 9; i++) {
            if (float(i) <= count) {
              disNum = perDis * float(i) - dis + per / count;
              if (disNum > 0.0) {
                if (disNum < perDis) {
                  bl = 1.0 - disNum / perDis;
                } else if (disNum - perDis < perDis) {
                  bl = 1.0 - abs(1.0 - disNum / perDis);
                }
                material.alpha = pow(bl, gradient) * color.a;
              }
            }
          }
        }
        return material;
      }
    `,
  );
}

/** 创建 Primitive 使用的辐射圈材质。 */
export function createRadiationCircleMaterial(options: RadiationCircleMaterialOptions): Cesium.Material {
  registerRadiationCircleMaterial();
  return Cesium.Material.fromType(RADIATION_CIRCLE_MATERIAL_TYPE, {
    color: Cesium.Color.clone(options.color),
    time: 0,
    count: Math.max(1, options.count),
    gradient: getRadiationCircleGradient(options.gradient),
  });
}

/** 计算动画进度。 */
export function getRadiationCircleTime(startTime: number, duration: number): number {
  return ((Date.now() - startTime) % duration) / duration;
}

/** 计算 Shader 使用的渐变值。 */
export function getRadiationCircleGradient(gradient: number): number {
  return 1 + 10 * (1 - Math.min(Math.max(gradient, 0), 1));
}
