# @turf/turf（浏览器包）

| 项 | 值 |
|---|---|
| 版本 | 7.3.5 |
| 全局变量 | `turf` |
| 入口文件 | `turf.min.js` |
| CDN 来源 | jsDelivr `@turf/turf@7.3.5/turf.min.js` |

## 用途

缓冲分析等空间量算（`FastX.Quantitative` / `BufferAnalyze`）。

## FastX 用法

```typescript
import { ensureTurf, turf } from 'fastx-sdk'

await ensureTurf()
const ring = turf.buffer(turf.point([lon, lat]), 1, { units: 'kilometers' })
```
