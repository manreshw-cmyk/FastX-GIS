import type { LngLatHeightTuple } from '../types'
import { computeSpacePolygonArea } from '../measureMath'
import { createMeasureAreaLabelText, MeasureBase } from './MeasureBase'

/**
 * 空间面积测量。
 * 多边形顶点按三维坐标计算空间面积（三角剖分叉积法），面不贴地。
 */
export class SpaceAreaMeasure extends MeasureBase {
  /**
   * 根据多边形顶点绘制面并计算空间面积。
   * @param positions 多边形顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions]
    this.syncKeyPoints(positions)
    this.refreshGeometry(positions)
  }

  /**
   * 鼠标移动时预览多边形与面积。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const preview = [...this.positions, cursor]
    this.refreshGeometry(preview, cursor)
  }

  /** 右键结束时固定为最终多边形与面积 */
  complete(): void {
    this.refreshGeometry(this.positions)
  }

  /**
   * 刷新多边形/折线几何与面积标注。
   * @param positions 顶点（含预览点）
   * @param labelAt 标注位置（默认可不传）
   */
  private refreshGeometry(positions: LngLatHeightTuple[], labelAt?: LngLatHeightTuple): void {
    if (positions.length >= 3) {
      this.setDynamicPolygon(positions, false)
      const area = computeSpacePolygonArea(positions)
      this.updateMeasureLabel(
        labelAt ?? positions[positions.length - 1]!,
        createMeasureAreaLabelText('空间面积', area),
      )
      return
    }
    if (positions.length === 2) {
      this.setDynamicLinePositions(positions, { clamp: false })
      this.clearMeasureLabel()
      return
    }
    this.clearDynamicLine()
    this.clearDynamicPolygon()
    this.clearMeasureLabel()
  }
}
