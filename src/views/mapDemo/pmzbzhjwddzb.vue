<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useMapViewer, useXGXCoordinates } from './useCoordinateDemo'

const title = '屏幕坐标转换经纬度（度）坐标'
const sx = ref(400)
const sy = ref(300)
const lon = ref('—')
const lat = ref('—')
const h = ref('—')

function convert() {
  const C = useXGXCoordinates()
  const viewer = useMapViewer()
  if (!C || !viewer) return
  if (sx.value == null || sy.value == null) {
    return message.warning('请填写屏幕 X、Y')
  }
  const ll = C.screenDrawingBufferToLngLatHeight(viewer, { x: sx.value, y: sy.value })
  if (!ll) {
    lon.value = lat.value = h.value = '—'
    return
  }
  lon.value = ll.longitude.toFixed(6)
  lat.value = ll.latitude.toFixed(6)
  h.value = ll.height.toFixed(4)
}
</script>

<template>
  <div class="map-tool-float map-tool-float--coord">
    <XDialog :width="380">
      <div class="map-tool-head">{{ title }}</div>
      <div class="coord-tool">
        <div class="coord-row">
          <span class="coord-row-label">屏幕 X</span>
          <a-input-number v-model:value="sx" :controls="false" class="coord-num" />
        </div>
        <div class="coord-row">
          <span class="coord-row-label">屏幕 Y</span>
          <a-input-number v-model:value="sy" :controls="false" class="coord-num" />
        </div>
        <div class="coord-actions">
          <a-button type="primary" size="small" class="map-tool-primary-btn" @click="convert">转换</a-button>
        </div>
        <div class="coord-out-block">
          <div class="coord-out-row">
            <span class="coord-out-label">经度（°）</span>
            <code class="coord-out-val">{{ lon }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('经度', lon)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">纬度（°）</span>
            <code class="coord-out-val">{{ lat }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('纬度', lat)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">高度（m）</span>
            <code class="coord-out-val">{{ h }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('高度', h)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </XDialog>
  </div>
</template>
