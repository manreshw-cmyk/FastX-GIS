import type { Entity, Viewer } from 'cesium'
import type { AddAttackDirectionArrowOptions, AttackDirectionArrowSnapshot, UpdateAttackDirectionArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddAttackDirectionArrowOptions, AttackDirectionArrowSnapshot, UpdateAttackDirectionArrowProperties }

/** 进攻方向箭头标绘（Entity）。 */
export default class AttackDirectionArrow extends PlotArrowEntityBase {
  constructor() {
    super('attackDirection', 'adar')
  }

  /**
   * 批量创建进攻方向箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 进攻方向箭头配置列表。
   */
  addAttackDirectionArrows(viewer: Viewer, items: AddAttackDirectionArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定进攻方向箭头。
   * @param id 进攻方向箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateAttackDirectionArrow(id: string, properties: UpdateAttackDirectionArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定进攻方向箭头快照。 */
  getAttackDirectionArrow(id: string): AttackDirectionArrowSnapshot | null {
    return this.getPlotArrow(id) as AttackDirectionArrowSnapshot | null
  }

  /** 查询全部进攻方向箭头，可按 Viewer 过滤。 */
  getAllAttackDirectionArrows(viewer?: Viewer): AttackDirectionArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as AttackDirectionArrowSnapshot[]
  }

  /**
   * 创建单个进攻方向箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 进攻方向箭头绘制参数。
   */
  add(viewer: Viewer, options: AddAttackDirectionArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
