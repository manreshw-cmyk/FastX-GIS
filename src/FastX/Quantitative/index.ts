import type { Viewer } from 'cesium'
import {
  AltitudeInterceptMeasure,
  AreaAnalyze,
  AzimuthMeasure,
  ContourAnalyze,
  ContourShaderAnalyze,
  GroundDistanceMeasure,
  LineAnalyze,
  BufferAnalyze,
  LineDistanceMeasure,
  MultiPointAnalyze,
  ProjectionAreaMeasure,
  ProjectionDistanceMeasure,
  SpaceAreaMeasure,
  ViewShedAnalyze,
} from './components'
import { applyContourGlobeShader, clearContourGlobeShader } from './contourGlobeShader'
import { MeasureTool } from './MeasureTool'
import { mergeMeasureStyle } from './measureStyleDefaults'
import type { MeasureStyle } from './types'
import type {
  IMeasure,
  MeasureCreateOptions,
  MeasureTypeKey,
  QuantitativeOptions,
} from './types'
import { MeasureType } from './types'

type MeasureBucket = IMeasure[]

/**
 * FastX 量算分析系统：统一管理各测量/分析子类，并提供交互工具 `MeasureTool`。
 */
export class Quantitative {
  private viewer: Viewer | null = null
  private currentType: MeasureTypeKey | undefined
  private removeOnTypeChange: boolean
  private readonly buckets = new Map<MeasureTypeKey, MeasureBucket>()
  private drawFinishListener: (() => void) | null = null
  private pendingStyle?: MeasureStyle
  readonly tool = new MeasureTool()

  /** 等高线等高距（米） */
  contourInterval = 100
  /** 等高线网格密度 */
  contourGridSize = 30
  /** 缓冲区默认半径（米） */
  bufferWidth = 1000

  /**
   * @param options 系统选项
   */
  constructor(options?: QuantitativeOptions) {
    this.removeOnTypeChange = options?.removeOnTypeChange ?? false
    for (const t of Object.values(MeasureType)) {
      this.buckets.set(t, [])
    }
  }

  /** 绑定 Cesium Viewer，并同步给交互工具 */
  bindViewer(viewer: Viewer): void {
    this.viewer = viewer
    this.tool.bind(viewer, this)
  }

  /** 获取已绑定的 Viewer（已销毁则返回 null） */
  getViewer(): Viewer | null {
    if (this.viewer?.isDestroyed()) return null
    return this.viewer
  }

  /** 切换量算类型；`removeOnTypeChange` 为 true 时清除已有结果 */
  setMeasureType(type: MeasureTypeKey): void {
    if (this.currentType === type) return
    if (this.removeOnTypeChange) this.removeAll()
    this.tool.deactivate(false)
    this.currentType = type
  }

  /** 获取当前量算类型 */
  getMeasureType(): MeasureTypeKey | undefined {
    return this.currentType
  }

  /** 设置下一次 createMeasure 使用的样式（页面配置后传入） */
  setPendingStyle(style?: MeasureStyle): void {
    this.pendingStyle = style
  }

  /**
   * 创建量算实例。
   * @param options 创建选项（不含 viewer）
   * @param addToBucket 是否加入类型桶便于统一管理
   */
  createMeasure(options: Omit<MeasureCreateOptions, 'viewer'>, addToBucket = true): IMeasure | null {
    const viewer = this.getViewer()
    if (!viewer) return null
    const style = options.style ?? this.pendingStyle
    const full: MeasureCreateOptions = {
      ...options,
      viewer,
      style: style ? mergeMeasureStyle(style) : undefined,
      contourInterval: options.contourInterval ?? this.contourInterval,
      contourGridSize: options.contourGridSize ?? this.contourGridSize,
      bufferWidth: options.bufferWidth ?? this.bufferWidth,
      onContourShaderChange: () => this.syncContourGlobeShader(),
      viewShed: options.viewShed,
    }
    const type = options.type
    let measure: IMeasure | null = null

    switch (type) {
      case MeasureType.LINE_DISTANCE:
        measure = new LineDistanceMeasure({ ...full, clampToGround: false })
        break
      case MeasureType.GROUND_DISTANCE:
        measure = new GroundDistanceMeasure(full)
        break
      case MeasureType.PROJECTION_DISTANCE:
        measure = new ProjectionDistanceMeasure(full)
        break
      case MeasureType.SPACE_AREA:
        measure = new SpaceAreaMeasure({ ...full, clampToGround: false })
        break
      case MeasureType.PROJECTION_AREA:
        measure = new ProjectionAreaMeasure(full)
        break
      case MeasureType.ALTITUDE_INTERCEPT:
        measure = new AltitudeInterceptMeasure({ ...full, clampToGround: false })
        break
      case MeasureType.AZIMUTH:
        measure = new AzimuthMeasure(full)
        break
      case MeasureType.LINE_ANALYZE:
        measure = new LineAnalyze(full)
        break
      case MeasureType.AREA_ANALYZE:
        measure = new AreaAnalyze(full)
        break
      case MeasureType.MULTI_POINT_ANALYZE:
        measure = new MultiPointAnalyze({ ...full, clampToGround: false })
        break
      case MeasureType.VIEWSHED_ANALYZE:
        measure = new ViewShedAnalyze(full)
        break
      case MeasureType.CONTOUR_ANALYZE:
        measure = new ContourAnalyze(full)
        break
      case MeasureType.CONTOUR_ANALYZE_SHADER:
        measure = new ContourShaderAnalyze(full)
        break
      case MeasureType.POINT_BUFFER_ANALYZE:
      case MeasureType.LINE_BUFFER_ANALYZE:
      case MeasureType.PLANE_BUFFER_ANALYZE:
        measure = new BufferAnalyze(full)
        break
      default:
        return null
    }

    if (measure && addToBucket) this.push(type, measure)
    return measure
  }

