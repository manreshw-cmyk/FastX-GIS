import * as Cesium from 'cesium'
import type { CustomDataSource, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import {
  mergeAggregationStyle,
  populatePointEntities,
  refreshClustering,
  setupClustering,
} from './core/aggregationShared'
import type {
  PointAggregationGeoJsonOptions,
  PointAggregationLoadOptions,
  PointAggregationSnapshot,
  PointAggregationStyle,
  PointAggregationUpdateOptions,
} from './types'

export type {
  PointAggregationClusterStyle,
  PointAggregationGeoJsonOptions,
  PointAggregationLoadOptions,
  PointAggregationPointStyle,
  PointAggregationSnapshot,
  PointAggregationStyle,
  PointAggregationUpdateOptions,
} from './types'
export { DEFAULT_POINT_AGGREGATION_STYLE } from './core/aggregationShared'

interface PointAggregationRecord {
  viewer: Viewer
  dataSource: CustomDataSource
  url?: string
  style: PointAggregationStyle
  featureCount: number
  show: boolean
  removeClusterListener: () => void
}

function destroyRecord(rec: PointAggregationRecord): void {
  rec.removeClusterListener()
  if (!rec.viewer.isDestroyed()) rec.viewer.dataSources.remove(rec.dataSource, true)
}

/**
 * 点聚合：解析 GeoJSON 并应用样式；绘制与层级显隐由 Cesium EntityCluster 处理。
 * 用户主要提供 `.json`（`properties.name`、可选 `properties.style`）。
 */
export default class PointAggregation {
  private readonly records = new Map<string, PointAggregationRecord>()

  /**
   * 从 URL 加载 GeoJSON。
   * @throws 无 url 或 HTTP 失败
   */
  async load(options: PointAggregationLoadOptions): Promise<string> {
    const url = options.url?.trim()
    if (!url) throw new Error('[FastX.PointAggregation] url 不能为空')

    const res = await fetch(url)
    if (!res.ok) throw new Error(`[FastX.PointAggregation] 加载失败 (${res.status}): ${url}`)

    return this.loadGeoJson({ ...options, geoJson: await res.json(), url })
  }

  /** 从 GeoJSON 对象加载；无有效点返回空字符串 */
  loadGeoJson(options: PointAggregationGeoJsonOptions): string {
    const viewer = options.viewer
    if (viewer.isDestroyed()) return ''

    const id = options.id?.trim() || createRandomXgxId('pa')
    this.remove(id)

    const style = mergeAggregationStyle(options.geoJson, options.style)
    const dataSource = new Cesium.CustomDataSource(`fastx-pa-${id}`)
    const featureCount = populatePointEntities(dataSource, options.geoJson, style)
    if (!featureCount) return ''

    const removeClusterListener = setupClustering(dataSource, style)
    viewer.dataSources.add(dataSource)
    refreshClustering(dataSource)
    requestAnimationFrame(() => refreshClustering(dataSource))

    const show = options.show !== false
    dataSource.show = show

    this.records.set(id, {
      viewer,
      dataSource,
      url: options.url?.trim() || undefined,
      style,
      featureCount,
      show,
      removeClusterListener,
    })

    return id
  }

  /** 更新显示或样式（改样式会重建 cluster 监听） */
  update(id: string, options: PointAggregationUpdateOptions): boolean {
    const rec = this.records.get(id)
    if (!rec || rec.viewer.isDestroyed()) return false

    if (options.style) {
      rec.style = mergeAggregationStyle(undefined, { ...rec.style, ...options.style })
      rec.removeClusterListener()
      rec.removeClusterListener = setupClustering(rec.dataSource, rec.style)
    }
    if (options.show !== undefined) {
      rec.show = options.show
      rec.dataSource.show = options.show
    }
    return true
  }

  remove(id: string): boolean {
    const rec = this.records.get(id)
    if (!rec) return false
    destroyRecord(rec)
    this.records.delete(id)
    return true
  }

  /** 清除记录；传入 viewer 时仅清除该 viewer */
  clear(viewer?: Viewer): void {
    for (const id of [...this.records.keys()]) {
      const rec = this.records.get(id)
      if (rec && (!viewer || rec.viewer === viewer)) this.remove(id)
    }
  }

  getSnapshot(id: string): PointAggregationSnapshot | null {
    const rec = this.records.get(id)
    return rec ? { id, url: rec.url, featureCount: rec.featureCount, show: rec.show } : null
  }

  getAll(viewer?: Viewer): PointAggregationSnapshot[] {
    return [...this.records.keys()]
      .map((id) => this.getSnapshot(id))
      .filter((s): s is PointAggregationSnapshot => !!s && (!viewer || this.records.get(s.id)?.viewer === viewer))
  }

  /** 移除 viewer 已销毁的残留记录 */
  pruneInvalid(): void {
    for (const id of [...this.records.keys()]) {
      const rec = this.records.get(id)
      if (!rec || rec.viewer.isDestroyed()) this.records.delete(id)
    }
  }
}
