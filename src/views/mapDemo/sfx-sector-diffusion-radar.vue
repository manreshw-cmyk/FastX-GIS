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
import SectorDiffusionRadar from '../../FastX/SpecialEffects/SectorDiffusionRadar'
import type { SectorDiffusionRadarAddOptions } from '../../FastX/SpecialEffects/SectorDiffusionRadar'

interface SectorDiffusionRadarForm extends SfxSpatialEffectForm {
  radius: number
  angle: number
  waveCount: number
  segments: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): SectorDiffusionRadarForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    radius: 400000,
    angle: 90,
    waveCount: 4,
    segments: 96,
    color: '#00b4ff',
    colorAlpha: 0.2,
    lineColor: '#00ffff',
    lineAlpha: 0.85,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): SectorDiffusionRadarAddOptions {
  const form = raw as SectorDiffusionRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    radius: Number(form.radius),
    angle: Number(form.angle),
    waveCount: Number(form.waveCount),
    segments: Number(form.segments),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 2,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<SectorDiffusionRadarAddOptions> = {
  title: '扩散雷达扇形',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '扩散半径(m)', control: 'number', min: 1 },
    { key: 'angle', label: '扇形角度(度)', control: 'number', min: 1, max: 359 },
    { key: 'waveCount', label: '波纹数量', control: 'number', min: 1, step: 1 },
    { key: 'segments', label: '几何密度', control: 'number', min: 8, step: 1 },
    { key: 'color', label: '扇形面颜色', control: 'color', fallback: '#00b4ff' },
    { key: 'colorAlpha', label: '扇形面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '波纹颜色', control: 'color', fallback: '#00ffff' },
    { key: 'lineAlpha', label: '波纹透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(SectorDiffusionRadar),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
