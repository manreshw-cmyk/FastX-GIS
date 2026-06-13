/**
 * 电子围栏材质。
 * 提供 Entity 与 Primitive 共用的墙体流动材质，默认不依赖外部贴图也能稳定显示。
 */
import * as Cesium from "cesium";
import { getColorValue, registerCesiumMaterial } from "../shared";

/** 电子围栏自定义材质类型。 */
export const ELECTRONIC_FENCE_MATERIAL_TYPE = "FastXElectronicFenceMaterial";

/** 透明白色像素贴图，避免默认贴图缺失导致墙体 alpha 为 0。 */
export const ELECTRONIC_FENCE_DEFAULT_IMAGE = "/assets/images/wall.png";

/** 电子围栏纹理流动方向。 */
export type ElectronicFenceFlowDirection = "up" | "down" | "clockwise" | "counterclockwise";

/** 电子围栏材质参数。 */
export interface ElectronicFenceMaterialOptions {
  /** 围栏主色。 */
  color: Cesium.Color;
  /** 流动贴图地址；不传时使用内置透明白色像素贴图。 */
  image?: string;
  /** 一轮流动动画耗时，单位：毫秒。 */
  duration: number;
  /** 纹理重复次数。 */
  count: number;
  /** 纹理流动方向。 */
  direction: ElectronicFenceFlowDirection;
}

/** 电子围栏动态材质属性，用于 Entity.wall.material。 */
export class ElectronicFenceMaterialProperty implements Cesium.MaterialProperty {
  /** Cesium 材质变更事件。 */
  readonly definitionChanged = new Cesium.Event();
  /** 动态材质每帧都会更新 time uniform。 */
  readonly isConstant = false;
  /** 围栏主色。 */
  color: Cesium.Color;
  /** 流动贴图。 */
  image: string;
  /** 动画时长，单位：毫秒。 */
  duration: number;
  /** 纹理重复次数。 */
  count: number;
  /** 1 表示竖向流动，0 表示横向流动。 */
  vertical: number;
  /** 1 表示正向，-1 表示反向。 */
  direction: number;
  /** 动画开始时间戳。 */
  readonly startTime = Date.now();

  constructor(options: ElectronicFenceMaterialOptions) {
    registerElectronicFenceMaterial();
    const flow = resolveElectronicFenceDirection(options.direction);
    this.color = options.color;
    this.image = options.image ?? ELECTRONIC_FENCE_DEFAULT_IMAGE;
    this.duration = options.duration;
    this.count = options.count;
    this.vertical = flow.vertical;
    this.direction = flow.direction;
  }

  /** 返回 Cesium 材质类型。 */
  getType(_time: Cesium.JulianDate): string {
    return ELECTRONIC_FENCE_MATERIAL_TYPE;
  }

  /** 返回当前帧的材质 uniform。 */
  getValue(time: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    const nextResult = result ?? {};
    nextResult.color = getColorValue(this.color, time, Cesium.Color.CYAN, nextResult.color as Cesium.Color);
    nextResult.image = this.image;
    nextResult.time = getElectronicFenceTime(this.startTime, this.duration);
    nextResult.count = this.count;
    nextResult.vertical = this.vertical;
    nextResult.direction = this.direction;
    return nextResult;
  }

  /** 判断两个材质属性是否等价。 */
  equals(other?: Cesium.MaterialProperty): boolean {
    return (
      this === other ||
      (other instanceof ElectronicFenceMaterialProperty &&
        Cesium.Color.equals(this.color, other.color) &&
        this.image === other.image &&
        this.duration === other.duration &&
        this.count === other.count &&
        this.vertical === other.vertical &&
        this.direction === other.direction)
    );
  }
}

/** 注册电子围栏材质，重复调用会被共享工具过滤。 */
export function registerElectronicFenceMaterial(): void {
  registerCesiumMaterial(
    ELECTRONIC_FENCE_MATERIAL_TYPE,
    {
      color: Cesium.Color.CYAN,
      image: ELECTRONIC_FENCE_DEFAULT_IMAGE,
      time: 0,
      count: 3,
      vertical: 1,
      direction: -1,
    },
    `
      uniform vec4 color;
      uniform sampler2D image;
      uniform float time;
      uniform float count;
      uniform float vertical;
      uniform float direction;

      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = materialInput.st;
        vec2 uv = vertical > 0.5
          ? vec2(fract(st.s), fract(st.t * count + direction * time))
          : vec2(fract(st.s * count + direction * time), fract(st.t));
        vec4 colorImage = texture(image, uv);
        vec4 fragColor;
        fragColor.rgb = colorImage.rgb + color.rgb;
        fragColor = czm_gammaCorrect(fragColor);
        material.diffuse = colorImage.rgb;
        material.alpha = colorImage.a;
        material.emission = fragColor.rgb;
        return material;
      }
    `,
  );
}

/** 创建 Primitive 使用的电子围栏材质。 */
export function createElectronicFenceMaterial(options: ElectronicFenceMaterialOptions): Cesium.Material {
  registerElectronicFenceMaterial();
  const flow = resolveElectronicFenceDirection(options.direction);
  return Cesium.Material.fromType(ELECTRONIC_FENCE_MATERIAL_TYPE, {
    color: Cesium.Color.clone(options.color),
    image: options.image ?? ELECTRONIC_FENCE_DEFAULT_IMAGE,
    time: 0,
    count: options.count,
    vertical: flow.vertical,
    direction: flow.direction,
  });
}

/** 将业务方向转换为 shader 使用的方向参数。 */
export function resolveElectronicFenceDirection(direction: ElectronicFenceFlowDirection): {
  vertical: number;
  direction: number;
} {
  if (direction === "down") return { vertical: 1, direction: 1 };
  if (direction === "clockwise") return { vertical: 0, direction: 1 };
  if (direction === "counterclockwise") return { vertical: 0, direction: -1 };
  return { vertical: 1, direction: -1 };
}

/** 计算电子围栏动画进度，返回 0 到 1 的循环值。 */
export function getElectronicFenceTime(startTime: number, duration: number): number {
  const safeDuration = Math.max(16, duration);
  return ((Date.now() - startTime) % safeDuration) / safeDuration;
}
