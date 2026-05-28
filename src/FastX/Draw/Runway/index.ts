import * as Cesium from 'cesium'
import type { Color, Entity, Material, MaterialProperty, Property, Viewer } from 'cesium'
import { createRandomXgxId, type LngLatHeight } from '../../Coordinates'

import type {
  AddRunwayOptions,
  RunwayFlowBandStyle,
  RunwayFlowStAxis,
  RunwayLngLatTuple,
  RunwayMaterialMode,
  RunwaySnapshot,
  RunwayStyleOptions,
  RunwayVertexInput,
  UpdateRunwayProperties,
} from '../../Types'
import {
  clearAreaDraftTargetData,
  createDraftPolylinePositionsProperty,
  getDraftPoints,
  isAreaDraftTargetData,
  markAreaDraftTargetData,
  setDraftPoints,
  type AreaDraftPointsHolder,
} from '../../Utils/areaDraft'
export type {
  AddRunwayOptions,
  RunwayFlowBandStyle,
  RunwayFlowStAxis,
  RunwayLngLatTuple,
  RunwayMaterialMode,
  RunwaySnapshot,
  RunwayStyleOptions,
  RunwayVertexInput,
  UpdateRunwayProperties,
}

const scratchMid = new Cesium.Cartesian3()
const scratchCarto = new Cesium.Cartographic()
const scratchGeoA = new Cesium.Cartographic()
const scratchGeoB = new Cesium.Cartographic()

/** 与 fabric.type 一致；Entity 通过 {@link MaterialProperty.getValue} 写入 uniforms */
const RUNWAY_FLOW_COLOR_TYPE = 'XgxRunwayFlowColor'
const RUNWAY_FLOW_IMAGE_TYPE = 'XgxRunwayFlowImage'
const RUNWAY_FLOW_IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVQ42mP8z5BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let runwayFlowFabricsReady = false

const RUNWAY_FLOW_COLOR_SHADER = `
  uniform vec4 u_color;
  uniform float u_speed;
  uniform float u_time;
  uniform float u_alpha;
  uniform float u_multiBands;
  uniform float u_bandCount;
  uniform float u_axisY;
  uniform float u_flipLen;
  czm_material czm_getMaterial(czm_materialInput materialInput)
  {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float rawLen = mix(st.x, st.y, u_axisY);
    float lenCoord = mix(rawLen, 1.0 - rawLen, u_flipLen);
    float bandRepeat = mix(1.0, max(u_bandCount, 1.0), u_multiBands);
    float offset = u_time * u_speed;
    float phase = fract(lenCoord * bandRepeat - offset);
    float singleVis = smoothstep(0.0, 0.14, phase) * (1.0 - smoothstep(0.86, 1.0, phase));
    float multiVis = smoothstep(0.2, 0.8, phase) * 0.75 + 0.25;
    float vis = mix(singleVis, multiVis, u_multiBands);
    float shimmer = 0.78 + 0.22 * sin(6.28318530718 * (lenCoord * bandRepeat - offset));
    material.diffuse = u_color.rgb * shimmer * (0.62 + 0.38 * vis);
    material.alpha = max(0.12, vis) * u_alpha;
    return material;
  }
`

const RUNWAY_FLOW_IMAGE_SHADER = `
  uniform sampler2D image;
  uniform float u_speed;
  uniform float u_time;
  uniform float u_alpha;
  uniform float u_multiBands;
  uniform float u_bandCount;
  uniform float u_axisY;
  uniform float u_flipLen;
  czm_material czm_getMaterial(czm_materialInput materialInput)
  {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float rawLen = mix(st.x, st.y, u_axisY);
    float lenCoord = mix(rawLen, 1.0 - rawLen, u_flipLen);
    float bandRepeat = mix(1.0, max(u_bandCount, 1.0), u_multiBands);
    float offset = u_time * u_speed;
    vec2 uv = vec2(
      fract(lenCoord * bandRepeat - offset),
      fract(mix(st.y, st.x, u_axisY))
    );
    vec4 tex = texture(image, uv);
    material.diffuse = tex.rgb;
    material.alpha = tex.a * u_alpha;
    return material;
  }
`

function flowFabricRegistered(type: string): boolean {
  const cache = (Cesium.Material as unknown as { _materialCache?: { getMaterial: (t: string) => unknown } })
    ._materialCache
  return Boolean(cache?.getMaterial(type))
}

function ensureRunwayFlowFabricsRegistered(): void {
  if (runwayFlowFabricsReady) return
  if (!flowFabricRegistered(RUNWAY_FLOW_COLOR_TYPE)) {
    new Cesium.Material({
      fabric: {
        type: RUNWAY_FLOW_COLOR_TYPE,
        uniforms: {
          u_color: Cesium.Color.CYAN,
          u_speed: 0.8,
          u_time: 0.0,
          u_alpha: 1.0,
          u_multiBands: 1.0,
          u_bandCount: 8.0,
          u_axisY: 0.0,
          u_flipLen: 0.0,
        },
        source: RUNWAY_FLOW_COLOR_SHADER,
      },
      translucent: true,
    })
  }
  if (!flowFabricRegistered(RUNWAY_FLOW_IMAGE_TYPE)) {
    new Cesium.Material({
      fabric: {
        type: RUNWAY_FLOW_IMAGE_TYPE,
        uniforms: {
          image: RUNWAY_FLOW_IMAGE_PLACEHOLDER,
          u_speed: 0.8,
          u_time: 0.0,
          u_alpha: 1.0,
          u_multiBands: 1.0,
          u_bandCount: 8.0,
          u_axisY: 0.0,
          u_flipLen: 0.0,
        },
        source: RUNWAY_FLOW_IMAGE_SHADER,
      },
      translucent: true,
    })
  }
  runwayFlowFabricsReady = true
}

function copyFlowUniformsInto(
  src: Material | null,
  result: Record<string, unknown>,
): Record<string, unknown> {
  const u = src?.uniforms as Record<string, unknown> | undefined
  if (!u) return result
  for (const key of Object.keys(u)) {
    const v = u[key]
    if (v === undefined) continue
    if (v instanceof Cesium.Color) {
      result[key] = Cesium.Color.clone(v, result[key] as Cesium.Color | undefined)
    } else {
      result[key] = v
    }
  }
  return result
}

/**
 * Entity 廊道：`getType` 返回 fabric 名；`getValue(time, uniforms)` 必须把 uniform 写入第二参数。
 */
class RunwayFlowMaterialProperty implements MaterialProperty {
  readonly isConstant = false
  readonly definitionChanged = new Cesium.Event()

