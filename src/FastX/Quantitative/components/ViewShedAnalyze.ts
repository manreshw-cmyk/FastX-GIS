import * as Cesium from 'cesium'
import type { LngLatHeightTuple } from '../types'
import { computeAzimuth, computeLineLength, computeVisualDistance, geodesicDestination } from '../measureMath'
import { MeasureBase } from './MeasureBase'

/** 视域分析：预览视锥 + 实时通视射线 */
export class ViewShedAnalyze extends MeasureBase {
  private fovBuf: LngLatHeightTuple[] = []
  private previewGen = 0

  /**
   * 设置观测点与目标点。
   * @param positions 最多取前两点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = positions.slice(0, 2)
    this.syncKeyPoints(this.positions)
    if (this.positions.length < 2) {
      this.clearDynamicLine()
      this.clearDynamicPolygon()
      this.clearSegmentEntities()
      return
    }
    void this.refreshFov(this.positions[0]!, this.positions[1]!)
  }

  /**
   * 鼠标移动预览视锥与通视射线。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const gen = ++this.previewGen
    void this.refreshFov(this.positions[0]!, cursor, gen)
  }

  /** 完成测量，固定视锥与通视结果 */
  complete(): void {
    if (this.positions.length >= 2) {
      this.syncKeyPoints(this.positions)
      void this.refreshFov(this.positions[0]!, this.positions[1]!)
    }
  }

  /**
   * 刷新视锥多边形与中心通视射线。
   * @param eye 观测点
   * @param target 目标点
   * @param gen 预览代数
   */
  private async refreshFov(eye: LngLatHeightTuple, target: LngLatHeightTuple, gen?: number): Promise<void> {
    const dist = computeLineLength([eye, target])
    const az = computeAzimuth(eye, target)
    const half = Cesium.Math.toRadians(30)
    const range = dist * 0.3
    this.fovBuf = [eye]
    const steps = 16
    for (let i = 0; i <= steps; i++) {
      const a = az - half + ((2 * half * i) / steps)
      this.fovBuf.push(geodesicDestination(eye, range, a))
    }
    this.fovBuf.push(eye)
    this.setDynamicPolygon(this.fovBuf, false, '#00aaff', 0.2, '#00aaff')
    this.clearSegmentEntities()
    const obj = await computeVisualDistance(this.viewer, [eye, target])
    if (gen !== undefined && gen !== this.previewGen) return
    for (let j = 0; j < obj.positions.length - 1; j++) {
      const seg = [obj.positions[j]!, obj.positions[j + 1]!]
      const color = j % 2 === 0 ? this.style.visibleLineColor : this.style.invisibleLineColor
      this.drawSegmentPolyline(seg, color, this.style.lineWidth, true)
    }
    this.setDynamicLinePositions([eye, target], { clamp: false, color: this.style.lineColor, width: 2 })
    this.updateMeasureLabel(target, `视距 ${dist.toFixed(0)} m`)
  }
}
