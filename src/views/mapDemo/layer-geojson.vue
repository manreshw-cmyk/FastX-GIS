<script setup lang="ts">
/**
 * 图层渲染示例 — GeoJSON 省界墙。
 *
 * 加载 `china_provinces.geojson`，按省绘制不同颜色的 `Wall`（带高度），
 * 实体由 `useLayerDemoCleanup` 统一跟踪与清除。
 */
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { flyToChina, loadChinaProvinceWalls } from './components/common/layer-geojson-demo'
import { useLayerDemoCleanup } from './components/common/layer-demo-shared'

const title = 'GeoJSON/TopoJSON服务'
const DATA_PATH = 'json/china_provinces.geojson'
const { map, cleanup, trackEntities } = useLayerDemoCleanup()
const loading = ref(false)
const loaded = ref(false)

async function handleLoad() {
  const viewer = map.getViewer()
  if (!viewer || viewer.isDestroyed()) return

  loading.value = true
  try {
    cleanup()
    const entities = await loadChinaProvinceWalls(viewer)
    trackEntities(entities)
    await flyToChina(viewer)
    loaded.value = true
    message.success(`已加载 ${entities.length} 段省界墙（各省不同颜色）`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'GeoJSON 加载失败')
  } finally {
    loading.value = false
  }
}

function handleClear() {
  cleanup()
  loaded.value = false
  message.info('已清除省界墙')
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="360">
      <div class="map-tool-head">{{ title }}</div>
      <p class="map-tool-desc">
        读取中国各省边界 GeoJSON，按省分别绘制 <code>Wall</code>（较低高度、各省不同颜色）。
      </p>
      <p class="map-tool-desc layer-demo-path">数据：{{ DATA_PATH }}</p>
      <a-space direction="vertical" :size="10" style="width: 100%">
        <a-button type="primary" block :loading="loading" @click="handleLoad">加载 GeoJSON 省界墙</a-button>
        <a-button class="layer-demo-btn-clear" block :disabled="!loaded" @click="handleClear">清除</a-button>
      </a-space>
    </XDialog>
  </div>
</template>

<style scoped>
.layer-demo-path {
  font-size: 11px;
  opacity: 0.75;
}
</style>
