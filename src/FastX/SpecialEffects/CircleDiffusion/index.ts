/**
 * 圆扩散特效。
 * 使用 Cesium PostProcessStage 在地表生成动态扩散扫描圈。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  destroyPostProcessStage,
  requestSceneRender,
  toCartographic,
  toCesiumColor,
} from "../shared";

/** 圆扩散新增参数。 */
export interface CircleDiffusionAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 扩散中心点。 */
  position: SpecialEffectsPositionInput;
  /** 扩散颜色。默认 rgba(0,255,0,1)。 */
  color?: SpecialEffectsColorInput;
  /** 最大扩散半径，单位：米。 */
  maxRadius?: number;
  /** 一轮扩散动画耗时，单位：毫秒。 */
  duration?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 圆扩散更新参数。 */
export type CircleDiffusionUpdateOptions = Partial<Omit<CircleDiffusionAddOptions, "id">>;

interface CircleDiffusionRecord {
  stage: Cesium.PostProcessStage;
  center: Cesium.Cartographic;
  color: Cesium.Color;
  maxRadius: number;
  duration: number;
  startTime: number;
  scratchCenter: Cesium.Cartesian4;
  scratchCenterHigh: Cesium.Cartesian4;
  scratchNormal: Cesium.Cartesian3;
}