  constructor(
    private readonly getMaterial: () => Material | null,
    private readonly fabricType: string,
  ) {}

  getType(_time?: Cesium.JulianDate): string {
    return this.fabricType
  }

  getValue(_time?: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    return copyFlowUniformsInto(this.getMaterial(), result ?? {})
  }

  equals(other?: Property): boolean {
    return other instanceof RunwayFlowMaterialProperty && other.fabricType === this.fabricType
  }
}

interface RunwayRecord extends AreaDraftPointsHolder {
  viewer: Viewer
  entity: Entity
  targetData: Record<string, unknown>
  tickListener: (() => void) | null
  flowMatProp?: RunwayFlowMaterialProperty
  flowMaterial: Material | null
}

function resolveRunwayDraftPair(
  options: AddRunwayOptions | UpdateRunwayProperties,
  ellipsoid: Cesium.Ellipsoid,
): Cesium.Cartesian3[] | undefined {
  if (options.positions && options.positions.length >= 1) {
    const verts = options.positions.length >= 2 ? options.positions : [options.positions[0]!, options.positions[0]!]
    return lineToCartesian3Array(verts, ellipsoid)
  }
  const add = options as AddRunwayOptions
  const pair = resolveTwoCartesianPositions(add, ellipsoid)
  return pair ?? undefined
}

function applyAreaDraftCorridor(rec: RunwayRecord): void {
  const td = rec.targetData
  const wid = typeof td.width === 'number' ? td.width : 1
  const height = typeof td.height === 'number' ? td.height : 0
  const extrRaw = td.extrudedHeight
  const extrudedHeight =
    typeof extrRaw === 'number' && Number.isFinite(extrRaw) ? extrRaw : undefined
  const cornerType =
    typeof td.cornerType === 'number'
      ? (td.cornerType as Cesium.CornerType)
      : parseCornerType(td.cornerType as keyof typeof Cesium.CornerType)
  const showFill = td.showFill !== false
  const alpha = typeof td.alpha === 'number' ? td.alpha : 1
  const fillColor =
    toColor(String(td.color ?? '#00aaff'), showFill ? alpha : 0) ??
    Cesium.Color.CYAN.withAlpha(showFill ? alpha : 0)
  const outline = td.outline !== false
  const outlineColor =
    toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
    Cesium.Color.WHITE
  const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2

  const cg = new Cesium.CorridorGraphics()
  cg.positions = createDraftPolylinePositionsProperty(() => getDraftPoints(rec))
  cg.width = new Cesium.ConstantProperty(wid)
  cg.height = new Cesium.ConstantProperty(height)
  cg.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  cg.extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  if (extrudedHeight !== undefined) {
    cg.extrudedHeight = new Cesium.ConstantProperty(extrudedHeight)
  }
  cg.cornerType = new Cesium.ConstantProperty(cornerType)
  cg.fill = new Cesium.ConstantProperty(showFill)
  cg.material = new Cesium.ColorMaterialProperty(fillColor)
  cg.outline = new Cesium.ConstantProperty(outline)
  cg.outlineColor = new Cesium.ConstantProperty(outlineColor)
  cg.outlineWidth = new Cesium.ConstantProperty(outlineWidth)
  rec.entity.corridor = cg
  rebuildRunwayFill(rec)
}

function commitAreaDraftRecord(rec: RunwayRecord): boolean {
  const pts = getDraftPoints(rec)
  if (pts.length < 2) return false
  const ellipsoid = rec.viewer.scene.globe.ellipsoid
  const line = [pts[0]!, pts[1]!]
  const posTuples = cartesianPairToNumberTuples(line[0]!, line[1]!, ellipsoid)
  const td = rec.targetData
  td.positions = posTuples
  clearAreaDraftTargetData(td)
  rec.draftPoints = undefined

  const cg = rec.entity.corridor ?? (rec.entity.corridor = new Cesium.CorridorGraphics())
  cg.positions = new Cesium.ConstantProperty(line)
  detachFlow(rec)
  rebuildRunwayFill(rec)
  return true
}

function unwrapRecordProxy(src: Record<string, unknown>): Record<string, unknown> {
  let cur: unknown = src
  for (let d = 0; d < 16; d += 1) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) break
    const raw = (cur as { __v_raw?: unknown }).__v_raw
    if (raw === undefined || raw === cur) break
    cur = raw
  }
  return cur as Record<string, unknown>
}

function wrapPlainMutableRecord(src?: Record<string, unknown>): Record<string, unknown> {
  if (src == null || typeof src !== 'object' || Array.isArray(src)) {
    return {}
  }
  const base = unwrapRecordProxy(src as Record<string, unknown>)
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(base)) {
    out[k] = base[k as keyof typeof base] as unknown
  }
  try {
    return JSON.parse(JSON.stringify(out)) as Record<string, unknown>
  } catch {
    return { ...out }
  }
}

function colorFromString(css: string, alpha = 1): Color {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha)
}

function toColor(c: string | Color | undefined, alpha?: number): Color | undefined {
  if (c === undefined) return undefined
  if (c instanceof Cesium.Color) {
    return alpha !== undefined ? c.withAlpha(alpha) : c
  }
  return colorFromString(c, alpha ?? 1)
}

function colorToCss(c: Color | undefined): string | undefined {
  if (!c) return undefined
  return typeof (c as { toCssColorString?: () => string }).toCssColorString === 'function'
    ? (c as Color & { toCssColorString: () => string }).toCssColorString()
    : undefined
}

function sampleProperty<T>(p: Property | undefined, time = Cesium.JulianDate.now()): T | undefined {
  if (!p || typeof (p as Cesium.Property).getValue !== 'function') return undefined
  return (p as Cesium.Property).getValue(time) as T | undefined
}

function vertexToCartesian3(v: RunwayVertexInput, ellipsoid: Cesium.Ellipsoid, result = new Cesium.Cartesian3()): Cesium.Cartesian3 {
  if (v instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(v, result)
  }
  if (Array.isArray(v)) {
    const h = v[2] ?? 0
    return Cesium.Cartesian3.fromDegrees(Number(v[0]), Number(v[1]), Number(h), ellipsoid, result)
  }
  const lh = v as LngLatHeight
  const h = lh.height ?? 0
  return Cesium.Cartesian3.fromDegrees(lh.longitude, lh.latitude, h, ellipsoid, result)
}

