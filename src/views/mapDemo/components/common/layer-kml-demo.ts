/**
 * 图层渲染示例 — KML 建筑加载辅助。
 *
 * 台北市 OSM 建筑数据体积较大，由 `layer-kml.vue` 通过 `Layer.loadKmlDataSource` 加载，
 * 本模块提供数据路径常量与加载后随机着色逻辑。
 */
import * as Cesium from 'cesium'

/** 台北市 OSM 建筑 KML 相对路径 */
export const TAIPEI_BUILDINGS_KML = 'json/taipei_buildings.kml'

/** KML 加载完成后为每栋建筑设置随机半透明颜色 */
export function applyRandomKmlBuildingColors(ds: Cesium.DataSource): void {
  for (const entity of ds.entities.values) {
    if (!entity.polygon) continue
    const color = Cesium.Color.fromRandom({ alpha: 0.78 })
    entity.polygon.material = new Cesium.ColorMaterialProperty(color)
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE.withAlpha(0.25))
  }
}
