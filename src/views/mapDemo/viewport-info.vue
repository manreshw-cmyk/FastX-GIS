<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const map = useMapLayerStore()
const heightKm = ref('—')
const longitude = ref('—')
const latitude = ref('—')
const heightM = ref('—')

let removePost: (() => void) | null = null
let poll: ReturnType<typeof setInterval> | null = null

function refresh() {
  const layer = map.getLayer()
  const v = layer?.getViewer()
  if (!layer || !v || v.isDestroyed()) return
  heightKm.value = layer.getViewportHeightKm().toFixed(4)
  const c = layer.getCameraCenterLngLatHeight()
  longitude.value = c.longitude.toFixed(6)
  latitude.value = c.latitude.toFixed(6)
  heightM.value = c.height.toFixed(2)
}

function tryAttachPostRender(): boolean {
  const layer = map.getLayer()
  const v = layer?.getViewer()
  if (!layer || !v || v.isDestroyed()) return false
  refresh()
  removePost = v.scene.postRender.addEventListener(refresh)
  return true
}

async function copyLine(label: string, text: string) {
  const t = text.trim()
  if (!t || t === '—') return message.warning('暂无可复制内容')
  try {
    await navigator.clipboard.writeText(t)
    message.success(`已复制${label}`)
  } catch {
    message.error('复制失败')
  }
}

onMounted(() => {
  if (tryAttachPostRender()) return
  poll = setInterval(() => {
    if (tryAttachPostRender() && poll) {
      clearInterval(poll)
      poll = null
    }
  }, 120)
})

onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
  removePost?.()
})
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="340">
      <div class="map-tool-head">视口高度与中心点</div>
      <p class="map-tool-desc">随相机变化实时更新，可逐项复制</p>
      <div class="vp-lines">
        <div class="vp-line">
          <span class="vp-label">高度（km）</span>
          <code class="vp-val">{{ heightKm }}</code>
          <a-tooltip title="复制">
            <a-button
              type="text"
              shape="circle"
              size="small"
              class="vp-copy-btn"
              aria-label="复制高度(km)"
              @click="copyLine('高度(km)', heightKm)"
            >
              <template #icon><CopyOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
        <div class="vp-line">
          <span class="vp-label">经度（°）</span>
          <code class="vp-val">{{ longitude }}</code>
          <a-tooltip title="复制">
            <a-button
              type="text"
              shape="circle"
              size="small"
              class="vp-copy-btn"
              aria-label="复制经度"
              @click="copyLine('经度', longitude)"
            >
              <template #icon><CopyOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
        <div class="vp-line">
          <span class="vp-label">纬度（°）</span>
          <code class="vp-val">{{ latitude }}</code>
          <a-tooltip title="复制">
            <a-button
              type="text"
              shape="circle"
              size="small"
              class="vp-copy-btn"
              aria-label="复制纬度"
              @click="copyLine('纬度', latitude)"
            >
              <template #icon><CopyOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
        <div class="vp-line">
          <span class="vp-label">相机高度（m）</span>
          <code class="vp-val">{{ heightM }}</code>
          <a-tooltip title="复制">
            <a-button
              type="text"
              shape="circle"
              size="small"
              class="vp-copy-btn"
              aria-label="复制高度(m)"
              @click="copyLine('高度(m)', heightM)"
            >
              <template #icon><CopyOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.vp-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vp-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.vp-label {
  flex: 0 0 100px;
  color: rgba(255, 255, 255, 0.72);
}

.vp-val {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(255, 255, 255, 0.92);
}

.vp-copy-btn {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.45) !important;
  width: 28px !important;
  height: 28px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: rgba(120, 200, 255, 0.95) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.12);
  }
}
</style>
