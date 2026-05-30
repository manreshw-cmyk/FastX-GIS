import * as Cesium from 'cesium'
import type { LngLatHeightTuple, MeasureCreateOptions } from '../types'
import { getCirclePoints } from '../measureMath'
import { MeasureBase } from './MeasureBase'

/**
 * 环顶点转 degreesArrayHeights 扁平数组。
 * @param ring 环顶点
 */
function ringToDegreesArrayHeights(ring: LngLatHeightTuple[]): number[] {
  const flat: number[] = []
  for (const p of ring) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue
    flat.push(p[0], p[1], p[2] ?? 0)
  }
  return flat
}

/** 点缓冲区：贴地 GroundPrimitive（对齐 FreeX FePointBufferAnalyze） */
export class PointBufferAnalyze extends MeasureBase {
  private bufferWidth: number
  private fillPrimitive: Cesium.GroundPrimitive | null = null
  private outlinePrimitive: Cesium.GroundPolylinePrimitive | null = null

  /**
   * @param options 创建选项
   */
  constructor(options: MeasureCreateOptions) {
    super(options)
    this.bufferWidth = Math.max(10, options.bufferWidth ?? 2000)
  }

  /**
   * 设置单点缓冲区（取首点）。
   * @param positions 顶点（仅用第一个）
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    if (positions[0]) this.setPosition(positions[0])
  }

  /**
   * 设置中心点并绘制圆形缓冲区。
   * @param position 中心点
   */
  setPosition(position: LngLatHeightTuple): void {
    if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return
    this.positions = [position]
    this.syncKeyPoints([position])
    const radius = Math.max(10, this.bufferWidth)
    this.clearDynamicLine()
    this.clearDynamicPolygon()
    this.drawBufferArea(position, radius)
    this.updateMeasureLabel(position, `缓冲区半径 ${radius} m`)
  }

  /** 清除 GroundPrimitive 与 Entity */
  clear(): void {
    this.clearGroundPrimitives()
    super.clear()
  }

  /** 移除贴地填充与轮廓 Primitive */
  private clearGroundPrimitives(): void {
    const scene = this.viewer.scene
    if (this.fillPrimitive && !this.viewer.isDestroyed()) {
      scene.groundPrimitives.remove(this.fillPrimitive)
    }
    if (this.outlinePrimitive && !this.viewer.isDestroyed()) {
      scene.groundPrimitives.remove(this.outlinePrimitive)
    }
    this.fillPrimitive = null
    this.outlinePrimitive = null
  }

  /**
   * 绘制圆形缓冲区填充与轮廓。
   * @param center 圆心
   * @param radius 半径（米）
   */
  private drawBufferArea(center: LngLatHeightTuple, radius: number): void {
    this.clearGroundPrimitives()
    const ring = getCirclePoints(center, radius, 6)
    if (ring.length < 3) return

    const flat = ringToDegreesArrayHeights(ring)
    if (flat.length < 9) return

    const positions = Cesium.Cartesian3.fromDegreesArrayHeights(flat)
    const fillColor = Cesium.Color.fromCssColorString(this.style.fillColor).withAlpha(this.style.fillAlpha)
    const lineColor = Cesium.Color.fromCssColorString(this.style.lineColor)

    const scene = this.viewer.scene
    this.fillPrimitive = new Cesium.GroundPrimitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: Cesium.PolygonGeometry.fromPositions({
          positions,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.MaterialAppearance({
        material: Cesium.Material.fromType('Color', { color: fillColor }),
      }),
      asynchronous: false,
    })
    scene.groundPrimitives.add(this.fillPrimitive)

    const outlineFlat = ringToDegreesArrayHeights([...ring, ring[0]!])
    const outlinePositions = Cesium.Cartesian3.fromDegreesArrayHeights(outlineFlat)
    this.outlinePrimitive = new Cesium.GroundPolylinePrimitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
          positions: outlinePositions,
          width: 2,
        }),
      }),
      appearance: new Cesium.PolylineMaterialAppearance({
        material: Cesium.Material.fromType('Color', { color: lineColor }),
      }),
      asynchronous: false,
    })
    scene.groundPrimitives.add(this.outlinePrimitive)
    this.requestRender()
  }
}
