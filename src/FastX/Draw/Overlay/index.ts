import * as Cesium from 'cesium'
import type { Cartesian2, Entity, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import type {
  AddOverlayOptions,
  OverlayLineRenderType,
  OverlayLineStyle,
  OverlayOffset,
  OverlaySnapshot,
  OverlayViewHeightOptions,
  UpdateOverlayProperties,
} from '../../Types'

export type {
  AddOverlayOptions,
  OverlayLineRenderType,
  OverlayLineStyle,
  OverlayOffset,
  OverlaySnapshot,
  OverlayViewHeightOptions,
  UpdateOverlayProperties,
}

/** 标牌运行时记录。 */
interface OverlayRecord {
  id: string
  viewer: Viewer
  entity: Entity
  element: HTMLElement
  line?: Entity
  primitiveLine?: OverlayPrimitiveLine
  lineStyle: ResolvedOverlayLineStyle
  viewHeight: ResolvedOverlayViewHeight
  renderType: OverlayLineRenderType
  baseOffset: Cartesian2
  offset: Cartesian2
  show: boolean
  draggable: boolean
  targetData: Record<string, unknown>
  onDrag?: (position: { x: number; y: number }, id: string) => void
}

/** 当前拖拽状态。 */
interface DragState {
  id: string
  startMouseX: number
  startMouseY: number
  startOffsetX: number
  startOffsetY: number
}

/** Primitive 连线对象。 */
interface OverlayPrimitiveLine {
  collection: Cesium.PolylineCollection
  polyline: Cesium.Polyline
}

/** 每个 viewer 独立的 DOM 标牌根节点。 */
interface OverlayRootRecord {
  root: HTMLElement
  container: HTMLElement
  previousContainerPosition: string
}

/** 解析后的连线样式。 */
type ResolvedOverlayLineStyle = {
  color: string
  width: number
  dashLength: number
  dashed: boolean
  show: boolean
}

/** 解析后的视角高度显隐配置。 */
type ResolvedOverlayViewHeight = {
  enabled: boolean
  maxHeight: number
}

const OVERLAY_CLASS = 'fastx-overlay'
const OVERLAY_ROOT_CLASS = 'fastx-overlay-root'
const DATA_ID = 'data-fastx-overlay-id'
const DRAG_ACTIVE_EVENT_CAPTURE = true
const DEFAULT_OFFSET = Object.freeze({ x: 0, y: -50 })
const DEFAULT_LINE_STYLE: Readonly<ResolvedOverlayLineStyle> = Object.freeze({
  color: '#ff0000',
  width: 2,
  dashLength: 16,
  dashed: false,
  show: true,
})
const DEFAULT_VIEW_HEIGHT: Readonly<ResolvedOverlayViewHeight> = Object.freeze({
  enabled: true,
  maxHeight: 1_500_000,
})

/** 判断值是否为浏览器 DOM 元素，避免 SSR 或非浏览器环境下直接访问 HTMLElement 报错。 */
function isElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement
}

/** 复制业务数据，避免外部对象引用被内部状态直接持有。 */
function cloneData(data?: Record<string, unknown>): Record<string, unknown> {
  return data && typeof data === 'object' ? { ...data } : {}
}

/** 生成标牌 id；外部未传 id 时使用 FastX 随机 id。 */
function createId(id?: string): string {
  const value = id?.trim()
  return value || createRandomXgxId('overlay')
}

/** 把数组或对象形式的屏幕坐标统一转为 Cesium.Cartesian2。 */
function toCartesian2(value?: { x: number; y: number } | readonly [number, number]): Cartesian2 {
  if (!value) return new Cesium.Cartesian2(DEFAULT_OFFSET.x, DEFAULT_OFFSET.y)
  if ('x' in value) return new Cesium.Cartesian2(Number(value.x) || 0, Number(value.y) || 0)
  return new Cesium.Cartesian2(Number(value[0]) || 0, Number(value[1]) || 0)
}

/** 复制屏幕坐标对象，避免运行中修改基准偏移引用。 */
function cloneCartesian2(value: Cartesian2): Cartesian2 {
  return new Cesium.Cartesian2(value.x, value.y)
}

/** 解析 DOM id 或 HTMLElement，返回可挂载到 viewer 容器中的标牌元素。 */
function resolveElement(element: string | HTMLElement): HTMLElement | undefined {
  if (typeof element === 'string') return document.getElementById(element) ?? undefined
  return isElement(element) ? element : undefined
}

