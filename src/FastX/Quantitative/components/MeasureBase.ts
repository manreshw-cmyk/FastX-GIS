import * as Cesium from 'cesium'
import type { Entity, Viewer } from 'cesium'
import { createRandomXgxId } from '../../Coordinates'
import { buildLabelFont, mergeMeasureStyle } from '../measureStyleDefaults'
import type {
  IMeasure,
  LngLatHeightTuple,
  MeasureCreateOptions,
  MeasureStyle,
  MeasureTypeKey,
} from '../types'
import { formatAreaSqMeters, formatDistanceMeters, toCartesian } from '../measureMath'

export { mergeMeasureStyle } from '../measureStyleDefaults'

/** 量算实体 id 前缀，便于统一清理 */
const ENTITY_PREFIX = 'fastx-measure-'

/** 动态折线绘制选项 */
export interface DynamicLineOptions {
  clamp?: boolean
  color?: string
  width?: number
  dashed?: boolean
}

/**
 * 生成距离类标注文字。
 * @param label 标签名
 * @param meters 距离（米）
 */
export function createMeasureLabelText(label: string, meters: number): string {
  return `${label}：${formatDistanceMeters(meters)}`
}

/**
 * 生成面积类标注文字。
 * @param label 标签名
 * @param sqMeters 面积（m²）
 */
export function createMeasureAreaLabelText(label: string, sqMeters: number): string {
  return `${label}：${formatAreaSqMeters(sqMeters)}`
}

/**
 * 量算分析基类：增量 Entity、CallbackProperty 防闪烁、可外部配置样式。
 */
export abstract class MeasureBase implements IMeasure {
  readonly id: string
  readonly type: MeasureTypeKey
  protected readonly viewer: Viewer
  protected style: Required<MeasureStyle>
  protected readonly clampToGround: boolean
  protected entities: Entity[] = []
  positions: LngLatHeightTuple[] = []

  protected keyPointEntities: Entity[] = []
  protected lineEntity: Entity | null = null
  protected polygonEntity: Entity | null = null
  protected labelEntity: Entity | null = null
  protected readonly segmentEntities: Entity[] = []
  protected readonly labelEntities = new Map<string, Entity>()

  private linePositionsBuf: LngLatHeightTuple[] = []
  private polygonHierarchyBuf: LngLatHeightTuple[] = []
  private dynamicLineOpts: DynamicLineOptions = {}

  /**
   * @param options 创建选项
   */
  constructor(options: MeasureCreateOptions) {
    this.viewer = options.viewer
    this.type = options.type
    this.id = options.id?.trim() || createRandomXgxId('ms')
    this.style = mergeMeasureStyle(options.style)
    this.clampToGround = options.clampToGround ?? true
    if (options.positions?.length) this.setPositions(options.positions)
    if (options.position) this.setPosition(options.position)
  }

  /** 获取当前样式副本 */
  getStyle(): MeasureStyle {
    return { ...this.style }
  }

  /**
   * 合并并应用部分样式。
   * @param partial 待覆盖的样式字段
   */
  setStyle(partial: Partial<MeasureStyle>): void {
    this.style = mergeMeasureStyle({ ...this.style, ...partial })
    this.applyStyleToEntities()
  }

  /** 将当前样式同步到已创建的 Entity */
  protected applyStyleToEntities(): void {
    for (const e of this.keyPointEntities) {
      if (e.point) {
        e.point.pixelSize = new Cesium.ConstantProperty(this.style.pointSize)
        e.point.color = new Cesium.ConstantProperty(this.pointColor())
        e.point.outlineColor = new Cesium.ConstantProperty(this.pointOutlineColor())
        e.point.outlineWidth = new Cesium.ConstantProperty(1)
      }
    }
    if (this.lineEntity?.polyline) {
      this.lineEntity.polyline.width = new Cesium.ConstantProperty(this.style.lineWidth)
      this.lineEntity.polyline.material = this.createLineMaterial(this.dynamicLineOpts)
    }
    const font = buildLabelFont(this.style)
    const fill = Cesium.Color.fromCssColorString(this.style.labelColor)
    for (const e of [this.labelEntity, ...this.labelEntities.values()]) {
      if (!e?.label) continue
      e.label.font = new Cesium.ConstantProperty(font)
      e.label.fillColor = new Cesium.ConstantProperty(fill)
    }
  }

