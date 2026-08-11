import type { Entity, Viewer } from 'cesium'
import type { AddDoubleArrowOptions, DoubleArrowSnapshot, UpdateDoubleArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddDoubleArrowOptions, DoubleArrowSnapshot, UpdateDoubleArrowProperties }

/** 双箭头标绘（Entity）。 */
export default class DoubleArrow extends PlotArrowEntityBase {
  constructor() {
    super('double', 'dar')
  }

  /**
   * 批量创建双箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 双箭头配置列表。
   */
  addDoubleArrows(viewer: Viewer, items: AddDoubleArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定双箭头。
   * @param id 双箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateDoubleArrow(id: string, properties: UpdateDoubleArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定双箭头快照。 */
  getDoubleArrow(id: string): DoubleArrowSnapshot | null {
    return this.getPlotArrow(id) as DoubleArrowSnapshot | null
  }

  /** 查询全部双箭头，可按 Viewer 过滤。 */
  getAllDoubleArrows(viewer?: Viewer): DoubleArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as DoubleArrowSnapshot[]
  }

  /**
   * 创建单个双箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 双箭头绘制参数。
   */
  add(viewer: Viewer, options: AddDoubleArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
