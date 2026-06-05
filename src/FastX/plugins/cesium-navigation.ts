import * as Cesium from 'cesium'
import { getVendorPlugin } from './manifest'
import { loadPluginScript } from './load-script'
import { resolvePluginScriptUrl } from './resolve-url'
import type {
  CesiumNavigationConstructor,
  CesiumNavigationInstance,
  CesiumNavigationOptions,
} from './cesium-navigation-types'

const PLUGIN_ID = 'cesium-navigation'

let loadPromise: Promise<void> | null = null

function ensureCesiumGlobal(): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { Cesium?: typeof Cesium }
  if (!w.Cesium) w.Cesium = Cesium
}

function loadPluginStylesheet(url: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  const id = `fx-plugin-css-${encodeURIComponent(url)}`
  if (document.getElementById(id)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`插件样式加载失败: ${url}`))
    document.head.appendChild(link)
  })
}

/** 加载 vendor/lib 中的 cesium-navigation（脚本 + 样式） */
export function ensureCesiumNavigation(): Promise<void> {
  if (typeof window !== 'undefined' && window.CesiumNavigation) return Promise.resolve()
  if (loadPromise) return loadPromise

  const meta = getVendorPlugin(PLUGIN_ID)
  if (!meta) {
    return Promise.reject(new Error(`插件 ${PLUGIN_ID} 未在 manifest 中启用`))
  }

  ensureCesiumGlobal()

  const scriptUrl = resolvePluginScriptUrl(PLUGIN_ID, meta.entry)
  const styleTasks = (meta.styles ?? []).map((file) =>
    loadPluginStylesheet(resolvePluginScriptUrl(PLUGIN_ID, file)),
  )

  loadPromise = Promise.all([...styleTasks, loadPluginScript(scriptUrl, meta.global)])
    .then(() => undefined)
    .catch((err) => {
      loadPromise = null
      throw err
    })

  return loadPromise
}

/** 获取已加载的 CesiumNavigation 构造器（需先 await ensureCesiumNavigation()） */
export function getCesiumNavigation(): CesiumNavigationConstructor {
  if (typeof window === 'undefined' || !window.CesiumNavigation) {
    throw new Error('[FastX] cesium-navigation 未就绪，请先 await ensureCesiumNavigation()')
  }
  return window.CesiumNavigation
}

export type { CesiumNavigationInstance, CesiumNavigationOptions }
