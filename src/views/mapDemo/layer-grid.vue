<script setup lang="ts">
/**
 * 图层渲染示例 - 3D 经纬网格参考层。
 *
 * 调用 `Layer.addLonLatGrid` 开启基于 Globe Shader 的三维经纬网。
 */
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { useLayerDemoCleanup } from './common/layer-demo-shared'

const title = 'Grid网格图'
const { getLayer, trackLonLatGrid, cleanup } = useLayerDemoCleanup()
const loading = ref(false)
const loaded = ref(false)

async function handleLoad() {
  const layer = getLayer()
  if (!layer) return

  loading.value = true
  try {
    cleanup()
    layer.addLonLatGrid()
    trackLonLatGrid()
    loaded.value = true
    message.success('已加载 3D 经纬网格')
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Grid 加载失败')
  } finally {
    loading.value = false
  }
}

function handleClear() {
  cleanup()
  loaded.value = false
  message.info('已移除 3D 经纬网格')
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="320">
      <div class="map-tool-head">{{ title }}</div>
      <p class="map-tool-desc">调用 <code>Layer.addLonLatGrid</code> 加载贴合三维地球的经纬网格参考层。</p>
      <a-space direction="vertical" :size="10" style="width: 100%">
        <a-button type="primary" block :loading="loading" @click="handleLoad">加载 3D 经纬网格</a-button>
        <a-button class="layer-demo-btn-clear" block :disabled="!loaded" @click="handleClear">清除 3D 经纬网格</a-button>
      </a-space>
    </XDialog>
  </div>
</template>
