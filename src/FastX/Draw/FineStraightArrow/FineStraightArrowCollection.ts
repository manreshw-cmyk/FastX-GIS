import type { Viewer } from 'cesium'
import type {
  FineStraightArrowCollectionAddItem,
  FineStraightArrowCollectionSnapshot,
  FineStraightArrowCollectionUpdateEntry,
  FineStraightArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  FineStraightArrowCollectionAddItem,
  FineStraightArrowCollectionSnapshot,
  FineStraightArrowCollectionUpdateEntry,
  FineStraightArrowCollectionUpdateProps,
}

/** 批量细直箭头标绘（Primitive）。 */
export default class FineStraightArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('fineStraight', 'fstac')
  }

  addFineStraightArrows(viewer: Viewer, items: FineStraightArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  updateFineStraightArrow(id: string, properties: FineStraightArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  updateFineStraightArrows(updates: FineStraightArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  getFineStraightArrow(id: string): FineStraightArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as FineStraightArrowCollectionSnapshot | null
  }

  getAllFineStraightArrows(viewer?: Viewer): FineStraightArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as FineStraightArrowCollectionSnapshot[]
  }
}
