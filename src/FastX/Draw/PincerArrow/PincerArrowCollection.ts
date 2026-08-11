import type { Viewer } from 'cesium'
import type {
  PincerArrowCollectionAddItem,
  PincerArrowCollectionSnapshot,
  PincerArrowCollectionUpdateEntry,
  PincerArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  PincerArrowCollectionAddItem,
  PincerArrowCollectionSnapshot,
  PincerArrowCollectionUpdateEntry,
  PincerArrowCollectionUpdateProps,
}

/** 批量钳击箭头标绘（Primitive）。 */
export default class PincerArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('pincer', 'parc')
  }

  /**
   * 批量创建钳击箭头 Primitive。
   * @param viewer Cesium Viewer 实例。
   * @param items 钳击箭头配置列表。
   */
  addPincerArrows(viewer: Viewer, items: PincerArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定钳击箭头。
   * @param id 钳击箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updatePincerArrow(id: string, properties: PincerArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /**
   * 批量更新钳击箭头。
   * @param updates 更新项列表。
   */
  updatePincerArrows(updates: PincerArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  /** 查询指定钳击箭头快照。 */
  getPincerArrow(id: string): PincerArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as PincerArrowCollectionSnapshot | null
  }

  /** 查询全部钳击箭头，可按 Viewer 过滤。 */
  getAllPincerArrows(viewer?: Viewer): PincerArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as PincerArrowCollectionSnapshot[]
  }
}
