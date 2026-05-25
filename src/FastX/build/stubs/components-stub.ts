export function registerCesiumXVueComponents(_app: unknown): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    console.info('[fastx-sdk] registerCesiumXVueComponents 未包含在 npm 包中（无 Vue 组件）。')
  }
}
