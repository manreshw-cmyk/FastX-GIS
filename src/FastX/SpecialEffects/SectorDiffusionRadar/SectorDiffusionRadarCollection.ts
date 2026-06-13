/**
 * 扇形扩散雷达 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个扇形扩散雷达范围。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildDiffusionRadarSpec } from "../common/radar-builders";
import type {
  SectorDiffusionRadarAddOptions,
  SectorDiffusionRadarResolvedOptions,
  SectorDiffusionRadarUpdateOptions,
} from ".";
import { resolveSectorDiffusionRadarOptions } from ".";

/** 扇形扩散雷达 Primitive 批量绘制类。 */
export default class SectorDiffusionRadarCollection extends RenderablePrimitiveEffect<
  SectorDiffusionRadarAddOptions,
  SectorDiffusionRadarResolvedOptions
> {
  constructor() {
    super("sector-diffusion-radar", buildDiffusionRadarSpec, resolveSectorDiffusionRadarOptions);
  }

  /** 批量新增扇形扩散雷达 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: SectorDiffusionRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定扇形扩散雷达 Primitive。 */
  override update(id: string, options: SectorDiffusionRadarUpdateOptions): boolean {
    return super.update(id, options);
  }
}
