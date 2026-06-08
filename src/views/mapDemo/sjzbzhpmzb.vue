<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useMapViewer, useXGXCoordinates } from './common/useCoordinateDemo'

const title = '世界坐标转换屏幕坐标'
const wx = ref(-2171400)
const wy = ref(4385500)
const wz = ref(4070400)
const outX = ref('—')
const outY = ref('—')

function convert() {
  const C = useXGXCoordinates()
  const viewer = useMapViewer()
  if (!C || !viewer) return
  if (wx.value == null || wy.value == null || wz.value == null) {
    return message.warning('请填写世界坐标 X、Y、Z')
  }
  const p = C.worldCartesian3ToScreenPoint(viewer, { x: wx.value, y: wy.value, z: wz.value })
  if (!p) {
    outX.value = '—'
    outY.value = '—'
    return
  }
  outX.value = String(p.x.toFixed(4))
  outY.value = String(p.y.toFixed(4))
}
</script>

<template>
  <div class="map-tool-float map-tool-float--coord">
    <XDialog :width="380">
      <div class="map-tool-head">{{ title }}</div>
      <div class="coord-tool">
        <div class="coord-row">
          <span class="coord-row-label">X（m）</span>
          <a-input-number v-model:value="wx" :controls="false" class="coord-num" />
        </div>
        <div class="coord-row">
          <span class="coord-row-label">Y（m）</span>
          <a-input-number v-model:value="wy" :controls="false" class="coord-num" />
        </div>
        <div class="coord-row">
          <span class="coord-row-label">Z（m）</span>
          <a-input-number v-model:value="wz" :controls="false" class="coord-num" />
        </div>
        <div class="coord-actions">
          <a-button type="primary" size="small" class="map-tool-primary-btn" @click="convert">转换</a-button>
        </div>
        <div class="coord-out-block">
          <div class="coord-out-row">
            <span class="coord-out-label">屏幕 X</span>
            <code class="coord-out-val">{{ outX }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" aria-label="复制屏幕X" @click="copyResult('屏幕X', outX)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">屏幕 Y</span>
            <code class="coord-out-val">{{ outY }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" aria-label="复制屏幕Y" @click="copyResult('屏幕Y', outY)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </XDialog>
  </div>
</template>
