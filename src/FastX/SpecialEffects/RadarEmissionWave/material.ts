/**
 * 雷达发射波材质。
 * 提供雷达锥体动态波纹的 Entity 材质属性和 Primitive 材质创建方法。
 */
import * as Cesium from "cesium";
import { getColorValue, registerCesiumMaterial } from "../shared";

/** 雷达发射波自定义材质类型。 */
export const RADAR_EMISSION_WAVE_MATERIAL_TYPE = "FastXRadarEmissionWaveMaterial";

/** 雷达发射波默认颜色。 */
export const DEFAULT_RADAR_EMISSION_WAVE_COLOR = Cesium.Color.fromCssColorString("#00FFFF")!;

/** 雷达发射波材质参数。 */
export interface RadarEmissionWaveMaterialOptions {
  /** 雷达波颜色。 */
  color: Cesium.Color;
  /** 一轮动画时长，单位：毫秒。 */
  duration: number;
  /** 波纹重复数量。 */
  repeat: number;
  /** 波纹偏移量。 */
  offset: number;
  /** 波纹厚度，0 到 1。 */
  thickness: number;
}

/** 雷达发射波动态材质属性，用于 Entity 绘制。 */
export class RadarEmissionWaveMaterialProperty implements Cesium.MaterialProperty {
  /** 材质变化事件。 */
  readonly definitionChanged = new Cesium.Event();
  /** 是否为常量材质。 */
  readonly isConstant = false;
  /** 雷达波颜色。 */
  color: Cesium.Color;
  /** 一轮动画时长，单位：毫秒。 */
  duration: number;
  /** 波纹重复数量。 */
  repeat: number;
  /** 波纹偏移量。 */
  offset: number;
  /** 波纹厚度，0 到 1。 */
  thickness: number;
  /** 动画起始时间。 */
  readonly startTime = Date.now();

  constructor(options: RadarEmissionWaveMaterialOptions) {
    registerRadarEmissionWaveMaterial();
    this.color = options.color;
    this.duration = options.duration;
    this.repeat = options.repeat;
    this.offset = options.offset;
    this.thickness = options.thickness;
  }

  /** 获取 Cesium 材质类型。 */
  getType(_time: Cesium.JulianDate): string {
    return RADAR_EMISSION_WAVE_MATERIAL_TYPE;
  }

  /** 获取当前帧材质 Uniform。 */
  getValue(time: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    const nextResult = result ?? {};
    nextResult.color = getColorValue(this.color, time, DEFAULT_RADAR_EMISSION_WAVE_COLOR, nextResult.color as Cesium.Color);
    nextResult.time = getRadarEmissionWaveTime(this.startTime, this.duration);
    nextResult.repeat = this.repeat;
    nextResult.offset = this.offset;
    nextResult.thickness = this.thickness;
    return nextResult;
  }

  /** 判断两个材质是否相同。 */
  equals(other?: Cesium.MaterialProperty): boolean {
    return (
      this === other ||
      (other instanceof RadarEmissionWaveMaterialProperty && Cesium.Color.equals(this.color, other.color))
    );
  }
}

/** 注册雷达发射波材质。 */
export function registerRadarEmissionWaveMaterial(): void {
  registerCesiumMaterial(
    RADAR_EMISSION_WAVE_MATERIAL_TYPE,
    {
      color: Cesium.Color.clone(DEFAULT_RADAR_EMISSION_WAVE_COLOR),
      time: 0,
      repeat: 30,
      offset: 0,
      thickness: 0.1,
    },
    `
      uniform vec4 color;
      uniform float time;
      uniform float repeat;
      uniform float offset;
      uniform float thickness;
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float sp = 1.0 / repeat;
        vec2 st = materialInput.st;
        float dis = distance(st, vec2(0.5));
        float m = mod(dis + offset - time, sp);
        float a = step(sp * (1.0 - thickness), m);
        material.diffuse = color.rgb;
        material.emission = color.rgb;
        material.alpha = a * color.a;
        return material;
      }
    `,
  );
}

/** 创建 Primitive 使用的雷达发射波材质。 */
export function createRadarEmissionWaveMaterial(options: RadarEmissionWaveMaterialOptions): Cesium.Material {
  registerRadarEmissionWaveMaterial();
  return Cesium.Material.fromType(RADAR_EMISSION_WAVE_MATERIAL_TYPE, {
    color: Cesium.Color.clone(options.color),
    time: 0,
    repeat: options.repeat,
    offset: options.offset,
    thickness: options.thickness,
  });
}

/** 计算雷达发射波动画进度。 */
export function getRadarEmissionWaveTime(startTime: number, duration: number): number {
  return ((Date.now() - startTime) % duration) / duration / 10;
}
