import type { LngLatHeightTuple } from '../types'
import {
  computeProjectionLength,
  computeVisualDistance,
  flattenRadiusPoint,
  getCirclePoints,
} from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

const MAX_PREVIEW_RADIUS = 500_000

/** 圆形通视：预览圆 + 实时通视射线 */
export class AreaAnalyze extends MeasureBase {
  private previewGen = 0

  /**
   * 设置圆心与半径点。
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
    void this.renderPreview(this.positions[0]!, flattenRadiusPoint(this.positions[0]!, this.positions[1]!))
  }

  /**
   * 鼠标移动预览圆形通视。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const center = this.positions[0]!
    const edge = flattenRadiusPoint(center, cursor)
    const gen = ++this.previewGen
    void this.renderPreview(center, edge, gen)
  }

  /** 完成测量，绘制最终圆与通视射线 */
  complete(): void {
    void this.renderFinal()
  }

  /**
   * 预览阶段：绘制圆与稀疏通视射线。
   * @param center 圆心
   * @param edge 半径点
   * @param gen 预览代数
   */
  private async renderPreview(
    center: LngLatHeightTuple,
    edge: LngLatHeightTuple,
    gen?: number,
  ): Promise<void> {
    const radius = computeProjectionLength([center, edge])
    if (radius > MAX_PREVIEW_RADIUS) return
    this.clearDynamicLine()
    this.clearSegmentEntities()
    const ring = getCirclePoints(center, radius, 6)
    if (ring.length < 3) return
    this.setDynamicLinePositions([...ring, ring[0]!], {
      clamp: true,
      color: this.style.circleColor,
      width: 3,
    })
    this.updateMeasureLabel(edge, createMeasureLabelText('圆形通视半径', radius))

    for (let i = 0; i < ring.length; i += 2) {
      const target = ring[i]!
      const obj = await computeVisualDistance(this.viewer, [center, target])
      if (gen !== undefined && gen !== this.previewGen) return
      for (let j = 0; j < obj.positions.length - 1; j++) {
        const seg = [obj.positions[j]!, obj.positions[j + 1]!]
        const color = j % 2 === 0 ? this.style.visibleLineColor : this.style.invisibleLineColor
        this.drawSegmentPolyline(seg, color, 1, true)
      }
    }
  }

  /** 完成阶段：绘制完整圆与通视射线及累计标注 */
  private async renderFinal(): Promise<void> {
    const center = this.positions[0]
    const edgeRaw = this.positions[1]
    if (!center || !edgeRaw) return
    const edge = flattenRadiusPoint(center, edgeRaw)
    this.positions[1] = edge
    this.syncKeyPoints([center, edge])
    this.clearDynamicLine()
    this.clearSegmentEntities()

    const radius = computeProjectionLength([center, edge])
    const ring = getCirclePoints(center, radius, 10)
    this.drawSegmentPolyline([...ring, ring[0]!], this.style.circleColor, 3, true)

    let visibleSum = 0
    let count = 0
    for (let i = 0; i < ring.length; i += 2) {
      const target = ring[i]!
      const obj = await computeVisualDistance(this.viewer, [center, target])
      for (let j = 0; j < obj.positions.length - 1; j++) {
        const seg = [obj.positions[j]!, obj.positions[j + 1]!]
        const color = j % 2 === 0 ? this.style.visibleLineColor : this.style.invisibleLineColor
        this.drawSegmentPolyline(seg, color, 1, true)
      }
      visibleSum += obj.visibleDistance
      count++
    }
    this.updateMeasureLabel(edge, createMeasureLabelText('圆形通视半径', radius))
    this.drawLabel(center, createMeasureLabelText('累计可视', visibleSum / Math.max(1, count)))
  }
}