function lineToCartesian3Array(line: RunwayVertexInput[], ellipsoid: Cesium.Ellipsoid): Cesium.Cartesian3[] | undefined {
  if (!Array.isArray(line) || line.length !== 2) return undefined
  return [vertexToCartesian3(line[0]!, ellipsoid), vertexToCartesian3(line[1]!, ellipsoid)]
}

function lineToNumberTuples(line: RunwayVertexInput[]): number[][] {
  const out: number[][] = []
  for (const v of line) {
    if (v instanceof Cesium.Cartesian3) {
      const c = Cesium.Cartographic.fromCartesian(v)
      out.push([Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), c.height])
    } else if (Array.isArray(v)) {
      out.push([Number(v[0]), Number(v[1]), Number(v[2] ?? 0)])
    } else {
      const lh = v as LngLatHeight
      out.push([lh.longitude, lh.latitude, lh.height ?? 0])
    }
  }
  return out
}

function positionsFromTargetData(td: Record<string, unknown>): number[][] {
  const raw = td.positions
  if (!Array.isArray(raw) || raw.length < 2) return []
  const out: number[][] = []
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue
    const a = row as unknown[]
    const lng = Number(a[0])
    const lat = Number(a[1])
    const h = row.length > 2 ? Number(a[2]) : 0
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      out.push([lng, lat, Number.isFinite(h) ? h : 0])
    }
  }
  return out
}

function parseCornerType(
  s: keyof typeof Cesium.CornerType | Cesium.CornerType | undefined,
): Cesium.CornerType {
  if (s === undefined) return Cesium.CornerType.ROUNDED
  if (typeof s === 'number') return s
  return Cesium.CornerType[s] ?? Cesium.CornerType.ROUNDED
}

function cornerTypeToKey(ct: Cesium.CornerType | undefined): string | undefined {
  if (ct === undefined) return undefined
  const e = Cesium.CornerType
  if (ct === e.ROUNDED) return 'ROUNDED'
  if (ct === e.MITERED) return 'MITERED'
  if (ct === e.BEVELED) return 'BEVELED'
  return String(ct)
}

function cornerTypeSnapshotFromRecord(
  sampled: Cesium.CornerType | undefined,
  td: Record<string, unknown>,
): string | undefined {
  if (sampled !== undefined) return cornerTypeToKey(sampled)
  const raw = td.cornerType
  if (raw === 'ROUNDED' || raw === 'MITERED' || raw === 'BEVELED') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return cornerTypeToKey(raw as Cesium.CornerType)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return cornerTypeToKey(parseCornerType(raw as keyof typeof Cesium.CornerType))
  }
  return undefined
}

function resolveTwoCartesianPositions(
  options: AddRunwayOptions,
  ellipsoid: Cesium.Ellipsoid,
): Cesium.Cartesian3[] | undefined {
  if (options.positions && options.positions.length === 2) {
    return lineToCartesian3Array(options.positions, ellipsoid)
  }
  const lon = options.longitude
  const lat = options.latitude
  const h0 = options.height ?? 0
  const elon = options.endLongitude
  const elat = options.endLatitude
  if (
    lon !== undefined &&
    lat !== undefined &&
    elon !== undefined &&
    elat !== undefined &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Number.isFinite(elon) &&
    Number.isFinite(elat)
  ) {
    const endH = options.endHeight ?? h0
    return [
      Cesium.Cartesian3.fromDegrees(Number(lon), Number(lat), h0, ellipsoid),
      Cesium.Cartesian3.fromDegrees(Number(elon), Number(elat), endH, ellipsoid),
    ]
  }
  return undefined
}

function cartesianPairToNumberTuples(p0: Cesium.Cartesian3, p1: Cesium.Cartesian3, ellipsoid: Cesium.Ellipsoid): number[][] {
  const c0 = Cesium.Cartographic.fromCartesian(p0, ellipsoid, scratchGeoA)
  const c1 = Cesium.Cartographic.fromCartesian(p1, ellipsoid, scratchGeoB)
  return [
    [Cesium.Math.toDegrees(c0.longitude), Cesium.Math.toDegrees(c0.latitude), c0.height],
    [Cesium.Math.toDegrees(c1.longitude), Cesium.Math.toDegrees(c1.latitude), c1.height],
  ]
}

function mergeRunwayCorridorGraphics(
  cg: Cesium.CorridorGraphics,
  opts: {
    positions: Cesium.Cartesian3[]
    width: number
    height: number
    extrudedHeight?: number
    cornerType: Cesium.CornerType
    fillMaterial: MaterialProperty
    showFill: boolean
    outline: boolean
    outlineColor: Color
    outlineWidth: number
    style?: RunwayStyleOptions
  },
  isCreate: boolean,
): void {
  cg.positions = new Cesium.ConstantProperty(opts.positions)
  cg.width = new Cesium.ConstantProperty(opts.width)
  cg.height = new Cesium.ConstantProperty(opts.height)
  cg.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)
  cg.extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE)

  if (opts.extrudedHeight !== undefined && Number.isFinite(opts.extrudedHeight)) {
    cg.extrudedHeight = new Cesium.ConstantProperty(opts.extrudedHeight)
  } else {
    cg.extrudedHeight = undefined
  }

  cg.cornerType = new Cesium.ConstantProperty(opts.cornerType)
  if (opts.style?.granularity !== undefined) {
    cg.granularity = new Cesium.ConstantProperty(opts.style.granularity)
  } else if (isCreate) {
    cg.granularity = undefined
  }
  cg.fill = new Cesium.ConstantProperty(opts.showFill)
  cg.material = opts.fillMaterial
  cg.outline = new Cesium.ConstantProperty(opts.outline)
  cg.outlineColor = new Cesium.ConstantProperty(opts.outlineColor)
  cg.outlineWidth = new Cesium.ConstantProperty(opts.outlineWidth)

  const st = opts.style
  if (st?.shadows !== undefined) cg.shadows = new Cesium.ConstantProperty(st.shadows)
  if (st?.distanceDisplayCondition !== undefined) {
    cg.distanceDisplayCondition = new Cesium.ConstantProperty(st.distanceDisplayCondition)
  }
  if (st?.classificationType !== undefined) {
    cg.classificationType = new Cesium.ConstantProperty(st.classificationType)
  }
  if (st?.zIndex !== undefined) cg.zIndex = new Cesium.ConstantProperty(st.zIndex)
}

function readCorridorFillColor(corridor: Cesium.CorridorGraphics): Color | undefined {
  const mat = corridor.material
  if (!mat || !(mat instanceof Cesium.ColorMaterialProperty)) return undefined
  return sampleProperty<Color>(mat.color)
}

