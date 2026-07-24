<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  MeasureType,
  type FloodAnalyzeOptions,
  type FloodResult,
  type FloodWaterLevelMode,
} from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  {
    value: MeasureType.FLOOD_ANALYZE,
    label: '淹没分析',
    hint: '左键绘制淹没范围，右键或双击结束绘制',
    desc: '按水位统计淹没面积和蓄水体积',
  },
] as const

const WATER_LEVEL_MODE_OPTIONS: Array<{ label: string; value: FloodWaterLevelMode }> = [
  { label: '最低点抬升', value: 'relativeToMin' },
  { label: '均值抬升', value: 'relativeToAverage' },
  { label: '绝对高程', value: 'absolute' },
]

interface FloodDemoForm {
  gridSize: number
  waterLevelMode: FloodWaterLevelMode
  waterLevel: number
  tolerance: number
  heightOffset: number
  waterColor: string
  dryColor: string
  waterAlpha: number
  dryAlpha: number
  showFloodedCells: boolean
  showDryCells: boolean
  showGrid: boolean
  gridColor: string
  showStatsLabel: boolean
}

/** 示例页默认参数，与 API 手册示例保持一致。 */
const DEFAULT_FORM: FloodDemoForm = {
  gridSize: 40,
  waterLevelMode: 'relativeToMin',
  waterLevel: 30,
  tolerance: 0,
  heightOffset: 1.5,
  waterColor: '#22d3ee',
  dryColor: '#f59e0b',
  waterAlpha: 0.58,
  dryAlpha: 0.2,
  showFloodedCells: true,
  showDryCells: false,
  showGrid: false,
  gridColor: '#ffffff',
  showStatsLabel: true,
}

const form = reactive<FloodDemoForm>({ ...DEFAULT_FORM })
const floodResult = ref<FloodResult | null>(null)

const { measuring, measureStyle, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const stats = computed(() => floodResult.value?.stats)

/** 格式化面积。 */
function formatArea(area: number): string {
  if (!Number.isFinite(area)) return '-'
  if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`
  return `${area.toFixed(2)} m²`
}

/** 格式化体积。 */
function formatVolume(volume: number): string {
  if (!Number.isFinite(volume)) return '-'
  if (volume >= 10_000) return `${(volume / 10_000).toFixed(2)} 万m³`
  return `${volume.toFixed(2)} m³`
}

/** 格式化高程或水深。 */
function formatHeight(height: number): string {
  return Number.isFinite(height) ? `${height.toFixed(2)} m` : '-'
}

/** 汇总页面参数并写入本次淹没分析。 */
function buildFloodOptions(): FloodAnalyzeOptions {
  return {
    gridSize: form.gridSize,
    waterLevelMode: form.waterLevelMode,
    waterLevel: form.waterLevel,
    tolerance: form.tolerance,
    heightOffset: form.heightOffset,
    waterColor: form.waterColor,
    dryColor: form.dryColor,
    waterAlpha: form.waterAlpha,
    dryAlpha: form.dryAlpha,
    showFloodedCells: form.showFloodedCells,
    showDryCells: form.showDryCells,
    showGrid: form.showGrid,
    gridColor: form.gridColor,
    showStatsLabel: form.showStatsLabel,
    onFloodChange: (result) => {
      floodResult.value = result
    },
  }
}

/** 开始分析前同步淹没分析专属参数。 */
async function onStart(): Promise<void> {
  floodResult.value = null
  if (window.FastX?.Quantitative) {
    window.FastX.Quantitative.floodOptions = buildFloodOptions()
  }
  await startMeasure()
}

/** 清空地图结果和统计面板。 */
function onClear(): void {
  floodResult.value = null
  clearResults()
}
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="淹没分析"
    desc="框选地形区域后按水位生成淹没范围，并统计面积、水量和最大水深。"
    primary-label="开始分析"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="onStart"
    @clear="onClear"
  >
    <div class="qty-form-row">
      <span class="map-tool-row-label">采样密度</span>
      <a-input-number
        v-model:value="form.gridSize"
        :min="4"
        :max="100"
        :step="4"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">水位模式</span>
      <a-radio-group
        v-model:value="form.waterLevelMode"
        size="small"
        button-style="solid"
        :disabled="measuring"
      >
        <a-radio-button v-for="item in WATER_LEVEL_MODE_OPTIONS" :key="item.value" :value="item.value">
          {{ item.label }}
        </a-radio-button>
      </a-radio-group>
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">水位高度(m)</span>
      <a-input-number
        v-model:value="form.waterLevel"
        :step="1"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">水深阈值(m)</span>
      <a-input-number
        v-model:value="form.tolerance"
        :min="0"
        :max="100"
        :step="0.1"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">高度偏移(m)</span>
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
      <span class="map-tool-row-label">淹没颜色</span>
      <input v-model="form.waterColor" class="flood-color-input" type="color" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">未淹没颜色</span>
      <input v-model="form.dryColor" class="flood-color-input" type="color" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">水面透明度</span>
      <a-input-number
        v-model:value="form.waterAlpha"
        :min="0"
        :max="1"
        :step="0.05"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">未淹没透明度</span>
      <a-input-number
        v-model:value="form.dryAlpha"
        :min="0"
        :max="1"
        :step="0.05"
        size="small"
        :disabled="measuring || !form.showDryCells"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">淹没单元</span>
      <a-switch v-model:checked="form.showFloodedCells" size="small" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">未淹没单元</span>
      <a-switch v-model:checked="form.showDryCells" size="small" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">单元网格</span>
      <a-switch v-model:checked="form.showGrid" size="small" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">网格颜色</span>
      <input
        v-model="form.gridColor"
        class="flood-color-input"
        type="color"
        :disabled="measuring || !form.showGrid"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">统计标注</span>
      <a-switch v-model:checked="form.showStatsLabel" size="small" :disabled="measuring" />
    </div>

    <div class="flood-stats">
      <div class="flood-stats__item flood-stats__item--water">
        <span>水位</span>
        <strong>{{ stats ? formatHeight(stats.waterLevel) : '-' }}</strong>
      </div>
      <div class="flood-stats__item flood-stats__item--area">
        <span>淹没面积</span>
        <strong>{{ stats ? formatArea(stats.floodedArea) : '-' }}</strong>
      </div>
      <div class="flood-stats__item flood-stats__item--volume">
        <span>蓄水体积</span>
        <strong>{{ stats ? formatVolume(stats.floodedVolume) : '-' }}</strong>
      </div>
      <div class="flood-stats__item">
        <span>最大水深</span>
        <strong>{{ stats ? formatHeight(stats.maxWaterDepth) : '-' }}</strong>
      </div>
    </div>
  </QuantitativeDemoPanel>
</template>

<style scoped lang="scss">
.flood-color-input {
  width: 72px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.flood-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.flood-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(8, 16, 28, 0.34);
  border: 1px solid rgba(34, 211, 238, 0.16);
  border-radius: 8px;
}

.flood-stats__item {
  min-width: 0;
  padding: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.flood-stats__item span {
  display: block;
  color: rgba(226, 238, 255, 0.58);
  font-size: 11px;
  line-height: 15px;
}

.flood-stats__item strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: rgba(226, 238, 255, 0.9);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flood-stats__item--water strong {
  color: #67e8f9;
}

.flood-stats__item--area strong {
  color: #7dd3fc;
}

.flood-stats__item--volume strong {
  color: #a5f3fc;
}
</style>
