import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import { buildHeatmapJsRuntime, type HeatmapJsRuntime } from './heatmapJs'
import { estimateHeightScale, normalizeBounds, resolveHeatGrid } from './heatmapShared'
import type { HeatmapBounds, HeatmapDimension, HeatmapGrid, HeatmapRenderType, HeatmapStyle } from '../types'

/** 创建图元所需参数 */
export interface Heatmap23DBuildParams {
  viewer: Viewer
  dimension: HeatmapDimension
  renderType: HeatmapRenderType
  bounds: HeatmapBounds
  gridCols: number
  gridRows: number
  style: HeatmapStyle
  grid?: HeatmapGrid
  show: boolean
  seed: number
}

/** 已挂载的热力图图元 */
export interface Heatmap23DInstance {
  dimension: HeatmapDimension
  renderType: HeatmapRenderType
  primitive?: Cesium.Primitive
  disposeRuntime?: () => void
}

/** 几何网格分辨率（与 heatmap 纹理一致） */
const MESH_RESOLUTION = 200

type VertexIndex = (col: number, row: number) => number

/** 构建三角面索引（surface） */
function appendSurfaceIndices(indices: number[], res: number, at: VertexIndex): void {
  for (let i = 0; i < res - 1; i++) {
    for (let j = 0; j < res - 1; j++) {
      const i0 = at(i, j)
      const i1 = at(i + 1, j)
      const i2 = at(i + 1, j + 1)
      const i3 = at(i, j + 1)
      indices.push(i0, i1, i2, i0, i2, i3)
    }
  }
}

/** 构建线框索引（mesh） */
function appendMeshIndices(indices: number[], res: number, at: VertexIndex): void {
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      if (i < res - 1) indices.push(at(i, j), at(i + 1, j))
      if (j < res - 1) indices.push(at(i, j), at(i, j + 1))
    }
  }
}

/**
 * 构建 Cesium 几何：position + st，二维高度为 0，三维按强度抬升
 */
function buildHeatmapGeometry(
  bounds: HeatmapBounds,
  runtime: HeatmapJsRuntime,
  renderType: HeatmapRenderType,
  dimension: HeatmapDimension,
): Cesium.Geometry {
  const box = normalizeBounds(bounds)
  const res = runtime.size
  const heightScale = dimension === '3d' ? estimateHeightScale(bounds) : 0
  const positions: number[] = []
  const st: number[] = []
  const indices: number[] = []
  const stepLng = (box.east - box.west) / res
  const stepLat = (box.north - box.south) / res

  for (let j = 0; j < res; j++) {
    const lat = box.south + stepLat * j
    for (let i = 0; i < res; i++) {
      const lon = box.west + stepLng * i
      const u = i / (res - 1 || 1)
      const v = j / (res - 1 || 1)
      const alt = runtime.sampleIntensity(u, v) * heightScale
      const cart = Cesium.Cartesian3.fromDegrees(lon, lat, alt)
      positions.push(cart.x, cart.y, cart.z)
      st.push(u, v)
    }
  }

  const at: VertexIndex = (col, row) => row * res + col
  if (renderType === 'mesh') appendMeshIndices(indices, res, at)
  else appendSurfaceIndices(indices, res, at)

  return new Cesium.Geometry({
    attributes: {
      position: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: new Float64Array(positions),
      }),
      st: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: new Float32Array(st),
      }),
    } as Cesium.GeometryAttributes,
    indices: new Uint32Array(indices),
    primitiveType: renderType === 'mesh' ? Cesium.PrimitiveType.LINES : Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(new Float64Array(positions)),
  })
}

/** heatmap 纹理材质 */
function createHeatmapMaterial(canvas: HTMLCanvasElement): Cesium.Material {
  return new Cesium.Material({
    fabric: { type: 'Image', uniforms: { image: canvas } },
    translucent: true,
  })
}

/**
 * 创建并挂载 2D/3D 热力图 Primitive
 * 二维与三维共用同一渲染管线，仅 heightScale 不同
 */
export function createHeatmap23D(params: Heatmap23DBuildParams): Heatmap23DInstance {
  const { viewer, dimension, renderType, bounds, gridCols, gridRows, style, grid, show, seed } = params
  const data = resolveHeatGrid(grid, gridCols, gridRows, seed)
  const runtime = buildHeatmapJsRuntime(data, style, MESH_RESOLUTION, seed)

  const inst: Heatmap23DInstance = {
    dimension,
    renderType,
    disposeRuntime: runtime.dispose,
  }

  inst.primitive = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: buildHeatmapGeometry(bounds, runtime, renderType, dimension),
      }),
      appearance: new Cesium.MaterialAppearance({
        material: createHeatmapMaterial(runtime.canvas),
        translucent: true,
        flat: true,
      }),
      asynchronous: false,
      show,
    }),
  )

  return inst
}

/** 从场景移除图元并释放 heatmap.js 容器 */
export function destroyHeatmap23D(viewer: Viewer, inst: Heatmap23DInstance): void {
  if (inst.primitive) {
    viewer.scene.primitives.remove(inst.primitive)
    inst.primitive = undefined
  }
  inst.disposeRuntime?.()
  inst.disposeRuntime = undefined
}

/** 切换显隐 */
export function updateHeatmap23DShow(inst: Heatmap23DInstance, show: boolean): void {
  if (inst.primitive) inst.primitive.show = show
}
