import { message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions } from '../../CesiumX/MouseEvent'
import { waitForMapViewer } from './useCoordinateDemo'

type MouseBinder = {
  listen(options: MouseEventListenOptions, rightDoubleClickMs?: number): void
  destroy(): void
}

type MouseBinderCtor = new (viewer: Viewer) => MouseBinder

/**
 * 等地图就绪后通过 `window.XGX.MouseEvent` 绑定；切换菜单导致组件卸载时会 `destroy`，避免上一页事件残留。
 */
export function useMapMouseEventPage(
  getOptions: () => MouseEventListenOptions,
  rightDoubleClickMs?: number,
): void {
  let binder: MouseBinder | null = null

  onMounted(async () => {
    const viewer = await waitForMapViewer()
    if (!viewer) {
      message.warning('地图未能在预期时间内就绪')
      return
    }
    const Ctor = window.XGX?.MouseEvent as MouseBinderCtor | undefined
    if (!Ctor) {
      message.error('window.XGX.MouseEvent 未就绪')
      return
    }
    binder = new Ctor(viewer)
    binder.listen(getOptions(), rightDoubleClickMs)
  })

  onBeforeUnmount(() => {
    binder?.destroy()
    binder = null
  })
}
