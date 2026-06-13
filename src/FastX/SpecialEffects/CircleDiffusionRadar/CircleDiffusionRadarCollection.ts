/**
 * 圆形扩散雷达 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个圆形扩散雷达范围。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildDiffusionRadarSpec } from "../common/radar-builders";
import type {
  CircleDiffusionRadarAddOptions,
  CircleDiffusionRadarResolvedOptions,
  CircleDiffusionRadarUpdateOptions,
} from ".";
import { resolveCircleDiffusionRadarOptions } from ".";

/** 圆形扩散雷达 Primitive 批量绘制类。 */
export default class CircleDiffusionRadarCollection extends RenderablePrimitiveEffect<
  CircleDiffusionRadarAddOptions,
  CircleDiffusionRadarResolvedOptions
> {
  constructor() {
    super("circle-diffusion-radar", buildDiffusionRadarSpec, resolveCircleDiffusionRadarOptions);
  }

  /** 批量新增圆形扩散雷达 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: CircleDiffusionRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定圆形扩散雷达 Primitive。 */
  override update(id: string, options: CircleDiffusionRadarUpdateOptions): boolean {
    return super.update(id, options);
  }
}