  /** 将交互完成的量算实例登记到对应类型桶 */
  pushCurrent(measure: IMeasure): void {
    this.push(measure.type, measure)
  }

  /** 登记量算实例，已存在则跳过 */
  push(type: MeasureTypeKey, measure: IMeasure): number | undefined {
    const arr = this.buckets.get(type)
    if (!arr) return undefined
    if (arr.includes(measure)) return undefined
    return arr.push(measure)
  }

  /** 移除并销毁单个量算实例 */
  removeMeasure(measure: IMeasure): void {
    measure.destroy()
    const arr = this.buckets.get(measure.type)
    if (!arr) return
    const idx = arr.indexOf(measure)
    if (idx >= 0) arr.splice(idx, 1)
  }

  /** 移除并销毁某类型的全部量算实例 */
  removeByType(type: MeasureTypeKey): void {
    const arr = this.buckets.get(type)
    if (!arr) return
    for (const m of [...arr]) m.destroy()
    arr.length = 0
  }

  /** 移除并销毁所有类型的量算实例 */
  removeAll(): void {
    this.tool.deactivate(false)
    for (const arr of this.buckets.values()) {
      for (const m of [...arr]) m.destroy()
      arr.length = 0
    }
    const viewer = this.getViewer()
    if (viewer && !viewer.isDestroyed()) clearContourGlobeShader(viewer.scene.globe)
  }

  /** 同步等高线 Shader 图层到 Globe（仅在有有效图层时应用，避免绘制完成瞬间误清空） */
  syncContourGlobeShader(): void {
    const viewer = this.getViewer()
    if (!viewer || viewer.isDestroyed()) return
    const arr = this.buckets.get(MeasureType.CONTOUR_ANALYZE_SHADER) ?? []
    let layer = null as ReturnType<ContourShaderAnalyze['getShaderLayer']>
    for (const m of arr) {
      if (m instanceof ContourShaderAnalyze) {
        const l = m.getShaderLayer()
        if (l) layer = l
      }
    }
    if (!layer) {
      clearContourGlobeShader(viewer.scene.globe)
      return
    }
    applyContourGlobeShader(viewer.scene.globe, layer)
  }

  /**
   * 获取某类型的量算实例列表或最新一个。
   * @param latestOnly true 时仅返回最后一个
   */
  getMeasures(type: MeasureTypeKey, latestOnly = false): IMeasure | IMeasure[] {
    const arr = this.buckets.get(type) ?? []
    if (latestOnly && arr.length > 0) return arr[arr.length - 1]!
    return [...arr]
  }

  /** 开始交互测量（需已 bindViewer） */
  startInteractive(type: MeasureTypeKey): void {
    this.setMeasureType(type)
    this.tool.activate(type)
  }

  /** 停止交互测量（保留已绘制结果） */
  stopInteractive(): void {
    this.tool.deactivate(false)
  }

  /** 注册绘制结束回调（右键/双击结束或定点量算完成） */
  onDrawFinish(listener: (() => void) | null): void {
    this.drawFinishListener = listener
  }

  /** 由 MeasureTool 调用：结束本次交互并通知 UI */
  notifyDrawFinish(): void {
    this.tool.finishSession()
    this.drawFinishListener?.()
  }
}

export { MeasureType, MEASURE_POINT_RANGE } from './types'
export type {
  MeasureTypeKey,
  MeasureCreateOptions,
  MeasureStyle,
  BufferAnalyzeOptions,
  IMeasure,
  LngLatHeightTuple,
} from './types'
export { MeasureTool } from './MeasureTool'
export * from './measureMath'
export * from './components'
