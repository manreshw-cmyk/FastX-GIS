import type {
  Camera,
  CesiumTerrainProvider,
  GridImageryProvider,
  Resource,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from 'cesium'
import { CzmlDataSource, GeoJsonDataSource, KmlDataSource } from 'cesium'

import type { LayerCenter, LayerCameraOrientation, LayerInitialCameraOptions, LayerPerformanceInitConfig, LayerUiInitConfig, LayerInitConfig, ImageryLayerInsertOptions, ImageryLayerVisualParams, LayerOverviewMapOptions } from '../Types'
export type { LayerCenter, LayerCameraOrientation, LayerInitialCameraOptions, LayerPerformanceInitConfig, LayerUiInitConfig, LayerInitConfig, ImageryLayerInsertOptions, ImageryLayerVisualParams, LayerOverviewMapOptions }

/** camera.setView 的入参（与 Cesium 一致）。 */
export type LayerCameraSetViewOptions = Parameters<Camera['setView']>[0]
/** camera.flyTo 的入参（与 Cesium 一致）。 */
export type LayerCameraFlyToOptions = Parameters<Camera['flyTo']>[0]

export type WmtsImageryAddInput = WebMapTileServiceImageryProvider.ConstructorOptions
export type WmsImageryAddInput = WebMapServiceImageryProvider.ConstructorOptions
export type TmsImageryFromUrlOptions = TileMapServiceImageryProvider.ConstructorOptions
export type UrlTemplateImageryAddInput = UrlTemplateImageryProvider.ConstructorOptions
export type GridImageryAddInput = GridImageryProvider.ConstructorOptions

export type { LayerGridStyleOptions } from './gridImagery'

export type GeoJsonLoadInput = Parameters<typeof GeoJsonDataSource.load>[0]
export type GeoJsonLoadOptions = NonNullable<Parameters<typeof GeoJsonDataSource.load>[1]>

export type KmlLoadInput = Parameters<typeof KmlDataSource.load>[0]
export type KmlLoadOptions = NonNullable<Parameters<typeof KmlDataSource.load>[1]>

export type CzmlLoadInput = Parameters<typeof CzmlDataSource.load>[0]
export type CzmlLoadOptions = NonNullable<Parameters<typeof CzmlDataSource.load>[1]>

export type TerrainFromUrlInput = string | Resource
export type TerrainFromUrlOptions = CesiumTerrainProvider.ConstructorOptions

/** 二三维模式（对应文档「二三维切换」）。 */
export type LayerSceneModeKey = '3d' | '2d' | 'columbus'

export type { Color, CzmlDataSource, GeoJsonDataSource, ImageryLayer, KmlDataSource, Rectangle, SceneMode, Viewer } from 'cesium'
