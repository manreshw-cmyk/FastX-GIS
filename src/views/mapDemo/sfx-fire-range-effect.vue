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
import FireRangeEffect from '../../FastX/SpecialEffects/FireRangeEffect'
import type { FireRangeEffectAddOptions } from '../../FastX/SpecialEffects/FireRangeEffect'

interface FireRangeEffectForm extends SfxSpatialEffectForm {
  radius: number
  minHoriAngle: number
  maxHoriAngle: number
  minVertAngle: number
  maxVertAngle: number
  horiPointNum: number
  vertPointNum: number
  radialPointNum: number
  gridHoriStep: number
  gridVertStep: number
  apexColor: string
  apexAlpha: number
  middleColor: string
  middleAlpha: number
  farColor: string
  farAlpha: number
  fillAlpha: number
  fillVisible: boolean
  gridColor: string
  gridAlpha: number
  gridLineWidth: number
  gridVisible: boolean
  outlineColor: string
  outlineAlpha: number
  outlineLineWidth: number
  outlineVisible: boolean
}

function createDefaultForm(): FireRangeEffectForm {
  return {
    id: '',
    longitude: 108,
    latitude: 39,
    height: 2000,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    radius: 10000,
    minHoriAngle: -30,
    maxHoriAngle: 30,
    minVertAngle: 80,
    maxVertAngle: 100,
    horiPointNum: 360,
    vertPointNum: 180,
    radialPointNum: 48,
    gridHoriStep: 1,
    gridVertStep: 1,
    apexColor: '#1428ff',
    apexAlpha: 0.58,
    middleColor: '#d2d723',
    middleAlpha: 0.42,
    farColor: '#ff8c00',
    farAlpha: 0.58,
    fillAlpha: 1,
    fillVisible: true,
    gridColor: '#ff5600',
    gridAlpha: 0.95,
    gridLineWidth: 1,
    gridVisible: true,
    outlineColor: '#ff0000',
    outlineAlpha: 0.9,
    outlineLineWidth: 1,
    outlineVisible: true,
    show: true,
  }
}

function buildOptions(raw: SfxSpatialEffectForm): FireRangeEffectAddOptions {
  const form = raw as FireRangeEffectForm
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
    horiPointNum: Number(form.horiPointNum),
    vertPointNum: Number(form.vertPointNum),
    radialPointNum: Number(form.radialPointNum),
    gridHoriStep: Number(form.gridHoriStep),
    gridVertStep: Number(form.gridVertStep),
    apexColor: rgbaCss(form.apexColor, Number(form.apexAlpha)),
    middleColor: rgbaCss(form.middleColor, Number(form.middleAlpha)),
    farColor: rgbaCss(form.farColor, Number(form.farAlpha)),
    fillAlpha: Number(form.fillAlpha),
    fillVisible: Boolean(form.fillVisible),
    gridColor: form.gridColor,
    gridAlpha: Number(form.gridAlpha),
    gridLineWidth: Number(form.gridLineWidth),
    gridVisible: Boolean(form.gridVisible),
    outlineColor: form.outlineColor,
    outlineAlpha: Number(form.outlineAlpha),
    outlineLineWidth: Number(form.outlineLineWidth),
    outlineVisible: Boolean(form.outlineVisible),
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<FireRangeEffectAddOptions> = {
  title: '火力范围',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '火力半径(m)', control: 'number', min: 1 },
    { key: 'minHoriAngle', label: '最小水平角(度)', control: 'number', min: -360, max: 360 },
    { key: 'maxHoriAngle', label: '最大水平角(度)', control: 'number', min: -360, max: 360 },
    { key: 'minVertAngle', label: '最小垂直角(度)', control: 'number', min: -90, max: 180 },
    { key: 'maxVertAngle', label: '最大垂直角(度)', control: 'number', min: -90, max: 180 },
    { key: 'horiPointNum', label: '水平插值点数', control: 'number', min: 4, step: 1 },
    { key: 'vertPointNum', label: '垂直插值点数', control: 'number', min: 4, step: 1 },
    { key: 'radialPointNum', label: '径向插值点数', control: 'number', min: 2, step: 1 },
    { key: 'gridHoriStep', label: '网格水平步长', control: 'number', min: 1, step: 1 },
    { key: 'gridVertStep', label: '网格垂直步长', control: 'number', min: 1, step: 1 },
    { key: 'fillVisible', label: '显示填充面', control: 'switch' },
    { key: 'apexColor', label: '顶点渐变色', control: 'color', fallback: '#1428ff' },
    { key: 'apexAlpha', label: '顶点透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'middleColor', label: '中部填充色', control: 'color', fallback: '#d2d723' },
    { key: 'middleAlpha', label: '中部透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'farColor', label: '远端渐变色', control: 'color', fallback: '#ff8c00' },
    { key: 'farAlpha', label: '远端透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'fillAlpha', label: '填充整体透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'gridVisible', label: '显示远端网格', control: 'switch' },
    { key: 'gridColor', label: '网格颜色', control: 'color', fallback: '#ff5600' },
    { key: 'gridAlpha', label: '网格透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'gridLineWidth', label: '网格线宽(px)', control: 'number', min: 1, step: 1 },
    { key: 'outlineVisible', label: '显示外轮廓', control: 'switch' },
    { key: 'outlineColor', label: '外轮廓颜色', control: 'color', fallback: '#ff0000' },
    { key: 'outlineAlpha', label: '外轮廓透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'outlineLineWidth', label: '外轮廓线宽(px)', control: 'number', min: 1, step: 1 },
    showField,
  ],
  createDefaultForm,
  buildOptions,
  getApi: createLazySfxApi(FireRangeEffect),
}
</script>

<template>
  <SfxSpatialEffectPanel :config="config" />
</template>
