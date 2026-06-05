import { getVendorPlugin } from './manifest'
import { loadPluginScript } from './load-script'
import { resolvePluginScriptUrl } from './resolve-url'
import type { TurfStatic } from './turf-types'

const PLUGIN_ID = 'turf'

let loadPromise: Promise<void> | null = null

/** 加载 vendor/lib 中的 turf.min.js */
export function ensureTurf(): Promise<void> {
  if (typeof window !== 'undefined' && window.turf) return Promise.resolve()
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

/** 获取已加载的 turf（需先 await ensureTurf()） */
export function getTurf(): TurfStatic {
  if (typeof window === 'undefined' || !window.turf) {
    throw new Error('[FastX] turf 未就绪，请先 await ensureTurf()')
  }
  return window.turf as TurfStatic
}

/**
 * turf 命名空间代理
 * 使用前须 `await ensureTurf()`（installFastXToWindow 会预加载）
 */
export const turf: TurfStatic = new Proxy({} as TurfStatic, {
  get(_target, prop) {
    return (getTurf() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
