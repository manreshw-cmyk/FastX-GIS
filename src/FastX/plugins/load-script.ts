const loadPromises = new Map<string, Promise<void>>()

/**
 * 动态加载插件脚本（同 URL 只加载一次）
 * @param url 脚本地址
 * @param globalName 加载完成后需存在的 window 属性名
 */
export function loadPluginScript(url: string, globalName: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const w = window as unknown as Record<string, unknown>
  if (w[globalName]) return Promise.resolve()

  const cached = loadPromises.get(url)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = url
    el.async = true
    el.onload = () => {
      if (!w[globalName]) {
        reject(new Error(`脚本已加载但未找到全局变量 ${globalName}`))
        return
      }
      resolve()
    }
    el.onerror = () => reject(new Error(`插件脚本加载失败: ${url}`))
    document.head.appendChild(el)
  })

  loadPromises.set(url, promise)
  return promise
}
