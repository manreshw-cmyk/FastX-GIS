<script setup lang="ts">
import SfxSpatialEffectPanel from './common/SfxSpatialEffectPanel.vue'
import { createLazySfxApi } from './common/useSfxPickDemo'
import {
  attitudeFields,
  optionId,
  positionFields,
  positionFromForm,
  showField,
  type SfxSpatialDemoConfig,
  type SfxSpatialEffectForm,
} from './common/sfx-spatial-demo'
import RingRadar from '../../FastX/SpecialEffects/RingRadar'
import type { RingRadarAddOptions } from '../../FastX/SpecialEffects/RingRadar'

interface RingRadarForm extends SfxSpatialEffectForm {
  innerRadius: number
  outerRadius: number
  innerDomeHeight: number
  outerDomeHeight: number
  scanSpeed: number
  scanBladeAngle: number
  horizontalSegments: number
  verticalSegments: number
  gridLineWidth: number
  outerSurfaceColor: string
  outerSurfaceAlpha: number
  outerGridColor: string
  outerGridAlpha: number
  innerSurfaceColor: string
  innerSurfaceAlpha: number
  innerGridColor: string
  innerGridAlpha: number
  scanBladeColor: string
  scanBladeAlpha: number
  scanBlink: boolean
}

function createDefaultForm(): RingRadarForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    innerRadius: 33000,
    outerRadius: 66000,
    innerDomeHeight: 9000,
    outerDomeHeight: 18000,
    scanSpeed: 45,
    scanBladeAngle: 0,
    horizontalSegments: 96,
    verticalSegments: 10,
    gridLineWidth: 1,
    outerSurfaceColor: '#c8601f',
    outerSurfaceAlpha: 0.34,
    outerGridColor: '#c8601f',
    outerGridAlpha: 0.78,
    innerSurfaceColor: '#00ff48',
    innerSurfaceAlpha: 0.38,
    innerGridColor: '#00ff48',
    innerGridAlpha: 0.78,
    scanBladeColor: '#fff400',
    scanBladeAlpha: 0.48,
    scanBlink: false,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): RingRadarAddOptions {
  const form = raw as RingRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: Number(form.heading),
    pitch: Number(form.pitch),
    roll: Number(form.roll),
    scale: Number(form.scale),
    innerRadius: Number(form.innerRadius),
    outerRadius: Number(form.outerRadius),
    innerDomeHeight: Number(form.innerDomeHeight),
    outerDomeHeight: Number(form.outerDomeHeight),
    scanSpeed: Number(form.scanSpeed),
    scanBladeAngle: Number(form.scanBladeAngle),
    horizontalSegments: Number(form.horizontalSegments),
    verticalSegments: Number(form.verticalSegments),
    gridLineWidth: Number(form.gridLineWidth),
    outerSurfaceColor: form.outerSurfaceColor,
    outerSurfaceAlpha: Number(form.outerSurfaceAlpha),
    outerGridColor: form.outerGridColor,
    outerGridAlpha: Number(form.outerGridAlpha),
    innerSurfaceColor: form.innerSurfaceColor,
    innerSurfaceAlpha: Number(form.innerSurfaceAlpha),
    innerGridColor: form.innerGridColor,
    innerGridAlpha: Number(form.innerGridAlpha),
    scanBladeColor: form.scanBladeColor,
    scanBladeAlpha: Number(form.scanBladeAlpha),
    scanBlink: Boolean(form.scanBlink),
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<RingRadarAddOptions> = {
  title: '环形雷达扫描',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'innerRadius', label: '内环半径(m)', control: 'number', min: 1 },
    { key: 'outerRadius', label: '外环半径(m)', control: 'number', min: 1 },
    { key: 'innerDomeHeight', label: '内环隆起高度(m)', control: 'number', min: 1 },
    { key: 'outerDomeHeight', label: '外环隆起高度(m)', control: 'number', min: 1 },
    { key: 'scanSpeed', label: '扫描速度(度/秒)', control: 'number', step: 1 },
    { key: 'scanBladeAngle', label: '叶片角宽(度)', control: 'number', min: 0, max: 120, step: 1 },
    { key: 'horizontalSegments', label: '水平插值点数', control: 'number', min: 16, step: 1 },
    { key: 'verticalSegments', label: '垂直插值点数', control: 'number', min: 2, step: 1 },
    { key: 'gridLineWidth', label: '网格线宽(px)', control: 'number', min: 1, step: 1 },
    { key: 'outerSurfaceColor', label: '外环弧面颜色', control: 'color', fallback: '#c8601f' },
    { key: 'outerSurfaceAlpha', label: '外环弧面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'outerGridColor', label: '外环网格颜色', control: 'color', fallback: '#c8601f' },
    { key: 'outerGridAlpha', label: '外环网格透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'innerSurfaceColor', label: '内环弧面颜色', control: 'color', fallback: '#00ff48' },
    { key: 'innerSurfaceAlpha', label: '内环弧面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'innerGridColor', label: '内环网格颜色', control: 'color', fallback: '#00ff48' },
    { key: 'innerGridAlpha', label: '内环网格透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'scanBladeColor', label: '扫描叶片颜色', control: 'color', fallback: '#fff400' },
    { key: 'scanBladeAlpha', label: '扫描叶片透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'scanBlink', label: '扫描叶片闪烁', control: 'switch' },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(RingRadar),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
