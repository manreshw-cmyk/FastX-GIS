# FastX GIS

**迅疾加载，畅享流畅三维全域视界**

极速驱动 Cesium，大场景三维地图高效渲染。  
快览天地万象，速筑数字空间。  
高性能三维引擎，毫秒响应，实景漫游无卡顿。

FastX GIS 是基于 **Cesium** 的三维 GIS 能力库与演示工程：封装 `FastX`（`window.FastX`），提供图层、坐标、鼠标事件、Entity / Primitive 标绘等 API，并在 `/mapDemo` 中逐项演示。

---

## 技术栈

| 项目 | 版本要求 |
|------|----------|
| **Node.js** | `>= 18`（推荐 **20 LTS** 或 **22.x**；本地验证 **22.22.0**） |
| **npm** | `>= 9`（推荐 **10.x**；本地验证 **10.8.2**） |
| Vue | 3.4 |
| TypeScript | 5.5 |
| Vite | 5.4 |
| Cesium | 1.140 |
| Ant Design Vue | 4.2 |
| Pinia / Vue Router | 2.x / 4.x |

---

## 快速开始

```bash
npm install
npm run dev       # 开发：http://localhost:5173
npm run build     # 构建
npm run preview   # 预览构建结果
```

登录后进入 **地图演示**（`/mapDemo`），左侧菜单切换功能卡片。

---

## 功能清单

图例：**✅** 演示已接入，可操作 · **❌** 菜单已有，演示占位或未实现

### 平台

| 功能 | 状态 |
|------|------|
| 登录与地图演示框架（`/mapDemo`） | ✅ |
| FastX 全局 API（`window.FastX`） | ✅ |
| Layer 图层引擎 API（地形 / 影像 / 矢量等，见 `src/FastX/Layer`） | ✅ |
| Draw Primitive 批量（`*Collection` 高性能路径） | ✅ |

### 坐标（Coordinates）8

| 功能 | 状态 |
|------|------|
| 世界坐标 → 屏幕坐标 | ✅ |
| 屏幕坐标 → 世界坐标 | ✅ |
| 世界坐标 → 经纬度（度） | ✅ |
| 经纬度（度）→ 世界坐标 | ✅ |
| 屏幕坐标 → 经纬度（度） | ✅ |
| 经纬度（度）→ 屏幕坐标 | ✅ |
| 经纬度（度）→ 度分秒 | ✅ |
| 度分秒 → 经纬度（度） | ✅ |

### 基础工具（Tools）8

| 功能 | 状态 |
|------|------|
| 二三维切换 | ✅ |
| 鹰眼 | ✅ |
| 大气层 | ✅ |
| 光照 | ✅ |
| 视角复位 | ✅ |
| 设置地图中心点 | ✅ |
| 视口高度与中心点 | ✅ |
| 比例尺 | ✅ |

### 鼠标事件（MouseEvent）12

| 功能 | 状态 |
|------|------|
| 左键点击 LeftEventClick | ✅ |
| 左键双击 LeftEventDblClick | ✅ |
| 左键按下 LeftEventDown | ✅ |
| 左键抬起 LeftEventUp | ✅ |
| 右键点击 RightEventClick | ✅ |
| 右键双击 RightEventDblClick | ✅ |
| 右键按下 RightEventDown | ✅ |
| 右键抬起 RightEventUp | ✅ |
| 中键点击 MiddleEventClick | ✅ |
| 中键按下 MiddleEventDown | ✅ |
| 中键抬起 MiddleEventUp | ✅ |
| 滚轮 WheelEvent | ✅ |

### 绘制（Draw）22

