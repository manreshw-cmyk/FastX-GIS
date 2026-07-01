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
import SquareConeScanner from '../../FastX/SpecialEffects/SquareConeScanner'
import type { SquareConeScannerAddOptions } from '../../FastX/SpecialEffects/SquareConeScanner'

interface SquareConeScannerForm extends SfxSpatialEffectForm {
  effectHeight: number
  horiAngle: number
  vertAngle: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): SquareConeScannerForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 10000,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    effectHeight: 500000,
    horiAngle: 30,
    vertAngle: 30,
    color: '#59ff9b',
    colorAlpha: 0.55,
    lineColor: '#59ff9b',
    lineAlpha: 1,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): SquareConeScannerAddOptions {
  const form = raw as SquareConeScannerForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    height: Number(form.effectHeight),
    horiAngle: Number(form.horiAngle),
    vertAngle: Number(form.vertAngle),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<SquareConeScannerAddOptions> = {
  title: '四方锥体扫描',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'effectHeight', label: '锥体高度(m)', control: 'number', min: 1 },
    { key: 'horiAngle', label: '水平张角(度)', control: 'number', min: 1, max: 179 },
    { key: 'vertAngle', label: '垂直张角(度)', control: 'number', min: 1, max: 179 },
    { key: 'color', label: '锥体面颜色', control: 'color', fallback: '#59ff9b' },
    { key: 'colorAlpha', label: '面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '轮廓颜色', control: 'color', fallback: '#59ff9b' },
    { key: 'lineAlpha', label: '轮廓透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(SquareConeScanner),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
