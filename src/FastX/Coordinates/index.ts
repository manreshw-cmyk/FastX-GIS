import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'

const scratchCartesian = new Cesium.Cartesian3()
const scratchCartographic = new Cesium.Cartographic()
const scratchCartesian2 = new Cesium.Cartesian2()

/** 椭球面大地高（米）下的经纬度（度）与高度 */
export interface LngLatHeight {
  longitude: number
  latitude: number
  height: number
}

/** 与 Cesium 拾取一致的绘图缓冲像素坐标（相对 canvas 左上角） */
export interface DrawingBufferPoint {
  x: number
  y: number
}

/** 屏幕像素坐标（与 `DrawingBufferPoint` 在多数设备上一致；高 DPI 下请用 `clientXYToDrawingBuffer`） */
export interface ScreenPoint {
  x: number
  y: number
}

export interface DmsAxis {
  degrees: number
  minutes: number
  seconds: number
  /** 经度：E/W；纬度：N/S */
  hemisphere: 'E' | 'W' | 'N' | 'S'
}

export interface LngLatDms {
  longitude: DmsAxis
  latitude: DmsAxis
}

/**
 * 为 Entity / Primitive 等业务生成尽量唯一的 id（优先 `crypto.randomUUID()`）。
 * 无 UUID 时回退为 `xgx_${token}_${Date.now()}_${随机段}`。
 *
 * @param fallbackToken 回退 id 用短标记，如 `pt`、`el`、`ec`（仅字母数字，过长会截断）
 */
export function createRandomXgxId(fallbackToken: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const safe =
    String(fallbackToken ?? 'id')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 16) || 'id'
  return `xgx_${safe}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 根据相机高度估算当前影像层级（与 Layer 内「层级」覆写算法一致，约 0–18）。
 */
export function estimateImageryZoomLevel(viewer: Viewer): number {
  const h = viewer.camera.positionCartographic.height
  return Math.max(0, Math.min(18, Math.round(Math.log2(40075017 / Math.max(h, 1)))))
}

/**
 * 浏览器 `clientX/clientY` → Cesium 绘图缓冲 `Cartesian2`（用于 `getPickRay` / `pickEllipsoid` 等）。
 */
export function clientXYToDrawingBuffer(
  viewer: Viewer,
  clientX: number,
  clientY: number,
  result = scratchCartesian2,
): Cesium.Cartesian2 {
  const canvas = viewer.scene.canvas
  const rect = canvas.getBoundingClientRect()
  const cw = Math.max(canvas.clientWidth, 1)
  const ch = Math.max(canvas.clientHeight, 1)
  const px = clientX - rect.left
  const py = clientY - rect.top
  result.x = (px / cw) * viewer.scene.drawingBufferWidth
  result.y = (py / ch) * viewer.scene.drawingBufferHeight
  return result
}

const scratchPickWindow = new Cesium.Cartesian2()

/**
 * 绘图缓冲坐标 → `Camera#getPickRay` / `pickEllipsoid` / `pickPosition` 使用的画布像素坐标（与 `canvas.clientWidth/Height` 同尺度）。
 * 与 `worldToDrawingBufferCoordinates` 输出配对使用。
 */
export function drawingBufferToPickCartesian2(
  viewer: Viewer,
  drawingBufferX: number,
  drawingBufferY: number,
  result = scratchPickWindow,
): Cesium.Cartesian2 {
  const canvas = viewer.scene.canvas
  const dw = Math.max(viewer.scene.drawingBufferWidth, 1)
  const dh = Math.max(viewer.scene.drawingBufferHeight, 1)
  const cw = Math.max(canvas.clientWidth, 1)
  const ch = Math.max(canvas.clientHeight, 1)
  result.x = (drawingBufferX / dw) * cw
  result.y = (drawingBufferY / dh) * ch
  return result
}

function toCartesian3(
  world: Cesium.Cartesian3 | { x: number; y: number; z: number },
  out = scratchCartesian,
): Cesium.Cartesian3 {
  if (world instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(world, out)
  }
  return Cesium.Cartesian3.fromElements(world.x, world.y, world.z, out)
}

// ——— 文档：世界坐标转换屏幕坐标 ———

/**
 * 世界坐标（ECEF 米）→ 绘图缓冲屏幕坐标；点在视锥外或未投影到时返回 `undefined`。
 */
