<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { copyResult, useXGXCoordinates } from './components/common/useCoordinateDemo'

const title = '度分秒转换经纬度（度）坐标'

const lonDeg = ref(125)
const lonMin = ref(12)
const lonSec = ref(42.12)
const lonHemi = ref<'E' | 'W'>('E')

const latDeg = ref(23)
const latMin = ref(29)
const latSec = ref(14)
const latHemi = ref<'N' | 'S'>('N')

const outLon = ref('—')
const outLat = ref('—')
const summary = ref('—')

function axis(deg: number, min: number, sec: number, hemi: 'E' | 'W' | 'N' | 'S') {
  return {
    degrees: deg,
    minutes: min,
    seconds: sec,
    hemisphere: hemi,
  }
}

function convert() {
  const C = useXGXCoordinates()
  if (!C) return
  if (
    lonDeg.value == null ||
    lonMin.value == null ||
    lonSec.value == null ||
    latDeg.value == null ||
    latMin.value == null ||
    latSec.value == null
  ) {
    return message.warning('请填写经度、纬度的度、分、秒')
  }
  const r = C.dmsToLngLatDecimal(
    axis(lonDeg.value, lonMin.value, lonSec.value, lonHemi.value),
    axis(latDeg.value, latMin.value, latSec.value, latHemi.value),
  )
  outLon.value = r.longitude.toFixed(8)
  outLat.value = r.latitude.toFixed(8)
  summary.value = `经度 ${outLon.value}°  纬度 ${outLat.value}°`
}

const lonHemiOptions = [
  { value: 'E', label: 'E' },
  { value: 'W', label: 'W' },
]
const latHemiOptions = [
  { value: 'N', label: 'N' },
  { value: 'S', label: 'S' },
]
</script>

<template>
  <div class="map-tool-float map-tool-float--coord">
    <XDialog :width="400">
      <div class="map-tool-head">{{ title }}</div>

      <div class="coord-tool">
        <div class="coord-dms-group">
          <div class="coord-dms-group-title">经度</div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">度 °</span>
            <a-input-number v-model:value="lonDeg" :controls="false" class="coord-num" />
          </div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">分 ′</span>
            <a-input-number v-model:value="lonMin" :controls="false" class="coord-num" />
          </div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">秒 ″</span>
            <a-input-number v-model:value="lonSec" :controls="false" class="coord-num" />
          </div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">半球</span>
            <a-select v-model:value="lonHemi" :options="lonHemiOptions" size="small" class="coord-dms-select" />
          </div>
        </div>

        <div class="coord-dms-group">
          <div class="coord-dms-group-title">纬度</div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">度 °</span>
            <a-input-number v-model:value="latDeg" :controls="false" class="coord-num" />
          </div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">分 ′</span>
            <a-input-number v-model:value="latMin" :controls="false" class="coord-num" />
          </div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">秒 ″</span>
            <a-input-number v-model:value="latSec" :controls="false" class="coord-num" />
          </div>
          <div class="coord-row coord-row-tight">
            <span class="coord-row-label">半球</span>
            <a-select v-model:value="latHemi" :options="latHemiOptions" size="small" class="coord-dms-select" />
          </div>
        </div>

        <div class="coord-actions">
          <a-button type="primary" size="small" class="map-tool-primary-btn" @click="convert">转换</a-button>
        </div>

        <div class="coord-out-block">
          <div class="coord-out-row">
            <span class="coord-out-label">经度（°）</span>
            <code class="coord-out-val">{{ outLon }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('经度', outLon)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">纬度（°）</span>
            <code class="coord-out-val">{{ outLat }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('纬度', outLat)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">整段</span>
            <code class="coord-out-val">{{ summary }}</code>
            <a-tooltip title="复制整段">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('整段', summary)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.coord-dms-select {
  flex: 1;
  min-width: 0;
  max-width: 160px;
}

.coord-dms-select :deep(.ant-select-selector) {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.92);
}

.coord-dms-select :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.55);
}
</style>
