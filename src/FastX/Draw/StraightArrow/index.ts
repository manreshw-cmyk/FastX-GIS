import type { Entity, Viewer } from 'cesium'
import type { AddStraightArrowOptions, StraightArrowSnapshot, UpdateStraightArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddStraightArrowOptions, StraightArrowSnapshot, UpdateStraightArrowProperties }

/** 直箭头标绘（Entity）。 */
export default class StraightArrow extends PlotArrowEntityBase {
  constructor() {
    super('straight', 'sta')
  }

  /**
   * 批量创建直箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 直箭头配置列表。
   */
  addStraightArrows(viewer: Viewer, items: AddStraightArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定直箭头。
   * @param id 直箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateStraightArrow(id: string, properties: UpdateStraightArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定直箭头快照。 */
  getStraightArrow(id: string): StraightArrowSnapshot | null {
    return this.getPlotArrow(id) as StraightArrowSnapshot | null
  }

  /** 查询全部直箭头，可按 Viewer 过滤。 */
  getAllStraightArrows(viewer?: Viewer): StraightArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as StraightArrowSnapshot[]
  }

  /**
   * 创建单个直箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 直箭头绘制参数。
   */
  add(viewer: Viewer, options: AddStraightArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
