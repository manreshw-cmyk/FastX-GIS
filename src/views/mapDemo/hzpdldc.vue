<script setup lang="ts">
import { keepAlternateDemoEntry } from './common/keepAlternateDemoEntry'
import { ClearOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type {
  AreaDrawStartParams,
  LngLatHeight,
  MouseEventListenOptions,
  MouseEventPickPayload,
  RunwayFlowBandStyle,
  RunwayMaterialMode,
  RunwaySnapshot,
} from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './common/drawFormColor'
import { waitForMapViewer } from './common/useCoordinateDemo'

const title = '绘制（Runway）跑道类（底层entity）'

const DEFAULT_FILL_COLOR = '#00aaff'
const DEFAULT_OUTLINE_COLOR = '#e8ecf2'

const mapStore = useMapLayerStore()

let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const selectedId = ref<string | null>(null)

/** 地图拾取：依次拾取起点、终点写入点列表（与廊道「地图追加顶点」同类交互） */
const runwayPickArmed = ref(false)
/** 0 待拾取起点，1 已拾取起点待拾取终点 */
const runwayPickPhase = ref(0)

interface RunwayPointRow {
  key: string
  label: string
  longitude: number | null
  latitude: number | null
  height: number | null
}

function createEmptyRunwayPoints(): RunwayPointRow[] {
  return [
    { key: 'p0', label: '起点', longitude: null, latitude: null, height: null },
    { key: 'p1', label: '终点', longitude: null, latitude: null, height: null },
  ]
}

const runwayPoints = ref<RunwayPointRow[]>(createEmptyRunwayPoints())
const runwayPointShellRef = ref<HTMLElement | null>(null)
const runwayPointScrollY = ref(96)
let runwayPointResizeObserver: ResizeObserver | null = null

const form = reactive({
  id: '',
  /** 廊道总宽（米），示例默认 5000 */
  width: 5000,
  /** 流动色 / 流动贴图 */
  materialMode: 'flowColor' as RunwayMaterialMode,
  flowSpeed: 0.8,
  /** 沿长度：单条亮带或多条条纹 */
  flowBandStyle: 'multi' as RunwayFlowBandStyle,
  /** multi 时沿长度重复条数，1～64 */
  flowBandCount: 8,
  flowImageUrl: '',
  showFill: true,
  color: DEFAULT_FILL_COLOR,
  alpha: 0.85,
  outline: true,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineAlpha: 1,
  outlineWidth: 2,
  show: true,
})

const materialModeOptions = [
  { value: 'flowColor' as const, label: '流动颜色' },
  { value: 'flowImage' as const, label: '流动贴图' },
]

const flowBandStyleOptions = [
  { value: 'single' as const, label: '单条流动' },
  { value: 'multi' as const, label: '多条条纹' },
]

const tableData = ref<RunwaySnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

const runwayPointColumns: TableColumnType<RunwayPointRow>[] = [
  { title: '', dataIndex: 'label', key: 'label', width: 56, align: 'center' },
  { title: '经度(°)', key: 'longitude', width: 108, align: 'center' },
  { title: '纬度(°)', key: 'latitude', width: 108, align: 'center' },
  { title: '高(m)', key: 'height', width: 80, align: 'center' },
]

function updateRunwayPointScrollY(): void {
  const shell = runwayPointShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 28
  runwayPointScrollY.value = Math.max(56, Math.floor(shell.clientHeight - headH - 4))
}

function disarmRunwayPick(): void {
  runwayPickArmed.value = false
  runwayPickPhase.value = 0
}

function clearRunwayPoints(): void {
  runwayPoints.value = createEmptyRunwayPoints()
  disarmRunwayPick()
  message.info('已清空点列表')
}

function hasCompleteRunwayEndpoints(): boolean {
  const a = runwayPoints.value[0]!
  const b = runwayPoints.value[1]!
  return (
    a.longitude != null &&
    a.latitude != null &&
    b.longitude != null &&
    b.latitude != null &&
    Number.isFinite(a.longitude) &&
    Number.isFinite(a.latitude) &&
    Number.isFinite(b.longitude) &&
    Number.isFinite(b.latitude)
  )
}

function runwayEndpointsAreDistinct(): boolean {
  if (!hasCompleteRunwayEndpoints()) return false
  const a = runwayPoints.value[0]!
  const b = runwayPoints.value[1]!
  const eps = 1e-8
  return (
    Math.abs(a.longitude! - b.longitude!) > eps ||
    Math.abs(a.latitude! - b.latitude!) > eps ||
    Math.abs((a.height ?? 0) - (b.height ?? 0)) > 1e-3
  )
}

function toggleRunwayPick(): void {
  if (runwayPickArmed.value) {
    disarmRunwayPick()
    message.info('已取消地图拾取')
    return
  }
  if (selectedId.value) {
    message.warning('请先取消选中跑道')
    return
  }
  runwayPickArmed.value = true
  runwayPickPhase.value = 0
  runwayPoints.value = createEmptyRunwayPoints()
  message.info('请在地图上依次左键点击起点、终点，拾取完成后点击「标绘」创建跑道')
}

type MapMouseBinder = {
  listen: (options: MouseEventListenOptions) => void
  destroy: () => void
}

let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

function syncRunwayFromAnchors(points: LngLatHeight[]): void {
  const rows = runwayPoints.value
  if (points.length >= 1) {
    const r0 = rows[0]!
    runwayPoints.value = [
      {
        ...r0,
        longitude: points[0]!.longitude,
        latitude: points[0]!.latitude,
        height: points[0]!.height ?? 0,
      },
      rows[1]!,
    ]
  }
  if (points.length >= 2) {
    const r1 = runwayPoints.value[1]!
    runwayPoints.value = [
      runwayPoints.value[0]!,
      {
        ...r1,
        longitude: points[1]!.longitude,
        latitude: points[1]!.latitude,
        height: points[1]!.height ?? 0,
      },
    ]
  }
}

function buildRunwayStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'runway',
    id: form.id.trim() || undefined,
    ...runwayStylePayload(),
    preview: {
      anchorPointColor: '#00aaff',
      cursorPointColor: '#00aaff',
      lineColor: form.color,
      fillColor: form.color,
      fillAlpha: form.alpha,
      outlineColor: form.outlineColor,
      outlineWidth: form.outlineWidth,
    },
    onAnchorChange: (points) => {
      syncRunwayFromAnchors(points)
      if (points.length === 0) isAreaDrawing.value = false
    },
  }
}

