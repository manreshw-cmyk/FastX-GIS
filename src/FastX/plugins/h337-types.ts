/** heatmap.js 工厂与实例（h337） */
export interface H337CreateConfig {
  container: HTMLElement
  radius?: number
  maxOpacity?: number
  minOpacity?: number
  blur?: number
  gradient?: Record<string, string>
}

export interface H337DataPoint {
  x: number
  y: number
  value: number
}

export interface H337Instance {
  setData: (data: { min: number; max: number; data: H337DataPoint[] }) => void
  getValueAt: (point: { x: number; y: number }) => number
  _renderer?: { canvas?: HTMLCanvasElement }
}

export interface H337Factory {
  create: (config: H337CreateConfig) => H337Instance
}
