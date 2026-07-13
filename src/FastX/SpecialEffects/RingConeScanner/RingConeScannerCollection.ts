/**
 * 双圆锥环面扫描体 Primitive 批量绘制类。
 * 复用单体 Entity 的几何构建逻辑，保证单个绘制和批量绘制效果一致。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import type {
  RingConeScannerAddOptions,
  RingConeScannerResolvedOptions,
  RingConeScannerUpdateOptions,
} from ".";
import { buildRingConeScannerSpec, resolveRingConeScannerOptions } from ".";

/** 双圆锥环面扫描体 Primitive 批量绘制类。 */
export default class RingConeScannerCollection extends RenderablePrimitiveEffect<
  RingConeScannerAddOptions,
  RingConeScannerResolvedOptions
> {
  constructor() {
    super("ring-cone-scanner", buildRingConeScannerSpec, resolveRingConeScannerOptions);
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
