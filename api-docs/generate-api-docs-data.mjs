import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')
const fastxDir = path.join(rootDir, 'src/FastX')
const entryFile = path.join(fastxDir, 'build/entry.ts')
const indexFile = path.join(fastxDir, 'index.ts')
const outDir = path.join(rootDir, 'public/api-docs/data')
const outFile = path.join(outDir, 'api-docs.json')

const groupLabels = {
  mount: '挂载',
  layer: '图层',
  coordinates: '坐标',
  event: '事件',
  draw: '标绘',
  measure: '测量',
  effects: '特效',
  weather: '气象',
  plugin: '插件',
  tools: '工具',
}

const groupOrder = ['mount', 'layer', 'coordinates', 'event', 'draw', 'measure', 'effects', 'weather', 'plugin', 'tools']

const preferredOrder = {
  mount: [
    'installFastXToWindow',
    'FastX',
    'getLayer',
    'getViewer',
    'getMapName',
    'getRegisteredMapNames',
    'registerCesiumXVueComponents',
    'Cesium',
  ],
  layer: ['Layer', 'XMapConfig'],
  coordinates: ['Coordinates', 'createRandomXgxId'],
  event: ['MouseEvent'],
  draw: [
    'Point',
    'PointCollection',
    'Label',
    'LabelCollection',
    'Billboard',
    'BillboardCollection',
    'PolyLine',
    'PolyLineCollection',
    'Polygon',
    'PolygonCollection',
    'Circle',
    'CircleCollection',
    'Rectangle',
    'RectangleCollection',
    'Sector',
    'SectorCollection',
    'Cylinder',
    'CylinderCollection',
    'Corridor',
    'CorridorCollection',
    'Runway',
    'RunwayCollection',
    'Ellipsoid',
    'EllipsoidCollection',
    'Wall',
    'Model',
    'ModelCollection',
    'Box',
    'BoxCollection',
    'Plane',
    'PlaneCollection',
    'Path',
    'PolylineVolume',
    'PolylineVolumeCollection',
    'Overlay',
  ],
  measure: ['Quantitative', 'MeasureType', 'AreaManager', 'Heatmap', 'PointAggregation', 'Trajectory', 'Mover'],
  effects: [
    'SpecialEffects',
    'RadiationCircle',
    'RadiationCircleCollection',
    'CircleDiffusion',
    'CircleDiffusionCollection',
    'ElectronicFence',
    'ElectronicFenceCollection',
    'PolygonDiffusionWall',
    'PolygonDiffusionWallCollection',
    'RadarEmissionWave',
    'RadarEmissionWaveCollection',
    'HemisphereRadarScan',
    'HemisphereRadarScanCollection',
    'AirRadar',
    'AirRadarCollection',
    'SectorArcRadarScan',
    'SectorArcRadarScanCollection',
    'DiffusionRadar',
    'DiffusionRadarCollection',
    'AimEffect',
    'AimEffectCollection',
    'ConeEffect',
    'ConeEffectCollection',
    'ConicalScanner',
    'ConicalScannerCollection',
    'DoubleViewFrustum',
    'DoubleViewFrustumCollection',
    'ParabolaRadar',
    'ParabolaRadarCollection',
    'RingConeScanner',
    'RingConeScannerCollection',
    'RingRadar',
    'RingRadarCollection',
    'ScanRadar',
    'ScanRadarCollection',
    'SquareConeScanner',
    'SquareConeScannerCollection',
    'FireRangeEffect',
    'FireRangeEffectCollection',
    'ParticleSystemEffect',
    'ExplosionEffect',
    'FrameAnimationEffect',
  ],
  weather: ['GlobalRain', 'GlobalSnow', 'GlobalFog'],
  plugin: [
    'ensureVendorPlugins',
    'ensureTurf',
    'ensureHeatmapJs',
    'ensureCesiumNavigation',
    'getTurf',
    'getH337',
    'getCesiumNavigation',
    'VENDOR_MANIFEST',
  ],
  tools: [
    'Utils',
    'Types',
    'EntityFocusEffect',
    'entityFocusEffect',
    'defaultShapeParamsForType',
    'parseShapeTypeKey',
    'resolvePolylineCartesians',
    'computeModelCollectionModelMatrix',
    'normalizePlaneVideoOptions',
    'PlaneMaterialType',
    'PolylineMaterialType',
    'DEFAULT_PLANE_VIDEO',
    'DEFAULT_HEATMAP_STYLE',
    'DEFAULT_HEATMAP_GRADIENT',
    'DEFAULT_POINT_AGGREGATION_STYLE',
    'MEASURE_POINT_RANGE',
    'h337',
    'turf',
  ],
}

const apiMeta = {
  installFastXToWindow: ['挂载 FastX 到 window', '配置包内 Cesium 资源路径，并把 FastX 全局对象挂载到 window。'],
  FastX: ['全局对象', 'FastX SDK 的统一入口，包含 Layer、Coordinates、MouseEvent、Draw 单例、测量、插件和工具能力。'],
  getLayer: ['获取图层实例', '按 mapName 获取已经注册的 Layer 实例；未传 mapName 且只有一个实例时返回该实例。'],
  getViewer: ['获取 Cesium Viewer', '按 mapName 获取 Cesium Viewer，适合业务页面调用标绘或 Cesium 原生 API。'],
  getMapName: ['获取地图名称', '获取当前 Layer 对应的 mapName。'],
  getRegisteredMapNames: ['获取已注册地图名称', '返回当前运行时所有已注册且有效的地图名称。'],
  registerCesiumXVueComponents: ['注册 Vue 组件', '向 Vue App 注册 FastX 内置地图组件。'],
  Cesium: ['内置 Cesium 导出', '从 fastx-sdk 包内导出 Cesium，方便离线环境统一使用同一份 Cesium 运行时。'],
  Layer: ['地图与图层', '负责 Cesium Viewer 初始化、影像图层、地形、数据源、相机、天空盒和地图 UI 控制。'],
  XMapConfig: ['地图组件配置', 'Vue XMap 组件使用的配置类型，封装地图中心、相机、影像、地形、UI 和性能参数。'],
  Coordinates: ['坐标转换', '封装屏幕坐标、世界坐标、经纬度和度分秒之间的转换。'],
  createRandomXgxId: ['随机 ID', '生成带业务前缀的随机 ID，常用于标绘对象 id。'],
  MouseEvent: ['鼠标事件', '封装 Cesium ScreenSpaceEventHandler，提供点击、移动、滚轮、双击和拾取实体能力。'],
  Quantitative: ['测量', '提供距离、面积、高度等交互测量能力，并支持测量结果样式控制。'],
  MeasureType: ['测量类型', '测量能力使用的类型枚举。'],
  AreaManager: ['区域绘制管理', '统一管理点、线、面、圆、矩形等区域绘制发布流程。'],
  Heatmap: ['热力图', '基于 heatmap.js 在 Cesium 场景中创建、更新和清理热力图。'],
  PointAggregation: ['点聚合', '加载点数据或 GeoJSON，并在视距变化时显示聚合效果。'],
  Trajectory: ['轨迹', '封装时间序列关键帧，生成 Cesium SampledPositionProperty。'],
  Mover: ['运动控制', '根据 Trajectory 控制实体运动播放、暂停、恢复、进度跳转和循环。'],
  ensureVendorPlugins: ['预加载插件', '预加载 fastx-sdk 内置 vendor 插件。'],
  ensureTurf: ['加载 Turf', '加载并返回内置 Turf 能力。'],
  ensureHeatmapJs: ['加载 Heatmap', '加载并返回内置 heatmap.js 能力。'],
  ensureCesiumNavigation: ['加载导航插件', '加载 Cesium Navigation 插件。'],
  getTurf: ['获取 Turf', '获取已加载的 Turf 实例。'],
  getH337: ['获取 Heatmap 实例', '获取已加载的 heatmap.js 实例。'],
  getCesiumNavigation: ['获取导航插件', '获取已加载的 Cesium Navigation 插件。'],
  VENDOR_MANIFEST: ['插件清单', 'fastx-sdk 内置 vendor 插件清单。'],
  Utils: ['工具集', 'FastX 工具函数集合。'],
  Types: ['类型集合', 'FastX 类型导出的统一入口，主要用于 TypeScript 类型引用。'],
  EntityFocusEffect: ['实体定位聚焦效果', '基础工具 API，用于快速飞行定位到实体或坐标，并叠加临时聚焦扩散圈。'],
  entityFocusEffect: ['实体定位聚焦实例', 'FastX.Utils 中内置的实体聚焦工具实例，可直接调用 focus、update、show、remove 等方法。'],
  defaultShapeParamsForType: ['默认体线形状参数', '获取 PolylineVolume 指定形状的默认参数。'],
  parseShapeTypeKey: ['解析体线形状', '把字符串形状 key 转成 PolylineVolume 支持的形状类型。'],
  resolvePolylineCartesians: ['解析线坐标', '把线坐标输入统一转换为 Cesium.Cartesian3 数组。'],
  computeModelCollectionModelMatrix: ['计算模型矩阵', '为 ModelCollection 计算模型矩阵，统一处理位置、姿态和缩放。'],
  normalizePlaneVideoOptions: ['标准化平面视频参数', '统一处理 Plane 视频材质配置，兼容新旧参数。'],
  PlaneMaterialType: ['平面材质类型', 'Plane 支持的颜色、图片、视频材质类型枚举。'],
  PolylineMaterialType: ['线材质类型', 'PolyLineCollection 支持的材质类型枚举。'],
  DEFAULT_PLANE_VIDEO: ['平面视频默认配置', 'Plane 视频材质默认配置。'],
  DEFAULT_HEATMAP_STYLE: ['热力图默认样式', 'Heatmap 默认样式配置。'],
  DEFAULT_HEATMAP_GRADIENT: ['热力图默认渐变', 'Heatmap 默认颜色渐变配置。'],
  DEFAULT_POINT_AGGREGATION_STYLE: ['点聚合默认样式', 'PointAggregation 默认点和聚合图形样式。'],
  MEASURE_POINT_RANGE: ['测量点范围', '测量模块使用的点范围默认配置。'],
  h337: ['Heatmap 模块实例', '内置 heatmap.js 模块引用。'],
  turf: ['Turf 模块实例', '内置 Turf 模块引用。'],
}

