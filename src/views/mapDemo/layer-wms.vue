<script setup lang="ts">
/**
 * 图层渲染示例 — WMS 影像。
 *
 * 读取 `window.apiConfig.imageryProvider`，先清空全部影像层、等待 2 秒，
 * 再调用 `Layer.addImageryFromWms`（XYZ 模板时退化为 UrlTemplate）。
 */
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { getConfigImageryUrl, reloadConfigImageryLayer } from './components/common/layer-imagery-demo'
import { useLayerDemoCleanup } from './components/common/layer-demo-shared'

const title = 'WMS图层'
const configUrl = getConfigImageryUrl()
const { getLayer, trackImagery, cleanup } = useLayerDemoCleanup()
const loading = ref(false)

async function handleLoad() {
  const layer = getLayer()
  if (!layer) return

  loading.value = true
  try {
    cleanup()
    const imagery = await reloadConfigImageryLayer(layer, 'wms')
    trackImagery(imagery)
    message.success('已清除原图层，2 秒后通过 WMS 方式加载 config 影像')
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'WMS 加载失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="340">
      <div class="map-tool-head">{{ title }}</div>
      <p class="map-tool-desc">
        调用 <code>Layer.addImageryFromWms</code>（XYZ 地址时等效 UrlTemplate），先清除全部影像层，等待 2 秒后再加载
        <code>window.apiConfig.imageryProvider</code>。
      </p>
      <p class="map-tool-desc layer-demo-url">{{ configUrl }}</p>
      <a-button type="primary" block :loading="loading" @click="handleLoad">加载 WMS 图层</a-button>
    </XDialog>
  </div>
</template>

<style scoped>
.layer-demo-url {
  word-break: break-all;
  font-size: 11px;
  opacity: 0.75;
}
</style>
