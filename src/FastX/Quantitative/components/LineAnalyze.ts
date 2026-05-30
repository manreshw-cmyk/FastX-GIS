import type { LngLatHeightTuple } from '../types'
import { computeVisualDistance } from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

/** 直线通视：绘制中实时绿/红通视射线 */
export class LineAnalyze extends MeasureBase {
  private previewGen = 0

  /**
   * 设置两点并计算通视分段。
   * @param positions 最多取前两点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = positions.slice(0, 2)
    this.syncKeyPoints(this.positions)
    if (this.positions.length < 2) {
      this.clearDynamicLine()
      this.clearSegmentEntities()
      return
    }
    void this.renderVisibility(this.positions)
  }

  /**
   * 鼠标移动预览通视射线。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const anchor = this.positions[0]!
    const gen = ++this.previewGen
    void this.renderVisibility([anchor, cursor], gen)
  }

  /** 完成测量，固定通视结果 */
  complete(): void {
    if (this.positions.length >= 2) {
      this.syncKeyPoints(this.positions)
      void this.renderVisibility(this.positions)
    }
  }

  /**
   * 异步计算并绘制通视/不通视分段线。
   * @param pts 观测线段
   * @param gen 预览代数（用于丢弃过期结果）
   */
  private async renderVisibility(pts: LngLatHeightTuple[], gen?: number): Promise<void> {
    if (pts.length < 2) return
    this.clearDynamicLine()
    this.clearSegmentEntities()
    const obj = await computeVisualDistance(this.viewer, pts)
    if (gen !== undefined && gen !== this.previewGen) return
    for (let i = 0; i < obj.positions.length - 1; i++) {
      const seg = [obj.positions[i]!, obj.positions[i + 1]!]
      const color = i % 2 === 0 ? this.style.visibleLineColor : this.style.invisibleLineColor
      this.drawSegmentPolyline(seg, color, this.style.lineWidth, true)
    }
    if (pts[1]) {
      this.updateMeasureLabel(pts[1], createMeasureLabelText('可视距离', obj.visibleDistance))
    }
  }
}
