import * as Cesium from 'cesium'
import type { Cartesian3 } from 'cesium'
import { pointOnCircleAtAzimuth } from '../Draw/Sector/sectorWedge'
import type { LngLatHeight, PointPositionInput } from '../Types'

export function colorFromCss(css: string, alpha = 1): Cesium.Color {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha)
}

export function cartesianToLngLat(cartesian: Cartesian3): LngLatHeight {
  const c = Cesium.Cartographic.fromCartesian(cartesian)
  return {
    longitude: Cesium.Math.toDegrees(c.longitude),
    latitude: Cesium.Math.toDegrees(c.latitude),
    height: c.height,
  }
}

export function midpoint(a: Cartesian3, b: Cartesian3): Cartesian3 {
  return Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3())
}

/**
 * 扇形定结束角阶段：将光标投影到「圆心–起始角」确定的半径圆上，保证预览点落在扇形外缘。
 */
export function snapSectorDraftCursor(anchors: Cartesian3[], cursor: Cartesian3): Cartesian3 {
  if (anchors.length < 2) return cursor
  const center = anchors[0]!
  const radius = Cesium.Cartesian3.distance(center, anchors[1]!)
  if (radius <= 0) return cursor
  const az = bearingDegreesNorthClockwise(center, cursor)
  return pointOnCircleAtAzimuth(center, radius, az)
}

/** 自北顺时针方位角（度） */
export function bearingDegreesNorthClockwise(from: Cartesian3, to: Cartesian3): number {
  const c1 = Cesium.Cartographic.fromCartesian(from)
  const c2 = Cesium.Cartographic.fromCartesian(to)
  const dLon = c2.longitude - c1.longitude
  const lat1 = c1.latitude
  const lat2 = c2.latitude
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const brng = Math.atan2(y, x)
  return (Cesium.Math.toDegrees(brng) + 360) % 360
}

export function rectangleFromCorners(a: Cartesian3, b: Cartesian3): Cesium.Rectangle {
  const c1 = Cesium.Cartographic.fromCartesian(a)
  const c2 = Cesium.Cartographic.fromCartesian(b)
  return Cesium.Rectangle.fromRadians(
    Math.min(c1.longitude, c2.longitude),
    Math.min(c1.latitude, c2.latitude),
    Math.max(c1.longitude, c2.longitude),
    Math.max(c1.latitude, c2.latitude),
  )
}

export function rectangleToBounds(rect: Cesium.Rectangle) {
  return {
    west: Cesium.Math.toDegrees(rect.west),
    south: Cesium.Math.toDegrees(rect.south),
    east: Cesium.Math.toDegrees(rect.east),
    north: Cesium.Math.toDegrees(rect.north),
  }
}

export function lngLatToTuple(llh: LngLatHeight): number[] {
  return [llh.longitude, llh.latitude, llh.height ?? 0]
}

export function positionInputToTuple(
  input: PointPositionInput | undefined,
): number[] | undefined {
  if (!input) return undefined
  if (input instanceof Cesium.Cartesian3) {
    return lngLatToTuple(cartesianToLngLat(input))
  }
  return lngLatToTuple(input)
}

export function positionsTupleToArray(
  positions: readonly [number, number, number][] | LngLatHeight[],
): number[][] {
  return positions.map((p) => {
    if (Array.isArray(p)) return [p[0], p[1], p[2] ?? 0]
    if (p instanceof Cesium.Cartesian3) return lngLatToTuple(cartesianToLngLat(p))
    return lngLatToTuple(p)
  })
}

export function toPolylineTuples(points: Cartesian3[]): [number, number, number][] {
  return points.map((p) => {
    const llh = cartesianToLngLat(p)
    return [llh.longitude, llh.latitude, llh.height] as [number, number, number]
  })
}
