import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { clientXYToDrawingBuffer, screenDrawingBufferToLngLatHeight } from '../Coordinates'
import type { IMeasure, LngLatHeightTuple, MeasureTypeKey } from './types'
import { MEASURE_POINT_RANGE, MeasureType } from './types'

/**
 * 屏幕拾取转 [经度, 纬度, 高程]。
 * @param viewer Cesium Viewer
 * @param clientX 客户端 X
 * @param clientY 客户端 Y
 */
function llhFromPick(viewer: Viewer, clientX: number, clientY: number): LngLatHeightTuple | null {
  const db = clientXYToDrawingBuffer(viewer, clientX, clientY)
  const llh = screenDrawingBufferToLngLatHeight(viewer, db)
  if (!llh) return null
  return [llh.longitude, llh.latitude, llh.height ?? 0]
}

/** 固定顶点数的量算类型（第二点即结束，无需右键） */
const FIXED_COUNT_TYPES = new Set<MeasureTypeKey>([
  MeasureType.ALTITUDE_INTERCEPT,
  MeasureType.LINE_ANALYZE,
  MeasureType.AREA_ANALYZE,
  MeasureType.VIEWSHED_ANALYZE,
  MeasureType.CONTOUR_ANALYZE,
  MeasureType.CONTOUR_ANALYZE_SHADER,
  MeasureType.POINT_BUFFER_ANALYZE,
])

/** 量算系统对外接口（供 MeasureTool 回调，避免循环依赖） */
export interface IQuantitativeSystem {
  createMeasure(
    options: { type: MeasureTypeKey; positions?: LngLatHeightTuple[]; position?: LngLatHeightTuple },
    addToBucket?: boolean,
  ): IMeasure | null
  pushCurrent(measure: IMeasure): void
  removeByType(type: MeasureTypeKey): void
  removeAll(): void
  /** 一次绘制结束（右键/双击/定点完成）后通知系统关闭交互 */
  notifyDrawFinish(): void
}

/**
 * 量算分析交互工具。
 * 负责鼠标拾取、左键加点、右键/双击结束、移动预览；对标 FreeX FeMeasureTool。
 */
export class MeasureTool {
  private viewer: Viewer | null = null
  private system: IQuantitativeSystem | null = null
  private handler: Cesium.ScreenSpaceEventHandler | null = null
  private type: MeasureTypeKey | null = null
  private active = false
  private positions: LngLatHeightTuple[] = []
  private drawing: IMeasure | null = null
  private cursorEntity: Cesium.Entity | null = null
  private preScreen = { x: 0, y: 0 }
  private lastClickMs = 0

  /**
   * 绑定 Viewer 与量算系统。
   * @param viewer Cesium Viewer
   * @param system 量算系统实例
   */
  bind(viewer: Viewer, system: IQuantitativeSystem): void {
    this.viewer = viewer
    this.system = system
  }

  /** 获取当前激活的量算类型 */
  getMeasureType(): MeasureTypeKey | null {
    return this.type
  }

  /** 是否处于交互测量状态 */
  isActive(): boolean {
    return this.active
  }

  /**
   * 激活指定类型的鼠标交互测量。
   * @param type 量算类型
   */
  activate(type: MeasureTypeKey): void {
    if (!this.viewer || this.viewer.isDestroyed()) return
    if (this.type === type && this.active) return
    this.deactivate(false)
    this.type = type
    this.active = true
    this.resetDrawing()
    this.ensureHandler()
  }

  /**
   * 关闭交互测量。
   * @param removeResults 是否清除当前类型已有结果
   */
  deactivate(removeResults = false): void {
    this.resetDrawing()
    if (removeResults && this.system && this.type) {
      this.system.removeByType(this.type)
    }
    this.type = null
    this.active = false
    this.destroyHandler()
  }

  /** 清除全部量算结果并关闭交互 */
  removeAll(): void {
    this.resetDrawing()
    this.system?.removeAll()
    this.deactivate(false)
  }

  /** 重置当前绘制状态并销毁临时实例 */
  private resetDrawing(): void {
    if (this.drawing) {
      this.drawing.destroy()
      this.drawing = null
    }
    this.positions = []
    this.removeCursorEntity()
  }

  /** 提交当前量算后释放引用，不销毁已绘制 Entity */
  private releaseDrawing(): void {
    this.drawing = null
    this.positions = []
    this.removeCursorEntity()
  }

