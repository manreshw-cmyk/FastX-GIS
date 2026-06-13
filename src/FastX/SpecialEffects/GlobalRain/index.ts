/**
 * 全局雨特效。
 * 使用 Cesium PostProcessStage 为整个地球场景叠加雨丝后处理效果。
 */
import * as Cesium from "cesium";
import { destroyPostProcessStage, requestSceneRender } from "../shared";

/** 全局雨特效配置。 */
export interface GlobalRainOptions {
  /** 雨丝倾斜角度，负数向右，正数向左。 */
  tiltAngle?: number;
  /** 雨丝尺寸，值越大雨丝越明显。 */
  rainSize?: number;
  /** 雨丝速度，值越小移动越快。 */
  rainSpeed?: number;
  /** 创建后是否立即启用。默认 true。 */
  autoStart?: boolean;
}

/** 全局雨后处理特效。 */
export default class GlobalRain {
  /** Cesium Viewer 实例。 */
  private readonly viewer: Cesium.Viewer;
  /** 当前雨特效后处理 Stage。 */
  private stage: Cesium.PostProcessStage | null = null;
  /** 雨丝倾斜角度。 */
  private tiltAngle: number;
  /** 雨丝尺寸。 */
  private rainSize: number;
  /** 雨丝速度。 */
  private rainSpeed: number;

  constructor(viewer: Cesium.Viewer, options: GlobalRainOptions = {}) {
    this.viewer = viewer;
    this.tiltAngle = options.tiltAngle ?? -0.6;
    this.rainSize = options.rainSize ?? 0.3;
    this.rainSpeed = options.rainSpeed ?? 60.0;
    if (options.autoStart !== false) this.enable();
  }

  /** 启用雨特效。 */
  enable(): Cesium.PostProcessStage {
    if (this.stage && !this.stage.isDestroyed()) {
      this.stage.enabled = true;
      requestSceneRender(this.viewer);
      return this.stage;
    }

    this.stage = new Cesium.PostProcessStage({
      name: "fastx_global_rain",
      fragmentShader: GlobalRain.getFragmentShader(),
      uniforms: {
        tiltAngle: () => this.tiltAngle,
        rainSize: () => this.rainSize,
        rainSpeed: () => this.rainSpeed,
      },
    });
    this.viewer.scene.postProcessStages.add(this.stage);
    requestSceneRender(this.viewer);
    return this.stage;
  }

  /** 禁用雨特效但保留 Stage。 */
  disable(): void {
    if (!this.stage) return;
    this.stage.enabled = false;
    requestSceneRender(this.viewer);
  }

  /** 设置雨特效显隐。 */
  show(visible: boolean): void {
    if (visible) this.enable();
    else this.disable();
  }

  /** 更新雨特效参数。 */
  update(options: Omit<GlobalRainOptions, "autoStart">): void {
    if (typeof options.tiltAngle === "number") this.tiltAngle = options.tiltAngle;
    if (typeof options.rainSize === "number") this.rainSize = options.rainSize;
    if (typeof options.rainSpeed === "number") this.rainSpeed = options.rainSpeed;
    requestSceneRender(this.viewer);
  }

  /** 获取当前后处理 Stage。 */
  getStage(): Cesium.PostProcessStage | null {
    return this.stage;
  }

  /** 移除并销毁雨特效。 */
  destroy(): void {
    destroyPostProcessStage(this.viewer, this.stage);
    this.stage = null;
  }

  /** 雨特效片元着色器。 */
  private static getFragmentShader(): string {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float tiltAngle;
      uniform float rainSize;
      uniform float rainSpeed;
      float hash(float x) {
        return fract(sin(x * 133.3) * 13.13);
      }
      out vec4 fragColor;
      void main(void) {
        float time = czm_frameNumber / rainSpeed;
        vec2 resolution = czm_viewport.zw;
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        vec3 c = vec3(0.6, 0.7, 0.8);
        float a = tiltAngle;
        float si = sin(a), co = cos(a);
        uv *= mat2(co, -si, si, co);
        uv *= length(uv + vec2(0.0, 4.9)) * rainSize + 1.0;
        float v = 1.0 - sin(hash(floor(uv.x * 100.0)) * 2.0);
        float b = clamp(abs(sin(20.0 * time * v + uv.y * (5.0 / (2.0 + v)))) - 0.95, 0.0, 1.0) * 20.0;
        c *= v * b;
        fragColor = mix(texture(colorTexture, v_textureCoordinates), vec4(c, 1.0), 0.5);
      }
    `;
  }
}
