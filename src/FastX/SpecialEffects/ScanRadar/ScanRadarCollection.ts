/**
 * 扫描雷达 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个扫描雷达体。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildSphericalSectorSpec } from "../common/radar-builders";
import type { ScanRadarAddOptions, ScanRadarResolvedOptions, ScanRadarUpdateOptions } from ".";
import { resolveScanRadarOptions } from ".";

/** 扫描雷达 Primitive 批量绘制类。 */
export default class ScanRadarCollection extends RenderablePrimitiveEffect<
  ScanRadarAddOptions,
  ScanRadarResolvedOptions
> {
  constructor() {
    super("scan-radar", buildSphericalSectorSpec, resolveScanRadarOptions);
  }

  /** 批量新增扫描雷达 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: ScanRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定扫描雷达 Primitive。 */
  override update(id: string, options: ScanRadarUpdateOptions): boolean {
    return super.update(id, options);
  }
}