function destroyFlowMaterial(m: Material | null): void {
  if (!m) return
  const d = (m as Material & { destroy?: () => void }).destroy
  if (typeof d === 'function') d.call(m)
}

function readFlowBandStyle(td: Record<string, unknown>): RunwayFlowBandStyle {
  return td.flowBandStyle === 'single' ? 'single' : 'multi'
}

function readFlowBandCount(td: Record<string, unknown>): number {
  const n = Number(td.flowBandCount)
  if (!Number.isFinite(n) || n < 1) return 8
  return Math.min(64, Math.floor(n))
}

function readFlowStAxisY(td: Record<string, unknown>): number {
  return td.flowStAxis === 'y' ? 1.0 : 0.0
}

/** 1：对长度 UV 取反（仅显式开启；默认 0 与廊道 positions 顺序一致） */
function readFlowLengthFlip(td: Record<string, unknown>): number {
  if (td.flowLengthFlip === true || td.flowLengthFlip === 1) return 1.0
  return 0.0
}

function readMultiBandsFloat(td: Record<string, unknown>): number {
  return readFlowBandStyle(td) === 'multi' ? 1.0 : 0.0
}

function syncFlowLayoutUniforms(m: Material, td: Record<string, unknown>): void {
  if (!m.uniforms) return
  m.uniforms.u_multiBands = readMultiBandsFloat(td)
  m.uniforms.u_bandCount = readFlowBandCount(td)
  m.uniforms.u_axisY = readFlowStAxisY(td)
  m.uniforms.u_flipLen = readFlowLengthFlip(td)
}

function createFlowColorMaterial(baseCss: string, speed: number, alpha: number, td: Record<string, unknown>): Material {
  ensureRunwayFlowFabricsRegistered()
  const color = Cesium.Color.fromCssColorString(baseCss)
  return Cesium.Material.fromType(RUNWAY_FLOW_COLOR_TYPE, {
    u_color: color,
    u_speed: speed,
    u_time: 0.0,
    u_alpha: alpha,
    u_multiBands: readMultiBandsFloat(td),
    u_bandCount: readFlowBandCount(td),
    u_axisY: readFlowStAxisY(td),
    u_flipLen: readFlowLengthFlip(td),
  })
}

function createFlowImageMaterial(imageUrl: string, speed: number, alpha: number, td: Record<string, unknown>): Material {
  ensureRunwayFlowFabricsRegistered()
  return Cesium.Material.fromType(RUNWAY_FLOW_IMAGE_TYPE, {
    image: imageUrl,
    u_speed: speed,
    u_time: 0.0,
    u_alpha: alpha,
    u_multiBands: readMultiBandsFloat(td),
    u_bandCount: readFlowBandCount(td),
    u_axisY: readFlowStAxisY(td),
    u_flipLen: readFlowLengthFlip(td),
  })
}

function buildFlowMaterial(
  mode: RunwayMaterialMode,
  colorCss: string,
  speed: number,
  alpha: number,
  td: Record<string, unknown>,
  imageUrl?: string,
): Material | null {
  if (mode === 'flowImage') {
    const url = imageUrl?.trim()
    if (!url) return null
    return createFlowImageMaterial(url, speed, alpha, td)
  }
  return createFlowColorMaterial(colorCss, speed, alpha, td)
}

function detachFlowListener(rec: RunwayRecord): void {
  if (rec.tickListener && rec.viewer && !rec.viewer.isDestroyed()) {
    rec.viewer.scene.preRender.removeEventListener(rec.tickListener)
  }
  rec.tickListener = null
  rec.flowMatProp = undefined
}

function detachFlow(rec: RunwayRecord): void {
  detachFlowListener(rec)
  destroyFlowMaterial(rec.flowMaterial)
  rec.flowMaterial = null
}

function attachFlowTick(rec: RunwayRecord): void {
  detachFlowListener(rec)
  destroyFlowMaterial(rec.flowMaterial)
  rec.flowMaterial = null
  const mat = buildFlowMaterial(
    (rec.targetData.materialMode as RunwayMaterialMode) ?? 'flowColor',
    String(rec.targetData.color ?? '#00aaff'),
    typeof rec.targetData.flowSpeed === 'number' ? rec.targetData.flowSpeed : 0.8,
    typeof rec.targetData.alpha === 'number' ? rec.targetData.alpha : 1,
    rec.targetData,
    typeof rec.targetData.flowImageUrl === 'string' ? rec.targetData.flowImageUrl : undefined,
  )
  if (!mat) {
    rec.flowMaterial = null
    return
  }
  rec.flowMaterial = mat
  const cg = rec.entity.corridor
  if (!cg) {
    destroyFlowMaterial(mat)
    rec.flowMaterial = null
    return
  }
  const fabricType =
    (rec.targetData.materialMode as RunwayMaterialMode) === 'flowImage'
      ? RUNWAY_FLOW_IMAGE_TYPE
      : RUNWAY_FLOW_COLOR_TYPE
  const flowMatProp = new RunwayFlowMaterialProperty(() => rec.flowMaterial, fabricType)
  rec.flowMatProp = flowMatProp
  cg.material = flowMatProp as unknown as MaterialProperty

  const listener = () => {
    const m = rec.flowMaterial
    if (!m?.uniforms || rec.viewer.isDestroyed()) return
    const wallSec =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001
    m.uniforms.u_time = wallSec
    if (m.uniforms.u_speed !== undefined) {
      const spd = Number(rec.targetData.flowSpeed)
      m.uniforms.u_speed = Number.isFinite(spd) ? spd : 0.8
    }
    if (m.uniforms.u_alpha !== undefined) {
      m.uniforms.u_alpha = typeof rec.targetData.alpha === 'number' ? rec.targetData.alpha : 1
    }
    if (rec.targetData.materialMode === 'flowColor' && m.uniforms.u_color !== undefined) {
      m.uniforms.u_color = Cesium.Color.fromCssColorString(String(rec.targetData.color ?? '#00aaff'))
    }
    if (rec.targetData.materialMode === 'flowImage' && m.uniforms.image !== undefined) {
      const url = typeof rec.targetData.flowImageUrl === 'string' ? rec.targetData.flowImageUrl : ''
      if (url) m.uniforms.image = url
    }
    syncFlowLayoutUniforms(m, rec.targetData)
    rec.viewer.scene.requestRender()
  }
  rec.viewer.scene.preRender.addEventListener(listener)
  rec.tickListener = listener
  listener()
  flowMatProp.definitionChanged.raiseEvent()
}

