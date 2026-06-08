<script setup lang="ts">
import { computed } from 'vue'
import { MeasureType, type MeasureTypeKey } from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import QuantitativeTypeCards from './components/QuantitativeTypeCards.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  { value: MeasureType.SPACE_AREA, label: '空间面积', hint: '左键添加顶点，右键结束绘制', desc: '三维空间多边形面积' },
  { value: MeasureType.PROJECTION_AREA, label: '投影面积', hint: '左键添加顶点，右键结束绘制', desc: '椭球面投影多边形面积' },
] as const

const { activeType, measuring, measureStyle, switchType, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const activeOption = computed(() => TYPE_OPTIONS.find((o) => o.value === activeType.value))
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="面积测量"
    desc="在场景中绘制多边形，测量封闭区域面积，支持空间与投影两种模式。"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="startMeasure"
    @clear="clearResults"
  >
    <QuantitativeTypeCards
      :options="TYPE_OPTIONS"
      :active-type="activeType"
      :disabled="measuring"
      @change="(v: MeasureTypeKey) => switchType(v)"
    />
    <div v-if="!measuring && activeOption" class="qty-hint-box">{{ activeOption.hint }}</div>
  </QuantitativeDemoPanel>
</template>
