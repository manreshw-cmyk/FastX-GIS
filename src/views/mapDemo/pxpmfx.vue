<script setup lang="ts">
import { reactive } from 'vue'
import {
  DEFAULT_ASPECT_GRADES,
  MeasureType,
  type AspectAnalyzeOptions,
  type AspectRenderMode,
} from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  {
    value: MeasureType.ASPECT_ANALYZE,
    label: '坡向/坡面分析',
    hint: '左键选择矩形对角两点，生成坡向分级贴图',
    desc: '地形坡面朝向分级',
  },
] as const

const RENDER_MODE_OPTIONS: Array<{ label: string; value: AspectRenderMode }> = [
  { label: '平滑贴图', value: 'raster' },
  { label: '网格色块', value: 'grid' },
]

interface AspectDemoForm {
  renderMode: AspectRenderMode
  gridSize: number
  textureSize: number
  fillAlpha: number
  smooth: boolean
  shadeStrength: number
  flatSlopeThreshold: number
  flatColor: string
  heightOffset: number
  showGrid: boolean
  gridColor: string
  gridWidth: number
  showStatsLabel: boolean
}

/** 示例页默认参数，与 API 手册示例保持一致。 */
const DEFAULT_FORM: AspectDemoForm = {
  renderMode: 'raster',
  gridSize: 48,
  textureSize: 768,
  fillAlpha: 0.58,
  smooth: true,
  shadeStrength: 0.25,
  flatSlopeThreshold: 1,
  flatColor: '#d1d5db',
  heightOffset: 1.5,
  showGrid: false,
  gridColor: '#ffffff',
  gridWidth: 1,
  showStatsLabel: true,
}

const form = reactive<AspectDemoForm>({ ...DEFAULT_FORM })

const { measuring, measureStyle, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

/** 汇总页面参数并写入本次坡向/坡面分析。 */
function buildAspectOptions(): AspectAnalyzeOptions {
  return {
    renderMode: form.renderMode,
    gridSize: form.gridSize,
    textureSize: form.textureSize,
    fillAlpha: form.fillAlpha,
    smooth: form.smooth,
    shadeStrength: form.shadeStrength,
    flatSlopeThreshold: form.flatSlopeThreshold,
    flatColor: form.flatColor,
    heightOffset: form.heightOffset,
    showGrid: form.showGrid,
    gridColor: form.gridColor,
    gridWidth: form.gridWidth,
    showStatsLabel: form.showStatsLabel,
    grades: DEFAULT_ASPECT_GRADES,
  }
}

/** 开始分析前同步坡向专属参数。 */
async function onStart(): Promise<void> {
  if (window.FastX?.Quantitative) {
    window.FastX.Quantitative.aspectOptions = buildAspectOptions()
  }
  await startMeasure()
}
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="坡向/坡面分析"
    desc="框选地形区域后按坡面朝向生成连续分级覆盖层。"
    primary-label="开始分析"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="onStart"
    @clear="clearResults"
  >
    <div class="qty-form-row">
      <span class="map-tool-row-label">渲染模式</span>
      <a-radio-group
        v-model:value="form.renderMode"
        size="small"
        button-style="solid"
        :disabled="measuring"
      >
        <a-radio-button v-for="item in RENDER_MODE_OPTIONS" :key="item.value" :value="item.value">
          {{ item.label }}
        </a-radio-button>
      </a-radio-group>
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">采样密度</span>
      <a-input-number
        v-model:value="form.gridSize"
        :min="4"
        :max="120"
        :step="4"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div v-if="form.renderMode === 'raster'" class="qty-form-row">
      <span class="map-tool-row-label">贴图分辨率</span>
      <a-input-number
        v-model:value="form.textureSize"
        :min="128"
        :max="2048"
        :step="128"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">覆盖透明度</span>
      <a-input-number
        v-model:value="form.fillAlpha"
        :min="0"
        :max="1"
        :step="0.05"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div v-if="form.renderMode === 'raster'" class="qty-form-row">
      <span class="map-tool-row-label">平滑过渡</span>
      <a-switch v-model:checked="form.smooth" size="small" :disabled="measuring" />
    </div>

    <div v-if="form.renderMode === 'raster'" class="qty-form-row">
      <span class="map-tool-row-label">地形明暗</span>
      <a-input-number
        v-model:value="form.shadeStrength"
        :min="0"
        :max="1"
        :step="0.05"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">平地阈值(°)</span>
      <a-input-number
        v-model:value="form.flatSlopeThreshold"
        :min="0"
        :max="15"
        :step="0.5"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">平地颜色</span>
      <input v-model="form.flatColor" class="aspect-color-input" type="color" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">高程偏移(m)</span>
      <a-input-number
        v-model:value="form.heightOffset"
        :min="0"
        :max="50"
        :step="0.5"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">采样网格</span>
      <a-switch v-model:checked="form.showGrid" size="small" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">网格颜色</span>
      <input v-model="form.gridColor" class="aspect-color-input" type="color" :disabled="measuring || !form.showGrid" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">网格线宽</span>
      <a-input-number
        v-model:value="form.gridWidth"
        :min="1"
        :max="8"
        :step="1"
        size="small"
        :disabled="measuring || !form.showGrid"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">统计标注</span>
      <a-switch v-model:checked="form.showStatsLabel" size="small" :disabled="measuring" />
    </div>

    <div class="aspect-legend">
      <div class="aspect-legend__item">
        <span class="aspect-legend__swatch" :style="{ backgroundColor: form.flatColor }" />
        <span class="aspect-legend__label">平地</span>
      </div>
      <div v-for="grade in DEFAULT_ASPECT_GRADES" :key="grade.label" class="aspect-legend__item">
        <span class="aspect-legend__swatch" :style="{ backgroundColor: grade.color }" />
        <span class="aspect-legend__label">{{ grade.label }}</span>
      </div>
    </div>
  </QuantitativeDemoPanel>
</template>

<style scoped lang="scss">
.aspect-color-input {
  width: 72px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.aspect-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.aspect-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(8, 16, 28, 0.34);
  border: 1px solid rgba(89, 255, 155, 0.14);
  border-radius: 8px;
}

.aspect-legend__item {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.aspect-legend__swatch {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 3px;
}

.aspect-legend__label {
  min-width: 0;
  overflow: hidden;
  color: rgba(226, 238, 255, 0.78);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
