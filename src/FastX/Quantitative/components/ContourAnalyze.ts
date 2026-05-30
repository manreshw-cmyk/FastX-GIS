import type { LngLatHeightTuple, MeasureCreateOptions } from '../types'
import { buildContourSegments, rectangleRing } from '../contourCore'
import { MeasureBase } from './MeasureBase'

/** 等高线矢量分析：矩形框选 + 网格采样生成等高线段 */
export class ContourAnalyze extends MeasureBase {
  private interval = 100
  private gridSize = 50

  /**
   * @param options 创建选项
   */
  constructor(options: MeasureCreateOptions) {
    super(options)
    this.interval = options.contourInterval ?? 100
    this.gridSize = options.contourGridSize ?? 50
  }

  /**
   * 设置矩形对角点并预览框线。
   * @param positions 最多取前两点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = positions.slice(0, 2)
    this.syncKeyPoints(this.positions)
    this.clearSegmentEntities()
    if (this.positions.length < 2) {
      this.clearDynamicLine()
      return
    }
    this.setDynamicLinePositions(rectangleRing(this.positions[0]!, this.positions[1]!), {
      clamp: true,
      color: this.style.lineColor,
      width: 1,
    })
  }

  /**
   * 鼠标移动预览矩形框。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const anchor = this.positions[0]!
    this.positions = [anchor]
    this.setDynamicLinePositions(rectangleRing(anchor, cursor), {
      clamp: true,
      color: this.style.lineColor,
      width: 1,
    })
  }

  /** 完成框选，异步生成等高线段 */
  complete(): void {
    if (this.positions.length < 2) return
    void this.buildContours()
  }

  /** 在矩形范围内采样并绘制等高线段 */
  private async buildContours(): Promise<void> {
    const [a, b] = this.positions
    if (!a || !b) return
    this.clearSegmentEntities()
    const { segments } = await buildContourSegments(
      this.viewer,
      [a, b],
      this.interval,
      this.gridSize,
      this.gridSize,
    )
    const lineColor = '#48c175'
    for (const seg of segments) {
      this.drawSegmentPolyline([seg.a, seg.b], lineColor, 1, true)
      const mid = this.midpoint(seg.a, seg.b)
      this.drawLabel(mid, `${Math.round(seg.level)}m`, [0, -12])
    }
  }
}
