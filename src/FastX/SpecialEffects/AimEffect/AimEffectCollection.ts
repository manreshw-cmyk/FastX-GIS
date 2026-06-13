/**
 * 瞄准特效 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个发射平台到目标点的瞄准关系。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildAimEffectSpec } from "../common/radar-builders";
import type { AimEffectAddOptions, AimEffectResolvedOptions, AimEffectUpdateOptions } from ".";
import { resolveAimEffectOptions } from ".";

/** 瞄准特效 Primitive 批量绘制类。 */
export default class AimEffectCollection extends RenderablePrimitiveEffect<
  AimEffectAddOptions,
  AimEffectResolvedOptions
> {
  constructor() {
    super("aim-effect", buildAimEffectSpec, resolveAimEffectOptions);
  }

  /** 批量新增瞄准特效 Primitive，返回成功创建的 id。 */
  addEffects(viewer: Cesium.Viewer, options: AimEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定瞄准特效 Primitive。 */
  override update(id: string, options: AimEffectUpdateOptions): boolean {
    return super.update(id, options);
  }
}
