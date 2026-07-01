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
import ScanRadar from '../../FastX/SpecialEffects/ScanRadar'
import type { ScanRadarAddOptions } from '../../FastX/SpecialEffects/ScanRadar'

interface ScanRadarForm extends SfxSpatialEffectForm {
  radius: number
  minHoriAngle: number
  maxHoriAngle: number
  minVertAngle: number
  maxVertAngle: number
  horiSegments: number
  vertSegments: number
  scanVisible: boolean
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
  scanColor: string
  scanAlpha: number
}

function createDefaultForm(): ScanRadarForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    radius: 1000000,
    minHoriAngle: -45,
    maxHoriAngle: 45,
    minVertAngle: 0,
    maxVertAngle: 45,
    horiSegments: 72,
    vertSegments: 36,
    scanVisible: true,
    color: '#ffff00',
    colorAlpha: 0.5,
    lineColor: '#ffffff',
    lineAlpha: 0.45,
    scanColor: '#00ff6e',
    scanAlpha: 0.45,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): ScanRadarAddOptions {
  const form = raw as ScanRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    radius: Number(form.radius),
    minHoriAngle: Number(form.minHoriAngle),
    maxHoriAngle: Number(form.maxHoriAngle),
    minVertAngle: Number(form.minVertAngle),
    maxVertAngle: Number(form.maxVertAngle),
    horiSegments: Number(form.horiSegments),
    vertSegments: Number(form.vertSegments),
    scanVisible: Boolean(form.scanVisible),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    scanColor: rgbaCss(form.scanColor, Number(form.scanAlpha)),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const scanVisible = (form: SfxSpatialEffectForm) => Boolean(form.scanVisible)

const config: SfxSpatialDemoConfig<ScanRadarAddOptions> = {
  title: '扫描雷达',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '探测半径(m)', control: 'number', min: 1 },
    { key: 'minHoriAngle', label: '最小水平角(度)', control: 'number', min: -360, max: 360 },
    { key: 'maxHoriAngle', label: '最大水平角(度)', control: 'number', min: -360, max: 360 },
    { key: 'minVertAngle', label: '最小垂直角(度)', control: 'number', min: -90, max: 90 },
    { key: 'maxVertAngle', label: '最大垂直角(度)', control: 'number', min: -90, max: 90 },
    { key: 'horiSegments', label: '水平密度', control: 'number', min: 4, step: 1 },
    { key: 'vertSegments', label: '垂直密度', control: 'number', min: 2, step: 1 },
    { key: 'scanVisible', label: '显示扫描面', control: 'switch' },
    { key: 'color', label: '雷达体颜色', control: 'color', fallback: '#ffff00' },
    { key: 'colorAlpha', label: '雷达体透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '网格线颜色', control: 'color', fallback: '#ffffff' },
    { key: 'lineAlpha', label: '网格线透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'scanColor', label: '扫描面颜色', control: 'color', fallback: '#00ff6e', showWhen: scanVisible },
    { key: 'scanAlpha', label: '扫描面透明度', control: 'slider', min: 0, max: 1, step: 0.05, showWhen: scanVisible },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(ScanRadar),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
