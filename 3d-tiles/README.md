3D Tiles 示例数据

本目录用于“基础绘制 - 绘制3D Tiles（Tileset）类”示例页，当前保留两套可公开访问的数据：

- `agi-headquarters/`：AGI Headquarters 真实倾斜摄影园区，来源为 Cesium 3D Tiles 公开资源清单中的 `https://pelican-public.s3.amazonaws.com/3dtiles/agi-hq/tileset.json`，已完整下载到本地。
- `plateau-minato-lod4-light/`：PLATEAU 东京都港区 LOD4 建筑数据轻量裁剪版，来源为 PLATEAU/Re:Earth 公开资源。为控制项目体积，仅保留根节点、第一层和第二层内容，并移除了更深层 `children`，示例加载时不会继续请求远程瓦片。

注意：
- 示例页仅演示 Cesium `Cesium3DTileset.fromUrl` 的加载、显隐、切换和清除。
- 如需生产级高清倾斜摄影，请按项目部署策略单独托管完整 tileset，不建议把大型数据直接提交进前端源码仓库。