/** 圆扩散特效，通过后处理在地表生成动态扩散扫描圈。 */
export default class CircleDiffusion {
  /** Cesium Viewer 实例。 */
  private readonly viewer: Cesium.Viewer;
  /** 当前类管理的圆扩散后处理 Stage。 */
  private readonly records = new Map<string, CircleDiffusionRecord>();

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
  }

  /** 新增一个圆扩散效果，返回效果 id。 */
  add(options: CircleDiffusionAddOptions): string {
    const id = options.id ?? createSpecialEffectId("circle-diffusion");
    const record = this.createRecord(options);
    record.stage.enabled = options.show ?? true;
    this.viewer.scene.postProcessStages.add(record.stage);
    this.records.set(id, record);
    requestSceneRender(this.viewer);
    return id;
  }

  /** 更新指定圆扩散效果。 */
  update(id: string, options: CircleDiffusionUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    if (options.position) record.center = toCartographic(options.position);
    if (options.color) record.color = toCesiumColor(options.color, record.color);
    if (typeof options.maxRadius === "number") record.maxRadius = options.maxRadius;
    if (typeof options.duration === "number") record.duration = options.duration;
    if (typeof options.show === "boolean") record.stage.enabled = options.show;
    record.startTime = Date.now();
    requestSceneRender(this.viewer);
    return true;
  }

  /** 设置指定圆扩散显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.stage.enabled = visible;
    requestSceneRender(this.viewer);
    return true;
  }

  /** 获取指定圆扩散后处理 Stage。 */
  get(id: string): Cesium.PostProcessStage | undefined {
    return this.records.get(id)?.stage;
  }

  /** 删除指定圆扩散效果。 */
  /** 获取当前管理的全部圆扩散 id。 */
  getAllIds(): string[] {
    return [...this.records.keys()];
  }

  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    destroyPostProcessStage(this.viewer, record.stage);
    this.records.delete(id);
    return true;
  }

  /** 清空所有圆扩散效果。 */
  clear(): void {
    this.records.forEach((record) => destroyPostProcessStage(this.viewer, record.stage));
    this.records.clear();
  }

  /** 销毁当前类管理的所有圆扩散效果。 */
  destroy(): void {
    this.clear();
  }

  /** 创建圆扩散后处理记录。 */
  private createRecord(options: CircleDiffusionAddOptions): CircleDiffusionRecord {
    const record: CircleDiffusionRecord = {
      stage: undefined as unknown as Cesium.PostProcessStage,
      center: toCartographic(options.position),
      color: toCesiumColor(options.color, Cesium.Color.LIME),
      maxRadius: options.maxRadius ?? 1000,
      duration: options.duration ?? 2000,
      startTime: Date.now(),
      scratchCenter: new Cesium.Cartesian4(),
      scratchCenterHigh: new Cesium.Cartesian4(),
      scratchNormal: new Cesium.Cartesian3(),
    };

    record.stage = new Cesium.PostProcessStage({
      name: "fastx_circle_diffusion",
      fragmentShader: CircleDiffusion.getFragmentShader(),
      uniforms: {
        u_scanCenterEC: () => this.getScanCenter(record),
        u_scanPlaneNormalEC: () => this.getScanPlaneNormal(record),
        u_radius: () => (record.maxRadius * ((Date.now() - record.startTime) % record.duration)) / record.duration,
        u_scanColor: () => record.color,
      },
    });
    return record;
  }

  /** 计算扩散中心在相机坐标系中的位置。 */
  private getScanCenter(record: CircleDiffusionRecord): Cesium.Cartesian4 {
    const center = Cesium.Cartographic.toCartesian(record.center);
    const center4 = new Cesium.Cartesian4(center.x, center.y, center.z, 1);
    return Cesium.Matrix4.multiplyByVector(this.viewer.camera.viewMatrix, center4, record.scratchCenter);
  }

  /** 计算扩散平面法线在相机坐标系中的方向。 */
  private getScanPlaneNormal(record: CircleDiffusionRecord): Cesium.Cartesian3 {
    const center = Cesium.Cartographic.toCartesian(record.center);
    const centerHigh = Cesium.Cartographic.toCartesian(
      new Cesium.Cartographic(record.center.longitude, record.center.latitude, record.center.height + 500),
    );
    const center4 = new Cesium.Cartesian4(center.x, center.y, center.z, 1);
    const centerHigh4 = new Cesium.Cartesian4(centerHigh.x, centerHigh.y, centerHigh.z, 1);
    const temp = Cesium.Matrix4.multiplyByVector(this.viewer.camera.viewMatrix, center4, record.scratchCenter);
    const tempHigh = Cesium.Matrix4.multiplyByVector(
      this.viewer.camera.viewMatrix,
      centerHigh4,
      record.scratchCenterHigh,
    );

    record.scratchNormal.x = tempHigh.x - temp.x;
    record.scratchNormal.y = tempHigh.y - temp.y;
    record.scratchNormal.z = tempHigh.z - temp.z;
    return Cesium.Cartesian3.normalize(record.scratchNormal, record.scratchNormal);
  }

  /** 圆扩散片元着色器。 */
  private static getFragmentShader(): string {
    return `
      uniform sampler2D colorTexture;
      uniform sampler2D depthTexture;
      in vec2 v_textureCoordinates;
      uniform vec4 u_scanCenterEC;
      uniform vec3 u_scanPlaneNormalEC;
      uniform float u_radius;
      uniform vec4 u_scanColor;
      out vec4 fragColor;
      vec4 toEye(in vec2 uv, in float depth) {
        vec2 xy = vec2((uv.x * 2.0 - 1.0), (uv.y * 2.0 - 1.0));
        vec4 posInCamera = czm_inverseProjection * vec4(xy, depth, 1.0);
        posInCamera = posInCamera / posInCamera.w;
        return posInCamera;
      }
      vec3 pointProjectOnPlane(in vec3 planeNormal, in vec3 planeOrigin, in vec3 point) {
        vec3 v01 = point - planeOrigin;
        float d = dot(planeNormal, v01);
        return point - planeNormal * d;
      }
      float getDepth(in vec4 depth) {
        float z_window = czm_unpackDepth(depth);
        z_window = czm_reverseLogDepth(z_window);
        float n_range = czm_depthRange.near;
        float f_range = czm_depthRange.far;
        return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
      }
      void main() {
        fragColor = texture(colorTexture, v_textureCoordinates);
        float depth = getDepth(texture(depthTexture, v_textureCoordinates));
        vec4 viewPos = toEye(v_textureCoordinates, depth);
        vec3 prjOnPlane = pointProjectOnPlane(u_scanPlaneNormalEC.xyz, u_scanCenterEC.xyz, viewPos.xyz);
        float dis = length(prjOnPlane.xyz - u_scanCenterEC.xyz);
        if (dis < u_radius) {
          float f = 1.0 - abs(u_radius - dis) / u_radius;
          f = pow(f, 18.0);
          fragColor = mix(fragColor, u_scanColor, f);
        }
        fragColor.a = fragColor.a / 2.0;
      }
    `;
  }
}
