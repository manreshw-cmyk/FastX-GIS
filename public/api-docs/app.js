(function () {
  const methodMap = {
    Layer: [
      "initMap",
      "setTerrainWithCesiumTerrainProvider",
      "addImageryFromWmts",
      "addImageryFromWms",
      "addImageryFromTms",
      "addImageryFromUrlTemplate",
      "addLonLatGrid",
      "removeLonLatGrid",
      "loadGeoJsonDataSource",
      "loadKmlDataSource",
      "loadCzmlDataSource",
      "removeImageryLayer",
      "removeImageryLayerByIndex",
      "raiseImageryLayerToTop",
      "lowerImageryLayerToBottom",
      "setGlobeBaseColor",
      "addGlobeBackgroundImageLayer",
      "setImageryLayerVisualParams",
      "setImageryLayerTextureFilters",
      "setImageryLayerShow",
      "setGlobeShow",
      "cameraSetView",
      "cameraFlyTo",
      "zoomInOut",
      "setSceneMode",
      "getSceneMode",
      "clearAllMapEntities",
      "resetSharedMapDemoUiState",
      "setOverviewMapVisible",
      "isOverviewMapVisible",
      "setSkyAtmosphereVisible",
      "setCustomGlobalSkyBox",
      "resetGlobalSkyBox",
      "setGlobeLightingEnabled",
      "resetCameraToHome",
      "entityExistsById",
      "getViewportHeightKm",
      "setMapCenter",
      "getCameraCenterLngLatHeight",
      "setScaleBarVisible",
      "setTileLevelOverlayVisible",
      "isScaleBarVisible",
      "setNavigationControlVisible",
      "isNavigationControlVisible",
      "getBaseImageryPreset",
      "getInitImageryUrlTemplate",
      "isTerrainQuantizedEnabled",
      "setBaseImageryPreset",
      "setTerrainQuantizedEnabled",
      "isTileLevelOverlayVisible",
      "setCompassOverlayVisible",
      "setCanvasCursorStyle",
      "applyPerformanceOptions",
      "getMapName",
      "getLayerByMapName",
      "getRegisteredMapNames",
      "getViewer",
      "destroy",
    ],
    Coordinates: [
      "worldToScreen",
      "screenToWorld",
      "worldToLngLat",
      "lngLatToWorld",
      "screenToLngLat",
      "lngLatToScreen",
      "lngLatToDms",
      "dmsToLngLat",
    ],
    MouseEvent: ["listen", "destroy"],
    Point: [
      "add",
      "addBatch",
      "addPoints",
      "updatePoint",
      "updatePoints",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getPoint",
      "getAllPoints",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "updateStyle",
      "setPosition",
      "setVisible",
      "show",
      "hide",
      "setDescription",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    PointCollection: [
      "addPoints",
      "updatePoint",
      "updatePoints",
      "getPoint",
      "getCount",
      "getAllIds",
      "getAllPoints",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "pruneInvalid",
      "destroy",
    ],
    Label: [
      "add",
      "addBatch",
      "addLabels",
      "updateLabel",
      "updateLabels",
      "getTargetData",
      "getLabel",
      "getAllLabels",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    LabelCollection: [
      "addLabels",
      "updateLabel",
      "updateLabels",
      "getLabel",
      "getCount",
      "getAllIds",
      "getAllLabels",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "pruneInvalid",
      "destroy",
    ],
    PolyLine: [
      "add",
      "addBatch",
      "addPolylines",
      "updatePolyline",
      "updatePolylines",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getPolyline",
      "getAllPolylines",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "updateStyle",
      "setVisible",
      "show",
      "hide",
      "setDescription",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    PolyLineCollection: [
      "addPolylines",
      "updatePolylineMaterial",
      "updatePolyline",
      "updatePolylines",
      "getPolyline",
      "getCount",
      "getAllIds",
      "getAllPolylines",
      "setAllVisibility",
      "setSpecifyVisibility",
      "addPointToPolyline",
      "remove",
      "removeMultiple",
      "removeAll",
      "clear",
      "destroy",
      "pruneInvalid",
      "updateTargetData",
      "getBoundingBox",
    ],
    Polygon: [
      "add",
      "addPolygons",
      "updatePolygon",
      "updatePolygons",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getPolygon",
      "getAllPolygons",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    PolygonCollection: [
      "addPolygons",
      "removePolygon",
      "remove",
      "removeAll",
      "clear",
      "destroy",
      "setVisibility",
      "setAllVisibility",
      "updateColor",
      "getIdPolygon",
      "getPolygonAll",
      "getPolygon",
      "getAllPolygons",
      "getCount",
      "getAllIds",
      "setSpecifyVisibility",
      "pruneInvalid",
    ],
    Circle: [
      "add",
      "setCircleDraftFromVertices",
      "addCircles",
      "updateCircle",
      "updateCircles",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getCircle",
      "getAllCircles",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    CircleCollection: [
      "addCircles",
      "updateCircle",
      "updateCircles",
      "getCircle",
      "getCount",
      "getAllIds",
      "getAllCircles",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeMany",
      "removeAll",
      "clear",
      "destroy",
      "pruneInvalid",
    ],
    Rectangle: [
      "add",
      "addRectangles",
      "updateRectangle",
      "updateRectangles",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getRectangle",
      "getAllRectangles",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    RectangleCollection: [
      "addRectangles",
      "removeRectangle",
      "remove",
      "removeAll",
      "clear",
      "destroy",
      "setVisibility",
      "setAllVisibility",
      "updateColor",
      "getIdRectangle",
      "getRectangleAll",
      "getRectangle",
      "getAllRectangles",
      "getCount",
      "getAllIds",
      "setSpecifyVisibility",
      "pruneInvalid",
    ],
    Sector: [
      "add",
      "addSectors",
      "updateSector",
      "updateSectors",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getSector",
      "getAllSectors",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    SectorCollection: [
      "addSectors",
      "removeSector",
      "remove",
      "removeAll",
      "clear",
      "destroy",
      "setVisibility",
      "setAllVisibility",
      "updateColor",
      "getIdSector",
      "getSectorAll",
      "getSector",
      "getAllSectors",
      "getCount",
      "getAllIds",
      "setSpecifyVisibility",
      "pruneInvalid",
    ],
    Cylinder: [
      "add",
      "addCylinders",
      "updateCylinder",
      "updateCylinders",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getCylinder",
      "getAllCylinders",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    CylinderCollection: [
      "addCylinders",
      "removeCylinder",
      "remove",
      "removeAll",
      "clear",
      "destroy",
      "setVisibility",
      "setAllVisibility",
      "updateColor",
      "getIdCylinder",
      "getCylinderAll",
      "getCylinder",
      "getAllCylinders",
      "getCount",
      "getAllIds",
      "setSpecifyVisibility",
      "pruneInvalid",
    ],
    Corridor: [
      "add",
      "addCorridors",
      "updateCorridor",
      "updateCorridors",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getCorridor",
      "getAllCorridors",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    CorridorCollection: [
      "addCorridors",
      "remove",
      "removeCorridor",
      "removeAll",
      "clear",
      "destroy",
      "setVisibility",
      "setAllVisibility",
      "setSpecifyVisibility",
      "updateColor",
      "updateCorridor",
      "updateCorridors",
      "getCorridor",
      "getAllCorridors",
      "getCorridorEntry",
      "getCount",
      "getAllIds",
      "pruneInvalid",
    ],
    Runway: [
      "add",
      "addRunways",
      "updateRunway",
      "updateRunways",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getRunway",
      "getAllRunways",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    RunwayCollection: [
      "addRunways",
      "remove",
      "removeRunway",
      "removeAll",
      "clear",
      "destroy",
      "setVisibility",
      "setAllVisibility",
      "setSpecifyVisibility",
      "updateRunway",
      "updateRunways",
      "getRunway",
      "getAllRunways",
      "getRunwayEntry",
      "getCount",
      "getAllIds",
      "pruneInvalid",
    ],
    Ellipsoid: [
      "add",
      "addBatch",
      "addEllipsoids",
      "updateEllipsoid",
      "updateEllipsoids",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getEllipsoid",
      "getAllEllipsoids",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "updateStyle",
      "setPosition",
      "setRadii",
      "setVisible",
      "show",
      "hide",
      "setDescription",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    EllipsoidCollection: [
      "addEllipsoids",
      "updateEllipsoid",
      "updateEllipsoids",
      "getEllipsoid",
      "getCount",
      "getAllIds",
      "getAllEllipsoids",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Wall: [
      "add",
      "addBatch",
      "addWalls",
      "updateWall",
      "updateWalls",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getWall",
      "getAllWalls",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "updateStyle",
      "setPositions",
      "setVisible",
      "show",
      "hide",
      "setDescription",
      "setImage",
      "setGradient",
      "setMultiColorGradient",
      "setHeight",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Billboard: [
      "add",
      "addBatch",
      "addBillboards",
      "updateBillboard",
      "updateBillboards",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getBillboard",
      "getAllBillboards",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    BillboardCollection: [
      "addBillboards",
      "updateBillboard",
      "updateBillboards",
      "getBillboard",
      "getCount",
      "getAllIds",
      "getAllBillboards",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Model: [
      "add",
      "addBatch",
      "addModels",
      "updateModel",
      "updateModels",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getModel",
      "getAllModels",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    ModelCollection: [
      "addModels",
      "updateModel",
      "updateModels",
      "getModel",
      "getCount",
      "getAllIds",
      "getAllModels",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Box: [
      "add",
      "addBatch",
      "addBoxes",
      "updateBox",
      "updateBoxes",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "getBox",
      "getAllBoxes",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "removeAll",
      "getEntity",
      "has",
      "getIds",
      "setVisible",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    BoxCollection: [
      "addBoxes",
      "updateBox",
      "updateBoxes",
      "getBox",
      "getCount",
      "getAllIds",
      "getAllBoxes",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Plane: [
      "add",
      "updatePlane",
      "getPlaneVideoElement",
      "playPlaneVideo",
      "pausePlaneVideo",
      "restartPlaneVideo",
      "applyPlaneVideoOptions",
      "updatePlanes",
      "getPlane",
      "getAllPlanes",
      "getCount",
      "getIds",
      "getAllIds",
      "getEntity",
      "has",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
    ],
    PlaneCollection: [
      "addPlanes",
      "updatePlane",
      "updatePlanes",
      "getPlaneVideoElement",
      "playPlaneVideo",
      "pausePlaneVideo",
      "restartPlaneVideo",
      "applyPlaneVideoOptions",
      "getPlane",
      "getAllPlanes",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Path: [
      "add",
      "updatePath",
      "getPath",
      "getAllPaths",
      "getTargetData",
      "getEntity",
      "has",
      "getIds",
      "getAllIds",
      "getCount",
      "setVisible",
      "show",
      "hide",
      "setAllVisibility",
      "remove",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    PolylineVolume: [
      "add",
      "updatePolylineVolume",
      "updatePolylineVolumes",
      "getPolylineVolume",
      "getAllPolylineVolumes",
      "getCount",
      "getIds",
      "getAllIds",
      "getEntity",
      "has",
      "getTargetData",
      "setTargetData",
      "mergeTargetData",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeBatch",
      "clear",
      "pruneInvalid",
    ],
    PolylineVolumeCollection: [
      "addPolylineVolumes",
      "updatePolylineVolume",
      "updatePolylineVolumes",
      "getPolylineVolume",
      "getAllPolylineVolumes",
      "getCount",
      "getAllIds",
      "setAllVisibility",
      "setSpecifyVisibility",
      "remove",
      "removeAll",
      "clear",
      "pruneInvalid",
      "destroy",
    ],
    Heatmap: ["create", "update", "remove", "clear", "getSnapshot", "getAll", "pruneInvalid"],
    PointAggregation: ["load", "loadGeoJson", "update", "remove", "clear", "getSnapshot", "getAll", "pruneInvalid"],
    Quantitative: [
      "bindViewer",
      "getViewer",
      "setMeasureType",
      "getMeasureType",
      "setPendingStyle",
      "createMeasure",
      "pushCurrent",
      "push",
      "removeMeasure",
      "removeByType",
      "removeAll",
      "syncContourGlobeShader",
      "getMeasures",
      "startInteractive",
      "stopInteractive",
      "notifyDrawFinish",
    ],
    AreaManager: ["getDrawApis", "publish", "unpublish", "start", "draw", "end", "cancel", "clearEvents"],
    Trajectory: [
      "getPositionProperty",
      "getPositionAtTime",
      "getStartTime",
      "getEndTime",
      "getDuration",
      "getKeyframes",
      "getAvailability",
      "fromLngLatKeyframes",
      "fromDegrees",
      "fromCartesian",
    ],
    Mover: [
      "fromViewer",
      "setTrajectory",
      "getTrajectory",
      "setCallbacks",
      "setSpeed",
      "setLoop",
      "setPlayCount",
      "start",
      "stop",
      "pause",
      "resume",
      "seekToTime",
      "seekToProgress",
      "getProgress",
      "getState",
      "dispose",
    ],
  };

  const groupLabels = {
    guide: "入门",
    mount: "挂载",
    layer: "图层",
    coordinates: "坐标",
    event: "事件",
    draw: "标绘",
    measure: "测量",
    effects: "特效",
    weather: "气象",
    plugin: "插件",
    tools: "工具",
  };

  const packageNamedExports = new Set([
    "createRandomXgxId",
    "MeasureType",
    "MEASURE_POINT_RANGE",
    "PlaneMaterialType",
    "PolylineMaterialType",
    "DEFAULT_HEATMAP_STYLE",
    "DEFAULT_HEATMAP_GRADIENT",
    "DEFAULT_POINT_AGGREGATION_STYLE",
    "VENDOR_MANIFEST",
    "defaultShapeParamsForType",
    "parseShapeTypeKey",
    "resolvePolylineCartesians",
    "computeModelCollectionModelMatrix",
    "normalizePlaneVideoOptions",
    "ensureVendorPlugins",
    "ensureTurf",
    "ensureHeatmapJs",
    "ensureCesiumNavigation",
    "getTurf",
    "getH337",
    "getCesiumNavigation",
  ]);

  const commonViewerParameterRows = [
    param("viewer", "Cesium.Viewer", "必填", "Cesium Viewer 实例，通常通过 window.FastX.getViewer(mapName) 获取。"),
  ];

  const commonDrawParameterRows = [
    ...commonViewerParameterRows,
    param("options", "Add*Options", "必填", "单体标绘创建参数，字段以对应 Add 类型为准。"),
    param("id", "string", "自动生成", "标绘对象唯一 ID；不传时由 SDK 自动生成。"),
    param("style", "*StyleOptions", "undefined", "标绘对象样式配置。"),
    param("show", "boolean", "true", "是否显示标绘对象。"),
    param("description", "string", "undefined", "Cesium Entity 的描述内容。"),
    param("targetData", "Record<string, unknown>", "{}", "绑定到对象上的业务数据。"),
  ];

  const commonCollectionParameterRows = [
    ...commonViewerParameterRows,
    param("items", "Array<*CollectionAddItem>", "必填", "批量创建数据列表。"),
    param("id", "string", "必填", "需要更新、查询或移除的对象 ID。"),
    param("ids", "string[]", "[]", "批量显隐或批量移除时使用的对象 ID 列表。"),
    param("updates", "Array<UpdateEntry>", "[]", "批量更新数据列表。"),
    param("show", "boolean", "true", "是否显示指定对象或全部对象。"),
  ];

  const parameterMap = {
    installFastXToWindow: [
      param("options", "FastXInstallOptions", "undefined", "可选安装配置，用于覆盖 Cesium 静态资源路径等 SDK 启动参数。"),
    ],
    FastX: [
      param("mapName", "string", "undefined", "多地图场景下的地图实例名称；不传时按当前注册实例推断。"),
    ],
    getLayer: [
      param("mapName", "string", "undefined", "地图实例名称；不传且仅有一个实例时返回该实例。"),
    ],
    getViewer: [
      param("mapName", "string", "undefined", "地图实例名称；返回对应 Layer 内部的 Cesium Viewer。"),
    ],
    getMapName: [
      param("mapName", "string", "undefined", "地图实例名称；用于读取当前 Layer 绑定的 mapName。"),
    ],
    getRegisteredMapNames: [],
    registerCesiumXVueComponents: [
      param("app", "App", "必填", "Vue 应用实例。"),
    ],
    Cesium: [],
    Layer: [
      param("container", "string | HTMLElement", "必填", "Cesium Viewer 挂载容器。"),
      param("config", "LayerInitConfig", "{}", "地图初始化配置，包含 mapName、中心点、影像、地形、UI 和性能配置。"),
      param("mapName", "string", "'default'", "地图实例名称，用于全局获取 Layer 和 Viewer。"),
      param("url", "string", "必填", "影像、地形、GeoJSON、KML、CZML、模型或天空盒资源地址。"),
      param("options", "object", "{}", "图层、数据源、相机、天空盒、鼠标样式等方法的配置参数。"),
    ],
    XMapConfig: [
      param("mapName", "string", "'default'", "地图实例名称。"),
      param("containerId", "string", "自动生成", "XMap 内部地图容器 ID。"),
      param("center", "LngLatHeight", "内置默认值", "初始化地图中心点。"),
      param("camera", "LayerCameraOptions", "undefined", "初始化相机视角。"),
      param("imagery", "LayerImageryInitConfig", "内置默认值", "初始化影像配置。"),
      param("terrain", "LayerTerrainInitConfig", "undefined", "初始化地形配置。"),
      param("ui", "LayerUiInitConfig", "{}", "比例尺、鹰眼图、罗盘等 UI 控件配置。"),
      param("performance", "LayerPerformanceInitConfig", "{}", "地图性能参数。"),
    ],
    Coordinates: [
      param("viewer", "Cesium.Viewer", "按方法必填", "屏幕坐标转换到世界坐标时需要传入 Viewer。"),
      param("position", "Cartesian3 | LngLatHeight | ScreenPoint", "必填", "待转换的坐标。"),
      param("longitude", "number", "必填", "经度，单位为度。"),
      param("latitude", "number", "必填", "纬度，单位为度。"),
      param("height", "number", "0", "高度，单位为米。"),
    ],
    createRandomXgxId: [
      param("prefix", "string", "'xgx'", "生成 ID 时使用的业务前缀。"),
    ],
    MouseEvent: [
      param("viewer", "Cesium.Viewer", "必填", "绑定鼠标事件的 Viewer。"),
      param("options", "MouseEventListenOptions", "必填", "点击、移动、滚轮、双击等回调配置。"),
      param("destroy", "boolean", "false", "销毁实例时是否同步清理内部事件处理器。"),
    ],
    Point: [
      ...commonViewerParameterRows,
      param("options", "AddPointOptions", "必填", "新增点的完整参数对象。"),
      param("id", "string", "自动生成", "点对象唯一 ID；更新、查询、显隐、删除时用于定位对象。"),
      param("properties", "UpdatePointProperties", "必填", "updatePoint 使用的点更新属性对象。"),
      param("items", "AddPointOptions[]", "[]", "addBatch、addPoints 使用的批量点数据。"),
      param("updates", "Array<{ id: string } & UpdatePointProperties>", "[]", "updatePoints 使用的批量更新数据。"),
      param("position", "PointPositionInput", "undefined", "点坐标，支持 Cesium.Cartesian3 或经纬高对象；与 positions 二选一。"),
      param("positions", "[number, number, number?]", "undefined", "点坐标数组，格式为 [longitude, latitude, height?]；与 position 二选一。"),
      param("longitude", "number", "undefined", "更新点时可单独传入经度；优先级低于 position。"),
      param("latitude", "number", "undefined", "更新点时可单独传入纬度；优先级低于 position。"),
      param("height", "number", "0", "点高度，单位为米。"),
      param("style", "PointStyleOptions", "undefined", "点的 Cesium PointGraphics 样式对象。"),
      param("color", "string | Cesium.Color", "#ffff00", "点填充颜色；新增时 string 会被转换为 Cesium.Color。"),
      param("alpha", "number", "1", "点填充透明度，范围 0 到 1。"),
      param("pixelSize", "number", "10", "点像素大小。"),
      param("outline", "boolean", "true", "是否绘制轮廓；false 时等同 outlineWidth 为 0。"),
      param("outlineColor", "string | Cesium.Color", "#000000", "点轮廓颜色。"),
      param("outlineAlpha", "number", "1", "点轮廓透明度，范围 0 到 1。"),
      param("outlineWidth", "number", "2", "点轮廓宽度。"),
      param("show", "boolean", "true", "是否显示点对象。"),
      param("description", "string", "undefined", "Cesium Entity 描述内容。"),
      param("targetData", "Record<string, unknown>", "{}", "绑定到点对象的业务数据。"),
      param("areaDraft", "boolean", "false", "是否按区域绘制草稿点处理。"),
      param("style.heightReference", "Cesium.HeightReference", "undefined", "点高度参考方式。"),
      param("style.disableDepthTestDistance", "number", "undefined", "禁用深度检测的距离阈值。"),
      param("style.scaleByDistance", "Cesium.NearFarScalar", "undefined", "按视距缩放点大小。"),
      param("style.translucencyByDistance", "Cesium.NearFarScalar", "undefined", "按视距控制透明度。"),
      param("style.distanceDisplayCondition", "Cesium.DistanceDisplayCondition", "undefined", "按距离控制显示范围。"),
    ],
    PointCollection: [
      ...commonCollectionParameterRows,
      param("points", "PointCollectionAddItem[]", "必填", "批量点数据列表。"),
      param("properties", "PointCollectionUpdateProps", "必填", "批量点更新属性。"),
    ],
  };

  const guideDocs = [
    guide(
      "intro",
      "SDK 简介",
      "fastx-sdk 是面向业务开发者的三维 GIS 开发包，目标是把 Cesium 的底层能力封装成更快上手、更稳定复用、更适合项目交付的 API。",
      [
        "快速性：封装地图初始化、影像/地形/数据源加载、标绘、测量、热力图、点聚合和插件加载，开发者不用从 Cesium 原生对象开始拼装业务能力。",
        "对比性：Cesium 更偏底层渲染引擎，超图等平台通常包含更完整的商业 GIS 体系；fastx-sdk 处在项目工程层，重点解决前端三维地图页面的快速集成和常用能力复用。",
        "性能性：SDK 内部统一管理 Viewer、Entity、Primitive、插件和资源路径，减少重复初始化与散落代码带来的性能和维护问题。",
        "边界说明：本手册只展示 fastx-sdk 对外暴露的 FastX API、包导出项、类型和常量；内部私有函数不作为使用者依赖。",
      ],
      [
        step("适合谁使用", [
          "第一次接触 Cesium，但需要快速在项目里落三维地图功能的前端开发者。",
          "已经会 Cesium，但希望把项目中的地图初始化、标绘、图层和测量逻辑统一成稳定 API 的开发者。",
          "需要离线包、统一资源路径、统一插件加载和统一示例入口的项目团队。",
        ]),
        step("你最终会得到什么", [
          "一个可初始化的 Cesium 三维地球。",
          "一个可以通过 window.FastX.getViewer(mapName) 获取的 Viewer。",
          "一套可以直接调用的图层、坐标、事件、标绘、测量、插件和工具 API。",
        ]),
      ],
    ),
    guide(
      "install",
      "安装 npm 包",
      "从 npm 包开始接入 fastx-sdk，先完成依赖安装、样式引入和全局对象挂载。",
      [
        "安装 fastx-sdk 后，不需要额外安装 cesium；包内已带 Cesium 运行时和 SDK 使用到的静态资源。",
        "业务项目必须引入 fastx-sdk/default/index.css，否则 Cesium Widgets 和 SDK 内置样式可能显示异常。",
        "应用启动时调用 installFastXToWindow，它会配置 Cesium 资源路径并挂载 window.FastX。",
      ],
      [
        step("1. 安装依赖", ["在项目根目录执行安装命令。"], "npm install fastx-sdk"),
        step(
          "2. 在入口文件引入 SDK",
          ["建议在 main.ts 或 main.js 中完成一次性安装。"],
          "import { installFastXToWindow, FastX, Cesium } from 'fastx-sdk'\nimport 'fastx-sdk/default/index.css'\n\ninstallFastXToWindow()\nconsole.log(window.FastX, FastX, Cesium)",
        ),
        step(
          "3. 私有部署或非根路径部署",
          ["如果项目把 Cesium 静态资源部署到自定义路径，需要显式传入 cesiumBaseUrl。"],
          "installFastXToWindow({\n  cesiumBaseUrl: '/Cesium/'\n})",
        ),
      ],
    ),
    guide(
      "quick-start",
      "初始化地图",
      "完成包安装后，下一步是创建地图实例、注册 mapName，并验证 Viewer 可以被业务代码获取。",
      [
        "Layer 是地图初始化和图层管理入口；初始化成功后，SDK 会按 mapName 注册当前地图。",
        "业务页面建议通过 mapName 获取 Viewer，避免多地图页面中拿错实例。",
        "如果使用项目内置 Vue 组件，也可以通过 registerCesiumXVueComponents 注册 XMap 后初始化。",
      ],
      [
        step(
          "1. 创建地图容器",
          ["容器必须有明确高度，否则 Cesium Canvas 会显示为空。"],
          "<div id=\"map\" style=\"width: 100%; height: 100vh\"></div>",
        ),
        step(
          "2. 初始化 Layer",
          ["mapName 是后续 getLayer、getViewer 的关键索引。"],
          "import { Layer } from 'fastx-sdk'\n\nconst layer = new Layer()\nawait layer.initMap('map', {\n  mapName: 'mapDemo'\n})",
        ),
        step(
          "3. 获取 Viewer 并调用业务 API",
          ["地图初始化完成后，再获取 Viewer 并调用标绘、测量等 API。"],
          "const viewer = window.FastX.getViewer('mapDemo')\n\nwindow.FastX.Point.add(viewer, {\n  positions: [116.391, 39.907, 120],\n  color: '#ffcc00',\n  pixelSize: 12\n})",
        ),
      ],
    ),
    guide(
      "global-fastx",
      "window.FastX 使用方式",
      "window.FastX 是 SDK 给业务页面准备的统一入口，适合在示例页和业务页中直接调用。",
      [
        "Draw 类在 window.FastX 上以单例实例提供，例如 window.FastX.Point、window.FastX.Model。",
        "Layer、Coordinates、MouseEvent 等类也会挂载在 window.FastX 上，按模块职责调用即可。",
        "多地图场景必须显式传入 mapName，避免页面内存在多个 Viewer 时取错实例。",
      ],
      [
        step(
          "常用访问方式",
          ["获取 Layer、Viewer、mapName 和已注册地图列表。"],
          "const layer = window.FastX.getLayer('mapDemo')\nconst viewer = window.FastX.getViewer('mapDemo')\nconst name = window.FastX.getMapName('mapDemo')\nconst names = window.FastX.getRegisteredMapNames()",
        ),
      ],
    ),
    guide(
      "resource-path",
      "资源路径说明",
      "fastx-sdk 同时包含运行时代码和静态资源，资源路径正确是地图能否正常显示的前提。",
      [
        "Cesium 静态资源由 installFastXToWindow 配置 CESIUM_BASE_URL。",
        "鼠标样式、heatmap、turf、cesium-navigation 等资源随 fastx-sdk 包发布。",
        "CZML、KML、GeoJSON 建议放在项目 public/json 下，模型建议放在 public/models 下。",
      ],
      [
        step("资源检查顺序", [
          "先看浏览器 Network 是否有 Cesium、json、models 相关 404。",
          "再检查项目 base 路径、部署目录和 installFastXToWindow 的 cesiumBaseUrl 是否一致。",
          "最后确认业务数据 URL 使用的是构建后可访问的 public 路径。",
        ]),
      ],
    ),
    guide(
      "deploy",
      "构建与部署",
      "API 手册作为静态资源跟随主应用构建产物发布，不参与主应用路由。",
      [
        "API 手册位于 public/api-docs，npm run build 后会进入 FastXDist/api-docs。",
        "顶部文档按钮以新窗口打开 api-docs/index.html，不参与主应用路由和登录守卫。",
        "部署到子路径时，按钮会基于 Vite BASE_URL 拼接 api-docs/index.html。",
      ],
      [
        step("构建验证", ["构建完成后确认 FastXDist/api-docs 中存在 index.html、app.js、styles/styles.css 和 images/logo.png。"], "npm run build"),
      ],
    ),
    guide(
      "faq",
      "常见问题",
      "这里列出第一次接入 fastx-sdk 时最容易遇到的问题和处理方式。",
      [
        "如果 Cesium 静态资源 404，优先检查 base 路径、CESIUM_BASE_URL 和部署目录。",
        "如果 Viewer 获取为空，确认地图已经初始化完成，并检查 mapName 是否一致。",
        "如果地图容器白屏，先确认容器高度、控制台错误、Cesium 资源路径和 WebGL 支持。",
        "如果标绘对象不显示，确认传入坐标格式、Viewer 实例、高度参数和 show 状态是否正确。",
        "如果 npm run build 后访问文档 404，确认 public/api-docs 已进入 FastXDist/api-docs。",
      ],
      [
        step("排查模板", [
          "控制台是否有模块、资源或运行时错误。",
          "Network 是否有 404、跨域、资源路径错误。",
          "window.FastX 是否存在，window.FastX.getRegisteredMapNames() 是否有当前 mapName。",
          "Viewer 是否存在，viewer.isDestroyed() 是否为 false。",
        ]),
      ],
    ),
  ];

  const apiGroups = [
    group("mount", [
      api("installFastXToWindow", "mount", "installFastXToWindow", "挂载 FastX 到 window", "配置包内 Cesium 资源路径，并把 FastX 全局对象挂载到 window。", ["installFastXToWindow"], ["FastXInstallOptions"], "import { installFastXToWindow } from 'fastx-sdk'\ninstallFastXToWindow({ cesiumBaseUrl: '/Cesium/' })"),
      api("FastX", "mount", "FastX", "全局对象", "FastX SDK 的统一入口，包含 Layer、Coordinates、MouseEvent、Draw 单例、测量和插件能力。", ["getLayer", "getViewer", "getMapName", "getRegisteredMapNames"], ["FastXGlobal"], "const viewer = window.FastX.getViewer('mapDemo')"),
      api("getLayer", "mount", "getLayer", "获取图层实例", "按 mapName 获取已经注册的 Layer 实例，未传 mapName 且只有一个实例时返回该实例。", ["getLayer"], ["Layer"], "const layer = window.FastX.getLayer('mapDemo')"),
      api("getViewer", "mount", "getViewer", "获取 Cesium Viewer", "按 mapName 获取 Cesium Viewer，适合业务页面调用标绘或 Cesium 原生 API。", ["getViewer"], ["Viewer"], "const viewer = window.FastX.getViewer('mapDemo')"),
      api("getMapName", "mount", "getMapName", "获取地图名称", "获取当前 Layer 对应的 mapName。", ["getMapName"], [], "const mapName = window.FastX.getMapName('mapDemo')"),
      api("getRegisteredMapNames", "mount", "getRegisteredMapNames", "获取已注册地图名称", "返回当前运行时所有已注册且有效的地图名称。", ["getRegisteredMapNames"], [], "const names = window.FastX.getRegisteredMapNames()"),
      api("registerCesiumXVueComponents", "mount", "registerCesiumXVueComponents", "注册 Vue 组件", "向 Vue App 注册 FastX 内置地图组件，例如 XMap。", ["registerCesiumXVueComponents"], ["XMapConfig"], "FastX.registerCesiumXVueComponents(app)"),
      api("Cesium", "mount", "Cesium", "内置 Cesium 导出", "从 fastx-sdk 包内导出 Cesium，方便离线环境统一使用同一份 Cesium 运行时。", [], ["Cesium"], "import { Cesium } from 'fastx-sdk'\nconst color = Cesium.Color.CYAN"),
    ]),
    group("layer", [
      api("Layer", "layer", "Layer", "地图与图层", "负责 Cesium Viewer 初始化、影像图层、地形、数据源、相机、天空盒和地图 UI 控制。", methodMap.Layer, ["LayerInitConfig", "LayerUiInitConfig", "LayerPerformanceInitConfig", "LonLatGridOptions", "GeoJsonLoadOptions", "KmlLoadOptions", "CzmlLoadOptions"], "const layer = new FastX.Layer()\nawait layer.initMap('map', { mapName: 'mapDemo' })"),
      api("XMapConfig", "layer", "XMapConfig", "地图组件配置", "Vue XMap 组件使用的配置类型，封装地图中心、相机、影像、地形、UI 和性能参数。", [], ["XMapConfig"], "<XMap :x-config=\"xMapConfig\" @ready=\"onMapReady\" />"),
    ]),
    group("coordinates", [
      api("Coordinates", "coordinates", "Coordinates", "坐标转换", "封装屏幕坐标、世界坐标、经纬度和度分秒之间的转换。", methodMap.Coordinates, ["LngLatHeight", "ScreenPoint", "DrawingBufferPoint", "LngLatDms", "DmsAxis"], "const lngLat = FastX.Coordinates.worldToLngLat(cartesian)"),
      api("createRandomXgxId", "coordinates", "createRandomXgxId", "随机 ID", "生成带业务前缀的随机 ID，常用于标绘对象 id。", ["createRandomXgxId"], [], "const id = FastX.createRandomXgxId('point')"),
    ]),
    group("event", [
      api("MouseEvent", "event", "MouseEvent", "鼠标事件", "封装 Cesium ScreenSpaceEventHandler，提供点击、移动、滚轮、右键双击和拾取实体能力。", methodMap.MouseEvent, ["MouseEventListenOptions", "MouseEventPickPayload", "MouseEventPickedEntity"], "const mouse = new FastX.MouseEvent(viewer)\nmouse.listen({ onLeftClick: (pick) => console.log(pick) })"),
    ]),
    group("draw", [
      drawApi("Point", "点", ["AddPointOptions", "PointStyleOptions", "PointSnapshot", "UpdatePointProperties"]),
      drawApi("PointCollection", "批量点", ["PointCollectionAddItem", "PointCollectionSnapshot", "PointCollectionUpdateEntry", "PointCollectionUpdateProps"]),
      drawApi("Label", "标签", ["AddLabelOptions", "LabelStyleOptions", "LabelSnapshot", "UpdateLabelProperties"]),
      drawApi("LabelCollection", "批量标签", ["LabelCollectionAddItem", "LabelCollectionSnapshot", "LabelCollectionUpdateEntry", "LabelCollectionUpdateProps"]),
      drawApi("Billboard", "图标", ["AddBillboardOptions", "BillboardStyleOptions", "BillboardSnapshot", "UpdateBillboardProperties"]),
      drawApi("BillboardCollection", "批量图标", ["BillboardCollectionAddItem", "BillboardCollectionSnapshot", "BillboardCollectionUpdateEntry", "BillboardCollectionUpdateProps"]),
      drawApi("PolyLine", "线", ["AddPolylineOptions", "PolylineStyleOptions", "PolylineSnapshot", "UpdatePolylineProperties"]),
      drawApi("PolyLineCollection", "批量线", ["PolyLineCollectionAddItem", "PolyLineCollectionSnapshot", "PolyLineCollectionUpdateEntry", "PolyLineCollectionUpdateProps"]),
      drawApi("Polygon", "面", ["AddPolygonOptions", "PolygonStyleOptions", "PolygonSnapshot", "UpdatePolygonProperties"]),
      drawApi("PolygonCollection", "批量面", ["PolygonCollectionAddItem", "PolygonCollectionEntry", "PolygonCollectionSnapshot", "PolygonCollectionStoredData"]),
      drawApi("Circle", "圆", ["AddCircleOptions", "CircleStyleOptions", "CircleSnapshot", "UpdateCircleProperties"]),
      drawApi("CircleCollection", "批量圆", ["CircleCollectionAddItem", "CircleCollectionSnapshot", "CircleCollectionUpdateEntry", "CircleCollectionUpdateOptions"]),
      drawApi("Rectangle", "矩形", ["AddRectangleOptions", "RectangleStyleOptions", "RectangleSnapshot", "UpdateRectangleProperties"]),
      drawApi("RectangleCollection", "批量矩形", ["RectangleCollectionAddItem", "RectangleCollectionEntry", "RectangleCollectionSnapshot", "RectangleCollectionStoredData"]),
      drawApi("Sector", "扇形", ["AddSectorOptions", "SectorStyleOptions", "SectorSnapshot", "UpdateSectorProperties"]),
      drawApi("SectorCollection", "批量扇形", ["SectorCollectionAddItem", "SectorCollectionEntry", "SectorCollectionSnapshot", "SectorCollectionStoredData"]),
      drawApi("Cylinder", "圆柱", ["AddCylinderOptions", "CylinderStyleOptions", "CylinderSnapshot", "UpdateCylinderProperties"]),
      drawApi("CylinderCollection", "批量圆柱", ["CylinderCollectionAddItem", "CylinderCollectionEntry", "CylinderCollectionSnapshot", "CylinderCollectionStoredData"]),
      drawApi("Corridor", "走廊", ["AddCorridorOptions", "CorridorStyleOptions", "CorridorSnapshot", "UpdateCorridorProperties"]),
      drawApi("CorridorCollection", "批量走廊", ["CorridorCollectionAddItem", "CorridorCollectionEntry", "CorridorCollectionSnapshot", "CorridorCollectionUpdateProps"]),
      drawApi("Runway", "跑道", ["AddRunwayOptions", "RunwayStyleOptions", "RunwaySnapshot", "UpdateRunwayProperties"]),
      drawApi("RunwayCollection", "批量跑道", ["RunwayCollectionAddItem", "RunwayCollectionEntry", "RunwayCollectionSnapshot", "RunwayCollectionUpdateProps"]),
      drawApi("Ellipsoid", "椭球", ["AddEllipsoidOptions", "EllipsoidStyleOptions", "EllipsoidSnapshot", "UpdateEllipsoidProperties"]),
      drawApi("EllipsoidCollection", "批量椭球", ["EllipsoidCollectionAddItem", "EllipsoidCollectionSnapshot", "EllipsoidCollectionUpdateEntry", "EllipsoidCollectionUpdateProps"]),
      drawApi("Wall", "墙体", ["AddWallOptions", "WallStyleOptions", "WallSnapshot", "UpdateWallProperties"]),
      drawApi("Model", "模型", ["AddModelOptions", "ModelStyleOptions", "ModelSnapshot", "UpdateModelProperties"]),
      drawApi("ModelCollection", "批量模型", ["ModelCollectionAddItem", "ModelCollectionSnapshot", "ModelCollectionUpdateEntry", "ModelCollectionUpdateProps"]),
      drawApi("Box", "盒子", ["AddBoxOptions", "BoxStyleOptions", "BoxSnapshot", "UpdateBoxProperties"]),
      drawApi("BoxCollection", "批量盒子", ["BoxCollectionAddItem", "BoxCollectionSnapshot", "BoxCollectionUpdateEntry", "BoxCollectionUpdateProps"]),
      drawApi("Plane", "平面", ["AddPlaneOptions", "PlaneStyleOptions", "PlaneSnapshot", "PlaneVideoOptions", "UpdatePlaneProperties"]),
      drawApi("PlaneCollection", "批量平面", ["PlaneCollectionAddItem", "PlaneCollectionSnapshot", "PlaneCollectionUpdateEntry", "PlaneCollectionUpdateProps"]),
      drawApi("Path", "路径", ["AddPathOptions", "PathStyleOptions", "PathSnapshot", "UpdatePathProperties"]),
      drawApi("PolylineVolume", "体线", ["AddPolylineVolumeOptions", "PolylineVolumeStyleOptions", "PolylineVolumeSnapshot", "UpdatePolylineVolumeProperties"]),
      drawApi("PolylineVolumeCollection", "批量体线", ["PolylineVolumeCollectionAddItem", "PolylineVolumeCollectionSnapshot", "PolylineVolumeCollectionUpdateEntry", "PolylineVolumeCollectionUpdateProps"]),
    ]),
    group("measure", [
      api("Quantitative", "measure", "Quantitative", "测量", "提供距离、面积、高度等交互测量能力，并支持测量结果样式控制。", methodMap.Quantitative, ["MeasureTypeKey", "MeasureCreateOptions", "MeasureStyle", "IMeasure"], "FastX.Quantitative.bindViewer(viewer)\nFastX.Quantitative.startInteractive('distance')"),
      api("MeasureType", "measure", "MeasureType", "测量类型", "测量能力使用的类型枚举。", [], ["MeasureTypeKey"], "FastX.MeasureType"),
      api("AreaManager", "measure", "AreaManager", "区域绘制管理", "统一管理点、线、面、圆、矩形等区域绘制发布流程。", methodMap.AreaManager, ["AreaDrawStartParams", "AreaDrawDirectParams", "AreaDrawResult", "AreaManagerOptions"], "FastX.AreaManager.start({ viewer, type: 'polygon' })"),
      api("Heatmap", "measure", "Heatmap", "热力图", "基于 heatmap.js 在 Cesium 场景中创建、更新和清理热力图。", methodMap.Heatmap, ["HeatmapCreateOptions", "HeatmapStyle", "HeatmapSnapshot", "HeatmapUpdateOptions"], "FastX.Heatmap.create(viewer, options)"),
      api("PointAggregation", "measure", "PointAggregation", "点聚合", "加载点数据或 GeoJSON，并在视距变化时显示聚合效果。", methodMap.PointAggregation, ["PointAggregationLoadOptions", "PointAggregationGeoJsonOptions", "PointAggregationStyle", "PointAggregationSnapshot"], "FastX.PointAggregation.loadGeoJson(viewer, url, options)"),
      api("Trajectory", "measure", "Trajectory", "轨迹", "封装时间序列关键帧，生成 Cesium SampledPositionProperty。", methodMap.Trajectory, ["TrajectoryKeyframe", "TrajectoryLngLatKeyframe", "TrajectoryOptions"], "const trajectory = FastX.Trajectory.fromDegrees(keyframes)"),
      api("Mover", "measure", "Mover", "运动控制", "根据 Trajectory 控制实体运动播放、暂停、恢复、进度跳转和循环。", methodMap.Mover, ["MoverOptions", "MoverCallbacks"], "const mover = FastX.Mover.fromViewer(viewer, options)\nmover.start()"),
    ]),
    group("plugin", [
      pluginApi("ensureVendorPlugins", "预加载插件"),
      pluginApi("ensureTurf", "加载 Turf"),
      pluginApi("ensureHeatmapJs", "加载 Heatmap"),
      pluginApi("ensureCesiumNavigation", "加载导航插件"),
      pluginApi("getTurf", "获取 Turf"),
      pluginApi("getH337", "获取 Heatmap 实例"),
      pluginApi("getCesiumNavigation", "获取导航插件"),
      pluginApi("VENDOR_MANIFEST", "插件清单"),
    ]),
    group("tools", [
      api("Utils", "tools", "Utils", "工具集", "FastX 工具函数集合，包含几何绘制和时间轴等内部通用能力。", [], [], "FastX.Utils"),
      api("Types", "tools", "Types", "类型集合", "FastX 类型导出的统一入口；运行时为占位对象，主要用于 TypeScript 类型引用。", [], ["LngLatHeight", "PointPositionInput", "LayerInitConfig"], "import type { AddPointOptions } from 'fastx-sdk'"),
      api("defaultShapeParamsForType", "tools", "defaultShapeParamsForType", "默认体线形状参数", "获取 PolylineVolume 指定形状的默认参数。", ["defaultShapeParamsForType"], ["ShapeType", "ShapeParams"], "const params = defaultShapeParamsForType('tube')"),
      api("parseShapeTypeKey", "tools", "parseShapeTypeKey", "解析体线形状", "把字符串形状 key 转成 PolylineVolume 支持的形状类型。", ["parseShapeTypeKey"], ["ShapeType"], "const type = parseShapeTypeKey(value)"),
      api("resolvePolylineCartesians", "tools", "resolvePolylineCartesians", "解析线坐标", "把线坐标输入统一转换为 Cesium.Cartesian3 数组。", ["resolvePolylineCartesians"], ["PolylineLngLatTuple"], "const positions = resolvePolylineCartesians(points)"),
      api("computeModelCollectionModelMatrix", "tools", "computeModelCollectionModelMatrix", "计算模型矩阵", "为 ModelCollection 计算模型矩阵，统一处理位置、姿态和缩放。", ["computeModelCollectionModelMatrix"], ["ModelCollectionOrientationDegrees"], "const matrix = computeModelCollectionModelMatrix(options)"),
      api("normalizePlaneVideoOptions", "tools", "normalizePlaneVideoOptions", "标准化平面视频参数", "统一处理 Plane 视频材质配置，兼容新旧参数。", ["normalizePlaneVideoOptions"], ["PlaneVideoOptions", "LegacyPlaneVideoOptions"], "const video = normalizePlaneVideoOptions(options)"),
      api("PlaneMaterialType", "tools", "PlaneMaterialType", "平面材质类型", "Plane 支持的颜色、图片、视频材质类型枚举。", [], ["PlaneMaterialTypeValue"], "FastX.PlaneMaterialType.video"),
      api("PolylineMaterialType", "tools", "PolylineMaterialType", "线材质类型", "PolyLineCollection 支持的材质类型枚举。", [], ["PolylineMaterialTypeValue"], "FastX.PolylineMaterialType"),
      api("DEFAULT_HEATMAP_STYLE", "tools", "DEFAULT_HEATMAP_STYLE", "热力图默认样式", "Heatmap 默认样式配置。", [], ["HeatmapStyle"], "FastX.DEFAULT_HEATMAP_STYLE"),
      api("DEFAULT_HEATMAP_GRADIENT", "tools", "DEFAULT_HEATMAP_GRADIENT", "热力图默认渐变", "Heatmap 默认颜色渐变配置。", [], ["HeatmapColorStop"], "FastX.DEFAULT_HEATMAP_GRADIENT"),
      api("DEFAULT_POINT_AGGREGATION_STYLE", "tools", "DEFAULT_POINT_AGGREGATION_STYLE", "点聚合默认样式", "PointAggregation 默认点和聚合图形样式。", [], ["PointAggregationStyle"], "FastX.DEFAULT_POINT_AGGREGATION_STYLE"),
    ]),
  ];

  let runtimeApiGroups = apiGroups;
  let allDocs = [...guideDocs, ...runtimeApiGroups.flatMap((item) => item.items)];
  let docsById = new Map(allDocs.map((doc) => [doc.id, doc]));
  const nav = document.getElementById("api-nav");
  const content = document.getElementById("api-content");
  const title = document.getElementById("api-page-title");
  const breadcrumb = document.getElementById("api-breadcrumb");
  const search = document.getElementById("api-search");
  const themeToggle = document.getElementById("theme-toggle");
  const copyToast = document.getElementById("copy-toast");
  const backToTop = document.getElementById("back-to-top");
  let mode = "all";
  let activeId = "intro";
  let expanded = new Set(["guide"]);

  const savedTheme = localStorage.getItem("fastx-api-theme") === "dark" ? "dark" : "light";
  setTheme(savedTheme);

  document.querySelectorAll(".api-doc-tab").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode || "all";
      document.querySelectorAll(".api-doc-tab").forEach((tab) => {
        tab.classList.toggle("is-active", tab === button);
      });
      expanded = mode === "guide" ? new Set(["guide"]) : new Set();
      renderNav();
    });
  });

  search.addEventListener("input", renderNav);
  themeToggle?.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  backToTop?.addEventListener("click", () => {
    scrollToContentTop("smooth");
  });
  window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
  window.addEventListener("hashchange", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });

  content.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-code]");
    if (!button) return;
    const code = button.closest(".doc-code-block")?.querySelector("code")?.textContent || "";
    copyCode(code);
  });

  initDocs();

  async function initDocs() {
    await loadGeneratedApiDocs();
    activeId = "intro";
    history.replaceState(null, "", location.pathname + location.search);
    renderAll();
    updateBackToTopVisibility();
  }

  async function loadGeneratedApiDocs() {
    try {
      const response = await fetch("./data/api-docs.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.groups)) return;
      runtimeApiGroups = data.groups.map(normalizeGeneratedGroup);
      allDocs = [...guideDocs, ...runtimeApiGroups.flatMap((item) => item.items)];
      docsById = new Map(allDocs.map((doc) => [doc.id, doc]));
    } catch (error) {
      console.warn("[FastX API Docs] 使用内置静态 API 数据兜底：", error);
    }
  }

  function normalizeGeneratedGroup(groupItem) {
    return {
      id: groupItem.id,
      label: groupItem.label || groupLabels[groupItem.id] || groupItem.id,
      items: (groupItem.items || []).map(normalizeGeneratedApi),
    };
  }

  function normalizeGeneratedApi(doc) {
    const methods = (doc.methods || []).map((method) =>
      typeof method === "string"
        ? { name: method, params: [], returnType: "unknown", description: "" }
        : {
            name: method.name,
            params: method.params || [],
            returnType: method.returnType || "unknown",
            description: method.description || "",
          },
    );
    const params = (doc.params || []).map((item) => ({
      name: item.name,
      type: item.type || "unknown",
      defaultValue: item.defaultValue || (item.optional ? "undefined" : "必填"),
      description: item.description || `${doc.name} 的 ${item.name} 参数。`,
    }));
    return {
      id: doc.id || doc.name,
      kind: "api",
      group: doc.group,
      name: doc.name,
      cn: doc.cn || "",
      title: doc.title || `${doc.name}${doc.cn ? `（${doc.cn}）` : ""}`,
      description: doc.description || `${doc.name} 是 fastx-sdk 对外暴露的 API。`,
      methods,
      types: doc.types || [],
      params,
      usage: doc.usage,
      access: doc.access || resolveAccess(doc.name),
      keywords: [
        doc.name,
        doc.cn || "",
        doc.description || "",
        groupLabels[doc.group] || "",
        ...methods.map((method) => method.name),
        ...(doc.types || []),
        ...params.map((item) => `${item.name} ${item.type} ${item.description}`),
      ],
    };
  }

  function guide(id, title, description, points, code) {
    return {
      id,
      kind: "guide",
      group: "guide",
      name: title,
      cn: "",
      title,
      description,
      points,
      steps: Array.isArray(code) ? code : [],
      code,
      keywords: [
        title,
        description,
        ...points,
        ...(Array.isArray(code)
          ? code.flatMap((item) => [item.title, ...item.items, item.code || ""])
          : [code || ""]),
      ],
    };
  }

  function step(title, items, code) {
    return { title, items, code };
  }

  function group(id, items) {
    return { id, label: groupLabels[id], items };
  }

  function api(id, groupId, name, cn, description, methods, types, usage) {
    const params = parameterMap[name] ?? inferParameterRows(name, groupId, types);
    return {
      id,
      kind: "api",
      group: groupId,
      name,
      cn,
      title: `${name}（${cn}）`,
      description,
      methods: methods || [],
      types: types || [],
      params,
      usage,
      access: resolveAccess(name),
      keywords: [
        name,
        cn,
        description,
        groupLabels[groupId],
        ...(methods || []).map((method) => (typeof method === "string" ? method : method.name)),
        ...(types || []),
        ...params.map((item) => `${item.name} ${item.type} ${item.description}`),
      ],
    };
  }

  function drawApi(name, cn, types) {
    const isCollection = name.endsWith("Collection");
    const description = isCollection
      ? `${cn} API，用于批量创建、更新、查询、显隐和清理对应图元集合。`
      : `${cn} API，用于创建、更新、查询、显隐和清理单体标绘对象。`;
    const addMethod = (methodMap[name] || []).find((method) => /^add/.test(method)) || "add";
    const usage = isCollection
      ? `const viewer = window.FastX.getViewer('mapDemo')\nwindow.FastX.${name}.add${name.replace("Collection", "s")}(viewer, dataList)`
      : `const viewer = window.FastX.getViewer('mapDemo')\nwindow.FastX.${name}.add(viewer, options)`;
    const normalizedUsage = isCollection
      ? `const viewer = window.FastX.getViewer('mapDemo')\nwindow.FastX.${name}.${addMethod}(viewer, dataList)`
      : usage;
    return api(name, "draw", name, cn, description, methodMap[name] || [], types, normalizedUsage);
  }

  function pluginApi(name, cn) {
    return api(name, "plugin", name, cn, `${cn}，用于管理 fastx-sdk 内置 vendor 插件的加载和访问。`, [name], ["VendorPluginEntry"], `${name}()`);
  }

  function resolveAccess(name) {
    if (name === "installFastXToWindow") return "import { installFastXToWindow } from 'fastx-sdk'";
    if (name === "Cesium") return "import { Cesium } from 'fastx-sdk'";
    if (packageNamedExports.has(name)) return `import { ${name} } from 'fastx-sdk'`;
    return `window.FastX.${name}`;
  }

  function renderAll() {
    renderNav();
    renderContent();
  }

  function renderNav() {
    const query = search.value.trim().toLowerCase();
    if (query) {
      const docs = filterDocs(allDocs, query);
      nav.innerHTML = docs.length
        ? `<div class="api-doc-group is-open"><button type="button" class="api-doc-group__head"><span class="api-doc-group__title">搜索结果</span><span class="api-doc-group__count">${docs.length}</span></button><ul class="api-doc-list">${docs.map(renderDocItem).join("")}</ul></div>`
        : '<div class="api-doc-empty">没有匹配的 API 或中文名称</div>';
      bindNavItems();
      return;
    }

    const pieces = [];
    if (mode === "all" || mode === "guide") {
      pieces.push(renderGroup({ id: "guide", label: "入门", items: guideDocs }));
    }
    if (mode === "all" || mode === "module") {
      pieces.push(...runtimeApiGroups.map(renderGroup));
    }
    nav.innerHTML = pieces.join("");
    bindGroupHeads();
    bindNavItems();
  }

  function filterDocs(docs, query) {
    return docs.filter((doc) => {
      if (mode === "guide" && doc.kind !== "guide") return false;
      if (mode === "module" && doc.kind !== "api") return false;
      return doc.keywords.join(" ").toLowerCase().includes(query);
    });
  }

  function renderGroup(groupItem) {
    const isOpen = expanded.has(groupItem.id);
    return `<div class="api-doc-group ${isOpen ? "is-open" : ""}" data-group="${escapeHtml(groupItem.id)}">
      <button type="button" class="api-doc-group__head">
        <span class="api-doc-group__title">${escapeHtml(groupItem.label)}</span>
        <span class="api-doc-group__count">${groupItem.items.length}</span>
        <i class="api-doc-chevron" aria-hidden="true"></i>
      </button>
      <ul class="api-doc-list">${groupItem.items.map(renderDocItem).join("")}</ul>
    </div>`;
  }

  function renderDocItem(doc) {
    const suffix = doc.kind === "api" && doc.cn ? `<span>（${escapeHtml(doc.cn)}）</span>` : "";
    return `<li><button type="button" class="api-doc-item ${doc.id === activeId ? "is-active" : ""}" data-doc-id="${escapeHtml(doc.id)}"><strong>${escapeHtml(doc.name)}</strong>${suffix}</button></li>`;
  }

  function bindGroupHeads() {
    nav.querySelectorAll(".api-doc-group__head").forEach((head) => {
      head.addEventListener("click", () => {
        const groupEl = head.closest(".api-doc-group");
        const id = groupEl.dataset.group;
        if (!id) return;
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        renderNav();
      });
    });
  }

  function bindNavItems() {
    nav.querySelectorAll("[data-doc-id]").forEach((item) => {
      item.addEventListener("click", () => {
        const id = item.dataset.docId;
        if (!id || !docsById.has(id)) return;
        activeId = id;
        history.replaceState(null, "", `#${encodeURIComponent(id)}`);
        renderAll();
        scrollToContentTop("auto");
      });
    });
  }

  function renderContent() {
    const doc = docsById.get(activeId) || docsById.get("intro");
    title.textContent = doc.title;
    breadcrumb.textContent = `${groupLabels[doc.group]} / ${doc.kind === "api" ? "API 集合" : "入门指南"}`;
    content.innerHTML = doc.kind === "guide" ? renderGuide(doc) : renderApi(doc);
  }

  function setTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalized;
    localStorage.setItem("fastx-api-theme", normalized);
    if (themeToggle) {
      themeToggle.textContent = "";
      themeToggle.dataset.themeIcon = normalized === "dark" ? "light" : "dark";
      const title = normalized === "dark" ? "切换浅色主题" : "切换深色主题";
      themeToggle.setAttribute("aria-label", title);
      themeToggle.setAttribute("title", title);
    }
  }

  function updateBackToTopVisibility() {
    if (!backToTop) return;
    backToTop.classList.toggle("is-visible", window.scrollY > 360);
  }

  function scrollToContentTop(behavior = "auto") {
    const top = document.querySelector(".api-doc-main")?.offsetTop || 0;
    window.scrollTo({ top, behavior });
  }

  async function copyCode(code) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showCopyToast();
    } catch {
      showCopyToast("复制失败");
    }
  }

  function showCopyToast(text = "复制成功") {
    if (!copyToast) return;
    copyToast.textContent = text;
    copyToast.classList.add("is-visible");
    window.clearTimeout(showCopyToast.timer);
    showCopyToast.timer = window.setTimeout(() => copyToast.classList.remove("is-visible"), 1400);
  }

  function renderGuide(doc) {
    return `<section class="doc-hero">
      <div class="doc-eyebrow">入门指南</div>
      <h2>${escapeHtml(doc.title)}</h2>
      <p>${escapeHtml(doc.description)}</p>
    </section>
    <section class="doc-section doc-card">
      <h3>内容说明</h3>
      <ul>${doc.points.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${typeof doc.code === "string" ? renderCode(doc.code) : ""}
    </section>
    ${doc.steps?.length ? `<section class="doc-section doc-card">
      <h3>操作步骤</h3>
      <div class="doc-step-list">${doc.steps.map(renderGuideStep).join("")}</div>
    </section>` : ""}
    <section class="doc-grid">
      <div class="doc-card"><h3>文档范围</h3><p>只覆盖 fastx-sdk 对外暴露的 FastX API、包导出函数、类型、常量和枚举。</p></div>
      <div class="doc-card"><h3>推荐入口</h3><p>业务代码优先使用 window.FastX 单例入口；需要类型时从 fastx-sdk 导入 type。</p></div>
      <div class="doc-card"><h3>阅读顺序</h3><p>首次使用建议按 SDK 简介、安装 npm 包、初始化地图、window.FastX 使用方式、常见问题依次阅读。</p></div>
    </section>`;
  }

  function renderApi(doc) {
    return `<section class="doc-hero">
      <div class="doc-eyebrow">${escapeHtml(groupLabels[doc.group])} API</div>
      <h2>${escapeHtml(doc.name)}${doc.cn ? `<span>（${escapeHtml(doc.cn)}）</span>` : ""}</h2>
    </section>
    <section class="doc-section doc-card">
      <h3>描述</h3>
      <p>${escapeHtml(doc.description)}</p>
      <div class="doc-meta">
        <div class="doc-meta__item"><span class="doc-meta__label">访问路径</span><span class="doc-meta__value">${escapeHtml(doc.access)}</span></div>
        <div class="doc-meta__item"><span class="doc-meta__label">模块</span><span class="doc-meta__value">${escapeHtml(groupLabels[doc.group])}</span></div>
        <div class="doc-meta__item"><span class="doc-meta__label">方法数量</span><span class="doc-meta__value">${doc.methods.length}</span></div>
      </div>
    </section>
    <section class="doc-section doc-card">
      <h3>方法</h3>
      ${renderMethodList(doc)}
    </section>
    <section class="doc-section doc-card">
      <h3>注意事项</h3>
      <ul class="doc-note">
        <li>本页只展示 ${escapeHtml(doc.name)}（${escapeHtml(doc.cn || "API")}）自身内容，批量类或关联类会在左侧菜单中分开展示。</li>
        <li>标绘类方法通常需要传入有效 Cesium Viewer；建议通过 window.FastX.getViewer(mapName) 获取。</li>
        <li>TypeScript 参数细节以 fastx-sdk 导出的 d.ts 为准，本页用于快速检索和业务使用说明。</li>
      </ul>
    </section>`;
  }

  function parameterDisplayName(name) {
    const parts = String(name || "").split(".");
    return parts[parts.length - 1] || name;
  }

  function parameterParentName(name) {
    const parts = String(name || "").split(".");
    return parts.length > 1 ? parts.slice(0, -1).join(".") : "-";
  }

  function methodParameterRows(doc, methodName) {
    return (doc.params || [])
      .filter((item) => item.name === methodName || item.name.startsWith(`${methodName}.`))
      .map((item) => ({
        ...item,
        name: item.name === methodName ? methodName : item.name.slice(methodName.length + 1),
      }));
  }

  function renderParameterTable(params) {
    if (!params || !params.length) return "<p>该方法无固定入参，按方法签名直接使用。</p>";
    return `<div class="doc-table-wrap"><table class="doc-table doc-param-table">
      <thead><tr><th>参数</th><th>父级</th><th>type</th><th>Default</th><th>Description</th></tr></thead>
      <tbody>${params
        .map(
          (item) =>
            `<tr><td><code class="doc-param-name">${escapeHtml(parameterDisplayName(item.name))}</code></td><td class="doc-param-parent">${escapeHtml(parameterParentName(item.name))}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(formatDefaultValue(item.defaultValue))}</td><td class="doc-param-desc">${escapeHtml(item.description)}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>`;
  }

  function formatDefaultValue(value) {
    return !value || value === "undefined" ? "-" : value;
  }

  function renderGuideStep(item) {
    return `<div class="doc-step">
      <h4>${escapeHtml(item.title)}</h4>
      <ul>${item.items.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
      ${item.code ? renderCode(item.code) : ""}
    </div>`;
  }

  function methodNameOf(method) {
    return typeof method === "string" ? method : method?.name || "";
  }

  function methodParamsOf(method) {
    return typeof method === "string" ? [] : method?.params || [];
  }

  function cleanDocText(value) {
    return String(value || "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderMethodList(doc) {
    if (!doc.methods.length) return "<p>该导出项主要作为类型、常量或命名空间使用。</p>";
    return `<div class="doc-method-list">${doc.methods
      .map((method) => {
        const name = methodNameOf(method);
        const example = methodExample(doc, method);
        const params = methodParameterRows(doc, name);
        return `<section class="doc-method">
          <div class="doc-method__head">
            <h4 class="doc-method__name">${escapeHtml(name)}</h4>
          </div>
          <div class="doc-method__body">
            <div class="doc-method__block">
              <h5>描述</h5>
              <p class="doc-method__desc">${escapeHtml(describeMethod(method, doc))}</p>
            </div>
            <div class="doc-method__block">
              <h5>参数</h5>
              ${renderParameterTable(params)}
            </div>
            <div class="doc-method__block">
              <h5>示例代码</h5>
              ${renderCode(example)}
            </div>
          </div>
        </section>`;
      })
      .join("")}</div>`;
  }

  function renderMethodTable(methods) {
    if (!methods.length) return "<p>该导出项主要作为类型、常量或命名空间使用。</p>";
    return `<div class="doc-table-wrap"><table class="doc-table">
      <thead><tr><th>方法</th><th>说明</th></tr></thead>
      <tbody>${methods.map((method) => `<tr><td><code>${escapeHtml(methodNameOf(method))}</code></td><td>${escapeHtml(describeMethod(method))}</td></tr>`).join("")}</tbody>
    </table></div>`;
  }

  function inferParameterRows(name, groupId, types) {
    if (groupId === "draw") {
      return name.endsWith("Collection") ? commonCollectionParameterRows : commonDrawParameterRows;
    }
    if (groupId === "plugin") {
      return [
        param("options", "object", "undefined", "插件加载或读取时的可选配置；不同插件按对应方法签名传入。"),
      ];
    }
    if (groupId === "measure") {
      return [
        ...commonViewerParameterRows,
        param("options", types?.[0] || "object", "undefined", "测量、分析或轨迹功能的业务配置。"),
        param("id", "string", "按方法必填", "需要查询、更新或移除的测量对象 ID。"),
      ];
    }
    if (groupId === "tools") {
      return types?.length
        ? types.map((type) => param(type, type, "-", "该工具函数相关的参数或返回类型。"))
        : [];
    }
    return types?.length
      ? types.map((type) => param(type, type, "-", "该 API 关联的参数类型，具体字段以 fastx-sdk 类型声明为准。"))
      : [];
  }

  function param(name, type, defaultValue, description) {
    return { name, type, defaultValue, description };
  }

  function exampleValueForParam(param, doc) {
    const name = String(param?.name || "");
    const type = String(param?.type || "");
    const lower = name.toLowerCase();
    const typeLower = type.toLowerCase();
    if (lower === "viewer" || /viewer/.test(typeLower)) return "viewer";
    if (lower === "clock" || /clock/.test(typeLower)) return "viewer.clock";
    if (lower === "mapname") return "'mapDemo'";
    if (lower === "containerid") return "'map'";
    if (lower === "fallbacktoken") return "'pt'";
    if (lower === "app") return "app";
    if (lower === "id" || lower.endsWith("id")) return `'${doc.name.toLowerCase()}-001'`;
    if (lower.includes("ids")) return `['${doc.name.toLowerCase()}-001']`;
    if (lower.includes("position") && typeLower.includes("cartesian")) return "Cesium.Cartesian3.fromDegrees(116.391, 39.907, 120)";
    if (lower.includes("position") || lower.includes("point")) return "{ longitude: 116.391, latitude: 39.907, height: 120 }";
    if (lower.includes("longitude") || lower === "lng") return "116.391";
    if (lower.includes("latitude") || lower === "lat") return "39.907";
    if (lower.includes("height")) return "120";
    if (lower.includes("duration") || lower.includes("seconds")) return "60";
    if (lower.includes("progress")) return "0.5";
    if (lower.includes("time")) return "Cesium.JulianDate.now()";
    if (lower.includes("url")) return "'/json/data.geojson'";
    if (lower.includes("type")) return "'distance'";
    if (lower.includes("show") || lower.includes("visible") || type === "boolean") return "true";
    if (typeLower.includes("[]") || lower.includes("items") || lower.includes("list")) return "[]";
    if (lower.includes("options") || lower.includes("config") || lower.includes("properties") || lower.includes("params") || typeLower.includes("options")) return "options";
    if (type === "number") return "1";
    if (type === "string") return "'value'";
    return lower || "value";
  }

  function methodCallArgs(method, doc) {
    return methodParamsOf(method)
      .filter((param) => param.defaultValue === "必填")
      .map((param) => exampleValueForParam(param, doc))
      .join(", ");
  }

  function methodCall(target, methodName, method, doc) {
    const args = methodCallArgs(method, doc);
    return `${target}.${methodName}(${args})`;
  }

  function indentCode(code, spaces) {
    const prefix = " ".repeat(spaces);
    return code
      .split("\n")
      .map((line) => (line ? `${prefix}${line}` : line))
      .join("\n");
  }

  function drawBaseName(name) {
    return name.replace(/Collection$/, "");
  }

  function drawExampleObject(name, index = 1) {
    const base = drawBaseName(name);
    const suffix = String(index).padStart(3, "0");
    const id = `${base.toLowerCase()}-${suffix}`;
    const commonCenter = "center: { longitude: 116.391, latitude: 39.907, height: 120 }";
    const commonPosition = "position: { longitude: 116.391, latitude: 39.907, height: 120 }";
    const points = "[\n    { longitude: 116.391, latitude: 39.907, height: 120 },\n    { longitude: 116.421, latitude: 39.917, height: 120 },\n    { longitude: 116.411, latitude: 39.887, height: 120 }\n  ]";
    const examples = {
      Label: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 120 },\n  text: 'FastX 标签',\n  fontColor: '#ffffff',\n  showBackground: true,\n  backgroundColor: '#1f6feb'\n}`,
      Billboard: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 120 },\n  image: '/assets/images/logo.png',\n  scale: 0.8\n}`,
      PolyLine: `{\n  id: '${id}',\n  positions: [\n    [116.391, 39.907, 120],\n    [116.421, 39.917, 120],\n    [116.441, 39.897, 120]\n  ],\n  color: '#2f80ed',\n  width: 4\n}`,
      Polygon: `{\n  id: '${id}',\n  positions: ${points},\n  color: '#2f80ed',\n  showFill: true,\n  outline: true,\n  outlineColor: '#ffffff',\n  outlineWidth: 2\n}`,
      Circle: `{\n  id: '${id}',\n  ${commonCenter},\n  radius: 800,\n  color: '#2f80ed',\n  showFill: true,\n  outline: true,\n  outlineColor: '#ffffff',\n  outlineWidth: 2\n}`,
      Rectangle: `{\n  id: '${id}',\n  west: 116.37,\n  south: 39.89,\n  east: 116.42,\n  north: 39.93,\n  color: '#2f80ed',\n  showFill: true,\n  outline: true,\n  outlineColor: '#ffffff',\n  outlineWidth: 2\n}`,
      Sector: `{\n  id: '${id}',\n  ${commonCenter},\n  radius: 1200,\n  startAzimuthDegrees: 30,\n  endAzimuthDegrees: 120,\n  color: '#2f80ed',\n  showFill: true,\n  outline: true\n}`,
      Cylinder: `{\n  id: '${id}',\n  ${commonCenter},\n  length: 600,\n  topRadius: 180,\n  bottomRadius: 260,\n  color: '#2f80ed',\n  showFill: true,\n  outline: true\n}`,
      Corridor: `{\n  id: '${id}',\n  positions: [\n    { longitude: 116.391, latitude: 39.907, height: 120 },\n    { longitude: 116.421, latitude: 39.917, height: 120 }\n  ],\n  width: 300,\n  color: '#2f80ed',\n  showFill: true,\n  outline: true\n}`,
      Runway: `{\n  id: '${id}',\n  positions: [\n    { longitude: 116.391, latitude: 39.907, height: 120 },\n    { longitude: 116.431, latitude: 39.917, height: 120 }\n  ],\n  width: 300,\n  color: '#2f80ed',\n  showFill: true,\n  outline: true\n}`,
      Ellipsoid: `{\n  id: '${id}',\n  ${commonPosition},\n  radii: 500,\n  color: '#2f80ed',\n  outline: true,\n  outlineColor: '#ffffff'\n}`,
      Wall: `{\n  id: '${id}',\n  positions: [\n    { longitude: 116.391, latitude: 39.907, height: 800 },\n    { longitude: 116.421, latitude: 39.917, height: 800 }\n  ],\n  color: '#2f80ed'\n}`,
      Model: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 120 },\n  uri: '/models/Cesium_Air.glb',\n  scale: 1\n}`,
      Box: `{\n  id: '${id}',\n  ${commonPosition},\n  dimensions: [400, 300, 200],\n  color: '#2f80ed',\n  outline: true,\n  outlineColor: '#ffffff'\n}`,
      Plane: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 120 },\n  dimensions: { width: 600, height: 400 },\n  color: '#2f80ed',\n  alpha: 0.75\n}`,
      Path: `{\n  id: '${id}',\n  position: trajectory.getPositionProperty(),\n  width: 4,\n  color: '#2f80ed'\n}`,
      PolylineVolume: `{\n  id: '${id}',\n  positions: [\n    [116.391, 39.907, 120],\n    [116.421, 39.917, 120],\n    [116.441, 39.897, 120]\n  ],\n  shapeType: 'circle',\n  color: '#2f80ed'\n}`,
    };
    return examples[base] || `{\n  id: '${id}'\n}`;
  }

  function drawUpdateExampleObject(name) {
    const base = drawBaseName(name);
    const examples = {
      Circle: "{\n  radius: 1000,\n  color: '#00d6a3',\n  outlineWidth: 3\n}",
      Rectangle: "{\n  west: 116.36,\n  south: 39.88,\n  east: 116.43,\n  north: 39.94\n}",
      Cylinder: "{\n  length: 800,\n  topRadius: 220,\n  bottomRadius: 300\n}",
      Model: "{\n  scale: 1.2,\n  headingDegrees: 45\n}",
      Box: "{\n  dimensions: [500, 320, 240],\n  color: '#00d6a3'\n}",
      Plane: "{\n  dimensions: { width: 800, height: 450 },\n  color: '#00d6a3'\n}",
      Path: "{\n  width: 6,\n  color: '#00d6a3'\n}",
    };
    return examples[base] || "{\n  color: '#00d6a3',\n  show: true\n}";
  }

  function overlayElementCode(variableName = "element", title = "FastX 标牌") {
    return `const ${variableName} = document.createElement('div')\nObject.assign(${variableName}.style, {\n  minWidth: '150px',\n  padding: '10px 12px',\n  border: '1px solid rgba(0,214,255,.65)',\n  borderRadius: '6px',\n  background: 'rgba(6,18,32,.86)',\n  color: '#fff',\n  boxShadow: '0 8px 24px rgba(0,0,0,.28)',\n  fontSize: '13px',\n  lineHeight: '1.5'\n})\n${variableName}.innerHTML = '<strong>${title}</strong><br/>HTML 标牌内容'`;
  }

  function overlayTargetEntityCode(variableName = "entity", id = "overlay-target-001") {
    return `const ${variableName} = viewer.entities.add({\n  id: '${id}',\n  position: Cesium.Cartesian3.fromDegrees(116.391, 39.907, 120),\n  point: {\n    pixelSize: 10,\n    color: Cesium.Color.fromCssColorString('red'),\n    outlineColor: Cesium.Color.fromCssColorString('#ccc'),\n    outlineWidth: 2\n  }\n})`;
  }

  function overlayOptionsCode(id = "overlay-001", entityName = "entity", elementName = "element") {
    return `{\n  id: '${id}',\n  entity: ${entityName},\n  element: ${elementName},\n  show: true,\n  offset: [0, -80],\n  draggable: true,\n  renderType: 'entity',\n  lineStyle: {\n    color: '#00d6ff',\n    width: 2,\n    dashed: false,\n    show: true\n  },\n  viewHeight: {\n    enabled: true,\n    maxHeight: 1500000\n  },\n  targetData: {\n    name: '业务标牌'\n  }\n}`;
  }

  function overlayMethodExample(methodName) {
    const target = "window.FastX.Overlay";
    const setup = `const Cesium = window.FastX.Cesium || window.Cesium\n${viewerExampleLine()}\n${overlayTargetEntityCode()}\n${overlayElementCode()}`;
    const examples = {
      add: `${setup}\nconst options = ${overlayOptionsCode()}\n\nconst overlayId = ${target}.add(viewer, options)`,
      addBatch: `const Cesium = window.FastX.Cesium || window.Cesium\n${viewerExampleLine()}\n${overlayTargetEntityCode("entityA", "overlay-target-001")}\n${overlayTargetEntityCode("entityB", "overlay-target-002")}\n${overlayElementCode("elementA", "FastX 标牌 A")}\n${overlayElementCode("elementB", "FastX 标牌 B")}\nconst items = [\n${indentCode(overlayOptionsCode("overlay-001", "entityA", "elementA"), 2)},\n${indentCode(overlayOptionsCode("overlay-002", "entityB", "elementB"), 2)}\n]\n\nconst ids = ${target}.addBatch(viewer, items)`,
      updateOverlay: `${overlayElementCode("nextElement", "更新后的标牌")}\n${target}.updateOverlay('overlay-001', {\n  element: nextElement,\n  offset: [20, -90],\n  lineStyle: {\n    color: '#00ff99',\n    width: 3,\n    dashed: true\n  },\n  targetData: {\n    status: 'online'\n  }\n})`,
      updateLineStyle: `${target}.updateLineStyle('overlay-001', {\n  color: '#00ff99',\n  width: 3,\n  dashed: true,\n  dashLength: 20\n})`,
      setOffset: `${target}.setOffset('overlay-001', [0, -100])`,
      resetPosition: `${target}.resetPosition('overlay-001')`,
      show: `${target}.show('overlay-001')`,
      hide: `${target}.hide('overlay-001')`,
      setVisible: `${target}.setVisible('overlay-001', true)`,
      setAllVisibility: `${target}.setAllVisibility(true)`,
      getOverlay: `const overlay = ${target}.getOverlay('overlay-001')`,
      getAllOverlays: `const overlays = ${target}.getAllOverlays()`,
      getTargetData: `const data = ${target}.getTargetData('overlay-001')`,
      setTargetData: `${target}.setTargetData('overlay-001', {\n  name: '业务标牌',\n  status: 'online'\n})`,
      mergeTargetData: `${target}.mergeTargetData('overlay-001', {\n  status: 'warning'\n})`,
      getElement: `const element = ${target}.getElement('overlay-001')`,
      getEntity: `const entity = ${target}.getEntity('overlay-001')`,
      has: `const exists = ${target}.has('overlay-001')`,
      getIds: `const ids = ${target}.getIds()`,
      getCount: `const count = ${target}.getCount()`,
      remove: `${target}.remove('overlay-001')`,
      removeBatch: `${target}.removeBatch(['overlay-001', 'overlay-002'])`,
      clear: `${target}.clear()`,
      pruneInvalid: `${target}.pruneInvalid()`,
      destroy: `${target}.destroy()`,
    };
    return examples[methodName] || `${target}.${methodName}()`;
  }

  function effectBaseName(name) {
    return name.replace(/Collection$/, "");
  }

  function effectId(name) {
    return `${effectBaseName(name).replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}-001`;
  }

  function lowerFirst(value) {
    return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : "api";
  }

  function effectApiVariableName(name) {
    return `${lowerFirst(name).replace(/[^A-Za-z0-9_$]/g, "")}Api`;
  }

  function viewerExampleLine() {
    return "const viewer = window.FastX.getLayer().viewer";
  }

  function effectApiSetup(doc, target, classRef) {
    const constructorArgs = doc.name.endsWith("Collection") ? "" : "viewer";
    return `${viewerExampleLine()}\nconst ${target} = new ${classRef}(${constructorArgs})`;
  }

  function effectAddArgs(doc, methodName, optionsName) {
    return doc.name.endsWith("Collection") || methodName !== "add" ? `viewer, ${optionsName}` : optionsName;
  }

  function effectExampleObject(name, index = 1) {
    const base = effectBaseName(name);
    const id = `${effectBaseName(name).replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}-${String(index).padStart(3, "0")}`;
    const position = "position: { longitude: 116.391, latitude: 39.907, height: 1200 }";
    const points = "[\n    { longitude: 116.391, latitude: 39.907, height: 0 },\n    { longitude: 116.421, latitude: 39.917, height: 0 },\n    { longitude: 116.411, latitude: 39.887, height: 0 }\n  ]";
    const examples = {
      RadiationCircle: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 0 },\n  maxRadius: 1500,\n  color: 'rgba(0,255,255,0.75)',\n  duration: 1200,\n  count: 3\n}`,
      CircleDiffusion: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 0 },\n  maxRadius: 1800,\n  color: 'rgba(0,255,120,0.85)',\n  duration: 2000\n}`,
      ElectronicFence: `{\n  id: '${id}',\n  positions: ${points},\n  height: 600,\n  color: '#00d6ff',\n  duration: 1500\n}`,
      PolygonDiffusionWall: `{\n  id: '${id}',\n  center: { longitude: 116.391, latitude: 39.907, height: 0 },\n  radius: 1000,\n  edge: 5,\n  height: 200,\n  speed: 15,\n  minRadius: 50,\n  color: '#ffff00'\n}`,
      RadarEmissionWave: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 1200 },\n  color: '#00FFFF',\n  length: 500000,\n  bottomRadius: 50000,\n  duration: 1800\n}`,
      HemisphereRadarScan: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 0 },\n  radius: 1000,\n  color: '#00ff0038',\n  scanColor: '#00ff0038',\n  speed: 1\n}`,
      AirRadar: `{\n  id: '${id}',\n  ${position},\n  length: 8000,\n  angle: 35,\n  color: 'rgba(255,255,0,0.1)',\n  lineColor: 'rgba(0,255,0,0.8)',\n  scanColor: 'rgba(0,255,120,0.35)',\n  scanSpeed: 60,\n  scanAngle: 24\n}`,
      SectorArcRadarScan: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 0 },\n  maxRadius: 3000,\n  angle: 90,\n  verticalAngle: 60,\n  color: 'rgba(0,110,255,0.5)',\n  lineColor: '#ff0000',\n  scanVisible: true,\n  scanColor: 'rgba(255,255,0,1)',\n  scanLineColor: '#32cc5c',\n  scanAngleRatio: 0.18,\n  duration: 6000\n}`,
      DiffusionRadar: `{\n  id: '${id}',\n  ${position},\n  radius: 400000,\n  startAngle: 0,\n  endAngle: 360,\n  waveCount: 4,\n  duration: 2200,\n  color: 'rgba(0,214,255,0.22)',\n  lineColor: 'rgba(0,255,255,0.85)'\n}`,
      AimEffect: `{\n  id: '${id}',\n  source: { longitude: 116.391, latitude: 39.907, height: 1500 },\n  target: { longitude: 116.421, latitude: 39.917, height: 200 },\n  color: '#ff4d4f'\n}`,
      ConeEffect: `{\n  id: '${id}',\n  position: [120.3, 23.5, 1000],\n  height: 500000,\n  baseRadius: 100000,\n  scanRadius: 70000,\n  segments: 280,\n  coneLineColor: 'rgba(255,0,0,1)',\n  scanLineColor: 'rgba(0,255,0,1)',\n  coneFillColor: 'rgba(0,255,255,0.25)',\n  showConeFill: false,\n  showCone: true,\n  showScan: true\n}`,
      ConicalScanner: `{\n  id: '${id}',\n  ${position},\n  length: 4000,\n  angle: 35,\n  scanColor: '#00d6ff'\n}`,
      DoubleViewFrustum: `{\n  id: '${id}',\n  position: { longitude: 120.95, latitude: 23.75, height: 500000 },\n  heading: 0,\n  pitch: 0,\n  roll: 0,\n  scale: 1,\n  near: 50000,\n  far: 500000,\n  fov: 30,\n  aspectRatio: 2,\n  color: 'rgba(0,255,255,0.25)',\n  fillColor: '#00ffff',\n  fillAlpha: 0.15,\n  lineColor: 'rgba(255,255,255,1)',\n  lineWidth: 1,\n  show: true\n}`,
      ParabolaRadar: `{\n  id: '${id}',\n  position: { longitude: 120.95, latitude: 23.75, height: 0 },\n  heading: 0,\n  pitch: 0,\n  roll: 0,\n  scale: 1,\n  radius: 66000,\n  domeHeight: 18000,\n  scanSpeed: 45,\n  scanBladeAngle: 1,\n  scanBladeCount: 1,\n  horizontalSegments: 96,\n  verticalSegments: 10,\n  gridLineWidth: 1,\n  surfaceColor: '#00ff48',\n  surfaceAlpha: 0.34,\n  gridColor: '#00ff48',\n  gridAlpha: 0.78,\n  scanBladeColor: '#ff0000',\n  scanBladeAlpha: 0.48,\n  scanBlink: false,\n  show: true\n}`,
      RingConeScanner: `{\n  id: '${id}',\n  ${position},\n  length: 4000,\n  innerRadius: 600,\n  bottomRadius: 1400,\n  scanColor: '#00d6ff'\n}`,
      RingRadar: `{\n  id: '${id}',\n  position: { longitude: 120.95, latitude: 23.75, height: 0 },\n  heading: 0,\n  pitch: 0,\n  roll: 0,\n  scale: 1,\n  innerRadius: 33000,\n  outerRadius: 66000,\n  innerDomeHeight: 9000,\n  outerDomeHeight: 18000,\n  scanSpeed: 45,\n  scanBladeAngle: 1,\n  horizontalSegments: 96,\n  verticalSegments: 10,\n  gridLineWidth: 1,\n  outerSurfaceColor: '#c8601f',\n  outerSurfaceAlpha: 0.34,\n  outerGridColor: '#c8601f',\n  outerGridAlpha: 0.78,\n  innerSurfaceColor: '#00ff48',\n  innerSurfaceAlpha: 0.38,\n  innerGridColor: '#00ff48',\n  innerGridAlpha: 0.78,\n  scanBladeColor: '#fff400',\n  scanBladeAlpha: 0.48,\n  scanBlink: false,\n  show: true\n}`,
      ScanRadar: `{\n  id: '${id}',\n  ${position},\n  radius: 3200,\n  scanColor: '#00d6ff',\n  duration: 1800\n}`,
      SquareConeScanner: `{\n  id: '${id}',\n  position: { longitude: 120.95, latitude: 23.75, height: 500000 },\n  heading: 0,\n  pitch: 0,\n  roll: 0,\n  scale: 1,\n  height: 500000,\n  horiAngle: 30,\n  vertAngle: 30,\n  color: 'rgba(89,255,155,0.55)',\n  lineColor: 'rgba(89,255,155,1)',\n  lineWidth: 1,\n  bottomOutlineVisible: true,\n  bottomOutlineColor: '#ffff00',\n  bottomOutlineAlpha: 1,\n  bottomOutlineWidth: 1,\n  show: true\n}`,
      FireRangeEffect: `{\n  id: '${id}',\n  position: { longitude: 108, latitude: 39, height: 2000 },\n  heading: 0,\n  pitch: 0,\n  roll: 0,\n  scale: 1,\n  radius: 10000,\n  minHoriAngle: -30,\n  maxHoriAngle: 30,\n  minVertAngle: 80,\n  maxVertAngle: 100,\n  horiPointNum: 360,\n  vertPointNum: 180,\n  radialPointNum: 48,\n  gridHoriStep: 1,\n  gridVertStep: 1,\n  apexColor: 'rgba(20,40,255,0.58)',\n  middleColor: 'rgba(210,215,35,0.42)',\n  farColor: 'rgba(255,140,0,0.58)',\n  fillAlpha: 1,\n  fillVisible: true,\n  gridColor: '#ff5600',\n  gridAlpha: 0.95,\n  gridLineWidth: 1,\n  gridVisible: true,\n  outlineColor: '#ff0000',\n  outlineAlpha: 0.9,\n  outlineLineWidth: 1,\n  outlineVisible: true,\n  show: true\n}`,
      ParticleSystemEffect: `{\n  id: '${id}',\n  ${position},\n  image: '/assets/images/special-effects/explosion/fire2.png',\n  emissionRate: 120,\n  emitter: { type: 'cone', angle: 35 },\n  lifetime: 3\n}`,
      ExplosionEffect: `{\n  id: '${id}',\n  ${position},\n  lifeTime: 5\n}`,
      FrameAnimationEffect: `{\n  id: '${id}',\n  position: { longitude: 116.391, latitude: 39.907, height: 500 },\n  framePath: '/assets/images/special-effects/frame-animation/blast/',\n  frameCount: 15,\n  duration: 2,\n  loop: false,\n  width: 96,\n  height: 96\n}`,
      EntityFocusEffect: `{\n  entityId: 'target-entity-001',\n  radius: 1200,\n  duration: 2,\n  color: '#18d6ff'\n}`,
    };
    return examples[base] || `{\n  id: '${id}',\n  ${position},\n  color: '#00d6ff'\n}`;
  }

  function effectUpdateExampleObject(name) {
    const base = effectBaseName(name);
    const examples = {
      FrameAnimationEffect: "{\n  duration: 1.5,\n  loop: false,\n  width: 120,\n  height: 120\n}",
      ParticleSystemEffect: "{\n  emissionRate: 180,\n  maxSpeed: 45,\n  show: true\n}",
      ExplosionEffect: "{\n  lifeTime: 4,\n  show: true\n}",
      FireRangeEffect: "{\n  radius: 12000,\n  maxHoriAngle: 35,\n  gridVisible: true,\n  outlineVisible: true,\n  show: true\n}",
      EntityFocusEffect: "{\n  radius: 1600,\n  color: '#00d6ff',\n  duration: 2\n}",
    };
    return examples[base] || "{\n  color: '#00d6ff',\n  lineColor: '#ffffff',\n  show: true\n}";
  }

  function weatherOptionsObject(name) {
    const examples = {
      GlobalRain: "{\n  tiltAngle: -0.6,\n  rainSize: 0.3,\n  rainSpeed: 60,\n  autoStart: true\n}",
      GlobalSnow: "{\n  snowSize: 0.02,\n  snowSpeed: 60,\n  autoStart: true\n}",
      GlobalFog: "{\n  fogDensity: 0.0015,\n  color: 'rgba(180,190,200,0.45)',\n  autoStart: true\n}",
    };
    return examples[name] || "{\n  autoStart: true\n}";
  }

  function isArrayMethodParam(method) {
    return methodParamsOf(method).some(
      (param) => /\[\]|Array</.test(param.type) || (["items", "updates", "options"].includes(param.name) && /\[\]/.test(param.type)),
    );
  }

  function methodExample(doc, method) {
    const methodName = methodNameOf(method);
    const requiredArgs = methodCallArgs(method, doc);
    const access = doc.access.startsWith("window.FastX") ? doc.access : doc.name;
    if (doc.name === "Point") {
      const examples = {
        add: "const viewer = window.FastX.getViewer('mapDemo')\n\nwindow.FastX.Point.add(viewer, {\n  id: 'point-001',\n  positions: [116.391, 39.907, 120],\n  color: '#ffcc00',\n  pixelSize: 12\n})",
        addBatch: "const viewer = window.FastX.getViewer('mapDemo')\n\nwindow.FastX.Point.addBatch(viewer, [\n  { id: 'point-001', positions: [116.391, 39.907, 120] },\n  { id: 'point-002', positions: [116.401, 39.917, 120] }\n])",
        addPoints: "const viewer = window.FastX.getViewer('mapDemo')\n\nwindow.FastX.Point.addPoints(viewer, [\n  { positions: [116.391, 39.907, 120], color: '#ffcc00' }\n])",
        updatePoint: "window.FastX.Point.updatePoint('point-001', {\n  positions: [116.401, 39.917, 150],\n  color: '#00d6a3'\n})",
        updatePoints: "window.FastX.Point.updatePoints([\n  { id: 'point-001', pixelSize: 16 },\n  { id: 'point-002', show: false }\n])",
        getTargetData: "const data = window.FastX.Point.getTargetData('point-001')",
        setTargetData: "window.FastX.Point.setTargetData('point-001', {\n  name: '业务点位',\n  type: 'site'\n})",
        mergeTargetData: "window.FastX.Point.mergeTargetData('point-001', {\n  status: 'online'\n})",
        getPoint: "const snapshot = window.FastX.Point.getPoint('point-001')",
        getAllPoints: "const points = window.FastX.Point.getAllPoints()",
        getCount: "const count = window.FastX.Point.getCount()",
        getAllIds: "const ids = window.FastX.Point.getAllIds()",
        setAllVisibility: "window.FastX.Point.setAllVisibility(true)",
        setSpecifyVisibility: "window.FastX.Point.setSpecifyVisibility(['point-001', 'point-002'], false)",
        removeAll: "window.FastX.Point.removeAll()",
        getEntity: "const entity = window.FastX.Point.getEntity('point-001')",
        has: "const exists = window.FastX.Point.has('point-001')",
        getIds: "const ids = window.FastX.Point.getIds()",
        updateStyle: "window.FastX.Point.updateStyle('point-001', {\n  pixelSize: 18,\n  outlineWidth: 3\n})",
        setPosition: "window.FastX.Point.setPosition('point-001', [116.401, 39.917, 150])",
        setVisible: "window.FastX.Point.setVisible('point-001', true)",
        show: "window.FastX.Point.show('point-001')",
        hide: "window.FastX.Point.hide('point-001')",
        setDescription: "window.FastX.Point.setDescription('point-001', '点位说明')",
        remove: "window.FastX.Point.remove('point-001')",
        removeBatch: "window.FastX.Point.removeBatch(['point-001', 'point-002'])",
        clear: "window.FastX.Point.clear()",
        pruneInvalid: "window.FastX.Point.pruneInvalid()",
        destroy: "window.FastX.Point.destroy()",
      };
      return examples[methodName] || `window.FastX.Point.${methodName}()`;
    }
    if (doc.group === "draw") {
      if (doc.name === "Overlay") return overlayMethodExample(methodName);
      const target = `window.FastX.${doc.name}`;
      if (/^add/.test(methodName)) {
        if (doc.name === "Path") {
          return `const viewer = window.FastX.getViewer('mapDemo')\nconst trajectory = window.FastX.Trajectory.fromDegrees([\n  { lng: 116.391, lat: 39.907, height: 120, timeSeconds: 0 },\n  { lng: 116.421, lat: 39.917, height: 120, timeSeconds: 60 }\n])\nconst options = ${drawExampleObject(doc.name)}\n\n${target}.${methodName}(viewer, options)`;
        }
        const optionsName = isArrayMethodParam(method) ? "items" : "options";
        const optionsValue = isArrayMethodParam(method)
          ? `[\n${indentCode(drawExampleObject(doc.name, 1), 2)},\n${indentCode(drawExampleObject(doc.name, 2), 2)}\n]`
          : drawExampleObject(doc.name);
        return `const viewer = window.FastX.getViewer('mapDemo')\nconst ${optionsName} = ${optionsValue}\n\n${target}.${methodName}(viewer, ${optionsName})`;
      }
      if (/^update/.test(methodName)) {
        const isBatchUpdate = /^update.+s$/.test(methodName) || isArrayMethodParam(method);
        const properties = isBatchUpdate
          ? `[\n  {\n    id: '${drawBaseName(doc.name).toLowerCase()}-001',\n${indentCode(drawUpdateExampleObject(doc.name).slice(2, -2), 4)}\n  }\n]`
          : drawUpdateExampleObject(doc.name);
        if (isBatchUpdate) {
          return `const updates = ${properties}\n\n${target}.${methodName}(updates)`;
        }
        return `const properties = ${properties}\n\n${target}.${methodName}('${drawBaseName(doc.name).toLowerCase()}-001', properties)`;
      }
      if (/^(getAll|getCount|getIds|getAllIds)$/.test(methodName)) return `const result = ${target}.${methodName}()`;
      if (/^get|^has/.test(methodName)) return `const result = ${target}.${methodName}('${doc.name.toLowerCase()}-001')`;
      if (/^setAll/.test(methodName)) return `${target}.${methodName}(true)`;
      if (/^setSpecifyVisibility/.test(methodName)) return `${target}.${methodName}(['${doc.name.toLowerCase()}-001'], true)`;
      if (/^set/.test(methodName)) return `${target}.${methodName}('${doc.name.toLowerCase()}-001', value)`;
      if (/^show|^hide/.test(methodName)) return `${target}.${methodName}('${doc.name.toLowerCase()}-001')`;
      if (/^removeAll|^clear|^destroy|^pruneInvalid/.test(methodName)) return `${target}.${methodName}()`;
      if (/^remove/.test(methodName)) return `${target}.${methodName}('${doc.name.toLowerCase()}-001')`;
      return `${target}.${methodName}()`;
    }
    if (doc.group === "mount") {
      if (methodName === "installFastXToWindow") return "import { installFastXToWindow } from 'fastx-sdk'\n\ninstallFastXToWindow({ cesiumBaseUrl: '/Cesium/' })";
      if (methodName === "getRegisteredMapNames") return "const names = window.FastX.getRegisteredMapNames()";
      return `const result = window.FastX.${methodName}('mapDemo')`;
    }
    if (doc.group === "layer") {
      if (methodName === "initMap") return "const layer = new window.FastX.Layer()\nawait layer.initMap('map', { mapName: 'mapDemo' })";
      if (/^load/.test(methodName)) {
        const url = methodName.includes("Kml") ? "/json/data.kml" : methodName.includes("Czml") ? "/json/data.czml" : "/json/data.geojson";
        return `const layer = window.FastX.getLayer('mapDemo')\nawait layer.${methodName}('${url}')`;
      }
      if (/^addImagery/.test(methodName)) return `const layer = window.FastX.getLayer('mapDemo')\nlayer.${methodName}('https://example.com/tiles/{z}/{x}/{y}.png')`;
      if (/^set/.test(methodName)) return `const layer = window.FastX.getLayer('mapDemo')\n${methodCall("layer", methodName, method, doc)}`;
      if (/^camera/.test(methodName)) return `const layer = window.FastX.getLayer('mapDemo')\nlayer.${methodName}({ longitude: 116.391, latitude: 39.907, height: 10000 })`;
      return `const layer = window.FastX.getLayer('mapDemo')\n${methodCall("layer", methodName, method, doc)}`;
    }
    if (doc.group === "coordinates") {
      return `const viewer = window.FastX.getViewer('mapDemo')\nconst result = ${methodCall("window.FastX.Coordinates", methodName, method, doc)}`;
    }
    if (doc.group === "event") {
      if (methodName === "destroy") return "mouse.destroy()";
      return `const viewer = window.FastX.getViewer('mapDemo')\nconst mouse = new window.FastX.MouseEvent(viewer)\nmouse.${methodName}({\n  onLeftClick: (payload) => console.log(payload)\n})`;
    }
    if (doc.group === "measure") {
      if (/^bind/.test(methodName) || methodParamsOf(method).some((param) => param.name === "viewer")) {
        return `const viewer = window.FastX.getViewer('mapDemo')\n${methodCall(`window.FastX.${doc.name}`, methodName, method, doc)}`;
      }
      return methodCall(`window.FastX.${doc.name}`, methodName, method, doc);
    }
    if (doc.group === "effects") {
      if (doc.name === "SpecialEffects") return "const { RadiationCircle, ExplosionEffect } = window.FastX.SpecialEffects";
      if (doc.name === "EntityFocusEffect" || doc.name === "entityFocusEffect") {
        if (methodName === "focus") {
          return `${viewerExampleLine()}\n\nwindow.FastX.Utils.entityFocusEffect.focus(viewer, ${effectExampleObject("EntityFocusEffect")})`;
        }
        if (/^update/.test(methodName)) return `window.FastX.Utils.entityFocusEffect.update('entity-focus-001', ${effectUpdateExampleObject("EntityFocusEffect")})`;
        if (/^show/.test(methodName)) return "window.FastX.Utils.entityFocusEffect.show('entity-focus-001', true)";
        if (/^getAllIds/.test(methodName)) return "const ids = window.FastX.Utils.entityFocusEffect.getAllIds()";
        if (/^get/.test(methodName)) return "const entities = window.FastX.Utils.entityFocusEffect.get('entity-focus-001')";
        if (/^remove/.test(methodName)) return "window.FastX.Utils.entityFocusEffect.remove('entity-focus-001')";
        if (/^clear|^destroy/.test(methodName)) return `window.FastX.Utils.entityFocusEffect.${methodName}()`;
      }
      const target = effectApiVariableName(doc.name);
      const id = effectId(doc.name);
      const classRef = `window.FastX.SpecialEffects.${doc.name}`;
      const setup = effectApiSetup(doc, target, classRef);
      if (/^add/.test(methodName)) {
        const optionsName = isArrayMethodParam(method) || doc.name.endsWith("Collection") || methodName === "addMany" ? "items" : "options";
        const optionsValue = optionsName === "items"
          ? `[\n${indentCode(effectExampleObject(doc.name, 1), 2)},\n${indentCode(effectExampleObject(doc.name, 2), 2)}\n]`
          : effectExampleObject(doc.name);
        return `${setup}\nconst ${optionsName} = ${optionsValue}\n\n${target}.${methodName}(${effectAddArgs(doc, methodName, optionsName)})`;
      }
      if (/^update/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\nconst id = ${target}.add(${effectAddArgs(doc, "add", "options")})\nconst nextOptions = ${effectUpdateExampleObject(doc.name)}\n\n${target}.${methodName}(id, nextOptions)`;
      }
      if (/^restart|^play|^pause|^stop/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\nconst id = ${target}.add(${effectAddArgs(doc, "add", "options")})\n\n${target}.${methodName}(id)`;
      }
      if (/^show/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\nconst id = ${target}.add(${effectAddArgs(doc, "add", "options")})\n\n${target}.${methodName}(id, true)`;
      }
      if (/^getAllIds/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\n${target}.add(${effectAddArgs(doc, "add", "options")})\n\nconst ids = ${target}.${methodName}()`;
      }
      if (/^get/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\nconst id = ${target}.add(${effectAddArgs(doc, "add", "options")})\n\nconst result = ${target}.${methodName}(id)`;
      }
      if (/^remove/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\nconst id = ${target}.add(${effectAddArgs(doc, "add", "options")})\n\n${target}.${methodName}(id)`;
      }
      if (/^clear|^destroy/.test(methodName)) {
        return `${setup}\nconst options = ${effectExampleObject(doc.name)}\n${target}.add(${effectAddArgs(doc, "add", "options")})\n\n${target}.${methodName}()`;
      }
      return `${setup}\n${requiredArgs ? `${target}.${methodName}(${requiredArgs})` : `${target}.${methodName}()`}`;
    }
    if (doc.group === "weather") {
      const target = effectApiVariableName(doc.name);
      const classRef = `window.FastX.SpecialEffects.${doc.name}`;
      const setup = `${viewerExampleLine()}\nconst ${target} = new ${classRef}(viewer)`;
      if (/^enable/.test(methodName)) {
        return `${viewerExampleLine()}\nconst ${target} = new ${classRef}(viewer, ${weatherOptionsObject(doc.name)})\n\n${target}.enable()`;
      }
      if (/^update/.test(methodName)) {
        return `${setup}\n\n${target}.update(${weatherOptionsObject(doc.name).replace(/,\n  autoStart: true/, "")})`;
      }
      if (/^show/.test(methodName)) return `${setup}\n${target}.enable()\n\n${target}.show(true)`;
      if (/^disable|^destroy/.test(methodName)) return `${setup}\n${target}.enable()\n\n${target}.${methodName}()`;
      if (/^getStage/.test(methodName)) return `${setup}\n${target}.enable()\n\nconst stage = ${target}.getStage()`;
      return `${setup}\n${requiredArgs ? `${target}.${methodName}(${requiredArgs})` : `${target}.${methodName}()`}`;
    }
    if (doc.group === "plugin" || doc.group === "tools") {
      if (doc.methods.length === 1 && methodNameOf(doc.methods[0]) === doc.name) {
        const callArgs = methodCallArgs(method, doc);
        return packageNamedExports.has(doc.name)
          ? `import { ${doc.name} } from 'fastx-sdk'\n\n${doc.name}(${callArgs})`
          : `window.FastX.${doc.name}(${callArgs})`;
      }
      return requiredArgs ? `${access}.${methodName}(${requiredArgs})` : `${access}.${methodName}()`;
    }
    return doc.usage || (requiredArgs ? `${access}.${methodName}(${requiredArgs})` : `${access}.${methodName}()`);
  }

  function describeMethod(method) {
    const name = methodNameOf(method);
    const description = typeof method === "string" ? "" : cleanDocText(method?.description);
    if (description) return description;
    if (/^init/.test(name)) return "初始化实例或运行环境。";
    if (/^add/.test(name)) return "新增单个或批量对象。";
    if (/^load/.test(name)) return "加载外部数据、插件或资源。";
    if (/^update/.test(name)) return "更新已有对象的属性、样式或数据。";
    if (/^set/.test(name)) return "设置状态、样式、可见性或运行参数。";
    if (/^get/.test(name)) return "获取实例、状态、快照、数量或数据集合。";
    if (/^is/.test(name)) return "判断当前状态。";
    if (/^remove/.test(name)) return "移除指定对象或批量对象。";
    if (/^clear/.test(name)) return "清空当前模块管理的对象。";
    if (/^destroy|dispose$/.test(name)) return "释放资源并解绑内部引用。";
    if (/^show|hide/.test(name)) return "控制对象显示或隐藏。";
    if (/^start|stop|pause|resume/.test(name)) return "控制交互或播放状态。";
    if (/^reset/.test(name)) return "重置到默认状态。";
    if (/^create/.test(name)) return "创建业务对象或测量实例。";
    if (/^bind/.test(name)) return "绑定 Viewer 或上下文。";
    if (/^ensure/.test(name)) return "确保依赖资源已加载。";
    if (/^compute|resolve|normalize|parse/.test(name)) return "工具计算或参数标准化。";
    return "公开 API 方法。";
  }

  function renderCode(code) {
    return `<div class="doc-code-block"><button type="button" class="doc-code-copy" data-copy-code aria-label="复制代码" title="复制代码"></button><pre class="doc-code"><code>${escapeHtml(code)}</code></pre></div>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
