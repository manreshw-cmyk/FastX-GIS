# fastx-sdk

**迅疾加载，畅享流畅三维全域视界**

基于 **Cesium** 二次封装的三维 GIS JavaScript SDK。提供统一的 `FastX` 全局 API（`window.FastX`），在保留 Cesium 完整能力的同时，简化图层管理、坐标换算、鼠标交互与 Entity / Primitive 标绘等常见开发流程。

**在线演示**：[https://manreshw-cmyk.github.io/FastX-GIS/](https://manreshw-cmyk.github.io/FastX-GIS/)

**在线 API 接口手册**：[https://manreshw-cmyk.github.io/FastX-GIS/api-docs/index.html](https://manreshw-cmyk.github.io/FastX-GIS/api-docs/index.html)

---

## 特性

| 能力 | 说明 |
|------|------|
| **图层渲染** | 地形 / 影像 / 矢量（WMTS、WMS、TMS、UrlTemplate、GeoJSON、KML、CZML 等）/ 网格经纬线 / 自定义天空盒 |
| **坐标转换** | 世界 / 屏幕 / 经纬度 / 度分秒互转 |
| **鼠标交互** | 点击、移动、拖拽等地图事件封装 |
| **基础工具** | 集合二三维切换、鹰眼、大气层、光照、视角复位、比例尺、导航罗盘等工具 |
| **基础标绘** | 点、线、面、圆、扇形、矩形、柱体、走廊、跑道、椭球、墙、Billboard、模型、Box、PolylineVolume、 Plane、Path 、2/3维热力图、点聚合等 |
| **量算分析** | 空间/地表/投影等距离测量、空间/投影等面积测量、三角测量、方位角测量、直线通视、圆形通视、多点通视、视域分析、等高线分析、缓冲区分析 |
| **高性能标绘** | 基础标绘中所有功能均支持 Primitive 高性能批量API |
| **卫星轨迹** | 轨迹与 Mover 运动体 |

### 相比直接使用 Cesium 的优势

- **完全自包含**：内置 `lib/Cesium`（JS API + Workers / Assets / Widgets + `.d.ts`），`dist/` 运行时引用包内 Cesium，不依赖外网下载 `cesium`
- **开箱即用**：`installFastXToWindow()` 自动设置 `CESIUM_BASE_URL`
- **API 聚合**：`FastX.Layer`、`FastX.Draw.*` 等同名单例，减少重复创建与状态管理
- **框架无关**：纯 JS/TS SDK，不捆绑 Vue
- **类型完整**：ESM + CJS + `.d.ts` 一并发布

---

## 安装（公网 / 内网）

### 公网 npm

```bash
npm install fastx-sdk
```

### 内网 / 离线（`.tgz`）

维护者在本机构建后得到 `fastx-sdk-x.x.x.tgz`，拷贝到内网机器：

```bash
# 方式 A：npm 本地安装
npm install ./fastx-sdk-1.0.2.tgz

# 方式 B：手动解压到 node_modules
mkdir -p node_modules/fastx-sdk
tar -xzf fastx-sdk-1.0.2.tgz -C node_modules/fastx-sdk --strip-components=1
# Windows 可用解压工具，保证目录名为 node_modules/fastx-sdk 且含 package.json / dist / lib
```

**无需**再安装 `cesium`，也**无需**访问 npm registry 下载其它依赖（本包 `dependencies` 为空）。

---

## 使用

```typescript
import 'fastx-sdk/default/index.css'
import { FastX, installFastXToWindow, Cesium } from 'fastx-sdk'

installFastXToWindow()

FastX.Layer.initMap({ /* ... */ })

// 如需直接使用 Cesium API（可选）
const viewer = new Cesium.Viewer('map')
```

也可单独引用包内 Cesium：

```typescript
import * as Cesium from 'fastx-sdk/cesium'
```

### Vite / Webpack 注意

- 开发服务器需能访问 `node_modules/fastx-sdk/lib/Cesium/` 下的 Workers（`installFastXToWindow` 会设置 `CESIUM_BASE_URL`）
- 若手动部署静态资源，将 `lib/Cesium` 拷到站点可访问路径并设置 `window.CESIUM_BASE_URL`

---