  /** 移除跟随鼠标的光标 Entity */
  private removeCursorEntity(): void {
    if (this.cursorEntity && this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.cursorEntity)
    }
    this.cursorEntity = null
  }

  /**
   * 更新或创建跟随鼠标的光标点。
   * @param llh 光标位置
   * @param clampToGround 是否贴地
   */
  private updateCursorEntity(llh: LngLatHeightTuple, clampToGround: boolean): void {
    if (!this.viewer || this.viewer.isDestroyed()) return
    const cart = Cesium.Cartesian3.fromDegrees(llh[0], llh[1], llh[2] ?? 0)
    if (this.cursorEntity) {
      this.cursorEntity.position = new Cesium.ConstantPositionProperty(cart)
      return
    }
    this.cursorEntity = this.viewer.entities.add({
      id: `fastx-measure-cursor-${Date.now()}`,
      position: cart,
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#59ff9b'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: clampToGround
          ? Cesium.HeightReference.CLAMP_TO_GROUND
          : Cesium.HeightReference.NONE,
      },
    })
  }

  /** 当前类型光标是否应贴地 */
  private clampCursorToGround(): boolean {
    if (!this.type) return true
    return (
      this.type !== MeasureType.LINE_DISTANCE &&
      this.type !== MeasureType.SPACE_AREA &&
      this.type !== MeasureType.LINE_BUFFER_ANALYZE &&
      this.type !== MeasureType.MULTI_POINT_ANALYZE
    )
  }

  /** 注册屏幕事件处理器 */
  private ensureHandler(): void {
    if (!this.viewer || this.handler) return
    this.viewer.canvas.oncontextmenu = (ev) => ev.preventDefault()
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas)
    this.handler.setInputAction((e: { position: Cesium.Cartesian2 }) => this.onLeftClick(e), Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.setInputAction((e: { position: Cesium.Cartesian2 }) => this.onLeftDoubleClick(e), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    this.handler.setInputAction(() => this.onRightClick(), Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    this.handler.setInputAction((e: { endPosition: Cesium.Cartesian2 }) => this.onMouseMove(e), Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  }

  /** 销毁屏幕事件处理器 */
  private destroyHandler(): void {
    this.handler?.destroy()
    this.handler = null
  }

  /**
   * 过滤重复/抖动点击。
   * @param clientX 客户端 X
   * @param clientY 客户端 Y
   */
  private validClick(clientX: number, clientY: number): boolean {
    const now = Date.now()
    const gap = now - this.lastClickMs
    this.lastClickMs = now
    const { x, y } = this.preScreen
    this.preScreen = { x: clientX, y: clientY }
    if (Math.abs(clientX - x) < 2 && Math.abs(clientY - y) < 2 && gap < 1000) return false
    return true
  }

  /** 左键单击：添加顶点或完成定点量算 */
  private onLeftClick(e: { position: Cesium.Cartesian2 }): void {
    if (!this.active || !this.viewer || !this.system || !this.type) return
    const rect = this.viewer.canvas.getBoundingClientRect()
    const clientX = rect.left + e.position.x
    const clientY = rect.top + e.position.y
    if (!this.validClick(clientX, clientY)) return

    const llh = llhFromPick(this.viewer, clientX, clientY)
    if (!llh) return

    if (this.type === MeasureType.POINT_BUFFER_ANALYZE) {
      this.system.createMeasure({ type: this.type, position: llh }, true)
      this.positions = []
      this.releaseDrawing()
      this.system.notifyDrawFinish()
      return
    }

    if (this.positions.length === 0) {
      this.positions.push(llh)
      this.drawing = this.system.createMeasure(
        { type: this.type, positions: [...this.positions] },
        false,
      )
      return
    }

    const [, max] = MEASURE_POINT_RANGE[this.type]

    if (FIXED_COUNT_TYPES.has(this.type)) {
      if (this.positions.length < max) {
        this.positions.push(llh)
        this.drawing?.setPositions?.([...this.positions])
        if (this.positions.length >= max) {
          this.system.pushCurrent(this.drawing!)
          this.drawing?.complete?.()
          this.releaseDrawing()
          this.system.notifyDrawFinish()
        }
      }
      return
    }

    this.positions.push(llh)
    this.drawing?.setPositions?.([...this.positions])
  }

  /** 左键双击：结束折线/多边形绘制 */
  private onLeftDoubleClick(e: { position: Cesium.Cartesian2 }): void {
    if (!this.active || FIXED_COUNT_TYPES.has(this.type!)) return
    const rect = this.viewer!.canvas.getBoundingClientRect()
    const llh = llhFromPick(this.viewer!, rect.left + e.position.x, rect.top + e.position.y)
    if (llh && this.positions.length > 0) {
      const last = this.positions[this.positions.length - 1]!
      if (last[0] === llh[0] && last[1] === llh[1]) this.positions.pop()
    }
    this.finishPolyline()
  }

  /** 右键：结束折线/多边形绘制 */
  private onRightClick(): void {
    if (!this.active || FIXED_COUNT_TYPES.has(this.type!)) return
    this.finishPolyline()
  }

  /** 提交折线/多边形量算并通知系统 */
  private finishPolyline(): void {
    const [min] = MEASURE_POINT_RANGE[this.type!] ?? [2, 2]
    if (this.positions.length >= min) {
      this.drawing?.setPositions?.([...this.positions])
      if (this.drawing) {
        this.system?.pushCurrent(this.drawing)
        this.drawing?.complete?.()
        this.releaseDrawing()
      }
    } else {
      this.resetDrawing()
    }
    this.system?.notifyDrawFinish()
  }

  /** 单次绘制结束后关闭拾取与光标，保留已提交结果 */
  finishSession(): void {
    this.removeCursorEntity()
    this.destroyHandler()
    this.active = false
    this.positions = []
  }

  /** 鼠标移动：更新光标与预览 */
  private onMouseMove(e: { endPosition: Cesium.Cartesian2 }): void {
    if (!this.active || !this.viewer) return
    const rect = this.viewer.canvas.getBoundingClientRect()
    const llh = llhFromPick(this.viewer, rect.left + e.endPosition.x, rect.top + e.endPosition.y)
    if (!llh) return

    this.updateCursorEntity(llh, this.clampCursorToGround())

    if (this.drawing && this.positions.length > 0) {
      this.drawing.update?.(llh)
    }
  }
}
