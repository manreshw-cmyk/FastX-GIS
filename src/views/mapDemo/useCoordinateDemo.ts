import { message } from 'ant-design-vue'
import type { Viewer } from 'cesium'
import type { CoordinatesApi } from '../../CesiumX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

export function useXGXCoordinates(): CoordinatesApi | null {
  const c = window.XGX?.Coordinates
  if (!c) {
    message.error('window.XGX 未就绪')
    return null
  }
  return c
}

/** 无提示，仅读取当前主图 Viewer（可能尚未绑定） */
export function getMapViewer(): Viewer | null {
  const v = useMapLayerStore().getViewer()
  if (!v || v.isDestroyed()) return null
  return v
}

export function useMapViewer(): Viewer | null {
  const v = getMapViewer()
  if (!v) {
    message.warning('地图尚未就绪')
    return null
  }
  return v
}

/**
 * 轮询直至主图 Viewer 可用或超时（用于从首页卡片进入时地图尚未 `bindLayer` 的情况）。
 */
export async function waitForMapViewer(options?: { timeoutMs?: number; intervalMs?: number }): Promise<Viewer | null> {
  const timeoutMs = options?.timeoutMs ?? 45_000
  const intervalMs = options?.intervalMs ?? 50
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    const v = getMapViewer()
    if (v) return v
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, intervalMs)
    })
  }
  return null
}

export async function copyResult(label: string, text: string): Promise<void> {
  const t = text.trim()
  if (!t || t === '—') return message.warning('暂无可复制内容')
  try {
    await navigator.clipboard.writeText(t)
    message.success(`已复制${label}`)
  } catch {
    message.error('复制失败')
  }
}