function stopAreaDraw(): void {
  am?.cancel()
  isAreaDrawing.value = false
}

function setupAreaManagerPublish(): void {
  if (!am) return
  am.publish((result) => {
    if (result.shapeType !== 'runway') return
    stopAreaDraw()
    message.success('已添加跑道')
    refreshTable()
    resetFormToInitial()
  })
}

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 40
  const next = Math.floor(shell.clientHeight - headH - 6)
  tableScrollY.value = Math.max(72, next)
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  const R = window.FastX?.Runway
  if (!v || v.isDestroyed() || !R) {
    tableData.value = []
    return
  }
  tableData.value = R.getAllRunways(v)
  void nextTick(() => {
    updateTableScrollY()
    updateRunwayPointScrollY()
  })
}

function runwayPointsFromSnapshot(s: RunwaySnapshot): RunwayPointRow[] {
  if (Array.isArray(s.positions) && s.positions.length === 2) {
    const a = s.positions[0]!
    const b = s.positions[1]!
    return [
      { key: 'p0', label: '起点', longitude: a[0]!, latitude: a[1]!, height: a[2] ?? 0 },
      { key: 'p1', label: '终点', longitude: b[0]!, latitude: b[1]!, height: b[2] ?? 0 },
    ]
  }
  const td0 = s.targetData
  if (
    typeof td0.startLongitude === 'number' &&
    typeof td0.startLatitude === 'number' &&
    typeof td0.endLongitude === 'number' &&
    typeof td0.endLatitude === 'number'
  ) {
    const h = typeof s.height === 'number' ? s.height : 0
    return [
      {
        key: 'p0',
        label: '起点',
        longitude: td0.startLongitude,
        latitude: td0.startLatitude,
        height: typeof td0.startHeight === 'number' ? td0.startHeight : h,
      },
      {
        key: 'p1',
        label: '终点',
        longitude: td0.endLongitude,
        latitude: td0.endLatitude,
        height: typeof td0.endHeight === 'number' ? td0.endHeight : h,
      },
    ]
  }
  return [
    { key: 'p0', label: '中心', longitude: s.longitude, latitude: s.latitude, height: s.height },
    { key: 'p1', label: '中心', longitude: s.longitude, latitude: s.latitude, height: s.height },
  ]
}

