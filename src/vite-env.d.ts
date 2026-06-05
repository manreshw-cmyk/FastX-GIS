/// <reference types="vite/client" />

/** 与 `public/config.js` 中 `window.apiConfig` 对齐。 */
interface Window {
  apiConfig?: {
    imageryProvider?: string
    terrainProvider?: string
  }
  /** `main.ts` 中 `installFastXToWindow()` 注入 */
  FastX?: import('./FastX').FastXGlobal
  /** `src/FastX/build/vendor/heatmap/heatmap.min.js` */
  h337?: import('./FastX/plugins/h337-types').H337Factory
  /** `src/FastX/build/vendor/turf/turf.min.js` */
  turf?: import('./FastX/plugins/turf-types').TurfStatic
}
