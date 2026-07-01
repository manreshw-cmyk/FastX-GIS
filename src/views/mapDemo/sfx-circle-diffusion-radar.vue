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
import CircleDiffusionRadar from '../../FastX/SpecialEffects/CircleDiffusionRadar'
import type { CircleDiffusionRadarAddOptions } from '../../FastX/SpecialEffects/CircleDiffusionRadar'

interface CircleDiffusionRadarForm extends SfxSpatialEffectForm {
  radius: number
  waveCount: number
  segments: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): CircleDiffusionRadarForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    radius: 100000,
    waveCount: 4,
    segments: 128,
    color: '#00ff78',
    colorAlpha: 0.18,
    lineColor: '#00ff78',
    lineAlpha: 0.9,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): CircleDiffusionRadarAddOptions {
  const form = raw as CircleDiffusionRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    radius: Number(form.radius),
    waveCount: Number(form.waveCount),
    segments: Number(form.segments),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 2,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<CircleDiffusionRadarAddOptions> = {
  title: '扩散雷达圆形',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '扩散半径(m)', control: 'number', min: 1 },
    { key: 'waveCount', label: '波纹数量', control: 'number', min: 1, step: 1 },
    { key: 'segments', label: '几何密度', control: 'number', min: 8, step: 1 },
    { key: 'color', label: '圆形面颜色', control: 'color', fallback: '#00ff78' },
    { key: 'colorAlpha', label: '圆形面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '波纹颜色', control: 'color', fallback: '#00ff78' },
    { key: 'lineAlpha', label: '波纹透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(CircleDiffusionRadar),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
