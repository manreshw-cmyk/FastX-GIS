import type { Viewer } from 'cesium'
import type { SfxBaseRow, SfxPickDemoApi } from './useSfxPickDemo'

export type SfxSpatialControl = 'number' | 'slider' | 'switch' | 'color'

export interface SfxSpatialEffectForm extends SfxBaseRow {
  [key: string]: string | number | boolean
}

export interface SfxSpatialField {
  key: string
  label: string
  control: SfxSpatialControl
  min?: number
  max?: number
  step?: number
  placeholder?: string
  fallback?: string
  showWhen?: (form: SfxSpatialEffectForm) => boolean
}

export interface SfxSpatialDemoConfig<TOptions = unknown> {
  title: string
  tableTitle?: string
  fields: SfxSpatialField[]
  preserveHeightOnPick?: boolean
  zeroHeightOnPick?: boolean
  normalizePickedHeight?: (height: number) => number
  createDefaultForm: () => SfxSpatialEffectForm
  buildOptions: (form: SfxSpatialEffectForm) => TOptions
  getApi: (viewer: Viewer) => SfxPickDemoApi<TOptions>
}

export const positionFields: SfxSpatialField[] = [
  { key: 'longitude', label: '经度(度)', control: 'number', step: 0.0001 },
  { key: 'latitude', label: '纬度(度)', control: 'number', step: 0.0001 },
  { key: 'height', label: '高度(m)', control: 'number', step: 10 },
]

export const attitudeFields: SfxSpatialField[] = [
  { key: 'heading', label: '航向(度)', control: 'number', step: 1 },
  { key: 'pitch', label: '俯仰(度)', control: 'number', step: 1 },
  { key: 'roll', label: '翻滚(度)', control: 'number', step: 1 },
  { key: 'scale', label: '缩放', control: 'number', min: 0.01, step: 0.1 },
]

export const showField: SfxSpatialField = { key: 'show', label: '显示', control: 'switch' }

export function positionFromForm(form: SfxSpatialEffectForm) {
  return {
    longitude: Number(form.longitude),
    latitude: Number(form.latitude),
    height: Number(form.height),
  }
}

export function optionId(form: SfxSpatialEffectForm): string | undefined {
  const id = String(form.id ?? '').trim()
  return id || undefined
}
