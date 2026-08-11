import type { Entity, Viewer } from 'cesium'
import type { AddCurveArrowOptions, CurveArrowSnapshot, UpdateCurveArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddCurveArrowOptions, CurveArrowSnapshot, UpdateCurveArrowProperties }

/** 曲线箭头标绘（Entity）。 */
export default class CurveArrow extends PlotArrowEntityBase {
  constructor() {
    super('curve', 'car')
  }

  /**
   * 批量创建曲线箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 曲线箭头配置列表。
   */
  addCurveArrows(viewer: Viewer, items: AddCurveArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定曲线箭头。
   * @param id 曲线箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateCurveArrow(id: string, properties: UpdateCurveArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定曲线箭头快照。 */
  getCurveArrow(id: string): CurveArrowSnapshot | null {
    return this.getPlotArrow(id) as CurveArrowSnapshot | null
  }

  /** 查询全部曲线箭头，可按 Viewer 过滤。 */
  getAllCurveArrows(viewer?: Viewer): CurveArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as CurveArrowSnapshot[]
  }

  /**
   * 创建单个曲线箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 曲线箭头绘制参数。
   */
  add(viewer: Viewer, options: AddCurveArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
