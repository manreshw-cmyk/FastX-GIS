<script setup lang="ts">
import { computed } from 'vue'
import { MeasureType } from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  {
    value: MeasureType.ALTITUDE_INTERCEPT,
    label: '三角测量（高差）',
    hint: '左键选择两点，自动计算空间/水平/垂直距离',
    desc: '两点构成直角三角形',
  },
] as const

const { measuring, measureStyle, startMeasure, clearResults, currentHint } = useQuantitativeDemo([...TYPE_OPTIONS])
const hint = computed(() => TYPE_OPTIONS[0]!.hint)
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="三角测量"
    desc="在场景中选择两点，自动计算空间距离、水平距离与垂直高差。"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="startMeasure"
    @clear="clearResults"
  >
    <div v-if="!measuring" class="qty-hint-box">{{ hint }}</div>
  </QuantitativeDemoPanel>
</template>
