<script setup lang="ts">
import { computed } from 'vue'
import { MeasureType } from '../../FastX'
import QuantitativeDemoPanel from './components/common/QuantitativeDemoPanel.vue'
import { useQuantitativeDemo } from './components/common/useQuantitativeDemo'

const TYPE_OPTIONS = [
  {
    value: MeasureType.AZIMUTH,
    label: '方位角',
    hint: '左键加点，右键结束绘制；显示各段自北顺时针方位角',
    desc: '折线各段方位角（度）',
  },
] as const

const { measuring, measureStyle, startMeasure, clearResults, currentHint } = useQuantitativeDemo([...TYPE_OPTIONS])
const hint = computed(() => TYPE_OPTIONS[0]!.hint)
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="方位角测量"
    desc="沿折线测量各段自北顺时针的方位角，适用于导航与朝向分析。"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="startMeasure"
    @clear="clearResults"
  >
    <div v-if="!measuring" class="qty-hint-box">{{ hint }}</div>
  </QuantitativeDemoPanel>
</template>
