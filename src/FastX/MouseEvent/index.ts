import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { clientXYToDrawingBuffer, screenDrawingBufferToLngLatHeight } from '../Coordinates'

import type { MouseEventListenOptions, MouseEventPickPayload } from '../Types'
export type { MouseEventListenOptions, MouseEventPickPayload }

export type PositionedEvent = Cesium.ScreenSpaceEventHandler.PositionedEvent

/** `scene.pick` 最上层对象的 `id`（常为 Entity）；无拾取则为 `undefined` */
export type MouseEventPickedEntity = unknown

const DEFAULT_RIGHT_DOUBLE_MS = 350

function buildPickPayload(
  viewer: Viewer,
  drawingBufferPosition: Cesium.Cartesian2,
  wheelDelta?: number,
): MouseEventPickPayload {
  const x = drawingBufferPosition.x
  const y = drawingBufferPosition.y
  const llh = screenDrawingBufferToLngLatHeight(viewer, { x, y })
  const base = {
    longitude: llh?.longitude ?? Number.NaN,
    latitude: llh?.latitude ?? Number.NaN,
    height: llh?.height ?? Number.NaN,
    x,
    y,
  }
  return wheelDelta === undefined ? base : { ...base, wheelDelta }
}

function pickTopEntityId(viewer: Viewer, windowPosition: Cesium.Cartesian2): MouseEventPickedEntity {
  const picked = viewer.scene.pick(windowPosition)
  if (!Cesium.defined(picked)) return undefined
  return picked.id
}

export class XgxMouseEvent {
  private handler: Cesium.ScreenSpaceEventHandler | null = null
  private lastRightClickAt = 0
  private wheelMoveListener: ((ev: globalThis.MouseEvent) => void) | null = null
  private wheelCanvas: HTMLCanvasElement | null = null
  private lastWheelClientX = 0
  private lastWheelClientY = 0
  private hasWheelClient = false

  constructor(private readonly viewer: Viewer) {}

  private wrapPositioned(
    cb: ((pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void) | undefined,
  ): Cesium.ScreenSpaceEventHandler.PositionedEventCallback | undefined {
    if (!cb) return undefined
    return (e: PositionedEvent) => {
      const pick = buildPickPayload(this.viewer, e.position)
      const entity = pickTopEntityId(this.viewer, e.position)
      cb(pick, entity)
    }
  }

  /**
   * 注册监听；再次调用会先 `destroy` 再重建。
   * @param doubleClickMs 判定右键双击的最大间隔（毫秒）
   */
  listen(options: MouseEventListenOptions, doubleClickMs = DEFAULT_RIGHT_DOUBLE_MS): void {
    this.destroy()
    const canvas = this.viewer.scene?.canvas
    if (!canvas) return

    const h = new Cesium.ScreenSpaceEventHandler(canvas)
    this.handler = h

    const setPos = (
      cb: ((pick: MouseEventPickPayload, entity: MouseEventPickedEntity) => void) | undefined,
      type: Cesium.ScreenSpaceEventType,
    ) => {
      const wrapped = this.wrapPositioned(cb)
      if (wrapped) h.setInputAction(wrapped, type)
    }

    setPos(options.onLeftDown, Cesium.ScreenSpaceEventType.LEFT_DOWN)
    setPos(options.onLeftUp, Cesium.ScreenSpaceEventType.LEFT_UP)
    setPos(options.onLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    setPos(options.onLeftDoubleClick, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    setPos(options.onRightDown, Cesium.ScreenSpaceEventType.RIGHT_DOWN)
    setPos(options.onRightUp, Cesium.ScreenSpaceEventType.RIGHT_UP)

    if (options.onRightDoubleClick) {
      const dbl = options.onRightDoubleClick
      h.setInputAction((e: PositionedEvent) => {
        const t = performance.now()
        if (this.lastRightClickAt > 0 && t - this.lastRightClickAt <= doubleClickMs) {
          const pick = buildPickPayload(this.viewer, e.position)
          const entity = pickTopEntityId(this.viewer, e.position)
          dbl(pick, entity)
          this.lastRightClickAt = 0
        } else {
          this.lastRightClickAt = t
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    } else {
      setPos(options.onRightClick, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    }

    setPos(options.onMiddleDown, Cesium.ScreenSpaceEventType.MIDDLE_DOWN)
    setPos(options.onMiddleUp, Cesium.ScreenSpaceEventType.MIDDLE_UP)
    setPos(options.onMiddleClick, Cesium.ScreenSpaceEventType.MIDDLE_CLICK)

    if (options.onWheel) {
      const wcb = options.onWheel
      this.wheelCanvas = canvas
      this.wheelMoveListener = (ev: globalThis.MouseEvent) => {
        this.lastWheelClientX = ev.clientX
        this.lastWheelClientY = ev.clientY
        this.hasWheelClient = true
      }
      canvas.addEventListener('mousemove', this.wheelMoveListener)

      h.setInputAction((delta: number) => {
        let db: Cesium.Cartesian2
        if (this.hasWheelClient) {
          db = clientXYToDrawingBuffer(this.viewer, this.lastWheelClientX, this.lastWheelClientY)
        } else {
          db = new Cesium.Cartesian2(this.viewer.scene.drawingBufferWidth / 2, this.viewer.scene.drawingBufferHeight / 2)
        }
        const pick = buildPickPayload(this.viewer, db, delta)
        wcb(pick, undefined)
      }, Cesium.ScreenSpaceEventType.WHEEL)
    }
  }

  destroy(): void {
    this.lastRightClickAt = 0
    if (this.wheelMoveListener && this.wheelCanvas) {
      this.wheelCanvas.removeEventListener('mousemove', this.wheelMoveListener)
    }
    this.wheelMoveListener = null
    this.wheelCanvas = null
    this.hasWheelClient = false

    if (this.handler && !this.handler.isDestroyed()) {
      this.handler.destroy()
    }
    this.handler = null
  }
}

/** 挂到 `window.FastX.MouseEvent` 的名称（实现类为 `XgxMouseEvent`，避免与 DOM `MouseEvent` 同名冲突） */
export { XgxMouseEvent as MouseEvent }