function rebuildRunwayFill(rec: RunwayRecord): void {
  const td = rec.targetData
  const cg = rec.entity.corridor
  if (!cg) return
  const showFill = td.showFill !== false
  cg.fill = new Cesium.ConstantProperty(showFill)
  detachFlow(rec)
  if (!showFill) {
    cg.material = undefined as unknown as MaterialProperty
    return
  }
  const mode = (td.materialMode as RunwayMaterialMode) ?? 'flowColor'
  const img = typeof td.flowImageUrl === 'string' ? td.flowImageUrl : undefined
  if (mode === 'flowImage' && !img?.trim()) {
    const col =
      toColor(String(td.color ?? '#00aaff'), typeof td.alpha === 'number' ? td.alpha : 1) ??
      Cesium.Color.CYAN
    cg.material = new Cesium.ColorMaterialProperty(col)
    return
  }
  attachFlowTick(rec)
  if (!rec.flowMaterial) {
    const col =
      toColor(String(td.color ?? '#00aaff'), typeof td.alpha === 'number' ? td.alpha : 1) ??
      Cesium.Color.CYAN
    cg.material = new Cesium.ColorMaterialProperty(col)
  }
}

/**
 * 跑道（`Entity` + `CorridorGraphics`，**两点**中心线）。单例：首参传入 `viewer`。
 */
export default class Runway {
  private readonly data = new Map<string, RunwayRecord>()

  private isRecordAlive(rec: RunwayRecord): boolean {
    if (rec.viewer.isDestroyed()) return false
    return rec.viewer.entities.contains(rec.entity)
  }

  private takeIfAlive(id: string): RunwayRecord | undefined {
    const rec = this.data.get(id)
    if (!rec) return undefined
    if (!this.isRecordAlive(rec)) {
      detachFlow(rec)
      this.data.delete(id)
      return undefined
    }
    return rec
  }

  private cloneTargetData(data?: Record<string, unknown>): Record<string, unknown> {
    return wrapPlainMutableRecord(data)
  }

  add(viewer: Viewer, options: AddRunwayOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined
    const id = options.id?.trim() ? options.id.trim() : createRandomXgxId('rw')
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined

    if (options.areaDraft) {
      return this.addAreaDraft(viewer, id, options)
    }

    const wid = Number(options.width)
    if (!Number.isFinite(wid) || wid <= 0) return undefined

    const ellipsoid = viewer.scene.globe.ellipsoid
    const pair = resolveTwoCartesianPositions(options, ellipsoid)
    if (!pair || pair.length !== 2) return undefined

    const materialMode: RunwayMaterialMode =
      options.materialMode === 'flowImage' || options.materialMode === 'flowColor'
        ? options.materialMode
        : 'flowColor'
    const flowSpeed = options.flowSpeed ?? 0.8
    const flowImageUrl =
      typeof options.flowImageUrl === 'string' && options.flowImageUrl.trim() ? options.flowImageUrl.trim() : undefined
    if (materialMode === 'flowImage' && !flowImageUrl) return undefined

    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false
    const outlineColor =
      toColor(options.outlineColor ?? '#ffffff', options.outlineAlpha ?? 1) ?? Cesium.Color.WHITE
    const outlineWidth = options.outlineWidth ?? 2
    const height = options.height ?? 0
    const extrudedHeight = options.extrudedHeight
    const cornerType = parseCornerType(options.cornerType)
    const fillColor =
      toColor(options.color ?? '#00aaff', showFill ? alpha : 0) ??
      Cesium.Color.CYAN.withAlpha(showFill ? alpha : 0)

    const corridor = new Cesium.CorridorGraphics()
    mergeRunwayCorridorGraphics(
      corridor,
      {
        positions: pair,
        width: wid,
        height,
        extrudedHeight:
          extrudedHeight !== undefined && Number.isFinite(extrudedHeight) ? extrudedHeight : undefined,
        cornerType,
        fillMaterial: new Cesium.ColorMaterialProperty(fillColor),
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        style: options.style,
      },
      true,
    )

    const entity = new Cesium.Entity({
      id,
      corridor,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    viewer.entities.add(entity)

    const p0 = pair[0]!
    const p1 = pair[1]!
    const mid = midpointLongitudeLatitudeHeight(p0, p1, ellipsoid)
    const posTuples =
      options.positions && options.positions.length === 2
        ? lineToNumberTuples(options.positions)
        : cartesianPairToNumberTuples(p0, p1, ellipsoid)

    const td = this.cloneTargetData(options.targetData)
    td.positions = posTuples
    td.width = wid
    td.height = height
    td.extrudedHeight = extrudedHeight ?? 0
    td.cornerType = cornerType
    td.longitude = mid.lon
    td.latitude = mid.lat
    td.heightMid = mid.h
    td.startLongitude = posTuples[0]![0]
    td.startLatitude = posTuples[0]![1]
    td.startHeight = posTuples[0]![2]
    td.endLongitude = posTuples[1]![0]
    td.endLatitude = posTuples[1]![1]
    td.endHeight = posTuples[1]![2]
    td.color = options.color ?? '#00aaff'
    td.alpha = alpha
    td.showFill = showFill
    td.outline = outline
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = outlineWidth
    td.materialMode = materialMode
    td.flowSpeed = flowSpeed
    td.flowBandStyle = options.flowBandStyle === 'single' ? 'single' : 'multi'
    {
      const n = Number(options.flowBandCount)
      td.flowBandCount = !Number.isFinite(n) || n < 1 ? 8 : Math.min(64, Math.floor(n))
    }
    td.flowStAxis = options.flowStAxis === 'y' ? 'y' : 'x'
    td.flowLengthFlip = options.flowLengthFlip === true
    if (flowImageUrl) td.flowImageUrl = flowImageUrl
    if (options.style) {
      td.styleSnapshot = wrapPlainMutableRecord(options.style as unknown as Record<string, unknown>)
    }

    const rec: RunwayRecord = { viewer, entity, targetData: td, tickListener: null, flowMaterial: null }
    this.data.set(id, rec)
    rebuildRunwayFill(rec)

    return entity
  }

  private addAreaDraft(viewer: Viewer, id: string, options: AddRunwayOptions): Entity | undefined {
    const wid = Number(options.width)
    if (!Number.isFinite(wid) || wid <= 0) return undefined
    const ellipsoid = viewer.scene.globe.ellipsoid
    const pair = resolveRunwayDraftPair(options, ellipsoid)
    if (!pair || pair.length < 2) return undefined

    const materialMode: RunwayMaterialMode =
      options.materialMode === 'flowImage' || options.materialMode === 'flowColor'
        ? options.materialMode
        : 'flowColor'
    const showFill = options.showFill !== false
    const alpha = options.alpha ?? 1
    const outline = options.outline !== false
    const height = options.height ?? 0
    const extrudedHeight = options.extrudedHeight
    const cornerType = parseCornerType(options.cornerType)
    const flowSpeed = options.flowSpeed ?? 0.8
    const flowImageUrl =
      typeof options.flowImageUrl === 'string' && options.flowImageUrl.trim() ? options.flowImageUrl.trim() : undefined

    const p0 = pair[0]!
    const p1 = pair[1]!
    const posTuples =
      options.positions && options.positions.length >= 1
        ? lineToNumberTuples(options.positions.length >= 2 ? options.positions : [options.positions[0]!, options.positions[0]!])
        : cartesianPairToNumberTuples(p0, p1, ellipsoid)

    const td = this.cloneTargetData(options.targetData)
    markAreaDraftTargetData(td)
    td.positions = posTuples
    td.width = wid
    td.height = height
    td.extrudedHeight = extrudedHeight ?? 0
    td.cornerType = cornerType
    td.color = options.color ?? '#00aaff'
    td.alpha = alpha
    td.showFill = showFill
    td.outline = outline
    td.outlineColor = options.outlineColor ?? '#ffffff'
    td.outlineAlpha = options.outlineAlpha ?? 1
    td.outlineWidth = options.outlineWidth ?? 2
    td.materialMode = materialMode
    td.flowSpeed = flowSpeed
    td.flowBandStyle = options.flowBandStyle === 'single' ? 'single' : 'multi'
    {
      const n = Number(options.flowBandCount)
      td.flowBandCount = !Number.isFinite(n) || n < 1 ? 8 : Math.min(64, Math.floor(n))
    }
    td.flowStAxis = options.flowStAxis === 'y' ? 'y' : 'x'
    td.flowLengthFlip = options.flowLengthFlip === true
    if (flowImageUrl) td.flowImageUrl = flowImageUrl
    if (options.style) {
      td.styleSnapshot = wrapPlainMutableRecord(options.style as unknown as Record<string, unknown>)
    }

    const entity = new Cesium.Entity({
      id,
      show: options.show !== false,
    })
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description)
    }

    const rec: RunwayRecord = { viewer, entity, targetData: td, tickListener: null, flowMaterial: null }
    setDraftPoints(rec, pair)
    applyAreaDraftCorridor(rec)
    viewer.entities.add(entity)
    this.data.set(id, rec)
    return entity
  }

