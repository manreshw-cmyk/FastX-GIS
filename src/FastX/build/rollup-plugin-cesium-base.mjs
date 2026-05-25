/**
 * 在 Rollup 产出中，于 import Cesium 之前注入 CESIUM_BASE_URL 初始化（避免 Cesium 先于 ensure 加载）。
 */
export function injectCesiumBasePrelude() {
  const prelude = [
    'function __fastxEnsureCesiumBaseUrl() {',
    '  if (typeof window === "undefined" || window.CESIUM_BASE_URL) return;',
    '  if (typeof globalThis !== "undefined" && globalThis.__FASTX_CESIUM_BASE__) {',
    '    window.CESIUM_BASE_URL = globalThis.__FASTX_CESIUM_BASE__;',
    '    return;',
    '  }',
    '  try {',
    '    var __u = import.meta.url;',
    '    if (/\\/fastx-sdk\\/dist\\//.test(__u) || /\\\\fastx-sdk\\\\dist\\\\/.test(__u)) {',
    '      window.CESIUM_BASE_URL = new URL("../lib/Cesium/", __u).href;',
    '    }',
    '  } catch (e) {}',
    '}',
    '__fastxEnsureCesiumBaseUrl();',
    '',
  ].join('\n')

  const cesiumImportRe = /^import \* as Cesium from ['"]\.\.\/lib\/Cesium\/index\.js['"];?\s*\n/m
  const cesiumRequireRe = /^var Cesium = require\(['"]\.\.\/lib\/Cesium\/index\.cjs['"]\);\s*\n/m

  const cjsPrelude = [
    'function __fastxEnsureCesiumBaseUrl() {',
    '  if (typeof window === "undefined" || window.CESIUM_BASE_URL) return;',
    '  if (typeof globalThis !== "undefined" && globalThis.__FASTX_CESIUM_BASE__) {',
    '    window.CESIUM_BASE_URL = globalThis.__FASTX_CESIUM_BASE__;',
    '    return;',
    '  }',
    '  try {',
    '    var __u = typeof document !== "undefined" && document.currentScript && document.currentScript.src;',
    '    if (__u && /\\/fastx-sdk\\/dist\\//.test(__u)) {',
    '      window.CESIUM_BASE_URL = new URL("../lib/Cesium/", __u).href;',
    '    }',
    '  } catch (e) {}',
    '}',
    '__fastxEnsureCesiumBaseUrl();',
    '',
  ].join('\n')

  return {
    name: 'inject-cesium-base-prelude',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.fileName.startsWith('fastx.')) continue
        if (cesiumImportRe.test(chunk.code)) {
          chunk.code = chunk.code.replace(cesiumImportRe, (m) => prelude + m)
        } else if (cesiumRequireRe.test(chunk.code)) {
          chunk.code = chunk.code.replace(cesiumRequireRe, (m) => cjsPrelude + m)
        }
      }
    },
  }
}
