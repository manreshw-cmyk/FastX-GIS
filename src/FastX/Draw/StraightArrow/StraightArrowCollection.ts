import type { Viewer } from 'cesium'
import type {
  StraightArrowCollectionAddItem,
  StraightArrowCollectionSnapshot,
  StraightArrowCollectionUpdateEntry,
  StraightArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  StraightArrowCollectionAddItem,
  StraightArrowCollectionSnapshot,
  StraightArrowCollectionUpdateEntry,
  StraightArrowCollectionUpdateProps,
}

/** 批量直箭头标绘（Primitive）。 */
export default class StraightArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('straight', 'stac')
  }

  addStraightArrows(viewer: Viewer, items: StraightArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  updateStraightArrow(id: string, properties: StraightArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  updateStraightArrows(updates: StraightArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  getStraightArrow(id: string): StraightArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as StraightArrowCollectionSnapshot | null
  }

  getAllStraightArrows(viewer?: Viewer): StraightArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as StraightArrowCollectionSnapshot[]
  }
}