function fillFormFromSnapshot(s: RunwaySnapshot): void {
  form.id = s.id
  form.width = s.width
  runwayPoints.value = runwayPointsFromSnapshot(s)
  void nextTick(() => updateRunwayPointScrollY())
  form.materialMode = s.materialMode === 'flowImage' ? 'flowImage' : 'flowColor'
  form.flowSpeed = typeof s.flowSpeed === 'number' && Number.isFinite(s.flowSpeed) ? s.flowSpeed : 0.8
  form.flowBandStyle = s.flowBandStyle === 'single' ? 'single' : 'multi'
  {
    const n = Number(s.flowBandCount)
    form.flowBandCount =
      Number.isFinite(n) && n >= 1 ? Math.min(64, Math.floor(n)) : 8
  }
  const img = s.flowImageUrl ?? (typeof s.targetData?.flowImageUrl === 'string' ? s.targetData.flowImageUrl : '')
  form.flowImageUrl = img
  const td = s.targetData
  const rawShowFill = td?.showFill
  form.showFill = typeof rawShowFill === 'boolean' ? rawShowFill : s.showFill !== false
  const fillCss =
    s.colorCss ??
    (typeof td.color === 'string' && td.color.trim() ? String(td.color) : undefined)
  const fillP = parseCssColorForForm(fillCss, DEFAULT_FILL_COLOR)
  form.color = fillP.hex
  const tdA = typeof td.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined
  form.alpha = tdA ?? fillP.alpha
  form.outline = s.outline !== false
  const outCss =
    s.outlineColorCss ??
    (typeof td.outlineColor === 'string' && td.outlineColor.trim()
      ? String(td.outlineColor)
      : undefined)
  const outP = parseCssColorForForm(outCss, DEFAULT_OUTLINE_COLOR)
  form.outlineColor = outP.hex
  const tdOA =
    typeof td.outlineAlpha === 'number' && Number.isFinite(td.outlineAlpha) ? td.outlineAlpha : undefined
  form.outlineAlpha = tdOA ?? outP.alpha
  form.outlineWidth = s.outlineWidth ?? 2
  form.show = s.show
}

function fillAlphaForApi(): number {
  return form.showFill ? form.alpha : 0
}

function resetFormToInitial(): void {
  disarmRunwayPick()
  form.id = ''
  runwayPoints.value = createEmptyRunwayPoints()
  form.width = 5000
  form.materialMode = 'flowColor'
  form.flowSpeed = 0.8
  form.flowBandStyle = 'multi'
  form.flowBandCount = 8
  form.flowImageUrl = ''
  form.showFill = true
  form.color = DEFAULT_FILL_COLOR
  form.alpha = 0.85
  form.outline = true
  form.outlineColor = DEFAULT_OUTLINE_COLOR
  form.outlineAlpha = 1
  form.outlineWidth = 2
  form.show = true
}

function onCancelSelect(): void {
  selectedId.value = null
  disarmRunwayPick()
  stopAreaDraw()
  resetFormToInitial()
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const fb = field === 'color' ? DEFAULT_FILL_COLOR : DEFAULT_OUTLINE_COLOR
  const hex = normalizeHex(el.value, fb)
  if (field === 'color') form.color = hex
  else form.outlineColor = hex
}

