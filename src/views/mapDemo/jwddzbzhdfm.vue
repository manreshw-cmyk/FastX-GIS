<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { computed, ref } from 'vue'
import { copyResult, useXGXCoordinates } from './useCoordinateDemo'

const title = '经纬度（度）坐标转换度分秒'
const lon = ref(127.0214)
const lat = ref(23.4872)

/** 含 E/W/N/S */
const lonHemi = ref('—')
const latHemi = ref('—')
const summaryHemi = ref('—')

/** 纯 °′″，无半球字母 */
const lonSym = ref('—')
const latSym = ref('—')
const summarySym = ref('—')

function fmtHemi(axis: { degrees: number; minutes: number; seconds: number; hemisphere: string }) {
  return `${axis.degrees}°${axis.minutes.toFixed(2)}′${axis.seconds.toFixed(2)}″ ${axis.hemisphere}`
}

function convert() {
  const C = useXGXCoordinates()
  if (!C) return
  if (lon.value == null || lat.value == null) {
    return message.warning('请填写经度、纬度')
  }
  const d = C.lngLatDecimalToDms(lon.value, lat.value)
  lonHemi.value = `经度：${fmtHemi(d.longitude)}`
  latHemi.value = `纬度：${fmtHemi(d.latitude)}`
  summaryHemi.value = `${lonHemi.value}  ${latHemi.value}`

  const sym = C.lngLatDecimalToDmsSymbolicStrings(lon.value, lat.value)
  lonSym.value = `经度：${sym.longitude}`
  latSym.value = `纬度：${sym.latitude}`
  summarySym.value = `${lonSym.value}  ${latSym.value}`
}

const canCopyHemi = computed(() => summaryHemi.value !== '—')
const canCopySym = computed(() => summarySym.value !== '—')
</script>

<template>
  <div class="map-tool-float map-tool-float--coord">
    <XDialog :width="420">
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
        <div class="coord-actions">
          <a-button type="primary" size="small" class="map-tool-primary-btn" @click="convert">转换</a-button>
        </div>

        <div class="coord-out-block">
          <div class="coord-subhead">格式一：度分秒 + 半球（E/W、N/S）</div>
          <div class="coord-out-row">
            <span class="coord-out-label">经度</span>
            <code class="coord-out-val">{{ lonHemi }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('经度', lonHemi)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">纬度</span>
            <code class="coord-out-val">{{ latHemi }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('纬度', latHemi)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">整段</span>
            <code class="coord-out-val">{{ summaryHemi }}</code>
            <a-tooltip title="复制整段">
              <a-button
                type="text"
                shape="circle"
                size="small"
                class="coord-copy-btn"
                :disabled="!canCopyHemi"
                @click="copyResult('整段', summaryHemi)"
              >
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>

        <div class="coord-out-block">
          <div class="coord-subhead">格式二：仅 °′″（分、秒均为两位小数；负经/负纬在度数前加负号）</div>
          <div class="coord-out-row">
            <span class="coord-out-label">经度</span>
            <code class="coord-out-val">{{ lonSym }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('经度', lonSym)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">纬度</span>
            <code class="coord-out-val">{{ latSym }}</code>
            <a-tooltip title="复制">
              <a-button type="text" shape="circle" size="small" class="coord-copy-btn" @click="copyResult('纬度', latSym)">
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
          <div class="coord-out-row">
            <span class="coord-out-label">整段</span>
            <code class="coord-out-val">{{ summarySym }}</code>
            <a-tooltip title="复制整段">
              <a-button
                type="text"
                shape="circle"
                size="small"
                class="coord-copy-btn"
                :disabled="!canCopySym"
                @click="copyResult('整段', summarySym)"
              >
                <template #icon><CopyOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </XDialog>
  </div>
</template>
