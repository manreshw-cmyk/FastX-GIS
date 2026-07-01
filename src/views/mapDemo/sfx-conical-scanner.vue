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
import ConicalScanner from '../../FastX/SpecialEffects/ConicalScanner'
import type { ConicalScannerAddOptions } from '../../FastX/SpecialEffects/ConicalScanner'

interface ConicalScannerForm extends SfxSpatialEffectForm {
  effectHeight: number
  innerRadius: number
  outerRadius: number
  angle: number
  segments: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): ConicalScannerForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    effectHeight: 50000,
    innerRadius: 20000,
    outerRadius: 60000,
    angle: 60,
    segments: 96,
    color: '#59ff9b',
    colorAlpha: 0.55,
    lineColor: '#59ff9b',
    lineAlpha: 1,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): ConicalScannerAddOptions {
  const form = raw as ConicalScannerForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    height: Number(form.effectHeight),
    innerRadius: Number(form.innerRadius),
    outerRadius: Number(form.outerRadius),
    angle: Number(form.angle),
    segments: Number(form.segments),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<ConicalScannerAddOptions> = {
  title: '锥体扫描',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'effectHeight', label: '扫描高度(m)', control: 'number', min: 1 },
    { key: 'innerRadius', label: '内半径(m)', control: 'number', min: 0 },
    { key: 'outerRadius', label: '外半径(m)', control: 'number', min: 1 },
    { key: 'angle', label: '扫描角度(度)', control: 'number', min: 1, max: 359 },
    { key: 'segments', label: '几何密度', control: 'number', min: 8, step: 1 },
    { key: 'color', label: '扫描面颜色', control: 'color', fallback: '#59ff9b' },
    { key: 'colorAlpha', label: '面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '轮廓颜色', control: 'color', fallback: '#59ff9b' },
    { key: 'lineAlpha', label: '轮廓透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(ConicalScanner),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