  /** 设置顶点并刷新几何（子类实现） */
  abstract setPositions(positions: LngLatHeightTuple[]): void

  /**
   * 设置单点位置（等价于单顶点 setPositions）。
   * @param position 点坐标
   */
  setPosition(position: LngLatHeightTuple): void {
    this.setPositions([position])
  }

  /**
   * 鼠标移动预览（子类可覆盖）。
   * @param _cursor 光标位置
   */
  update(_cursor: LngLatHeightTuple): void {}

  /** 绘制完成回调（子类可覆盖） */
  complete(): void {}

  /** 移除所有 Entity，保留实例 */
  clear(): void {
    for (const e of this.entities) {
      if (!this.viewer.isDestroyed()) this.viewer.entities.remove(e)
    }
    this.entities = []
    this.keyPointEntities = []
    this.lineEntity = null
    this.polygonEntity = null
    this.labelEntity = null
    this.segmentEntities.length = 0
    this.labelEntities.clear()
    this.linePositionsBuf = []
    this.polygonHierarchyBuf = []
  }

  /** 清除并销毁实例 */
  destroy(): void {
    this.clear()
  }

  /**
   * 登记 Entity 到实例列表。
   * @param entity 待跟踪 Entity
   */
  protected track(entity: Entity): Entity {
    this.entities.push(entity)
    return entity
  }

  /** 关键点填充色（含透明度） */
  protected pointColor(): Cesium.Color {
    return Cesium.Color.fromCssColorString(this.style.pointColor).withAlpha(this.style.pointAlpha)
  }

  /** 关键点描边色 */
  protected pointOutlineColor(): Cesium.Color {
    return Cesium.Color.fromCssColorString(this.style.pointColor).withAlpha(this.style.pointAlpha)
  }

  /**
   * 创建折线材质。
   * @param opts 动态线选项
   */
  protected createLineMaterial(opts: DynamicLineOptions = {}): Cesium.MaterialProperty {
    const color = Cesium.Color.fromCssColorString(opts.color ?? this.style.lineColor)
    if (opts.dashed ?? this.style.lineDashed) {
      return new Cesium.PolylineDashMaterialProperty({ color })
    }
    return new Cesium.ColorMaterialProperty(color)
  }

  /**
   * 绘制关键点。
   * @param position 点坐标
   */
  protected drawKeyPoint(position: LngLatHeightTuple): Entity | null {
    if (!this.style.showKeyPoint) return null
    return this.track(
      this.viewer.entities.add({
        id: `${ENTITY_PREFIX}pt-${this.id}-${this.entities.length}`,
        position: toCartesian(position),
        point: {
          pixelSize: this.style.pointSize,
          color: this.pointColor(),
          outlineColor: this.pointOutlineColor(),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: this.clampToGround
            ? Cesium.HeightReference.CLAMP_TO_GROUND
            : Cesium.HeightReference.NONE,
        },
      }),
    )
  }

  /**
   * 绘制文本标注。
   * @param position 标注位置
   * @param text 文本
   * @param offset 像素偏移
   * @param key 可选键，便于后续更新
   */
  protected drawLabel(
    position: LngLatHeightTuple,
    text: string,
    offset: [number, number] = [10, -20],
    key?: string,
  ): Entity {
    const entity = this.viewer.entities.add({
      id: `${ENTITY_PREFIX}lb-${this.id}-${key ?? this.entities.length}`,
      position: toCartesian(position),
      label: {
        text,
        font: buildLabelFont(this.style),
        fillColor: Cesium.Color.fromCssColorString(this.style.labelColor),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(offset[0], offset[1]),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: this.clampToGround
          ? Cesium.HeightReference.CLAMP_TO_GROUND
          : Cesium.HeightReference.NONE,
      },
    })
    this.track(entity)
    if (key) this.labelEntities.set(key, entity)
    return entity
  }

