import * as Cesium from 'cesium'
import type { PlotArrowKind, PlotArrowShapeOptions } from '../../Types'

interface Vec2 {
  x: number
  y: number
}

interface LocalProjector {
  toLocal(point: Cesium.Cartesian3): Vec2
  toWorld(point: Vec2, height?: number): Cesium.Cartesian3
}

export interface BuiltPlotArrowGeometry {
  /** 一个箭头可能包含多个面，例如双箭头和钳击箭头 */
  polygons: Cesium.Cartesian3[][]
}

type ResolvedShapeOptions = Required<PlotArrowShapeOptions>

const DEFAULT_SHAPE: ResolvedShapeOptions = {
  width: 0,
  headWidthRatio: 2.4,
  headLengthRatio: 0.24,
  neckWidthRatio: 0.82,
  tailWidthRatio: 0.72,
  swallowTailRatio: 0.85,
  curveSegments: 12,
  curveTension: 0.32,
}

const KIND_DEFAULTS: Partial<Record<PlotArrowKind, Partial<ResolvedShapeOptions>>> = {
  fineStraight: {
    headWidthRatio: 1.75,
    headLengthRatio: 0.18,
    neckWidthRatio: 0.46,
    tailWidthRatio: 0.28,
  },
  curve: {
    headWidthRatio: 2.05,
    headLengthRatio: 0.2,
    neckWidthRatio: 0.7,
    tailWidthRatio: 0.5,
    curveSegments: 16,
  },
  attackDirection: {
    headWidthRatio: 2.75,
    headLengthRatio: 0.28,
    neckWidthRatio: 0.96,
    tailWidthRatio: 0.58,
    curveSegments: 18,
  },
  double: {
    headWidthRatio: 2.15,
    headLengthRatio: 0.24,
    neckWidthRatio: 0.78,
    tailWidthRatio: 0.38,
    curveSegments: 18,
    curveTension: 0.42,
  },
  swallowtailAttack: {
    headWidthRatio: 2.7,
    headLengthRatio: 0.26,
    neckWidthRatio: 0.9,
    tailWidthRatio: 0.82,
    swallowTailRatio: 0.95,
    curveSegments: 18,
  },
  pincer: {
    headWidthRatio: 1.95,
    headLengthRatio: 0.22,
    neckWidthRatio: 0.72,
    tailWidthRatio: 0.36,
    curveSegments: 18,
    curveTension: 0.5,
  },
}

function resolveShapeOptions(kind: PlotArrowKind, options?: PlotArrowShapeOptions): ResolvedShapeOptions {
  const preset = KIND_DEFAULTS[kind] ?? {}
  return {
    ...DEFAULT_SHAPE,
    ...preset,
    ...options,
    curveSegments: Math.max(4, Math.min(48, Math.round(options?.curveSegments ?? preset.curveSegments ?? DEFAULT_SHAPE.curveSegments))),
    curveTension: Math.max(0, Math.min(1.2, options?.curveTension ?? preset.curveTension ?? DEFAULT_SHAPE.curveTension)),
  }
}

function createProjector(points: readonly Cesium.Cartesian3[]): LocalProjector | null {
  const origin = points[0]
  if (!origin) return null
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(origin)
  const inverse = Cesium.Matrix4.inverseTransformation(frame, new Cesium.Matrix4())

  return {
    toLocal(point) {
      const local = Cesium.Matrix4.multiplyByPoint(inverse, point, new Cesium.Cartesian3())
      return { x: local.x, y: local.y }
    },
    toWorld(point, height) {
      const world = Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(point.x, point.y, 0), new Cesium.Cartesian3())
      if (height === undefined || !Number.isFinite(height)) return world
      const carto = Cesium.Cartographic.fromCartesian(world)
      return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, height)
    },
  }
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x
}

function mul(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k }
}

function len(a: Vec2): number {
  return Math.hypot(a.x, a.y)
}

function normalize(a: Vec2): Vec2 {
  const l = len(a)
  return l > 1e-6 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 }
}

function perp(a: Vec2): Vec2 {
  return { x: -a.y, y: a.x }
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function distance(a: Vec2, b: Vec2): number {
  return len(sub(a, b))
}

function uniquePoints(points: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (!prev || distance(prev, point) > 0.1) out.push(point)
  }
  return out
}

function signedSide(point: Vec2, origin: Vec2, axisDir: Vec2): 1 | -1 {
  return cross(axisDir, sub(point, origin)) >= 0 ? 1 : -1
}

function pathLength(points: readonly Vec2[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1]!, points[i]!)
  return total
}

