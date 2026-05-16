<script setup lang="ts">
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const map = useMapLayerStore()
const loading = ref(false)

async function resetView() {
  const layer = map.getLayer()
  const c = map.initialMapCenter
  const o = map.initialMapOrientation
  if (!layer) return message.warning('地图尚未就绪')
  if (!c || !o) return message.warning('尚未记录初始视角，请等待地图加载完成')

  loading.value = true
  try {
    await layer.setMapCenter(
      { longitude: c.longitude, latitude: c.latitude, height: c.height },
      { useAnimation: true, duration: 1.8, orientation: o },
    )
    message.success('已复位到初始视角')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="280">
      <div class="map-tool-head">视角复位</div>
      <p class="map-tool-desc">恢复为进入本页地图时记录的相机中心与朝向</p>
      <a-button type="primary" size="small" block class="map-tool-primary-btn" :loading="loading" @click="resetView">复位</a-button>
    </XDialog>
  </div>
</template>
