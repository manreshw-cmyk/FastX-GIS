/**
 * 全局雪特效。
 * 使用 Cesium PostProcessStage 为整个地球场景叠加雪花后处理效果。
 */
import * as Cesium from "cesium";
import { destroyPostProcessStage, requestSceneRender } from "../shared";

/** 全局雪特效配置。 */
export interface GlobalSnowOptions {
  /** 雪花尺寸，值越大雪花越大。 */
  snowSize?: number;
  /** 雪花速度，值越小移动越快。 */
  snowSpeed?: number;
  /** 创建后是否立即启用。默认 true。 */
  autoStart?: boolean;
}

/** 全局雪后处理特效。 */
export default class GlobalSnow {
  /** Cesium Viewer 实例。 */
  private readonly viewer: Cesium.Viewer;
  /** 当前雪特效后处理 Stage。 */
  private stage: Cesium.PostProcessStage | null = null;
  /** 雪花尺寸。 */
  private snowSize: number;
  /** 雪花速度。 */
  private snowSpeed: number;

  constructor(viewer: Cesium.Viewer, options: GlobalSnowOptions = {}) {
    this.viewer = viewer;
    this.snowSize = options.snowSize ?? 0.02;
    this.snowSpeed = options.snowSpeed ?? 60.0;
    if (options.autoStart !== false) this.enable();
  }

  /** 启用雪特效。 */
  enable(): Cesium.PostProcessStage {
    if (this.stage && !this.stage.isDestroyed()) {
      this.stage.enabled = true;
      requestSceneRender(this.viewer);
      return this.stage;
    }

    this.stage = new Cesium.PostProcessStage({
      name: "fastx_global_snow",
      fragmentShader: GlobalSnow.getFragmentShader(),
      uniforms: {
        snowSize: () => this.snowSize,
        snowSpeed: () => this.snowSpeed,
      },
    });
    this.viewer.scene.postProcessStages.add(this.stage);
    requestSceneRender(this.viewer);
    return this.stage;
  }

  /** 禁用雪特效但保留 Stage。 */
  disable(): void {
    if (!this.stage) return;
    this.stage.enabled = false;
    requestSceneRender(this.viewer);
  }

  /** 设置雪特效显隐。 */
  show(visible: boolean): void {
    if (visible) this.enable();
    else this.disable();
  }

  /** 更新雪特效参数。 */
  update(options: Omit<GlobalSnowOptions, "autoStart">): void {
    if (typeof options.snowSize === "number") this.snowSize = options.snowSize;
    if (typeof options.snowSpeed === "number") this.snowSpeed = options.snowSpeed;
    requestSceneRender(this.viewer);
  }

  /** 获取当前后处理 Stage。 */
  getStage(): Cesium.PostProcessStage | null {
    return this.stage;
  }

  /** 移除并销毁雪特效。 */
  destroy(): void {
    destroyPostProcessStage(this.viewer, this.stage);
    this.stage = null;
  }

  /** 雪特效片元着色器。 */
  private static getFragmentShader(): string {
    return `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float snowSpeed;
      uniform float snowSize;
      float snow(vec2 uv, float scale) {
        float time = czm_frameNumber / snowSpeed;
        float w = smoothstep(1.0, 0.0, -uv.y * (scale / 10.0));
        if (w < 0.1) return 0.0;
        uv += time / scale;
        uv.y += time * 2.0 / scale;
        uv.x += sin(uv.y + time * 0.5) / scale;
        uv *= scale;
        vec2 s = floor(uv), f = fract(uv), p;
        float k = 3.0, d;
        p = 0.5 + 0.35 * sin(11.0 * fract(sin((s + p + scale) * mat2(7, 3, 6, 5)) * 5.0)) - f;
        d = length(p);
        k = min(d, k);
        k = smoothstep(0.0, k, sin(f.x + f.y) * snowSize);
        return k * w;
      }
      out vec4 fragColor;
      void main(void) {
        vec2 resolution = czm_viewport.zw;
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        vec3 finalColor = vec3(0.0);
        float c = 0.0;
        c += snow(uv, 30.0) * 0.0;
        c += snow(uv, 20.0) * 0.0;
        c += snow(uv, 15.0) * 0.0;
        c += snow(uv, 10.0);
        c += snow(uv, 8.0);
        c += snow(uv, 6.0);
        c += snow(uv, 5.0);
        finalColor = vec3(c);
        fragColor = mix(texture(colorTexture, v_textureCoordinates), vec4(finalColor, 1.0), 0.5);
      }
    `;
  }
}
