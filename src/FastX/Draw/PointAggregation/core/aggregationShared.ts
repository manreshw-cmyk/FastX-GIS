import * as Cesium from 'cesium'
import type { CustomDataSource, Entity } from 'cesium'
import { svgMarkupToDataUri } from '../../Billboard/svgDataUri'
import type {
  PointAggregationClusterStyle,
  PointAggregationPointStyle,
  PointAggregationStyle,
} from '../types'

const ON_TOP = {
  heightReference: Cesium.HeightReference.NONE,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
} as const

const DEFAULT_POINT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
  <defs>
    <filter id="sh" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <g filter="url(#sh)">
    <rect x="6" y="4" width="28" height="28" rx="10" fill="url(#bg)" stroke="#fff" stroke-width="1.5"/>
    <circle cx="20" cy="18" r="7" fill="#fff" fill-opacity="0.95"/>
    <circle cx="20" cy="18" r="3.5" fill="#4f46e5"/>
    <path d="M20 32 L20 44 C20 44 14 36 14 32 C14 28 17 26 20 26 C23 26 26 28 26 32 C26 36 20 44 20 44Z" fill="url(#bg)" stroke="#fff" stroke-width="1.2"/>
  </g>
</svg>`

/** 按聚合数量分档配色（层级越高越醒目） */
const CLUSTER_TIERS: { min: number; fill: string; alpha: number }[] = [
  { min: 100, fill: '#7c3aed', alpha: 0.52 },
  { min: 50, fill: '#dc2626', alpha: 0.54 },
  { min: 20, fill: '#ea580c', alpha: 0.56 },
  { min: 10, fill: '#0891b2', alpha: 0.58 },
  { min: 5, fill: '#059669', alpha: 0.6 },
  { min: 2, fill: '#2563eb', alpha: 0.62 },
]

const STYLE_ROOT_KEYS = ['aggregationStyle', 'style', 'pointAggregationStyle'] as const
const clusterIconCache = new Map<string, string>()

export const DEFAULT_POINT_AGGREGATION_STYLE: PointAggregationStyle = {
  point: {
    show: true,
    image: svgMarkupToDataUri(DEFAULT_POINT_SVG),
    scale: 1,
    color: '#4f46e5',
    pixelSize: 12,
    outlineColor: '#ffffff',
    outlineWidth: 2,
    labelShow: true,
    labelFont: '600 13px "Microsoft YaHei", sans-serif',
    labelFillColor: '#e0f2fe',
    labelOutlineColor: '#1e3a5f',
  },
  cluster: {
    enabled: true,
    pixelRange: 80,
    minimumClusterSize: 2,
    size: 54,
    textColor: '#ffffff',
    fontSize: 15,
    fillAlpha: 0.55,
  },
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickStyleRoot(root: unknown): Record<string, unknown> | undefined {
  if (!isRecord(root)) return undefined
  for (const key of STYLE_ROOT_KEYS) {
    const block = root[key]
    if (isRecord(block)) return block
  }
  return undefined
}

function cssColor(css: string | undefined, fallback: string): Cesium.Color {
  try {
    return Cesium.Color.fromCssColorString(css?.trim() || fallback)
  } catch {
    return Cesium.Color.fromCssColorString(fallback)
  }
}

/** 合并 JSON 根样式、load 入参与内置默认 */
export function mergeAggregationStyle(
  geoJsonRoot?: unknown,
  override?: PointAggregationStyle,
): PointAggregationStyle {
  const json = pickStyleRoot(geoJsonRoot)
  const jsonPoint = isRecord(json?.point) ? (json.point as PointAggregationPointStyle) : {}
  const jsonCluster = isRecord(json?.cluster) ? (json.cluster as PointAggregationClusterStyle) : {}
  return {
    point: { ...DEFAULT_POINT_AGGREGATION_STYLE.point, ...jsonPoint, ...override?.point },
    cluster: { ...DEFAULT_POINT_AGGREGATION_STYLE.cluster, ...jsonCluster, ...override?.cluster },
  }
}

/** 分档取色；仅显式设置 `cluster.color` 时用固定色 */
function resolveClusterFill(count: number, style: PointAggregationClusterStyle): { fill: string; alpha: number } {
  const fixed = style.color?.trim()
  if (fixed) return { fill: fixed, alpha: style.fillAlpha ?? 0.55 }
  const tier = CLUSTER_TIERS.find((t) => count >= t.min) ?? CLUSTER_TIERS[CLUSTER_TIERS.length - 1]!
  return { fill: tier.fill, alpha: style.fillAlpha ?? tier.alpha }
}

/** 绘制半透明聚合圆（圆心数字） */
function createClusterIcon(count: number, style: PointAggregationClusterStyle): string {
  const size = Math.max(36, style.size ?? 54)
  const { fill, alpha } = resolveClusterFill(count, style)
  const textColor = style.textColor ?? '#ffffff'
  const fontSize = style.fontSize ?? 15
  const key = `${count}|${size}|${fill}|${alpha}|${textColor}|${fontSize}`
  const hit = clusterIconCache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const r = size / 2
  ctx.beginPath()
  ctx.arc(r, r, r - 3, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.globalAlpha = alpha
  ctx.fill()
  ctx.globalAlpha = 1

  const text = count > 999 ? '999+' : String(count)
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = textColor
  ctx.shadowColor = 'rgba(15,23,42,0.45)'
  ctx.shadowBlur = 3
  ctx.fillText(text, r, r + 1)

  const uri = canvas.toDataURL()
  clusterIconCache.set(key, uri)
  return uri
}

function resolvePointStyle(
  props: Record<string, unknown> | undefined,
  defaults: PointAggregationPointStyle,
): PointAggregationPointStyle {
  const raw = props?.style
  const fromFeature = isRecord(raw) && isRecord(raw.point) ? (raw.point as PointAggregationPointStyle) : {}
  return { ...defaults, ...fromFeature }
}

/** 单点：上图标、下名称（锚点在底部） */
function applyPointGraphics(entity: Entity, style: PointAggregationPointStyle, name?: string): void {
  const show = style.show !== false
  const image = style.image?.trim()

  if (image) {
    entity.billboard = new Cesium.BillboardGraphics({
      image,
      scale: style.scale ?? 1,
      width: 36,
      height: 44,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      ...ON_TOP,
      show,
    })
    entity.point = undefined
  } else {
    entity.point = new Cesium.PointGraphics({
      pixelSize: style.pixelSize ?? 12,
      color: cssColor(style.color, '#4f46e5'),
      outlineColor: cssColor(style.outlineColor, '#ffffff'),
      outlineWidth: style.outlineWidth ?? 2,
      ...ON_TOP,
      show,
    })
    entity.billboard = undefined
  }

  const text = style.labelText?.trim() || name?.trim() || ''
  if (!text || style.labelShow === false) {
    entity.label = undefined
    return
  }

  entity.label = new Cesium.LabelGraphics({
    text,
    font: style.labelFont ?? '600 13px "Microsoft YaHei", sans-serif',
    fillColor: cssColor(style.labelFillColor, '#e0f2fe'),
    outlineColor: cssColor(style.labelOutlineColor, '#1e3a5f'),
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.TOP,
    pixelOffset: new Cesium.Cartesian2(0, image || entity.billboard ? 6 : 10),
    ...ON_TOP,
    show: true,
  })
}

interface PointFeature {
  coordinates: number[]
  properties?: Record<string, unknown>
}

function extractPointFeatures(geoJson: unknown): PointFeature[] {
  const out: PointFeature[] = []
  if (!isRecord(geoJson)) return out

  const push = (f: unknown) => {
    if (!isRecord(f) || f.type !== 'Feature') return
    const geom = f.geometry
    if (!isRecord(geom) || geom.type !== 'Point') return
    const coords = geom.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return
    out.push({
      coordinates: coords as number[],
      properties: isRecord(f.properties) ? f.properties : undefined,
    })
  }

  if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
    geoJson.features.forEach(push)
  } else if (geoJson.type === 'Feature') {
    push(geoJson)
  }
  return out
}

/**
 * 将 GeoJSON 点写入 DataSource。
 * 显隐与聚合由 Cesium EntityCluster 处理，此处只解析样式。
 */
export function populatePointEntities(
  dataSource: CustomDataSource,
  geoJson: unknown,
  style: PointAggregationStyle,
): number {
  const defaults = style.point ?? DEFAULT_POINT_AGGREGATION_STYLE.point!
  let count = 0

  for (const [i, feature] of extractPointFeatures(geoJson).entries()) {
    const lon = Number(feature.coordinates[0])
    const lat = Number(feature.coordinates[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue

    const h = Number(feature.coordinates[2] ?? 0)
    const props = feature.properties
    const pointStyle = resolvePointStyle(props, defaults)
    const name = typeof props?.name === 'string' ? props.name : undefined

    const entity = dataSource.entities.add({
      id: `pa-${i}-${lon.toFixed(5)}-${lat.toFixed(5)}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, Number.isFinite(h) ? h : 0),
      properties: props ? new Cesium.PropertyBag(props) : undefined,
    })
    applyPointGraphics(entity, pointStyle, name)
    count++
  }
  return count
}