function pathDistances(points: readonly Vec2[]): number[] {
  const d = [0]
  for (let i = 1; i < points.length; i++) d[i] = d[i - 1]! + distance(points[i - 1]!, points[i]!)
  return d
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

function smoothPath(points: Vec2[], segments: number): Vec2[] {
  const clean = uniquePoints(points)
  if (clean.length <= 2) return clean
  const out: Vec2[] = []
  for (let i = 0; i < clean.length - 1; i++) {
    const p0 = clean[Math.max(i - 1, 0)]!
    const p1 = clean[i]!
    const p2 = clean[i + 1]!
    const p3 = clean[Math.min(i + 2, clean.length - 1)]!
    for (let s = 0; s < segments; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / segments))
    }
  }
  out.push(clean[clean.length - 1]!)
  return uniquePoints(out)
}

function pointAtDistance(points: readonly Vec2[], target: number): { point: Vec2; index: number } {
  if (points.length === 0) return { point: { x: 0, y: 0 }, index: 0 }
  if (target <= 0) return { point: points[0]!, index: 0 }
  let acc = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const seg = distance(a, b)
    if (acc + seg >= target) {
      const t = seg > 0 ? (target - acc) / seg : 0
      return { point: lerp(a, b, t), index: i }
    }
    acc += seg
  }
  return { point: points[points.length - 1]!, index: points.length - 1 }
}

function normalAt(points: readonly Vec2[], index: number): Vec2 {
  const prev = points[Math.max(0, index - 1)]!
  const next = points[Math.min(points.length - 1, index + 1)]!
  return normalize(perp(sub(next, prev)))
}

function directionAtEnd(points: readonly Vec2[]): Vec2 {
  if (points.length < 2) return { x: 1, y: 0 }
  return normalize(sub(points[points.length - 1]!, points[points.length - 2]!))
}

function offsetAt(path: readonly Vec2[], distances: readonly number[], index: number, total: number, tailWidth: number, neckWidth: number, side: 1 | -1): Vec2 {
  const t = total > 0 ? distances[index]! / total : 0
  const width = tailWidth + (neckWidth - tailWidth) * t
  return add(path[index]!, mul(normalAt(path, index), side * width * 0.5))
}

function autoWidth(total: number, requested: number, factor = 0.08): number {
  if (requested > 0 && Number.isFinite(requested)) return requested
  return Math.max(total * factor, 1)
}

function buildBranchPath(
  start: Vec2,
  end: Vec2,
  axisDir: Vec2,
  side: 1 | -1,
  outerFactor: number,
  innerFactor: number,
): Vec2[] {
  const span = Math.max(distance(start, end), 1)
  const normal = mul(perp(axisDir), side)
  const outer = mul(normal, span * outerFactor)
  const middle = mul(normal, span * (outerFactor * 0.58 + innerFactor * 0.42))
  const inner = mul(normal, span * innerFactor)
  return [
    start,
    add(lerp(start, end, 0.24), outer),
    add(lerp(start, end, 0.54), middle),
    add(lerp(start, end, 0.8), inner),
    end,
  ]
}

function buildArrowAlongPath(points: Vec2[], options: ResolvedShapeOptions, opts: { swallowTail?: boolean; widthFactor?: number } = {}): Vec2[] {
  const path = uniquePoints(points)
  if (path.length < 2) return []
  const total = pathLength(path)
  if (total < 1) return []

  const width = autoWidth(total, options.width, opts.widthFactor ?? 0.08)
  const headLength = Math.max(width * 1.2, Math.min(total * options.headLengthRatio, total * 0.48))
  const neckDistance = Math.max(0, total - headLength)
  const neckHit = pointAtDistance(path, neckDistance)
  const bodyPath = uniquePoints([...path.slice(0, Math.max(1, neckHit.index)), neckHit.point])
  if (bodyPath.length < 2) bodyPath.unshift(path[0]!)

  const bodyTotal = Math.max(pathLength(bodyPath), 1)
  const distances = pathDistances(bodyPath)
  const tailWidth = width * options.tailWidthRatio
  const neckWidth = width * options.neckWidthRatio
  const headWidth = width * options.headWidthRatio
  const dir = directionAtEnd(path)
  const n = perp(dir)
  const tip = path[path.length - 1]!
  const neck = bodyPath[bodyPath.length - 1]!
  const headLeft = add(neck, mul(n, headWidth * 0.5))
  const headRight = add(neck, mul(n, -headWidth * 0.5))
  const left = bodyPath.map((_, i) => offsetAt(bodyPath, distances, i, bodyTotal, tailWidth, neckWidth, 1))
  const right = bodyPath.map((_, i) => offsetAt(bodyPath, distances, i, bodyTotal, tailWidth, neckWidth, -1))
  const ring = [...left, headLeft, tip, headRight, ...right.reverse()]

  if (opts.swallowTail) {
    const tail = bodyPath[0]!
    const tailDir = normalize(sub(bodyPath[1] ?? tip, tail))
    const notch = add(tail, mul(tailDir, -width * options.swallowTailRatio))
    ring.push(notch)
  }

  return uniquePoints(ring)
}

