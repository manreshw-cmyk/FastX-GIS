<script setup lang="ts">
/**
 * 图层渲染示例 — 经纬网格参考层。
 *
 * 调用 `Layer.addGridImageryLayer` 叠加半透明 Grid 影像，便于观察坐标与范围。
 */
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { useLayerDemoCleanup } from './common/layer-demo-shared'

const title = 'Grid网格图'
const { getLayer, trackGrid, cleanup } = useLayerDemoCleanup()
const loading = ref(false)
const loaded = ref(false)

async function handleLoad() {
  const layer = getLayer()
  if (!layer) return

  loading.value = true
  try {
    cleanup()
    layer.addGridImageryLayer(undefined, undefined, {
      lineColor: 'rgba(120, 200, 255, 0.55)',
    })
    trackGrid()
    loaded.value = true
    message.success('已叠加 Grid 网格影像层')
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Grid 加载失败')
  } finally {
    loading.value = false
  }
}

function handleClear() {
  cleanup()
  loaded.value = false
  message.info('已移除 Grid 网格层')
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="320">
      <div class="map-tool-head">{{ title }}</div>
      <p class="map-tool-desc">调用 <code>Layer.addGridImageryLayer</code> 叠加经纬网格参考层。</p>
      <a-space direction="vertical" :size="10" style="width: 100%">
        <a-button type="primary" block :loading="loading" @click="handleLoad">加载 Grid 图层</a-button>
        <a-button class="layer-demo-btn-clear" block :disabled="!loaded" @click="handleClear">清除网格层</a-button>
      </a-space>
    </XDialog>
  </div>
</template>