/** 合并默认连线样式，保证内部渲染时字段完整。 */
function resolveLineStyle(style?: OverlayLineStyle): ResolvedOverlayLineStyle {
  return {
    color: style?.color ?? DEFAULT_LINE_STYLE.color,
    width: style?.width ?? DEFAULT_LINE_STYLE.width,
    dashLength: style?.dashLength ?? DEFAULT_LINE_STYLE.dashLength,
    dashed: style?.dashed ?? DEFAULT_LINE_STYLE.dashed,
    show: style?.show ?? DEFAULT_LINE_STYLE.show,
  }
}

/** 按补丁局部更新连线样式，未传字段保留原值。 */
function mergeLineStyle(base: ResolvedOverlayLineStyle, patch?: OverlayLineStyle): ResolvedOverlayLineStyle {
  if (!patch) return base
  return {
    color: patch.color ?? base.color,
    width: patch.width ?? base.width,
    dashLength: patch.dashLength ?? base.dashLength,
    dashed: patch.dashed ?? base.dashed,
    show: patch.show ?? base.show,
  }
}

/** 解析视角高度显隐配置，超过 maxHeight 时自动隐藏标牌。 */
function resolveViewHeight(options?: OverlayViewHeightOptions): ResolvedOverlayViewHeight {
  const maxHeight = Number(options?.maxHeight)
  return {
    enabled: options?.enabled ?? DEFAULT_VIEW_HEIGHT.enabled,
    maxHeight: Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : DEFAULT_VIEW_HEIGHT.maxHeight,
  }
}

/** 合并视角高度显隐配置，未传字段保留原值。 */
function mergeViewHeight(
  base: ResolvedOverlayViewHeight,
  patch?: OverlayViewHeightOptions,
): ResolvedOverlayViewHeight {
  if (!patch) return base
  const maxHeight = Number(patch.maxHeight)
  return {
    enabled: patch.enabled ?? base.enabled,
    maxHeight: Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : base.maxHeight,
  }
}

/** 把 CSS 颜色字符串转为 Cesium.Color。 */
function cssColor(style: ResolvedOverlayLineStyle): Cesium.Color {
  return Cesium.Color.fromCssColorString(style.color)
}

/** 创建 Entity polyline 使用的 Cesium 材质属性。 */
function entityLineMaterial(style: ResolvedOverlayLineStyle): Cesium.MaterialProperty {
  if (style.dashed) {
    return new Cesium.PolylineDashMaterialProperty({
      color: cssColor(style),
      dashLength: style.dashLength,
    })
  }
  return new Cesium.ColorMaterialProperty(cssColor(style))
}

/** 创建 Primitive polyline 使用的 Cesium 材质。 */
function primitiveLineMaterial(style: ResolvedOverlayLineStyle): Cesium.Material {
  if (style.dashed) {
    return Cesium.Material.fromType('PolylineDash', {
      color: cssColor(style),
      dashLength: style.dashLength,
    })
  }
  return Cesium.Material.fromType('Color', { color: cssColor(style) })
}

/** 按当前时钟采样实体位置，支持动态 position 属性。 */
function sampleEntityPosition(entity: Entity, viewer: Viewer): Cesium.Cartesian3 | undefined {
  const position = entity.position
  return position?.getValue(viewer.clock.currentTime)
}

/** 将 Cesium window/canvas 坐标换算为 viewer 容器内坐标。 */
function canvasToContainer(viewer: Viewer, point: Cartesian2): Cartesian2 {
  const canvasRect = viewer.scene.canvas.getBoundingClientRect()
  const containerRect = getViewerContainer(viewer).getBoundingClientRect()
  return new Cesium.Cartesian2(point.x + canvasRect.left - containerRect.left, point.y + canvasRect.top - containerRect.top)
}

/** 将 viewer 容器内坐标换算为 Cesium canvas 坐标，用于拾取地表连线点。 */
function containerToCanvas(viewer: Viewer, point: Cartesian2): Cartesian2 {
  const canvasRect = viewer.scene.canvas.getBoundingClientRect()
  const containerRect = getViewerContainer(viewer).getBoundingClientRect()
  return new Cesium.Cartesian2(point.x + containerRect.left - canvasRect.left, point.y + containerRect.top - canvasRect.top)
}

/** 获取 Cesium Viewer 的容器元素。 */
function getViewerContainer(viewer: Viewer): HTMLElement {
  return viewer.container as HTMLElement
}

/** 判断当前场景是否处于稳定可投影模式；Morphing 过程暂不更新标牌。 */
function isVisibleSceneMode(viewer: Viewer): boolean {
  return viewer.scene.mode !== Cesium.SceneMode.MORPHING
}

