# heatmap.js

| 项 | 值 |
|---|---|
| 版本 | 2.0.5 |
| 全局变量 | `h337` |
| 入口文件 | `heatmap.min.js` |
| 官网 | https://www.patrick-wied.at/static/heatmapjs/ |

## 用途

二维/三维热力图纹理生成（`FastX.Heatmap`）。

## FastX 用法

```typescript
import { ensureHeatmapJs, h337 } from 'fastx-sdk'

await ensureHeatmapJs()
const instance = h337.create({ container: el, radius: 40 })
```
