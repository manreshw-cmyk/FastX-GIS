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
import DoubleViewFrustum from '../../FastX/SpecialEffects/DoubleViewFrustum'
import type { DoubleViewFrustumAddOptions } from '../../FastX/SpecialEffects/DoubleViewFrustum'

interface DoubleViewFrustumForm extends SfxSpatialEffectForm {
  near: number
  far: number
  fov: number
  aspectRatio: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
}

function createDefaultForm(): DoubleViewFrustumForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 10000,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    near: 50000,
    far: 500000,
    fov: 30,
    aspectRatio: 2,
    color: '#00ffff',
    colorAlpha: 0.25,
    lineColor: '#ffffff',
    lineAlpha: 1,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): DoubleViewFrustumAddOptions {
  const form = raw as DoubleViewFrustumForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    near: Number(form.near),
    far: Number(form.far),
    fov: Number(form.fov),
    aspectRatio: Number(form.aspectRatio),
    color: rgbaCss(form.color, Number(form.colorAlpha)),
    lineColor: rgbaCss(form.lineColor, Number(form.lineAlpha)),
    lineWidth: 1,
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<DoubleViewFrustumAddOptions> = {
  title: '双面视锥体',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'near', label: '近平面(m)', control: 'number', min: 1 },
    { key: 'far', label: '远平面(m)', control: 'number', min: 1 },
    { key: 'fov', label: '视场角(度)', control: 'number', min: 1, max: 179 },
    { key: 'aspectRatio', label: '宽高比', control: 'number', min: 0.1, step: 0.1 },
    { key: 'color', label: '面填充色', control: 'color', fallback: '#00ffff' },
    { key: 'colorAlpha', label: '面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'lineColor', label: '轮廓颜色', control: 'color', fallback: '#ffffff' },
    { key: 'lineAlpha', label: '轮廓透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(DoubleViewFrustum),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