/**
 * HTML 标牌 API。
 *
 * 用于把业务 DOM 标牌绑定到 Cesium Entity，支持 2D/3D 自动跟随、拖拽、智能连线点、
 * Entity 连线和 Primitive 连线两种绘制方式。
 */
export default class Overlay {
  /** 所有标牌记录，key 为标牌 id。 */
  private readonly data = new Map<string, OverlayRecord>()

  /** 每个 viewer 的 postRender 监听。 */
  private readonly updateHandlers = new Map<Viewer, () => void>()

  /** 每个 viewer 的 DOM 标牌根节点。 */
  private readonly roots = new Map<Viewer, OverlayRootRecord>()

  /** 当前拖拽状态。 */
  private dragState: DragState | null = null

  /** 是否已经绑定全局拖拽事件。 */
  private dragEventsBound = false

  /**
   * 新增一个 HTML 标牌。
   *
   * @param viewer Cesium Viewer 实例。
   * @param options 标牌绑定实体、DOM、偏移、连线和拖拽配置。
   * @returns 创建成功后的标牌 id；失败时返回 undefined。
   */
  add(viewer: Viewer, options: AddOverlayOptions): string | undefined {
    if (!viewer || viewer.isDestroyed() || typeof document === 'undefined') return undefined
    if (!options.entity?.id) return undefined

    const element = options.element ? resolveElement(options.element) : undefined
    if (!element) return undefined

    const id = createId(options.id)
    if (this.data.has(id)) this.remove(id)

    const offset = toCartesian2(options.offset)
    const record: OverlayRecord = {
      id,
      viewer,
      entity: options.entity,
      element,
      baseOffset: cloneCartesian2(offset),
      offset,
      lineStyle: resolveLineStyle(options.lineStyle),
      viewHeight: resolveViewHeight(options.viewHeight),
      renderType: options.renderType ?? 'entity',
      draggable: options.draggable ?? true,
      show: options.show ?? true,
      targetData: cloneData(options.targetData),
      onDrag: options.onDrag,
    }

    this.data.set(id, record)
    this.prepareElement(record)
    this.ensureViewerUpdater(viewer)
    if (record.draggable) this.bindDragEvents()
    this.createLine(record)
    this.updatePosition(record)

    return id
  }

  /**
   * 批量新增 HTML 标牌。
   *
   * @param viewer Cesium Viewer 实例。
   * @param items 标牌配置数组。
   * @returns 创建成功的标牌 id 列表。
   */
  addBatch(viewer: Viewer, items: AddOverlayOptions[]): string[] {
    if (!Array.isArray(items) || items.length === 0) return []
    return items.map((item) => this.add(viewer, item)).filter((id): id is string => Boolean(id))
  }

  /**
   * 更新标牌实体、DOM、偏移、连线、拖拽、显隐或业务数据。
   *
   * @param id 标牌 id。
   * @param properties 要更新的属性。
   */
  updateOverlay(id: string, properties: UpdateOverlayProperties): boolean {
    const record = this.takeIfAlive(id)
    if (!record) return false

    if (properties.entity !== undefined) {
      if (!properties.entity.id) return false
      record.entity = properties.entity
    }

    if (properties.element !== undefined) {
      const element = resolveElement(properties.element)
      if (!element) return false
      this.detachElement(record)
      record.element = element
      this.prepareElement(record)
    }

    if (properties.offset !== undefined) {
      record.offset = toCartesian2(properties.offset)
      record.baseOffset = cloneCartesian2(record.offset)
    }
    if (properties.lineStyle !== undefined) {
      record.lineStyle = mergeLineStyle(record.lineStyle, properties.lineStyle)
      this.rebuildLine(record)
    }
    if (properties.viewHeight !== undefined) record.viewHeight = mergeViewHeight(record.viewHeight, properties.viewHeight)
    if (properties.renderType !== undefined && properties.renderType !== record.renderType) {
      record.renderType = properties.renderType
      this.rebuildLine(record)
    }
    if (properties.draggable !== undefined) {
      record.draggable = properties.draggable
      record.element.style.cursor = record.draggable ? 'grab' : ''
      record.element.style.userSelect = record.draggable ? 'none' : ''
      if (record.draggable) this.bindDragEvents()
    }
    if (properties.targetData !== undefined) record.targetData = { ...record.targetData, ...properties.targetData }
    if (properties.onDrag !== undefined) record.onDrag = properties.onDrag
    if (properties.show !== undefined) this.setVisible(id, properties.show)

    this.updatePosition(record)
    return true
  }

