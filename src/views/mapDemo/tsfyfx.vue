<script setup lang="ts">
import { computed } from 'vue'
import { MeasureType, type MeasureTypeKey } from '../../FastX'
import QuantitativeDemoPanel from './components/common/QuantitativeDemoPanel.vue'
import QuantitativeTypeCards from './components/common/QuantitativeTypeCards.vue'
import { useQuantitativeDemo } from './components/common/useQuantitativeDemo'

const TYPE_OPTIONS = [
  { value: MeasureType.LINE_ANALYZE, label: '直线通视', hint: '左键选择观测点与目标点', desc: '两点间通视判断' },
  { value: MeasureType.AREA_ANALYZE, label: '圆形通视', hint: '左键选择圆心与半径点', desc: '圆形范围通视分析' },
  { value: MeasureType.MULTI_POINT_ANALYZE, label: '多点通视', hint: '第一点为观测点，后续为目标点；右键结束', desc: '一对多通视分析' },
  { value: MeasureType.VIEWSHED_ANALYZE, label: '视域分析', hint: '左键选择观测点与目标方向点', desc: '视域范围示意' },
] as const

const { activeType, measuring, measureStyle, switchType, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const activeOption = computed(() => TYPE_OPTIONS.find((o) => o.value === activeType.value))
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="通视与视域分析"
    desc="直线、圆形、多点通视与视域分析，用于观测点与目标点之间的可见性判断。"
    primary-label="开始分析"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="startMeasure"
    @clear="clearResults"
  >
    <QuantitativeTypeCards
      section-label="分析类型"
      :options="TYPE_OPTIONS"
      :active-type="activeType"
      :disabled="measuring"
      @change="(v: MeasureTypeKey) => switchType(v)"
    />
    <div v-if="!measuring && activeOption" class="qty-hint-box">{{ activeOption.hint }}</div>
  </QuantitativeDemoPanel>
</template>