function buildStraight(points: Vec2[], options: ResolvedShapeOptions, fine = false): Vec2[][] {
  if (points.length < 2) return []
  return [buildArrowAlongPath([points[0]!, points[points.length - 1]!], options, { widthFactor: fine ? 0.035 : 0.075 })]
}

function buildCurved(points: Vec2[], options: ResolvedShapeOptions, swallowTail = false, widthFactor = 0.065): Vec2[][] {
  if (points.length < 2) return []
  return [buildArrowAlongPath(smoothPath(points, options.curveSegments), options, { swallowTail, widthFactor })]
}

function buildDouble(points: Vec2[], options: ResolvedShapeOptions): Vec2[][] {
  if (points.length < 3) return []
  const leftHead = points[0]!
  const rightHead = points[1]!
  const tail = points[2]!
  const baseWidth = Math.max(distance(leftHead, rightHead) * 0.16, 1)
  const merged = { ...options, width: options.width || baseWidth }
  const axisDir = normalize(sub(lerp(leftHead, rightHead, 0.5), tail))
  const outerFactor = 0.16 + merged.curveTension * 0.12
  const innerFactor = 0.06 + merged.curveTension * 0.05
  const left = buildArrowAlongPath(
    smoothPath(buildBranchPath(tail, leftHead, axisDir, signedSide(leftHead, tail, axisDir), outerFactor, innerFactor), merged.curveSegments),
    merged,
    { widthFactor: 0.045 },
  )
  const right = buildArrowAlongPath(
    smoothPath(buildBranchPath(tail, rightHead, axisDir, signedSide(rightHead, tail, axisDir), outerFactor, innerFactor), merged.curveSegments),
    merged,
    { widthFactor: 0.045 },
  )
  return [left, right]
}

function buildPincer(points: Vec2[], options: ResolvedShapeOptions): Vec2[][] {
  if (points.length < 3) return []
  const leftStart = points[0]!
  const rightStart = points[1]!
  const leftTarget = points[2]!
  const rightTarget = points[3] ?? points[2]!
  const startCenter = lerp(leftStart, rightStart, 0.5)
  const targetCenter = lerp(leftTarget, rightTarget, 0.5)
  const span = Math.max(distance(leftStart, rightStart), distance(leftTarget, rightTarget), distance(startCenter, targetCenter), 1)
  const merged = { ...options, width: options.width || span * 0.12 }
  const axisDir = normalize(sub(targetCenter, startCenter))
  const outerFactor = 0.24 + merged.curveTension * 0.16
  const innerFactor = 0.1 + merged.curveTension * 0.08
  const left = buildArrowAlongPath(
    smoothPath(buildBranchPath(leftStart, leftTarget, axisDir, signedSide(leftStart, startCenter, axisDir), outerFactor, innerFactor), merged.curveSegments),
    merged,
    { widthFactor: 0.045 },
  )
  const right = buildArrowAlongPath(
    smoothPath(buildBranchPath(rightStart, rightTarget, axisDir, signedSide(rightStart, startCenter, axisDir), outerFactor, innerFactor), merged.curveSegments),
    merged,
    { widthFactor: 0.045 },
  )
  return [left, right]
}

function localPolygons(kind: PlotArrowKind, points: Vec2[], options: ResolvedShapeOptions): Vec2[][] {
  switch (kind) {
    case 'fineStraight':
      return buildStraight(points, options, true)
    case 'curve':
      return buildCurved(points, options)
    case 'attackDirection':
      return buildCurved(points, options, false, 0.09)
    case 'double':
      return buildDouble(points, options)
    case 'swallowtailAttack':
      return buildCurved(points, options, true, 0.09)
    case 'pincer':
      return buildPincer(points, options)
    default:
      return buildStraight(points, options)
  }
}

export function minPointsForPlotArrow(kind: PlotArrowKind): number {
  if (kind === 'double') return 3
  if (kind === 'pincer') return 3
  if (kind === 'attackDirection' || kind === 'swallowtailAttack') return 3
  return 2
}

export function buildPlotArrowGeometry(
  kind: PlotArrowKind,
  positions: readonly Cesium.Cartesian3[],
  options?: PlotArrowShapeOptions,
  height?: number,
): BuiltPlotArrowGeometry | null {
  if (positions.length < minPointsForPlotArrow(kind)) return null
  const projector = createProjector(positions)
  if (!projector) return null
  const resolved = resolveShapeOptions(kind, options)
  const locals = uniquePoints(positions.map((point) => projector.toLocal(point)))
  const polygons = localPolygons(kind, locals, resolved)
    .filter((polygon) => polygon.length >= 3)
    .map((polygon) => polygon.map((point) => projector.toWorld(point, height)))
    .filter((polygon) => polygon.length >= 3)

  return polygons.length ? { polygons } : null
}