function onRowClick(record: RunwaySnapshot): void {
  stopAreaDraw()
  disarmRunwayPick()
  selectedId.value = record.id
  const snap = window.FastX?.Runway?.getRunway(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Runway?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    stopAreaDraw()
    disarmRunwayPick()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryRunwayText = computed(() =>
  selectedId.value ? '确定' : isAreaDrawing.value ? '完成标绘' : '绘制',
)

/** 与 Runway.add / update 共用的样式与流动参数（起终点由 positions 单独传） */
function runwayStylePayload() {
  return {
    width: form.width,
    showFill: form.showFill,
    materialMode: form.materialMode,
    flowSpeed: form.flowSpeed,
    flowBandStyle: form.flowBandStyle,
    flowBandCount: form.flowBandCount,
    flowImageUrl: form.materialMode === 'flowImage' ? form.flowImageUrl.trim() || undefined : undefined,
    color: form.color,
    alpha: fillAlphaForApi(),
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outlineWidth,
    show: form.show,
    targetData: {
      showFill: form.showFill,
      materialMode: form.materialMode,
      flowSpeed: form.flowSpeed,
      flowBandStyle: form.flowBandStyle,
      flowBandCount: form.flowBandCount,
      flowImageUrl: form.materialMode === 'flowImage' ? form.flowImageUrl.trim() || undefined : undefined,
      color: form.color,
      alpha: form.alpha,
    },
  }
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const R = window.FastX?.Runway
  const v = mapStore.getViewer()
  if (!id || !R || !v || v.isDestroyed()) return
  const p0 = runwayPoints.value[0]!
  const p1 = runwayPoints.value[1]!
  if (
    p0.longitude == null ||
    p0.latitude == null ||
    p1.longitude == null ||
    p1.latitude == null
  ) {
    message.warning('请补全点列表中的起点、终点坐标')
    return
  }
  if (!runwayEndpointsAreDistinct()) {
    message.warning('起点与终点不能重合，请拉开距离后再保存')
    return
  }

  const twoPositions: [[number, number, number], [number, number, number]] = [
    [p0.longitude!, p0.latitude!, p0.height ?? 0],
    [p1.longitude!, p1.latitude!, p1.height ?? 0],
  ]

  const ok = R.updateRunway(id, {
    ...runwayStylePayload(),
    positions: twoPositions,
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败，请确认该跑道仍存在')
  }
}

function onRunwayPrimary(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }

  am = window.FastX?.AreaManager
  if (!am) {
    message.error('FastX.AreaManager 未就绪')
    return
  }

  // --- 空域管理：鼠标绘制 start / end ---
  if (isAreaDrawing.value) {
    if (am.pointCount < 2) {
      message.warning('至少需要 2 个点（起点 + 终点）')
      return
    }
    am.end()
    isAreaDrawing.value = false
    return
  }

  const v = mapStore.getViewer()
  if (!v || v.isDestroyed()) {
    message.error('地图未就绪')
    return
  }
  runwayPoints.value = createEmptyRunwayPoints()
  const ok = am.start(v, buildRunwayStartParams())
  if (!ok) {
    message.error('无法开始跑道绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')

  // --- Runway 单类 add（不用空域管理时注释上一段，改用下方）---
  // addRunwayFromForm()
}

function addRunwayFromForm(): void {
  if (!hasCompleteRunwayEndpoints()) {
    message.warning('请通过地图拾取或手填完整的起点、终点坐标')
    return
  }
  if (!runwayEndpointsAreDistinct()) {
    message.warning('起点与终点不能重合，请拉开距离后再标绘')
    return
  }
  if (form.materialMode === 'flowImage' && !form.flowImageUrl.trim()) {
    message.warning('流动贴图模式下请先上传本地图片')
    return
  }
  const R = window.FastX?.Runway
  const v = mapStore.getViewer()
  if (!R || !v || v.isDestroyed()) return

  stopAreaDraw()
  const p0 = runwayPoints.value[0]!
  const p1 = runwayPoints.value[1]!
  const idOpt = form.id.trim() || undefined
  const entity = R.add(v, {
    id: idOpt,
    positions: [
      [p0.longitude!, p0.latitude!, p0.height ?? 0],
      [p1.longitude!, p1.latitude!, p1.height ?? 0],
    ],
    ...runwayStylePayload(),
  })

  if (!entity) {
    message.error('添加失败：请拉大两点距离、检查贴图地址或 id 是否重复')
    return
  }
  message.success('已添加跑道')
  refreshTable()
  resetFormToInitial()
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!runwayPickArmed.value || selectedId.value) return
  if (!Number.isFinite(pick.longitude) || !Number.isFinite(pick.latitude)) {
    message.warning('未能拾取到有效坐标，请点在地球可见区域后重试')
    return
  }
  const h = Number.isFinite(pick.height) ? pick.height : 0
  const rows = runwayPoints.value
  if (runwayPickPhase.value === 0) {
    const r0 = rows[0]!
    runwayPoints.value = [
      { ...r0, longitude: pick.longitude, latitude: pick.latitude, height: h },
      { ...rows[1]! },
    ]
    runwayPickPhase.value = 1
    message.success('已拾取起点，请点击终点')
    return
  }
  const r1 = rows[1]!
  runwayPoints.value = [
    { ...rows[0]! },
    { ...r1, longitude: pick.longitude, latitude: pick.latitude, height: h },
  ]
  runwayPickPhase.value = 0
  runwayPickArmed.value = false
  message.success('已拾取起点与终点，请点击「标绘」创建跑道')
}

function onFlowImageFile(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.type.startsWith('image/')) {
    message.warning('请选择图片文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = typeof reader.result === 'string' ? reader.result : ''
    if (!dataUrl) {
      message.error('读取图片失败')
      return
    }
    form.flowImageUrl = dataUrl
    message.success('已载入本地贴图')
  }
  reader.onerror = () => message.error('读取图片失败')
  reader.readAsDataURL(file)
  input.value = ''
}

function bindMouse(v: Viewer): void {
  const Ctor = window.FastX?.MouseEvent as (new (viewer: Viewer) => MapMouseBinder) | undefined
  if (!Ctor) {
    message.error('window.FastX.MouseEvent 未就绪')
    return
  }
  mouseBinder?.destroy()
  const binder = new Ctor(v)
  binder.listen({
    onLeftClick: (pick: MouseEventPickPayload) => onMapLeftClick(pick),
  })
  mouseBinder = binder
}

function fmtLonLat(v: unknown, digits: number): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—'
}

/** 列表用：起终点大圆距离 + 高差 */
function approxRunwayLengthMeters(p0: number[] | undefined, p1: number[] | undefined): number | null {
  if (!p0 || !p1 || p0.length < 2 || p1.length < 2) return null
  const lon0 = Number(p0[0])
  const lat0 = Number(p0[1])
  const lon1 = Number(p1[0])
  const lat1 = Number(p1[1])
  if (![lon0, lat0, lon1, lat1].every(Number.isFinite)) return null
  const Rm = 6371008.8
  const r0 = (lat0 * Math.PI) / 180
  const r1 = (lat1 * Math.PI) / 180
  const dφ = ((lat1 - lat0) * Math.PI) / 180
  const dλ = ((lon1 - lon0) * Math.PI) / 180
  const h =
    Math.sin(dφ / 2) ** 2 + Math.cos(r0) * Math.cos(r1) * Math.sin(dλ / 2) ** 2
  const horiz = 2 * Rm * Math.asin(Math.min(1, Math.sqrt(h)))
  const z0 = p0.length > 2 && Number.isFinite(Number(p0[2])) ? Number(p0[2]) : 0
  const z1 = p1.length > 2 && Number.isFinite(Number(p1[2])) ? Number(p1[2]) : 0
  return Math.hypot(horiz, z0 - z1)
}

function colLon(
  title: string,
  key: string,
  pi: 0 | 1,
  ci: 0 | 1,
  w: number,
): TableColumnType<RunwaySnapshot> {
  return {
    title,
    key,
    width: w,
    align: 'center',
    customRender: ({ record }) => fmtLonLat(record.positions?.[pi]?.[ci], 4),
  }
}

const columns: TableColumnType<RunwaySnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 112, align: 'center' },
  colLon('起点经度', 'sLon', 0, 0, 92),
  colLon('起点纬度', 'sLat', 0, 1, 92),
  colLon('终点经度', 'eLon', 1, 0, 92),
  colLon('终点纬度', 'eLat', 1, 1, 92),
  {
    title: '长度(m)',
    key: 'length',
    width: 80,
    align: 'center',
    customRender: ({ record }) => {
      const m = approxRunwayLengthMeters(record.positions?.[0], record.positions?.[1])
      return m != null && Number.isFinite(m) ? Math.round(m) : '—'
    },
  },
  { title: '操作', key: 'action', width: 52, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: RunwaySnapshot): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: RunwaySnapshot) {
  return {
    onClick: () => onRowClick(record),
  }
}

