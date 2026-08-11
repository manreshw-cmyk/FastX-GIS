import type { Entity, Viewer } from 'cesium'
import type { AddFineStraightArrowOptions, FineStraightArrowSnapshot, UpdateFineStraightArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddFineStraightArrowOptions, FineStraightArrowSnapshot, UpdateFineStraightArrowProperties }

/** 细直箭头标绘（Entity）。 */
export default class FineStraightArrow extends PlotArrowEntityBase {
  constructor() {
    super('fineStraight', 'fsta')
  }

  /**
   * 批量创建细直箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 细直箭头配置列表。
   */
  addFineStraightArrows(viewer: Viewer, items: AddFineStraightArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定细直箭头。
   * @param id 细直箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateFineStraightArrow(id: string, properties: UpdateFineStraightArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定细直箭头快照。 */
  getFineStraightArrow(id: string): FineStraightArrowSnapshot | null {
    return this.getPlotArrow(id) as FineStraightArrowSnapshot | null
  }

  /** 查询全部细直箭头，可按 Viewer 过滤。 */
  getAllFineStraightArrows(viewer?: Viewer): FineStraightArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as FineStraightArrowSnapshot[]
  }

  /**
   * 创建单个细直箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 细直箭头绘制参数。
   */
  add(viewer: Viewer, options: AddFineStraightArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
