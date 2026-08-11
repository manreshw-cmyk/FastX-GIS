import type { Viewer } from 'cesium'
import type {
  SwallowtailAttackArrowCollectionAddItem,
  SwallowtailAttackArrowCollectionSnapshot,
  SwallowtailAttackArrowCollectionUpdateEntry,
  SwallowtailAttackArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  SwallowtailAttackArrowCollectionAddItem,
  SwallowtailAttackArrowCollectionSnapshot,
  SwallowtailAttackArrowCollectionUpdateEntry,
  SwallowtailAttackArrowCollectionUpdateProps,
}

/** 批量燕尾攻击箭头标绘（Primitive）。 */
export default class SwallowtailAttackArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('swallowtailAttack', 'saarc')
  }

  /**
   * 批量创建燕尾攻击箭头 Primitive。
   * @param viewer Cesium Viewer 实例。
   * @param items 燕尾攻击箭头配置列表。
   */
  addSwallowtailAttackArrows(viewer: Viewer, items: SwallowtailAttackArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定燕尾攻击箭头。
   * @param id 燕尾攻击箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateSwallowtailAttackArrow(id: string, properties: SwallowtailAttackArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /**
   * 批量更新燕尾攻击箭头。
   * @param updates 更新项列表。
   */
  updateSwallowtailAttackArrows(updates: SwallowtailAttackArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  /** 查询指定燕尾攻击箭头快照。 */
  getSwallowtailAttackArrow(id: string): SwallowtailAttackArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as SwallowtailAttackArrowCollectionSnapshot | null
  }

  /** 查询全部燕尾攻击箭头，可按 Viewer 过滤。 */
  getAllSwallowtailAttackArrows(viewer?: Viewer): SwallowtailAttackArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as SwallowtailAttackArrowCollectionSnapshot[]
  }
}
