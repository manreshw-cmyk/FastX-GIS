<script setup lang="ts">
import { computed, reactive } from 'vue'
import { MeasureType, type MeasureTypeKey } from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import QuantitativeTypeCards from './components/QuantitativeTypeCards.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  { value: MeasureType.POINT_BUFFER_ANALYZE, label: '点缓冲区', hint: '左键单击圆心位置', desc: '以点为中心外扩' },
  { value: MeasureType.LINE_BUFFER_ANALYZE, label: '线缓冲区', hint: '左键绘制折线，右键结束绘制', desc: '沿折线两侧外扩' },
  { value: MeasureType.PLANE_BUFFER_ANALYZE, label: '面缓冲区', hint: '左键绘制多边形，右键结束绘制', desc: '多边形外扩缓冲环' },
] as const

const form = reactive({ bufferWidth: 1000 })
const { activeType, measuring, measureStyle, switchType, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const activeOption = computed(() => TYPE_OPTIONS.find((o) => o.value === activeType.value))

/** 开始分析前写入缓冲半径 */
async function onStart(): Promise<void> {
  if (window.FastX?.Quantitative) window.FastX.Quantitative.bufferWidth = form.bufferWidth
  await startMeasure()
}
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="缓冲区分析"
    desc="对点、线、面要素按指定半径生成缓冲区，用于影响范围分析。"
    primary-label="开始分析"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="onStart"
    @clear="clearResults"
  >
    <QuantitativeTypeCards
      section-label="分析类型"
      :options="TYPE_OPTIONS"
      :active-type="activeType"
      :disabled="measuring"
      @change="(v: MeasureTypeKey) => switchType(v)"
    />
    <div class="qty-form-row">
      <span class="map-tool-row-label">缓冲半径 (m)</span>
      <a-input-number v-model:value="form.bufferWidth" :min="10" :max="50000" :step="100" size="small" :disabled="measuring" />
    </div>
    <div v-if="!measuring && activeOption" class="qty-hint-box">{{ activeOption.hint }}</div>
  </QuantitativeDemoPanel>
</template>
