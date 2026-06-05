# cesium-navigation-es6

| 项 | 值 |
|---|---|
| 版本 | 3.0.9 |
| 全局变量 | `CesiumNavigation` |
| 入口文件 | `CesiumNavigation.umd.js` |
| 样式 | `styles/cesium-navigation.css` |
| 仓库 | https://github.com/cesium-plugin/cesium-navigation-es6 |

## FastX 集成

- 加载：`await ensureCesiumNavigation()`（`fastx-sdk` / `src/FastX/plugins`）
- 显隐：`layer.setNavigationControlVisible(true)`（默认仅罗盘，关闭距离图例与缩放条）
- 位置：地图左下角，堆叠在自绘比例尺上方

## 插件能力概览

| 模块 | 说明 |
|---|---|
| **罗盘 Compass** | 外环随相机 heading 旋转；内环拖拽 orbit 环视；外环拖拽 rotate 绕地旋转；双击恢复俯视 |
| **导航条 Navigation Controls** | 放大 / 重置视图 / 缩小（FastX 默认关闭，工具栏已有缩放） |
| **距离图例 Distance Legend** | 左下角比例尺条（FastX 默认关闭，使用自绘比例尺） |

构造选项常用项：`enableCompass`、`enableZoomControls`、`enableDistanceLegend`、`defaultResetView`、`duration`、各类 tooltip / 自定义 SVG。

```typescript
import { Layer, ensureCesiumNavigation, getCesiumNavigation } from 'fastx-sdk'

await layer.setNavigationControlVisible(true)
// 或底层：await ensureCesiumNavigation(); new getCesiumNavigation()(viewer, options)
```
