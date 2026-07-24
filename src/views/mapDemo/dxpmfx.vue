<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import {
  MeasureType,
  type TerrainProfileAnalyzeOptions,
  type TerrainProfileResult,
} from '../../FastX'
import QuantitativeDemoPanel from './components/QuantitativeDemoPanel.vue'
import { useQuantitativeDemo } from './common/useQuantitativeDemo.ts'

const TYPE_OPTIONS = [
  {
    value: MeasureType.TERRAIN_PROFILE_ANALYZE,
    label: '地形剖面分析',
    hint: '左键沿地形加点，右键或双击结束绘制',
    desc: '沿线地形高程剖面',
  },
] as const

interface TerrainProfileDemoForm {
  sampleCount: number
  heightOffset: number
  showProfileLine: boolean
  profileLineColor: string
  profileLineWidth: number
  showSamplePoints: boolean
  samplePointEvery: number
  samplePointColor: string
  samplePointSize: number
  showStatsLabel: boolean
}

/** 示例页默认参数，与 API 手册示例保持一致。 */
const DEFAULT_FORM: TerrainProfileDemoForm = {
  sampleCount: 120,
  heightOffset: 2,
  showProfileLine: true,
  profileLineColor: '#59ff9b',
  profileLineWidth: 3,
  showSamplePoints: false,
  samplePointEvery: 8,
  samplePointColor: '#facc15',
  samplePointSize: 5,
  showStatsLabel: true,
}

const form = reactive<TerrainProfileDemoForm>({ ...DEFAULT_FORM })
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const profileResult = ref<TerrainProfileResult | null>(null)

const { measuring, measureStyle, startMeasure, clearResults, currentHint } =
  useQuantitativeDemo([...TYPE_OPTIONS])

