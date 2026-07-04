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
  domeHeight: number
  horizontalSegments: number
  verticalSegments: number
  gridLineWidth: number
  surfaceColor: string
  surfaceAlpha: number
  gridColor: string
  gridAlpha: number
  scanBladeColor: string
  scanBladeAlpha: number
  scanBladeAngle: number
  scanBladeCount: number
  scanSpeed: number
  scanBlink: boolean
}

/** 示例页默认表单值，保持与接口默认值一致。 */
const DEFAULT_PARABOLA_RADAR_FORM: ParabolaRadarForm = {
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  scale: 1,
  radius: 66000,
  domeHeight: 18000,
  horizontalSegments: 96,
  verticalSegments: 10,
  gridLineWidth: 1,
  surfaceColor: '#00ff48',
  surfaceAlpha: 0.34,
  gridColor: '#00ff48',
  gridAlpha: 0.78,
  scanBladeColor: '#ff0000',
  scanBladeAlpha: 0.48,
  scanBladeAngle: 1,
  scanBladeCount: 1,
  scanSpeed: 45,
  scanBlink: false,
  show: true,
}

/** 将表单输入值转换为数字。 */
function numberValue(value: unknown): number {
  return Number(value)
}

/** 将颜色和透明度组合成 rgba 字符串。 */
function colorWithAlpha(color: string, alpha: unknown): string {
  return rgbaCss(color, numberValue(alpha))
}

/** 创建一份新的默认表单数据。 */
function createDefaultForm(): ParabolaRadarForm {
  return { ...DEFAULT_PARABOLA_RADAR_FORM }
}

/** 将示例页表单转换为抛物面雷达新增参数。 */
function buildOptions(raw: SfxSpatialEffectForm): ParabolaRadarAddOptions {
  const form = raw as ParabolaRadarForm
  return {
    id: optionId(form),
    position: positionFromForm(form),
    heading: numberValue(form.heading),
    pitch: numberValue(form.pitch),
    roll: numberValue(form.roll),
    scale: numberValue(form.scale),
    radius: numberValue(form.radius),
    domeHeight: numberValue(form.domeHeight),
    horizontalSegments: numberValue(form.horizontalSegments),
    verticalSegments: numberValue(form.verticalSegments),
    gridLineWidth: numberValue(form.gridLineWidth),
    surfaceColor: colorWithAlpha(form.surfaceColor, form.surfaceAlpha),
    gridColor: colorWithAlpha(form.gridColor, form.gridAlpha),
    scanBladeColor: colorWithAlpha(form.scanBladeColor, form.scanBladeAlpha),
    scanBladeAngle: numberValue(form.scanBladeAngle),
    scanBladeCount: numberValue(form.scanBladeCount),
    scanSpeed: numberValue(form.scanSpeed),
    scanBlink: Boolean(form.scanBlink),
    show: Boolean(form.show),
  }
}

const config: SfxSpatialDemoConfig<ParabolaRadarAddOptions> = {
  title: '抛物面雷达',
  fields: [
    ...positionFields,
    ...attitudeFields,
    { key: 'radius', label: '扫描半径(m)', control: 'number', min: 1 },
    { key: 'domeHeight', label: '弧面高度(m)', control: 'number', min: 1 },
    { key: 'horizontalSegments', label: '水平插值点数', control: 'number', min: 16, step: 1 },
    { key: 'verticalSegments', label: '垂直插值点数', control: 'number', min: 2, step: 1 },
    { key: 'gridLineWidth', label: '网格线宽(px)', control: 'number', min: 0.1, step: 0.1 },
    { key: 'surfaceColor', label: '弧面颜色', control: 'color', fallback: '#00ff48' },
    { key: 'surfaceAlpha', label: '弧面透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'gridColor', label: '网格线颜色', control: 'color', fallback: '#00ff48' },
    { key: 'gridAlpha', label: '网格线透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'scanBladeColor', label: '叶片颜色', control: 'color', fallback: '#ff0000' },
    { key: 'scanBladeAlpha', label: '叶片透明度', control: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'scanBladeAngle', label: '叶片角宽(度)', control: 'number', min: 1, max: 120, step: 1 },
    { key: 'scanBladeCount', label: '叶片数量', control: 'number', min: 1, step: 1 },
    { key: 'scanSpeed', label: '扫描速度(度/秒)', control: 'number', step: 1 },
    { key: 'scanBlink', label: '叶片闪烁', control: 'switch' },
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