export function worldCartesian3ToScreenPoint(
  viewer: Viewer,
  world: Cesium.Cartesian3 | { x: number; y: number; z: number },
  result?: Cesium.Cartesian2,
): ScreenPoint | undefined {
  const c = toCartesian3(world)
  const r = result ?? scratchCartesian2
  const out = Cesium.SceneTransforms.worldToDrawingBufferCoordinates(viewer.scene, c, r)
  if (!out) return undefined
  return { x: out.x, y: out.y }
}

// ——— 文档：屏幕坐标转换世界坐标 ———

/**
 * 绘图缓冲像素 → 射线与地球求交；优先 `globe.pick`，否则椭球面 `pickEllipsoid`。
 * 内部会换算为 `getPickRay` 所需的画布像素坐标（与 `worldCartesian3ToScreenPoint` 输出一致）。
 */
export function screenDrawingBufferToWorldCartesian3(
  viewer: Viewer,
  screen: DrawingBufferPoint | Cesium.Cartesian2,
): Cesium.Cartesian3 | undefined {
  const x = screen.x
  const y = screen.y
  const pickPos = drawingBufferToPickCartesian2(viewer, x, y)
  const ray = viewer.camera.getPickRay(pickPos)
  if (!ray) return undefined
  const globeHit = viewer.scene.globe.pick(ray, viewer.scene) as Cesium.Cartesian3 | undefined
  if (globeHit) return Cesium.Cartesian3.clone(globeHit)
  return viewer.camera.pickEllipsoid(pickPos, viewer.scene.globe.ellipsoid) ?? undefined
}

// ——— 文档：世界坐标转换经纬度（度）坐标 ———

/**
 * ECEF（米）→ 经纬度（度）+ 椭球高（米）。
 */
export function worldCartesian3ToLngLatHeight(
  world: Cesium.Cartesian3 | { x: number; y: number; z: number },
  ellipsoid: Cesium.Ellipsoid = Cesium.Ellipsoid.WGS84,
): LngLatHeight {
  const c = toCartesian3(world)
  const carto = Cesium.Cartographic.fromCartesian(c, ellipsoid, scratchCartographic)
  return {
    longitude: Cesium.Math.toDegrees(carto.longitude),
    latitude: Cesium.Math.toDegrees(carto.latitude),
    height: carto.height,
  }
}

// ——— 文档：经纬度（度）坐标转换世界坐标 ———

/**
 * 经纬度（度）+ 高（米）→ ECEF（米）。
 */
export function lngLatHeightToWorldCartesian3(
  longitudeDegrees: number,
  latitudeDegrees: number,
  heightMeters = 0,
  result = new Cesium.Cartesian3(),
): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(
    longitudeDegrees,
    latitudeDegrees,
    heightMeters,
    Cesium.Ellipsoid.WGS84,
    result,
  )
}

// ——— 文档：屏幕坐标转换经纬度（度）坐标 ———

/**
 * 绘图缓冲像素 → 经纬度（度）与高（米）。优先 `pickPosition`（模型/地形），再 globe/椭球。
 * 内部换算为画布像素坐标后再拾取（与 `getPickRay` 约定一致）。
 */
export function screenDrawingBufferToLngLatHeight(
  viewer: Viewer,
  screen: DrawingBufferPoint | Cesium.Cartesian2,
): LngLatHeight | undefined {
  const x = screen.x
  const y = screen.y
  const pickPos = drawingBufferToPickCartesian2(viewer, x, y)

  let cartesian: Cesium.Cartesian3 | undefined = viewer.scene.pickPosition(pickPos)
  if (!Cesium.defined(cartesian)) {
    const ray = viewer.camera.getPickRay(pickPos)
    if (ray) {
      cartesian = viewer.scene.globe.pick(ray, viewer.scene) as Cesium.Cartesian3 | undefined
    }
  }
  if (!Cesium.defined(cartesian)) {
    cartesian = viewer.camera.pickEllipsoid(pickPos, viewer.scene.globe.ellipsoid) ?? undefined
  }
  if (!Cesium.defined(cartesian)) return undefined
  return worldCartesian3ToLngLatHeight(cartesian)
}

/**
 * 浏览器鼠标位置 → 经纬高（内部先换算为绘图缓冲坐标）。
 */
export function screenClientXYToLngLatHeight(
  viewer: Viewer,
  clientX: number,
  clientY: number,
): LngLatHeight | undefined {
  const db = clientXYToDrawingBuffer(viewer, clientX, clientY)
  return screenDrawingBufferToLngLatHeight(viewer, db)
}

// ——— 文档：经纬度（度）坐标转换屏幕坐标 ———

/**
 * 经纬度（度）与高 → 绘图缓冲屏幕坐标。
 */