onMounted(async () => {
  const v = await waitForMapViewer()
  if (!v) {
    message.warning('地图未能在预期时间内就绪')
    return
  }
  viewerRef = v
  am = window.FastX?.AreaManager
  setupAreaManagerPublish()
  refreshTable()
  // bindMouse(v)
  await nextTick()
  updateTableScrollY()
  updateRunwayPointScrollY()
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) {
    tableResizeObserver.observe(tableShellRef.value)
  }
  runwayPointResizeObserver = new ResizeObserver(() => updateRunwayPointScrollY())
  if (runwayPointShellRef.value) {
    runwayPointResizeObserver.observe(runwayPointShellRef.value)
  }
})

onBeforeUnmount(() => {
  runwayPointResizeObserver?.disconnect()
  runwayPointResizeObserver = null
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  am?.cancel()
  am?.unpublish()
  isAreaDrawing.value = false
  mouseBinder?.destroy()
  mouseBinder = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.FastX?.Runway?.clear(v)
  }
})
keepAlternateDemoEntry(toggleRunwayPick, addRunwayFromForm, bindMouse)
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">跑道 ID</span>
                  <div class="hzd-field-control">
                    <a-input
                      v-model:value="form.id"
                      class="hzd-control-fill"
                      size="small"
                      allow-clear
                      placeholder="可选，留空自动生成"
                    />
                  </div>
                </div>
                <div class="hzd-field-row hzd-field-row--block">
                  <span class="hzd-field-label">点列表</span>
                  <div class="hzd-field-control hzd-field-control--stack">
                    <div class="hzd-vertex-toolbar">
                      <span class="hzd-muted">起点、终点；地图拾取或手填后点「标绘」</span>
                      <a-tooltip title="全部清除并重置为默认坐标">
                        <a-button type="text" size="small" class="hzd-clear-ring-btn" aria-label="清空点列表" @click="clearRunwayPoints">
                          <template #icon><ClearOutlined /></template>
                        </a-button>
                      </a-tooltip>
                    </div>
                    <div ref="runwayPointShellRef" class="hzd-vertex-table-wrap hzd-scroll-skin">
                      <a-table
                        class="hzd-table hzd-table--compact"
                        :columns="runwayPointColumns"
                        :data-source="runwayPoints"
                        :pagination="false"
                        row-key="key"
                        size="small"
                        :scroll="{ y: runwayPointScrollY }"
                      >
                        <template #bodyCell="{ column, index }">
                          <template v-if="column.key === 'longitude'">
                            <a-input-number
                              v-model:value="runwayPoints[index].longitude"
                              class="hzd-cell-inp"
                              size="small"
                              :step="0.0001"
                              :controls="true"
                            />
                          </template>
                          <template v-else-if="column.key === 'latitude'">
                            <a-input-number
                              v-model:value="runwayPoints[index].latitude"
                              class="hzd-cell-inp"
                              size="small"
                              :step="0.0001"
                              :controls="true"
                            />
                          </template>
                          <template v-else-if="column.key === 'height'">
                            <a-input-number
                              v-model:value="runwayPoints[index].height"
                              class="hzd-cell-inp"
                              size="small"
                              :step="1"
                              :controls="true"
                            />
                          </template>
                        </template>
                      </a-table>
                    </div>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">宽度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.width" class="hzd-control-fill" size="small" :min="1" :step="10" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">面材质</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.materialMode"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="materialModeOptions"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">流动速度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.flowSpeed" :min="0" :max="2" :step="0.02" class="hzd-slider-fill" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">流动形态</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.flowBandStyle"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="flowBandStyleOptions"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>
                <div v-if="form.flowBandStyle === 'multi'" class="hzd-field-row">
                  <span class="hzd-field-label">条纹条数</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.flowBandCount"
                      class="hzd-control-fill"
                      size="small"
                      :min="1"
                      :max="64"
                      :step="1"
                    />
                  </div>
                </div>
                <template v-if="form.materialMode === 'flowImage'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">上传贴图</span>
                    <div class="hzd-field-control hzd-field-control--file">
                      <label class="hzd-file-btn">
                        <span>选择图片</span>
                        <input type="file" class="hzd-file-hit" accept="image/*" @change="onFlowImageFile" />
                      </label>
                    </div>
                  </div>
                </template>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示面填充</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.showFill" size="small" />
                  </div>
                </div>

                <template v-if="form.materialMode === 'flowColor'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">流动主色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                        <input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick('color', $event)" />
                      </label>
                    </div>
                  </div>
                </template>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">{{ form.materialMode === 'flowImage' ? '贴图透明度' : '填充透明度' }}</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示轮廓线</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.outline" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.outlineColor }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="form.outlineColor"
                        @input="onColorPick('outlineColor', $event)"
                      />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.outlineAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓宽度</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.outlineWidth" class="hzd-control-fill" size="small" :min="0" :max="20" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <div class="hzd-actions-primary-row">
                      <a-button
                        type="primary"
                        block
                        class="map-tool-primary-btn hzd-primary-tall hzd-primary-flex"
                        @click="onRunwayPrimary"
                      >
                        {{ primaryRunwayText }}
                      </a-button>
                    </div>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">
                      取消选中
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">跑道列表</div>
            <div ref="tableShellRef" class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll">
              <a-table
                class="hzd-table"
                :columns="columns"
                :data-source="tableData"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ x: 640, y: tableScrollY }"
                :row-class-name="tableRowClassName"
                :custom-row="customTableRow"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'action'">
                    <a-tooltip title="删除">
                      <a-button
                        type="text"
                        danger
                        size="small"
                        class="hzd-del-btn"
                        aria-label="删除"
                        @click="onDeleteRow(record.id, $event)"
                      >
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </template>
                </template>
              </a-table>
            </div>
          </section>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.map-tool-float--hzd-point :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-tool-float--hzd-point :deep(.x-dialog-inner) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 10px;
}

