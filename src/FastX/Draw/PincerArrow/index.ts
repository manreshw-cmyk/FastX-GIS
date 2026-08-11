import type { Entity, Viewer } from 'cesium'
import type { AddPincerArrowOptions, PincerArrowSnapshot, UpdatePincerArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddPincerArrowOptions, PincerArrowSnapshot, UpdatePincerArrowProperties }

/** 钳击箭头标绘（Entity）。 */
export default class PincerArrow extends PlotArrowEntityBase {
  constructor() {
    super('pincer', 'par')
  }

  /**
   * 批量创建钳击箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 钳击箭头配置列表。
   */
  addPincerArrows(viewer: Viewer, items: AddPincerArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定钳击箭头。
   * @param id 钳击箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updatePincerArrow(id: string, properties: UpdatePincerArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定钳击箭头快照。 */
  getPincerArrow(id: string): PincerArrowSnapshot | null {
    return this.getPlotArrow(id) as PincerArrowSnapshot | null
  }

  /** 查询全部钳击箭头，可按 Viewer 过滤。 */
  getAllPincerArrows(viewer?: Viewer): PincerArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as PincerArrowSnapshot[]
  }

  /**
   * 创建单个钳击箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 钳击箭头绘制参数。
   */
  add(viewer: Viewer, options: AddPincerArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
