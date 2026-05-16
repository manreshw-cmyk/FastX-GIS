import { getCardCoverByMapDemoKey } from '../views/mapDemo/component-map'

const menuDefinitions = [
  {
    key: 'coordinates',
    label: '坐标（Coordinates）类',
    items: [
      '世界坐标转换屏幕坐标',
      '屏幕坐标转换世界坐标',
      '世界坐标转换经纬度（度）坐标',
      '经纬度（度）坐标转换世界坐标',
      '屏幕坐标转换经纬度（度）坐标',
      '经纬度（度）坐标转换屏幕坐标',
      '经纬度（度）坐标转换度分秒',
      '度分秒转换经纬度（度）坐标',
    ],
  },
  {
    key: 'tools',
    label: '基础工具（Tools）类',
    items: [
      '二三维切换',
      '鹰眼',
      '大气层',
      '光照',
      '视角复位',
      '设置地图中心点',
      '视口高度与中心点',
      '比例尺',
    ],
  },
  {
    key: 'mouse-event',
    label: '鼠标事件（MouseEvent）类',
    items: [
      '鼠标左键点击（LeftEventClick）事件',
      '鼠标左键双击（LeftEventDblClick）事件',
      '鼠标左键按下（LeftEventDown）事件',
      '鼠标左键抬起（LeftEventUp）事件',
      '鼠标右键点击（RightEventClick）事件',
      '鼠标右键双击（RightEventDblClick）事件',
      '鼠标右键按下（RightEventDown）事件',
      '鼠标右键抬起（RightEventUp）事件',
      '鼠标中键点击（MiddleEventClick）事件',
      '鼠标中键按下（MiddleEventDown）事件',
      '鼠标中键抬起（MiddleEventUp）事件',
      '鼠标轮（WheelEvent）事件',
    ],
  },
  {
    key: 'draw',
    label: '基础绘制(Draw)(当前是Object，子级全部是挂载类)',
    items: [
      '绘制(Point)点类（底层entity渲染）',
      '绘制(Label)文字类（底层entity渲染）',
      '绘制(PolyLine)线类（底层entity渲染）',
      '绘制（Circle）圆类（底层entity）',
      '绘制（Polygon）多边形类（底层entity）',
      '绘制（Sector）扇形类（底层entity）',
      '绘制（Rectangle）矩形类（底层entity）',
      '绘制（Cylinder）圆锥/圆柱类',
      '绘制（Runway）跑道类（底层entity）',
      '绘制（Corridor）廊道类（底层entity）',
      '绘制（Ellipsoid）球/椭球类（底层entity）',
      '绘制（Wall）墙类（底层entity）',
      '绘制（PolylineVolume）折线体（立体管道）类（底层entity）',
      '绘制（Plane）平面类（底层entity）',
      '绘制（Billboard）广告牌类（底层entity）',
      '绘制（Model）模型类（底层entity）',
      '绘制（Box）盒子/立方体类（底层entity）',
      '绘制（Tileset）3D Tiles类（底层entity）',
      '绘制（Path）路径类（底层entity）',
      '等高线',
      '2维热力图',
      '3维热力图',
    ],
  },
  {
    key: 'layer',
    label: '图层（Layer）类',
    items: [
      '初始化地图（图层）',
      '使用CesiumTerrainProvider加载地形服务',
      '使用WMTS服务加载图层',
      '使用WMS服务加载图层',
      '使用TMS服务加载图层',
      '使用UrlTemplateImageryProvider加载天地图/高德/腾讯/百度图层',
      '使用GridImageryProvider加载Grid网格图',
      '使用GeoJsonDataSource加载GeoJSON/TopoJSON',
      '使用KmlDataSource加载KML/KMZ',
      '使用CzmlDataSource加载CZML（Cesium自身的JSON格式）',
    ],
  },
  {
    key: 'quantitative',
    label: '量算分析（Quantitative）类',
    items: ['贴地、空间距离测量', '空间面积测量', '角度测量', '坡度角测量', '计算点是否包含在面中', '计算点与点的距离'],
  },
  {
    key: 'special-effects',
    label: '特效（SpecialEffects）类（本身是Object）',
    items: [
      '粒子特效（飞机尾焰）',
      '粒子特效（爆炸效果）',
      '粒子特效（局部下雨效果）',
      '粒子特效（局部下雪效果）',
      '粒子特效（局部起雾效果）',
      '粒子特效（局部闪电效果）',
      '水波纹效果',
      '电子围栏效果',
      '雷达扫描效果',
      '动态扩散点效果',
    ],
  },
  {
    key: 'meteorology-hydrology',
    label: '气象水文类',
    items: ['台风', '洪水', '地面/高空气象（风向标 或 风羽图）', '卫星云图', '气象雷达图', '风场'],
  },
  {
    key: 'scene',
    label: '场景',
    items: ['绕点飞行', '（红蓝）空对空打击场景'],
  },
  {
    key: 'performance-test',
    label: '性能测试',
    items: ['自定义数量绘制军标', '自定义数量绘制模型'],
  },
]

export const homeMenuTree = menuDefinitions.map((group) => ({
  key: group.key,
  label: group.label,
  children: group.items.map((label, index) => ({
    key: `${group.key}-${index + 1}`,
    label,
  })),
}))

export const homeContentSections = menuDefinitions.map((group) => ({
  key: group.key,
  title: group.label,
  cards: group.items.map((item, index) => {
    const key = `${group.key}-${index + 1}`
    return {
      key,
      title: item,
      image: getCardCoverByMapDemoKey(key),
    }
  }),
}))