const drawNames = new Set(preferredOrder.draw)
const effectNames = new Set(preferredOrder.effects)
const weatherNames = new Set(preferredOrder.weather)
for (const name of preferredOrder.draw) {
  const cn = {
    Point: '点',
    PointCollection: '批量点',
    Label: '标签',
    LabelCollection: '批量标签',
    Billboard: '图标',
    BillboardCollection: '批量图标',
    Overlay: '标牌',
    PolyLine: '线',
    PolyLineCollection: '批量线',
    Polygon: '面',
    PolygonCollection: '批量面',
    Circle: '圆',
    CircleCollection: '批量圆',
    Rectangle: '矩形',
    RectangleCollection: '批量矩形',
    Sector: '扇形',
    SectorCollection: '批量扇形',
    Cylinder: '圆柱',
    CylinderCollection: '批量圆柱',
    Corridor: '走廊',
    CorridorCollection: '批量走廊',
    Runway: '跑道',
    RunwayCollection: '批量跑道',
    Ellipsoid: '椭球',
    EllipsoidCollection: '批量椭球',
    Wall: '墙体',
    Model: '模型',
    ModelCollection: '批量模型',
    Box: '盒子',
    BoxCollection: '批量盒子',
    Plane: '平面',
    PlaneCollection: '批量平面',
    Path: '路径',
    PolylineVolume: '体线',
    PolylineVolumeCollection: '批量体线',
  }[name]
  const isCollection = name.endsWith('Collection')
  apiMeta[name] = [
    cn,
    isCollection
      ? `${cn} API，用于批量创建、更新、查询、显隐和清理对应图元集合。`
      : `${cn} API，用于创建、更新、查询、显隐和清理单体标绘对象。`,
  ]
}

const effectCnMap = {
  SpecialEffects: '特效集合',
  RadiationCircle: '辐射圈',
  RadiationCircleCollection: '批量辐射圈',
  CircleDiffusion: '圆扩散',
  CircleDiffusionCollection: '批量圆扩散',
  ElectronicFence: '电子围栏',
  ElectronicFenceCollection: '批量电子围栏',
  PolygonDiffusionWall: '多边形扩散墙',
  PolygonDiffusionWallCollection: '批量多边形扩散墙',
  RadarEmissionWave: '雷达发射波',
  RadarEmissionWaveCollection: '批量雷达发射波',
  HemisphereRadarScan: '半球雷达扫描',
  HemisphereRadarScanCollection: '批量半球雷达扫描',
  AirRadar: '空中扫描雷达',
  AirRadarCollection: '批量空中扫描雷达',
  SectorArcRadarScan: '扇弧形雷达扫描',
  SectorArcRadarScanCollection: '批量扇弧形雷达扫描',
  DiffusionRadar: '扩散雷达',
  DiffusionRadarCollection: '批量扩散雷达',
  AimEffect: '瞄准特效',
  AimEffectCollection: '批量瞄准特效',
  ConeEffect: '圆锥扫描特效',
  ConeEffectCollection: '批量圆锥扫描特效',
  ConicalScanner: '锥体扫描',
  ConicalScannerCollection: '批量锥体扫描',
  DoubleViewFrustum: '双面视锥体',
  DoubleViewFrustumCollection: '批量双面视锥体',
  ParabolaRadar: '抛物面雷达',
  ParabolaRadarCollection: '批量抛物面雷达',
  RingConeScanner: '双圆锥环面扫描体',
  RingConeScannerCollection: '批量双圆锥环面扫描体',
  RingRadar: '环形雷达扫描',
  RingRadarCollection: '批量环形雷达扫描',
  ScanRadar: '扫描雷达',
  ScanRadarCollection: '批量扫描雷达',
  SquareConeScanner: '四方视椎体',
  SquareConeScannerCollection: '批量四方视椎体',
  FireRangeEffect: '火力范围特效',
  FireRangeEffectCollection: '批量火力范围特效',
  ParticleSystemEffect: '粒子系统特效',
  ExplosionEffect: '爆炸效果',
  FrameAnimationEffect: '帧动画特效',
}

for (const [name, cn] of Object.entries(effectCnMap)) {
  const isCollection = name.endsWith('Collection')
  apiMeta[name] = [
    cn,
    name === 'SpecialEffects'
      ? 'FastX 特效模块集合，统一导出空间特效、雷达扫描、视锥体、粒子和帧动画等能力。'
      : isCollection
        ? `${cn} API，用于通过 Primitive 批量创建、更新、查询、显隐和清理对应特效。`
        : `${cn} API，用于创建、更新、查询、显隐和清理单体特效。`,
  ]
}

const weatherCnMap = {
  GlobalRain: '全局雨',
  GlobalSnow: '全局雪',
  GlobalFog: '全局大雾',
}

for (const [name, cn] of Object.entries(weatherCnMap)) {
  apiMeta[name] = [
    cn,
    `${cn} API，用于在 Cesium 场景中启用、禁用、更新和销毁全局气象后处理效果。`,
  ]
}

const sourceCache = new Map()

function readSource(file) {
  const full = path.normalize(file)
  if (!sourceCache.has(full)) {
    sourceCache.set(full, ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true))
  }
  return sourceCache.get(full)
}

function resolveModule(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier.replace(/\.js$/, ''))
  const candidates = [`${base}.ts`, path.join(base, 'index.ts')]
  return candidates.find((item) => fs.existsSync(item)) ?? null
}

function textOf(node, sourceFile) {
  return node ? node.getText(sourceFile) : 'unknown'
}

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === kind))
}

function unwrapExpression(node) {
  let current = node
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(current)))
  ) {
    current = current.expression
  }
  return current
}

function getJSDoc(node) {
  const docs = ts.getJSDocCommentsAndTags(node)
  for (const item of docs) {
    const comment = item.comment
    if (typeof comment === 'string') return comment.replace(/\s+/g, ' ').trim()
  }
  return ''
}

function collectImportMap(file) {
  const source = readSource(file)
  const map = new Map()
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !stmt.moduleSpecifier) continue
    const target = resolveModule(file, stmt.moduleSpecifier.text)
    if (!target) continue
    const clause = stmt.importClause
    if (clause.name) map.set(clause.name.text, { file: target, imported: 'default' })
    const named = clause.namedBindings
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        map.set(el.name.text, { file: target, imported: el.propertyName?.text ?? el.name.text })
      }
    }
  }
  return map
}

function collectLocalTypeExports(file, visited = new Set()) {
  const full = path.normalize(file)
  if (visited.has(full)) return new Map()
  visited.add(full)
  const source = readSource(file)
  const types = new Map()
  for (const stmt of source.statements) {
    if (
      (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) &&
      stmt.name &&
      hasModifier(stmt, ts.SyntaxKind.ExportKeyword)
    ) {
      types.set(stmt.name.text, { file, imported: stmt.name.text })
    }
    if (ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && /^[A-Z]/.test(decl.name.text)) {
          types.set(decl.name.text, { file, imported: decl.name.text })
        }
      }
    }
    if (ts.isExportDeclaration(stmt) && stmt.isTypeOnly && stmt.moduleSpecifier) {
      const target = resolveModule(file, stmt.moduleSpecifier.text)
      if (!target) continue
      if (!stmt.exportClause) {
        for (const [name, record] of collectLocalTypeExports(target, visited)) types.set(name, record)
        continue
      }
      if (ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const name = el.name.text
          types.set(name, { file: target, imported: el.propertyName?.text ?? name })
        }
      }
    }
  }
  return types
}

