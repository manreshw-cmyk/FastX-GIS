import { getVendorPlugin } from './manifest'
import { loadPluginScript } from './load-script'
import { resolvePluginScriptUrl } from './resolve-url'
import type { H337Factory } from './h337-types'

const PLUGIN_ID = 'heatmap'

let loadPromise: Promise<void> | null = null

/** 加载 vendor/lib 中的 heatmap.min.js */
export function ensureHeatmapJs(): Promise<void> {
  if (typeof window !== 'undefined' && window.h337?.create) return Promise.resolve()
  if (loadPromise) return loadPromise

  const meta = getVendorPlugin(PLUGIN_ID)
  if (!meta) return Promise.reject(new Error(`插件 ${PLUGIN_ID} 未在 manifest 中启用`))

  const url = resolvePluginScriptUrl(PLUGIN_ID, meta.entry)
  loadPromise = loadPluginScript(url, meta.global).catch((err) => {
    loadPromise = null
    throw err
  })
  return loadPromise
}

/** 获取已加载的 h337（需先 await ensureHeatmapJs()） */
export function getH337(): H337Factory {
  if (typeof window === 'undefined' || !window.h337?.create) {
    throw new Error('[FastX] heatmap.js 未就绪，请先 await ensureHeatmapJs()')
  }
  return window.h337
}

/**
 * h337 命名空间代理
 * 使用前须 `await ensureHeatmapJs()`
 */
export const h337: H337Factory = new Proxy({} as H337Factory, {
  get(_target, prop) {
    return (getH337() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
