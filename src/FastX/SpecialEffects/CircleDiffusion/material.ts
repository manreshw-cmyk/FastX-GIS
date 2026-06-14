/**
 * 圆扩散材质。
 * 基于 Ellipse 纹理坐标，在固定世界半径内绘制向外扩散的扫描圈。
 */
import * as Cesium from "cesium";
import { getColorValue, registerCesiumMaterial } from "../shared";

/** 圆扩散自定义材质类型。 */
export const CIRCLE_DIFFUSION_MATERIAL_TYPE = "FastXCircleDiffusionMaterial";

/** 圆扩散材质参数。 */
export interface CircleDiffusionMaterialOptions {
  /** 扩散颜色。 */
  color: Cesium.Color;
  /** 一轮动画时长，单位：毫秒。 */
  duration: number;
}

/** 圆扩散动态材质属性，用于 Entity 绘制。 */
export class CircleDiffusionMaterialProperty implements Cesium.MaterialProperty {
  readonly definitionChanged = new Cesium.Event();
  readonly isConstant = false;
  private _color: Cesium.Color;
  private _duration: number;
  private _startTime = Date.now();

  constructor(options: CircleDiffusionMaterialOptions) {
    this._color = Cesium.Color.clone(options.color);
    this._duration = normalizeCircleDiffusionDuration(options.duration);
  }

  /** 扩散颜色。 */
  get color(): Cesium.Color {
    return this._color;
  }

  set color(value: Cesium.Color) {
    if (Cesium.Color.equals(this._color, value)) return;
    this._color = Cesium.Color.clone(value);
    this.definitionChanged.raiseEvent(this);
  }

  /** 一轮动画时长，单位：毫秒。 */
  get duration(): number {
    return this._duration;
  }

  set duration(value: number) {
    const duration = normalizeCircleDiffusionDuration(value);
    if (this._duration === duration) return;
    this._duration = duration;
    this.restart();
  }

  getType(_time: Cesium.JulianDate): string {
    return CIRCLE_DIFFUSION_MATERIAL_TYPE;
  }

  getValue(time: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    const nextResult = result ?? {};
    nextResult.color = getColorValue(this._color, time, Cesium.Color.WHITE, nextResult.color as Cesium.Color);
    nextResult.time = getCircleDiffusionTime(this._startTime, this._duration);
    return nextResult;
  }

  equals(other?: Cesium.MaterialProperty): boolean {
    return (
      this === other ||
      (other instanceof CircleDiffusionMaterialProperty &&
        Cesium.Color.equals(this._color, other.color) &&
        this._duration === other.duration)
    );
  }

  /** 重置动画相位（更新参数时调用）。 */
  restart(): void {
    this._startTime = Date.now();
    this.definitionChanged.raiseEvent(this);
  }
}

/** 注册圆扩散材质。 */
export function registerCircleDiffusionMaterial(): void {
  registerCesiumMaterial(
    CIRCLE_DIFFUSION_MATERIAL_TYPE,
    {
      color: Cesium.Color.LIME,
      time: 0,
    },
    `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = materialInput.st;
        float dis = distance(st, vec2(0.5, 0.5)) * 2.0;
        float per = fract(time);
        if (dis > per) {
          discard;
        }
        float f = 1.0 - abs(per - dis) / max(per, 0.0001);
        f = pow(clamp(f, 0.0, 1.0), 18.0);
        material.diffuse = color.rgb;
        material.alpha = f * color.a;
        return material;
      }
    `,
  );
}

/** 创建 Primitive 使用的圆扩散材质。 */
export function createCircleDiffusionMaterial(options: CircleDiffusionMaterialOptions): Cesium.Material {
  registerCircleDiffusionMaterial();
  return Cesium.Material.fromType(CIRCLE_DIFFUSION_MATERIAL_TYPE, {
    color: Cesium.Color.clone(options.color),
    time: 0,
  });
}

/** 计算动画进度 0~1。 */
export function getCircleDiffusionTime(startTime: number, duration: number): number {
  const normalizedDuration = normalizeCircleDiffusionDuration(duration);
  return ((Date.now() - startTime) % normalizedDuration) / normalizedDuration;
}

/** 规整动画时长，避免 0 或非法值导致 Shader 进度异常。 */
export function normalizeCircleDiffusionDuration(duration: number): number {
  return Number.isFinite(duration) ? Math.max(100, duration) : 2000;
}
