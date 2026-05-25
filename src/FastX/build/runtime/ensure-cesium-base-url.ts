declare global {
  interface Window {
    CESIUM_BASE_URL?: string
  }
  // Vite define 或 vite-plugin-fastx-sdk 注入
  var __FASTX_CESIUM_BASE__: string | undefined
}

export interface EnsureCesiumBaseUrlOptions {
  /** 显式指定，如 `/Cesium/`（Vite/Webpack 生产构建推荐） */
  baseUrl?: string
  /** 为 true 时覆盖已有 window.CESIUM_BASE_URL */
  force?: boolean
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

/** 从 import.meta.url 推断包内 lib/Cesium（仅当未被打包工具改写路径时可靠） */
function tryResolveFromImportMeta(): string | undefined {
  try {
    const metaUrl = import.meta.url
    if (!/\/fastx-sdk[/\\]dist[/\\]/.test(metaUrl) && !/[/\\]fastx-sdk[/\\]dist[/\\]/.test(metaUrl)) {
      return undefined
    }
    const resolved = new URL('../lib/Cesium/', metaUrl).href
    if (resolved.includes('/lib/Cesium/')) return resolved
  } catch {
    /* ignore */
  }
  return undefined
}

/**
 * 将 Cesium Workers/Assets 指向 npm 包内 `lib/Cesium/`。
 * - 直连 node_modules 引用 dist 时：可自动推断
 * - Vite/Webpack 二次打包：请传 `baseUrl` 或使用 `fastx-sdk/vite-plugin`
 */
export function ensureCesiumBaseUrl(options?: EnsureCesiumBaseUrlOptions): void {
  if (typeof window === 'undefined') return
  if (window.CESIUM_BASE_URL && !options?.force) return

  const explicit = options?.baseUrl
  if (explicit) {
    window.CESIUM_BASE_URL = normalizeBaseUrl(explicit)
    return
  }

  const injected = typeof globalThis !== 'undefined' ? globalThis.__FASTX_CESIUM_BASE__ : undefined
  if (injected) {
    window.CESIUM_BASE_URL = normalizeBaseUrl(injected)
    return
  }

  const fromMeta = tryResolveFromImportMeta()
  if (fromMeta) {
    window.CESIUM_BASE_URL = fromMeta
    return
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    console.warn(
      '[fastx-sdk] 未能自动设置 CESIUM_BASE_URL。' +
        'Vite/Webpack 项目请使用 vite-plugin：`import { vitePluginFastxSdk } from "fastx-sdk/vite-plugin"`，' +
        '或调用 installFastXToWindow({ cesiumBaseUrl: "/Cesium/" }) 并复制 lib/Cesium 到静态目录。',
    )
  }
}