.hzd-dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hzd-dialog-body > .map-tool-head {
  flex-shrink: 0;
}

.hzd-page-title {
  margin-bottom: 8px;
}

.hzd-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
}

.hzd-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.hzd-pane--form {
  flex: 0 1 auto;
  max-height: min(54vh, 540px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
}

.hzd-pane--table {
  flex: 1 1 0;
  min-height: 100px;
}

.hzd-pane--table .hzd-pane-title {
  margin-bottom: 6px;
}

.hzd-pane-title {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}

.hzd-pane-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 12px;
  margin-right: 0;
  box-sizing: border-box;
}

.hzd-scroll-skin {
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-scroll-skin::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.hzd-scroll-skin::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
}

.hzd-scroll-skin::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-scroll-skin::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
}

.hzd-form-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}

.hzd-field-row {
  display: grid;
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr);
  column-gap: 14px;
  align-items: center;
  min-height: 32px;
}

.hzd-field-row--block {
  align-items: flex-start;
}

.hzd-field-row--block .hzd-field-label {
  padding-top: 4px;
}

.hzd-field-row--block .hzd-field-control--stack {
  width: 100%;
  align-items: stretch;
}

.hzd-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.35;
}

.hzd-vertex-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.hzd-clear-ring-btn {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.65) !important;
}

