<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useXGXCoordinates } from './common/useCoordinateDemo'

const title = '世界坐标转换经纬度（度）坐标'
const wx = ref(-2171400)
const wy = ref(4385500)
const wz = ref(4070400)
const lon = ref('—')
const lat = ref('—')
const h = ref('—')

function convert() {
  const C = useXGXCoordinates()
  if (!C) return
  if (wx.value == null || wy.value == null || wz.value == null) {
    return message.warning('请填写世界坐标 X、Y、Z')
  }
  const ll = C.worldCartesian3ToLngLatHeight({ x: wx.value, y: wy.value, z: wz.value })
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
