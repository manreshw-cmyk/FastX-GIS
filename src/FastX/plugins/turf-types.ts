/** GeoJSON 最小类型（避免依赖 @types/geojson） */
export interface TurfPosition {
  0: number
  1: number
  2?: number
  length: number
}

export interface TurfFeature<G = unknown> {
  type: 'Feature'
  geometry: G
  properties: Record<string, unknown> | null
}

export interface TurfPoint {
  type: 'Point'
  coordinates: number[]
}

export interface TurfLineString {
  type: 'LineString'
  coordinates: number[][]
}

export interface TurfPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

/** @turf/turf 浏览器包暴露的核心 API */
export interface TurfStatic {
  buffer: (
    feature: TurfFeature,
    radius: number,
    options?: { units?: string; steps?: number },
  ) => TurfFeature<TurfPolygon | TurfPoint> | undefined
  point: (coord: number[]) => TurfFeature<TurfPoint>
  lineString: (coords: number[][]) => TurfFeature<TurfLineString>
  polygon: (coords: number[][][]) => TurfFeature<TurfPolygon>
}
