<script setup lang="ts">
import { message } from 'ant-design-vue'
import { onBeforeUnmount, ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const title = '点聚合'
const DATA_PATH = 'src/FastX/build/Data/json/point_aggregation.json'
const DATA_URL = new URL('../../FastX/build/Data/json/point_aggregation.json', import.meta.url).href

const map = useMapLayerStore()
const loading = ref(false)
const pointCount = ref(0)

function getApi() {
  const pa = window.FastX?.PointAggregation
  const v = map.getViewer()
  if (!pa || !v || v.isDestroyed()) return null
  return { pa, v }
}

async function handleLoad() {
  const ctx = getApi()
  if (!ctx) return message.warning('地图或 FastX.PointAggregation 未就绪')

  loading.value = true
  try {
    ctx.pa.clear(ctx.v)
    const id = await ctx.pa.load({ viewer: ctx.v, url: DATA_URL })
    if (!id) return message.error('GeoJSON 中未找到有效点要素')
    pointCount.value = ctx.pa.getSnapshot(id)?.featureCount ?? 0
    message.success(`已加载 ${pointCount.value} 个点`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function handleClear() {
  const ctx = getApi()
  if (!ctx) return
  ctx.pa.clear(ctx.v)
  pointCount.value = 0
  message.info('已清除点聚合')
}

onBeforeUnmount(() => {
  const v = map.getViewer()
  if (v && !v.isDestroyed()) window.FastX?.PointAggregation?.clear(v)
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point">
    <XDialog :width="400">
      <template #title>{{ title }}</template>
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">
          <span class="map-tool-head__title">{{ title }}</span>
        </div>
        <a-space direction="vertical" :size="12" class="djjh-main">
          <div class="djjh-actions">
            <a-button type="primary" block class="djjh-btn" :loading="loading" @click="handleLoad">
              加载点聚合
            </a-button>
            <a-button danger block class="djjh-btn djjh-btn--clear" :disabled="!pointCount" @click="handleClear">
              清除
            </a-button>
          </div>
          <div class="djjh-meta">
            <div>数据：{{ DATA_PATH }}</div>
            <div v-if="pointCount">点位：{{ pointCount }} 个</div>
          </div>
          <p class="map-tool-desc">
            GeoJSON 填写 <code>properties.name</code>；缩小为分色聚合圆，放大为图标+名称。共 367 个地级行政区。
          </p>
        </a-space>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/hzd-draw-panel.scss';

.djjh-main {
  width: 100%;
  padding: 0 2px 8px;
}

.djjh-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.djjh-btn {
  height: 38px;
  font-weight: 600;
}

/* 禁用时保留危险按钮底色，仅降低文字对比度 */
.djjh-btn--clear:deep(.ant-btn-dangerous.ant-btn-disabled) {
  opacity: 1;
  cursor: not-allowed;
  color: rgba(255, 255, 255, 0.55) !important;
  background: rgba(220, 38, 38, 0.55) !important;
  border-color: rgba(248, 113, 113, 0.45) !important;
}

.djjh-meta {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.djjh-main code {
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 11px;
  background: rgba(56, 189, 248, 0.12);
  color: #7dd3fc;
}
</style>
