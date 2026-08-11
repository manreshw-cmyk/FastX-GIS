<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  MeasureType,
  type CutFillAnalyzeOptions,
  type CutFillBaseHeightMode,
  type CutFillRenderMode,
  type CutFillResult,
} from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  {
    value: MeasureType.CUT_FILL_ANALYZE,
    label: '挖填方分析',
    hint: '左键绘制分析范围，右键或双击结束绘制',
    desc: '按基准高程统计土方量',
  },
] as const

const RENDER_MODE_OPTIONS: Array<{ label: string; value: CutFillRenderMode }> = [
  { label: '平滑贴图', value: 'raster' },
  { label: '网格色块', value: 'grid' },
]

const BASE_HEIGHT_MODE_OPTIONS: Array<{ label: string; value: CutFillBaseHeightMode }> = [
  { label: '平均', value: 'average' },
  { label: '最低', value: 'min' },
  { label: '最高', value: 'max' },
  { label: '自定义', value: 'custom' },
]

interface CutFillDemoForm {
  gridSize: number
  renderMode: CutFillRenderMode
  textureSize: number
  smooth: boolean
  clipToPolygon: boolean
  baseHeightMode: CutFillBaseHeightMode
  baseHeight: number
  heightOffset: number
  tolerance: number
  cutColor: string
  fillColor: string
  flatColor: string
  fillAlpha: number
  showCells: boolean
  showGrid: boolean
  gridColor: string
  showStatsLabel: boolean
}

/** 示例页默认参数，与 API 手册示例代码保持一致。 */
const DEFAULT_FORM: CutFillDemoForm = {
  gridSize: 36,
  renderMode: 'raster',
  textureSize: 768,
  smooth: true,
  clipToPolygon: true,
  baseHeightMode: 'average',
  baseHeight: 0,
  heightOffset: 1.5,
  tolerance: 0.1,
  cutColor: '#ef4444',
  fillColor: '#22c55e',
  flatColor: '#94a3b8',
  fillAlpha: 0.52,
  showCells: true,
  showGrid: true,
  gridColor: '#ffffff',
  showStatsLabel: true,
}

const form = reactive<CutFillDemoForm>({ ...DEFAULT_FORM })
const cutFillResult = ref<CutFillResult | null>(null)

