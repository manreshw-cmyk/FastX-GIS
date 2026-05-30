<script setup lang="ts">
import { computed, reactive } from 'vue'
import { MeasureType, type MeasureTypeKey } from '../../FastX'
import QuantitativeDemoPanel from './components/common/QuantitativeDemoPanel.vue'
import QuantitativeTypeCards from './components/common/QuantitativeTypeCards.vue'
import { useQuantitativeDemo } from './components/common/useQuantitativeDemo'

const TYPE_OPTIONS = [
  { value: MeasureType.CONTOUR_ANALYZE, label: '等高线（矢量）', hint: '左键选择矩形对角两点，生成等高线', desc: '矢量等高线' },
  { value: MeasureType.CONTOUR_ANALYZE_SHADER, label: '等高线 Shader', hint: '左键选择矩形对角两点，Globe 着色', desc: 'Globe 等高带' },
] as const

const form = reactive({ interval: 100 })
const { activeType, measuring, measureStyle, switchType, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const activeOption = computed(() => TYPE_OPTIONS.find((o) => o.value === activeType.value))

/** 开始分析前写入等高距 */
async function onStart(): Promise<void> {
  window.FastX?.Quantitative && (window.FastX.Quantitative.contourInterval = form.interval)
  await startMeasure()
}
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="等高线分析"
    desc="在矩形范围内生成等高线或 Shader 高程带，用于地形高程分析。"
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
      <span class="map-tool-row-label">等高距 (m)</span>
      <a-input-number v-model:value="form.interval" :min="10" :max="5000" :step="50" size="small" :disabled="measuring" />
    </div>
    <div v-if="!measuring && activeOption" class="qty-hint-box">{{ activeOption.hint }}</div>
  </QuantitativeDemoPanel>
</template>
