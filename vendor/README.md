# FastX SDK Vendor 插件目录

第三方浏览器脚本源码目录，提交 Git。执行 `npm run build:sdk` 时会按 `manifest.json` 拷贝到 `lib/` 随包发布。

## 目录约定

```
vendor/
├── manifest.json          # 插件清单
├── heatmap/               # heatmap.js
├── turf/                  # @turf/turf 浏览器包
└── cesium-navigation/     # 预留
```

## 与 lib/ 的关系

| 路径 | 说明 |
|------|------|
| `vendor/*` | 源码，**提交 Git** |
| `lib/Cesium/` | Cesium 构建拷贝，**gitignore** |
| `lib/heatmap/` 等 | 由 vendor 拷贝，**提交 Git**（build 后同步） |

仅 `lib/Cesium/` 与 `lib/Cesium.d.ts` 被忽略；其余 `lib/<plugin>/` 可在构建后提交，便于未跑 build 时开发。

## 新增插件

1. 在 `vendor/<id>/` 放入离线脚本与 `README.md`
2. 在 `manifest.json` 登记
3. 在 `src/FastX/plugins/` 增加 `ensureXxx()` 与导出
4. `build.mjs` 会自动拷贝到 `lib/`