.hzd-clear-ring-btn:hover {
  color: rgba(180, 220, 255, 0.95) !important;
  background: rgba(255, 255, 255, 0.06) !important;
}

.hzd-vertex-table-wrap {
  width: 100%;
  max-height: 140px;
  min-height: 72px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.18);
}

.hzd-cell-inp {
  width: 100% !important;
  min-width: 0;
}

.hzd-cell-inp :deep(.ant-input-number) {
  width: 100% !important;
}

.hzd-table--compact :deep(.ant-table-thead > tr > th) {
  padding: 6px 4px !important;
  font-size: 11px;
}

.hzd-table--compact :deep(.ant-table-tbody > tr > td) {
  padding: 5px 4px !important;
  font-size: 11px;
}

.hzd-field-row--actions {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 0;
  grid-template-columns: 1fr;
}

.hzd-field-row--actions .hzd-actions-col {
  grid-column: 1 / -1;
  width: 100%;
}

.hzd-field-label {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hzd-field-control {
  min-width: 0;
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.hzd-field-control--slider {
  justify-content: flex-end;
}

.hzd-field-control--stack {
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.hzd-field-control--stack .hzd-control-fill {
  width: 100% !important;
}

.hzd-field-control--file {
  justify-content: flex-end;
}

.hzd-file-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(120, 180, 255, 0.45);
  background: rgba(30, 60, 95, 0.55);
  color: rgba(230, 242, 255, 0.92);
  cursor: pointer;
  width: 80%;
  max-width: 100%;
}

.hzd-file-btn:hover {
  border-color: rgba(160, 210, 255, 0.75);
  background: rgba(45, 85, 130, 0.65);
}

.hzd-file-hit {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.hzd-field-control .hzd-control-fill {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input-number) {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input-affix-wrapper) {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input) {
  width: 100%;
}

.hzd-field-control :deep(.ant-select) {
  width: 80% !important;
  max-width: 100%;
  overflow: visible;
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select-selector) {
  height: 24px !important;
  min-height: 24px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  padding-inline-end: 28px !important;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select-arrow),
.hzd-field-control .hzd-select-like-input :deep(.ant-select-suffix) {
  opacity: 1 !important;
  color: rgba(255, 255, 255, 0.78) !important;
  inset-inline-end: 8px !important;
}

.hzd-field-control .hzd-select-like-input :deep(.anticon) {
  opacity: 1 !important;
  color: rgba(255, 255, 255, 0.78) !important;
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select-selection-item),
.hzd-field-control .hzd-select-like-input :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
  color: rgba(255, 255, 255, 0.88);
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select:not(.ant-select-disabled):hover .ant-select-selector),
.hzd-field-control .hzd-select-like-input :deep(.ant-select-focused .ant-select-selector) {
  border-color: rgba(120, 180, 255, 0.45) !important;
}

.hzd-color-native {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 80%;
  max-width: 100%;
  min-height: 32px;
  cursor: pointer;
  position: relative;
  padding: 2px 0;
}

.hzd-color-hit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.hzd-color-native:focus-within .hzd-swatch {
  outline: 2px solid rgba(120, 190, 255, 0.65);
  outline-offset: 2px;
}

.hzd-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2) inset;
  background: rgba(255, 255, 255, 0.06);
}