function collectIndexExports() {
  const source = readSource(indexFile)
  const importMap = collectImportMap(indexFile)
  const values = new Map()
  const types = new Map()

  for (const stmt of source.statements) {
    if (ts.isExportDeclaration(stmt) && !stmt.exportClause && stmt.moduleSpecifier && stmt.isTypeOnly) {
      const target = resolveModule(indexFile, stmt.moduleSpecifier.text)
      if (target) {
        for (const [name, record] of collectLocalTypeExports(target)) types.set(name, record)
      }
      continue
    }

    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      const target = stmt.moduleSpecifier ? resolveModule(indexFile, stmt.moduleSpecifier.text) : null
      for (const el of stmt.exportClause.elements) {
        const name = el.name.text
        const imported = el.propertyName?.text ?? name
        const record = target
          ? { file: target, imported }
          : importMap.get(imported) ?? { file: indexFile, imported }
        if (stmt.isTypeOnly) types.set(name, record)
        else values.set(name, record)
      }
    }

    if (ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) values.set(decl.name.text, { file: indexFile, imported: decl.name.text })
      }
    }

    if (ts.isFunctionDeclaration(stmt) && stmt.name && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      values.set(stmt.name.text, { file: indexFile, imported: stmt.name.text })
    }
  }

  return { values, types, importMap }
}

function collectEntryExports(indexExports) {
  const source = readSource(entryFile)
  const values = new Map()
  const types = new Map(indexExports.types)

  for (const stmt of source.statements) {
    if (ts.isExportDeclaration(stmt) && !stmt.exportClause && stmt.moduleSpecifier && stmt.isTypeOnly) {
      const target = resolveModule(entryFile, stmt.moduleSpecifier.text)
      if (target) {
        for (const [name, record] of collectLocalTypeExports(target)) types.set(name, record)
      }
      continue
    }

    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      if (stmt.isTypeOnly) {
        const target = stmt.moduleSpecifier ? resolveModule(entryFile, stmt.moduleSpecifier.text) : null
        for (const el of stmt.exportClause.elements) {
          types.set(el.name.text, { file: target ?? entryFile, imported: el.propertyName?.text ?? el.name.text })
        }
        continue
      }
      for (const el of stmt.exportClause.elements) {
        const name = el.name.text
        values.set(name, indexExports.values.get(name) ?? { file: entryFile, imported: el.propertyName?.text ?? name })
      }
    }

    if (ts.isFunctionDeclaration(stmt) && stmt.name && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      values.set(stmt.name.text, { file: entryFile, imported: stmt.name.text })
    }
    if (ts.isInterfaceDeclaration(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      types.set(stmt.name.text, { file: entryFile, imported: stmt.name.text })
    }
    if (ts.isExportDeclaration(stmt) && !stmt.exportClause && stmt.moduleSpecifier?.text === '../index.js') {
      for (const [name, record] of indexExports.values) values.set(name, record)
      for (const [name, record] of indexExports.types) types.set(name, record)
    }
  }

  values.set('Cesium', { file: entryFile, imported: 'Cesium' })
  return { values, types }
}

function collectFastXMembers(importMap) {
  const source = readSource(indexFile)
  const members = new Map()

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'FastX' &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer)
      if (!ts.isObjectLiteralExpression(initializer)) return
      for (const prop of initializer.properties) {
        if (ts.isShorthandPropertyAssignment(prop)) {
          const name = prop.name.text
          members.set(name, importMap.get(name) ?? { file: indexFile, imported: name })
        } else if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const name = prop.name.text
          if (ts.isIdentifier(prop.initializer)) {
            members.set(name, importMap.get(prop.initializer.text) ?? { file: indexFile, imported: prop.initializer.text })
          }
        } else if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name)) {
          members.set(prop.name.text, { file: indexFile, imported: prop.name.text, objectMethod: true })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return members
}

function findExportedDeclaration(record, apiName) {
  if (!record?.file || !fs.existsSync(record.file)) return null
  const source = readSource(record.file)
  const imported = record.imported
  const importMap = collectImportMap(record.file)
  let fallbackDefault = null

  for (const stmt of source.statements) {
    if (ts.isClassDeclaration(stmt)) {
      if (stmt.name?.text === imported || stmt.name?.text === apiName) return stmt
      if (hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) fallbackDefault = stmt
    }
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === imported) return stmt
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === imported) return decl
      }
    }
    if ((ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) && stmt.name.text === imported) {
      return stmt
    }
    if (ts.isExportDeclaration(stmt) && !stmt.moduleSpecifier && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text !== imported) continue
        const localName = el.propertyName?.text ?? el.name.text
        const importedRecord = importMap.get(localName)
        if (importedRecord) return findExportedDeclaration(resolveReExport(importedRecord), apiName)
        if (localName !== imported) {
          return findExportedDeclaration({ file: record.file, imported: localName }, apiName)
        }
      }
    }
  }
  return imported === 'default' ? fallbackDefault : null
}

function typeText(node, source) {
  return node.type ? textOf(node.type, source) : 'unknown'
}