| 功能 | 状态 |
|------|------|
| Point 点（Entity） | ✅ |
| Label 文字（Entity） | ✅ |
| PolyLine 线（Entity，含虚线 / 发光 / 箭头 / 贴地 / 流动 / 渐变等） | ✅ |
| Circle 圆（Entity） | ✅ |
| Polygon 多边形（Entity） | ✅ |
| Sector 扇形（Entity） | ✅ |
| Rectangle 矩形（Entity） | ✅ |
| Cylinder 圆锥 / 圆柱（Entity） | ✅ |
| Runway 跑道（Entity，两点廊道） | ✅ |
| Corridor 廊道（Entity） | ✅ |
| Ellipsoid 球 / 椭球（Entity） | ✅ |
| Wall 墙（Entity） | ✅ |
| PolylineVolume 折线体 / 立体管道（Entity） | ✅ |
| Plane 平面（Entity，颜色 / 图片 / 视频） | ✅ |
| Billboard 广告牌（Entity） | ✅ |
| Model 模型（Entity） | ✅ |
| Box 盒子 / 立方体（Entity） | ✅ |
| Tileset 3D Tiles（Entity） | ❌ |
| Path 路径（Entity） | ✅ |
| 等高线 | ❌ |
| 二维热力图 | ❌ |
| 三维热力图 | ❌ |

### 图层（Layer）10

| 功能 | 状态 |
|------|------|
| 初始化地图 | ❌ |
| CesiumTerrainProvider 地形 | ❌ |
| WMTS 图层 | ❌ |
| WMS 图层 | ❌ |
| TMS 图层 | ❌ |
| UrlTemplate（天地图 / 高德 / 腾讯 / 百度等） | ❌ |
| Grid 网格图 | ❌ |
| GeoJSON / TopoJSON | ❌ |
| KML / KMZ | ❌ |
| CZML | ❌ |

### 量算分析（Quantitative）6

| 功能 | 状态 |
|------|------|
| 贴地 / 空间距离测量 | ❌ |
| 空间面积测量 | ❌ |
| 角度测量 | ❌ |
| 坡度角测量 | ❌ |
| 点是否在面内 | ❌ |
| 点与点距离 | ❌ |

### 特效（SpecialEffects）10

| 功能 | 状态 |
|------|------|
| 粒子 · 飞机尾焰 | ❌ |
| 粒子 · 爆炸 | ❌ |
| 粒子 · 局部下雨 | ❌ |
| 粒子 · 局部下雪 | ❌ |
| 粒子 · 局部起雾 | ❌ |
| 粒子 · 局部闪电 | ❌ |
| 水波纹 | ❌ |
| 电子围栏 | ❌ |
| 雷达扫描 | ❌ |
| 动态扩散点 | ❌ |

### 气象水文 6

| 功能 | 状态 |
|------|------|
| 台风 | ❌ |
| 洪水 | ❌ |
| 地面 / 高空气象（风向标 / 风羽） | ❌ |
| 卫星云图 | ❌ |
| 气象雷达图 | ❌ |
| 风场 | ❌ |

### 场景 2

| 功能 | 状态 |
|------|------|
| 绕点飞行 | ❌ |
| （红蓝）空对空打击场景 | ❌ |

### 性能测试 2

| 功能 | 状态 |
|------|------|
| 自定义数量绘制军标 | ❌ |
| 自定义数量绘制模型 | ❌ |

**合计**：86 项菜单能力 · **49** ✅ · **37** ❌

---

## 说明

1. **✅ / ❌ 判定**：以 `src/views/mapDemo` 演示页为准；页面仍为「功能内容开发中」记为 ❌。
2. **图层类**：上表图层演示为 ❌，但 `Layer` 类 API 已在 `FastX` 中实现（二三维、鹰眼、大气光照、地形与 WMTS/WMS/TMS/UrlTemplate/GeoJSON/KML/CZML 等接口），待演示页对接。
3. **Primitive 批量**：Point / Line / 面 / 体等 `*Collection` 已导出，无单独菜单卡片，与 Entity 演示配合使用。
4. **配置**：地图服务地址见 `src/config/map-runtime`；能力卡片注册见 `src/views/mapDemo/component-map.json`。
5. **版本**：产品发布 **V1.1.2**；