const { measuring, measureStyle, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

const stats = computed(() => cutFillResult.value?.stats)
const showGridControls = computed(() => form.renderMode === 'grid')
const resultVisibleLabel = computed(() => (form.renderMode === 'raster' ? '显示贴图' : '采样单元'))

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

/** 格式化高程。 */
function formatHeight(height: number): string {
  return Number.isFinite(height) ? `${height.toFixed(2)} m` : '-'
}

/** 汇总页面参数并写入本次挖填方分析。 */
function buildCutFillOptions(): CutFillAnalyzeOptions {
  return {
    gridSize: form.gridSize,
    renderMode: form.renderMode,
    textureSize: form.textureSize,
    smooth: form.smooth,
    clipToPolygon: form.clipToPolygon,
    baseHeightMode: form.baseHeightMode,
    baseHeight: form.baseHeight,
    heightOffset: form.heightOffset,
    tolerance: form.tolerance,
    cutColor: form.cutColor,
    fillColor: form.fillColor,
    flatColor: form.flatColor,
    fillAlpha: form.fillAlpha,
    showCells: form.showCells,
    showGrid: form.showGrid,
    gridColor: form.gridColor,
    showStatsLabel: form.showStatsLabel,
    onCutFillChange: (result) => {
      cutFillResult.value = result
    },
  }
}

/** 开始分析前同步挖填方专属参数。 */
async function onStart(): Promise<void> {
  cutFillResult.value = null
  if (window.FastX?.Quantitative) {
    window.FastX.Quantitative.cutFillOptions = buildCutFillOptions()
  }
  await startMeasure()
}

/** 清空地图结果和统计面板。 */
function onClear(): void {
  cutFillResult.value = null
  clearResults()
}
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="挖填方分析"
    desc="框选地形区域后按基准高程统计挖方、填方体积。"
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

    <template v-if="form.renderMode === 'raster'">
      <div class="qty-form-row">
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
        <span class="map-tool-row-label">平滑插值</span>
        <a-switch v-model:checked="form.smooth" size="small" :disabled="measuring" />
      </div>

      <div class="qty-form-row">
        <span class="map-tool-row-label">范围裁剪</span>
        <a-switch v-model:checked="form.clipToPolygon" size="small" :disabled="measuring" />
      </div>
    </template>

    <div class="qty-form-row">
      <span class="map-tool-row-label">基准高程</span>
      <a-radio-group
        v-model:value="form.baseHeightMode"
        size="small"
        button-style="solid"
        :disabled="measuring"
      >
        <a-radio-button v-for="item in BASE_HEIGHT_MODE_OPTIONS" :key="item.value" :value="item.value">
          {{ item.label }}
        </a-radio-button>
      </a-radio-group>
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">自定义高程(m)</span>
      <a-input-number
        v-model:value="form.baseHeight"
        :step="1"
        size="small"
        :disabled="measuring || form.baseHeightMode !== 'custom'"
      />
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
      <span class="map-tool-row-label">平衡阈值(m)</span>
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
      <span class="map-tool-row-label">挖方颜色</span>
      <input v-model="form.cutColor" class="cut-fill-color-input" type="color" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">填方颜色</span>
      <input v-model="form.fillColor" class="cut-fill-color-input" type="color" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">平衡颜色</span>
      <input v-model="form.flatColor" class="cut-fill-color-input" type="color" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">填充透明度</span>
      <a-input-number
        v-model:value="form.fillAlpha"
        :min="0"
        :max="1"
        :step="0.05"
        size="small"
        :disabled="measuring"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">{{ resultVisibleLabel }}</span>
      <a-switch v-model:checked="form.showCells" size="small" :disabled="measuring" />
    </div>

    <div v-if="showGridControls" class="qty-form-row">
      <span class="map-tool-row-label">单元网格</span>
      <a-switch v-model:checked="form.showGrid" size="small" :disabled="measuring || !form.showCells" />
    </div>

    <div v-if="showGridControls" class="qty-form-row">
      <span class="map-tool-row-label">网格颜色</span>
      <input
        v-model="form.gridColor"
        class="cut-fill-color-input"
        type="color"
        :disabled="measuring || !form.showCells || !form.showGrid"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">统计标注</span>
      <a-switch v-model:checked="form.showStatsLabel" size="small" :disabled="measuring" />
    </div>

    <div class="cut-fill-stats">
      <div class="cut-fill-stats__item cut-fill-stats__item--base">
        <span>基准</span>
        <strong>{{ stats ? formatHeight(stats.baseHeight) : '-' }}</strong>
      </div>
      <div class="cut-fill-stats__item cut-fill-stats__item--cut">
        <span>挖方</span>
        <strong>{{ stats ? formatVolume(stats.cutVolume) : '-' }}</strong>
      </div>
      <div class="cut-fill-stats__item cut-fill-stats__item--fill">
        <span>填方</span>
        <strong>{{ stats ? formatVolume(stats.fillVolume) : '-' }}</strong>
      </div>
      <div class="cut-fill-stats__item">
        <span>面积</span>
        <strong>{{ stats ? formatArea(stats.totalArea) : '-' }}</strong>
      </div>
    </div>
  </QuantitativeDemoPanel>
</template>

<style scoped lang="scss">
.cut-fill-color-input {
  width: 72px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.cut-fill-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.cut-fill-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(8, 16, 28, 0.34);
  border: 1px solid rgba(89, 255, 155, 0.14);
  border-radius: 8px;
}

.cut-fill-stats__item {
  min-width: 0;
  padding: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.cut-fill-stats__item span {
  display: block;
  color: rgba(226, 238, 255, 0.58);
  font-size: 11px;
  line-height: 15px;
}

.cut-fill-stats__item strong {
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

.cut-fill-stats__item--cut strong {
  color: #fca5a5;
}

.cut-fill-stats__item--fill strong {
  color: #86efac;
}

.cut-fill-stats__item--base strong {
  color: #bfdbfe;
}
</style>
