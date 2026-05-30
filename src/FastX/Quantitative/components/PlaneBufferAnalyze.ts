import * as Cesium from 'cesium'
import type { Entity } from 'cesium'
import type { LngLatHeightTuple, MeasureCreateOptions } from '../types'
import { computePolygonBuffer } from '../measureMath'
import { MeasureBase } from './MeasureBase'

/** 面缓冲区分析：多边形外扩缓冲带 */
export class PlaneBufferAnalyze extends MeasureBase {
  private bufferWidth: number
  private outerPolygonBuf: LngLatHeightTuple[] = []
  private outerEntity: Entity | null = null

  /**
   * @param options 创建选项
   */
  constructor(options: MeasureCreateOptions) {
    super(options)
    this.bufferWidth = options.bufferWidth ?? 500
  }

  /**
   * 设置多边形顶点并刷新缓冲几何。
   * @param positions 多边形顶点
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
   * 根据顶点刷新内多边形与外缓冲环。
   * @param positions 含预览点的顶点
   */
  private refreshGeometry(positions: LngLatHeightTuple[]): void {
    if (positions.length >= 3) {
      this.setDynamicPolygon(positions, true, this.style.fillColor, this.style.fillAlpha * 0.5)
      this.outerPolygonBuf = computePolygonBuffer(positions, this.bufferWidth)
      this.ensureOuterBuffer()
      this.updateMeasureLabel(positions[positions.length - 1]!, `面缓冲 ${this.bufferWidth} m`)
      return
    }
    if (positions.length === 2) {
      this.setDynamicLinePositions(positions, { clamp: true, color: this.style.lineColor })
      this.clearOuterBuffer()
      return
    }
    this.clearDynamicLine()
    this.clearDynamicPolygon()
    this.clearOuterBuffer()
  }

  /** 创建或保留外缓冲多边形 Entity */
  private ensureOuterBuffer(): void {
    if (this.outerPolygonBuf.length < 3) return
    if (!this.outerEntity) {
      this.outerEntity = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(
            () =>
              new Cesium.PolygonHierarchy(
                this.outerPolygonBuf.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] ?? 0)),
              ),
            false,
          ),
          material: Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(this.style.fillAlpha),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(this.style.lineColor),
        },
      })
      this.track(this.outerEntity)
    }
  }

  /** 移除外缓冲多边形 Entity */
  private clearOuterBuffer(): void {
    if (this.outerEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.outerEntity)
      this.entities = this.entities.filter((e) => e !== this.outerEntity)
    }
    this.outerEntity = null
    this.outerPolygonBuf = []
  }

  /** 清除外缓冲与 Entity */
  clear(): void {
    this.clearOuterBuffer()
    super.clear()
  }
}
