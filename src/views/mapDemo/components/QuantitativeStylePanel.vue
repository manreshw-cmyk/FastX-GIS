<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { MeasureStyle } from '../../../FastX'
import { DEFAULT_MEASURE_STYLE } from '../../../FastX/Quantitative/measureStyleDefaults'

const props = defineProps<{
  /** 量算样式（v-model） */
  modelValue: MeasureStyle
  /** 绘制中禁止修改 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [MeasureStyle]
}>()

/** 面板默认收起 */
const expanded = ref(false)
const form = reactive({ ...DEFAULT_MEASURE_STYLE, ...props.modelValue })

/** 表单变更同步到父组件 */
watch(form, () => emit('update:modelValue', { ...form }), { deep: true })

/** 外部样式重置时回填表单 */
watch(() => props.modelValue, (v) => Object.assign(form, DEFAULT_MEASURE_STYLE, v), { deep: true })
</script>

<template>
  <div class="qty-style-panel" :class="{ 'qty-style-panel--collapsed': !expanded }">
    <button type="button" class="qty-style-panel__head" :disabled="disabled" @click="expanded = !expanded">
      <span class="map-tool-row-label">显示样式</span>
      <span class="qty-style-panel__toggle">{{ expanded ? '收起' : '展开' }}</span>
    </button>

    <div v-show="expanded" class="qty-style-panel__body">
      <section class="qty-style-section">
        <div class="qty-style-section__title">线条与填充</div>
        <div class="qty-style-grid">
          <label class="qty-style-field">
            <span>线颜色</span>
            <input v-model="form.lineColor" type="color" :disabled="disabled" />
          </label>
          <label class="qty-style-field">
            <span>填充颜色</span>
            <input v-model="form.fillColor" type="color" :disabled="disabled" />
          </label>
          <label class="qty-style-field qty-style-field--row">
            <span>线宽</span>
            <a-input-number v-model:value="form.lineWidth" :min="1" :max="12" size="small" :disabled="disabled" />
          </label>
        </div>
      </section>

      <section class="qty-style-section">
        <div class="qty-style-section__title">关键点与标注</div>
        <div class="qty-style-grid">
          <label class="qty-style-field">
            <span>点颜色</span>
            <input v-model="form.pointColor" type="color" :disabled="disabled" />
          </label>
          <label class="qty-style-field">
            <span>标注颜色</span>
            <input v-model="form.labelColor" type="color" :disabled="disabled" />
          </label>
          <label class="qty-style-field qty-style-field--row">
            <span>点大小</span>
            <a-input-number v-model:value="form.pointSize" :min="4" :max="24" size="small" :disabled="disabled" />
          </label>
          <label class="qty-style-field qty-style-field--row">
            <span>标注字号</span>
            <a-input-number v-model:value="form.labelSize" :min="10" :max="24" size="small" :disabled="disabled" />
          </label>
          <label class="qty-style-field qty-style-field--check">
            <a-checkbox v-model:checked="form.showKeyPoint" :disabled="disabled">显示关键点</a-checkbox>
          </label>
        </div>
      </section>

      <section class="qty-style-section">
        <div class="qty-style-section__title">通视分析</div>
        <div class="qty-style-grid">
          <label class="qty-style-field">
            <span>通视可见</span>
            <input v-model="form.visibleLineColor" type="color" :disabled="disabled" />
          </label>
          <label class="qty-style-field">
            <span>通视遮挡</span>
            <input v-model="form.invisibleLineColor" type="color" :disabled="disabled" />
          </label>
        </div>
      </section>
    </div>
  </div>
</template>
