/** 插件清单类型（与 vendor/manifest.json 保持同步） */
export interface VendorPluginEntry {
  id: string
  name: string
  version: string
  license?: string
  global: string
  entry: string
  styles?: string[]
  enabled: boolean
  usedBy?: string[]
  note?: string
}

export interface VendorManifest {
  description?: string
  plugins: VendorPluginEntry[]
}

/** 与 `src/FastX/build/vendor/manifest.json` 同步 */
export const VENDOR_MANIFEST: VendorManifest = {
  description: 'FastX SDK vendor plugins',
  plugins: [
    {
      id: 'heatmap',
      name: 'heatmap.js',
      version: '2.0.5',
      license: 'MIT / Beerware',
      global: 'h337',
      entry: 'heatmap.min.js',
      enabled: true,
      usedBy: ['Draw/Heatmap'],
    },
    {
      id: 'turf',
      name: '@turf/turf',
      version: '7.3.5',
      license: 'MIT',
      global: 'turf',
      entry: 'turf.min.js',
      enabled: true,
      usedBy: ['Quantitative/BufferAnalyze'],
    },
    {
      id: 'cesium-navigation',
      name: 'cesium-navigation-es6',
      version: '3.0.9',
      license: 'Apache-2.0',
      global: 'CesiumNavigation',
      entry: 'CesiumNavigation.umd.js',
      styles: ['styles/cesium-navigation.css'],
      enabled: true,
      usedBy: ['Layer/navigationControl'],
    },
  ],
}

export function getVendorPlugin(id: string): VendorPluginEntry | undefined {
  return VENDOR_MANIFEST.plugins.find((p) => p.id === id && p.enabled)
}