const parameterDescriptions = {
  id: '唯一 id，用于查询、更新、显隐或删除指定对象。',
  viewer: 'Cesium Viewer 实例，作为 API 操作地图场景的上下文。',
  options: '创建或配置对象时传入的参数对象。',
  items: '批量创建时传入的对象列表。',
  updates: '批量更新时传入的更新对象列表。',
  properties: '需要写入或覆盖的业务属性数据。',
  patch: '需要局部合并到目标对象上的数据。',
  targetData: '绑定在标绘对象上的业务数据。',
  data: '需要加载、更新或处理的数据。',
  ids: '对象 id 列表，用于批量查询、显隐、更新或删除。',
  mapName: '地图实例名称，用于定位已经注册的 FastX 地图。',
  containerId: '地图容器 DOM id。',
  container: '地图或插件挂载的 DOM 容器。',
  app: 'Vue 应用实例。',
  url: '资源地址，例如 GeoJSON、KML、CZML、模型、图片或服务地址。',
  uri: '模型、图片或外部资源的访问地址。',
  show: '是否显示对象。',
  visible: '是否显示对象。',
  enable: '是否启用当前功能。',
  enabled: '是否启用当前功能。',
  longitude: '经度，单位为度。',
  latitude: '纬度，单位为度。',
  lng: '经度，单位为度。',
  lat: '纬度，单位为度。',
  height: '高度，单位为米。',
  maxHeight: '最大视角高度，单位为米；超过该高度时自动隐藏标牌。',
  altitude: '高度，单位为米。',
  position: '对象所在位置，通常由经度、纬度和高度组成。',
  positions: '对象的坐标点集合，用于线、面、墙体、走廊等多点对象。',
  center: '中心点坐标，通常由经度、纬度和高度组成。',
  point: '点位坐标。',
  points: '点位坐标集合。',
  radius: '半径，单位为米。',
  baseRadius: '圆锥底部半径，单位为米。',
  scanRadius: '扫描环半径，单位为米。',
  coneLineColor: '圆锥母线和底部外圈线颜色。',
  scanLineColor: '扫描环、辅助环和径向线颜色。',
  coneFillColor: '圆锥面填充色。',
  showConeFill: '是否填充圆锥背景。',
  showCone: '是否显示圆锥母线、底部外圈和填充面。',
  showScan: '是否显示扫描环、辅助环和径向线。',
  radii: '椭球三个方向的半径或统一半径。',
  width: '宽度，单位通常为像素或米，具体取决于对应 API。',
  heightSize: '高度尺寸。',
  length: '长度，单位为米。',
  topRadius: '顶部半径，单位为米。',
  bottomRadius: '底部半径，单位为米。',
  dimensions: '三维尺寸或平面尺寸配置。',
  west: '矩形西边界经度，单位为度。',
  south: '矩形南边界纬度，单位为度。',
  east: '矩形东边界经度，单位为度。',
  north: '矩形北边界纬度，单位为度。',
  startAzimuthDegrees: '扇形起始方位角，单位为度。',
  endAzimuthDegrees: '扇形结束方位角，单位为度。',
  headingDegrees: '航向角，单位为度。',
  pitchDegrees: '俯仰角，单位为度。',
  rollDegrees: '翻滚角，单位为度。',
  heading: '航向角。',
  pitch: '俯仰角。',
  roll: '翻滚角。',
  scale: '缩放比例。',
  pixelSize: '点像素大小。',
  color: '主体颜色。',
  fillColor: '填充颜色。',
  fontColor: '文字颜色。',
  backgroundColor: '背景颜色。',
  outline: '是否显示边框。',
  outlineColor: '边框颜色。',
  outlineWidth: '边框宽度。',
  outlineAlpha: '边框透明度。',
  alpha: '透明度，通常取值 0 到 1。',
  showFill: '是否填充面区域。',
  showBackground: '是否显示背景。',
  material: '材质配置。',
  image: '图片地址或图片资源。',
  text: '显示的文本内容。',
  font: '文字字体样式。',
  description: '对象说明信息，通常用于实体详情或业务备注。',
  style: '样式配置。',
  viewHeight: '视角高度显隐配置，用于相机过高时自动隐藏标牌。',
  type: '类型标识，用于区分处理方式或业务类别。',
  name: '名称。',
  value: '需要设置的值。',
  clock: 'Cesium Clock 实例。',
  callback: '回调函数。',
  callbacks: '回调函数配置集合。',
  event: '事件对象或事件配置。',
  time: '时间点。',
  startTime: '开始时间。',
  endTime: '结束时间。',
  duration: '持续时长。',
  durationSeconds: '持续时长，单位为秒。',
  timeSeconds: '相对时间，单位为秒。',
  progress: '播放或执行进度，通常取值 0 到 1。',
  speed: '播放速度或运动倍率。',
  loop: '是否循环播放。',
  playCount: '播放次数。',
  gradient: '渐变色配置。',
  bounds: '地理范围。',
  rectangle: '矩形范围。',
  bbox: '边界范围。',
  source: '数据源或资源来源。',
  layer: '图层实例。',
  layerId: '图层唯一 id。',
  index: '索引位置。',
  count: '数量。',
  size: '尺寸。',
  distance: '距离。',
  angle: '角度。',
  mode: '模式。',
  token: '访问令牌。',
  cesiumBaseUrl: 'Cesium 静态资源根路径。',
  fallbackToken: '没有传入 id 时用于生成 id 的前缀。',
  mapConfig: '地图初始化配置。',
  config: '功能配置对象。',
  params: '参数对象。',
  defaultResetView: '导航控件重置视角时回到的默认相机位置。',
  orientation: '相机或模型的姿态配置，包含航向、俯仰和翻滚。',
  resetTooltip: '重置视角按钮的提示文本。',
  zoomInTooltip: '放大按钮的提示文本。',
  zoomOutTooltip: '缩小按钮的提示文本。',
  ionAccessToken: 'Cesium Ion 访问令牌。',
  performance: '地图性能相关配置。',
  ui: '地图内置 UI 控件显示配置。',
  imageryProviderOptions: '影像服务提供者的创建参数。',
  terrainProviderOptions: '地形服务提供者的创建参数。',
  depthTestAgainstTerrain: '是否开启地形深度检测。',
  viewerOptions: 'Cesium Viewer 初始化参数。',
  wmtsOptions: 'WMTS 影像图层加载参数。',
  wmsOptions: 'WMS 影像图层加载参数。',
  templateOptions: 'UrlTemplate 影像图层加载参数。',
  insert: '影像图层插入位置配置。',
  insertIndex: '影像图层插入索引。',
  czml: 'CZML 数据地址、对象或加载配置。',
  kml: 'KML 数据地址、对象或加载配置。',
  geojson: 'GeoJSON 数据地址、对象或加载配置。',
  destroyImageryProvider: '移除图层时是否同步销毁影像服务提供者。',
  target: '目标图层或图层索引。',
  brightness: '影像亮度。',
  contrast: '影像对比度。',
  saturation: '影像饱和度。',
  gamma: '影像伽马值。',
  filters: '纹理过滤配置。',
  minificationFilter: '纹理缩小时使用的过滤方式。',
  magnificationFilter: '纹理放大时使用的过滤方式。',
  zoomIn: '是否执行放大操作。',
  preset: '内置底图预设类型。',
  cursor: '画布鼠标样式。',
  clientX: '浏览器窗口内的横向像素坐标。',
  clientY: '浏览器窗口内的纵向像素坐标。',
  drawingBufferX: 'Cesium drawingBuffer 内的横向像素坐标。',
  drawingBufferY: 'Cesium drawingBuffer 内的纵向像素坐标。',
  result: '复用的结果对象，用于减少临时对象创建。',
  world: 'Cesium 世界坐标。',
  screen: '屏幕坐标或 drawingBuffer 坐标。',
  longitudeDegrees: '经度，单位为度。',
  latitudeDegrees: '纬度，单位为度。',
  decimalDegrees: '十进制度数。',
  lon: '经度轴的度分秒结构。',
  defaultValue: '默认值。',
  disableDepthTestDistance: '禁用深度检测的距离阈值，用于避免对象被地形遮挡。',
  scaleByDistance: '按相机距离控制缩放比例。',
  translucencyByDistance: '按相机距离控制透明度。',
  distanceDisplayCondition: '按相机距离控制显示范围。',
  areaDraft: '是否按绘制草稿模式处理数据。',
  draftVertices: '绘制草稿阶段的顶点列表。',
  backgroundPadding: '文字背景内边距。',
  pixelOffset: '屏幕像素偏移量。',
  horizontalOrigin: '水平方向对齐方式。',
  verticalOrigin: '垂直方向对齐方式。',
  eyeOffset: '相机视角方向上的偏移量。',
  rotation: '旋转角度。',
  alignedAxis: '图标对齐轴。',
  sizeInMeters: '尺寸是否按米计算。',
  pixelOffsetScaleByDistance: '按相机距离控制像素偏移缩放。',
  svg: 'SVG 字符串或资源内容。',
  rotationDegrees: '旋转角度，单位为度。',
  lineKind: '线类型。',
  clampToGround: '是否贴地绘制。',
  arcType: '弧线插值方式。',
  cornerType: '拐角连接方式。',
  granularity: '几何插值粒度，数值越小边缘越细腻但计算量更高。',
  depthFailMaterial: '被地形遮挡时使用的线材质。',
  shadows: '阴影模式。',
  classificationType: '分类渲染类型。',
  zIndex: '贴地对象绘制层级，数值越大越靠上。',
  dashed: '虚线材质配置。',
  dashLength: '虚线单段长度。',
  dashPattern: '虚线样式位掩码。',
  glowing: '发光线材质配置。',
  glowPower: '发光强度。',
  glowColor: '发光颜色。',
  trail: '轨迹线材质配置。',
  leadTime: '路径前向显示时长。',
  trailTime: '路径后向显示时长。',
  resolution: '采样或渲染分辨率。',
  shapeType: '体线截面形状类型。',
  shapeParams: '体线截面形状参数。',
  shapePositions: '体线截面坐标点。',
  near: '近距离阈值。',
  far: '远距离阈值。',
  nearValue: '近距离对应值。',
  farValue: '远距离对应值。',
  viewer: 'Cesium Viewer 实例，通常通过 window.FastX.getLayer().viewer 获取。',
  visible: '是否显示当前特效。',
  position: '特效中心点或发射点坐标，支持 Cesium.Cartesian3、经纬高数组或经纬高对象。',
  positions: '特效顶点坐标集合，支持 Cesium.Cartesian3、经纬高数组或经纬高对象。',
  source: '特效起点坐标。',
  target: '特效目标点坐标。',
  center: '特效中心点坐标。',
  color: '特效主体颜色。',
  fillColor: '特效填充面颜色。',
  outlineColor: '特效轮廓线颜色。',
  lineColor: '特效线框颜色。',
  scanColor: '扫描光束或扫描面的颜色。',
  innerDomeHeight: '内环弧形隆起高度，单位为米。',
  outerDomeHeight: '外环弧形隆起高度，单位为米。',
  innerSurfaceColor: '内环弧面颜色。',
  innerSurfaceAlpha: '内环弧面透明度，范围 0 到 1。',
  innerGridColor: '内环网格线颜色。',
  innerGridAlpha: '内环网格线透明度，范围 0 到 1。',
  outerSurfaceColor: '外环弧面颜色。',
  outerSurfaceAlpha: '外环弧面透明度，范围 0 到 1。',
  outerGridColor: '外环网格线颜色。',
  outerGridAlpha: '外环网格线透明度，范围 0 到 1。',
  scanBladeColor: '扫描叶片颜色。',
  scanBladeAlpha: '扫描叶片透明度，范围 0 到 1。',
  scanBladeAngle: '扫描叶片角宽，单位为度。',
  scanSpeed: '扫描旋转速度，单位为度/秒。',
  scanBlink: '是否启用扫描叶片闪烁。',
  gridLineWidth: '网格线宽度，单位为像素。',
  outerColor: '外环三维环带颜色。',
  outerAlpha: '外环三维环带透明度。',
  outerLineColor: '外环网格线颜色。',
  outerLineAlpha: '外环网格线透明度。',
  innerColor: '内环三维环带颜色。',
  innerAlpha: '内环三维环带透明度。',
  innerLineColor: '内环网格线颜色。',
  innerLineAlpha: '内环网格线透明度。',
  scanAlpha: '扫描叶片透明度。',
  lineWidth: '轮廓线宽度，单位为像素。',
  segments: '几何分段数，数值越大弧线和曲面越平滑。',
  heading: '航向角，单位为度。',
  pitch: '俯仰角，单位为度。',
  roll: '翻滚角，单位为度。',
  scale: '整体缩放比例。',
  length: '特效探测长度或视锥深度，单位为米。',
  radius: '半径，单位为米。',
  maxRadius: '最大扩散半径，单位为米。',
  minRadius: '初始扩散半径，单位为米。',
  bottomRadius: '锥体底面半径，单位为米。',
  topRadius: '锥体顶面半径，单位为米。',
  innerRadius: '内部辅助环半径，单位为米。',
  outerRadius: '外部半径，单位为米。',
  outerHeight: '外环三维环带高度，单位为米。',
  innerHeight: '内环三维环带高度，单位为米。',
  horizontalSegments: '水平插值点数，数值越大曲面越圆滑。',
  verticalSegments: '垂直插值点数，数值越大环带网格越密。',
  bladeAngle: '扫描叶片角宽，单位为度。',
  blink: '是否启用扫描叶片闪烁。',
  baseRadius: '圆锥底部半径，单位为米。',
  scanRadius: '扫描环半径，单位为米。',
  coneLineColor: '圆锥母线和底部外圈线颜色。',
  scanLineColor: '扫描环、辅助环和径向线颜色。',
  coneFillColor: '圆锥面填充色。',
  showConeFill: '是否填充圆锥背景。',
  showCone: '是否显示圆锥母线、底部外圈和填充面。',
  showScan: '是否显示扫描环、辅助环和径向线。',
  height: '特效高度，单位为米。',
  width: '宽度，单位为米或像素，按对应 API 说明确定。',
  depth: '深度，单位为米。',
  angle: '张角或扫描角度，单位为度。',
  startAngle: '起始角度，单位为度。',
  endAngle: '结束角度，单位为度。',
  startAzimuth: '起始方位角，单位为度。',
  endAzimuth: '结束方位角，单位为度。',
  fov: '视场角，单位为度。',
  nearDistance: '近裁剪距离或近端距离，单位为米。',
  farDistance: '远裁剪距离或远端距离，单位为米。',
  fill: '是否渲染半透明填充面。',
  show: '是否显示当前特效。',
  maximumHeights: '墙体每个顶点的最大高度数组，单位为米。',
  minimumHeights: '墙体每个顶点的最小高度数组，单位为米。',
  image: '粒子或动态材质使用的图片资源地址。',
  framePath: '帧动画图片目录，目录下图片按编号顺序组织。',
  frameCount: '帧动画图片总数量。',
  extension: '帧动画图片扩展名。',
  startIndex: '帧动画起始图片编号。',
  filePrefix: '帧动画图片文件名前缀。',
  fileSuffix: '帧动画图片文件名后缀。',
  framePadding: '帧动画图片编号补零位数。',
  autoPlay: '创建后是否自动播放动画。',
  lifeTime: '爆炸等一次性特效的总生命周期，单位为秒。',
  emissionRate: '粒子系统每秒发射的粒子数量。',
  emitter: '粒子发射器配置。',
  offset: '发射器局部偏移，单位为米。',
  bursts: '粒子系统生命周期内的爆发配置。',
  startScale: '粒子出生时的缩放比例。',
  endScale: '粒子消失时的缩放比例。',
  startColor: '粒子出生时颜色。',
  endColor: '粒子消失时颜色。',
  imageSize: '粒子图片固定尺寸，单位为像素。',
  minImageSize: '粒子图片最小尺寸，单位为像素。',
  maxImageSize: '粒子图片最大尺寸，单位为像素。',
  minSpeed: '粒子最小速度，单位为米/秒。',
  maxSpeed: '粒子最大速度，单位为米/秒。',
  lifetime: '粒子系统发射持续时间，单位为秒。',
  particleLife: '单个粒子的固定生命周期，单位为秒。',
  minLife: '单个粒子的最小生命周期，单位为秒。',
  maxLife: '单个粒子的最大生命周期，单位为秒。',
  mass: '粒子质量，单位为千克。',
  minMass: '粒子最小质量，单位为千克。',
  maxMass: '粒子最大质量，单位为千克。',
  visibleDistance: '粒子系统可见距离范围。',
  updateCallback: '粒子逐帧更新回调，可用于添加重力、风向等外力。',
  tiltAngle: '雨丝倾斜角度。',
  rainSize: '雨丝尺寸，数值越大雨丝越明显。',
  rainSpeed: '雨丝移动速度。',
  snowSize: '雪花尺寸，数值越大雪花越明显。',
  snowSpeed: '雪花下落速度。',
  fogDensity: '雾效浓度。',
  autoStart: '创建实例后是否立即启用效果。',
  entity: '需要聚焦的 Cesium Entity。',
  entityId: '需要聚焦的实体 id。',
  ringCount: '聚焦圈数量。',
  flyTo: '是否同步执行相机飞行。',
  range: '相机飞行后距离目标中心的范围，单位为米。',
  flyDuration: '相机飞行时长，单位为秒。',
  removeOnComplete: '动画结束后是否自动移除临时聚焦效果。',
}