/** 格式化距离。 */
function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '-'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(2)} m`
}

/** 格式化高程。 */
function formatHeight(meters: number): string {
  return Number.isFinite(meters) ? `${meters.toFixed(2)} m` : '-'
}

/** 绘制剖面曲线。 */
function drawProfileChart(): void {
  const canvas = chartCanvas.value
  if (!canvas) return
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(canvas.clientWidth, 280)
  const height = 148
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const padding = { left: 34, right: 14, top: 14, bottom: 24 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  ctx.strokeStyle = 'rgba(180, 220, 255, 0.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight)

  const result = profileResult.value
  if (!result?.points.length) {
    ctx.fillStyle = 'rgba(226, 238, 255, 0.55)'
    ctx.font = '12px sans-serif'
    ctx.fillText('暂无剖面数据', padding.left + 10, padding.top + 28)
    return
  }

  const { points, stats } = result
  const minHeight = stats.minHeight
  const maxHeight = stats.maxHeight
  const heightSpan = Math.max(maxHeight - minHeight, 1)
  const totalDistance = Math.max(stats.totalDistance, 1)

  const toX = (distance: number) => padding.left + (distance / totalDistance) * plotWidth
  const toY = (h: number) => padding.top + (1 - (h - minHeight) / heightSpan) * plotHeight

  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight)
  gradient.addColorStop(0, 'rgba(89, 255, 155, 0.34)')
  gradient.addColorStop(1, 'rgba(45, 212, 191, 0.04)')

  ctx.beginPath()
  points.forEach((point, index) => {
    const x = toX(point.distance)
    const y = toY(point.height)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.lineTo(toX(totalDistance), padding.top + plotHeight)
  ctx.lineTo(toX(0), padding.top + plotHeight)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  ctx.beginPath()
  points.forEach((point, index) => {
    const x = toX(point.distance)
    const y = toY(point.height)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = form.profileLineColor
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(226, 238, 255, 0.72)'
  ctx.font = '10px sans-serif'
  ctx.fillText(formatHeight(maxHeight), 4, padding.top + 8)
  ctx.fillText(formatHeight(minHeight), 4, padding.top + plotHeight)
  ctx.fillText(formatDistance(totalDistance), width - 68, height - 7)
}

/** 汇总页面参数并写入本次地形剖面分析。 */
function buildTerrainProfileOptions(): TerrainProfileAnalyzeOptions {
  return {
    sampleCount: form.sampleCount,
    heightOffset: form.heightOffset,
    showProfileLine: form.showProfileLine,
    profileLineColor: form.profileLineColor,
    profileLineWidth: form.profileLineWidth,
    showSamplePoints: form.showSamplePoints,
    samplePointEvery: form.samplePointEvery,
    samplePointColor: form.samplePointColor,
    samplePointSize: form.samplePointSize,
    showStatsLabel: form.showStatsLabel,
    onProfileChange: (result) => {
      profileResult.value = result
      void nextTick(drawProfileChart)
    },
  }
}

/** 开始分析前同步地形剖面专属参数。 */
async function onStart(): Promise<void> {
  profileResult.value = null
  await nextTick(drawProfileChart)
  if (window.FastX?.Quantitative) {
    window.FastX.Quantitative.terrainProfileOptions = buildTerrainProfileOptions()
  }
  await startMeasure()
}

/** 清空地图结果和剖面曲线。 */
function onClear(): void {
  profileResult.value = null
  void nextTick(drawProfileChart)
  clearResults()
}

void nextTick(drawProfileChart)
</script>

<template>
  <QuantitativeDemoPanel
    v-model:measure-style="measureStyle"
    title="地形剖面分析"
    desc="沿绘制折线采样地形高程，生成剖面统计与曲线。"
    primary-label="开始分析"
    :measuring="measuring"
    :current-hint="currentHint()"
    @start="onStart"
    @clear="onClear"
  >
    <div class="qty-form-row">
      <span class="map-tool-row-label">采样点数</span>
      <a-input-number
        v-model:value="form.sampleCount"
        :min="2"
        :max="1024"
        :step="10"
        size="small"
        :disabled="measuring"
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
      <span class="map-tool-row-label">剖面线</span>
      <a-switch v-model:checked="form.showProfileLine" size="small" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">剖面线颜色</span>
      <input
        v-model="form.profileLineColor"
        class="profile-color-input"
        type="color"
        :disabled="measuring || !form.showProfileLine"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">剖面线宽</span>
      <a-input-number
        v-model:value="form.profileLineWidth"
        :min="1"
        :max="10"
        :step="1"
        size="small"
        :disabled="measuring || !form.showProfileLine"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">采样点</span>
      <a-switch v-model:checked="form.showSamplePoints" size="small" :disabled="measuring" />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">点显示间隔</span>
      <a-input-number
        v-model:value="form.samplePointEvery"
        :min="1"
        :max="100"
        :step="1"
        size="small"
        :disabled="measuring || !form.showSamplePoints"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">采样点颜色</span>
      <input
        v-model="form.samplePointColor"
        class="profile-color-input"
        type="color"
        :disabled="measuring || !form.showSamplePoints"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">采样点大小</span>
      <a-input-number
        v-model:value="form.samplePointSize"
        :min="1"
        :max="18"
        :step="1"
        size="small"
        :disabled="measuring || !form.showSamplePoints"
      />
    </div>

    <div class="qty-form-row">
      <span class="map-tool-row-label">统计标注</span>
      <a-switch v-model:checked="form.showStatsLabel" size="small" :disabled="measuring" />
    </div>

    <div class="profile-chart-panel">
      <canvas ref="chartCanvas" class="profile-chart" />
      <div v-if="profileResult" class="profile-stats">
        <span>总距 {{ formatDistance(profileResult.stats.totalDistance) }}</span>
        <span>高差 {{ formatHeight(profileResult.stats.heightDiff) }}</span>
        <span>均高 {{ formatHeight(profileResult.stats.avgHeight) }}</span>
      </div>
    </div>
  </QuantitativeDemoPanel>
</template>

<style scoped lang="scss">
.profile-color-input {
  width: 72px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.profile-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.profile-chart-panel {
  margin-top: 8px;
  padding: 8px;
  background: rgba(8, 16, 28, 0.34);
  border: 1px solid rgba(89, 255, 155, 0.14);
  border-radius: 8px;
}

.profile-chart {
  display: block;
  width: 100%;
  height: 148px;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
  color: rgba(226, 238, 255, 0.76);
  font-size: 11px;
  line-height: 16px;
}

.profile-stats span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
