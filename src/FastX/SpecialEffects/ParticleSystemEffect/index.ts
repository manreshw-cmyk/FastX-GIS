/**
 * 粒子系统特效基类。
 * 基于 Cesium.ParticleSystem 封装通用的粒子创建、更新、显隐、重启和销毁能力，爆炸、烟雾等粒子类特效可继承复用。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  isValidViewer,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";

/** 粒子发射器类型。 */
export type ParticleEmitterType = "circle" | "box" | "cone" | "sphere";

/** 粒子发射器配置。 */
export interface ParticleEmitterOptions {
  /** 发射器类型，默认 cone。 */
  type?: ParticleEmitterType;
  /** circle/sphere 发射器半径，单位：米。 */
  radius?: number;
  /** box 发射器长宽高，单位：米。 */
  dimensions?: readonly [width: number, height: number, depth: number];
  /** cone 发射器夹角，单位：度。 */
  angle?: number;
}

/** 粒子爆发配置。 */
export interface ParticleBurstOptions {
  /** 从粒子系统生命周期开始计算的爆发时间，单位：秒。 */
  time: number;
  /** 本次爆发最小粒子数。 */
  minimum: number;
  /** 本次爆发最大粒子数。 */
  maximum: number;
}

/** 近远距离缩放或透明度配置。 */
export type ParticleNearFarInput =
  | Cesium.NearFarScalar
  | readonly [near: number, nearValue: number, far: number, farValue: number];

/** 可选的粒子可见距离配置。 */
export type ParticleDistanceInput =
  | Cesium.DistanceDisplayCondition
  | readonly [near: number, far: number];

/** 判断可见距离配置是否为数组格式。 */
function isParticleDistanceTuple(distance: ParticleDistanceInput): distance is readonly [near: number, far: number] {
  return Array.isArray(distance);
}

/** 新增粒子系统参数。 */
export interface ParticleSystemEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 粒子系统世界位置。 */
  position: SpecialEffectsPositionInput;
  /** 是否显示，默认 true。 */
  show?: boolean;
  /** 粒子图片路径、Image 或 Canvas。 */
  image?: string | HTMLImageElement | HTMLCanvasElement;
  /** 每秒发射粒子数量。 */
  emissionRate?: number;
  /** 粒子发射器配置。 */
  emitter?: ParticleEmitterOptions;
  /** 发射器本地偏移，单位：米。 */
  offset?: readonly [x: number, y: number, z: number];
  /** 航向角，单位：度。 */
  heading?: number;
  /** 俯仰角，单位：度。 */
  pitch?: number;
  /** 翻滚角，单位：度。 */
  roll?: number;
  /** 生命周期内的粒子爆发配置。 */
  bursts?: readonly ParticleBurstOptions[];
  /** 生命周期结束后是否循环，默认 true。 */
  loop?: boolean;
  /** 固定粒子缩放。 */
  scale?: number;
  /** 粒子出生时缩放。 */
  startScale?: number;
  /** 粒子消失时缩放。 */
  endScale?: number;
  /** 固定粒子颜色。 */
  color?: SpecialEffectsColorInput;
  /** 粒子出生时颜色。 */
  startColor?: SpecialEffectsColorInput;
  /** 粒子消失时颜色。 */
  endColor?: SpecialEffectsColorInput;
  /** 固定粒子图片尺寸，单位：像素。 */
  imageSize?: readonly [width: number, height: number];
  /** 最小粒子图片尺寸，单位：像素。 */
  minImageSize?: readonly [width: number, height: number];
  /** 最大粒子图片尺寸，单位：像素。 */
  maxImageSize?: readonly [width: number, height: number];
  /** 粒子尺寸是否按米计算。 */
  sizeInMeters?: boolean;
  /** 固定粒子速度，单位：米/秒。 */
  speed?: number;
  /** 最小粒子速度，单位：米/秒。 */
  minSpeed?: number;
  /** 最大粒子速度，单位：米/秒。 */
  maxSpeed?: number;
  /** 粒子系统发射持续时间，单位：秒。 */
  lifetime?: number;
  /** 单个粒子固定生命周期，单位：秒。 */
  particleLife?: number;
  /** 单个粒子最小生命周期，单位：秒。 */
  minLife?: number;
  /** 单个粒子最大生命周期，单位：秒。 */
  maxLife?: number;
  /** 固定粒子质量，单位：千克。 */
  mass?: number;
  /** 最小粒子质量，单位：千克。 */
  minMass?: number;
  /** 最大粒子质量，单位：千克。 */
  maxMass?: number;
  /** 粒子可见距离。 */
  visibleDistance?: ParticleDistanceInput;
  /** 近远距离缩放配置。 */
  scaleByDistance?: ParticleNearFarInput;
  /** 近远距离透明度配置。 */
  translucencyByDistance?: ParticleNearFarInput;
  /** 每帧粒子更新回调，可用于添加重力、风向等外力。 */
  updateCallback?: Cesium.ParticleSystem.updateCallback;
}