  /**
   * 更新标牌连线样式。
   *
   * @param id 标牌 id。
   * @param lineStyle 连线样式。
   */
  updateLineStyle(id: string, lineStyle: OverlayLineStyle): boolean {
    return this.updateOverlay(id, { lineStyle })
  }

  /**
   * 设置标牌相对实体屏幕坐标的偏移，并恢复自动跟随实体。
   *
   * @param id 标牌 id。
   * @param offset 偏移像素，[x, y] 或 { x, y }。
   */
  setOffset(id: string, offset: { x: number; y: number } | readonly [number, number]): boolean {
    return this.updateOverlay(id, { offset })
  }

  /**
   * 清除拖拽偏移，恢复到外部配置的基准偏移。
   *
   * @param id 标牌 id。
   */
  resetPosition(id: string): boolean {
    const record = this.takeIfAlive(id)
    if (!record) return false
    record.offset = cloneCartesian2(record.baseOffset)
    this.updatePosition(record)
    return true
  }

  /**
   * 显示指定标牌。
   *
   * @param id 标牌 id。
   */
  show(id: string): boolean {
    return this.setVisible(id, true)
  }

  /**
   * 隐藏指定标牌。
   *
   * @param id 标牌 id。
   */
  hide(id: string): boolean {
    return this.setVisible(id, false)
  }

  /**
   * 设置指定标牌显隐。
   *
   * @param id 标牌 id。
   * @param visible 是否显示。
   */
  setVisible(id: string, visible: boolean): boolean {
    const record = this.takeIfAlive(id)
    if (!record) return false
    record.show = visible
    record.element.style.display = visible ? 'block' : 'none'
    this.updateLineVisibility(record)
    if (visible) this.updatePosition(record)
    return true
  }

  /**
   * 设置全部标牌显隐，可按 viewer 限定。
   *
   * @param visible 是否显示。
   * @param viewer 指定 viewer，不传则处理全部标牌。
   */
  setAllVisibility(visible: boolean, viewer?: Viewer): void {
    for (const [id, record] of this.data) {
      if (!viewer || record.viewer === viewer) this.setVisible(id, visible)
    }
  }

  /**
   * 获取标牌快照。
   *
   * @param id 标牌 id。
   */
  getOverlay(id: string): OverlaySnapshot | null {
    const record = this.takeIfAlive(id)
    if (!record) return null
    return {
      id,
      entityId: String(record.entity.id),
      show: record.show,
      offset: { x: record.offset.x, y: record.offset.y },
      lineStyle: { ...record.lineStyle },
      viewHeight: { ...record.viewHeight },
      renderType: record.renderType,
      draggable: record.draggable,
      targetData: { ...record.targetData },
    }
  }

  /**
   * 获取全部标牌快照，可按 viewer 限定。
   *
   * @param viewer 指定 viewer，不传则返回全部标牌。
   */
  getAllOverlays(viewer?: Viewer): OverlaySnapshot[] {
    return this.getIds(viewer)
      .map((id) => this.getOverlay(id))
      .filter((item): item is OverlaySnapshot => Boolean(item))
  }

  /**
   * 获取标牌业务数据。
   *
   * @param id 标牌 id。
   */
  getTargetData(id: string): Record<string, unknown> | undefined {
    const record = this.takeIfAlive(id)
    return record ? { ...record.targetData } : undefined
  }

