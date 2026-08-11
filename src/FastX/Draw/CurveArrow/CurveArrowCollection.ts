import type { Viewer } from 'cesium'
import type {
  CurveArrowCollectionAddItem,
  CurveArrowCollectionSnapshot,
  CurveArrowCollectionUpdateEntry,
  CurveArrowCollectionUpdateProps,
} from '../../Types'
import { PlotArrowCollectionBase } from '../PlotArrow/PlotArrowCollectionBase'

export type {
  CurveArrowCollectionAddItem,
  CurveArrowCollectionSnapshot,
  CurveArrowCollectionUpdateEntry,
  CurveArrowCollectionUpdateProps,
}

/** 批量曲线箭头标绘（Primitive）。 */
export default class CurveArrowCollection extends PlotArrowCollectionBase {
  constructor() {
    super('curve', 'carc')
  }

  addCurveArrows(viewer: Viewer, items: CurveArrowCollectionAddItem[]): string[] {
    return this.addArrows(viewer, items)
  }

  updateCurveArrow(id: string, properties: CurveArrowCollectionUpdateProps): boolean {
    return this.updatePlotArrow(id, properties)
  }

  updateCurveArrows(updates: CurveArrowCollectionUpdateEntry[]): Array<{ id: string; success: boolean }> {
    return this.updateArrows(updates)
  }

  getCurveArrow(id: string): CurveArrowCollectionSnapshot | null {
    return this.getPlotArrow(id) as CurveArrowCollectionSnapshot | null
  }

  getAllCurveArrows(viewer?: Viewer): CurveArrowCollectionSnapshot[] {
    return this.getAllPlotArrows(viewer) as CurveArrowCollectionSnapshot[]
  }
}
