<script setup lang="ts">
/**
 * 图层渲染示例 — KML 建筑轮廓。
 *
 * 加载台北市 OSM 真实建筑 KML（`taipei_buildings.kml`），
 * 调用 `Layer.loadKmlDataSource` 后随机着色各建筑 polygon。
 */
import * as Cesium from 'cesium'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { applyRandomKmlBuildingColors, TAIPEI_BUILDINGS_KML } from './components/common/layer-kml-demo'
import { fastxDataUrl, flyToDataSource, useLayerDemoCleanup } from './components/common/layer-demo-shared'

const title = 'KML/KMZ'
const DATA_PATH = TAIPEI_BUILDINGS_KML
const DATA_URL = fastxDataUrl(DATA_PATH)
const { getLayer, map, cleanup } = useLayerDemoCleanup()
const loading = ref(false)
const loaded = ref(false)

async function handleLoad() {
  const layer = getLayer()
  const viewer = map.getViewer()
  if (!layer || !viewer || viewer.isDestroyed()) return

  loading.value = true
  try {
    cleanup()
    const ds = await layer.loadKmlDataSource(DATA_URL, { camera: viewer.camera, canvas: viewer.canvas })
    applyRandomKmlBuildingColors(ds)
    await viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(121.565, 25.033, 2800),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 2.2,
    })
    await flyToDataSource(viewer, ds)
    loaded.value = true
    message.success('已加载台北市真实建筑轮廓（OSM）')
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'KML 加载失败')
  } finally {
    loading.value = false
  }
}

function handleClear() {
  cleanup()
  loaded.value = false
  message.info('已清除 KML 数据源')
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="360">
      <div class="map-tool-head">{{ title }}</div>
      <p class="map-tool-desc">
        调用 <code>Layer.loadKmlDataSource</code>，加载台北市 OSM 真实建筑轮廓，每栋建筑随机着色。
      </p>
      <p class="map-tool-desc layer-demo-path">数据：{{ DATA_PATH }}</p>
      <a-space direction="vertical" :size="10" style="width: 100%">
        <a-button type="primary" block :loading="loading" @click="handleLoad">加载 KML</a-button>
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
