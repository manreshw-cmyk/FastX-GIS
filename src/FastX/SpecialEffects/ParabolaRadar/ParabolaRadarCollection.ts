/**
 * 抛物面雷达 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个抛物面雷达。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildParabolaRadarSpec } from "../common/radar-builders";
import type { ParabolaRadarAddOptions, ParabolaRadarResolvedOptions, ParabolaRadarUpdateOptions } from ".";
import { resolveParabolaRadarOptions } from ".";

/** 抛物面雷达 Primitive 批量绘制类。 */
export default class ParabolaRadarCollection extends RenderablePrimitiveEffect<
  ParabolaRadarAddOptions,
  ParabolaRadarResolvedOptions
> {
  constructor() {
    super("parabola-radar", buildParabolaRadarSpec, resolveParabolaRadarOptions);
  }

  /** 批量新增抛物面雷达 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: ParabolaRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定抛物面雷达 Primitive。 */
  override update(id: string, options: ParabolaRadarUpdateOptions): boolean {
    return super.update(id, options);
  }
}
