import type { LngLatHeightTuple, MeasureCreateOptions } from '../types'
import { computeLineBufferPolygon } from '../measureMath'
import { MeasureBase } from './MeasureBase'

/** 线缓冲区分析：折线两侧外扩缓冲带 */
export class LineBufferAnalyze extends MeasureBase {
  private bufferWidth: number

  /**
   * @param options 创建选项
   */
  constructor(options: MeasureCreateOptions) {
    super({ ...options, clampToGround: false })
    this.bufferWidth = options.bufferWidth ?? 500
  }

  /**
   * 设置折线顶点并刷新缓冲几何。
   * @param positions 折线顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions]
    this.syncKeyPoints(positions)
    this.refreshGeometry(positions)
  }

  /**
   * 鼠标移动预览缓冲带。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    this.refreshGeometry([...this.positions, cursor])
  }

  /** 绘制完成，固定最终几何 */
  complete(): void {
    this.refreshGeometry(this.positions)
  }

  /**
   * 根据顶点刷新折线与缓冲多边形。
   * @param positions 含预览点的顶点
   */
  private refreshGeometry(positions: LngLatHeightTuple[]): void {
    if (positions.length >= 2) {
      this.setDynamicLinePositions(positions, { clamp: false, color: this.style.lineColor })
      const bufferRing = computeLineBufferPolygon(positions, this.bufferWidth)
      if (bufferRing.length >= 3) {
        this.setDynamicPolygon(bufferRing, false)
      } else {
        this.clearDynamicPolygon()
      }
      this.updateMeasureLabel(
        positions[positions.length - 1]!,
        `线缓冲 ${this.bufferWidth} m`,
      )
      return
    }
    if (positions.length === 1) {
      this.clearDynamicLine()
      this.clearDynamicPolygon()
    }
  }
}
