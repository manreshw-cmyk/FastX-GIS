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
import ParabolaRadar from '../../FastX/SpecialEffects/ParabolaRadar'
import type { ParabolaRadarAddOptions } from '../../FastX/SpecialEffects/ParabolaRadar'

interface ParabolaRadarForm extends SfxSpatialEffectForm {
  radius: number
  effectHeight: number
  segments: number
  radialSegments: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): ParabolaRadarForm {
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
    effectHeight: 30000,
    segments: 96,
    radialSegments: 32,
    color: '#00ff37',
    colorAlpha: 0.3,
    lineColor: '#00ff37',
    lineAlpha: 0.75,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): ParabolaRadarAddOptions {
  const form = raw as ParabolaRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    radius: Number(form.radius),
    height: Number(form.effectHeight),
    segments: Number(form.segments),
    radialSegments: Number(form.radialSegments),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<ParabolaRadarAddOptions> = {
  title: '抛物面雷达',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '底部半径(m)', control: 'number', min: 1 },
    { key: 'effectHeight', label: '抛物面高度(m)', control: 'number', min: 1 },
    { key: 'segments', label: '环向密度', control: 'number', min: 8, step: 1 },
    { key: 'radialSegments', label: '径向密度', control: 'number', min: 2, step: 1 },
    { key: 'color', label: '抛物面颜色', control: 'color', fallback: '#00ff37' },
    { key: 'colorAlpha', label: '抛物面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '网格线颜色', control: 'color', fallback: '#00ff37' },
    { key: 'lineAlpha', label: '网格线透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(ParabolaRadar),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