/** 粒子系统更新参数。 */
export type ParticleSystemEffectUpdateOptions = Partial<Omit<ParticleSystemEffectAddOptions, "id">>;

/** 已解析的粒子系统参数。 */
interface ResolvedParticleSystemEffectOptions extends ParticleSystemEffectAddOptions {
  /** 唯一 id。 */
  id: string;
  /** 世界坐标位置。 */
  cartesian: Cesium.Cartesian3;
  /** 是否显示。 */
  show: boolean;
}

/** 粒子系统内部记录。 */
interface ParticleSystemEffectRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 粒子系统 id。 */
  id: string;
  /** Cesium 粒子系统实例。 */
  system: Cesium.ParticleSystem;
  /** 已解析参数。 */
  options: ResolvedParticleSystemEffectOptions;
  /** 场景逐帧监听移除函数。 */
  removeRenderListener: () => void;
}

/** 通用粒子系统特效管理器。 */
export default class ParticleSystemEffect {
  /** 自动生成 id 时使用的前缀。 */
  private readonly idPrefix: string;
  /** 兼容 new Class(viewer).add(options) 的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前管理的粒子系统记录。 */
  private readonly records = new Map<string, ParticleSystemEffectRecord>();

  constructor(viewer?: Cesium.Viewer, idPrefix = "particle-system") {
    this.defaultViewer = viewer;
    this.idPrefix = idPrefix;
  }

  /** 新增粒子系统，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: ParticleSystemEffectAddOptions): string | undefined;
  add(options: ParticleSystemEffectAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | ParticleSystemEffectAddOptions,
    maybeOptions?: ParticleSystemEffectAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;

    const id = resolved.options.id ?? createSpecialEffectId(this.idPrefix);
    if (this.records.has(id)) return undefined;

    const options = this.resolveOptions({ ...resolved.options, id });
    const record = this.createRecord(resolved.viewer, id, options);
    this.records.set(id, record);
    requestSceneRender(resolved.viewer);
    return id;
  }

  /** 批量新增粒子系统，返回成功创建的 id 集合。 */
  addMany(viewer: Cesium.Viewer, options: ParticleSystemEffectAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 更新粒子系统，内部会按最新参数重建 Cesium.ParticleSystem。 */
  update(id: string, options: ParticleSystemEffectUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    const nextOptions = this.resolveOptions({ ...record.options, ...options, id });
    this.replaceRecord(record, nextOptions);
    return true;
  }

  /** 重新播放非循环粒子系统。 */
  restart(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.replaceRecord(record, record.options);
    return true;
  }

  /** 设置指定粒子系统显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.system.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定 Cesium.ParticleSystem 实例。 */
  get(id: string): Cesium.ParticleSystem | undefined {
    return this.records.get(id)?.system;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定粒子系统。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeParticleSystem(record);
    this.records.delete(id);
    return true;
  }

  /** 清空全部粒子系统；传入 viewer 时只清空该 Viewer 下的粒子系统。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部粒子系统。 */
  destroy(): void {
    this.clear();
  }

  /** 合并默认参数并转换坐标，子类可覆盖此方法注入业务默认值。 */
  protected resolveOptions(
    options: ParticleSystemEffectAddOptions & { id: string },
  ): ResolvedParticleSystemEffectOptions {
    return {
      ...options,
      cartesian: toCartesian3(options.position),
      show: options.show ?? true,
    };
  }

  /** 创建 Cesium 粒子系统。 */
  protected createParticleSystem(options: ResolvedParticleSystemEffectOptions): Cesium.ParticleSystem {
    return new Cesium.ParticleSystem({
      show: options.show,
      updateCallback: options.updateCallback,
      emitter: this.createEmitter(options.emitter),
      modelMatrix: this.createModelMatrix(options),
      emitterModelMatrix: this.createEmitterModelMatrix(options),
      emissionRate: options.emissionRate,
      bursts: options.bursts?.map((burst) => new Cesium.ParticleBurst(burst)),
      loop: options.loop,
      scale: options.scale,
      startScale: options.startScale,
      endScale: options.endScale,
      color: options.color ? toCesiumColor(options.color, Cesium.Color.WHITE) : undefined,
      startColor: options.startColor ? toCesiumColor(options.startColor, Cesium.Color.WHITE) : undefined,
      endColor: options.endColor ? toCesiumColor(options.endColor, Cesium.Color.TRANSPARENT) : undefined,
      image: options.image,
      imageSize: this.toCartesian2(options.imageSize),
      minimumImageSize: this.toCartesian2(options.minImageSize),
      maximumImageSize: this.toCartesian2(options.maxImageSize),
      sizeInMeters: options.sizeInMeters,
      speed: options.speed,
      minimumSpeed: options.minSpeed,
      maximumSpeed: options.maxSpeed,
      lifetime: options.lifetime,
      particleLife: options.particleLife,
      minimumParticleLife: options.minLife,
      maximumParticleLife: options.maxLife,
      mass: options.mass,
      minimumMass: options.minMass,
      maximumMass: options.maxMass,
    });
  }

  /** 创建粒子发射器。 */
  protected createEmitter(emitter: ParticleEmitterOptions = {}): Cesium.ParticleEmitter {
    switch (emitter.type ?? "cone") {
      case "circle":
        return new Cesium.CircleEmitter(emitter.radius ?? 1);
      case "box":
        return new Cesium.BoxEmitter(this.toCartesian3Dimensions(emitter.dimensions ?? [1, 1, 1]));
      case "sphere":
        return new Cesium.SphereEmitter(emitter.radius ?? 1);
      case "cone":
      default:
        return new Cesium.ConeEmitter(Cesium.Math.toRadians(emitter.angle ?? 30));
    }
  }

  /** 创建粒子系统世界矩阵。 */
  protected createModelMatrix(options: ResolvedParticleSystemEffectOptions): Cesium.Matrix4 {
    return Cesium.Transforms.eastNorthUpToFixedFrame(options.cartesian);
  }

  /** 创建发射器相对粒子系统的局部矩阵。 */
  protected createEmitterModelMatrix(options: ResolvedParticleSystemEffectOptions): Cesium.Matrix4 {
    const translation = this.toCartesian3Dimensions(options.offset ?? [0, 0, 0]);
    const rotation = Cesium.Matrix3.fromHeadingPitchRoll(
      new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(options.heading ?? 0),
        Cesium.Math.toRadians(options.pitch ?? 0),
        Cesium.Math.toRadians(options.roll ?? 0),
      ),
    );
    return Cesium.Matrix4.fromRotationTranslation(rotation, translation);
  }