function parameterLeafName(name) {
  return String(name || '').split('.').filter(Boolean).pop() || String(name || '')
}

function isGeneratedDescription(description) {
  return / 的 .+ 字段。$/.test(description) || / 方法的 .+ 参数。$/.test(description) || / 项的 .+ 字段。$/.test(description)
}

function describeParameter(name, typeName, fallback = '') {
  const leaf = parameterLeafName(name)
  const description = String(fallback || '').trim()
  if (description && !isGeneratedDescription(description)) return description
  if (parameterDescriptions[leaf]) return parameterDescriptions[leaf]
  if (/^on[A-Z]/.test(leaf)) return `${leaf} 回调函数，在对应交互事件触发时执行。`
  if (/tooltip$/i.test(leaf)) return '按钮提示文本。'
  if (/providerOptions$/i.test(leaf)) return '服务提供者创建参数。'
  if (/options$|config$|params$/i.test(leaf)) return '配置对象。'
  if (/color/i.test(leaf)) return '颜色配置。'
  if (/alpha|opacity/i.test(leaf)) return '透明度配置，通常取值 0 到 1。'
  if (/width/i.test(leaf)) return '宽度配置。'
  if (/height/i.test(leaf)) return '高度配置。'
  if (/radius/i.test(leaf)) return '半径配置。'
  if (/position/i.test(leaf)) return '位置坐标配置。'
  if (/url|uri|src/i.test(leaf)) return '资源访问地址。'
  if (/show|visible|enable/i.test(leaf)) return '显示或启用状态。'
  if (/id$/i.test(leaf)) return '唯一 id。'
  if (/boolean/i.test(typeName || '')) return `${leaf} 开关状态。`
  if (/number/i.test(typeName || '')) return `${leaf} 数值配置。`
  if (/string/i.test(typeName || '')) return `${leaf} 文本配置。`
  return `${leaf} 配置项。`
}

function getParams(params, source) {
  return params.map((param) => ({
    name: textOf(param.name, source),
    type: typeText(param, source),
    optional: Boolean(param.questionToken || param.initializer),
    defaultValue: param.questionToken || param.initializer ? '-' : '必填',
    description: getJSDoc(param),
  }))
}

function methodFromDeclaration(name, node, source) {
  return {
    name,
    params: getParams(node.parameters ?? [], source),
    returnType: typeText(node, source),
    description: getJSDoc(node),
  }
}

function findTopLevelDeclaration(source, imported) {
  let fallbackDefault = null
  for (const stmt of source.statements) {
    if (ts.isClassDeclaration(stmt)) {
      if (stmt.name?.text === imported) return stmt
      if (hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) fallbackDefault = stmt
    }
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === imported) return stmt
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === imported) return decl
      }
    }
    if ((ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) && stmt.name.text === imported) {
      return stmt
    }
  }
  return imported === 'default' ? fallbackDefault : null
}

function resolveReExport(record, visited = new Set()) {
  if (!record?.file || !fs.existsSync(record.file)) return record
  const key = `${record.file}:${record.imported}`
  if (visited.has(key)) return record
  visited.add(key)

  const source = readSource(record.file)
  for (const stmt of source.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) continue
    for (const el of stmt.exportClause.elements) {
      if (el.name.text !== record.imported) continue
      const imported = el.propertyName?.text ?? el.name.text
      if (stmt.moduleSpecifier) {
        const target = resolveModule(record.file, stmt.moduleSpecifier.text)
        return target ? resolveReExport({ file: target, imported }, visited) : record
      }
      return resolveReExport({ file: record.file, imported }, visited)
    }
  }
  return record
}

function collectMethods(apiName, record) {
  if (record?.objectMethod) return collectFastXObjectMethod(apiName)
  record = resolveReExport(record)
  const decl = findExportedDeclaration(record, apiName)
  if (!decl) return []
  const source = decl.getSourceFile()

  if (ts.isFunctionDeclaration(decl)) return [methodFromDeclaration(apiName, decl, source)]

  if (ts.isVariableDeclaration(decl)) {
    const initializer = decl.initializer ? unwrapExpression(decl.initializer) : null
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return [methodFromDeclaration(apiName, initializer, source)]
    }
    if (initializer && ts.isObjectLiteralExpression(initializer)) {
      const methods = []
      for (const prop of initializer.properties) {
        if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name)) {
          methods.push(methodFromDeclaration(prop.name.text, prop, source))
          continue
        }
        if (ts.isShorthandPropertyAssignment(prop)) {
          const target = findTopLevelDeclaration(source, prop.name.text)
          if (target && ts.isFunctionDeclaration(target)) {
            methods.push(methodFromDeclaration(prop.name.text, target, source))
          }
        }
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && ts.isIdentifier(prop.initializer)) {
          const target = findTopLevelDeclaration(source, prop.initializer.text)
          if (target && ts.isFunctionDeclaration(target)) {
            methods.push(methodFromDeclaration(prop.name.text, target, source))
          }
        }
      }
      return methods
    }
    return []
  }

  if (ts.isClassDeclaration(decl)) {
    const methods = []
    for (const member of decl.members) {
      if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name)) continue
      if (hasModifier(member, ts.SyntaxKind.PrivateKeyword) || hasModifier(member, ts.SyntaxKind.ProtectedKeyword)) continue
      methods.push(methodFromDeclaration(member.name.text, member, source))
    }
    return methods
  }

  return []
}

