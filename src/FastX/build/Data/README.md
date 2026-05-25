# Data

内置示例数据目录，构建与 `npm pack` 时会随包发布。

| 子目录 | 用途 |
|--------|------|
| `images/` | 图片纹理、图标 |
| `model/glb/` | GLB 模型 |
| `model/gltf/` | glTF 模型 |
| `json/` | GeoJSON 等 JSON 数据 |
| `czml/` | CZML 时序数据 |

将资源放入对应子目录即可；空目录无需 `.gitkeep`，运行 `npm run build` 时会自动创建。
