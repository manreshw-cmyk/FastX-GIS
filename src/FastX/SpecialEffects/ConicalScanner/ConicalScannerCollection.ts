/**
 * 锥体扫描 Primitive 批量绘制类。
 * 使用 Primitive 批量绘制多个锥体扫描特效。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildConicalScannerSpec } from "../common/radar-builders";
import type {
  ConicalScannerAddOptions,
  ConicalScannerResolvedOptions,
  ConicalScannerUpdateOptions,
} from ".";
import { resolveConicalScannerOptions } from ".";

/** 锥体扫描 Primitive 批量绘制类。 */
export default class ConicalScannerCollection extends RenderablePrimitiveEffect<
  ConicalScannerAddOptions,
  ConicalScannerResolvedOptions
> {
  constructor() {
    super("conical-scanner", buildConicalScannerSpec, resolveConicalScannerOptions);
  }

  /** 批量新增锥体扫描 Primitive，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: ConicalScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定锥体扫描 Primitive。 */
  override update(id: string, options: ConicalScannerUpdateOptions): boolean {
    return super.update(id, options);
  }
}
