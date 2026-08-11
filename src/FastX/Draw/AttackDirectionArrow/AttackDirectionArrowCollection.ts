import type { Viewer } from 'cesium'
import type {
  AttackDirectionArrowCollectionAddItem,
  AttackDirectionArrowCollectionSnapshot,
  AttackDirectionArrowCollectionUpdateEntry,
  AttackDirectionArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  AttackDirectionArrowCollectionAddItem,
  AttackDirectionArrowCollectionSnapshot,
  AttackDirectionArrowCollectionUpdateEntry,
  AttackDirectionArrowCollectionUpdateProps,
}

/** 批量进攻方向箭头标绘（Primitive）。 */
export default class AttackDirectionArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('attackDirection', 'adarc')
  }

  /**
   * 批量创建进攻方向箭头 Primitive。
   * @param viewer Cesium Viewer 实例。
   * @param items 进攻方向箭头配置列表。
   */
  addAttackDirectionArrows(viewer: Viewer, items: AttackDirectionArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定进攻方向箭头。
   * @param id 进攻方向箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateAttackDirectionArrow(id: string, properties: AttackDirectionArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /**
   * 批量更新进攻方向箭头。
   * @param updates 更新项列表。
   */
  updateAttackDirectionArrows(updates: AttackDirectionArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  /** 查询指定进攻方向箭头快照。 */
  getAttackDirectionArrow(id: string): AttackDirectionArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as AttackDirectionArrowCollectionSnapshot | null
  }

  /** 查询全部进攻方向箭头，可按 Viewer 过滤。 */
  getAllAttackDirectionArrows(viewer?: Viewer): AttackDirectionArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as AttackDirectionArrowCollectionSnapshot[]
  }
}
