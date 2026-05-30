import type { LngLatHeightTuple } from '../types'
import { computeVisualDistance } from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

/** 多点通视：预览动态折线 + 实时通视射线 */
export class MultiPointAnalyze extends MeasureBase {
  private previewGen = 0

  /**
   * 设置观测点与目标点（眼高 +1.3m）。
   * @param positions 顶点列表
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = positions.map((p) => [p[0], p[1], (p[2] ?? 0) + 1.3] as LngLatHeightTuple)
    this.syncKeyPoints(this.positions)
    if (this.positions.length >= 2) {
      void this.renderPreviewToCursor(this.positions[this.positions.length - 1]!)
    }
  }

  /**
   * 鼠标移动预览通视射线。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const gen = ++this.previewGen
    void this.renderPreviewToCursor([cursor[0], cursor[1], (cursor[2] ?? 0) + 1.3], gen)
  }

  /** 完成测量，绘制全部目标点通视射线 */
  complete(): void {
    void this.renderFromObserver()
  }

  /**
   * 从观测点预览到光标目标的通视射线。
   * @param target 目标点
   * @param gen 预览代数
   */
  private async renderPreviewToCursor(target: LngLatHeightTuple, gen?: number): Promise<void> {
    const observer = this.positions[0]
    if (!observer) return
    this.clearSegmentEntities()
    const preview = [...this.positions, target]
    this.setDynamicLinePositions(preview, { clamp: false, color: this.style.lineColor })
    const obj = await computeVisualDistance(this.viewer, [observer, target])
    if (gen !== undefined && gen !== this.previewGen) return
    for (let j = 0; j < obj.positions.length - 1; j++) {
      const seg = [obj.positions[j]!, obj.positions[j + 1]!]
      const color = j % 2 === 0 ? this.style.visibleLineColor : this.style.invisibleLineColor
      this.drawSegmentPolyline(seg, color, this.style.lineWidth, true)
    }
  }

  /** 从观测点向各目标点绘制通视射线与标注 */
  private async renderFromObserver(): Promise<void> {
    const observer = this.positions[0]
    if (!observer) return
    this.clearDynamicLine()
    this.clearSegmentEntities()
    this.syncKeyPoints(this.positions)
    for (let i = 1; i < this.positions.length; i++) {
      const target = this.positions[i]!
      const obj = await computeVisualDistance(this.viewer, [observer, target])
      for (let j = 0; j < obj.positions.length - 1; j++) {
        const seg = [obj.positions[j]!, obj.positions[j + 1]!]
        const color = j % 2 === 0 ? this.style.visibleLineColor : this.style.invisibleLineColor
        this.drawSegmentPolyline(seg, color, this.style.lineWidth, true)
      }
      this.drawLabel(target, createMeasureLabelText('可视', obj.visibleDistance))
    }
  }
}
