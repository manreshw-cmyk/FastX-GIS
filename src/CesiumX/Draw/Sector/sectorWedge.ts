import * as Cesium from 'cesium'

/**
 * 在中心点建立局部 ENU，按方位角（自北顺时针，度）在切平面上取弧点，生成扇形填充多边形的顶点序列：
 * [圆心, 弧起点, …, 弧终点]（闭合由 `PolygonGraphics` 处理）。
 */
export function computeSectorCartesianRing(
  centerLon: number,
  centerLat: number,
  centerHeight: number,
  radiusMeters: number,
  startAzimuthDegrees: number,
  endAzimuthDegrees: number,
  arcSegments: number,
  out: Cesium.Cartesian3[] = [],
): Cesium.Cartesian3[] {
  out.length = 0
  const r = Number(radiusMeters)
  if (!Number.isFinite(r) || r <= 0) return out

  let span = Number(endAzimuthDegrees) - Number(startAzimuthDegrees)
  while (span <= 0) span += 360
  while (span > 360) span -= 360

  const steps = Math.max(2, Math.floor(Number(arcSegments)) || 32)
  const center = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, centerHeight)
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center)

  out.push(Cesium.Cartesian3.clone(center, new Cesium.Cartesian3()))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const azDeg = startAzimuthDegrees + span * t
    const azRad = Cesium.Math.toRadians(azDeg)
    const east = r * Math.sin(azRad)
    const north = r * Math.cos(azRad)
    const local = new Cesium.Cartesian3(east, north, 0)
    out.push(Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3()))
  }
  return out
}
