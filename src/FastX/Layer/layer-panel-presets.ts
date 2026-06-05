/** 底图预设类型（与 Layer.setBaseImageryPreset 一致） */
export type BaseImageryPresetKind = 'custom' | 'cesium-world' | 'none'

/** 当前底图预设 → 图层弹窗卡片 id（syncFromLayer 用） */
export const BASE_IMAGERY_ITEM_ID: Record<BaseImageryPresetKind, string> = {
  custom: 'tdt-img',
  'cesium-world': 'cesium',
  none: 'none',
}

/** 量化地形 → 图层弹窗卡片 id */
export const TERRAIN_QUANTIZED_ITEM_ID = 'terrain-tw'
