/**
 * 视域分析：扇形张角内楔形网格贴地填充（红/绿 GroundPrimitive）+ 视锥线框 + 扇形椭球示意。
 */
import * as Cesium from 'cesium'
import type { Entity, Primitive } from 'cesium'
import type { LngLatHeightTuple, MeasureCreateOptions, MeasureStyle, ViewShedOptions } from '../types'
import {
  geodesicDestination,
  getViewShedFillCells,
  isViewShedCellVisible,
  type ViewShedFillCell,
  toCartesian,
} from '../measureMath'
import { MeasureBase } from './MeasureBase'

/** 单批 GroundPrimitive 最大几何实例数 */
const FILL_INSTANCE_CHUNK = 400
/** 单元格通视判定并发批次大小 */
const VISIBILITY_BATCH = 24

/** 视域参数默认值 */
const DEFAULT_VIEW_SHED: Required<
  Pick<
    ViewShedOptions,
    | 'horizontalViewAngle'
    | 'verticalViewAngle'
    | 'defaultViewDistance'
    | 'rayStepDegrees'
    | 'previewRayStepDegrees'
    | 'verticalRayStepDegrees'
    | 'previewVerticalRayStepDegrees'
    | 'sampleCount'
    | 'previewSampleCount'
    | 'radialRingCount'
    | 'previewRadialRingCount'
    | 'fillAlpha'
    | 'frustumOutlineColor'
    | 'sketchOutlineColor'
    | 'showSketchOutline'
    | 'showFrustumOutline'
  >
> = {
  horizontalViewAngle: 90,
  verticalViewAngle: 60,
  defaultViewDistance: 100,
  rayStepDegrees: 8,
  previewRayStepDegrees: 8,
  verticalRayStepDegrees: 8,
  previewVerticalRayStepDegrees: 8,
  sampleCount: 28,
  previewSampleCount: 16,
  radialRingCount: 8,
  previewRadialRingCount: 10,
  fillAlpha: 0.88,
  frustumOutlineColor: '#9acd32',
  sketchOutlineColor: '#00e5ff',
  showSketchOutline: true,
  showFrustumOutline: true,
}

/** 当前绘制阶段使用的网格与采样参数 */
interface ViewShedGridParams {
  hStep: number
  vStep: number
  sampleCount: number
  radialRings: number
}

/**
 * 视域分析：观测点 + 目标方向点；单元格通视与 {@link LineAnalyze} 同源，仅本类做扇形面填充。
 */
export class ViewShedAnalyze extends MeasureBase {
  /** 视域算法与显示参数（可由 setViewShedOptions 覆盖） */
  private readonly vs: typeof DEFAULT_VIEW_SHED
  /** 观测点笛卡尔坐标 */
  private viewPosition: Cesium.Cartesian3 | null = null
  /** 目标方向点笛卡尔坐标 */
  private viewPositionEnd: Cesium.Cartesian3 | null = null
  /** 观测点到目标点距离（米） */
  private viewDistance = DEFAULT_VIEW_SHED.defaultViewDistance
  /** 观测航向（度，ENU 北为 0） */
  private viewHeading = 0
  /** 观测俯仰（度） */
  private viewPitch = 0
  /** 预览刷新代数，用于丢弃过期的异步通视结果 */
  private previewGen = 0
  /** 是否已完成第二点绘制（完成后使用更密网格） */
  private drawingComplete = false
  /** 视锥/椭球外壳是否已创建 */
  private shellBuilt = false
  /** 虚拟相机，仅用于视锥线框几何 */
  private lightCamera: Cesium.Camera | null = null
  /** 视锥线框 Primitive */
  private frustumOutline: Primitive | null = null
  /** 扇形椭球示意 Entity */
  private sketch: Entity | null = null
  /** 贴地填充 Primitive 列表（可视、不可视各若干批） */
  private readonly fillPrimitives: Cesium.GroundPrimitive[] = []
  /** 视锥线框朝向：右轴缓冲 */
  private readonly scratchRight = new Cesium.Cartesian3()
  /** 视锥线框朝向：旋转矩阵缓冲 */
  private readonly scratchRotation = new Cesium.Matrix3()
  /** 视锥线框朝向：四元数缓冲 */
  private readonly scratchOrientation = new Cesium.Quaternion()
  /** ENU 方向向量缓冲（航向/俯仰计算） */
  private readonly scratchEnu = new Cesium.Cartesian3()