export function lngLatHeightToScreenPoint(
  viewer: Viewer,
  longitudeDegrees: number,
  latitudeDegrees: number,
  heightMeters = 0,
  result = new Cesium.Cartesian2(),
): ScreenPoint | undefined {
  const c = lngLatHeightToWorldCartesian3(longitudeDegrees, latitudeDegrees, heightMeters)
  return worldCartesian3ToScreenPoint(viewer, c, result)
}

function normalizeDmsAxis(
  decimalDegrees: number,
  kind: 'lon' | 'lat',
): DmsAxis {
  const sign = decimalDegrees < 0 ? -1 : 1
  const abs = Math.abs(decimalDegrees)
  const dFull = Math.floor(abs)
  const minFloat = (abs - dFull) * 60
  const m = Math.floor(minFloat)
  const s = (minFloat - m) * 60
  let hemisphere: DmsAxis['hemisphere']
  if (kind === 'lon') {
    hemisphere = sign >= 0 ? 'E' : 'W'
  } else {
    hemisphere = sign >= 0 ? 'N' : 'S'
  }
  return {
    degrees: dFull,
    minutes: m,
    seconds: s,
    hemisphere,
  }
}

// ——— 文档：经纬度（度）坐标转换度分秒 ———

/**
 * 十进制度 → 度分秒分量（含 E/W/N/S）。
 */
export function lngLatDecimalToDms(longitudeDegrees: number, latitudeDegrees: number): LngLatDms {
  return {
    longitude: normalizeDmsAxis(longitudeDegrees, 'lon'),
    latitude: normalizeDmsAxis(latitudeDegrees, 'lat'),
  }
}

/**
 * 单个十进制度 → `127°1.00′17.04″` 形式（**不带** E/W/N/S）；**分、秒各保留两位小数**。
 * 西经、南纬在**度数**前加负号（如 `-127°1.00′17.04″`）；分、秒为非负分量。
 */
export function decimalDegreesToDmsSymbolicString(decimalDegrees: number): string {
  const neg = decimalDegrees < 0
  const abs = Math.abs(decimalDegrees)
  const d = Math.floor(abs)
  const minFloat = (abs - d) * 60
  const m = Math.floor(minFloat)
  const s = (minFloat - m) * 60
  const sign = neg ? '-' : ''
  return `${sign}${d}°${m.toFixed(2)}′${s.toFixed(2)}″`
}

/**
 * 经纬十进制度 → 两行「纯符号」度分秒串（`°′″`，无半球字母）。
 */
export function lngLatDecimalToDmsSymbolicStrings(
  longitudeDegrees: number,
  latitudeDegrees: number,
): { longitude: string; latitude: string } {
  return {
    longitude: decimalDegreesToDmsSymbolicString(longitudeDegrees),
    latitude: decimalDegreesToDmsSymbolicString(latitudeDegrees),
  }
}

function dmsAxisToDecimal(axis: DmsAxis, kind: 'lon' | 'lat'): number {
  const mag = Math.abs(axis.degrees) + axis.minutes / 60 + axis.seconds / 3600
  let neg = false
  if (kind === 'lon') {
    neg = axis.hemisphere === 'W'
  } else {
    neg = axis.hemisphere === 'S'
  }
  return neg ? -mag : mag
}

// ——— 文档：度分秒转换经纬度（度）坐标 ———

/**
 * 度分秒（含半球）→ 十进制度。
 */
export function dmsToLngLatDecimal(lon: DmsAxis, lat: DmsAxis): { longitude: number; latitude: number } {
  return {
    longitude: dmsAxisToDecimal(lon, 'lon'),
    latitude: dmsAxisToDecimal(lat, 'lat'),
  }
}

/**
 * 坐标（Coordinates）类：文档「坐标」一级菜单下能力，挂载于 `window.FastX.Coordinates`。
 */
export const Coordinates = {
  createRandomXgxId,
  estimateImageryZoomLevel,
  clientXYToDrawingBuffer,
  drawingBufferToPickCartesian2,
  worldCartesian3ToScreenPoint,
  screenDrawingBufferToWorldCartesian3,
  worldCartesian3ToLngLatHeight,
  lngLatHeightToWorldCartesian3,
  screenDrawingBufferToLngLatHeight,
  screenClientXYToLngLatHeight,
  lngLatHeightToScreenPoint,
  lngLatDecimalToDms,
  decimalDegreesToDmsSymbolicString,
  lngLatDecimalToDmsSymbolicStrings,
  dmsToLngLatDecimal,
}

export type CoordinatesApi = typeof Coordinates
