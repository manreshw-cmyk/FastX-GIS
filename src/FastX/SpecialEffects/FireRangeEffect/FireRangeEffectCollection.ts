/**
 * 火力范围 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个球面火力覆盖范围。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildSphericalSectorSpec } from "../common/radar-builders";
import type {
  FireRangeEffectAddOptions,
  FireRangeEffectResolvedOptions,
  FireRangeEffectUpdateOptions,
} from ".";
import { resolveFireRangeEffectOptions } from ".";

/** 火力范围 Primitive 批量绘制类。 */
export default class FireRangeEffectCollection extends RenderablePrimitiveEffect<
  FireRangeEffectAddOptions,
  FireRangeEffectResolvedOptions
> {
  constructor() {
    super("fire-range-effect", buildSphericalSectorSpec, resolveFireRangeEffectOptions);
  }

  /** 批量新增火力范围 Primitive，返回成功创建的 id。 */
  addRanges(viewer: Cesium.Viewer, options: FireRangeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定火力范围 Primitive。 */
  override update(id: string, options: FireRangeEffectUpdateOptions): boolean {
    return super.update(id, options);
  }
}
