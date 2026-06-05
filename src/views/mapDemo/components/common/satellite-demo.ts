/**
 * 图层渲染示例 — CZML 卫星与探测圆锥。
 *
 * **轨道数据**：`satellites.czml` 为 FIXED 笛卡尔采样（非六根数 / TLE）。
 * **探测圆锥**：Cesium Entity + `CallbackProperty`，随仿真时钟自动更新（顶点=卫星，底面=地表）。
 */
import * as Cesium from 'cesium'

/** CZML 数据文件（相对 `FastX/build/Data/`） */
export const SATELLITES_CZML = 'json/satellites.czml'

/** 与 CZML 内 clock 起始时刻一致 */
export const SATELLITE_EPOCH_ISO = '2024-06-01T00:00:00Z'

const ORBIT_PERIOD_SEC = 5400
const SENSOR_HALF_ANGLE_DEG = 12

/** 单圈轨道时长（小时），用于 UI 展示 */
export const SATELLITE_CLOCK_HOURS = ORBIT_PERIOD_SEC / 3600

const SENSOR_COLORS = [
  '#ff6347', '#32cd32', '#1e90ff', '#ffd700', '#ee82ee', '#00ffff', '#ff8c00',
  '#7cfc00', '#ff1493', '#4682b4', '#ffa500', '#9400d3', '#00bfff', '#dc143c', '#2e8b57',
]

function isSatelliteRootEntity(id: string): boolean {
  return /^Satellite\/\d+$/.test(id)
}

export function getSatelliteClockRange(): { start: Cesium.JulianDate; stop: Cesium.JulianDate } {
  const start = Cesium.JulianDate.fromIso8601(SATELLITE_EPOCH_ISO)
  const stop = Cesium.JulianDate.addSeconds(start, ORBIT_PERIOD_SEC, new Cesium.JulianDate())
  return { start, stop }
}

/** 对齐 CZML 时钟区间（不含播放驱动） */
export function setupSatelliteClock(viewer: Cesium.Viewer): void {
  const { start, stop } = getSatelliteClockRange()
  viewer.clock.startTime = start.clone()
  viewer.clock.stopTime = stop.clone()
  viewer.clock.currentTime = start.clone()
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER
  viewer.clock.multiplier = 120
  viewer.clock.canAnimate = true
  viewer.clock.shouldAnimate = true
}

/** 格式化仿真时刻（用于 CZML 面板展示） */
export function formatSatelliteClockIso(time: Cesium.JulianDate): string {
  return Cesium.JulianDate.toIso8601(time).replace('.000Z', 'Z')
}

type ConeScratch = {
  sat: Cesium.Cartesian3
  surf: Cesium.Cartesian3
  mid: Cesium.Cartesian3
  carto: Cesium.Cartographic
}

function surfaceUnder(sat: Cesium.Cartesian3, ellipsoid: Cesium.Ellipsoid, carto: Cesium.Cartographic): Cesium.Cartesian3 {
  Cesium.Cartographic.fromCartesian(sat, ellipsoid, carto)
  carto.height = 0
  return ellipsoid.cartographicToCartesian(carto, new Cesium.Cartesian3())
}

function coneLengthAndRadius(
  sat: Cesium.Cartesian3,
  ellipsoid: Cesium.Ellipsoid,
  scratch: ConeScratch,
): { length: number; bottomRadius: number; mid: Cesium.Cartesian3 } {
  const surface = surfaceUnder(sat, ellipsoid, scratch.carto)
  const length = Cesium.Cartesian3.distance(sat, surface)
  const mid = Cesium.Cartesian3.midpoint(sat, surface, scratch.mid)
  const bottomRadius = length * Math.tan(Cesium.Math.toRadians(SENSOR_HALF_ANGLE_DEG))
  return { length, bottomRadius, mid }
}

/** 令 Entity 圆柱 +Z 轴指向卫星（topRadius=0 一端为顶点） */
function coneOrientation(
  mid: Cesium.Cartesian3,
  sat: Cesium.Cartesian3,
  ellipsoid: Cesium.Ellipsoid,
  result = new Cesium.Quaternion(),
): Cesium.Quaternion {
  const zAxis = Cesium.Cartesian3.subtract(sat, mid, new Cesium.Cartesian3())
  Cesium.Cartesian3.normalize(zAxis, zAxis)

  const up = ellipsoid.geodeticSurfaceNormal(mid, new Cesium.Cartesian3())
  let xAxis = Cesium.Cartesian3.cross(up, zAxis, new Cesium.Cartesian3())
  if (Cesium.Cartesian3.magnitudeSquared(xAxis) < 1e-10) {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(mid, ellipsoid, new Cesium.Matrix4())
    const east4 = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian4())
    xAxis = new Cesium.Cartesian3(east4.x, east4.y, east4.z)
  } else {
    Cesium.Cartesian3.normalize(xAxis, xAxis)
  }
  const yAxis = Cesium.Cartesian3.cross(zAxis, xAxis, new Cesium.Cartesian3())
  Cesium.Cartesian3.normalize(yAxis, yAxis)

  const rot = Cesium.Matrix3.fromColumnMajorArray([
    xAxis.x, yAxis.x, zAxis.x,
    xAxis.y, yAxis.y, zAxis.y,
    xAxis.z, yAxis.z, zAxis.z,
  ])
  return Cesium.Quaternion.fromRotationMatrix(rot, result)
}

