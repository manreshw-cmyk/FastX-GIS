import type { LngLatHeightTuple, MeasureCreateOptions } from '../types'
import { applyContourGlobeShader, clearContourGlobeShader, layerFromCorners } from '../contourGlobeShader'
import { rectangleRing } from '../contourCore'
import { MeasureBase } from './MeasureBase'

/** 等高线 Shader 分析：矩形框选后在 Globe 上应用等高线材质 */
export class ContourShaderAnalyze extends MeasureBase {
  private interval = 100
  private shaderWidth = 1
  private readonly onShaderChange?: () => void

  /**
   * @param options 创建选项
   */
  constructor(options: MeasureCreateOptions) {
    super(options)
    this.interval = options.contourInterval ?? 100
    this.shaderWidth = this.style.contourShaderWidth
    this.onShaderChange = options.onContourShaderChange
  }

  /**
   * 设置矩形对角点并同步 Shader。
   * @param positions 最多取前两点
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = positions.slice(0, 2)
    this.syncKeyPoints(this.positions)
    if (this.positions.length < 2) {
      this.clearDynamicLine()
      this.notifyShader()
      return
    }
    this.setDynamicLinePositions(rectangleRing(this.positions[0]!, this.positions[1]!), {
      clamp: true,
      color: '#ffcc00',
      width: 2,
    })
    this.notifyShader()
  }

  /**
   * 鼠标移动预览矩形框并更新 Shader 范围。
   * @param cursor 光标位置
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.positions.length < 1) return
    const anchor = this.positions[0]!
    this.setDynamicLinePositions(rectangleRing(anchor, cursor), {
      clamp: true,
      color: '#ffcc00',
      width: 2,
    })
    this.applyShaderForCorners(anchor, cursor)
  }

  /** 完成框选，固定 Shader 图层 */
  complete(): void {
    if (this.positions.length >= 2) {
      this.syncKeyPoints(this.positions)
      this.applyShaderForCorners(this.positions[0]!, this.positions[1]!)
      this.updateMeasureLabel(this.positions[1]!, `等高带 ${this.interval} m`)
    }
    this.onShaderChange?.()
  }

  /** 清除 Entity 并通知 Shader 同步 */
  clear(): void {
    this.onShaderChange?.()
    super.clear()
  }

  /** 销毁实例并通知 Shader 同步 */
  destroy(): void {
    this.onShaderChange?.()
    super.destroy()
  }

  /** 根据当前顶点更新 Globe Shader 并触发回调 */
  private notifyShader(): void {
    if (this.positions.length >= 2) {
      this.applyShaderForCorners(this.positions[0]!, this.positions[1]!)
    }
    this.onShaderChange?.()
  }

  /** 获取当前 Shader 图层参数（供 Quantitative 聚合） */
  getShaderLayer() {
    if (this.positions.length < 2) return null
    return layerFromCorners(
      this.positions[0]!,
      this.positions[1]!,
      this.style.contourShaderColor,
      this.interval,
      this.shaderWidth,
    )
  }

  /**
   * 将 Shader 应用到 Globe。
   * @param a 角点 1
   * @param b 角点 2
   */
  private applyShaderForCorners(a: LngLatHeightTuple, b: LngLatHeightTuple): void {
    if (this.viewer.isDestroyed()) return
    applyContourGlobeShader(this.viewer.scene.globe, layerFromCorners(
      a,
      b,
      this.style.contourShaderColor,
      this.interval,
      this.shaderWidth,
    ))
  }
}

/**
 * 同步全部等高线 Shader 图层（由 Quantitative 调用）。
 * @param viewer Cesium Viewer
 * @param layers 图层列表（取最后一个生效）
 */
export function syncContourGlobeShaders(
  viewer: import('cesium').Viewer,
  layers: ReturnType<typeof layerFromCorners>[],
): void {
  if (viewer.isDestroyed()) return
  if (layers.length === 0) {
    clearContourGlobeShader(viewer.scene.globe)
    return
  }
  applyContourGlobeShader(viewer.scene.globe, layers[layers.length - 1]!)
}
