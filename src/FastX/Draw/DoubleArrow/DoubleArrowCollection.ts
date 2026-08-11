import type { Viewer } from 'cesium'
import type {
  DoubleArrowCollectionAddItem,
  DoubleArrowCollectionSnapshot,
  DoubleArrowCollectionUpdateEntry,
  DoubleArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  DoubleArrowCollectionAddItem,
  DoubleArrowCollectionSnapshot,
  DoubleArrowCollectionUpdateEntry,
  DoubleArrowCollectionUpdateProps,
}

/** 批量双箭头标绘（Primitive）。 */
export default class DoubleArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('double', 'darc')
  }

  /**
   * 批量创建双箭头 Primitive。
   * @param viewer Cesium Viewer 实例。
   * @param items 双箭头配置列表。
   */
  addDoubleArrows(viewer: Viewer, items: DoubleArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定双箭头。
   * @param id 双箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateDoubleArrow(id: string, properties: DoubleArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /**
   * 批量更新双箭头。
   * @param updates 更新项列表。
   */
  updateDoubleArrows(updates: DoubleArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  /** 查询指定双箭头快照。 */
  getDoubleArrow(id: string): DoubleArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as DoubleArrowCollectionSnapshot | null
  }

  /** 查询全部双箭头，可按 Viewer 过滤。 */
  getAllDoubleArrows(viewer?: Viewer): DoubleArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as DoubleArrowCollectionSnapshot[]
  }
}
