/// <reference types="vite/client" />

/** 与 `public/config.js` 中 `window.apiConfig` 对齐。 */
interface Window {
  apiConfig?: {
    imageryProvider?: string
    terrainProvider?: string
  }
  /** `main.ts` 中 `installXGXToWindow()` 注入，如 `window.FastX.Coordinates.screenClientXYToLngLatHeight(...)` */
  FastX?: import('./FastX').XGXGlobal
}
