<script setup lang="ts">
/**
 * 图层渲染示例 — CZML 卫星轨道。
 *
 * - 从 `satellites.czml` 加载 15 颗卫星（FIXED 笛卡尔采样，非六根数/TLE）
 * - 时钟对齐 CZML 并循环播放；模型 `weixin.gltf`
 * - 探测圆锥由 `satellite-demo.ts` 以 Cesium Entity + CallbackProperty 绘制
 */
import * as Cesium from 'cesium'
import { message } from 'ant-design-vue'
import { onBeforeUnmount, ref } from 'vue'
import { fastxDataUrl, flyToDataSource, useLayerDemoCleanup } from './components/common/layer-demo-shared'
import {
  SATELLITE_CLOCK_HOURS,
  SATELLITES_CZML,
  attachSatelliteSensorCones,
  formatSatelliteClockIso,
  startSatelliteSimulation,
} from './components/common/satellite-demo'

const title = 'CZML'
const DATA_PATH = SATELLITES_CZML
const DATA_URL = fastxDataUrl(DATA_PATH)
const MODEL_PATH = 'model/gltf/weixin.gltf'
const { getLayer, map, cleanup, trackSensorCones } = useLayerDemoCleanup()
const loading = ref(false)
const loaded = ref(false)
const clockLabel = ref('')
const clockPlaying = ref(false)

let removeClockTick: (() => void) | undefined
let stopSimulation: (() => void) | undefined

function bindClockDisplay(viewer: Cesium.Viewer): void {
  removeClockTick?.()
  const onPostRender = () => {
    if (viewer.isDestroyed()) return
    clockLabel.value = formatSatelliteClockIso(viewer.clock.currentTime)
    clockPlaying.value = viewer.clock.shouldAnimate
  }
  viewer.scene.postRender.addEventListener(onPostRender)
  onPostRender()
  removeClockTick = () => viewer.scene.postRender.removeEventListener(onPostRender)
}

onBeforeUnmount(() => {
  removeClockTick?.()
  removeClockTick = undefined
  stopSimulation?.()
  stopSimulation = undefined
})

async function handleLoad() {
  const layer = getLayer()
  const viewer = map.getViewer()
  if (!layer || !viewer || viewer.isDestroyed()) return

  loading.value = true
  try {
    cleanup()
    stopSimulation?.()
    stopSimulation = undefined
    const ds = await layer.loadCzmlDataSource(DATA_URL)
    stopSimulation = startSatelliteSimulation(viewer)
    trackSensorCones(attachSatelliteSensorCones(viewer, ds))
    bindClockDisplay(viewer)
    await flyToDataSource(viewer, ds)
    stopSimulation?.()
    stopSimulation = startSatelliteSimulation(viewer)
    loaded.value = true
    message.success('已从 CZML 加载卫星与探测圆锥')
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'CZML 加载失败')
  } finally {
    loading.value = false
  }
}

function handleClear() {
  cleanup()
  stopSimulation?.()
  stopSimulation = undefined
  removeClockTick?.()
  removeClockTick = undefined
  clockLabel.value = ''
  clockPlaying.value = false
  const viewer = map.getViewer()
  if (viewer && !viewer.isDestroyed()) viewer.clock.shouldAnimate = false
  loaded.value = false
  message.info('已清除 CZML 卫星数据')
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="380">
      <div class="map-tool-head">{{ title }}</div>
      <p class="map-tool-desc">
        加载标准 CZML（FIXED 笛卡尔位置采样，非六根数/TLE）。卫星由 CZML 驱动，探测圆锥为
        <code>Entity + CallbackProperty</code> 绘制并随仿真时钟更新，每圈约 {{ SATELLITE_CLOCK_HOURS }} 小时。
      </p>
      <p class="map-tool-desc layer-demo-path">数据：{{ DATA_PATH }}</p>
      <p class="map-tool-desc layer-demo-path">模型：{{ MODEL_PATH }}</p>
      <p v-if="loaded" class="map-tool-desc layer-demo-clock">
        仿真时刻：{{ clockLabel || '—' }}
        <span class="layer-demo-clock-state">{{ clockPlaying ? '（播放中 ×120）' : '（已暂停）' }}</span>
      </p>
      <a-space direction="vertical" :size="10" style="width: 100%">
        <a-button type="primary" block :loading="loading" @click="handleLoad">加载 CZML 卫星</a-button>
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

.layer-demo-clock {
  font-size: 11px;
  color: rgba(120, 220, 255, 0.88);
}

.layer-demo-clock-state {
  opacity: 0.75;
}
</style>
