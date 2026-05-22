import type { App, Component } from 'vue'

const modules = import.meta.glob('./*.vue', { eager: true }) as Record<string, { default: Component }>

/** 将 `filename.vue` 转为 PascalCase 组件名，如 `x-map.vue` → `XMap`。 */
function vuePathToComponentName(path: string): string {
  const base = path.replace(/^\.\//, '').replace(/\.vue$/i, '')
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('')
}

/** 注册 `FastX/components` 下全部 `.vue` 为全局组件。 */
export function registerCesiumXVueComponents(app: App): void {
  for (const path of Object.keys(modules)) {
    const comp = modules[path]?.default
    if (!comp) continue
    const name = vuePathToComponentName(path)
    if (name) app.component(name, comp)
  }
}
