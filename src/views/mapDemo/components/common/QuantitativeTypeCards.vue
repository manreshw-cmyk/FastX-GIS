<script setup lang="ts">
/** 量算/分析类型单选卡片组 */
import type { MeasureTypeKey } from '../../../../FastX'
import type { MeasureTypeOption } from './useQuantitativeDemo'

withDefaults(
  defineProps<{
    options: readonly MeasureTypeOption[]
    activeType: MeasureTypeKey
    disabled?: boolean
    sectionLabel?: string
  }>(),
  { sectionLabel: '测量类型' },
)

const emit = defineEmits<{
  change: [MeasureTypeKey]
}>()
</script>

<template>
  <div class="map-tool-section">
    <div class="map-tool-row-label">{{ sectionLabel }}</div>
    <a-radio-group
      :value="activeType"
      class="qty-type-cards"
      :disabled="disabled"
      @update:value="emit('change', $event)"
    >
      <a-radio v-for="opt in options" :key="opt.value" :value="opt.value" class="qty-type-card">
        <span class="qty-type-card__body">
          <span class="qty-type-card__title">{{ opt.label }}</span>
          <span v-if="opt.desc" class="qty-type-card__desc">{{ opt.desc }}</span>
        </span>
      </a-radio>
    </a-radio-group>
  </div>
</template>