function createSyntheticMethod(name, params, returnType, description) {
  return { name, params, returnType, description }
}

function createSyntheticParam(name, type, required = true, description = '') {
  return {
    name,
    type,
    optional: !required,
    defaultValue: required ? '必填' : '-',
    description,
  }
}

function isWeatherApi(name) {
  return weatherNames.has(name)
}

function isSpecialEffectApi(name) {
  return effectNames.has(name) || isWeatherApi(name)
}

function addMethodIfMissing(methods, method) {
  const matches = methods.filter((item) => item.name === method.name)
  if (!matches.length) {
    methods.push(method)
    return
  }
  for (const item of matches) {
    if (!item.description && method.description) item.description = method.description
    if (!item.returnType && method.returnType) item.returnType = method.returnType
  }
}

function methodRank(method, apiName = '') {
  const params = method.params ?? []
  const names = params.map((param) => param.name).join(',')
  if (names.includes('viewerOrOptions') || names.includes('maybeOptions')) return 0
  if (isSpecialEffectApi(apiName) && !apiName.endsWith('Collection')) {
    if (params.length === 1 && params[0].name === 'options') return 4
    if (params.some((param) => param.name === 'viewer') && params.some((param) => param.name === 'options')) return 3
  }
  if (params.some((param) => param.name === 'viewer') && params.some((param) => param.name === 'options')) return 3
  if (params.length === 1 && params[0].name === 'options') return 2
  return 1
}

function dedupeMethods(methods, apiName = '') {
  const map = new Map()
  for (const method of methods) {
    const current = map.get(method.name)
    if (!current) {
      map.set(method.name, method)
      continue
    }
    const merged = {
      ...method,
      description: method.description || current.description,
      returnType: method.returnType || current.returnType,
    }
    if (methodRank(method, apiName) > methodRank(current, apiName)) {
      map.set(method.name, merged)
    } else if (!current.description && method.description) {
      map.set(method.name, { ...current, description: method.description })
    }
  }
  return [...map.values()]
}

function firstTypeBySuffix(types, suffix) {
  return types.find((type) => type.endsWith(suffix))
}

function defaultAddType(apiName, types) {
  return firstTypeBySuffix(types, 'AddOptions') ?? `${apiName.replace(/Collection$/, '')}AddOptions`
}

function defaultUpdateType(apiName, types) {
  return firstTypeBySuffix(types, 'UpdateOptions') ?? `${apiName.replace(/Collection$/, '')}UpdateOptions`
}

function enrichSpecialEffectMethods(apiName, methods, types) {
  if (!isSpecialEffectApi(apiName) || apiName === 'SpecialEffects' || apiName === 'entityFocusEffect') return methods
  const enriched = [...methods]
  const addType = defaultAddType(apiName, types)
  const updateType = defaultUpdateType(apiName, types)
  const isCollection = apiName.endsWith('Collection')

  if (apiName === 'GlobalRain' || apiName === 'GlobalSnow' || apiName === 'GlobalFog') {
    const optionType = firstTypeBySuffix(types, 'Options') ?? `${apiName}Options`
    addMethodIfMissing(enriched, createSyntheticMethod('enable', [], 'Cesium.PostProcessStage', '启用全局气象特效。'))
    addMethodIfMissing(enriched, createSyntheticMethod('disable', [], 'void', '禁用全局气象特效但保留内部 Stage。'))
    addMethodIfMissing(enriched, createSyntheticMethod('show', [createSyntheticParam('visible', 'boolean', true)], 'void', '设置全局气象特效显隐。'))
    addMethodIfMissing(enriched, createSyntheticMethod('update', [createSyntheticParam('options', `Omit<${optionType}, "autoStart">`, true)], 'void', '更新全局气象特效参数。'))
    addMethodIfMissing(enriched, createSyntheticMethod('getStage', [], 'Cesium.PostProcessStage | null', '获取当前后处理 Stage。'))
    addMethodIfMissing(enriched, createSyntheticMethod('destroy', [], 'void', '移除并销毁全局气象特效。'))
    return enriched
  }

  if (apiName === 'FrameAnimationEffect') {
    addMethodIfMissing(enriched, createSyntheticMethod('add', [createSyntheticParam('viewer', 'Cesium.Viewer'), createSyntheticParam('options', addType)], 'string | undefined', '新增帧动画特效。'))
    addMethodIfMissing(enriched, createSyntheticMethod('addMany', [createSyntheticParam('viewer', 'Cesium.Viewer'), createSyntheticParam('options', `${addType}[]`)], 'string[]', '批量新增帧动画特效。'))
    addMethodIfMissing(enriched, createSyntheticMethod('update', [createSyntheticParam('id', 'string'), createSyntheticParam('options', updateType)], 'boolean', '更新指定帧动画特效。'))
    addMethodIfMissing(enriched, createSyntheticMethod('play', [createSyntheticParam('id', 'string')], 'boolean', '播放或继续播放指定帧动画。'))
    addMethodIfMissing(enriched, createSyntheticMethod('pause', [createSyntheticParam('id', 'string')], 'boolean', '暂停指定帧动画。'))
    addMethodIfMissing(enriched, createSyntheticMethod('stop', [createSyntheticParam('id', 'string')], 'boolean', '停止指定帧动画并回到第一帧。'))
  } else if (apiName === 'ParticleSystemEffect' || apiName === 'ExplosionEffect') {
    addMethodIfMissing(enriched, createSyntheticMethod('add', [createSyntheticParam('viewer', 'Cesium.Viewer'), createSyntheticParam('options', addType)], 'string | undefined', `新增${apiMeta[apiName]?.[0] ?? apiName}。`))
    addMethodIfMissing(enriched, createSyntheticMethod('addMany', [createSyntheticParam('viewer', 'Cesium.Viewer'), createSyntheticParam('options', `${addType}[]`)], 'string[]', `批量新增${apiMeta[apiName]?.[0] ?? apiName}。`))
    addMethodIfMissing(enriched, createSyntheticMethod('update', [createSyntheticParam('id', 'string'), createSyntheticParam('options', updateType)], 'boolean', `更新指定${apiMeta[apiName]?.[0] ?? apiName}。`))
    addMethodIfMissing(enriched, createSyntheticMethod('restart', [createSyntheticParam('id', 'string')], 'boolean', '重新播放非循环粒子特效。'))
  } else if (apiName === 'CircleDiffusion') {
    addMethodIfMissing(enriched, createSyntheticMethod('add', [createSyntheticParam('options', addType)], 'string', '新增圆扩散特效。'))
    addMethodIfMissing(enriched, createSyntheticMethod('update', [createSyntheticParam('id', 'string'), createSyntheticParam('options', updateType)], 'boolean', '更新指定圆扩散特效。'))
  } else {
    addMethodIfMissing(enriched, createSyntheticMethod('add', [createSyntheticParam('viewer', 'Cesium.Viewer'), createSyntheticParam('options', isCollection ? `${addType}[]` : addType)], isCollection ? 'string[]' : 'string | undefined', `新增${apiMeta[apiName]?.[0] ?? apiName}。`))
    addMethodIfMissing(enriched, createSyntheticMethod('update', [createSyntheticParam('id', 'string'), createSyntheticParam('options', updateType)], 'boolean', `更新指定${apiMeta[apiName]?.[0] ?? apiName}。`))
  }

  addMethodIfMissing(enriched, createSyntheticMethod('show', [createSyntheticParam('id', 'string'), createSyntheticParam('visible', 'boolean')], 'boolean', `设置指定${apiMeta[apiName]?.[0] ?? apiName}显隐。`))
  addMethodIfMissing(enriched, createSyntheticMethod('get', [createSyntheticParam('id', 'string')], 'Cesium.Entity[] | Cesium.Primitive[] | Cesium.Entity | Cesium.ParticleSystem | undefined', `获取指定${apiMeta[apiName]?.[0] ?? apiName}实例。`))
  addMethodIfMissing(enriched, createSyntheticMethod('getAllIds', [createSyntheticParam('viewer', 'Cesium.Viewer', false)], 'string[]', '获取当前管理的全部特效 id。'))
  addMethodIfMissing(enriched, createSyntheticMethod('remove', [createSyntheticParam('id', 'string')], 'boolean', `删除指定${apiMeta[apiName]?.[0] ?? apiName}。`))
  addMethodIfMissing(enriched, createSyntheticMethod('clear', [createSyntheticParam('viewer', 'Cesium.Viewer', false)], 'void', '清空当前类管理的全部特效。'))
  addMethodIfMissing(enriched, createSyntheticMethod('destroy', [], 'void', '销毁当前类管理的全部特效并释放资源。'))
  return dedupeMethods(enriched, apiName)
}

