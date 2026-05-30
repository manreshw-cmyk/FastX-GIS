import type { MeasureStyle } from './types'

/** 量算绘制默认样式（与当前地图绘制色一致，可由外部覆盖） */
export const DEFAULT_MEASURE_STYLE: Required<MeasureStyle> = {
  lineColor: '#59ff9b',
  lineWidth: 2,
  lineDashed: false,
  pointColor: '#59ff9b',
  pointSize: 10,
  pointAlpha: 1,
  showKeyPoint: true,
  labelColor: '#ffffff',
  labelFont: '14px sans-serif',
  labelSize: 14,
  fillColor: '#59ff9b',
  fillAlpha: 0.25,
  visibleLineColor: '#00ff00',
  invisibleLineColor: '#ff0000',
  rightAngleLineColor: '#ff4444',
  azimuthGuideColor: '#ffff00',
  circleColor: '#59ff9b',
  contourLineColor: '#48c175',
  contourShaderColor: '#ff0000',
  contourShaderWidth: 1,
}

/**
 * 合并用户样式与默认样式。
 * @param style 可选部分样式
 */
export function mergeMeasureStyle(style?: MeasureStyle): Required<MeasureStyle> {
  return { ...DEFAULT_MEASURE_STYLE, ...style }
}

/**
 * 根据样式配置生成 Cesium 标签字体字符串。
 * @param style 完整样式
 */
export function buildLabelFont(style: Required<MeasureStyle>): string {
  const m = style.labelFont.match(/^(\d+)px/)
  const size = style.labelSize ?? (m ? Number(m[1]) : 14)
  const family = style.labelFont.replace(/^\d+px\s*/, '') || 'sans-serif'
  return `${size}px ${family}`
}
