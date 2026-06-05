/**
 * 图层渲染示例 — GeoJSON 省界墙。
 *
 * 读取 `china_provinces.geojson`，按省绘制不同颜色的 Wall（带高度）。
 */
import * as Cesium from 'cesium'
import { fastxDataUrl } from './layer-demo-shared'

const PROVINCE_WALL_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6',
  '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9a6324', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#ffe119', '#000000',
]

type GeoJsonGeometry = {
  type: string
  coordinates: number[][][] | number[][][][]
}

type GeoJsonFeature = {
  properties?: { name?: string }
  geometry: GeoJsonGeometry
}

/** 从 Polygon / MultiPolygon 提取经纬度环 */
function extractLonLatRings(geometry: GeoJsonGeometry): number[][][] {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map((ring) =>
      ring.map(([lon, lat]) => [lon, lat]),
    )
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).flatMap((poly) =>
      poly.map((ring) => ring.map(([lon, lat]) => [lon, lat])),
    )
  }
  return []
}

/** 加载各省边界墙实体（需由调用方 trackEntities + cleanup） */
export async function loadChinaProvinceWalls(viewer: Cesium.Viewer): Promise<Cesium.Entity[]> {
  const resp = await fetch(fastxDataUrl('json/china_provinces.geojson'))
  if (!resp.ok) throw new Error('省界 GeoJSON 读取失败')
  const geojson = (await resp.json()) as { features: GeoJsonFeature[] }
  const entities: Cesium.Entity[] = []

  geojson.features.forEach((feature, index) => {
    const name = feature.properties?.name ?? `省-${index + 1}`
    const color = Cesium.Color.fromCssColorString(PROVINCE_WALL_COLORS[index % PROVINCE_WALL_COLORS.length])
    const wallHeight = 800 + (index % 7) * 400

    extractLonLatRings(feature.geometry).forEach((ring, ringIndex) => {
      if (ring.length < 3) return
      const flat: number[] = []
      for (const [lon, lat] of ring) flat.push(lon, lat)
      const positions = Cesium.Cartesian3.fromDegreesArray(flat)
      entities.push(
        viewer.entities.add({
          name: ringIndex === 0 ? name : `${name}-${ringIndex}`,
          wall: {
            positions,
            minimumHeights: new Array(positions.length).fill(0),
            maximumHeights: new Array(positions.length).fill(wallHeight),
            material: color.withAlpha(0.82),
            outline: true,
            outlineColor: color.withAlpha(0.95),
          },
        }),
      )
    })
  })

  return entities
}

/** 飞行至中国全境范围 */
export async function flyToChina(viewer: Cesium.Viewer): Promise<void> {
  await viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(73.5, 17.5, 135.5, 53.8),
    duration: 2.2,
  })
}
