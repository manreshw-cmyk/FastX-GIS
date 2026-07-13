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
  effectHeight: number
  minGroundOpenAngle: number
  maxGroundOpenAngle: number
  frontExcludeAngle: number
  backExcludeAngle: number
  segments: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
  lineWidth: number
}

function createDefaultForm(): RingConeScannerForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 500000,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    effectHeight: 500000,
    minGroundOpenAngle: 80,
    maxGroundOpenAngle: 85,
    frontExcludeAngle: 70,
    backExcludeAngle: 70,
    segments: 160,
    color: '#ff377d',
    colorAlpha: 0.85,
    lineColor: '#ffff00',
    lineAlpha: 1,
    lineWidth: 1,
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
    height: Number(form.effectHeight),
    minGroundOpenAngle: Number(form.minGroundOpenAngle),
    maxGroundOpenAngle: Number(form.maxGroundOpenAngle),
    frontExcludeAngle: Number(form.frontExcludeAngle),
    backExcludeAngle: Number(form.backExcludeAngle),
    segments: Number(form.segments),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: Number(form.lineWidth),
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<RingConeScannerAddOptions> = {
  title: '双圆锥环面扫描体',
  preserveHeightOnPick: true,
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'effectHeight', label: '锥体高度(m)', control: 'number', min: 1 },
    { key: 'minGroundOpenAngle', label: '最小张开角(度)', control: 'number', min: 1, max: 89.9, step: 0.1 },
    { key: 'maxGroundOpenAngle', label: '最大张开角(度)', control: 'number', min: 1, max: 89.9, step: 0.1 },
    { key: 'frontExcludeAngle', label: '前侧排除角(度)', control: 'number', min: 0, max: 179.9, step: 0.1 },
    { key: 'backExcludeAngle', label: '后侧排除角(度)', control: 'number', min: 0, max: 179.9, step: 0.1 },
    { key: 'segments', label: '环向插值点数', control: 'number', min: 24, step: 1 },
    { key: 'color', label: '环面颜色', control: 'color', fallback: '#ff377d' },
    { key: 'colorAlpha', label: '环面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '轮廓颜色', control: 'color', fallback: '#ffff00' },
    { key: 'lineAlpha', label: '轮廓透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineWidth', label: '轮廓粗细(px)', control: 'number', min: 1, step: 1 },
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
