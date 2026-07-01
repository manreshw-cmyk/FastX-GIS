<script setup lang="ts">
import SfxSpatialEffectPanel from './common/SfxSpatialEffectPanel.vue'
import { createLazySfxApi, rgbaCss } from './common/useSfxPickDemo'
import {
  attitudeFields,
  optionId,
  positionFromForm,
  showField,
  type SfxSpatialField,
  type SfxSpatialDemoConfig,
  type SfxSpatialEffectForm,
} from './common/sfx-spatial-demo'
import ConeEffect from '../../FastX/SpecialEffects/ConeEffect'
import type { ConeEffectAddOptions } from '../../FastX/SpecialEffects/ConeEffect'

interface ConeEffectForm extends SfxSpatialEffectForm {
  effectHeight: number
  baseRadius: number
  scanRadius: number
  segments: number
  coneLineColor: string
  coneLineAlpha: number
  scanLineColor: string
  scanLineAlpha: number
  coneFillColor: string
  coneFillAlpha: number
  showConeFill: boolean
  showCone: boolean
  showScan: boolean
}

function createDefaultForm(): ConeEffectForm {
  return {
    id: '',
    longitude: 120.3,
    latitude: 23.5,
    height: 500000,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    effectHeight: 500000,
    baseRadius: 100000,
    scanRadius: 70000,
    segments: 280,
    coneLineColor: '#ff0000',
    coneLineAlpha: 1,
    scanLineColor: '#00ff00',
    scanLineAlpha: 1,
    coneFillColor: '#00ffff',
    coneFillAlpha: 0.25,
    showConeFill: false,
    showCone: true,
    showScan: true,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): ConeEffectAddOptions {
  const form = raw as ConeEffectForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    height: Number(form.effectHeight),
    baseRadius: Number(form.baseRadius),
    scanRadius: Number(form.scanRadius),
    segments: Number(form.segments),
    coneLineColor: rgbaCss(form.coneLineColor, Number(form.coneLineAlpha)),
    scanLineColor: rgbaCss(form.scanLineColor, Number(form.scanLineAlpha)),
    coneFillColor: rgbaCss(form.coneFillColor, Number(form.coneFillAlpha)),
    showConeFill: Boolean(form.showConeFill),
    showCone: Boolean(form.showCone),
    showScan: Boolean(form.showScan),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const positionFields: SfxSpatialField[] = [
  { key: 'longitude', label: '经度(度)', control: 'number', step: 0.0001 },
  { key: 'latitude', label: '纬度(度)', control: 'number', step: 0.0001 },
  { key: 'height', label: '离地高度(m)', control: 'number', step: 10 },
]

const config: SfxSpatialDemoConfig<ConeEffectAddOptions> = {
  title: '圆锥扫描特效',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'effectHeight', label: '拉伸高度(m)', control: 'number', min: 1 },
    { key: 'baseRadius', label: '底部半径(m)', control: 'number', min: 1 },
    { key: 'scanRadius', label: '扫描环半径(m)', control: 'number', min: 0 },
    { key: 'segments', label: '线框密度', control: 'number', min: 32, step: 1 },
    { key: 'showCone', label: '显示圆锥', control: 'switch' },
    { key: 'showScan', label: '显示扫描环', control: 'switch' },
    { key: 'showConeFill', label: '填充圆锥背景', control: 'switch' },
    { key: 'coneLineColor', label: '圆锥线颜色', control: 'color', fallback: '#ff0000' },
    { key: 'coneLineAlpha', label: '圆锥线透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'scanLineColor', label: '扫描线颜色', control: 'color', fallback: '#00ff00' },
    { key: 'scanLineAlpha', label: '扫描线透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'coneFillColor', label: '圆锥填充色', control: 'color', fallback: '#00ffff' },
    { key: 'coneFillAlpha', label: '填充透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(ConeEffect),
  preserveHeightOnPick: true,
}

</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
