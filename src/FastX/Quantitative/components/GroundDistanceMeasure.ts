import type { LngLatHeightTuple } from '../types'
import { computeGroundLength, computeProjectionLength } from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

/**
 * 地表距离测量。
 * 沿地形插值采样后累加三维距离，折线贴地显示；无高精度地形时回退视口高程。
 */
export class GroundDistanceMeasure extends MeasureBase {
  /**
   * 根据关键点绘制贴地折线并异步计算地表距离。
   * @param positions 折线顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions]
    this.syncKeyPoints(positions)
    this.setDynamicLinePositions(positions, true)
    if (positions.length >= 2) {
      void computeGroundLength(this.viewer, positions).then((d) => {
        this.updateMeasureLabel(
          positions[positions.length - 1]!,
          createMeasureLabelText('地表距离', d),
        )
      })
    }
  }

  /**
   * 鼠标移动时预览贴地折线（标注先用投影距离近似，避免异步闪烁）。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const preview = [...this.positions, cursor]
    this.setDynamicLinePositions(preview, true)
    if (preview.length >= 2) {
      const d = computeProjectionLength(preview)
      this.updateMeasureLabel(cursor, createMeasureLabelText('地表距离', d))
    }
  }

  /** 右键/双击结束时按最终顶点重算地表距离 */
  complete(): void {
    this.setDynamicLinePositions(this.positions, true)
    if (this.positions.length >= 2) {
      void computeGroundLength(this.viewer, this.positions).then((d) => {
        this.updateMeasureLabel(
          this.positions[this.positions.length - 1]!,
          createMeasureLabelText('地表距离', d),
        )
      })
    }
  }
}
