/**
 * 空中雷达 Primitive 批量绘制类。
 * 使用共享几何规格批量绘制多个空中雷达，适合大批量目标探测范围展示。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildConeLikeSpec } from "../common/radar-builders";
import type { AirRadarAddOptions, AirRadarResolvedOptions, AirRadarUpdateOptions } from ".";
import { resolveAirRadarOptions } from ".";

/** 空中雷达 Primitive 批量绘制类。 */
export default class AirRadarCollection extends RenderablePrimitiveEffect<
  AirRadarAddOptions,
  AirRadarResolvedOptions
> {
  constructor() {
    super("air-radar", buildConeLikeSpec, resolveAirRadarOptions);
  }

  /** 批量新增空中雷达 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: AirRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定空中雷达 Primitive。 */
  override update(id: string, options: AirRadarUpdateOptions): boolean {
    return super.update(id, options);
  }
}
