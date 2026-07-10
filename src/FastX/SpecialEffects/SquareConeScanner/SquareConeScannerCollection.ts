/**
 * 四方视椎体 Primitive 批量绘制类。
 * 与单体 Entity 类共用参数解析和几何生成，保证两种绘制方式效果一致。
 */
import * as Cesium from "cesium";
import { RenderablePrimitiveEffect } from "../common/renderable-effect";
import { buildSquareConeSpec } from "../common/radar-builders";
import type {
  SquareConeScannerAddOptions,
  SquareConeScannerResolvedOptions,
  SquareConeScannerUpdateOptions,
} from ".";
import { resolveSquareConeScannerOptions } from ".";

/** 使用 Primitive 批量绘制多个四方视椎体。 */
export default class SquareConeScannerCollection extends RenderablePrimitiveEffect<
  SquareConeScannerAddOptions,
  SquareConeScannerResolvedOptions
> {
  constructor() {
    super("square-cone-scanner", buildSquareConeSpec, resolveSquareConeScannerOptions);
  }

  /** 批量新增四方视椎体 Primitive，返回成功创建的 id。 */
  addScanners(viewer: Cesium.Viewer, options: SquareConeScannerAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定四方视椎体 Primitive。 */
  override update(id: string, options: SquareConeScannerUpdateOptions): boolean {
    return super.update(id, options);
  }
}