  /**
   * 整体替换标牌业务数据。
   *
   * @param id 标牌 id。
   * @param targetData 新业务数据。
   */
  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const record = this.takeIfAlive(id)
    if (!record) return false
    record.targetData = cloneData(targetData)
    return true
  }

  /**
   * 合并更新标牌业务数据。
   *
   * @param id 标牌 id。
   * @param patch 业务数据补丁。
   */
  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const record = this.takeIfAlive(id)
    if (!record) return false
    record.targetData = { ...record.targetData, ...patch }
    return true
  }

  /**
   * 获取标牌 DOM。
   *
   * @param id 标牌 id。
   */
  getElement(id: string): HTMLElement | undefined {
    return this.takeIfAlive(id)?.element
  }

  /**
   * 获取标牌绑定实体。
   *
   * @param id 标牌 id。
   */
  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity
  }

  /**
   * 判断标牌是否存在。
   *
   * @param id 标牌 id。
   */
  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined
  }

  /**
   * 获取标牌 id 列表，可按 viewer 限定。
   *
   * @param viewer 指定 viewer，不传则返回全部 id。
   */
  getIds(viewer?: Viewer): string[] {
    const ids: string[] = []
    for (const [id, record] of this.data) {
      if ((!viewer || record.viewer === viewer) && this.isRecordAlive(record)) ids.push(id)
    }
    return ids
  }

  /**
   * 获取标牌数量，可按 viewer 限定。
   *
   * @param viewer 指定 viewer，不传则统计全部标牌。
   */
  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
  }

  /**
   * 移除指定标牌。
   *
   * @param id 标牌 id。
   */
  remove(id: string): boolean {
    const record = this.data.get(id)
    if (!record) return false
    if (this.dragState?.id === id) this.endDrag(record)
    this.data.delete(id)
    this.removeLine(record)
    this.detachElement(record)
    this.cleanupViewer(record.viewer)
    return true
  }

  /**
   * 批量移除标牌。
   *
   * @param ids 标牌 id 列表。
   */
  removeBatch(ids: string[]): number {
    return ids.reduce((count, id) => count + (this.remove(id) ? 1 : 0), 0)
  }

  /**
   * 清空标牌，可按 viewer 限定。
   *
   * @param viewer 指定 viewer，不传则清空全部标牌。
   */
  clear(viewer?: Viewer): void {
    for (const id of this.getIds(viewer)) this.remove(id)
  }

  /**
   * 清理已经失效的 viewer 或 entity 记录。
   */
  pruneInvalid(): number {
    let count = 0
    for (const [id, record] of [...this.data]) {
      if (!this.isRecordAlive(record)) {
        this.remove(id)
        count += 1
      }
    }
    return count
  }

  /**
   * 销毁全部标牌和内部事件监听。
   */
  destroy(): void {
    this.clear()
    this.unbindDragEvents()
    for (const [viewer, handler] of this.updateHandlers) {
      if (!viewer.isDestroyed()) viewer.scene.postRender.removeEventListener(handler)
    }
    this.updateHandlers.clear()
    this.roots.clear()
  }

  /** 初始化标牌 DOM 样式，并挂载到当前 viewer 的标牌根节点下。 */
  private prepareElement(record: OverlayRecord): void {
    const root = this.ensureRoot(record.viewer).root
    const { element } = record
    element.classList.add(OVERLAY_CLASS)
    element.setAttribute(DATA_ID, record.id)
    element.style.position = 'absolute'
    element.style.display = record.show ? 'block' : 'none'
    element.style.cursor = record.draggable ? 'grab' : ''
    element.style.userSelect = record.draggable ? 'none' : ''
    element.style.pointerEvents = 'auto'
    element.style.transform = 'translate3d(0, 0, 0)'
    if (element.parentElement !== root) root.appendChild(element)
  }

  /** 从 DOM 中移除标牌元素，并清理内部追加的样式和属性。 */
  private detachElement(record: OverlayRecord): void {
    record.element.classList.remove(OVERLAY_CLASS, 'dragging')
    record.element.removeAttribute(DATA_ID)
    record.element.style.cursor = ''
    record.element.style.userSelect = ''
    record.element.style.transform = ''
    if (record.element.parentElement) record.element.parentElement.removeChild(record.element)
  }

  /** 确保当前 viewer 拥有独立 overlay root，避免 2D/3D 切换时使用 body 坐标导致偏移。 */
  private ensureRoot(viewer: Viewer): OverlayRootRecord {
    const cached = this.roots.get(viewer)
    if (cached) return cached

    const container = getViewerContainer(viewer)
    const previousContainerPosition = container.style.position
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative'

    const root = document.createElement('div')
    root.className = OVERLAY_ROOT_CLASS
    root.style.position = 'absolute'
    root.style.left = '0'
    root.style.top = '0'
    root.style.right = '0'
    root.style.bottom = '0'
    root.style.pointerEvents = 'none'
    root.style.overflow = 'visible'
    root.style.zIndex = '20'
    container.appendChild(root)

    const record = { root, container, previousContainerPosition }
    this.roots.set(viewer, record)
    return record
  }

  /** 当前 viewer 没有标牌后，移除 postRender 监听和 overlay root。 */
  private cleanupViewer(viewer: Viewer): void {
    if ([...this.data.values()].some((record) => record.viewer === viewer)) return
    const handler = this.updateHandlers.get(viewer)
    if (handler && !viewer.isDestroyed()) viewer.scene.postRender.removeEventListener(handler)
    this.updateHandlers.delete(viewer)

    const rootRecord = this.roots.get(viewer)
    if (!rootRecord) return
    if (rootRecord.root.parentElement) rootRecord.root.parentElement.removeChild(rootRecord.root)
    rootRecord.container.style.position = rootRecord.previousContainerPosition
    this.roots.delete(viewer)
  }

  /** 按 renderType 创建标牌到地表的连线。 */
  private createLine(record: OverlayRecord): void {
    if (!record.lineStyle.show) return
    if (record.renderType === 'primitive') {
      record.primitiveLine = this.createPrimitiveLine(record)
      return
    }
    record.line = record.viewer.entities.add({
      show: this.isDisplayAllowed(record),
      polyline: {
        positions: new Cesium.CallbackProperty(() => this.resolveLinePositions(record), false),
        width: record.lineStyle.width,
        material: entityLineMaterial(record.lineStyle),
        clampToGround: true,
        arcType: Cesium.ArcType.GEODESIC,
      },
    })
  }

  /** 连线样式或绘制方式变化时重建连线。 */
  private rebuildLine(record: OverlayRecord): void {
    this.removeLine(record)
    this.createLine(record)
    this.updatePrimitiveLine(record)
  }

  /** 移除当前标牌关联的 Entity 或 Primitive 连线。 */
  private removeLine(record: OverlayRecord): void {
    if (!record.viewer.isDestroyed()) {
      if (record.line) record.viewer.entities.remove(record.line)
      if (record.primitiveLine) record.viewer.scene.primitives.remove(record.primitiveLine.collection)
    }
    record.line = undefined
    record.primitiveLine = undefined
  }

  /** 创建 Primitive 形式连线，适合大量标牌时减少 Entity 开销。 */
  private createPrimitiveLine(record: OverlayRecord): OverlayPrimitiveLine {
    const collection = new Cesium.PolylineCollection()
    const polyline = collection.add({
      positions: [],
      width: record.lineStyle.width,
      material: primitiveLineMaterial(record.lineStyle),
      show: this.isDisplayAllowed(record) && record.lineStyle.show,
    })
    record.viewer.scene.primitives.add(collection)
    return { collection, polyline }
  }

  /** 读取当前相机到地表的高度，失败时回退为相机制图高度。 */
  private cameraHeight(record: OverlayRecord): number {
    const globeHeight = record.viewer.scene.globe.getHeight(record.viewer.camera.positionCartographic)
    return record.viewer.camera.positionCartographic.height - (globeHeight ?? 0)
  }

  /** 判断视角高度是否允许显示标牌。 */
  private isViewHeightVisible(record: OverlayRecord): boolean {
    return !record.viewHeight.enabled || this.cameraHeight(record) <= record.viewHeight.maxHeight
  }

  /** 判断标牌当前是否允许显示。 */
  private isDisplayAllowed(record: OverlayRecord): boolean {
    return record.show && this.isViewHeightVisible(record)
  }

  /** 根据标牌显隐、视角高度和线样式同步连线显隐。 */
  private updateLineVisibility(record: OverlayRecord): void {
    const visible = this.isDisplayAllowed(record) && record.lineStyle.show
    if (record.line) record.line.show = visible
    if (record.primitiveLine) record.primitiveLine.polyline.show = visible
  }

  /** 计算连线两端世界坐标：实体位置到标牌最近角点投影到地表的位置。 */
  private resolveLinePositions(record: OverlayRecord): Cesium.Cartesian3[] {
    if (!this.isDisplayAllowed(record) || !record.lineStyle.show) return []
    const entityPosition = sampleEntityPosition(record.entity, record.viewer)
    if (!entityPosition) return []
    const target = this.pickConnectionWorld(record)
    return target ? [entityPosition, target] : [entityPosition]
  }

  /** 将标牌智能连接点从屏幕坐标拾取到地表世界坐标。 */
  private pickConnectionWorld(record: OverlayRecord): Cesium.Cartesian3 | undefined {
    const entityPosition = sampleEntityPosition(record.entity, record.viewer)
    if (!entityPosition) return undefined

    const connection = this.resolveBestConnectionPoint(record, entityPosition)
    const canvasPoint = containerToCanvas(record.viewer, connection)
    const ray = record.viewer.camera.getPickRay(canvasPoint)
    if (!ray) return undefined

    return (
      record.viewer.scene.globe.pick(ray, record.viewer.scene) ??
      record.viewer.camera.pickEllipsoid(canvasPoint, record.viewer.scene.globe.ellipsoid)
    )
  }

  /** 从标牌四个角中选出距离实体屏幕位置最近的连线点。 */
  private resolveBestConnectionPoint(record: OverlayRecord, entityPosition: Cesium.Cartesian3): Cartesian2 {
    const entityScreen = this.worldToContainerCoordinates(record.viewer, entityPosition)
    if (!entityScreen) return this.elementCenter(record)

    const rect = this.elementRectInRoot(record)
    const corners = [
      new Cesium.Cartesian2(rect.left, rect.top),
      new Cesium.Cartesian2(rect.right, rect.top),
      new Cesium.Cartesian2(rect.left, rect.bottom),
      new Cesium.Cartesian2(rect.right, rect.bottom),
    ]

    return corners.reduce((best, point) =>
      Cesium.Cartesian2.distance(point, entityScreen) < Cesium.Cartesian2.distance(best, entityScreen) ? point : best,
    )
  }

  /** 每帧同步标牌 DOM 位置，始终以实体投影点为基准叠加 offset。 */
  private updatePosition(record: OverlayRecord): void {
    if (record.viewer.isDestroyed()) return
    if (!this.isDisplayAllowed(record)) {
      this.hideElementOnly(record)
      return
    }
    const entityPosition = sampleEntityPosition(record.entity, record.viewer)
    if (!entityPosition || !isVisibleSceneMode(record.viewer)) {
      this.hideElementOnly(record)
      return
    }

    const base = this.worldToContainerCoordinates(record.viewer, entityPosition)
    if (!base) {
      this.hideElementOnly(record)
      return
    }

    const x = base.x + record.offset.x
    const y = base.y + record.offset.y
    record.element.style.display = 'block'
    this.updateLineVisibility(record)
    record.element.style.left = `${x}px`
    record.element.style.top = `${y}px`
    this.updatePrimitiveLine(record)
  }

  /** 只隐藏 DOM 和连线，不改变外部 show 状态；用于临时无法投影的帧。 */
  private hideElementOnly(record: OverlayRecord): void {
    record.element.style.display = 'none'
    if (record.line) record.line.show = false
    if (record.primitiveLine) record.primitiveLine.polyline.show = false
  }

  /** 刷新 Primitive 连线的显隐和端点位置。 */
  private updatePrimitiveLine(record: OverlayRecord): void {
    if (!record.primitiveLine) return
    record.primitiveLine.polyline.show = this.isDisplayAllowed(record) && record.lineStyle.show
    record.primitiveLine.polyline.positions = this.resolveLinePositions(record)
  }

  /** 将世界坐标转换为 viewer 容器内屏幕坐标，内部兼容 Cesium 2D/3D 转换差异。 */
  private worldToContainerCoordinates(viewer: Viewer, position: Cesium.Cartesian3): Cartesian2 | undefined {
    const scene = viewer.scene
    const transforms = Cesium.SceneTransforms as typeof Cesium.SceneTransforms & {
      wgs84ToWindowCoordinates?: (
        scene: Cesium.Scene,
        position: Cesium.Cartesian3,
        result?: Cesium.Cartesian2,
      ) => Cesium.Cartesian2 | undefined
    }

    const worldPoint =
      transforms.worldToWindowCoordinates(scene, position) ?? transforms.wgs84ToWindowCoordinates?.(scene, position)
    if (worldPoint) return canvasToContainer(viewer, worldPoint)

    const sceneWithCanvas = scene as Cesium.Scene & {
      cartesianToCanvasCoordinates?: (position: Cesium.Cartesian3, result?: Cesium.Cartesian2) => Cesium.Cartesian2 | undefined
    }
    const canvasPoint = sceneWithCanvas.cartesianToCanvasCoordinates?.(position)
    return canvasPoint ? canvasToContainer(viewer, canvasPoint) : undefined
  }

  /** 获取标牌元素相对 overlay root 的矩形范围。 */
  private elementRectInRoot(record: OverlayRecord): DOMRect {
    const rect = record.element.getBoundingClientRect()
    const rootRect = this.ensureRoot(record.viewer).root.getBoundingClientRect()
    return {
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      right: rect.right - rootRect.left,
      bottom: rect.bottom - rootRect.top,
      width: rect.width,
      height: rect.height,
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      toJSON: rect.toJSON.bind(rect),
    } as DOMRect
  }

  /** 获取标牌元素中心点，用作无法计算实体屏幕点时的连线兜底点。 */
  private elementCenter(record: OverlayRecord): Cartesian2 {
    const rect = this.elementRectInRoot(record)
    return new Cesium.Cartesian2(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  /** 为 viewer 注册一次 postRender 监听，用于在 Cesium 相机矩阵稳定后同步该 viewer 下所有标牌。 */
  private ensureViewerUpdater(viewer: Viewer): void {
    if (this.updateHandlers.has(viewer)) return
    const handler = () => {
      for (const record of this.data.values()) {
        if (record.viewer === viewer) this.updatePosition(record)
      }
    }
    viewer.scene.postRender.addEventListener(handler)
    this.updateHandlers.set(viewer, handler)
  }

  /** 绑定全局拖拽事件；仅首次启用拖拽标牌时注册。 */
  private bindDragEvents(): void {
    if (this.dragEventsBound || typeof document === 'undefined') return
    document.addEventListener('mousedown', this.handleMouseDown)
    document.addEventListener('mousemove', this.handleMouseMove, DRAG_ACTIVE_EVENT_CAPTURE)
    document.addEventListener('mouseup', this.handleMouseUp, DRAG_ACTIVE_EVENT_CAPTURE)
    this.dragEventsBound = true
  }

  /** 解绑全局拖拽事件，销毁 Overlay 时调用。 */
  private unbindDragEvents(): void {
    if (!this.dragEventsBound || typeof document === 'undefined') return
    document.removeEventListener('mousedown', this.handleMouseDown)
    document.removeEventListener('mousemove', this.handleMouseMove, DRAG_ACTIVE_EVENT_CAPTURE)
    document.removeEventListener('mouseup', this.handleMouseUp, DRAG_ACTIVE_EVENT_CAPTURE)
    if (this.dragState) this.endDrag(this.data.get(this.dragState.id))
    this.dragEventsBound = false
  }

  /** 鼠标按下时进入标牌拖拽状态。 */
  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    const element = this.findOverlayElement(event.target)
    if (!element) return
    const id = element.getAttribute(DATA_ID)
    if (!id) return

    const record = this.data.get(id)
    if (!record?.show || !record.draggable) return

    this.dragState = {
      id,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startOffsetX: record.offset.x,
      startOffsetY: record.offset.y,
    }
    record.element.style.cursor = 'grabbing'
    record.element.classList.add('dragging')
    this.stopDragEvent(event)
  }

  /** 鼠标移动时更新相对实体的偏移，保证拖拽后仍继续跟随实体。 */
  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.dragState) return
    this.stopDragEvent(event)
    const record = this.data.get(this.dragState.id)
    if (!record) {
      this.dragState = null
      return
    }

    record.offset = new Cesium.Cartesian2(
      this.dragState.startOffsetX + event.clientX - this.dragState.startMouseX,
      this.dragState.startOffsetY + event.clientY - this.dragState.startMouseY,
    )
    this.updatePosition(record)
    record.onDrag?.(this.currentElementPosition(record), record.id)
  }

  /** 鼠标释放时结束拖拽状态。 */
  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (!this.dragState) return
    this.stopDragEvent(event)
    this.endDrag(this.data.get(this.dragState.id))
  }

  /** 结束当前拖拽状态，并恢复标牌鼠标样式。 */
  private endDrag(record?: OverlayRecord): void {
    if (record) {
      record.element.style.cursor = record.draggable ? 'grab' : ''
      record.element.classList.remove('dragging')
    }
    this.dragState = null
  }

  /** 阻止拖拽事件继续触发 Cesium 相机交互。 */
  private stopDragEvent(event: MouseEvent): void {
    event.preventDefault()
    event.stopPropagation()
  }

  /** 获取标牌左上角在 overlay root 内的当前位置。 */
  private currentElementPosition(record: OverlayRecord): { x: number; y: number } {
    const left = Number.parseFloat(record.element.style.left)
    const top = Number.parseFloat(record.element.style.top)
    if (Number.isFinite(left) && Number.isFinite(top)) return { x: left, y: top }
    const rect = this.elementRectInRoot(record)
    return { x: rect.left, y: rect.top }
  }

  /** 从事件目标向上查找实际被操作的标牌根元素。 */
  private findOverlayElement(target: EventTarget | null): HTMLElement | null {
    let node = target
    while (isElement(node)) {
      if (node.classList.contains(OVERLAY_CLASS)) return node
      node = node.parentElement
    }
    return null
  }

  /** 判断内部记录是否仍可用。 */
  private isRecordAlive(record: OverlayRecord): boolean {
    return !record.viewer.isDestroyed() && Boolean(record.entity.position)
  }

  /** 获取可用记录；如果 viewer 或实体失效则同步清理该标牌。 */
  private takeIfAlive(id: string): OverlayRecord | undefined {
    const record = this.data.get(id)
    if (!record) return undefined
    if (!this.isRecordAlive(record)) {
      this.remove(id)
      return undefined
    }
    return record
  }
}