.hzd-slider-fill {
  flex: 0 0 auto;
  width: 80%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
}

.hzd-actions-col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.hzd-actions-primary-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
  width: 100%;
}

.hzd-pick-coord-btn {
  flex: 0 0 40px;
  width: 40px !important;
  min-width: 40px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
}

.hzd-primary-flex {
  flex: 1 1 0;
  min-width: 0;
}

.hzd-primary-tall {
  min-height: 35px !important;
  height: 35px !important;
  padding: 0 14px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}

.hzd-cancel-select {
  color: rgba(255, 255, 255, 0.55) !important;
  align-self: center;
  padding: 0 4px !important;
  height: auto !important;
}

.hzd-cancel-select:hover {
  color: rgba(180, 220, 255, 0.95) !important;
}

.hzd-del-btn {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  color: rgba(255, 130, 130, 0.95) !important;
}

.hzd-del-btn:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.hzd-table :deep(.ant-table-thead > tr > th),
.hzd-table :deep(.ant-table-tbody > tr > td) {
  text-align: center !important;
}

.hzd-table :deep(.ant-table-thead > tr > th) {
  padding: 8px 6px !important;
}

.hzd-table :deep(.ant-table-tbody > tr > td) {
  padding: 7px 6px !important;
}

.hzd-table-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hzd-table-area--scroll :deep(.ant-table-wrapper),
.hzd-table-area--scroll :deep(.ant-spin-nested-loading),
.hzd-table-area--scroll :deep(.ant-spin-container),
.hzd-table-area--scroll :deep(.ant-table),
.hzd-table-area--scroll :deep(.ant-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.hzd-table-area--scroll :deep(.ant-table-container) {
  overflow: hidden;
}

.hzd-table-area--scroll :deep(.ant-table-body) {
  flex: 1;
  overflow: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
}
</style>
