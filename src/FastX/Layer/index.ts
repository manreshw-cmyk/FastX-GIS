import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import type {
  CzmlLoadInput,
  CzmlLoadOptions,
  GeoJsonLoadInput,
  GeoJsonLoadOptions,
  GridImageryAddInput,
  ImageryLayerInsertOptions,
  ImageryLayerVisualParams,
  KmlLoadInput,
  KmlLoadOptions,
  LayerCameraFlyToOptions,
  LayerCameraOrientation,
  LayerCameraSetViewOptions,
  LayerCenter,
  LayerInitConfig,
  LayerInitialCameraOptions,
  LayerOverviewMapOptions,
  LayerPerformanceInitConfig,
  LayerSceneModeKey,
  TerrainFromUrlInput,
  TerrainFromUrlOptions,
  TmsImageryFromUrlOptions,
  UrlTemplateImageryAddInput,
  WmsImageryAddInput,
  WmtsImageryAddInput,
} from "./types";
import {
  mergeGridImageryOptions,
  type LayerGridStyleOptions,
} from "./gridImagery";

export type {
  CzmlDataSource,
  CzmlLoadInput,
  CzmlLoadOptions,
  GeoJsonDataSource,
  GeoJsonLoadInput,
  GeoJsonLoadOptions,
  GridImageryAddInput,
  ImageryLayer,
  ImageryLayerInsertOptions,
  ImageryLayerVisualParams,
  KmlDataSource,
  KmlLoadInput,
  KmlLoadOptions,
  LayerCameraFlyToOptions,
  LayerCameraOrientation,
  LayerCameraSetViewOptions,
  LayerCenter,
  LayerInitConfig,
  LayerInitialCameraOptions,
  LayerOverviewMapOptions,
  LayerPerformanceInitConfig,
  LayerSceneModeKey,
  LayerUiInitConfig,
  TerrainFromUrlInput,
  TerrainFromUrlOptions,
  TmsImageryFromUrlOptions,
  UrlTemplateImageryAddInput,
  Viewer,
  WmsImageryAddInput,
  WmtsImageryAddInput,
} from "./types";

export {
  buildDefaultGridImageryOptions,
  DEFAULT_GRID_CELLS,
  DEFAULT_GRID_LINE_COLOR_CSS,
  mergeGridImageryOptions,
} from "./gridImagery";
export type { LayerGridStyleOptions } from "./gridImagery";

/** 比例尺横线固定像素宽度（仅数值随缩放变化） */
const SCALE_BAR_LINE_PX = 80;
const SCALE_BAR_BOTTOM_PX = 12;
const SCALE_BAR_LEFT_PX = 12;