  /**
   * 按键更新或创建标注。
   * @param key 标注键
   * @param position 位置
   * @param text 文本
   * @param offset 像素偏移
   */
  protected updateLabelByKey(
    key: string,
    position: LngLatHeightTuple,
    text: string,
    offset: [number, number] = [10, -20],
  ): void {
    const cart = toCartesian(position)
    const existing = this.labelEntities.get(key)
    if (existing) {
      existing.position = new Cesium.ConstantPositionProperty(cart)
      if (existing.label) {
        existing.label.text = new Cesium.ConstantProperty(text)
        existing.label.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(offset[0], offset[1]))
      }
      return
    }
    this.drawLabel(position, text, offset, key)
  }

  /**
   * 绘制静态折线。
   * @param positions 顶点
   * @param color 颜色
   * @param width 线宽
   * @param clamp 是否贴地
   * @param dashed 是否虚线
   */
  protected drawPolyline(
    positions: LngLatHeightTuple[],
    color = this.style.lineColor,
    width = this.style.lineWidth,
    clamp = this.clampToGround,
    dashed = this.style.lineDashed,
  ): Entity {
    return this.track(
      this.viewer.entities.add({
        id: `${ENTITY_PREFIX}ln-${this.id}-${this.entities.length}`,
        polyline: {
          positions: positions.map(toCartesian),
          width,
          material: dashed
            ? new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.fromCssColorString(color) })
            : Cesium.Color.fromCssColorString(color),
          clampToGround: clamp,
        },
      }),
    )
  }

  /**
   * 绘制分段折线（纳入 segmentEntities 便于批量清理）。
   * @param positions 顶点
   * @param color 颜色
   * @param width 线宽
   * @param clamp 是否贴地
   * @param dashed 是否虚线
   */
  protected drawSegmentPolyline(
    positions: LngLatHeightTuple[],
    color: string,
    width = this.style.lineWidth,
    clamp = this.clampToGround,
    dashed = false,
  ): Entity {
    const e = this.drawPolyline(positions, color, width, clamp, dashed)
    this.segmentEntities.push(e)
    return e
  }

  /** 清除所有分段折线 Entity */
  protected clearSegmentEntities(): void {
    for (const e of this.segmentEntities) {
      if (!this.viewer.isDestroyed()) this.viewer.entities.remove(e)
      this.entities = this.entities.filter((x) => x !== e)
    }
    this.segmentEntities.length = 0
  }

  /**
   * 绘制静态多边形。
   * @param positions 顶点
   * @param fillColor 填充色
   * @param alpha 填充透明度
   * @param outlineColor 轮廓色
   */
  protected drawPolygon(
    positions: LngLatHeightTuple[],
    fillColor = this.style.fillColor,
    alpha = this.style.fillAlpha,
    outlineColor = this.style.lineColor,
  ): Entity {
    return this.track(
      this.viewer.entities.add({
        id: `${ENTITY_PREFIX}pg-${this.id}-${this.entities.length}`,
        polygon: {
          hierarchy: positions.map(toCartesian),
          material: Cesium.Color.fromCssColorString(fillColor).withAlpha(alpha),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(outlineColor),
          perPositionHeight: !this.clampToGround,
        },
      }),
    )
  }

  /**
   * 两点中点。
   * @param a 点 A
   * @param b 点 B
   */
  protected midpoint(a: LngLatHeightTuple, b: LngLatHeightTuple): LngLatHeightTuple {
    const m = Cesium.Cartesian3.midpoint(toCartesian(a), toCartesian(b), new Cesium.Cartesian3())
    const c = Cesium.Cartographic.fromCartesian(m)
    return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), c.height]
  }

  /** 当前相机高度（米） */
  protected getCameraHeight(): number {
    return this.viewer.camera.positionCartographic.height
  }

  /**
   * 增量同步关键点 Entity 数量与位置。
   * @param anchors 锚点列表
   */
  protected syncKeyPoints(anchors: LngLatHeightTuple[]): void {
    while (this.keyPointEntities.length > anchors.length) {
      const extra = this.keyPointEntities.pop()!
      if (!this.viewer.isDestroyed()) this.viewer.entities.remove(extra)
      this.entities = this.entities.filter((e) => e !== extra)
    }
    for (let i = 0; i < anchors.length; i++) {
      const cart = toCartesian(anchors[i]!)
      const existing = this.keyPointEntities[i]
      if (existing) {
        existing.position = new Cesium.ConstantPositionProperty(cart)
        continue
      }
      const entity = this.drawKeyPoint(anchors[i]!)
      if (entity) this.keyPointEntities.push(entity)
    }
  }

  /** 清除动态折线 Entity */
  protected clearDynamicLine(): void {
    if (!this.lineEntity) return
    if (!this.viewer.isDestroyed()) this.viewer.entities.remove(this.lineEntity)
    this.entities = this.entities.filter((e) => e !== this.lineEntity)
    this.lineEntity = null
    this.linePositionsBuf = []
  }

  /** 清除动态多边形 Entity */
  protected clearDynamicPolygon(): void {
    if (!this.polygonEntity) return
    if (!this.viewer.isDestroyed()) this.viewer.entities.remove(this.polygonEntity)
    this.entities = this.entities.filter((e) => e !== this.polygonEntity)
    this.polygonEntity = null
    this.polygonHierarchyBuf = []
  }

  /**
   * 更新或创建 CallbackProperty 动态折线（防闪烁）。
   * @param positions 顶点
   * @param opts 线样式选项
   */
  protected setDynamicLinePositions(positions: LngLatHeightTuple[], opts: DynamicLineOptions = {}): void {
    if (positions.length < 2) {
      this.clearDynamicLine()
      return
    }
    this.clearDynamicPolygon()
    this.linePositionsBuf = positions
    this.dynamicLineOpts = opts
    const clamp = opts.clamp ?? this.clampToGround
    const width = opts.width ?? this.style.lineWidth
    if (!this.lineEntity) {
      this.lineEntity = this.viewer.entities.add({
        id: `${ENTITY_PREFIX}ln-${this.id}`,
        polyline: {
          positions: new Cesium.CallbackProperty(() => this.linePositionsBuf.map(toCartesian), false),
          width,
          material: this.createLineMaterial(opts),
          clampToGround: clamp,
        },
      })
      this.track(this.lineEntity)
    } else {
      if (this.lineEntity.polyline) {
        this.lineEntity.polyline.width = new Cesium.ConstantProperty(width)
        this.lineEntity.polyline.material = this.createLineMaterial(opts)
      }
    }
    this.requestRender()
  }

  /**
   * 更新或创建 CallbackProperty 动态多边形。
   * @param positions 顶点
   * @param clamp 是否贴地
   * @param fillColor 填充色
   * @param alpha 填充透明度
   * @param outlineColor 轮廓色
   */
  protected setDynamicPolygon(
    positions: LngLatHeightTuple[],
    clamp = this.clampToGround,
    fillColor = this.style.fillColor,
    alpha = this.style.fillAlpha,
    outlineColor = this.style.lineColor,
  ): void {
    if (positions.length < 3) {
      this.clearDynamicPolygon()
      return
    }
    this.clearDynamicLine()
    this.polygonHierarchyBuf = positions
    if (!this.polygonEntity) {
      this.polygonEntity = this.viewer.entities.add({
        id: `${ENTITY_PREFIX}pg-${this.id}`,
        polygon: {
          hierarchy: new Cesium.CallbackProperty(
            () => new Cesium.PolygonHierarchy(this.polygonHierarchyBuf.map(toCartesian)),
            false,
          ),
          material: Cesium.Color.fromCssColorString(fillColor).withAlpha(alpha),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(outlineColor),
          perPositionHeight: !clamp,
        },
      })
      this.track(this.polygonEntity)
    }
    this.requestRender()
  }

  /** 清除主测量标注 Entity */
  protected clearMeasureLabel(): void {
    if (!this.labelEntity) return
    if (!this.viewer.isDestroyed()) this.viewer.entities.remove(this.labelEntity)
    this.entities = this.entities.filter((e) => e !== this.labelEntity)
    this.labelEntity = null
  }

  /**
   * 更新或创建主测量标注。
   * @param position 位置
   * @param text 文本
   */
  protected updateMeasureLabel(position: LngLatHeightTuple, text: string): void {
    const cart = toCartesian(position)
    if (this.labelEntity) {
      this.labelEntity.position = new Cesium.ConstantPositionProperty(cart)
      if (this.labelEntity.label) this.labelEntity.label.text = new Cesium.ConstantProperty(text)
      return
    }
    this.labelEntity = this.drawLabel(position, text)
  }

  /** 请求场景重绘（仅在 requestRenderMode 下生效） */
  protected requestRender(): void {
    if (this.viewer.scene.requestRenderMode) this.viewer.scene.requestRender()
  }
}