  /** 将二维数组转换为 Cartesian2。 */
  protected toCartesian2(size?: readonly [width: number, height: number]): Cesium.Cartesian2 | undefined {
    return size ? new Cesium.Cartesian2(size[0], size[1]) : undefined;
  }

  /** 将三维数组转换为 Cartesian3。 */
  protected toCartesian3Dimensions(value: readonly [x: number, y: number, z: number]): Cesium.Cartesian3 {
    return new Cesium.Cartesian3(value[0], value[1], value[2]);
  }

  /** 创建粒子系统内部记录。 */
  private createRecord(
    viewer: Cesium.Viewer,
    id: string,
    options: ResolvedParticleSystemEffectOptions,
  ): ParticleSystemEffectRecord {
    let currentRecord: ParticleSystemEffectRecord | undefined;
    const system = this.createParticleSystem(options);
    viewer.scene.primitives.add(system as unknown as Cesium.Primitive);

    const listener = () => {
      const record = this.records.get(id) ?? currentRecord;
      if (!record) return;
      record.system.show = this.shouldShowByDistance(record);
      if (record.options.show) requestSceneRender(viewer);
    };
    viewer.scene.preRender.addEventListener(listener);

    currentRecord = {
      viewer,
      id,
      system,
      options,
      removeRenderListener: () => viewer.scene.preRender.removeEventListener(listener),
    };
    return currentRecord;
  }

  /** 兼容 add(viewer, options) 和 new Class(viewer).add(options) 两种调用方式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | ParticleSystemEffectAddOptions,
    maybeOptions?: ParticleSystemEffectAddOptions,
  ): { viewer: Cesium.Viewer; options: ParticleSystemEffectAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as ParticleSystemEffectAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  /** 使用新参数替换一条粒子系统记录。 */
  private replaceRecord(record: ParticleSystemEffectRecord, options: ResolvedParticleSystemEffectOptions): void {
    this.removeParticleSystem(record);
    this.records.set(record.id, this.createRecord(record.viewer, record.id, options));
    requestSceneRender(record.viewer);
  }

  /** 从场景中移除并销毁粒子系统。 */
  private removeParticleSystem(record: ParticleSystemEffectRecord): void {
    record.removeRenderListener();
    record.viewer.scene.primitives.remove(record.system as unknown as Cesium.Primitive);
    if (!record.system.isDestroyed()) record.system.destroy();
    requestSceneRender(record.viewer);
  }

  /** 根据可见距离和显隐状态计算粒子系统当前是否显示。 */
  private shouldShowByDistance(record: ParticleSystemEffectRecord): boolean {
    if (!record.options.show) return false;
    if (!record.options.visibleDistance) return true;

    const condition = this.toDistanceDisplayCondition(record.options.visibleDistance);
    const distance = Cesium.Cartesian3.distance(record.viewer.camera.positionWC, record.options.cartesian);
    return distance >= condition.near && distance <= condition.far;
  }

  /** 将数组或 Cesium.DistanceDisplayCondition 统一为 DistanceDisplayCondition。 */
  private toDistanceDisplayCondition(distance: ParticleDistanceInput): Cesium.DistanceDisplayCondition {
    return isParticleDistanceTuple(distance)
      ? new Cesium.DistanceDisplayCondition(distance[0], distance[1])
      : distance;
  }
}