/** 比例尺文字：与鼠标经纬度类似，连续小数变化 */
function formatScaleBarLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)}KM`;
  if (meters >= 1) return `${meters.toFixed(2)}M`;
  return `${(meters * 100).toFixed(2)}CM`;
}

/**
 * FastX — 图层（Layer）+ 文档「基础工具（Tools）类」能力封装。
 *
 * - 图层：初始化、地形、WMTS/WMS/TMS/UrlTemplate/Grid、GeoJSON/KML/CZML、影像调色/滤镜、地球底色/底图、相机 setView/flyTo 等。
 * - 工具：二三维切换、鹰眼（主↔鹰视角与可选双向操作、鹰眼内主图鼠标投影红点）、大气/光照、视角复位、实体查询、`clearAllMapEntities` 清空实体与数据源、比例尺/层级/罗盘、鼠标样式、视口高度与中心等；主视图滚轮缩放默认降低 `zoomFactor`，并提供 `zoomInOut` 程序化缩放。
 * - Cesium 默认 Logo/版权条容器在创建 Viewer 时由本类固定隐藏，不提供对外配置项。
 */
export class Layer {
  /** `initMap` 时按 `mapName` 注册，供 `Layer.getLayerByMapName` / `window.FastX.getLayer` 获取 */
  private static readonly layersByMapName = new Map<string, Layer>();

  private viewer: Cesium.Viewer | null = null;
  private mapName: string | undefined;
  private gridOverlayLayer: Cesium.ImageryLayer | null = null;
  private overviewViewer: Cesium.Viewer | null = null;
  private overviewContainer: HTMLElement | null = null;
  private overviewPostRenderRemove: (() => void) | null = null;
  private overviewInputHandler: Cesium.ScreenSpaceEventHandler | null = null;
  /** 鹰眼内：红点（主图拾取投影 或 鹰眼内鼠标位置）；鹰眼 canvas 使用 `cursor:none` 由该点代替。 */
  private overviewMainSyncDotEl: HTMLElement | null = null;
  private overviewPointerCartesian: Cesium.Cartesian3 | null = null;
  private overviewDotSource: "main" | "overview" = "main";
  private overviewLocalDot: { x: number; y: number } | null = null;
  private removeOverviewMainCanvasListeners: (() => void) | null = null;
  private removeOverviewDotCanvasListeners: (() => void) | null = null;
  private homeState: {
    center: LayerCenter;
    orientation: LayerCameraOrientation;
  } | null = null;
  private scaleBarPostRemove: (() => void) | null = null;
  private tileLevelPostRemove: (() => void) | null = null;
  private compassPostRemove: (() => void) | null = null;
  private scaleBarEl: HTMLElement | null = null;
  private scaleBarLabelEl: HTMLElement | null = null;
  private scaleBarLineEl: HTMLElement | null = null;
  private tileLevelEl: HTMLElement | null = null;
  private compassEl: HTMLElement | null = null;

  /**
   * 初始化地图（图层）。
   *
   * **输入**：
   * - `containerId`：挂载 `Viewer` 的 DOM 元素 id。
   * - `config`：`LayerInitConfig`（必填 `center`、`imageryUrlTemplate`；可选地形、初视角 `initialCamera`、网格、性能 `performance`、UI `ui` 等）。Cesium Logo 区域始终隐藏。
   * **输出**：`Promise<Cesium.Viewer>`。
   *
   * @example
   * ```ts
   * await layer.initMap('map', {
   *   center: { longitude: 116.4, latitude: 39.9, height: 2e6 },
   *   imageryUrlTemplate: 'https://tiles.example/{z}/{x}/{y}.png',
   *   ui: { showScaleBar: true, initialCursor: 'grab' },
   * })
   * ```
   */
  async initMap(
    containerId: string,
    config: LayerInitConfig,
  ): Promise<Cesium.Viewer> {
    this.destroy();

    if (config.ionAccessToken !== undefined) {
      Cesium.Ion.defaultAccessToken = config.ionAccessToken;
    }

    const mapNameKey = config.mapName?.trim();
    this.mapName = mapNameKey || undefined;
    if (mapNameKey) {
      Layer.layersByMapName.set(mapNameKey, this);
    }
    const orientation: LayerCameraOrientation = {
      headingDegrees: config.orientation?.headingDegrees ?? 0,
      pitchDegrees: config.orientation?.pitchDegrees ?? -45,
      rollDegrees: config.orientation?.rollDegrees ?? 0,
    };
    this.homeState = {
      center: { ...config.center },
      orientation: { ...orientation },
    };

    const viewer = new Cesium.Viewer(containerId, {
      baseLayerPicker: false,
      baseLayer: false,
      geocoder: false,
      animation: false,
      timeline: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      vrButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: false,
      ...config.viewerOptions,
    });

    /** 贴地折线（Entity `clampToGround` / GroundPolylinePrimitive）依赖近似地形高度表；提前拉取避免首条贴地线长时间空白。 */
    await Cesium.GroundPolylinePrimitive.initializeTerrainHeights();

    this.applyPerformance(viewer, config.performance);
    this.hideCesiumCreditBar(viewer);

    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: config.imageryUrlTemplate,
      ...config.imageryProviderOptions,
    });
    viewer.imageryLayers.addImageryProvider(imageryProvider);

    if (config.terrainUrl) {
      viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
        config.terrainUrl,
        config.terrainProviderOptions,
      );
    } else {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

    viewer.scene.globe.depthTestAgainstTerrain =
      config.depthTestAgainstTerrain ?? false;

    this.viewer = viewer;

    // Cesium Viewer 默认 LEFT_DOUBLE_CLICK → pickAndTrackObject（双击实体 zoomTo / trackedEntity），此处关闭。
    // viewer.screenSpaceEventHandler.setInputAction(pickAndTrackObject, LEFT_DOUBLE_CLICK)
    viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    //设置相机最小、最大距离
    var camController = viewer.scene.screenSpaceCameraController;
    camController.minimumZoomDistance = 3.0;
    camController.maximumZoomDistance = 150000000 * 2;

    await this.applyInitialCamera(
      viewer,
      config.center,
      orientation,
      config.initialCamera,
    );

    if (config.showGridAtStartup) {
      this.addGridImageryLayer(
        mergeGridImageryOptions(config.gridStyle, config.gridAtStartupOptions),
      );
    }

    if (config.ui?.initialCursor) {
      this.setCanvasCursorStyle(config.ui.initialCursor);
    }

    if (config.ui?.showScaleBar) {
      this.setScaleBarVisible(true);
    }
    if (config.ui?.showTileLevelOverlay) {
      this.setTileLevelOverlayVisible(true);
    }
    if (config.ui?.showCompassOverlay) {
      this.setCompassOverlayVisible(true);
    }

    return viewer;
  }

  // ——————————————————————————————————————————————————————————————
  // 文档「图层（Layer）类」— 地形 / 影像 / 数据
  // ——————————————————————————————————————————————————————————————

  /**
   * 将地形切换为 `CesiumTerrainProvider.fromUrl` 加载的量化网格地形。
   *
   * **输入**：`url`（地形服务地址或 Resource）；`options`（可选构造参数）。
   * **输出**：`Promise<void>`。
   *
   * @example
   * ```ts
   * await layer.setTerrainWithCesiumTerrainProvider('https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles')
   * ```
   */
  async setTerrainWithCesiumTerrainProvider(
    url: TerrainFromUrlInput,
    options?: TerrainFromUrlOptions,
  ): Promise<void> {
    const viewer = this.assertViewer();
    viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
      url,
      options,
    );
  }

  /**
   * 追加 WMTS 影像层。
   *
   * **输入**：`wmtsOptions`（`WebMapTileServiceImageryProvider` 构造选项）；`insert.insertIndex`（可选插入索引）。
   * **输出**：`ImageryLayer`。
   *
   * @example
   * ```ts
   * layer.addImageryFromWmts({ url: '...', layer: '...', style: 'default', ... })
   * ```
   */
  addImageryFromWmts(
    wmtsOptions: WmtsImageryAddInput,
    insert?: ImageryLayerInsertOptions,
  ): Cesium.ImageryLayer {
    this.assertViewer();
    const provider = new Cesium.WebMapTileServiceImageryProvider(wmtsOptions);
    return this.addImageryProvider(provider, insert?.insertIndex);
  }

  /**
   * 追加 WMS 影像层。
   *
   * **输入**：`wmsOptions`；`insert.insertIndex`（可选）。
   * **输出**：`ImageryLayer`。
   *
   * @example
   * ```ts
   * layer.addImageryFromWms({ url: '...', layers: 'layer1' })
   * ```
   */
  addImageryFromWms(
    wmsOptions: WmsImageryAddInput,
    insert?: ImageryLayerInsertOptions,
  ): Cesium.ImageryLayer {
    this.assertViewer();
    const provider = new Cesium.WebMapServiceImageryProvider(wmsOptions);
    return this.addImageryProvider(provider, insert?.insertIndex);
  }

  /**
   * 从 TMS 服务地址追加影像层。
   *
   * **输入**：`url`；`options`（TMS 构造选项）；`insert`（可选索引）。
   * **输出**：`Promise<ImageryLayer>`。
   *
   * @example
   * ```ts
   * await layer.addImageryFromTms('https://example/tms', {})
   * ```
   */
  async addImageryFromTms(
    url: string | Cesium.Resource,
    options?: TmsImageryFromUrlOptions,
    insert?: ImageryLayerInsertOptions,
  ): Promise<Cesium.ImageryLayer> {
    this.assertViewer();
    const provider = await Cesium.TileMapServiceImageryProvider.fromUrl(
      url,
      options,
    );
    return this.addImageryProvider(provider, insert?.insertIndex);
  }

  /**
   * 追加 XYZ / 模板 URL 影像层。
   *
   * **输入**：`templateOptions`（含 `url` 模板）；`insert`（可选）。
   * **输出**：`ImageryLayer`。
   *
   * @example
   * ```ts
   * layer.addImageryFromUrlTemplate({ url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png' })
   * ```
   */
  addImageryFromUrlTemplate(
    templateOptions: UrlTemplateImageryAddInput,
    insert?: ImageryLayerInsertOptions,
  ): Cesium.ImageryLayer {
    this.assertViewer();
    const provider = new Cesium.UrlTemplateImageryProvider(templateOptions);
    return this.addImageryProvider(provider, insert?.insertIndex);
  }

  /**
   * 追加网格影像层，并记录为「当前网格层」供 `removeGridImageryLayer` 使用。
   *
   * **输入**：`gridOptions`（`GridImageryProvider` 选项，可空）；`insert`（可选）。
   * **输出**：`ImageryLayer`。
   *
   * @example
   * ```ts
   * layer.addGridImageryLayer(undefined, undefined, { lineColor: 'rgba(180,180,180,0.4)' })
   * ```
   */
  addGridImageryLayer(
    gridOptions?: GridImageryAddInput,
    insert?: ImageryLayerInsertOptions,
    style?: LayerGridStyleOptions,
  ): Cesium.ImageryLayer {
    this.assertViewer();
    const provider = new Cesium.GridImageryProvider(
      mergeGridImageryOptions(style, gridOptions),
    );
    const layer = this.addImageryProvider(provider, insert?.insertIndex);
    layer.alpha = 0.86;
    this.gridOverlayLayer = layer;
    return layer;
  }

  /**
   * 移除由 `addGridImageryLayer` / 启动时网格所记录的网格影像层（若存在）。
   *
   * **输入**：无。**输出**：无。
   *
   * @example
   * ```ts
   * layer.removeGridImageryLayer()
   * ```
   */
  removeGridImageryLayer(): void {
    const viewer = this.assertViewer();
    if (this.gridOverlayLayer && !this.gridOverlayLayer.isDestroyed()) {
      viewer.imageryLayers.remove(this.gridOverlayLayer, false);
    }
    this.gridOverlayLayer = null;
  }

  /**
   * 加载 GeoJSON 并加入 `viewer.dataSources`。
   *
   * **输入**：`data`（URL / 对象 / Blob 等，与 `GeoJsonDataSource.load` 一致）；`options`（可选）。
   * **输出**：`Promise<GeoJsonDataSource>`。
   *
   * @example
   * ```ts
   * await layer.loadGeoJsonDataSource('/data/areas.geojson', { stroke: Cesium.Color.CYAN })
   * ```
   */
  async loadGeoJsonDataSource(
    data: GeoJsonLoadInput,
    options?: GeoJsonLoadOptions,
  ): Promise<Cesium.GeoJsonDataSource> {
    const viewer = this.assertViewer();
    const ds = await Cesium.GeoJsonDataSource.load(data, options);
    viewer.dataSources.add(ds);
    return ds;
  }

  /**
   * 加载 KML 并加入 `viewer.dataSources`。
   *
   * **输入**：`data`；`options`（可选）。
   * **输出**：`Promise<KmlDataSource>`。
   *
   * @example
   * ```ts
   * await layer.loadKmlDataSource('/data/route.kml')
   * ```
   */
  async loadKmlDataSource(
    data: KmlLoadInput,
    options?: KmlLoadOptions,
  ): Promise<Cesium.KmlDataSource> {
    const viewer = this.assertViewer();
    const ds = await Cesium.KmlDataSource.load(data, options);
    viewer.dataSources.add(ds);
    return ds;
  }

  /**
   * 加载 CZML 并加入 `viewer.dataSources`。
   *
   * **输入**：`czml`；`options`（可选）。
   * **输出**：`Promise<CzmlDataSource>`。
   *
   * @example
   * ```ts
   * await layer.loadCzmlDataSource('/data/satellite.czml')
   * ```
   */
  async loadCzmlDataSource(
    czml: CzmlLoadInput,
    options?: CzmlLoadOptions,
  ): Promise<Cesium.CzmlDataSource> {
    const viewer = this.assertViewer();
    const ds = await Cesium.CzmlDataSource.load(czml, options);
    viewer.dataSources.add(ds);
    return ds;
  }

  /**
   * 按引用移除影像层。
   *
   * **输入**：`layer`；`destroyImageryProvider`（是否销毁 Provider，默认 false）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.removeImageryLayer(someLayer, true)
   * ```
   */
  removeImageryLayer(
    layer: Cesium.ImageryLayer,
    destroyImageryProvider?: boolean,
  ): void {
    const viewer = this.assertViewer();
    viewer.imageryLayers.remove(layer, destroyImageryProvider ?? false);
    if (layer === this.gridOverlayLayer) this.gridOverlayLayer = null;
  }

  /**
   * 按索引移除影像层。
   *
   * **输入**：`index`（`imageryLayers` 下标）；`destroyImageryProvider`（可选）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.removeImageryLayerByIndex(1)
   * ```
   */
  removeImageryLayerByIndex(
    index: number,
    destroyImageryProvider?: boolean,
  ): void {
    const viewer = this.assertViewer();
    const layer = viewer.imageryLayers.get(index);
    if (layer)
      viewer.imageryLayers.remove(layer, destroyImageryProvider ?? false);
    if (layer === this.gridOverlayLayer) this.gridOverlayLayer = null;
  }

  /**
   * 将指定影像层提到最顶（最后绘制）。
   *
   * **输入**：`layer`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.raiseImageryLayerToTop(layer)
   * ```
   */
  raiseImageryLayerToTop(layer: Cesium.ImageryLayer): void {
    this.assertViewer().imageryLayers.raiseToTop(layer);
  }

  /**
   * 将指定影像层压到最底（最先绘制）。
   *
   * **输入**：`layer`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.lowerImageryLayerToBottom(layer)
   * ```
   */
  lowerImageryLayerToBottom(layer: Cesium.ImageryLayer): void {
    this.assertViewer().imageryLayers.lowerToBottom(layer);
  }

  /**
   * 设置地球底色（无影像区域）。
   *
   * **输入**：`color`（`Cesium.Color`）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.setGlobeBaseColor(Cesium.Color.fromCssColorString('#0a1628'))
   * ```
   */
  setGlobeBaseColor(color: Cesium.Color): void {
    this.assertViewer().scene.globe.baseColor = color;
  }

  /**
   * 在地球最底层追加单张「背景图」影像（`SingleTileImageryProvider`）。
   *
   * **输入**：`options.url`；`options.rectangle`（可选，未传时默认 `Rectangle.fromDegrees(-180, -90, 180, 90)`）；`options.insertAtBottom`（默认 true）。
   * **输出**：`Promise<ImageryLayer>`。
   *
   * @example
   * ```ts
   * await layer.addGlobeBackgroundImageLayer({ url: '/bg.png' })
   * ```
   */
  async addGlobeBackgroundImageLayer(options: {
    url: string | Cesium.Resource;
    rectangle?: Cesium.Rectangle;
    insertAtBottom?: boolean;
  }): Promise<Cesium.ImageryLayer> {
    this.assertViewer();
    const provider = await Cesium.SingleTileImageryProvider.fromUrl(
      options.url,
      {
        rectangle:
          options.rectangle ?? Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      },
    );
    const index = options.insertAtBottom === false ? undefined : 0;
    return this.addImageryProvider(provider, index);
  }

  /**
   * 设置影像层调色/滤镜（亮度、对比度、色相、饱和度、Gamma、透明度等）。
   *
   * **输入**：`target`（层索引或 `ImageryLayer`）；`params`（`ImageryLayerVisualParams`）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.setImageryLayerVisualParams(0, { brightness: 1.2, contrast: 1.1, alpha: 0.9 })
   * ```
   */
  setImageryLayerVisualParams(
    target: number | Cesium.ImageryLayer,
    params: ImageryLayerVisualParams,
  ): void {
    const layer = this.resolveImageryLayer(target);
    if (params.alpha !== undefined) layer.alpha = params.alpha;
    if (params.brightness !== undefined) layer.brightness = params.brightness;
    if (params.contrast !== undefined) layer.contrast = params.contrast;
    if (params.hue !== undefined) layer.hue = params.hue;
    if (params.saturation !== undefined) layer.saturation = params.saturation;
    if (params.gamma !== undefined) layer.gamma = params.gamma;
    if (params.nightAlpha !== undefined) layer.nightAlpha = params.nightAlpha;
    if (params.dayAlpha !== undefined) layer.dayAlpha = params.dayAlpha;
  }

  /**
   * 设置影像层瓦片纹理缩小/放大滤波（图层刚添加时调用更稳妥）。
   *
   * **输入**：`target`；`filters`（`minificationFilter` / `magnificationFilter`）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.setImageryLayerTextureFilters(0, {
   *   minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
   *   magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR,
   * })
   * ```
   */
  setImageryLayerTextureFilters(
    target: number | Cesium.ImageryLayer,
    filters: {
      minificationFilter?: Cesium.TextureMinificationFilter;
      magnificationFilter?: Cesium.TextureMagnificationFilter;
    },
  ): void {
    const layer = this.resolveImageryLayer(target);
    if (filters.minificationFilter !== undefined)
      layer.minificationFilter = filters.minificationFilter;
    if (filters.magnificationFilter !== undefined)
      layer.magnificationFilter = filters.magnificationFilter;
  }

  /**
   * 显隐某一影像层。
   *
   * **输入**：`target`（索引或层）；`show`。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.setImageryLayerShow(0, false)
   * ```
   */
  setImageryLayerShow(
    target: number | Cesium.ImageryLayer,
    show: boolean,
  ): void {
    this.resolveImageryLayer(target).show = show;
  }

  /**
   * 显隐地球（Globe）。
   *
   * **输入**：`show`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.setGlobeShow(false)
   * ```
   */
  setGlobeShow(show: boolean): void {
    this.assertViewer().scene.globe.show = show;
  }

  /**
   * 封装 `camera.setView`（任意 Cesium 合法 destination/orientation）。
   *
   * **输入**：`options` — 与 `Camera.setView` 一致的对象。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.cameraSetView({
   *   destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 1e6),
   *   orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
   * })
   * ```
   */
  cameraSetView(options: LayerCameraSetViewOptions): void {
    this.assertViewer().camera.setView(options);
  }

  /**
   * 封装 `camera.flyTo`。
   *
   * **输入**：`options` — 与 `Camera.flyTo` 一致；可通过 `complete` / `cancel` 感知结束。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.cameraFlyTo({
   *   destination: Cesium.Cartesian3.fromDegrees(121.5, 31.2, 5e5),
   *   duration: 2,
   * })
   * ```
   */
  cameraFlyTo(options: LayerCameraFlyToOptions): void {
    this.assertViewer().camera.flyTo(options);
  }

  /**
   * 以屏幕中心对应地表（或椭球）点为锚，沿当前 heading/pitch 做程序化缩放。
   *
   * **输入**：`zoomIn` — `true` 放大（拉近）、`false` 缩小（拉远）。
   * **输出**：无。
   */
  zoomInOut(zoomIn: boolean): void {
    const viewer = this.assertViewer();
    const center = this.pickCenter();
    const height = viewer.camera.positionCartographic.height;
    const boundSph = new Cesium.BoundingSphere(
      Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 1000),
      height,
    );
    const moveRate = zoomIn ? 0.5 : 1.5;
    viewer.camera.flyToBoundingSphere(boundSph, {
      duration: 0.8,
      offset: new Cesium.HeadingPitchRange(
        viewer.camera.heading,
        viewer.camera.pitch,
        height * moveRate,
      ),
    });
  }

  // ——————————————————————————————————————————————————————————————
  // 文档「基础工具（Tools）类」
  // ——————————————————————————————————————————————————————————————

  /**
   * 二三维模式切换（3D / 2D / Columbus）。
   *
   * **输入**：`mode` — `'3d' | '2d' | 'columbus'`；`durationSeconds` — 形变时长（秒），默认 0。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.setSceneMode('2d', 1)
   * ```
   */
  setSceneMode(mode: LayerSceneModeKey, durationSeconds = 0): void {
    const viewer = this.assertViewer();
    const duration = durationSeconds;
    if (mode === "3d") viewer.scene.morphTo3D(duration);
    else if (mode === "2d") viewer.scene.morphTo2D(duration);
    else viewer.scene.morphToColumbusView(duration);
  }

  /**
   * 查询当前场景模式。
   *
   * **输入**：无。
   * **输出**：`SceneMode` 枚举值。
   *
   * @example
   * ```ts
   * const mode = layer.getSceneMode()
   * ```
   */
  getSceneMode(): Cesium.SceneMode {
    return this.assertViewer().scene.mode;
  }

  /**
   * 清除主视图上的业务叠加：`viewer.entities` 与 `viewer.dataSources`（经 Layer 加载的 GeoJSON/KML/CZML 等）。
   * 不移除影像层、地形、自定义 `scene.primitives`；未初始化或 Viewer 已销毁时为 no-op。
   */
  clearAllMapEntities(): void {
    const v = this.viewer;
    if (!v || v.isDestroyed()) return;
    v.entities.removeAll();
    v.dataSources.removeAll();
    v.selectedEntity = undefined;
  }

  /**
   * 将各功能页共用的地图 UI 恢复为与 `XMap` 初始化后一致：鹰眼/大气层/光照关，三维球面，比例尺与瓦片层级等覆写关。
   * 在切换左侧菜单卡片时调用，避免上一页的开关延续到下一页。
   */
  resetSharedMapDemoUiState(): void {
    const v = this.viewer;
    if (!v || v.isDestroyed()) return;
    this.setOverviewMapVisible(false);
    this.setSkyAtmosphereVisible(false);
    this.setGlobeLightingEnabled(false);
    this.setScaleBarVisible(false);
    this.setTileLevelOverlayVisible(false);
    this.setCompassOverlayVisible(false);
    if (
      v.scene.mode !== Cesium.SceneMode.SCENE3D &&
      v.scene.mode !== Cesium.SceneMode.MORPHING
    ) {
      v.scene.morphTo3D(0);
    }
  }

  /**
   * 开启或关闭鹰眼（小窗第二 Viewer）。
   * - **视角**：主图相机经纬与 heading/pitch/roll 同步到鹰眼，鹰眼高度约为主图 ÷ `heightRatio`。
   * - **双向操作**：`options.bidirectionalSync !== false`（默认）时，鹰眼拖拽/滚轮会改变主图；为 `false` 时仅主图→鹰眼。
   * - **标记**：鹰眼 canvas 隐藏系统指针（`cursor:none`），用一颗红点代替；在鹰眼上移动时为鹰眼内坐标，在主图上移动时为拾取点投影到鹰眼（`cartesianToCanvasCoordinates`）。双向拖拽/滚轮仍由 `bidirectionalSync` 控制。
   *
   * **输入**：`visible`；`options`（宽高、`heightRatio`、`bidirectionalSync`、影像模板等）。
   * **输出**：无；失败时抛错。
   *
   * @example
   * ```ts
   * layer.setOverviewMapVisible(true, { width: 240, height: 180, heightRatio: 10, bidirectionalSync: true })
   * layer.setOverviewMapVisible(true, { bidirectionalSync: false })
   * layer.setOverviewMapVisible(false)
   * ```
   */
  setOverviewMapVisible(
    visible: boolean,
    options?: LayerOverviewMapOptions,
  ): void {
    const main = this.assertViewer();
    if (!visible) {
      this.destroyOverviewMap();
      return;
    }
    if (this.overviewViewer) return;

    const bidirectional = options?.bidirectionalSync !== false;

    const container = document.createElement("div");
    container.style.cssText = [
      "position:absolute",
      "right:12px",
      "bottom:12px",
      `width:${options?.width ?? 220}px`,
      `height:${options?.height ?? 165}px`,
      "z-index:9",
      "border:1px solid rgba(0,0,0,0.35)",
      "border-radius:4px",
      "overflow:hidden",
      "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
    ].join(";");
    main.container.appendChild(container);
    this.overviewContainer = container;

    const ov = new Cesium.Viewer(container, {
      baseLayerPicker: false,
      baseLayer: false,
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: document.createElement("div"),
    });
    this.hideCesiumCreditBar(ov);
    ov.scene.globe.depthTestAgainstTerrain =
      main.scene.globe.depthTestAgainstTerrain;
    ov.scene.screenSpaceCameraController.enableInputs = false;

    const template =
      options?.imageryUrlTemplate ??
      this.tryGetUrlTemplateFromMainImagery(main);
    if (!template) {
      ov.destroy();
      container.remove();
      this.overviewContainer = null;
      throw new Error(
        "[FastX.Layer] 鹰眼需要 imageryUrlTemplate：请在 setOverviewMapVisible 的 options 中传入，或主视图首层为 UrlTemplateImageryProvider",
      );
    }
    ov.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: template,
        ...options?.imageryProviderOptions,
      }),
    );
    ov.terrainProvider = main.terrainProvider;
    this.overviewViewer = ov;

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:99999;overflow:visible";
    const syncDot = document.createElement("div");
    syncDot.style.cssText = [
      "position:absolute",
      "display:none",
      "width:12px",
      "height:12px",
      "border-radius:50%",
      "background:#e53935",
      "border:2px solid #fff",
      "box-shadow:0 0 0 1px rgba(0,0,0,0.55)",
      "transform:translate(-50%,-50%)",
      "box-sizing:border-box",
      "pointer-events:none",
    ].join(";");
    overlay.append(syncDot);
    container.appendChild(overlay);
    this.overviewMainSyncDotEl = syncDot;

    ov.scene.canvas.style.cursor = "none";
    const onOvCanvasMove = (e: MouseEvent) => {
      if (!ov || ov.isDestroyed()) return;
      this.overviewDotSource = "overview";
      const cr = container.getBoundingClientRect();
      this.overviewLocalDot = { x: e.clientX - cr.left, y: e.clientY - cr.top };
      this.refreshOverviewPointerOverlayPositions();
      ov.scene.requestRender();
    };
    const onOvCanvasLeave = () => {
      this.overviewLocalDot = null;
      this.overviewDotSource = "main";
      this.refreshOverviewPointerOverlayPositions();
    };
    ov.scene.canvas.addEventListener("mousemove", onOvCanvasMove);
    ov.scene.canvas.addEventListener("mouseleave", onOvCanvasLeave);
    this.removeOverviewDotCanvasListeners = () => {
      if (ov && !ov.isDestroyed()) {
        const cv = ov.scene.canvas;
        cv.style.cursor = "";
        cv.removeEventListener("mousemove", onOvCanvasMove);
        cv.removeEventListener("mouseleave", onOvCanvasLeave);
      }
      this.removeOverviewDotCanvasListeners = null;
    };

    const heightRatio = options?.heightRatio ?? 8;
    const syncMainToOverview = () => {
      if (
        !this.viewer ||
        this.viewer.isDestroyed() ||
        !this.overviewViewer ||
        this.overviewViewer.isDestroyed()
      ) {
        return;
      }
      const m = this.viewer;
      /** 二三维形变过程中 heading/pitch/roll 为 undefined，此时 setView 会抛错，需跳过同步。 */
      if (m.scene.mode === Cesium.SceneMode.MORPHING) {
        return;
      }
      const o = this.overviewViewer;
      const pos = m.camera.positionCartographic;
      const h = Math.max(pos.height / heightRatio, 100);
      const heading = m.camera.heading;
      const pitch = m.camera.pitch;
      const roll = m.camera.roll;
      if (heading === undefined || pitch === undefined || roll === undefined) {
        return;
      }
      o.camera.setView({
        destination: Cesium.Cartesian3.fromRadians(
          pos.longitude,
          pos.latitude,
          h,
        ),
        orientation: {
          heading,
          pitch,
          roll,
        },
      });
      this.refreshOverviewPointerOverlayPositions();
    };
    const removeSync =
      main.scene.postRender.addEventListener(syncMainToOverview);
    this.overviewPostRenderRemove = () => {
      removeSync();
    };

    const onMainMove = (e: MouseEvent) => {
      this.overviewDotSource = "main";
      this.handleMainCanvasPointerForOverview(e);
    };
    const onMainLeave = () => {
      this.overviewPointerCartesian = null;
      this.overviewDotSource = "main";
      this.refreshOverviewPointerOverlayPositions();
    };
    main.scene.canvas.addEventListener("mousemove", onMainMove);
    main.scene.canvas.addEventListener("mouseleave", onMainLeave);
    this.removeOverviewMainCanvasListeners = () => {
      main.scene.canvas.removeEventListener("mousemove", onMainMove);
      main.scene.canvas.removeEventListener("mouseleave", onMainLeave);
      this.removeOverviewMainCanvasListeners = null;
    };

    if (bidirectional) {
      const handler = new Cesium.ScreenSpaceEventHandler(ov.scene.canvas);
      this.overviewInputHandler = handler;
      let drag = false;
      handler.setInputAction(
        (e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
          drag = true;
          this.applyMainLookAtFromOverview(e.position);
        },
        Cesium.ScreenSpaceEventType.LEFT_DOWN,
      );
      handler.setInputAction(() => {
        drag = false;
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
      handler.setInputAction(
        (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
          if (drag) this.applyMainLookAtFromOverview(movement.endPosition);
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE,
      );
      handler.setInputAction((delta: number) => {
        this.applyMainHeightFromOverviewWheel(delta);
      }, Cesium.ScreenSpaceEventType.WHEEL);
    }

    syncMainToOverview();
  }

  /** 鹰眼小窗是否已创建且未销毁。 */
  isOverviewMapVisible(): boolean {
    return this.overviewViewer != null && !this.overviewViewer.isDestroyed();
  }

  /**
   * 显隐大气层（`skyAtmosphere`）。
   *
   * **输入**：`visible`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.setSkyAtmosphereVisible(false)
   * ```
   */
  setSkyAtmosphereVisible(visible: boolean): void {
    const viewer = this.assertViewer();
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = visible;
  }

  /**
   * 开启或关闭太阳光照（`globe.enableLighting`）。
   *
   * **输入**：`enabled`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.setGlobeLightingEnabled(true)
   * ```
   */
  setGlobeLightingEnabled(enabled: boolean): void {
    this.assertViewer().scene.globe.enableLighting = enabled;
  }

  /**
   * 视角复位到 `initMap` 时记录的中心与朝向（无记录时退化为 `camera.flyHome`）。
   *
   * **输入**：`options.useAnimation` — 为 true 时用 `flyTo`；`options.duration` — 飞行动画秒数。
   * **输出**：无动画时为 `void`；有动画时为 `Promise<void>`。
   *
   * @example
   * ```ts
   * layer.resetCameraToHome()
   * await layer.resetCameraToHome({ useAnimation: true, duration: 2 })
   * ```
   */
  resetCameraToHome(options?: {
    useAnimation?: boolean;
    duration?: number;
  }): void | Promise<void> {
    const viewer = this.assertViewer();
    if (!this.homeState) {
      viewer.camera.flyHome(0);
      return;
    }
    const { center, orientation } = this.homeState;
    if (options?.useAnimation) {
      return this.applyFlyToCenter(center, orientation, options.duration ?? 2);
    }
    this.applySetViewToCenter(center, orientation);
  }

  /**
   * 按 id 判断 `viewer.entities` 中是否存在实体。
   *
   * **输入**：`id`（字符串）。
   * **输出**：`boolean`。
   *
   * @example
   * ```ts
   * if (layer.entityExistsById('marker-1')) { ... }
   * ```
   */
  entityExistsById(id: string): boolean {
    return this.assertViewer().entities.getById(id) !== undefined;
  }

  /**
   * 获取当前相机高度（相对椭球，千米）。
   *
   * **输入**：无。
   * **输出**：`number`（km）。
   *
   * @example
   * ```ts
   * const km = layer.getViewportHeightKm()
   * ```
   */
  getViewportHeightKm(): number {
    const c = this.assertViewer().camera.positionCartographic;
    return c.height / 1000;
  }

  /**
   * 以经纬高设置地图中心（推荐入口；等价于「中心点 + 朝向」的 setView / flyTo）。
   *
   * **输入**：`center`（`LayerCenter`）；`options.useAnimation` — 为 true 时 `flyTo`；`options.duration`；`options.orientation`（度，可选）。
   * **输出**：无动画为 `void`；有动画为 `Promise<void>`。更底层请用 `cameraSetView` / `cameraFlyTo`。
   *
   * @example
   * ```ts
   * layer.setMapCenter({ longitude: 121.5, latitude: 31.2, height: 5e5 })
   * await layer.setMapCenter(
   *   { longitude: 116.4, latitude: 39.9, height: 1e6 },
   *   { useAnimation: true, duration: 2 },
   * )
   * ```
   */
  setMapCenter(
    center: LayerCenter,
    options?: {
      useAnimation?: boolean;
      duration?: number;
      orientation?: LayerCameraOrientation;
    },
  ): void | Promise<void> {
    if (options?.useAnimation) {
      return this.applyFlyToCenter(
        center,
        options.orientation,
        options.duration ?? 2,
      );
    }
    this.applySetViewToCenter(center, options?.orientation);
  }

  /**
   * 获取当前相机位置（经纬度为度，高度为米，相对椭球）。
   *
   * **输入**：无。
   * **输出**：`{ longitude, latitude, height }`。
   *
   * @example
   * ```ts
   * const { longitude, latitude, height } = layer.getCameraCenterLngLatHeight()
   * ```
   */
  getCameraCenterLngLatHeight(): {
    longitude: number;
    latitude: number;
    height: number;
  } {
    const c = this.assertViewer().camera.positionCartographic;
    return {
      longitude: Cesium.Math.toDegrees(c.longitude),
      latitude: Cesium.Math.toDegrees(c.latitude),
      height: c.height,
    };
  }

  /**
   * 显隐自绘简易比例尺（DOM，叠加在 `viewer.container` 上）。
   *
   * **输入**：`visible`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.setScaleBarVisible(true)
   * ```
   */
  setScaleBarVisible(visible: boolean): void {
    const viewer = this.assertViewer();
    if (visible) {
      if (this.scaleBarEl) return;
      const root = document.createElement("div");
      root.className = "fx-map-scale-bar";
      root.style.cssText =
        `position:absolute;left:${SCALE_BAR_LEFT_PX}px;bottom:${SCALE_BAR_BOTTOM_PX}px;z-index:5;display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 12px;pointer-events:none;user-select:none;box-sizing:border-box`;

      const label = document.createElement("div");
      label.className = "fx-map-scale-bar__label";
      label.style.cssText =
        "color:rgba(255,255,255,0.94);font:12px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.02em;white-space:nowrap";

      const line = document.createElement("div");
      line.className = "fx-map-scale-bar__line";
      line.style.cssText =
        `position:relative;width:${SCALE_BAR_LINE_PX}px;height:0;flex-shrink:0;border-bottom:2px solid rgba(255,255,255,0.94);box-sizing:border-box`;

      const tickStyle =
        "position:absolute;bottom:0;width:2px;height:7px;background:#fff";
      const tickL = document.createElement("span");
      tickL.style.cssText = `${tickStyle};left:0`;
      const tickR = document.createElement("span");
      tickR.style.cssText = `${tickStyle};right:0`;
      line.appendChild(tickL);
      line.appendChild(tickR);

      root.appendChild(label);
      root.appendChild(line);
      viewer.container.appendChild(root);

      this.scaleBarEl = root;
      this.scaleBarLabelEl = label;
      this.scaleBarLineEl = line;

      const onPost = () => {
        const v = this.viewer;
        if (!v || v.isDestroyed()) return;
        this.updateScaleBarDom(v);
      };
      onPost();
      this.scaleBarPostRemove =
        viewer.scene.postRender.addEventListener(onPost);
    } else {
      this.scaleBarPostRemove?.();
      this.scaleBarPostRemove = null;
      if (this.scaleBarEl) {
        this.scaleBarEl.remove();
        this.scaleBarEl = null;
        this.scaleBarLabelEl = null;
        this.scaleBarLineEl = null;
      }
    }
  }

  /**
   * 显隐粗略瓦片层级文字（自绘 DOM）。
   *
   * **输入**：`visible`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.setTileLevelOverlayVisible(true)
   * ```
   */
  setTileLevelOverlayVisible(visible: boolean): void {
    const viewer = this.assertViewer();
    if (visible) {
      if (this.tileLevelEl) return;
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;left:12px;bottom:12px;z-index:8;padding:4px 8px;background:rgba(255,255,255,0.85);font:12px/1.4 sans-serif;border-radius:4px;pointer-events:none";
      viewer.container.appendChild(el);
      this.tileLevelEl = el;
      const onPost = () => {
        if (!this.viewer || !this.tileLevelEl) return;
        const h = viewer.camera.positionCartographic.height;
        const level = Math.max(
          0,
          Math.min(18, Math.round(Math.log2(40075017 / Math.max(h, 1)))),
        );
        this.tileLevelEl.textContent = `层级 ≈ ${level}`;
      };
      this.tileLevelPostRemove =
        viewer.scene.postRender.addEventListener(onPost);
    } else {
      this.tileLevelPostRemove?.();
      this.tileLevelPostRemove = null;
      if (this.tileLevelEl) {
        this.tileLevelEl.remove();
        this.tileLevelEl = null;
      }
    }
  }

  /** 自绘比例尺 DOM 是否正在显示。 */
  isScaleBarVisible(): boolean {
    return this.scaleBarEl != null && this.scaleBarEl.isConnected;
  }

  /** 自绘瓦片层级 DOM 是否正在显示。 */
  isTileLevelOverlayVisible(): boolean {
    return this.tileLevelEl != null && this.tileLevelEl.isConnected;
  }

  /**
   * 显隐自绘简易罗盘（指示相机航向）。
   *
   * **输入**：`visible`。**输出**：无。
   *
   * @example
   * ```ts
   * layer.setCompassOverlayVisible(true)
   * ```
   */
  setCompassOverlayVisible(visible: boolean): void {
    const viewer = this.assertViewer();
    if (visible) {
      if (this.compassEl) return;
      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:absolute;right:12px;top:12px;z-index:8;width:48px;height:48px;pointer-events:none";
      const arrow = document.createElement("div");
      arrow.style.cssText =
        "width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:22px solid #1a5fb4;margin:4px auto 0;transform-origin:50% 70%;";
      wrap.appendChild(arrow);
      viewer.container.appendChild(wrap);
      this.compassEl = wrap;
      const onPost = () => {
        if (!this.viewer || !arrow) return;
        const heading = viewer.camera.heading;
        arrow.style.transform = `rotate(${-Cesium.Math.toDegrees(heading)}deg)`;
      };
      this.compassPostRemove = viewer.scene.postRender.addEventListener(onPost);
    } else {
      this.compassPostRemove?.();
      this.compassPostRemove = null;
      if (this.compassEl) {
        this.compassEl.remove();
        this.compassEl = null;
      }
    }
  }

  /**
   * 设置主画布 CSS `cursor`（如 `grab`、`pointer`）。
   *
   * **输入**：`cursor`（CSS 字符串）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.setCanvasCursorStyle('crosshair')
   * ```
   */
  setCanvasCursorStyle(cursor: string): void {
    this.assertViewer().canvas.style.cursor = cursor;
  }

  /**
   * 运行时应用性能相关选项（与初始化 `performance` 字段含义一致）。
   *
   * **输入**：`options`（`LayerPerformanceInitConfig`）。
   * **输出**：无。
   *
   * @example
   * ```ts
   * layer.applyPerformanceOptions({ requestRenderMode: true, maximumRenderTimeChange: 0.5 })
   * ```
   */
  applyPerformanceOptions(options: LayerPerformanceInitConfig): void {
    this.applyPerformance(this.assertViewer(), options);
  }

  /**
   * 获取 `initMap` 时传入的 `mapName`（若有）。
   *
   * **输入**：无。**输出**：`string | undefined`。
   *
   * @example
   * ```ts
   * const name = layer.getMapName()
   * ```
   */
  getMapName(): string | undefined {
    return this.mapName;
  }

  /**
   * 按 `initMap` 时传入的 `mapName` 获取已注册的 `Layer` 实例。
   * Viewer 已销毁时返回 `undefined`。
   */
  static getLayerByMapName(mapName: string): Layer | undefined {
    const key = mapName.trim();
    if (!key) return undefined;
    const layer = Layer.layersByMapName.get(key);
    if (!layer) return undefined;
    const v = layer.getViewer();
    if (!v || v.isDestroyed()) return undefined;
    return layer;
  }

  /** 当前已注册且 Viewer 仍有效的 `mapName` 列表 */
  static getRegisteredMapNames(): readonly string[] {
    const names: string[] = [];
    for (const [name, layer] of Layer.layersByMapName) {
      const v = layer.getViewer();
      if (v && !v.isDestroyed()) names.push(name);
    }
    return names;
  }

  /**
   * 获取当前主 `Viewer` 引用（未初始化或已销毁时为 `null`）。
   *
   * **输入**：无。**输出**：`Viewer | null`。
   *
   * @example
   * ```ts
   * const v = layer.getViewer()
   * ```
   */
  getViewer(): Cesium.Viewer | null {
    return this.viewer;
  }

  /**
   * 销毁 Layer 内部资源（比例尺/罗盘/鹰眼/主 Viewer 等）。
   *
   * **输入**：无。**输出**：无。
   *
   * @example
   * ```ts
   * layer.destroy()
   * ```
   */
  destroy(): void {
    this.disposeInternals(true);
  }

  // ——————————————————————————————————————————————————————————————
  // 内部
  // ——————————————————————————————————————————————————————————————

  /**
   * 在屏幕某点测算「每像素对应多少米」（地表距离 / 像素跨度）。
   * 优先 globe.pick，其次椭球拾取，最后用相机离地高度估算。
   */
  private getMetersPerPixelAtScreen(
    viewer: Cesium.Viewer,
    screenX: number,
    screenY: number,
    spanPx: number,
  ): number | null {
    const scene = viewer.scene;
    const ellipsoid = scene.globe.ellipsoid;
    const half = spanPx * 0.5;
    const left = new Cesium.Cartesian2(screenX - half, screenY);
    const right = new Cesium.Cartesian2(screenX + half, screenY);

    const pickGround = (pos: Cesium.Cartesian2): Cesium.Cartesian3 | undefined => {
      const ray = viewer.camera.getPickRay(pos, new Cesium.Ray());
      if (!ray) return undefined;
      const onGlobe = scene.globe.pick(ray, scene);
      if (onGlobe) return onGlobe;
      return viewer.camera.pickEllipsoid(pos, ellipsoid) ?? undefined;
    };

    const c0 = pickGround(left);
    const c1 = pickGround(right);
    if (c0 && c1) {
      const ground = Cesium.Cartesian3.distance(c0, c1);
      if (ground > 0) return ground / spanPx;
    }

    const height = viewer.camera.positionCartographic.height;
    if (!Number.isFinite(height) || height <= 0) return null;

    const frustum = viewer.camera.frustum as Cesium.PerspectiveFrustum;
    if (!frustum?.getPixelDimensions) return null;

    const px = new Cesium.Cartesian2();
    const pixelRatio =
      (typeof window !== "undefined" ? window.devicePixelRatio : 1) *
      viewer.resolutionScale;
    frustum.getPixelDimensions(
      scene.drawingBufferWidth,
      scene.drawingBufferHeight,
      height,
      pixelRatio,
      px,
    );
    return Number.isFinite(px.x) && px.x > 0 ? px.x : null;
  }

  private updateScaleBarDom(viewer: Cesium.Viewer): void {
    if (!this.scaleBarLabelEl || !this.scaleBarLineEl) return;

    const containerRect = viewer.container.getBoundingClientRect();
    const lineRect = this.scaleBarLineEl.getBoundingClientRect();
    const sampleX =
      lineRect.width > 0
        ? lineRect.left - containerRect.left + lineRect.width * 0.5
        : SCALE_BAR_LEFT_PX + 12 + SCALE_BAR_LINE_PX * 0.5;
    const sampleY =
      lineRect.height > 0
        ? lineRect.top - containerRect.top + lineRect.height * 0.5
        : viewer.scene.canvas.clientHeight - SCALE_BAR_BOTTOM_PX - 15;

    const mPerPx = this.getMetersPerPixelAtScreen(
      viewer,
      sampleX,
      sampleY,
      SCALE_BAR_LINE_PX,
    );

    if (mPerPx == null || mPerPx <= 0) {
      this.scaleBarLabelEl.textContent = "—";
      return;
    }

    const distanceMeters = mPerPx * SCALE_BAR_LINE_PX;
    this.scaleBarLabelEl.textContent = formatScaleBarLabel(distanceMeters);
  }

  private disposeInternals(destroyMainViewer: boolean): void {
    this.scaleBarPostRemove?.();
    this.scaleBarPostRemove = null;
    this.tileLevelPostRemove?.();
    this.tileLevelPostRemove = null;
    this.compassPostRemove?.();
    this.compassPostRemove = null;
    if (this.scaleBarEl) {
      this.scaleBarEl.remove();
      this.scaleBarEl = null;
      this.scaleBarLabelEl = null;
      this.scaleBarLineEl = null;
    }
    if (this.tileLevelEl) {
      this.tileLevelEl.remove();
      this.tileLevelEl = null;
    }
    if (this.compassEl) {
      this.compassEl.remove();
      this.compassEl = null;
    }
    this.destroyOverviewMap();
    this.gridOverlayLayer = null;

    if (destroyMainViewer && this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }
    if (destroyMainViewer) {
      const name = this.mapName;
      if (name && Layer.layersByMapName.get(name) === this) {
        Layer.layersByMapName.delete(name);
      }
      this.viewer = null;
      this.mapName = undefined;
      this.homeState = null;
    }
  }

  private destroyOverviewMap(): void {
    this.removeOverviewDotCanvasListeners?.();
    this.removeOverviewDotCanvasListeners = null;
    this.removeOverviewMainCanvasListeners?.();
    this.removeOverviewMainCanvasListeners = null;

    if (this.overviewPostRenderRemove) {
      this.overviewPostRenderRemove();
      this.overviewPostRenderRemove = null;
    }
    if (this.overviewInputHandler && !this.overviewInputHandler.isDestroyed()) {
      this.overviewInputHandler.destroy();
    }
    this.overviewInputHandler = null;
    if (this.overviewViewer && !this.overviewViewer.isDestroyed()) {
      this.overviewViewer.destroy();
    }
    this.overviewViewer = null;
    this.overviewMainSyncDotEl = null;
    this.overviewPointerCartesian = null;
    this.overviewLocalDot = null;
    this.overviewDotSource = "main";
    if (this.overviewContainer?.parentElement) {
      this.overviewContainer.remove();
    }
    this.overviewContainer = null;
  }

  /** 主图 canvas 鼠标移动：拾取地表/椭球点，供鹰眼红点投影（与鹰眼内红点二选一显示源）。 */
  private handleMainCanvasPointerForOverview(e: MouseEvent): void {
    if (!this.overviewViewer || this.overviewViewer.isDestroyed()) return;
    const main = this.viewer;
    if (!main || main.isDestroyed()) return;
    const canvas = main.scene.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const pos = new Cesium.Cartesian2(x, y);
    const ray = main.camera.getPickRay(pos);
    if (!ray) {
      this.overviewPointerCartesian = null;
      this.refreshOverviewPointerOverlayPositions();
      return;
    }
    let cartesian = main.scene.globe.pick(ray, main.scene) as
      | Cesium.Cartesian3
      | undefined;
    if (!cartesian) {
      cartesian =
        main.camera.pickEllipsoid(pos, main.scene.globe.ellipsoid) ?? undefined;
    }
    this.overviewPointerCartesian = cartesian ?? null;
    this.refreshOverviewPointerOverlayPositions();
  }

  /**
   * 更新鹰眼红点：优先「鹰眼内鼠标」坐标；否则用主图拾取点在鹰眼场景中的 `cartesianToCanvasCoordinates`
   * 再换算到鹰眼外层容器坐标（避免仅用 window 坐标与容器错位）。
   */
  private refreshOverviewPointerOverlayPositions(): void {
    const container = this.overviewContainer;
    const ov = this.overviewViewer;
    const dot = this.overviewMainSyncDotEl;
    if (!container || !ov || ov.isDestroyed() || !dot) return;

    const cr = container.getBoundingClientRect();
    const sceneCanvas = ov.scene.canvas;
    const cRect = sceneCanvas.getBoundingClientRect();
    const ox = cRect.left - cr.left;
    const oy = cRect.top - cr.top;

    if (this.overviewDotSource === "overview" && this.overviewLocalDot) {
      dot.style.display = "block";
      dot.style.left = `${this.overviewLocalDot.x}px`;
      dot.style.top = `${this.overviewLocalDot.y}px`;
      return;
    }

    if (this.overviewPointerCartesian) {
      const cc = ov.scene.cartesianToCanvasCoordinates(
        this.overviewPointerCartesian,
        new Cesium.Cartesian2(),
      );
      if (cc) {
        dot.style.display = "block";
        dot.style.left = `${ox + cc.x}px`;
        dot.style.top = `${oy + cc.y}px`;
        return;
      }
    }

    dot.style.display = "none";
  }

  private applyPerformance(
    viewer: Cesium.Viewer,
    perf?: LayerPerformanceInitConfig,
  ): void {
    if (!perf) return;
    if (perf.requestRenderMode !== undefined)
      viewer.scene.requestRenderMode = perf.requestRenderMode;
    if (perf.maximumRenderTimeChange !== undefined)
      viewer.scene.maximumRenderTimeChange = perf.maximumRenderTimeChange;
    if (perf.useBrowserRecommendedResolution !== undefined) {
      viewer.useBrowserRecommendedResolution =
        perf.useBrowserRecommendedResolution;
    }
    if (perf.showFps !== undefined)
      viewer.scene.debugShowFramesPerSecond = perf.showFps;
    if (perf.msaaSamples !== undefined && viewer.scene.msaaSupported) {
      viewer.scene.msaaSamples = perf.msaaSamples;
    }
  }

  /** 内部固定隐藏 Cesium 默认 credit/Logo 容器（合规与数据协议仍由业务侧自行满足）。 */
  private hideCesiumCreditBar(viewer: Cesium.Viewer): void {
    const credit = viewer.cesiumWidget.creditContainer as
      | HTMLElement
      | undefined;
    if (credit) credit.style.display = "none";
  }

  private applySetViewToCenter(
    center: LayerCenter,
    orientation?: LayerCameraOrientation,
  ): void {
    const viewer = this.assertViewer();
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        center.longitude,
        center.latitude,
        center.height,
      ),
      orientation: this.toHeadingPitchRoll(orientation),
    });
  }

  private applyFlyToCenter(
    center: LayerCenter,
    orientation?: LayerCameraOrientation,
    duration = 2,
    overrides?: Omit<
      LayerCameraFlyToOptions,
      "destination" | "orientation" | "duration"
    >,
  ): Promise<void> {
    const viewer = this.assertViewer();
    const destination = Cesium.Cartesian3.fromDegrees(
      center.longitude,
      center.latitude,
      center.height,
    );
    const ori = this.toHeadingPitchRoll(orientation);
    return this.flyToPromise(viewer, {
      destination,
      orientation: ori,
      duration,
      ...overrides,
    });
  }

  /** 鹰眼画布拾取地表点，将主图相机移到该经纬、保留当前高度与朝向。 */
  private applyMainLookAtFromOverview(canvasPosition: Cesium.Cartesian2): void {
    const main = this.viewer;
    const ov = this.overviewViewer;
    if (!main || !ov || main.isDestroyed() || ov.isDestroyed()) return;
    if (main.scene.mode === Cesium.SceneMode.MORPHING) return;
    const ray = ov.camera.getPickRay(canvasPosition);
    if (!ray) return;
    const hit = ov.scene.globe.pick(ray, ov.scene) as
      | Cesium.Cartesian3
      | undefined;
    if (!hit) return;
    const cart = Cesium.Cartographic.fromCartesian(hit);
    const mainPos = main.camera.positionCartographic;
    main.camera.setView({
      destination: Cesium.Cartesian3.fromRadians(
        cart.longitude,
        cart.latitude,
        mainPos.height,
      ),
      orientation: {
        heading: main.camera.heading,
        pitch: main.camera.pitch,
        roll: main.camera.roll,
      },
    });
  }

  /** 鹰眼滚轮：按比例缩放主图相机高度（视角 heading/pitch/roll 不变）。 */
  private applyMainHeightFromOverviewWheel(delta: number): void {
    const main = this.viewer;
    if (!main || main.isDestroyed()) return;
    if (main.scene.mode === Cesium.SceneMode.MORPHING) return;
    const c = main.camera.positionCartographic;
    const factor = 1 + delta * 0.002;
    const newH = Math.max(50, c.height * factor);
    main.camera.setView({
      destination: Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, newH),
      orientation: {
        heading: main.camera.heading,
        pitch: main.camera.pitch,
        roll: main.camera.roll,
      },
    });
  }

  private async applyInitialCamera(
    viewer: Cesium.Viewer,
    center: LayerCenter,
    orientation: LayerCameraOrientation,
    initial?: LayerInitialCameraOptions,
  ): Promise<void> {
    const destination = Cesium.Cartesian3.fromDegrees(
      center.longitude,
      center.latitude,
      center.height,
    );
    const ori = this.toHeadingPitchRoll(orientation);
    if (initial?.useAnimation) {
      await this.flyToPromise(viewer, {
        destination,
        orientation: ori,
        duration: initial.duration ?? 2,
        ...initial.flyToOverrides,
      });
    } else {
      viewer.camera.setView({ destination, orientation: ori });
    }
  }

  private flyToPromise(
    viewer: Cesium.Viewer,
    options: LayerCameraFlyToOptions,
  ): Promise<void> {
    return new Promise((resolve) => {
      const { complete, cancel, ...rest } = options;
      viewer.camera.flyTo({
        ...rest,
        complete: () => {
          complete?.();
          resolve();
        },
        cancel: () => {
          cancel?.();
          resolve();
        },
      });
    });
  }

  private toHeadingPitchRoll(
    orientation?: LayerCameraOrientation,
  ): Cesium.HeadingPitchRoll {
    const o = orientation ?? {};
    return Cesium.HeadingPitchRoll.fromDegrees(
      o.headingDegrees ?? 0,
      o.pitchDegrees ?? -45,
      o.rollDegrees ?? 0,
    );
  }

  private tryGetUrlTemplateFromMainImagery(
    main: Cesium.Viewer,
  ): string | undefined {
    const layer = main.imageryLayers.get(0);
    const p = layer?.imageryProvider;
    if (p instanceof Cesium.UrlTemplateImageryProvider) {
      return p.url;
    }
    return undefined;
  }

  /** 屏幕中心射线与地表/椭球交点（度）；无交点时退回相机经纬度。 */
  private pickCenter(): { lon: number; lat: number } {
    const viewer = this.assertViewer();
    const canvas = viewer.scene.canvas;
    const pos = new Cesium.Cartesian2(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2,
    );
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const ray = viewer.camera.getPickRay(pos);
    if (ray) {
      const hit = viewer.scene.globe.pick(ray, viewer.scene);
      if (hit) {
        const c = Cesium.Cartographic.fromCartesian(hit, ellipsoid);
        return {
          lon: Cesium.Math.toDegrees(c.longitude),
          lat: Cesium.Math.toDegrees(c.latitude),
        };
      }
    }
    const ell = viewer.camera.pickEllipsoid(pos, ellipsoid);
    if (ell) {
      const c = Cesium.Cartographic.fromCartesian(ell, ellipsoid);
      return {
        lon: Cesium.Math.toDegrees(c.longitude),
        lat: Cesium.Math.toDegrees(c.latitude),
      };
    }
    const c = viewer.camera.positionCartographic;
    return {
      lon: Cesium.Math.toDegrees(c.longitude),
      lat: Cesium.Math.toDegrees(c.latitude),
    };
  }

  private assertViewer(): Cesium.Viewer {
    if (!this.viewer || this.viewer.isDestroyed()) {
      throw new Error("[FastX.Layer] 请先调用 initMap 完成地图初始化");
    }
    return this.viewer;
  }

  private addImageryProvider(
    provider: Cesium.ImageryProvider,
    insertIndex?: number,
  ): Cesium.ImageryLayer {
    const viewer = this.assertViewer();
    if (insertIndex === undefined) {
      return viewer.imageryLayers.addImageryProvider(provider);
    }
    return viewer.imageryLayers.addImageryProvider(provider, insertIndex);
  }

  private resolveImageryLayer(
    target: number | Cesium.ImageryLayer,
  ): Cesium.ImageryLayer {
    const viewer = this.assertViewer();
    if (typeof target === "number") {
      const layer = viewer.imageryLayers.get(target);
      if (!layer)
        throw new Error(`[FastX.Layer] 未找到索引为 ${target} 的影像层`);
      return layer;
    }
    return target;
  }
}
