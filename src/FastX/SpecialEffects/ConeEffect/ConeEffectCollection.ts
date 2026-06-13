/**
 * 圆锥特效 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个圆锥扫描范围。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildConeLikeSpec } from "../common/radar-builders";
import type { ConeEffectAddOptions, ConeEffectResolvedOptions, ConeEffectUpdateOptions } from ".";
import { resolveConeEffectOptions } from ".";

/** 圆锥特效 Primitive 批量绘制类。 */
export default class ConeEffectCollection extends RenderablePrimitiveEffect<
  ConeEffectAddOptions,
  ConeEffectResolvedOptions
> {
  constructor() {
    super("cone-effect", buildConeLikeSpec, resolveConeEffectOptions);
  }

  /** 批量新增圆锥特效 Primitive，返回成功创建的 id。 */
  addCones(viewer: Cesium.Viewer, options: ConeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定圆锥特效 Primitive。 */
  override update(id: string, options: ConeEffectUpdateOptions): boolean {
    return super.update(id, options);
  }
}