  addRunways(viewer: Viewer, items: AddRunwayOptions[]): string[] {
    if (!viewer || viewer.isDestroyed() || !Array.isArray(items) || items.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!
        const rid = item.id?.trim() ? item.id.trim() : createRandomXgxId('rw')
        const e = this.add(viewer, { ...item, id: rid })
        if (e) ids.push(rid)
      } catch (e) {
        console.error(`[FastX.Draw.Runway] addRunways 第 ${i} 项失败:`, e)
      }
    }
    return ids
  }

  updateRunway(id: string, properties: UpdateRunwayProperties): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    const p = properties
    const td = rec.targetData
    const ellipsoid = rec.viewer.scene.globe.ellipsoid

    if (p.areaDraft === false && isAreaDraftTargetData(td)) {
      this.applyStylePatchToTargetData(rec, p)
      if (p.positions !== undefined) {
        const line = lineToCartesian3Array(p.positions, ellipsoid)
        if (line) {
          setDraftPoints(rec, line)
          td.positions = lineToNumberTuples(p.positions)
        }
      }
      return commitAreaDraftRecord(rec)
    }

    if (isAreaDraftTargetData(td) || p.areaDraft === true) {
      return this.updateAreaDraft(rec, p, ellipsoid)
    }

    if (p.targetData !== undefined) {
      Object.assign(td, wrapPlainMutableRecord(p.targetData))
    }

    if (p.positions !== undefined) {
      const line = lineToCartesian3Array(p.positions, ellipsoid)
      if (!line) return false
      td.positions = lineToNumberTuples(p.positions)
    } else if (
      p.longitude !== undefined &&
      p.latitude !== undefined &&
      p.endLongitude !== undefined &&
      p.endLatitude !== undefined
    ) {
      const prevPos = td.positions as number[][] | undefined
      const h0 =
        p.height ??
        (typeof td.startHeight === 'number' ? td.startHeight : Number(prevPos?.[0]?.[2]) ?? 0)
      const endH = p.endHeight ?? h0
      td.positions = [
        [Number(p.longitude), Number(p.latitude), h0],
        [Number(p.endLongitude), Number(p.endLatitude), endH],
      ]
    }

    if (p.width !== undefined) td.width = p.width
    if (p.height !== undefined) td.height = p.height
    if (p.extrudedHeight !== undefined) td.extrudedHeight = p.extrudedHeight
    if (p.cornerType !== undefined) td.cornerType = parseCornerType(p.cornerType)
    if (p.color !== undefined) td.color = p.color instanceof Cesium.Color ? colorToCss(p.color) : p.color
    if (p.alpha !== undefined) td.alpha = p.alpha
    if (p.showFill !== undefined) td.showFill = p.showFill
    if (p.outline !== undefined) td.outline = p.outline
    if (p.outlineColor !== undefined) {
      td.outlineColor = p.outlineColor instanceof Cesium.Color ? colorToCss(p.outlineColor) : p.outlineColor
    }
    if (p.outlineAlpha !== undefined) td.outlineAlpha = p.outlineAlpha
    if (p.outlineWidth !== undefined) td.outlineWidth = p.outlineWidth
    if (p.materialMode !== undefined) td.materialMode = p.materialMode
    if (p.flowSpeed !== undefined) td.flowSpeed = p.flowSpeed
    if (p.flowBandStyle !== undefined) td.flowBandStyle = p.flowBandStyle
    if (p.flowBandCount !== undefined) {
      const n = Number(p.flowBandCount)
      if (Number.isFinite(n) && n >= 1) td.flowBandCount = Math.min(64, Math.floor(n))
    }
    if (p.flowStAxis !== undefined) td.flowStAxis = p.flowStAxis
    if (p.flowLengthFlip !== undefined) td.flowLengthFlip = p.flowLengthFlip
    if (p.flowImageUrl !== undefined) td.flowImageUrl = p.flowImageUrl
    if (p.style !== undefined) td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style }

    const posNums = td.positions as number[][] | undefined
    if (!posNums || posNums.length !== 2) return false
    const lineCartesian = lineToCartesian3Array(
      posNums.map((t) => [Number(t[0]), Number(t[1]), Number(t[2] ?? 0)] as RunwayLngLatTuple),
      ellipsoid,
    )
    if (!lineCartesian) return false

    const p0 = lineCartesian[0]!
    const p1 = lineCartesian[1]!
    const mid = midpointLongitudeLatitudeHeight(p0, p1, ellipsoid)
    td.longitude = mid.lon
    td.latitude = mid.lat
    td.heightMid = mid.h
    td.startLongitude = posNums[0]![0]
    td.startLatitude = posNums[0]![1]
    td.startHeight = posNums[0]![2]
    td.endLongitude = posNums[1]![0]
    td.endLatitude = posNums[1]![1]
    td.endHeight = posNums[1]![2]

    const cg = rec.entity.corridor ?? (rec.entity.corridor = new Cesium.CorridorGraphics())
    const showFill = td.showFill !== false
    const alpha = typeof td.alpha === 'number' ? td.alpha : 1
    const fillColor =
      toColor(String(td.color ?? '#00aaff'), showFill ? alpha : 0) ??
      Cesium.Color.CYAN.withAlpha(showFill ? alpha : 0)
    const outline = td.outline !== false
    const outlineColor =
      toColor(String(td.outlineColor ?? '#ffffff'), typeof td.outlineAlpha === 'number' ? td.outlineAlpha : 1) ??
      Cesium.Color.WHITE
    const outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : 2
    const width = typeof td.width === 'number' ? td.width : sampleProperty<number>(cg.width) ?? 1
    const height = typeof td.height === 'number' ? td.height : sampleProperty<number>(cg.height) ?? 0
    const extrRaw = td.extrudedHeight
    const extrudedHeight =
      typeof extrRaw === 'number' && Number.isFinite(extrRaw) ? extrRaw : sampleProperty<number>(cg.extrudedHeight)
    const cornerType =
      typeof td.cornerType === 'number'
        ? (td.cornerType as Cesium.CornerType)
        : parseCornerType(td.cornerType as keyof typeof Cesium.CornerType)

    mergeRunwayCorridorGraphics(
      cg,
      {
        positions: lineCartesian,
        width,
        height,
        extrudedHeight:
          extrudedHeight !== undefined && Number.isFinite(extrudedHeight) ? extrudedHeight : undefined,
        cornerType,
        fillMaterial: new Cesium.ColorMaterialProperty(fillColor),
        showFill,
        outline,
        outlineColor,
        outlineWidth,
        style: td.styleSnapshot as RunwayStyleOptions | undefined,
      },
      false,
    )

    rebuildRunwayFill(rec)

    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  private applyStylePatchToTargetData(rec: RunwayRecord, p: UpdateRunwayProperties): void {
    const td = rec.targetData
    if (p.targetData !== undefined) {
      Object.assign(td, wrapPlainMutableRecord(p.targetData))
    }
    if (p.width !== undefined) td.width = p.width
    if (p.height !== undefined) td.height = p.height
    if (p.extrudedHeight !== undefined) td.extrudedHeight = p.extrudedHeight
    if (p.cornerType !== undefined) td.cornerType = parseCornerType(p.cornerType)
    if (p.color !== undefined) td.color = p.color instanceof Cesium.Color ? colorToCss(p.color) : p.color
    if (p.alpha !== undefined) td.alpha = p.alpha
    if (p.showFill !== undefined) td.showFill = p.showFill
    if (p.outline !== undefined) td.outline = p.outline
    if (p.outlineColor !== undefined) {
      td.outlineColor = p.outlineColor instanceof Cesium.Color ? colorToCss(p.outlineColor) : p.outlineColor
    }
    if (p.outlineAlpha !== undefined) td.outlineAlpha = p.outlineAlpha
    if (p.outlineWidth !== undefined) td.outlineWidth = p.outlineWidth
    if (p.materialMode !== undefined) td.materialMode = p.materialMode
    if (p.flowSpeed !== undefined) td.flowSpeed = p.flowSpeed
    if (p.flowBandStyle !== undefined) td.flowBandStyle = p.flowBandStyle
    if (p.flowBandCount !== undefined) {
      const n = Number(p.flowBandCount)
      if (Number.isFinite(n) && n >= 1) td.flowBandCount = Math.min(64, Math.floor(n))
    }
    if (p.flowStAxis !== undefined) td.flowStAxis = p.flowStAxis
    if (p.flowLengthFlip !== undefined) td.flowLengthFlip = p.flowLengthFlip
    if (p.flowImageUrl !== undefined) td.flowImageUrl = p.flowImageUrl
    if (p.style !== undefined) td.styleSnapshot = { ...(td.styleSnapshot as object), ...p.style }
  }

  private updateAreaDraft(rec: RunwayRecord, p: UpdateRunwayProperties, ellipsoid: Cesium.Ellipsoid): boolean {
    const td = rec.targetData
    markAreaDraftTargetData(td)
    this.applyStylePatchToTargetData(rec, p)

    if (p.positions !== undefined) {
      const line = lineToCartesian3Array(p.positions, ellipsoid)
      if (line) {
        setDraftPoints(rec, line)
        td.positions = lineToNumberTuples(p.positions)
      }
    } else if (p.longitude !== undefined && p.latitude !== undefined && p.endLongitude !== undefined && p.endLatitude !== undefined) {
      const h0 = p.height ?? 0
      const endH = p.endHeight ?? h0
      const line = [
        Cesium.Cartesian3.fromDegrees(Number(p.longitude), Number(p.latitude), h0, ellipsoid),
        Cesium.Cartesian3.fromDegrees(Number(p.endLongitude), Number(p.endLatitude), endH, ellipsoid),
      ]
      setDraftPoints(rec, line)
      td.positions = [
        [Number(p.longitude), Number(p.latitude), h0],
        [Number(p.endLongitude), Number(p.endLatitude), endH],
      ]
    }

    applyAreaDraftCorridor(rec)
    if (p.show !== undefined) rec.entity.show = p.show
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description)
    }
    return true
  }

  updateRunways(updates: Array<{ id: string } & UpdateRunwayProperties>): Array<{ id: string; success: boolean }> {
    return updates.map(({ id, ...rest }) => ({ id, success: this.updateRunway(id, rest) }))
  }

  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id)
    if (!rec) return undefined
    return { ...rec.targetData }
  }

  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = wrapPlainMutableRecord(targetData)
    return true
  }

  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.targetData = wrapPlainMutableRecord({
      ...wrapPlainMutableRecord(rec.targetData),
      ...wrapPlainMutableRecord(patch),
    })
    return true
  }

  getRunway(id: string): RunwaySnapshot | null {
    const rec = this.takeIfAlive(id)
    if (!rec || isAreaDraftTargetData(rec.targetData)) return null
    const cg = rec.entity.corridor
    const ellipsoid = rec.viewer.scene.globe.ellipsoid
    const posArr = cg ? sampleProperty<Cesium.Cartesian3[]>(cg.positions) : undefined
    let positions: number[][] = []
    if (posArr?.length === 2) {
      positions = cartesianPairToNumberTuples(posArr[0]!, posArr[1]!, ellipsoid)
    }
    if (positions.length === 0) {
      const fb = positionsFromTargetData(rec.targetData)
      if (fb.length === 2) positions = fb
    }
    if (positions.length !== 2) return null

    const p0 = Cesium.Cartesian3.fromDegrees(
      positions[0]![0],
      positions[0]![1],
      positions[0]![2] ?? 0,
      ellipsoid,
    )
    const p1 = Cesium.Cartesian3.fromDegrees(
      positions[1]![0],
      positions[1]![1],
      positions[1]![2] ?? 0,
      ellipsoid,
    )
    const mid = midpointLongitudeLatitudeHeight(p0, p1, ellipsoid)

    const outline = cg ? sampleProperty<boolean>(cg.outline) : undefined
    const outlineColor = cg ? sampleProperty<Color>(cg.outlineColor) : undefined
    const outlineWidth = cg ? sampleProperty<number>(cg.outlineWidth) : undefined
    const width = cg ? sampleProperty<number>(cg.width) : undefined
    const extruded = cg ? sampleProperty<number>(cg.extrudedHeight) : undefined
    const cornerTypeSampled = cg ? sampleProperty<Cesium.CornerType>(cg.cornerType) : undefined
    const cornerKey = cornerTypeSnapshotFromRecord(cornerTypeSampled, rec.targetData)
    const desc = sampleProperty<string>(rec.entity.description)
    const td = rec.targetData
    const rawShowFill = td.showFill

    const mode: RunwayMaterialMode =
      td.materialMode === 'flowImage' || td.materialMode === 'flowColor' ? td.materialMode : 'flowColor'
    const flowSpeed = typeof td.flowSpeed === 'number' && Number.isFinite(td.flowSpeed) ? td.flowSpeed : 0.8
    const flowImageUrl = typeof td.flowImageUrl === 'string' ? td.flowImageUrl : undefined

    let colorCss: string | undefined
    if (rec.flowMaterial?.uniforms?.u_color !== undefined) {
      colorCss = colorToCss(rec.flowMaterial.uniforms.u_color as Color)
    } else {
      const fillCol = cg ? readCorridorFillColor(cg) : undefined
      colorCss = colorToCss(fillCol) ?? (typeof td.color === 'string' ? td.color : undefined)
    }

    return {
      id: rec.entity.id,
      positions: positions.map((r) => [...r]),
      vertexCount: 2,
      longitude: mid.lon,
      latitude: mid.lat,
      height: typeof td.heightMid === 'number' ? td.heightMid : mid.h,
      width: typeof width === 'number' ? width : Number(td.width) || 0,
      extrudedHeight: typeof extruded === 'number' && Number.isFinite(extruded) ? extruded : Number(td.extrudedHeight) || 0,
      cornerType: cornerKey,
      materialMode: mode,
      flowSpeed,
      flowBandStyle: readFlowBandStyle(td),
      flowBandCount: readFlowBandCount(td),
      flowStAxis: readFlowStAxisY(td) === 1 ? 'y' : 'x',
      flowLengthFlip: readFlowLengthFlip(td) !== 0,
      flowImageUrl,
      colorCss,
      showFill: typeof rawShowFill === 'boolean' ? rawShowFill : true,
      outline,
      outlineColorCss: colorToCss(outlineColor),
      outlineWidth,
      show: rec.entity.show,
      targetData: { ...td },
      description: desc,
    }
  }

  getAllRunways(viewer?: Viewer): RunwaySnapshot[] {
    const out: RunwaySnapshot[] = []
    for (const id of this.getIds(viewer)) {
      const s = this.getRunway(id)
      if (s) out.push(s)
    }
    return out
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length
  }

  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer)
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, r] of this.data) {
      if (!this.isRecordAlive(r)) continue
      if (viewer !== undefined && r.viewer !== viewer) continue
      r.entity.show = show
    }
  }

  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show)
  }

  removeAll(viewer?: Viewer): void {
    this.clear(viewer)
  }

  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity
  }

  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined
  }

  getIds(viewer?: Viewer): string[] {
    const out: string[] = []
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue
      if (viewer !== undefined && rec.viewer !== viewer) continue
      out.push(id)
    }
    return out
  }

  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id)
    if (!rec) return false
    rec.entity.show = visible
    return true
  }

  remove(id: string): boolean {
    const rec = this.data.get(id)
    if (!rec) return false
    detachFlow(rec)
    this.data.delete(id)
    if (!rec.viewer.isDestroyed() && rec.viewer.entities.contains(rec.entity)) {
      rec.viewer.entities.remove(rec.entity)
    }
    return true
  }

  clear(viewer?: Viewer): void {
    const toRemove: string[] = []
    for (const [id, rec] of this.data) {
      if (viewer !== undefined && rec.viewer !== viewer) continue
      toRemove.push(id)
    }
    for (const id of toRemove) this.remove(id)
  }

  pruneInvalid(): number {
    let n = 0
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) {
        detachFlow(rec)
        this.data.delete(id)
        n += 1
      }
    }
    return n
  }

  destroy(): void {
    this.clear()
  }
}

function midpointLongitudeLatitudeHeight(
  p0: Cesium.Cartesian3,
  p1: Cesium.Cartesian3,
  ellipsoid: Cesium.Ellipsoid,
): { lon: number; lat: number; h: number } {
  Cesium.Cartesian3.midpoint(p0, p1, scratchMid)
  const c = Cesium.Cartographic.fromCartesian(scratchMid, ellipsoid, scratchCarto)
  return {
    lon: Cesium.Math.toDegrees(c.longitude),
    lat: Cesium.Math.toDegrees(c.latitude),
    h: c.height,
  }
}
