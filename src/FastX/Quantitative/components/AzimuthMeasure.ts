import * as Cesium from 'cesium'
import type { Entity } from 'cesium'
import type { LngLatHeightTuple } from '../types'
import {
  computeAzimuth,
  computeLineLength,
  computeProjectionLength,
  formatAzimuthDegrees,
  geodesicDestination,
} from '../measureMath'
import { MeasureBase } from './MeasureBase'

const CAMERA_HEIGHT_SCALE = 2_000_000

/**
 * 方位角测量：指北虚线 + 方位弧虚线实时预览（对齐 FreeX FeAzimuthMeasure）。
 */
export class AzimuthMeasure extends MeasureBase {
  private northLines: LngLatHeightTuple[][] = []
  private arcLines: LngLatHeightTuple[][] = []
  private northEntities: Entity[] = []
  private arcEntities: Entity[] = []
  private previewNorth: LngLatHeightTuple[] = []
  private previewArc: LngLatHeightTuple[] = []
  private previewNorthEntity: Entity | null = null
  private previewArcEntity: Entity | null = null
  private committedLabelEntities: Entity[] = []

  /**
   * 设置折线顶点并重建已提交段辅助线。
   * @param positions 折线顶点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions]
    this.syncKeyPoints(positions)
    if (positions.length < 2) {
      this.setDynamicLinePositions(positions, { clamp: true, color: this.style.lineColor })
      return
    }
    this.rebuildCommittedSegments()
    this.setDynamicLinePositions(positions, { clamp: true, color: this.style.lineColor })
  }

  /**
   * 鼠标移动预览方位辅助线与角度。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const anchors = [...this.positions]
    const preview = [...anchors, cursor]
    this.setDynamicLinePositions(preview, { clamp: true, color: this.style.lineColor })
    if (anchors.length >= 1) {
      const from = anchors[anchors.length - 1]!
      this.updatePreviewGuide(from, cursor)
    }
  }

  /** 完成绘制，清除预览并固定辅助线 */
  complete(): void {
    this.clearPreviewGuide()
    if (this.positions.length >= 2) {
      this.rebuildCommittedSegments()
      this.setDynamicLinePositions(this.positions, { clamp: true, color: this.style.lineColor })
      this.syncKeyPoints(this.positions)
    }
  }

  /** 清除辅助线与缓存 */
  clear(): void {
    this.clearPreviewGuide()
    this.clearGuideEntities()
    super.clear()
    this.northLines = []
    this.arcLines = []
  }

  /** 按当前顶点重建全部已提交段辅助线 */
  private rebuildCommittedSegments(): void {
    this.clearGuideEntities()
    this.northLines = []
    this.arcLines = []
    for (let i = 0; i < this.positions.length - 1; i++) {
      this.commitSegment(this.positions[i]!, this.positions[i + 1]!, true)
    }
  }

  /**
   * 提交单段方位辅助线。
   * @param from 段起点
   * @param to 段终点
   * @param drawLabel 是否绘制角度标注
   */
  private commitSegment(from: LngLatHeightTuple, to: LngLatHeightTuple, drawLabel = true): void {
    const az = computeAzimuth(from, to)
    if (Number.isNaN(az)) return
    const north = this.buildNorthLine(from)
    const arc = this.buildArcLine(from, to, az, north)
    this.northLines.push(north)
    this.arcLines.push(arc)
    this.northEntities.push(this.drawPolyline(north, this.style.lineColor, 1, true, true))
    this.arcEntities.push(this.drawPolyline(arc, this.style.lineColor, 1, true, true))
    if (drawLabel) this.committedLabelEntities.push(this.drawLabel(from, formatAzimuthDegrees(az)))
  }

  /**
   * 构建指北参考线。
   * @param from 起点
   */
  private buildNorthLine(from: LngLatHeightTuple): LngLatHeightTuple[] {
    const h = this.getCameraHeight() / CAMERA_HEIGHT_SCALE
    return [from, [from[0], from[1] + h, from[2] ?? 0]]
  }

  /**
   * 构建方位角弧线段。
   * @param from 起点
   * @param to 终点
   * @param az 方位角（弧度）
   * @param north 指北线
   */
  private buildArcLine(
    from: LngLatHeightTuple,
    to: LngLatHeightTuple,
    az: number,
    north: LngLatHeightTuple[],
  ): LngLatHeightTuple[] {
    const northLen = computeLineLength(north)
    let dist = computeProjectionLength([from, to])
    if (!dist) dist = 2000
    const radius = Math.min(northLen, dist) * 0.5
    const arc: LngLatHeightTuple[] = [from]
    const step = 0.1
    if (az > 0) {
      for (let a = 0; a < az; a += step) arc.push(geodesicDestination(from, radius, a))
    } else if (az < 0) {
      for (let a = 0; a > az; a -= step) arc.push(geodesicDestination(from, radius, a))
    }
    arc.push(geodesicDestination(from, radius, az))
    return arc
  }

  /**
   * 更新预览指北线与方位弧。
   * @param from 段起点
   * @param to 预览终点
   */
  private updatePreviewGuide(from: LngLatHeightTuple, to: LngLatHeightTuple): void {
    const az = computeAzimuth(from, to)
    if (Number.isNaN(az)) return
    this.previewNorth = this.buildNorthLine(from)
    this.previewArc = this.buildArcLine(from, to, az, this.previewNorth)
    this.ensurePreviewLines()
    this.updateLabelByKey('az-preview', from, formatAzimuthDegrees(az))
  }

  /** 创建预览虚线辅助 Entity */
  private ensurePreviewLines(): void {
    const guide = { color: this.style.lineColor, dashed: true }
    if (!this.previewNorthEntity) {
      this.previewNorthEntity = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(
            () => this.previewNorth.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] ?? 0)),
            false,
          ),
          width: 1,
          material: this.createLineMaterial(guide),
          clampToGround: true,
        },
      })
      this.track(this.previewNorthEntity)
    }
    if (!this.previewArcEntity) {
      this.previewArcEntity = this.viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(
            () => this.previewArc.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] ?? 0)),
            false,
          ),
          width: 1,
          material: this.createLineMaterial(guide),
          clampToGround: true,
        },
      })
      this.track(this.previewArcEntity)
    }
  }

  /** 清除预览辅助线与标注 */
  private clearPreviewGuide(): void {
    for (const e of [this.previewNorthEntity, this.previewArcEntity]) {
      if (e && !this.viewer.isDestroyed()) this.viewer.entities.remove(e)
      if (e) this.entities = this.entities.filter((x) => x !== e)
    }
    this.previewNorthEntity = null
    this.previewArcEntity = null
    const lb = this.labelEntities.get('az-preview')
    if (lb && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(lb)
      this.entities = this.entities.filter((x) => x !== lb)
    }
    this.labelEntities.delete('az-preview')
  }

  /** 清除已提交段辅助 Entity */
  private clearGuideEntities(): void {
    for (const e of [...this.northEntities, ...this.arcEntities, ...this.committedLabelEntities]) {
      if (!this.viewer.isDestroyed()) this.viewer.entities.remove(e)
      this.entities = this.entities.filter((x) => x !== e)
    }
    this.northEntities = []
    this.arcEntities = []
    this.committedLabelEntities = []
  }
}
