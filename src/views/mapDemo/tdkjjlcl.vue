<script setup lang="ts">
import { computed } from 'vue'
import { MeasureType, type MeasureTypeKey } from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import QuantitativeTypeCards from './components/QuantitativeTypeCards.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  { value: MeasureType.LINE_DISTANCE, label: '空间距离', hint: '左键加点，右键结束绘制', desc: '三维空间直线距离' },
  { value: MeasureType.GROUND_DISTANCE, label: '地表距离', hint: '左键加点，右键结束绘制', desc: '沿地形表面插值' },
  { value: MeasureType.PROJECTION_DISTANCE, label: '投影距离', hint: '左键加点，右键结束绘制', desc: '椭球面测地线距离' },
] as const

const { activeType, measuring, measureStyle, switchType, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const activeOption = computed(() => TYPE_OPTIONS.find((o) => o.value === activeType.value))
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="距离测量"
    desc="在场景中测量两点或多点间的距离，支持空间、地表与投影三种模式。"
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
