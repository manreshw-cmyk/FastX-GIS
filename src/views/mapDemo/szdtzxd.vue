<script setup lang="ts">
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const map = useMapLayerStore()
const lon = ref<number | null>(null)
const lat = ref<number | null>(null)
const h = ref<number | null>(null)
const loading = ref(false)

onMounted(() => {
  const layer = map.getLayer()
  if (!layer) return
  const c = layer.getCameraCenterLngLatHeight()
  lon.value = Number(c.longitude.toFixed(6))
  lat.value = Number(c.latitude.toFixed(6))
  h.value = Math.round(c.height)
})

async function applyCenter() {
  const layer = map.getLayer()
  if (!layer) return message.warning('地图尚未就绪')
  if (lon.value == null || lat.value == null || h.value == null) {
    return message.warning('请填写经度、纬度与高度')
  }
  loading.value = true
  try {
    await layer.setMapCenter(
      { longitude: lon.value, latitude: lat.value, height: h.value },
      { useAnimation: true, duration: 1.8 },
    )
    message.success('已飞向新中心')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="300">
      <div class="map-tool-head">设置地图中心点</div>
      <p class="map-tool-desc">经纬度单位为度，高度为米（椭球高）</p>
      <a-space direction="vertical" :size="10" style="width: 100%">
        <div class="field">
          <span class="field-label">经度 °</span>
          <a-input-number v-model:value="lon" class="field-input" placeholder="经度" />
        </div>
        <div class="field">
          <span class="field-label">纬度 °</span>
          <a-input-number v-model:value="lat" class="field-input" placeholder="纬度" />
        </div>
        <div class="field">
          <span class="field-label">高度 m</span>
          <a-input-number v-model:value="h" class="field-input" placeholder="高度" />
        </div>
        <a-button type="primary" size="small" block class="map-tool-primary-btn" :loading="loading" @click="applyCenter">
          确定
        </a-button>
      </a-space>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.field-input {
  width: 100% !important;
}
</style>
