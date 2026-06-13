/**
 * 环形雷达扫描 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个环形雷达扫描特效。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildRingRadarSpec } from "../common/radar-builders";
import type { RingRadarAddOptions, RingRadarResolvedOptions, RingRadarUpdateOptions } from ".";
import { resolveRingRadarOptions } from ".";

/** 环形雷达扫描 Primitive 批量绘制类。 */
export default class RingRadarCollection extends RenderablePrimitiveEffect<
  RingRadarAddOptions,
  RingRadarResolvedOptions
> {
  constructor() {
    super("ring-radar", buildRingRadarSpec, resolveRingRadarOptions);
  }

  /** 批量新增环形雷达扫描 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定环形雷达扫描 Primitive。 */
  override update(id: string, options: RingRadarUpdateOptions): boolean {
    return super.update(id, options);
  }
}
