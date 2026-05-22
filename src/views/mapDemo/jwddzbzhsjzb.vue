<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useXGXCoordinates } from './components/common/useCoordinateDemo'

const title = '经纬度（度）坐标转换世界坐标'
const lon = ref(116.391)
const lat = ref(39.907)
const heightM = ref(100)
const ox = ref('—')
const oy = ref('—')
const oz = ref('—')

function convert() {
  const C = useXGXCoordinates()
  if (!C) return
  if (lon.value == null || lat.value == null || heightM.value == null) {
    return message.warning('请填写经度、纬度、高度')
  }
  const w = C.lngLatHeightToWorldCartesian3(lon.value, lat.value, heightM.value)
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
            <span class="coord-out-label">世界 X（m）</span>
            <code class="coord-out-val">{{ ox }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('世界X', ox)">
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
