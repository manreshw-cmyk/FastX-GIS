import type { Entity, Viewer } from 'cesium'
import type { AddSwallowtailAttackArrowOptions, SwallowtailAttackArrowSnapshot, UpdateSwallowtailAttackArrowProperties } from '../../Types'
import { PlotArrowEntityBase } from '../PlotArrow/BasePlotArrow'

export type { AddSwallowtailAttackArrowOptions, SwallowtailAttackArrowSnapshot, UpdateSwallowtailAttackArrowProperties }

/** 燕尾攻击箭头标绘（Entity）。 */
export default class SwallowtailAttackArrow extends PlotArrowEntityBase {
  constructor() {
    super('swallowtailAttack', 'saar')
  }

  /**
   * 批量创建燕尾攻击箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param items 燕尾攻击箭头配置列表。
   */
  addSwallowtailAttackArrows(viewer: Viewer, items: AddSwallowtailAttackArrowOptions[]): string[] {
    return this.addArrows(viewer, items)
  }

  /**
   * 更新指定燕尾攻击箭头。
   * @param id 燕尾攻击箭头唯一 id。
   * @param properties 需要覆盖的控制点、样式或业务数据。
   */
  updateSwallowtailAttackArrow(id: string, properties: UpdateSwallowtailAttackArrowProperties): boolean {
    return this.updatePlotArrow(id, properties)
  }

  /** 查询指定燕尾攻击箭头快照。 */
  getSwallowtailAttackArrow(id: string): SwallowtailAttackArrowSnapshot | null {
    return this.getPlotArrow(id) as SwallowtailAttackArrowSnapshot | null
  }

  /** 查询全部燕尾攻击箭头，可按 Viewer 过滤。 */
  getAllSwallowtailAttackArrows(viewer?: Viewer): SwallowtailAttackArrowSnapshot[] {
    return this.getAllPlotArrows(viewer) as SwallowtailAttackArrowSnapshot[]
  }

  /**
   * 创建单个燕尾攻击箭头 Entity。
   * @param viewer Cesium Viewer 实例。
   * @param options 燕尾攻击箭头绘制参数。
   */
  add(viewer: Viewer, options: AddSwallowtailAttackArrowOptions): Entity | undefined {
    return super.add(viewer, options)
  }
}
