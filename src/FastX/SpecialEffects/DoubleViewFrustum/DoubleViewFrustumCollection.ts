/**
 * 双面视锥体 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个双面视锥体。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildDoubleFrustumSpec } from "../common/radar-builders";
import type {
  DoubleViewFrustumAddOptions,
  DoubleViewFrustumResolvedOptions,
  DoubleViewFrustumUpdateOptions,
} from ".";
import { resolveDoubleViewFrustumOptions } from ".";

/** 双面视锥体 Primitive 批量绘制类。 */
export default class DoubleViewFrustumCollection extends RenderablePrimitiveEffect<
  DoubleViewFrustumAddOptions,
  DoubleViewFrustumResolvedOptions
> {
  constructor() {
    super("double-view-frustum", buildDoubleFrustumSpec, resolveDoubleViewFrustumOptions);
  }

  /** 批量新增双面视锥体 Primitive，返回成功创建的 id。 */
  addFrustums(viewer: Cesium.Viewer, options: DoubleViewFrustumAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定双面视锥体 Primitive。 */
  override update(id: string, options: DoubleViewFrustumUpdateOptions): boolean {
    return super.update(id, options);
  }
}
