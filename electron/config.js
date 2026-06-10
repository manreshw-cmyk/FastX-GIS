/** 浏览器全局配置（由 index.html 先于应用脚本加载）。 */
const fastxElectronConfigBaseUrl = (() => {
  const currentScript = document.currentScript
  if (currentScript instanceof HTMLScriptElement && currentScript.src) {
    return new URL('./', currentScript.src).href
  }
  return new URL('./', window.location.href).href
})()

window.apiConfig = {
  // imageryProvider: 'http://localhost:98/qqhr_satellite/{z}/{x}/{y}.png',
  // terrainProvider: 'http://localhost:98/taiwan_dem',
  imageryProvider: `${fastxElectronConfigBaseUrl}map/tianditu_Image/{z}/{x}/{y}.png`,
  terrainProvider: '',
}
