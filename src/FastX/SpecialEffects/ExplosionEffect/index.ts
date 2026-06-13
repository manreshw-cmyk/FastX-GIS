/**
 * 爆炸粒子特效。
 * 继承粒子系统基类，默认使用参考实现中的 cone 发射器、fire2 粒子贴图和非循环爆发参数。
 */
import * as Cesium from "cesium";
import ParticleSystemEffect, {
  ParticleSystemEffectAddOptions,
  ParticleSystemEffectUpdateOptions,
} from "../ParticleSystemEffect";

/** 默认爆炸粒子图片。 */
export const DEFAULT_EXPLOSION_PARTICLE_IMAGE = "/assets/images/special-effects/explosion/fire2.png";

/** 新增爆炸粒子特效参数。 */
export interface ExplosionEffectAddOptions extends ParticleSystemEffectAddOptions {
  /** 爆炸总生命周期，单位：秒；内部会按 0.7 倍映射到粒子系统生命周期。 */
  lifeTime?: number;
}

/** 爆炸粒子特效更新参数。 */
export type ExplosionEffectUpdateOptions = ParticleSystemEffectUpdateOptions & {
  /** 爆炸总生命周期，单位：秒。 */
  lifeTime?: number;
};

/** 已解析的爆炸粒子参数。 */
type ResolvedExplosionEffectOptions = ExplosionEffectAddOptions & {
  /** 唯一 id。 */
  id: string;
  /** 世界坐标位置。 */
  cartesian: Cesium.Cartesian3;
  /** 是否显示。 */
  show: boolean;
};

/** 爆炸粒子特效管理器。 */
export default class ExplosionEffect extends ParticleSystemEffect {
  constructor(viewer?: Cesium.Viewer) {
    super(viewer, "explosion-effect");
  }

  /** 新增爆炸效果，返回特效 id。 */
  override add(viewer: Cesium.Viewer, options: ExplosionEffectAddOptions): string | undefined;
  override add(options: ExplosionEffectAddOptions): string | undefined;
  override add(
    viewerOrOptions: Cesium.Viewer | ExplosionEffectAddOptions,
    maybeOptions?: ExplosionEffectAddOptions,
  ): string | undefined {
    return super.add(viewerOrOptions as Cesium.Viewer, maybeOptions as ExplosionEffectAddOptions);
  }

  /** 批量新增爆炸效果。 */
  addExplosions(viewer: Cesium.Viewer, options: ExplosionEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 合并爆炸粒子默认参数。 */
  protected override resolveOptions(options: ExplosionEffectAddOptions & { id: string }): ResolvedExplosionEffectOptions {
    const lifeTime = options.lifeTime ?? options.lifetime ?? 6;
    const particleLife = lifeTime * 0.7;
    return super.resolveOptions({
      ...options,
      image: options.image ?? DEFAULT_EXPLOSION_PARTICLE_IMAGE,
      emissionRate: options.emissionRate ?? 380,
      emitter: options.emitter ?? { type: "cone", angle: 50 },
      startColor: options.startColor ?? "rgba(219,146,91,0.5)",
      endColor: options.endColor ?? "rgba(180,146,91,0.1)",
      maxImageSize: options.maxImageSize ?? [90, 90],
      minImageSize: options.minImageSize ?? [30, 30],
      startScale: options.startScale ?? 1,
      endScale: options.endScale ?? 1,
      maxLife: options.maxLife ?? particleLife,
      minLife: options.minLife ?? particleLife,
      maxSpeed: options.maxSpeed ?? 35,
      minSpeed: options.minSpeed ?? 35,
      loop: options.loop ?? false,
      lifetime: options.lifetime ?? particleLife,
      bursts: options.bursts ?? [
        { time: particleLife / 4, minimum: 10, maximum: 100 },
        { time: particleLife / 3, minimum: 50, maximum: 100 },
        { time: particleLife / 2, minimum: 50, maximum: 100 },
        { time: particleLife, minimum: 200, maximum: 300 },
      ],
    }) as ResolvedExplosionEffectOptions;
  }
}