/** 触发 Cesium 重新聚类（解决初次/缩放后未刷新） */
export function refreshClustering(dataSource: CustomDataSource): void {
  const c = dataSource.clustering
  if (!c.enabled) return
  const range = c.pixelRange
  c.pixelRange = range + 0.001
  c.pixelRange = range
}

type ClusterGraphic = {
  label: { show: boolean }
  billboard: {
    show: boolean
    image?: string
    width?: number
    height?: number
    verticalOrigin?: Cesium.VerticalOrigin
    heightReference?: Cesium.HeightReference
    disableDepthTestDistance?: number
  }
  point: { show: boolean }
}

function hideCluster(cluster: ClusterGraphic): void {
  cluster.label.show = false
  cluster.billboard.show = false
  cluster.point.show = false
}

/**
 * 配置 Cesium 聚合：图标与名称一并参与聚类。
 * 缩小 → 半透明分色圆+数字；放大 → 图标+名称。
 */
export function setupClustering(dataSource: CustomDataSource, style: PointAggregationStyle): () => void {
  const clusterStyle = { ...DEFAULT_POINT_AGGREGATION_STYLE.cluster, ...style.cluster }
  const minSize = Math.max(2, clusterStyle.minimumClusterSize ?? 2)
  const size = clusterStyle.size ?? 54
  const clustering = dataSource.clustering

  clustering.enabled = clusterStyle.enabled !== false
  clustering.pixelRange = clusterStyle.pixelRange ?? 80
  clustering.minimumClusterSize = minSize
  clustering.clusterBillboards = true
  clustering.clusterLabels = true
  clustering.clusterPoints = true

  const removeListener = clustering.clusterEvent.addEventListener((_entities, cluster) => {
    const g = cluster as ClusterGraphic
    const n = _entities.length
    if (n < minSize) {
      hideCluster(g)
      return
    }

    hideCluster(g)
    g.billboard.show = true
    g.billboard.image = createClusterIcon(n, clusterStyle)
    g.billboard.width = size
    g.billboard.height = size
    g.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER
    Object.assign(g.billboard, ON_TOP)
  })

  return () => {
    if (typeof removeListener === 'function') removeListener()
  }
}
