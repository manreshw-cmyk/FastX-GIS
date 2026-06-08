<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useMapViewer, useXGXCoordinates } from './common/useCoordinateDemo'

const title = '屏幕坐标转换世界坐标'
const sx = ref(400)
const sy = ref(300)
const ox = ref('—')
const oy = ref('—')
const oz = ref('—')

function convert() {
  const C = useXGXCoordinates()
  const viewer = useMapViewer()
  if (!C || !viewer) return
  if (sx.value == null || sy.value == null) {
    return message.warning('请填写屏幕 X、Y')
  }
  const w = C.screenDrawingBufferToWorldCartesian3(viewer, { x: sx.value, y: sy.value })
  if (!w) {
    ox.value = oy.value = oz.value = '—'
    return
  }
  ox.value = w.x.toFixed(4)
  oy.value = w.y.toFixed(4)
  oz.value = w.z.toFixed(4)
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
            <span class="coord-out-label">世界 X（m）</span>
            <code class="coord-out-val">{{ ox }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" aria-label="复制X" @click="copyResult('世界X', ox)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">世界 Y（m）</span>
            <code class="coord-out-val">{{ oy }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('世界Y', oy)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">世界 Z（m）</span>
            <code class="coord-out-val">{{ oz }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('世界Z', oz)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </XDialog>
  </div>
</template>
