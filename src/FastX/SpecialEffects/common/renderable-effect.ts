/**
 * SpecialEffects 可渲染空间特效基类。
 * 将“渲染规格 -> Entity/Primitive”的转换集中处理，具体特效只关心几何规格。
 */
import * as Cesium from "cesium";
import {
  EntityEffectBase,
  PrimitiveEffectBase,
  type ManagedEffectOptions,
} from "./effect-core";
import {
  EffectRenderSpec,
  createEntitiesFromSpec,
  createPrimitivesFromSpec,
} from "./effect-geometry";

/** 特效渲染规格构建函数。 */
export type RenderSpecBuilder<R extends ManagedEffectOptions & { id: string }> = (options: R) => EffectRenderSpec;

/** Entity 可渲染特效基类。 */
export class RenderableEntityEffect<
  T extends ManagedEffectOptions,
  R extends ManagedEffectOptions & { id: string },
> extends EntityEffectBase<T, R> {
  /** Entity 显示名称。 */
  private readonly effectName: string;
  /** 几何规格构建函数。 */
  private readonly builder: RenderSpecBuilder<R>;
  /** 参数解析函数。 */
  private readonly resolver: (options: T & { id: string }) => R;

  constructor(
    idPrefix: string,
    effectName: string,
    builder: RenderSpecBuilder<R>,
    resolver: (options: T & { id: string }) => R,
    defaultViewer?: Cesium.Viewer,
  ) {
    super(idPrefix, defaultViewer);
    this.effectName = effectName;
    this.builder = builder;
    this.resolver = resolver;
  }

  /** 合并默认参数。 */
  protected override resolveOptions(options: T & { id: string }): R {
    return this.resolver(options);
  }

  /** 根据渲染规格创建 Entity。 */
  protected override createEntities(
    viewer: Cesium.Viewer,
    id: string,
    options: R,
  ): Cesium.Entity[] {
    return createEntitiesFromSpec(viewer, id, this.builder(options), options.show ?? true, this.effectName);
  }
}

/** Primitive 可渲染特效基类。 */
export class RenderablePrimitiveEffect<
  T extends ManagedEffectOptions,
  R extends ManagedEffectOptions & { id: string },
> extends PrimitiveEffectBase<T, R> {
  /** 几何规格构建函数。 */
  private readonly builder: RenderSpecBuilder<R>;
  /** 参数解析函数。 */
  private readonly resolver: (options: T & { id: string }) => R;

  constructor(
    idPrefix: string,
    builder: RenderSpecBuilder<R>,
    resolver: (options: T & { id: string }) => R,
  ) {
    super(idPrefix);
    this.builder = builder;
    this.resolver = resolver;
  }

  /** 合并默认参数。 */
  protected override resolveOptions(options: T & { id: string }): R {
    return this.resolver(options);
  }

  /** 根据渲染规格创建 Primitive。 */
  protected override createPrimitives(
    viewer: Cesium.Viewer,
    id: string,
    options: R,
  ): Cesium.Primitive[] {
    return createPrimitivesFromSpec(viewer, id, this.builder(options), options.show ?? true);
  }
}
