import type { LngLatHeightTuple } from '../types'
import { computeLineLength } from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

/**
 * 空间距离测量。
 * 按折线各段三维欧氏距离累加，不考虑贴地；用于空中/模型表面直线距离量算。
 */
export class LineDistanceMeasure extends MeasureBase {
  /**
   * 根据关键点绘制折线与累计空间距离标注。
   * @param positions 折线顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions]
    this.syncKeyPoints(positions)
    this.setDynamicLinePositions(positions, false)
    if (positions.length >= 2) {
      const d = computeLineLength(positions)
      this.updateMeasureLabel(
        positions[positions.length - 1]!,
        createMeasureLabelText('空间距离', d),
      )
    }
  }

  /**
   * 鼠标移动时用「已定点 + 光标」预览折线与距离。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const preview = [...this.positions, cursor]
    this.setDynamicLinePositions(preview, false)
    if (preview.length >= 2) {
      const d = computeLineLength(preview)
      this.updateMeasureLabel(cursor, createMeasureLabelText('空间距离', d))
    }
  }

  /** 右键结束时将折线固定为最终锚点 */
  complete(): void {
    this.setDynamicLinePositions(this.positions, false)
    if (this.positions.length >= 2) {
      const d = computeLineLength(this.positions)
      this.updateMeasureLabel(
        this.positions[this.positions.length - 1]!,
        createMeasureLabelText('空间距离', d),
      )
    }
  }
}
