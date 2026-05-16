<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useMapViewer, useXGXCoordinates } from './useCoordinateDemo'

const title = '经纬度（度）坐标转换屏幕坐标'
const lon = ref(116.391)
const lat = ref(39.907)
const heightM = ref(100)
const outX = ref('—')
const outY = ref('—')

function convert() {
  const C = useXGXCoordinates()
  const viewer = useMapViewer()
  if (!C || !viewer) return
  if (lon.value == null || lat.value == null || heightM.value == null) {
    return message.warning('请填写经度、纬度、高度')
  }
  const p = C.lngLatHeightToScreenPoint(viewer, lon.value, lat.value, heightM.value)
  if (!p) {
    outX.value = outY.value = '—'
    return
  }
  outX.value = p.x.toFixed(2)
  outY.value = p.y.toFixed(2)
}
</script>

<template>
  <div class="map-tool-float map-tool-float--coord">
    <XDialog :width="380">
      <div class="map-tool-head">{{ title }}</div>
      <div class="coord-tool">
        <div class="coord-row">
          <span class="coord-row-label">经度（°）</span>
          <a-input-number v-model:value="lon" :controls="false" class="coord-num" />
        </div>
        <div class="coord-row">
          <span class="coord-row-label">纬度（°）</span>
          <a-input-number v-model:value="lat" :controls="false" class="coord-num" />
        </div>
        <div class="coord-row">
          <span class="coord-row-label">高度（m）</span>
          <a-input-number v-model:value="heightM" :controls="false" class="coord-num" />
        </div>
        <div class="coord-actions">
          <a-button type="primary" size="small" class="map-tool-primary-btn" @click="convert">转换</a-button>
        </div>
        <div class="coord-out-block">
          <div class="coord-out-row">
            <span class="coord-out-label">屏幕 X</span>
            <code class="coord-out-val">{{ outX }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('屏幕X', outX)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">屏幕 Y</span>
            <code class="coord-out-val">{{ outY }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('屏幕Y', outY)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </XDialog>
  </div>
</template>
