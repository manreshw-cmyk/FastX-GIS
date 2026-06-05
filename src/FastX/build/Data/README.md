# Data

内置示例数据目录，构建与 `npm pack` 时会随包发布。

| 子目录 | 用途 |
|--------|------|
| `images/` | 图片纹理、图标 |
| `model/glb/` | GLB 模型 |
| `model/gltf/` | glTF 模型 |
| `json/` | GeoJSON、KML、CZML 等 JSON 数据 |

`json/` 内置示例：

| 文件 | 用途 |
|------|------|
| `china_provinces.geojson` | 中国省级边界（GeoJSON 示例） |
| `taipei_buildings.kml` | 台北市 OSM 建筑轮廓（KML 示例） |
| `satellites.czml` | 15 颗卫星轨道（CZML 标准格式，FIXED 笛卡尔位置采样） |
| `point_aggregation.json` | 点聚合演示数据 |

将资源放入对应子目录即可；空目录无需 `.gitkeep`，运行 `npm run build` 时会自动创建。