function collectFastXObjectMethod(name) {
  const source = readSource(indexFile)
  const methods = []
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'FastX' &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer)
      if (!ts.isObjectLiteralExpression(initializer)) return
      for (const prop of initializer.properties) {
        if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name) && prop.name.text === name) {
          methods.push(methodFromDeclaration(name, prop, source))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return methods
}

function membersFromPropertySignatures(members, source) {
  return members
    .filter((member) => ts.isPropertySignature(member) && member.name)
    .map((member) => ({
      name: textOf(member.name, source),
      type: typeText(member, source),
      optional: Boolean(member.questionToken),
      defaultValue: member.questionToken ? '-' : '必填',
      description: getJSDoc(member),
    }))
}

function getReferencedTypeName(node) {
  if (!node) return null
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) return node.typeName.text
  if (ts.isArrayTypeNode(node)) return getReferencedTypeName(node.elementType)
  if (ts.isTypeOperatorNode(node)) return getReferencedTypeName(node.type)
  return null
}

function omittedKeysFromType(typeName) {
  const omitted = new Set()
  const match = String(typeName || '').match(/\bOmit\s*<[^,]+,\s*([^>]+)>/)
  if (!match) return omitted
  for (const item of match[1].split('|')) {
    const key = item.trim().replace(/^['"`]|['"`]$/g, '')
    if (key) omitted.add(key)
  }
  return omitted
}

function collectTypeMembers(typeName, typeExports, visited = new Set()) {
  const normalized = normalizeTypeName(typeName)
  if (!normalized) return []
  if (visited.has(normalized)) return []
  visited.add(normalized)

  const record = resolveReExport(typeExports.get(normalized))
  const decl = findExportedDeclaration(record, typeName)
  if (!decl || !record?.file) return []
  const source = decl.getSourceFile()
  if (ts.isTypeAliasDeclaration(decl) && decl.type && ts.isTypeLiteralNode(decl.type)) {
    return membersFromPropertySignatures(decl.type.members, source)
  }
  if (ts.isTypeAliasDeclaration(decl) && decl.type && (ts.isUnionTypeNode(decl.type) || ts.isIntersectionTypeNode(decl.type))) {
    const rows = []
    const seen = new Set()
    for (const typeNode of decl.type.types) {
      const refName = getReferencedTypeName(typeNode)
      if (!refName) continue
      for (const member of collectTypeMembers(refName, typeExports, new Set(visited))) {
        const key = `${member.name}:${member.type}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(member)
      }
    }
    return rows
  }
  if (ts.isTypeAliasDeclaration(decl) && decl.type) {
    const refName = getReferencedTypeName(decl.type)
    return refName ? collectTypeMembers(refName, typeExports, visited) : []
  }
  if (!ts.isInterfaceDeclaration(decl)) return []
  const rows = []
  const seen = new Set()
  for (const clause of decl.heritageClauses ?? []) {
    for (const item of clause.types ?? []) {
      const refName = getReferencedTypeName(item.expression)
      if (!refName) continue
      for (const member of collectTypeMembers(refName, typeExports, new Set(visited))) {
        const key = `${member.name}:${member.type}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(member)
      }
    }
  }
  for (const member of membersFromPropertySignatures(decl.members, source)) {
    const key = `${member.name}:${member.type}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(member)
  }
  return rows
}

function normalizeTypeName(typeName) {
  return String(typeName || '')
    .replace(/^readonly\s+/, '')
    .replace(/\[\]$/, '')
    .replace(/^Array<(.+)>$/, '$1')
    .trim()
}

function shouldExpandType(typeName, depth) {
  if (depth >= 3) return false
  return /Options|Properties|Params|Config|Style|Input|Callbacks/.test(normalizeTypeName(typeName))
}

function collectExpandedTypeRows(prefix, typeName, typeExports, depth = 0, visited = new Set()) {
  const normalized = normalizeTypeName(typeName)
  if (!shouldExpandType(normalized, depth)) return []
  const key = `${prefix}:${normalized}:${depth}`
  if (visited.has(key)) return []
  visited.add(key)

  const rows = []
  const omittedKeys = omittedKeysFromType(normalized)
  if (/\{\s*id\s*:\s*string\s*\}/.test(normalized)) {
    rows.push({
      name: `${prefix}.id`,
      type: 'string',
      defaultValue: '必填',
      description: describeParameter('id', 'string'),
    })
  }

  const referenceNames = [...normalized.matchAll(/\b[A-Za-z_$][\w$]*(?:Options|Properties|Params|Config|Style|Input|Callbacks)\b/g)].map(
    (match) => match[0],
  )
  const typeNames = referenceNames.length && !typeExports.has(normalized) ? referenceNames : [normalized]

  for (const typeName of typeNames) {
    for (const member of collectTypeMembers(typeName, typeExports)) {
      if (omittedKeys.has(member.name)) continue
      const name = `${prefix}.${member.name}`
      rows.push({
        name,
        type: member.type,
        defaultValue: member.defaultValue,
        description: describeParameter(member.name, member.type, member.description),
      })
      rows.push(...collectExpandedTypeRows(name, member.type, typeExports, depth + 1, visited))
    }
  }
  return rows
}

function relatedTypes(apiName, typeExports) {
  const result = []
  const baseName = apiName.replace(/Collection$/, '')
  for (const name of typeExports.keys()) {
    if (
      name === apiName ||
      name.includes(apiName) ||
      name.includes(baseName) ||
      name.startsWith(`Add${apiName}`) ||
      name.startsWith(`Update${apiName}`) ||
      (apiName.endsWith('Collection') && name.includes(apiName.replace(/Collection$/, 'Collection')))
    ) {
      result.push(name)
    }
  }
  return [...new Set(result)].sort()
}

function normalizeParameterRows(rows) {
  return rows.map((row) => {
    const isDefaultShow =
      row.name === 'add.options.show' && /默认\s*true/i.test(`${row.description ?? ''} ${row.defaultValue ?? ''}`)
    return {
      ...row,
      defaultValue: row.defaultValue === '必填' ? '必填' : isDefaultShow ? 'true' : '-',
      description: describeParameter(row.name, row.type, row.description),
    }
  })
}

function parameterRows(apiName, methods, types, typeExports) {
  if (apiName === 'SpecialEffects') return []
  const rows = []
  const seen = new Set()

  function push(row) {
    const key = `${row.name}:${row.type}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push(row)
  }

  for (const method of methods) {
    for (const param of method.params) {
      push({
        name: `${method.name}.${param.name}`,
        type: param.type,
        defaultValue: param.defaultValue,
        description: describeParameter(param.name, param.type, param.description),
      })
      if (shouldExpandType(param.type, 0)) {
        for (const row of collectExpandedTypeRows(`${method.name}.${param.name}`, param.type, typeExports)) {
          push(row)
        }
      }
    }
  }

  if (!rows.length) {
    for (const typeName of types.slice(0, 3)) {
      for (const member of collectTypeMembers(typeName, typeExports)) {
        push({
          name: member.name,
          type: member.type,
          defaultValue: member.defaultValue,
          description: describeParameter(member.name, member.type, member.description),
        })
      }
    }
  }

  return normalizeParameterRows(rows)
}

function groupFor(name) {
  if (name === 'EntityFocusEffect' || name === 'entityFocusEffect') return 'tools'
  for (const [groupId, names] of Object.entries(preferredOrder)) {
    if (names.includes(name)) return groupId
  }
  if (drawNames.has(name)) return 'draw'
  if (weatherNames.has(name) || /^Global(Rain|Snow|Fog)/.test(name)) return 'weather'
  if (effectNames.has(name) || /Effect|Radar|Scanner|Frustum|Fence|Diffusion|Radiation|Particle|Explosion|FrameAnimation/.test(name)) return 'effects'
  return 'tools'
}

function accessFor(name, groupId, packageNames) {
  if (name === 'installFastXToWindow') return "import { installFastXToWindow } from 'fastx-sdk'"
  if (name === 'Cesium') return "import { Cesium } from 'fastx-sdk'"
  if (packageNames.has(name) && groupId !== 'draw' && groupId !== 'measure') return `import { ${name} } from 'fastx-sdk'`
  return `window.FastX.${name}`
}

function usageFor(name, groupId) {
  if (name === 'installFastXToWindow') return "import { installFastXToWindow } from 'fastx-sdk'\ninstallFastXToWindow({ cesiumBaseUrl: '/Cesium/' })"
  if (name === 'Layer') return "const layer = new FastX.Layer()\nawait layer.initMap('map', { mapName: 'mapDemo' })"
  if (drawNames.has(name)) {
    const addMethod = name.endsWith('Collection') ? `add${name.replace('Collection', 's')}` : 'add'
    return `const viewer = window.FastX.getLayer().viewer\nwindow.FastX.${name}.${addMethod}(viewer, options)`
  }
  if (groupId === 'effects') {
    const baseName = name.replace(/Collection$/, '')
    const isCollection = name.endsWith('Collection')
    const constructorArgs = isCollection ? '' : 'viewer'
    const addArgs = isCollection ? 'viewer, options' : 'options'
    let options = "{ position: { longitude: 116.391, latitude: 39.907, height: 120 } }"
    if (baseName === 'ElectronicFence') {
      options = "{ positions: [{ longitude: 116.391, latitude: 39.907, height: 0 }, { longitude: 116.421, latitude: 39.917, height: 0 }, { longitude: 116.411, latitude: 39.887, height: 0 }], height: 500 }"
    }
    if (baseName === 'PolygonDiffusionWall') {
      options = "{ center: { longitude: 116.391, latitude: 39.907, height: 0 }, radius: 1000, edge: 5, height: 200, speed: 15, minRadius: 50 }"
    }
    if (baseName === 'RadarEmissionWave') {
      options = "{ position: { longitude: 116.391, latitude: 39.907, height: 1200 }, color: '#00FFFF', length: 500000, bottomRadius: 50000 }"
    }
    if (baseName === 'HemisphereRadarScan') {
      options = "{ position: { longitude: 116.391, latitude: 39.907, height: 0 }, radius: 1000, color: '#00ff0038', scanColor: '#00ff0038', speed: 1 }"
    }
    if (baseName === 'AimEffect') {
      options = "{ source: { longitude: 116.391, latitude: 39.907, height: 300000 }, target: { longitude: 116.421, latitude: 39.917, height: 300000 }, outsideRadius: 50000, insideRadius: 1, color: 'rgba(255,0,0,0.4)', lineColor: '#ffffff', lineWidth: 1 }"
    }
    if (baseName === 'ConeEffect') {
      options = "{ position: [120.3, 23.5, 1000], height: 500000, baseRadius: 100000, scanRadius: 70000, segments: 280, coneLineColor: 'rgba(255,0,0,1)', scanLineColor: 'rgba(0,255,0,1)', coneFillColor: 'rgba(0,255,255,0.25)', showConeFill: false, showCone: true, showScan: true }"
    }
    if (baseName === 'DoubleViewFrustum') {
      options = "{ position: { longitude: 120.95, latitude: 23.75, height: 500000 }, heading: 0, pitch: 0, roll: 0, scale: 1, near: 50000, far: 500000, fov: 30, aspectRatio: 2, color: 'rgba(0,255,255,0.25)', fillColor: '#00ffff', fillAlpha: 0.15, lineColor: 'rgba(255,255,255,1)', lineWidth: 1, show: true }"
    }
    if (baseName === 'ParabolaRadar') {
      options = "{ position: { longitude: 120.95, latitude: 23.75, height: 0 }, heading: 0, pitch: 0, roll: 0, scale: 1, radius: 66000, domeHeight: 18000, scanSpeed: 45, scanBladeAngle: 1, scanBladeCount: 1, horizontalSegments: 96, verticalSegments: 10, gridLineWidth: 1, surfaceColor: '#00ff48', surfaceAlpha: 0.34, gridColor: '#00ff48', gridAlpha: 0.78, scanBladeColor: '#ff0000', scanBladeAlpha: 0.48, scanBlink: false, show: true }"
    }
    if (baseName === 'DiffusionRadar') {
      options = "{ position: { longitude: 120.95, latitude: 23.75, height: 0 }, heading: 0, pitch: 0, roll: 0, scale: 1, radius: 400000, startAngle: 0, endAngle: 360, waveCount: 4, duration: 2200, segments: 128, lineWidth: 2, color: '#00d6ff', colorAlpha: 0.22, lineColor: '#00ffff', lineAlpha: 0.85, show: true }"
    }
    if (baseName === 'RingRadar') {
      options = "{ position: { longitude: 120.95, latitude: 23.75, height: 0 }, heading: 0, pitch: 0, roll: 0, scale: 1, innerRadius: 33000, outerRadius: 66000, innerDomeHeight: 9000, outerDomeHeight: 18000, scanSpeed: 45, scanBladeAngle: 1, horizontalSegments: 96, verticalSegments: 10, gridLineWidth: 1, outerSurfaceColor: '#c8601f', outerSurfaceAlpha: 0.34, outerGridColor: '#c8601f', outerGridAlpha: 0.78, innerSurfaceColor: '#00ff48', innerSurfaceAlpha: 0.38, innerGridColor: '#00ff48', innerGridAlpha: 0.78, scanBladeColor: '#fff400', scanBladeAlpha: 0.48, scanBlink: false, show: true }"
    }
    if (baseName === 'SquareConeScanner') {
      options = "{ position: { longitude: 120.95, latitude: 23.75, height: 500000 }, heading: 0, pitch: 0, roll: 0, scale: 1, height: 500000, horiAngle: 30, vertAngle: 30, color: 'rgba(89,255,155,0.55)', lineColor: 'rgba(89,255,155,1)', lineWidth: 1, bottomOutlineVisible: true, bottomOutlineColor: '#ffff00', bottomOutlineAlpha: 1, bottomOutlineWidth: 1, show: true }"
    }
    if (baseName === 'FireRangeEffect') {
      options = "{ position: { longitude: 108, latitude: 39, height: 2000 }, heading: 0, pitch: 0, roll: 0, scale: 1, radius: 10000, minHoriAngle: -30, maxHoriAngle: 30, minVertAngle: 80, maxVertAngle: 100, horiPointNum: 360, vertPointNum: 180, radialPointNum: 48, gridHoriStep: 1, gridVertStep: 1, apexColor: 'rgba(20,40,255,0.58)', middleColor: 'rgba(210,215,35,0.42)', farColor: 'rgba(255,140,0,0.58)', fillAlpha: 1, fillVisible: true, gridColor: '#ff5600', gridAlpha: 0.95, gridLineWidth: 1, gridVisible: true, outlineColor: '#ff0000', outlineAlpha: 0.9, outlineLineWidth: 1, outlineVisible: true, show: true }"
    }
    if (baseName === 'RingRadar' && isCollection) {
      return `const viewer = window.FastX.getLayer().viewer\nconst effect = new window.FastX.SpecialEffects.${name}()\nconst options = ${options}\neffect.addRadars(viewer, [options])`
    }
    return `const viewer = window.FastX.getLayer().viewer\nconst effect = new window.FastX.SpecialEffects.${name}(${constructorArgs})\nconst options = ${options}\neffect.add(${addArgs})`
  }
  if (groupId === 'weather') return `const viewer = window.FastX.getLayer().viewer\nconst weather = new window.FastX.SpecialEffects.${name}(viewer)\nweather.enable()`
  if (groupId === 'plugin' || groupId === 'tools') return `${name}()`
  return `window.FastX.${name}`
}

function buildDocs() {
  const indexExports = collectIndexExports()
  const entryExports = collectEntryExports(indexExports)
  const fastXMembers = collectFastXMembers(indexExports.importMap)
  const packageNames = new Set(entryExports.values.keys())
  const allNames = new Set([...entryExports.values.keys(), ...fastXMembers.keys()])

  const records = new Map(entryExports.values)
  for (const [name, record] of fastXMembers) {
    if (!records.has(name)) records.set(name, record)
  }

  const orderedNames = []
  for (const groupId of groupOrder) {
    for (const name of preferredOrder[groupId] ?? []) {
      if (allNames.has(name) || name === 'XMapConfig') orderedNames.push(name)
    }
  }
  for (const name of [...allNames].sort()) {
    if (!orderedNames.includes(name)) orderedNames.push(name)
  }

  const groups = groupOrder.map((id) => ({ id, label: groupLabels[id], items: [] }))
  const groupMap = new Map(groups.map((group) => [group.id, group]))

  for (const name of orderedNames) {
    const groupId = groupFor(name)
    const meta = apiMeta[name] ?? [name, `${name} 是 fastx-sdk 对外暴露的 API。`]
    const record = records.get(name) ?? (entryExports.types.has(name) ? entryExports.types.get(name) : null)
    const types = relatedTypes(name, entryExports.types)
    const methods = enrichSpecialEffectMethods(name, collectMethods(name, record), types)
    const params = parameterRows(name, methods, types, entryExports.types)
    groupMap.get(groupId).items.push({
      id: name,
      kind: 'api',
      group: groupId,
      name,
      cn: meta[0],
      title: `${name}（${meta[0]}）`,
      description: meta[1],
      methods,
      types,
      params,
      usage: usageFor(name, groupId),
      access: accessFor(name, groupId, packageNames),
      generated: true,
    })
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'src/FastX/build/entry.ts',
    packageNamedExports: [...packageNames].sort(),
    groups: groups.filter((group) => group.items.length || group.id === 'weather'),
  }
}

fs.mkdirSync(outDir, { recursive: true })
const docs = buildDocs()
fs.writeFileSync(outFile, `${JSON.stringify(docs, null, 2)}\n`, 'utf8')
console.log(`[api-docs] generated ${path.relative(rootDir, outFile)} (${docs.groups.reduce((sum, group) => sum + group.items.length, 0)} APIs)`)
