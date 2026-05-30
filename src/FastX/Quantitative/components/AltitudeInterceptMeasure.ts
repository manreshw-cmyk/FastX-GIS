import * as Cesium from 'cesium'
import type { Entity } from 'cesium'
import type { LngLatHeightTuple } from '../types'
import { computeTwoPointsDistance, toCartesian } from '../measureMath'
import { createMeasureLabelText, MeasureBase } from './MeasureBase'

/**
 * 三角测量：预览不增加光标关键点；结束后起点/终点各一个关键点。
 */
export class AltitudeInterceptMeasure extends MeasureBase {
  private rightAngleBuf: LngLatHeightTuple[] = []
  private rightAngleEntity: Entity | null = null
  private finished = false

  /**
   * 设置两点并绘制直角三角分解线。
   * @param positions 最多取前两点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    const pts = positions.slice(0, 2)
    if (!this.finished) {
      this.positions = pts.length >= 2 ? [pts[0]!, pts[1]!] : pts.length === 1 ? [pts[0]!] : []
      this.syncKeyPoints(this.positions)
    }
    if (pts.length < 2) {
      this.clearDynamicLine()
      this.clearRightAngleLine()
      if (!this.finished) this.clearSegmentLabels()
      return
    }
    const obj = computeTwoPointsDistance(pts[0]!, pts[1]!)
    this.rightAngleBuf = [pts[0]!, obj.position3, pts[1]!]
    this.setDynamicLinePositions(pts, { clamp: false, color: this.style.lineColor, width: this.style.lineWidth })
    this.ensureRightAngleLine()
    if (!this.finished) this.updatePreviewLabels(pts, obj)
  }

  /**
   * 鼠标移动预览第二顶点。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1 || this.finished) return
    const anchor = this.positions[0]!
    const obj = computeTwoPointsDistance(anchor, cursor)
    this.rightAngleBuf = [anchor, obj.position3, cursor]
    this.setDynamicLinePositions([anchor, cursor], {
      clamp: false,
      color: this.style.lineColor,
      width: this.style.lineWidth,
    })
    this.ensureRightAngleLine()
    this.updatePreviewLabels([anchor, cursor], obj)
  }

  /** 完成测量，固定分段标注 */
  complete(): void {
    if (this.positions.length < 2) return
    this.finished = true
    const pts = this.positions
    const obj = computeTwoPointsDistance(pts[0]!, pts[1]!)
    this.syncKeyPoints(pts)
    this.clearSegmentLabels()
    this.drawLabel(
      this.midpoint(pts[0]!, pts[1]!),
      createMeasureLabelText('空间距离', obj.distance),
      [14, 22],
      'distance',
    )
    const [hi] = (pts[0]![2] ?? 0) >= (pts[1]![2] ?? 0) ? [pts[0]!, pts[1]!] : [pts[1]!, pts[0]!]
    this.drawLabel(
      this.midpoint(hi, obj.position3),
      createMeasureLabelText('水平距离', obj.horizontal),
      [14, -28],
      'horizontal',
    )
    this.drawLabel(pts[1]!, createMeasureLabelText('垂直距离', obj.vertical), [14, 40], 'vertical')
  }

  /** 清除直角线与完成状态 */
  clear(): void {
    this.clearRightAngleLine()
    super.clear()
    this.finished = false
  }

  /** 移除直角分解折线 Entity */
  private clearRightAngleLine(): void {
    if (this.rightAngleEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.rightAngleEntity)
      this.entities = this.entities.filter((e) => e !== this.rightAngleEntity)
    }
    this.rightAngleEntity = null
  }

  /** 创建或保留直角分解折线 */
  private ensureRightAngleLine(): void {
    if (this.rightAngleBuf.length < 3) return
    if (!this.rightAngleEntity) {
      this.rightAngleEntity = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(
            () => this.rightAngleBuf.map((p) => toCartesian(p)),
            false,
          ),
          width: this.style.lineWidth,
          material: Cesium.Color.fromCssColorString(this.style.rightAngleLineColor),
          clampToGround: false,
        },
      })
      this.track(this.rightAngleEntity)
    }
  }

  /** 清除预览/临时分段标注 */
  private clearSegmentLabels(): void {
    for (const key of ['distance', 'horizontal', 'vertical', 'vertical-preview']) {
      const e = this.labelEntities.get(key)
      if (e && !this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e)
        this.entities = this.entities.filter((x) => x !== e)
      }
      this.labelEntities.delete(key)
    }
  }

  /**
   * 更新预览阶段三边标注。
   * @param pts 两点
   * @param obj 距离分解结果
   */
  private updatePreviewLabels(
    pts: LngLatHeightTuple[],
    obj: ReturnType<typeof computeTwoPointsDistance>,
  ): void {
    if (this.finished) return
    this.clearSegmentLabels()
    this.updateLabelByKey(
      'distance',
      this.midpoint(pts[0]!, pts[1]!),
      createMeasureLabelText('空间距离', obj.distance),
      [14, 22],
    )
    const [hi] = (pts[0]![2] ?? 0) >= (pts[1]![2] ?? 0) ? [pts[0]!, pts[1]!] : [pts[1]!, pts[0]!]
    this.updateLabelByKey(
      'horizontal',
      this.midpoint(hi, obj.position3),
      createMeasureLabelText('水平距离', obj.horizontal),
      [14, -28],
    )
    this.updateLabelByKey(
      'vertical-preview',
      pts[1]!,
      createMeasureLabelText('垂直距离', obj.vertical),
      [14, 40],
    )
  }
}
