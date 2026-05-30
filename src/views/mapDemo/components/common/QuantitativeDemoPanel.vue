<script setup lang="ts">
/** 量算分析示例页通用外壳：标题、滚动区、样式面板、底部操作按钮 */
import QuantitativeStylePanel from './QuantitativeStylePanel.vue'
import type { MeasureStyle } from '../../../../FastX'

const props = withDefaults(
  defineProps<{
    title: string
    desc: string
    measuring: boolean
    currentHint: string
    measureStyle: MeasureStyle
    primaryLabel?: string
  }>(),
  { primaryLabel: '开始测量' },
)

const emit = defineEmits<{
  start: []
  clear: []
  'update:measureStyle': [MeasureStyle]
}>()
</script>

<template>
  <div class="map-tool-float map-tool-float--quantitative">
    <XDialog :width="336">
      <div class="qty-dialog-scroll">
        <div class="map-tool-head">{{ title }}</div>
        <p class="map-tool-desc">{{ desc }}</p>

        <div v-if="measuring" class="qty-status-bar">
          <span class="qty-status-dot" aria-hidden="true" />
          <span class="qty-status-text">绘制中 · {{ currentHint }}</span>
        </div>

        <slot />

        <QuantitativeStylePanel
          :model-value="props.measureStyle"
          :disabled="measuring"
          @update:model-value="emit('update:measureStyle', $event)"
        />
      </div>

      <div class="map-tool-actions">
        <a-button type="primary" block class="map-tool-primary-btn" :disabled="measuring" @click="emit('start')">
          {{ primaryLabel }}
        </a-button>
        <a-button block :disabled="measuring" @click="emit('clear')">清空结果</a-button>
      </div>
    </XDialog>
  </div>
</template>
