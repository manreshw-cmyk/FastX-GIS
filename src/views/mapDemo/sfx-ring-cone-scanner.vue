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
import RingConeScanner from '../../FastX/SpecialEffects/RingConeScanner'
import type { RingConeScannerAddOptions } from '../../FastX/SpecialEffects/RingConeScanner'

interface RingConeScannerForm extends SfxSpatialEffectForm {
  radius: number
  minElevationAngle: number
  maxElevationAngle: number
  segments: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): RingConeScannerForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    radius: 500000,
    minElevationAngle: 45,
    maxElevationAngle: 60,
    segments: 96,
    color: '#59ff9b',
    colorAlpha: 0.55,
    lineColor: '#59ff9b',
    lineAlpha: 1,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): RingConeScannerAddOptions {
  const form = raw as RingConeScannerForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    radius: Number(form.radius),
    minElevationAngle: Number(form.minElevationAngle),
    maxElevationAngle: Number(form.maxElevationAngle),
    segments: Number(form.segments),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<RingConeScannerAddOptions> = {
  title: '双圆锥环面扫描体',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '探测半径(m)', control: 'number', min: 1 },
    { key: 'minElevationAngle', label: '最小仰角(度)', control: 'number', min: -90, max: 90 },
    { key: 'maxElevationAngle', label: '最大仰角(度)', control: 'number', min: -90, max: 90 },
    { key: 'segments', label: '环向密度', control: 'number', min: 8, step: 1 },
    { key: 'color', label: '环面颜色', control: 'color', fallback: '#59ff9b' },
    { key: 'colorAlpha', label: '环面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '轮廓颜色', control: 'color', fallback: '#59ff9b' },
    { key: 'lineAlpha', label: '轮廓透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(RingConeScanner),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
