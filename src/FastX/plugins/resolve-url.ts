/**
 * 解析插件脚本 URL
 * - fastx-sdk：`../lib/<id>/<file>`（相对 dist）
 * - 主工程 Vite：`/vendor/<id>/<file>`（见 vite.config 静态托管）
 */
export function resolvePluginScriptUrl(pluginId: string, file: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    const self = import.meta.url
    if (/\/fastx-sdk\/dist\//.test(self) || /\\fastx-sdk\\dist\\/.test(self)) {
      return new URL(`../lib/${pluginId}/${file}`, self).href
    }
  }

  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}vendor/${pluginId}/${file}`
}
