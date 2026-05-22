/**
 * 经纬网格影像层默认样式：细灰线、低密度、无绿底光晕。
 * 外部可通过 `LayerGridStyleOptions` 或完整 `GridImageryProvider.ConstructorOptions` 覆盖。
 */
import * as Cesium from 'cesium'
import type { GridImageryAddInput } from './types'

import type { LayerGridStyleOptions } from '../Types'
export type { LayerGridStyleOptions }

/** 默认网格线颜色（CSS）：更细、更淡 */
export const DEFAULT_GRID_LINE_COLOR_CSS = 'rgba(255, 255, 255, 0.1)'

/** 默认每瓦片划分数（Cesium 内置为 8，偏大时放大后过密） */
export const DEFAULT_GRID_CELLS = 3

function colorFromCss(css: string): Cesium.Color {
  return Cesium.Color.fromCssColorString(css)
}

function transparentColor(): Cesium.Color {
  return new Cesium.Color(0, 0, 0, 0)
}

/** Layer 内置默认 `GridImageryProvider` 参数 */
export function buildDefaultGridImageryOptions(): GridImageryAddInput {
  return {
    cells: DEFAULT_GRID_CELLS,
    color: colorFromCss(DEFAULT_GRID_LINE_COLOR_CSS),
    glowColor: transparentColor(),
    glowWidth: 0,
    backgroundColor: transparentColor(),
  }
}

/**
 * 合并网格参数：内置默认 ← `gridStyle` ← `providerOptions`（后者优先）。
 */
export function mergeGridImageryOptions(
  style?: LayerGridStyleOptions,
  providerOptions?: GridImageryAddInput,
): GridImageryAddInput {
  const merged = buildDefaultGridImageryOptions()

  if (style?.cells !== undefined) merged.cells = style.cells
  if (style?.lineColor) merged.color = colorFromCss(style.lineColor)
  if (style?.backgroundColor !== undefined) {
    merged.backgroundColor =
      style.backgroundColor === 'transparent'
        ? transparentColor()
        : colorFromCss(style.backgroundColor)
  }
  if (style?.glowWidth !== undefined) merged.glowWidth = style.glowWidth

  if (!providerOptions) return merged

  return {
    ...merged,
    ...providerOptions,
    cells: providerOptions.cells ?? merged.cells,
    color: providerOptions.color ?? merged.color,
    glowColor: providerOptions.glowColor ?? merged.glowColor,
    glowWidth: providerOptions.glowWidth ?? merged.glowWidth,
    backgroundColor: providerOptions.backgroundColor ?? merged.backgroundColor,
  }
}