function pathColor(entity: Cesium.Entity, time: Cesium.JulianDate, fallback: string): Cesium.Color {
  const mat = entity.path?.material
  if (mat instanceof Cesium.ColorMaterialProperty) {
    const c = mat.color?.getValue(time)
    if (c) return c.withAlpha(0.42)
  }
  return Cesium.Color.fromCssColorString(fallback).withAlpha(0.42)
}

/**
 * 启动 CZML 仿真时钟（Viewer 未挂载 Animation 控件时需 postRender 补 tick）。
 * @returns dispose
 */
export function startSatelliteSimulation(viewer: Cesium.Viewer): () => void {
  setupSatelliteClock(viewer)

  let lastSec = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, viewer.clock.startTime)
  const onPostRender = () => {
    if (viewer.isDestroyed()) return
    if (!viewer.clock.shouldAnimate) viewer.clock.shouldAnimate = true

    const nowSec = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, viewer.clock.startTime)
    if (viewer.clock.shouldAnimate && Math.abs(nowSec - lastSec) < 1e-12) {
      viewer.clock.tick()
    }
    lastSec = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, viewer.clock.startTime)
  }

  viewer.scene.postRender.addEventListener(onPostRender)
  viewer.scene.requestRender()
  return () => viewer.scene.postRender.removeEventListener(onPostRender)
}

/**
 * 为每颗卫星创建探测圆锥 Entity（CallbackProperty 随仿真时间更新）。
 */
export function attachSatelliteSensorCones(viewer: Cesium.Viewer, ds: Cesium.DataSource): () => void {
  const ellipsoid = viewer.scene.globe.ellipsoid
  const created: Cesium.Entity[] = []
  let colorIdx = 0
  const initTime = viewer.clock.currentTime

  for (const satEntity of ds.entities.values) {
    const id = String(satEntity.id ?? '')
    if (!isSatelliteRootEntity(id) || !satEntity.position) continue

    const scratch: ConeScratch = {
      sat: new Cesium.Cartesian3(),
      surf: new Cesium.Cartesian3(),
      mid: new Cesium.Cartesian3(),
      carto: new Cesium.Cartographic(),
    }
    const color = pathColor(satEntity, initTime, SENSOR_COLORS[colorIdx % SENSOR_COLORS.length]!)
    colorIdx++
    const coneId = `${id.replace('/', '-')}-sensor`

    const cone = viewer.entities.add({
      id: coneId,
      availability: satEntity.availability,
      position: new Cesium.CallbackPositionProperty((time, result) => {
        const sat = satEntity.position?.getValue(time, scratch.sat)
        if (!sat) return undefined
        const { mid } = coneLengthAndRadius(sat, ellipsoid, scratch)
        return Cesium.Cartesian3.clone(mid, result ?? new Cesium.Cartesian3())
      }, false),
      orientation: new Cesium.CallbackProperty((time, result) => {
        const sat = satEntity.position?.getValue(time, scratch.sat)
        if (!sat) return undefined
        const { mid } = coneLengthAndRadius(sat, ellipsoid, scratch)
        return coneOrientation(mid, sat, ellipsoid, result ?? new Cesium.Quaternion())
      }, false),
      cylinder: {
        length: new Cesium.CallbackProperty((time) => {
          const sat = satEntity.position?.getValue(time, scratch.sat)
          if (!sat) return 1
          return coneLengthAndRadius(sat, ellipsoid, scratch).length
        }, false),
        topRadius: 0,
        bottomRadius: new Cesium.CallbackProperty((time) => {
          const sat = satEntity.position?.getValue(time, scratch.sat)
          if (!sat) return 1
          return coneLengthAndRadius(sat, ellipsoid, scratch).bottomRadius
        }, false),
        material: color,
        outline: false,
        heightReference: Cesium.HeightReference.NONE,
        slices: 24,
      },
    })
    created.push(cone)
  }

  if (!created.length) {
    console.warn('[satellite-demo] 未创建任何探测圆锥')
  } else {
    console.info(`[satellite-demo] 已创建 ${created.length} 个探测圆锥`)
  }

  viewer.scene.requestRender()
  return () => {
    for (const e of created) viewer.entities.remove(e)
  }
}
