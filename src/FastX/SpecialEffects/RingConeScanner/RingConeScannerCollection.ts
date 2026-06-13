/**
 * 双圆锥环面扫描体 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个双圆锥环面扫描体。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildRingConeSpec } from "../common/radar-builders";
import type {
  RingConeScannerAddOptions,
  RingConeScannerResolvedOptions,
  RingConeScannerUpdateOptions,
} from ".";
import { resolveRingConeScannerOptions } from ".";

/** 双圆锥环面扫描体 Primitive 批量绘制类。 */
export default class RingConeScannerCollection extends RenderablePrimitiveEffect<
  RingConeScannerAddOptions,
  RingConeScannerResolvedOptions
> {
  constructor() {
    super("ring-cone-scanner", buildRingConeSpec, resolveRingConeScannerOptions);
  }

  /** 批量新增双圆锥环面扫描体 Primitive，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: RingConeScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定双圆锥环面扫描体 Primitive。 */
  override update(id: string, options: RingConeScannerUpdateOptions): boolean {
    return super.update(id, options);
  }
}
