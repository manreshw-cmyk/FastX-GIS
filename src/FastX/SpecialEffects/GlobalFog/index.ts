/**
 * 全局大雾特效。
 * 使用 Cesium PostProcessStage 为整个地球场景叠加雾化后处理效果。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  destroyPostProcessStage,
  requestSceneRender,
  toCesiumColor,
} from "../shared";

/** 全局大雾特效配置。 */
export interface GlobalFogOptions {
  /** 雾浓度，值越大雾越明显。 */
  visibility?: number;
  /** 雾颜色。 */
  color?: SpecialEffectsColorInput;
  /** 创建后是否立即启用。默认 true。 */
  autoStart?: boolean;
}

/** 全局大雾后处理特效。 */
export default class GlobalFog {
  /** Cesium Viewer 实例。 */
  private readonly viewer: Cesium.Viewer;
  /** 当前大雾后处理 Stage。 */
  private stage: Cesium.PostProcessStage | null = null;
  /** 雾浓度。 */
  private visibility: number;
  /** 雾颜色。 */
  private color: Cesium.Color;

  constructor(viewer: Cesium.Viewer, options: GlobalFogOptions = {}) {
    this.viewer = viewer;
    this.visibility = options.visibility ?? 0.1;
    this.color = toCesiumColor(options.color, new Cesium.Color(0.8, 0.8, 0.8, 0.5));
    if (options.autoStart !== false) this.enable();
  }

  /** 启用大雾特效。 */
  enable(): Cesium.PostProcessStage {
    if (this.stage && !this.stage.isDestroyed()) {
      this.stage.enabled = true;
      requestSceneRender(this.viewer);
      return this.stage;
    }

    this.stage = new Cesium.PostProcessStage({
      name: "fastx_global_fog",
      fragmentShader: GlobalFog.getFragmentShader(),
      uniforms: {
        visibility: () => this.visibility,
        fogColor: () => this.color,
      },
    });
    this.viewer.scene.postProcessStages.add(this.stage);
    requestSceneRender(this.viewer);
    return this.stage;
  }

  /** 禁用大雾特效但保留 Stage。 */
  disable(): void {
    if (!this.stage) return;
    this.stage.enabled = false;
    requestSceneRender(this.viewer);
  }

  /** 设置大雾特效显隐。 */
  show(visible: boolean): void {
    if (visible) this.enable();
    else this.disable();
  }

  /** 更新大雾特效参数。 */
  update(options: Omit<GlobalFogOptions, "autoStart">): void {
    if (typeof options.visibility === "number") this.visibility = options.visibility;
    if (options.color) this.color = toCesiumColor(options.color, this.color);
    requestSceneRender(this.viewer);
  }

  /** 获取当前后处理 Stage。 */
  getStage(): Cesium.PostProcessStage | null {
    return this.stage;
  }

  /** 移除并销毁大雾特效。 */
  destroy(): void {
    destroyPostProcessStage(this.viewer, this.stage);
    this.stage = null;
  }

  /** 大雾片元着色器。 */
  private static getFragmentShader(): string {
    return `
      uniform sampler2D colorTexture;
      uniform sampler2D depthTexture;
      uniform float visibility;
      uniform vec4 fogColor;
      in vec2 v_textureCoordinates;
      out vec4 fragColor;
      void main(void) {
        vec4 origcolor = texture(colorTexture, v_textureCoordinates);
        float depth = czm_readDepth(depthTexture, v_textureCoordinates);
        vec4 depthcolor = texture(depthTexture, v_textureCoordinates);
        float f = visibility * (depthcolor.r - 0.3) / 0.2;
        if (f < 0.0) f = 0.0;
        else if (f > 1.0) f = 1.0;
        fragColor = mix(origcolor, fogColor, f);
      }
    `;
  }
}
