<script setup lang="ts">
import SfxSpatialEffectPanel from './common/SfxSpatialEffectPanel.vue'
import { createLazySfxApi, rgbaCss } from './common/useSfxPickDemo'
import {
  attitudeFields,
  optionId,
  positionFields,
  positionFromForm,
  showField,
  type SfxSpatialDemoConfig,
  type SfxSpatialEffectForm,
} from './common/sfx-spatial-demo'
import DiffusionRadar from '../../FastX/SpecialEffects/DiffusionRadar'
import type { DiffusionRadarAddOptions } from '../../FastX/SpecialEffects/DiffusionRadar'

interface DiffusionRadarForm extends SfxSpatialEffectForm {
  radius: number
  startAngle: number
  endAngle: number
  waveCount: number
  duration: number
  segments: number
  lineWidth: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

const DEFAULT_DIFFUSION_RADAR_FORM: DiffusionRadarForm = {
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  scale: 1,
  radius: 400000,
  startAngle: 0,
  endAngle: 360,
  waveCount: 4,
  duration: 2200,
  segments: 128,
  lineWidth: 2,
  color: '#00d6ff',
  colorAlpha: 0.22,
  lineColor: '#00ffff',
  lineAlpha: 0.85,
  show: true,
}

function numberValue(value: unknown): number {
  return Number(value)
}

function colorWithAlpha(color: string, alpha: unknown): string {
  return rgbaCss(color, numberValue(alpha))
}

function createDefaultForm(): DiffusionRadarForm {
  return { ...DEFAULT_DIFFUSION_RADAR_FORM }
}

function buildOptions(raw: SfxSpatialEffectForm): DiffusionRadarAddOptions {
  const form = raw as DiffusionRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: numberValue(form.heading),
    pitch: numberValue(form.pitch),
    roll: numberValue(form.roll),
    scale: numberValue(form.scale),
    radius: numberValue(form.radius),
    startAngle: numberValue(form.startAngle),
    endAngle: numberValue(form.endAngle),
    waveCount: numberValue(form.waveCount),
    duration: numberValue(form.duration),
    segments: numberValue(form.segments),
    lineWidth: numberValue(form.lineWidth),
    color: colorWithAlpha(form.color, form.colorAlpha),
    lineColor: colorWithAlpha(form.lineColor, form.lineAlpha),
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<DiffusionRadarAddOptions> = {
  title: '扩散雷达',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '扩散半径(m)', control: 'number', min: 1 },
    { key: 'startAngle', label: '起始角度(度)', control: 'number', step: 1 },
    { key: 'endAngle', label: '结束角度(度)', control: 'number', step: 1 },
    { key: 'waveCount', label: '波纹数量', control: 'number', min: 1, step: 1 },
    { key: 'duration', label: '扩散时长(ms)', control: 'number', min: 1, step: 100 },
    { key: 'segments', label: '几何密度', control: 'number', min: 8, step: 1 },
    { key: 'lineWidth', label: '波纹线宽(px)', control: 'number', min: 0.1, step: 0.1 },
    { key: 'color', label: '范围面颜色', control: 'color', fallback: '#00d6ff' },
    { key: 'colorAlpha', label: '范围面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '波纹颜色', control: 'color', fallback: '#00ffff' },
    { key: 'lineAlpha', label: '波纹透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(DiffusionRadar),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
