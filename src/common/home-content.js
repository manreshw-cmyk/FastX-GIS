import { getCardCoverByMapDemoKey } from "../views/mapDemo/components/common/component-map";

const menuDefinitions = [
  {
    key: "coordinates",
    label: "坐标转换",
    items: [
      "世界坐标转换屏幕坐标",
      "屏幕坐标转换世界坐标",
      "世界坐标转换经纬度（度）坐标",
      "经纬度（度）坐标转换世界坐标",
      "屏幕坐标转换经纬度（度）坐标",
      "经纬度（度）坐标转换屏幕坐标",
      "经纬度（度）坐标转换度分秒",
      "度分秒转换经纬度（度）坐标",
    ],
  },
  {
    key: "tools",
    label: "基础工具",
    items: [
      "二三维切换",
      "鹰眼",
      "大气层",
      "光照",
      "视角复位",
      "设置地图中心点",
      "视口高度与中心点",
      "比例尺",
    ],
  },
  {
    key: "mouse-event",
    label: "鼠标事件",
    items: [
      "鼠标左键点击（LeftEventClick）事件",
      "鼠标左键双击（LeftEventDblClick）事件",
      "鼠标左键按下（LeftEventDown）事件",
      "鼠标左键抬起（LeftEventUp）事件",
      "鼠标右键点击（RightEventClick）事件",
      "鼠标右键双击（RightEventDblClick）事件",
      "鼠标右键按下（RightEventDown）事件",
      "鼠标右键抬起（RightEventUp）事件",
      "鼠标中键点击（MiddleEventClick）事件",
      "鼠标中键按下（MiddleEventDown）事件",
      "鼠标中键抬起（MiddleEventUp）事件",
      "鼠标轮（WheelEvent）事件",
    ],
  },
  {
    key: "draw",
    label: "基础绘制",
    items: [
      "绘制点（Point）类",
      "绘制标签（Label）类",
      "绘制线（PolyLine）类",
      "绘制圆（Circle）类",
      "绘制多边形（Polygon）类",
      "绘制扇形（Sector）类",
      "绘制矩形（Rectangle）类",
      "绘制圆锥/圆柱（Cylinder）类",
      "绘制跑道（Runway）类",
      "绘制廊道（Corridor）类",
      "绘制球/椭球（Ellipsoid）类",
      "绘制墙（Wall）类",
      "绘制折线体（PolylineVolume）类",
      "绘制平面（Plane）类",
      "绘制广告牌（Billboard）类",
      "绘制模型（Model）类",
      "绘制盒子/立方体（Box）类",
      "绘制路径（Path）类",
      "绘制3D Tiles（Tileset）类",
      "2/3维热力图",
    ],
  },
  {
    key: "layer",
    label: "图层渲染",
    items: [
      "初始化地图（图层）",
      "使用CesiumTerrainProvider加载地形服务",
      "使用WMTS服务加载图层",
      "使用WMS服务加载图层",
      "使用TMS服务加载图层",
      "使用UrlTemplateImageryProvider加载天地图/高德/腾讯/百度图层",
      "使用GridImageryProvider加载Grid网格图",
      "使用GeoJsonDataSource加载GeoJSON/TopoJSON",
      "使用KmlDataSource加载KML/KMZ",
      "使用CzmlDataSource加载CZML（Cesium自身的JSON格式）",
    ],
  },
  {
    key: "quantitative",
    label: "量算分析",
    items: [
      "距离测量（空间/地表/投影）",
      "面积测量（空间/投影）",
      "三角测量",
      "方位角测量",
      "通视与视域分析",
      "等高线分析",
      "缓冲区分析",
    ],
  },
  {
    key: "special-effects",
    label: "特效集合",
    items: [
      "粒子特效（飞机尾焰）",
      "粒子特效（爆炸效果）",
      "粒子特效（局部下雨效果）",
      "粒子特效（局部下雪效果）",
      "粒子特效（局部起雾效果）",
      "粒子特效（局部闪电效果）",
      "水波纹效果",
      "电子围栏效果",
      "雷达扫描效果",
      "动态扩散点效果",
    ],
  },
  {
    key: "meteorology-hydrology",
    label: "气象水文",
    items: [
      "台风",
      "洪水",
      "地面/高空气象（风向标 或 风羽图）",
      "卫星云图",
      "气象雷达图",
      "风场",
    ],
  },
  {
    key: "scene",
    label: "场景",
    items: ["绕点飞行", "（红蓝）空对空打击场景"],
  },
  {
    key: "performance-test",
    label: "性能测试",
    items: ["自定义数量绘制军标", "自定义数量绘制模型"],
  },
];

export const homeMenuTree = menuDefinitions.map((group) => ({
  key: group.key,
  label: group.label,
  children: group.items.map((label, index) => ({
    key: `${group.key}-${index + 1}`,
    label,
  })),
}));

export const homeContentSections = menuDefinitions.map((group) => ({
  key: group.key,
  title: group.label,
  cards: group.items.map((item, index) => {
    const key = `${group.key}-${index + 1}`;
    return {
      key,
      title: item,
      image: getCardCoverByMapDemoKey(key),
    };
  }),
}));
