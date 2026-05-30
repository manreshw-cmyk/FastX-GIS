import type { LngLatHeightTuple } from '../types'
import { computeProjectionLength } from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

/**
 * 投影距离测量。
 * 使用椭球测地线（EllipsoidGeodesic）累加水平投影距离，忽略高程差。
 */
export class ProjectionDistanceMeasure extends MeasureBase {
  /**
   * 根据关键点绘制折线并计算投影距离。
   * @param positions 折线顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions]
    this.syncKeyPoints(positions)
    this.setDynamicLinePositions(positions, { clamp: true })
    if (positions.length >= 2) {
      const d = computeProjectionLength(positions)
      this.updateMeasureLabel(
        positions[positions.length - 1]!,
        createMeasureLabelText('投影距离', d),
      )
    }
  }

  /**
   * 鼠标移动时预览折线与投影距离。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const preview = [...this.positions, cursor]
    this.setDynamicLinePositions(preview, { clamp: true })
    if (preview.length >= 2) {
      const d = computeProjectionLength(preview)
      this.updateMeasureLabel(cursor, createMeasureLabelText('投影距离', d))
    }
  }

  /** 右键结束时固定最终折线与标注 */
  complete(): void {
    this.setDynamicLinePositions(this.positions, { clamp: true })
    if (this.positions.length >= 2) {
      const d = computeProjectionLength(this.positions)
      this.updateMeasureLabel(
        this.positions[this.positions.length - 1]!,
        createMeasureLabelText('投影距离', d),
      )
    }
  }
}