  constructor(options: MeasureCreateOptions) {
    const mergedVs = { ...DEFAULT_VIEW_SHED, ...options.viewShed }
    const initPositions = options.positions
    super({ ...options, positions: undefined, position: undefined })
    this.vs = mergedVs
    if (initPositions?.length) this.setPositions(initPositions)
    else if (options.position) this.setPosition(options.position)
  }

  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = positions.slice(0, 2)
    this.syncKeyPoints(this.positions)
    if (this.positions.length < 1) {
      this.teardownShell()
      this.clearSegmentEntities()
      return
    }
    this.viewPosition = toCartesian(this.positions[0]!)
    if (this.positions.length >= 2) {
      this.drawingComplete = false
      this.viewPositionEnd = toCartesian(this.positions[1]!)
      this.updateViewVectors()
      void this.refreshViewShed()
      this.updateDistanceLabel(this.positions[1]!)
    } else {
      this.drawingComplete = false
      this.beginPreviewFromObservation()
    }
  }

  /** 鼠标移动：更新方向、视距与扇形内填充 */
  update(cursor: LngLatHeightTuple): void {
    if (!this.viewPosition || this.positions.length < 1 || this.drawingComplete) return
    this.viewPositionEnd = toCartesian(cursor)
    this.updateViewVectors()
    this.updateDistanceLabel(cursor)
    void this.refreshViewShed(++this.previewGen)
  }

  complete(): void {
    if (this.positions.length < 2 || !this.viewPosition) return
    this.viewPositionEnd = toCartesian(this.positions[1]!)
    this.updateViewVectors()
    this.drawingComplete = true
    void this.refreshViewShed()
    this.updateDistanceLabel(this.positions[1]!)
  }

  setStyle(partial: Partial<MeasureStyle>): void {
    super.setStyle(partial)
    if (this.shellBuilt) void this.refreshViewShed()
  }

  /** 运行时修改视域张角、网格步长、示意线样式等 */
  setViewShedOptions(partial: Partial<ViewShedOptions>): void {
    Object.assign(this.vs, partial)
    if (this.viewPosition && this.viewPositionEnd) void this.refreshViewShed()
  }

  clear(): void {
    this.teardownShell()
    this.clearSegmentEntities()
    super.clear()
  }

  protected clearSegmentEntities(): void {
    this.clearFillPrimitives()
    super.clearSegmentEntities()
  }

  /** 移除所有贴地填充 Primitive */
  private clearFillPrimitives(): void {
    if (this.viewer.isDestroyed()) {
      this.fillPrimitives.length = 0
      return
    }
    const ground = this.viewer.scene.groundPrimitives
    for (const p of this.fillPrimitives) ground.remove(p)
    this.fillPrimitives.length = 0
  }

  /** 由观测点与目标点更新视距、航向、俯仰 */
  private updateViewVectors(): void {
    if (!this.viewPosition || !this.viewPositionEnd) return
    let dist = Cesium.Cartesian3.distance(this.viewPosition, this.viewPositionEnd)
    if (dist < 1) dist = 1
    this.viewDistance = dist
    const dir = this.enuDirection(this.viewPosition, this.viewPositionEnd)
    this.viewHeading = Cesium.Math.toDegrees(Math.atan2(dir.x, dir.y))
    this.viewPitch = Cesium.Math.toDegrees(Math.asin(dir.z))
  }

  /** 在目标点显示当前视距 */
  private updateDistanceLabel(target: LngLatHeightTuple): void {
    this.updateMeasureLabel(target, `视距 ${this.viewDistance.toFixed(0)} m`)
  }

  /** 仅第一点：按默认视距、正北方向启动预览 */
  private beginPreviewFromObservation(): void {
    if (!this.viewPosition || this.positions.length < 1) return
    const eye = this.positions[0]!
    this.viewPositionEnd = toCartesian(geodesicDestination(eye, this.vs.defaultViewDistance, 0))
    this.updateViewVectors()
    void this.refreshViewShed()
  }

  /** 取当前阶段的网格步长与通视采样配置 */
  private gridParams(): ViewShedGridParams {
    const preview = !this.drawingComplete
    return {
      hStep: preview ? this.vs.previewRayStepDegrees : this.vs.rayStepDegrees,
      vStep: preview ? this.vs.previewVerticalRayStepDegrees : this.vs.verticalRayStepDegrees,
      sampleCount: preview ? this.vs.previewSampleCount : this.vs.sampleCount,
      radialRings: preview ? this.vs.previewRadialRingCount : this.vs.radialRingCount,
    }
  }

  /** 预览异步是否已过期 */
  private isStalePreview(gen?: number): boolean {
    return gen !== undefined && gen !== this.previewGen
  }

  /**
   * 刷新视锥/椭球外壳与扇形贴地填充。
   * @param gen 预览代数；传入时若与当前不一致则放弃绘制
   */
  private async refreshViewShed(gen?: number): Promise<void> {
    if (!this.viewPosition || !this.viewPositionEnd || !this.positions[0]) return
    const eye = this.positions[0]
    const grid = this.gridParams()

    this.ensureVisualShell()
    this.clearSegmentEntities()

    const cells = getViewShedFillCells(
      this.vs.horizontalViewAngle,
      this.vs.verticalViewAngle,
      grid.hStep,
      grid.vStep,
      eye,
      this.viewDistance,
      this.viewHeading,
      this.viewPitch,
      grid.radialRings,
    )
    const flags = await this.computeCellVisibility(eye, cells, grid.sampleCount, gen)
    if (!flags || this.isStalePreview(gen)) return

    const visibleInst: Cesium.GeometryInstance[] = []
    const invisibleInst: Cesium.GeometryInstance[] = []
    for (let i = 0; i < cells.length; i++) {
      const inst = this.cellGeometryInstance(cells[i]!.corners, i)
      if (flags[i]) visibleInst.push(inst)
      else invisibleInst.push(inst)
    }

    const alpha = this.vs.fillAlpha
    this.addFillBatch(
      visibleInst,
      Cesium.Color.fromCssColorString(this.style.visibleLineColor).withAlpha(alpha),
    )
    this.addFillBatch(
      invisibleInst,
      Cesium.Color.fromCssColorString(this.style.invisibleLineColor).withAlpha(alpha),
    )
    this.requestRender()
  }

  /** 批量判定各单元格中心是否通视 */
  private async computeCellVisibility(
    eye: LngLatHeightTuple,
    cells: ViewShedFillCell[],
    sampleCount: number,
    gen?: number,
  ): Promise<boolean[] | null> {
    const flags = new Array<boolean>(cells.length)
    for (let i = 0; i < cells.length; i += VISIBILITY_BATCH) {
      if (this.isStalePreview(gen)) return null
      const chunk = cells.slice(i, i + VISIBILITY_BATCH)
      const chunkFlags = await Promise.all(
        chunk.map((c) => isViewShedCellVisible(this.viewer, eye, c.center, sampleCount)),
      )
      if (this.isStalePreview(gen)) return null
      for (let j = 0; j < chunkFlags.length; j++) flags[i + j] = chunkFlags[j]!
    }
    return flags
  }

  /** 单元格四角 → 贴地 PolygonGeometry 实例 */
  private cellGeometryInstance(
    corners: ViewShedFillCell['corners'],
    index: number,
  ): Cesium.GeometryInstance {
    return new Cesium.GeometryInstance({
      geometry: Cesium.PolygonGeometry.fromPositions({
        positions: corners.map(toCartesian),
        vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
      }),
      id: `fastx-viewshed-${this.id}-${index}`,
    })
  }

  /** 按颜色将几何实例分批加入 groundPrimitives */
  private addFillBatch(instances: Cesium.GeometryInstance[], color: Cesium.Color): void {
    if (instances.length < 1) return
    const appearance = new Cesium.MaterialAppearance({
      material: Cesium.Material.fromType('Color', { color }),
    })
    const ground = this.viewer.scene.groundPrimitives
    for (let i = 0; i < instances.length; i += FILL_INSTANCE_CHUNK) {
      const primitive = new Cesium.GroundPrimitive({
        geometryInstances: instances.slice(i, i + FILL_INSTANCE_CHUNK),
        appearance,
        asynchronous: false,
      })
      ground.add(primitive)
      this.fillPrimitives.push(primitive)
    }
  }

  /** 更新视锥线框与扇形椭球（椭球仅首次创建） */
  private ensureVisualShell(): void {
    this.updateLightCamera()
    if (this.vs.showFrustumOutline) {
      this.removeFrustumOutline()
      this.drawFrustumOutline()
    } else {
      this.removeFrustumOutline()
    }
    if (!this.shellBuilt) {
      this.drawSketchEllipsoid()
      this.shellBuilt = true
    }
    this.applySketchStyle()
  }

  /** 移除视锥线框与椭球示意 */
  private teardownShell(): void {
    if (!this.viewer.isDestroyed()) {
      this.removeFrustumOutline()
      if (this.sketch) {
        this.viewer.entities.remove(this.sketch)
        const idx = this.entities.indexOf(this.sketch)
        if (idx >= 0) this.entities.splice(idx, 1)
        this.sketch = null
      }
    }
    this.lightCamera = null
    this.shellBuilt = false
    this.drawingComplete = false
  }

  /** 同步虚拟相机位姿与视锥参数 */
  private updateLightCamera(): void {
    if (!this.lightCamera) this.lightCamera = new Cesium.Camera(this.viewer.scene)
    const cam = this.lightCamera
    Cesium.Cartesian3.clone(this.viewPosition!, cam.position)
    const frustum = cam.frustum as Cesium.PerspectiveFrustum
    frustum.near = this.viewDistance * 0.001
    frustum.far = this.viewDistance
    const hr = Cesium.Math.toRadians(this.vs.horizontalViewAngle)
    const vr = Cesium.Math.toRadians(this.vs.verticalViewAngle)
    frustum.aspectRatio =
      (this.viewDistance * Math.tan(hr / 2) * 2) / (this.viewDistance * Math.tan(vr / 2) * 2)
    frustum.fov = hr > vr ? hr : vr
    cam.setView({
      destination: this.viewPosition!,
      orientation: {
        heading: Cesium.Math.toRadians(this.viewHeading),
        pitch: Cesium.Math.toRadians(this.viewPitch),
        roll: 0,
      },
    })
  }

  /** 从场景移除视锥线框 */
  private removeFrustumOutline(): void {
    if (this.frustumOutline && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.frustumOutline)
    }
    this.frustumOutline = null
  }

  /** 绘制视锥金字塔线框 */
  private drawFrustumOutline(): void {
    if (!this.vs.showFrustumOutline || !this.lightCamera || !this.viewPosition) return
    const cam = this.lightCamera
    const right = Cesium.Cartesian3.negate(cam.rightWC, this.scratchRight)
    const rot = this.scratchRotation
    Cesium.Matrix3.setColumn(rot, 0, right, rot)
    Cesium.Matrix3.setColumn(rot, 1, cam.upWC, rot)
    Cesium.Matrix3.setColumn(rot, 2, cam.directionWC, rot)
    const orientation = Cesium.Quaternion.fromRotationMatrix(rot, this.scratchOrientation)
    this.frustumOutline = this.viewer.scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.FrustumOutlineGeometry({
            frustum: cam.frustum as Cesium.PerspectiveFrustum,
            origin: this.viewPosition,
            orientation,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromCssColorString(this.vs.frustumOutlineColor),
            ),
            show: new Cesium.ShowGeometryInstanceAttribute(true),
          },
        }),
        appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: false }),
      }),
    )
  }

  /** 创建扇形椭球示意（CallbackProperty 随视距/朝向更新） */
  private drawSketchEllipsoid(): void {
    if (!this.viewPosition) return
    const pos = this.viewPosition
    const h = this.vs.horizontalViewAngle
    const v = this.vs.verticalViewAngle
    this.sketch = this.track(
      this.viewer.entities.add({
        name: 'fastx-viewshed-sketch',
        position: pos,
        orientation: new Cesium.CallbackProperty(
          () =>
            Cesium.Transforms.headingPitchRollQuaternion(
              pos,
              Cesium.HeadingPitchRoll.fromDegrees(this.viewHeading - 90, this.viewPitch, 0),
            ),
          false,
        ),
        ellipsoid: {
          radii: new Cesium.CallbackProperty(
            () => new Cesium.Cartesian3(this.viewDistance, this.viewDistance, this.viewDistance),
            false,
          ),
          innerRadii: new Cesium.Cartesian3(0.01, 0.01, 0.01),
          minimumClock: Cesium.Math.toRadians(-h / 2),
          maximumClock: Cesium.Math.toRadians(h / 2),
          minimumCone: Cesium.Math.toRadians(v + 7.75),
          maximumCone: Cesium.Math.toRadians(180 - v - 7.75),
          fill: false,
          outline: new Cesium.CallbackProperty(() => this.vs.showSketchOutline, true),
          subdivisions: 128,
          stackPartitions: 32,
          slicePartitions: 32,
          outlineColor: Cesium.Color.fromCssColorString(this.vs.sketchOutlineColor),
        },
      }),
    )
  }

  /** 同步椭球轮廓显隐与颜色（样式变更时） */
  private applySketchStyle(): void {
    if (!this.sketch?.ellipsoid) return
    this.sketch.ellipsoid.outline = new Cesium.ConstantProperty(this.vs.showSketchOutline)
    this.sketch.ellipsoid.outlineColor = new Cesium.ConstantProperty(
      Cesium.Color.fromCssColorString(this.vs.sketchOutlineColor),
    )
  }

  /** 目标点相对观测点的 ENU 单位方向 */
  private enuDirection(from: Cesium.Cartesian3, to: Cesium.Cartesian3): Cesium.Cartesian3 {
    const m = Cesium.Transforms.eastNorthUpToFixedFrame(from, undefined, new Cesium.Matrix4())
    Cesium.Matrix4.inverse(m, m)
    Cesium.Matrix4.multiplyByPoint(m, to, this.scratchEnu)
    return Cesium.Cartesian3.normalize(this.scratchEnu, this.scratchEnu)
  }
}
