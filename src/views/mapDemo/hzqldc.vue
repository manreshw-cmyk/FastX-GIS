<script setup lang="ts">
import { keepAlternateDemoEntry } from './common/keepAlternateDemoEntry'
import { ClearOutlined, DeleteOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import * as Cesium from 'cesium'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type {
  AddWallOptions,
  AreaDrawStartParams,
  ColorStop,
  LngLatHeight,
  MaterialType,
  UpdateWallProperties,
  WallSnapshot,
} from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './common/drawFormColor'
import { bindAreaManagerPublish } from './common/useAreaManagerPublish'
import { waitForMapViewer } from './common/useCoordinateDemo'

const title = '绘制（Wall）墙类（底层entity）'

const DEFAULT_SOLID = '#2b8cbe'
const DEFAULT_GRAD_A = '#1890ff'
const DEFAULT_GRAD_B = '#722ed1'
const DEFAULT_OUTLINE = '#ffffff'
const DEFAULT_MULTI_JSON = `[{"position":0,"color":"#ff4d4f","alpha":1},{"position":0.5,"color":"#faad14","alpha":1},{"position":1,"color":"#52c41a","alpha":1}]`

const materialTypeOptions: { value: MaterialType; label: string }[] = [
  { value: 'color', label: '纯色' },
  { value: 'gradientVertical', label: '垂直渐变（上→下）' },
  { value: 'gradientHorizontal', label: '水平渐变（左→右）' },
  { value: 'gradientMultiColor', label: '多色渐变' },
  { value: 'imageRepeat', label: '图片重复平铺' },
  { value: 'imageStretch', label: '图片拉伸铺满' },
]

const mapStore = useMapLayerStore()
let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const selectedId = ref<string | null>(null)

interface DraftVertex {
  key: string
  longitude: number
  latitude: number
  height: number
}

function newVertexKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const draftVertices = ref<DraftVertex[]>([])

const form = reactive({
  id: '',
  materialType: 'color' as MaterialType,
  solidColor: DEFAULT_SOLID,
  solidAlpha: 0.85,
  gradStart: DEFAULT_GRAD_A,
  gradEnd: DEFAULT_GRAD_B,
  gradAlpha: 0.9,
  multiStopsJson: DEFAULT_MULTI_JSON,
  imageUrl: '',
  imageAlpha: 1,
  repeatX: 2,
  repeatY: 2,
  height: 8000,
  extrudedHeight: null as number | null,
  clampToGround: false,
  fill: true,
  outline: true,
  outlineColor: DEFAULT_OUTLINE,
  outlineWidth: 1,
  show: true,
})

const tableData = ref<WallSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const vertexTableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(140)
const vertexTableScrollY = ref(96)
let tableResizeObserver: ResizeObserver | null = null
let vertexResizeObserver: ResizeObserver | null = null

let viewerRef: Viewer | null = null

function syncDraftVerticesFromPick(points: LngLatHeight[]): void {
  draftVertices.value = points.map((p) => ({
    key: newVertexKey(),
    longitude: p.longitude,
    latitude: p.latitude,
    height: p.height ?? 0,
  }))
}

function wallStyleFieldsForDraw(): Omit<AddWallOptions, 'positions'> {
  const saved = draftVertices.value
  draftVertices.value = [
    { key: '_t0', longitude: 0, latitude: 0, height: 0 },
    { key: '_t1', longitude: 0, latitude: 0, height: 0 },
  ]
  try {
    const { positions: _, ...rest } = buildAddPayload()
    return rest
  } finally {
    draftVertices.value = saved
  }
}

function buildWallStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'wall',
    id: form.id.trim() || undefined,
    ...(wallStyleFieldsForDraw() as Record<string, unknown>),
    targetData: echoTargetDataForApi(),
    preview: {
      lineColor: form.solidColor,
      anchorPointColor: '#2b8cbe',
      cursorPointColor: '#2b8cbe',
    },
    onAnchorChange: (points) => {
      syncDraftVerticesFromPick(points)
      if (points.length === 0) isAreaDrawing.value = false
    },
  }
}

function stopAreaDraw(): void {
  am?.cancel()
  isAreaDrawing.value = false
}

function setupAreaManagerPublish(): void {
  bindAreaManagerPublish(
    'wall',
    () => {
      message.success('已添加墙体')
      selectedId.value = null
      refreshTable()
      resetForm()
    },
    stopAreaDraw,
  )
}

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 40
  tableScrollY.value = Math.max(72, Math.floor(shell.clientHeight - headH - 6))
}

function updateVertexTableScrollY(): void {
  const shell = vertexTableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  vertexTableScrollY.value = Math.max(48, Math.floor(shell.clientHeight - (thead?.offsetHeight ?? 32) - 4))
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  const W = window.FastX?.Wall
  if (!v || v.isDestroyed() || !W) {
    tableData.value = []
    return
  }
  tableData.value = W.getAllWalls(v)
  void nextTick(() => {
    updateTableScrollY()
    updateVertexTableScrollY()
  })
}

function hex6ForColorInput(css: string): string {
  const t = css.trim()
  if (t.startsWith('#') && t.length >= 7) return t.slice(0, 7)
  return '#000000'
}

function onColorPick(field: 'solid' | 'gradStart' | 'gradEnd' | 'outline', ev: Event): void {
  const el = ev.target as HTMLInputElement
  if (field === 'solid') form.solidColor = normalizeHex(el.value, DEFAULT_SOLID)
  else if (field === 'gradStart') form.gradStart = normalizeHex(el.value, DEFAULT_GRAD_A)
  else if (field === 'gradEnd') form.gradEnd = normalizeHex(el.value, DEFAULT_GRAD_B)
  else form.outlineColor = normalizeHex(el.value, DEFAULT_OUTLINE)
}

function buildRgbaColor(hex: string, alpha: number): string {
  const { hex: h } = parseCssColorForForm(hex, '#888888')
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${r},${g},${b},${a})`
}

function wallPositionsFromDraft(): { longitude: number; latitude: number; height: number }[] {
  return draftVertices.value.map((v) => ({
    longitude: v.longitude,
    latitude: v.latitude,
    height: v.height,
  }))
}

function styleOutlineBlock() {
  return {
    fill: form.fill,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineWidth: form.outline ? form.outlineWidth : 0,
  }
}

function parseColorStops(): ColorStop[] | null {
  try {
    const raw = JSON.parse(form.multiStopsJson) as unknown
    if (!Array.isArray(raw) || raw.length < 2) return null
    const out: ColorStop[] = []
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const position = Number(o.position)
      const color = o.color
      if (!Number.isFinite(position) || typeof color !== 'string') continue
      const alpha = typeof o.alpha === 'number' && Number.isFinite(o.alpha) ? o.alpha : undefined
      out.push({ position, color, alpha })
    }
    return out.length >= 2 ? out : null
  } catch {
    return null
  }
}

function buildAddPayload(): AddWallOptions {
  const outline = styleOutlineBlock()
  const positions = wallPositionsFromDraft()
  const base: AddWallOptions = {
    positions,
    height: form.height,
    show: form.show,
    style: { ...outline },
  }
  if (form.extrudedHeight != null && form.extrudedHeight > 0) {
    base.extrudedHeight = form.extrudedHeight
  }
  if (form.clampToGround) base.clampToGround = true

  const mt = form.materialType

  if (mt === 'color') {
    const css = buildRgbaColor(form.solidColor, form.solidAlpha)
    return {
      ...base,
      materialType: 'color',
      color: css,
      style: { ...outline, type: 'color', color: css },
    }
  }

  if (mt === 'gradientVertical' || mt === 'gradientHorizontal') {
    const dir = mt === 'gradientHorizontal' ? 'horizontal' : 'vertical'
    const start = buildRgbaColor(form.gradStart, form.gradAlpha)
    const end = buildRgbaColor(form.gradEnd, form.gradAlpha)
    return {
      ...base,
      materialType: mt,
      gradientStartColor: start,
      gradientEndColor: end,
      gradientDirection: dir,
      style: {
        ...outline,
        type: mt,
        gradient: { startColor: start, endColor: end },
      },
    }
  }

  if (mt === 'gradientMultiColor') {
    const stops = parseColorStops()
    if (!stops) throw new Error('多色渐变 JSON 无效，至少需要 2 个节点')
    return {
      ...base,
      materialType: 'gradientMultiColor',
      colorStops: stops,
      gradientDirection: 'vertical',
      style: {
        ...outline,
        type: 'gradientMultiColor',
        gradient: { colorStops: stops },
      },
    }
  }

  if (mt === 'imageRepeat') {
    if (!form.imageUrl.trim()) throw new Error('请先上传图片或填写图片 Data URL')
    const url = form.imageUrl.trim()
    const rep = { x: Math.max(0.01, form.repeatX), y: Math.max(0.01, form.repeatY) }
    return {
      ...base,
      materialType: 'imageRepeat',
      imageUrl: url,
      repeat: rep,
      style: {
        ...outline,
        type: 'imageRepeat',
        image: { url, alpha: form.imageAlpha },
        repeat: rep,
      },
    }
  }

  if (mt === 'imageStretch') {
    if (!form.imageUrl.trim()) throw new Error('请先上传图片或填写图片 Data URL')
    const url = form.imageUrl.trim()
    return {
      ...base,
      materialType: 'imageStretch',
      imageUrl: url,
      style: {
        ...outline,
        type: 'imageStretch',
        image: { url, alpha: form.imageAlpha },
      },
    }
  }

  return base
}

function buildUpdatePayload(): UpdateWallProperties {
  return buildAddPayload() as UpdateWallProperties
}

function positionsFromSnapshot(s: WallSnapshot): DraftVertex[] {
  const td = s.targetData
  const echo = td?.positionsEcho
  if (Array.isArray(echo) && echo.length >= 2) {
    return echo.map((row: unknown) => {
      const r = row as number[]
      return {
        key: newVertexKey(),
        longitude: Number(r[0]),
        latitude: Number(r[1]),
        height: Number(r[2] ?? 0),
      }
    })
  }
  return s.positions.map((cart: Cesium.Cartesian3) => {
    const c = Cesium.Cartographic.fromCartesian(cart)
    return {
      key: newVertexKey(),
      longitude: Cesium.Math.toDegrees(c.longitude),
      latitude: Cesium.Math.toDegrees(c.latitude),
      height: c.height,
    }
  })
}

function fillFormFromSnapshot(s: WallSnapshot): void {
  form.id = s.id
  const td = s.targetData
  const mt = (s.materialType as MaterialType) || (td.materialType as MaterialType)
  if (materialTypeOptions.some((o) => o.value === mt)) {
    form.materialType = mt
  }

  draftVertices.value = positionsFromSnapshot(s)

  form.height = typeof td.height === 'number' && Number.isFinite(td.height) ? td.height : s.height ?? form.height
  form.extrudedHeight =
    typeof td.extrudedHeight === 'number' && Number.isFinite(td.extrudedHeight)
      ? td.extrudedHeight
      : s.extrudedHeight ?? null
  form.clampToGround =
    typeof td.clampToGround === 'boolean' ? td.clampToGround : s.clampToGround

  const solidP = parseCssColorForForm(
    typeof td.color === 'string' ? td.color : s.colorCss,
    DEFAULT_SOLID,
  )
  form.solidColor = solidP.hex
  form.solidAlpha = typeof td.solidAlpha === 'number' && Number.isFinite(td.solidAlpha) ? td.solidAlpha : solidP.alpha

  const gs = parseCssColorForForm(
    typeof td.gradientStartColor === 'string' ? td.gradientStartColor : s.gradientStartColorCss,
    DEFAULT_GRAD_A,
  )
  const ge = parseCssColorForForm(
    typeof td.gradientEndColor === 'string' ? td.gradientEndColor : s.gradientEndColorCss,
    DEFAULT_GRAD_B,
  )
  form.gradStart = gs.hex
  form.gradEnd = ge.hex
  form.gradAlpha =
    typeof td.gradAlpha === 'number' && Number.isFinite(td.gradAlpha)
      ? td.gradAlpha
      : Math.min(gs.alpha, ge.alpha)

  if (Array.isArray(td.colorStops)) {
    try {
      form.multiStopsJson = JSON.stringify(td.colorStops, null, 2)
    } catch {
      form.multiStopsJson = DEFAULT_MULTI_JSON
    }
  } else if (s.colorStops?.length) {
    form.multiStopsJson = JSON.stringify(
      s.colorStops.map((x) => ({ position: x.position, color: x.colorCss, alpha: x.alpha })),
      null,
      2,
    )
  }

  form.imageUrl = typeof td.imageUrl === 'string' ? td.imageUrl : s.imageUrl ?? ''
  form.imageAlpha = typeof td.imageAlpha === 'number' && Number.isFinite(td.imageAlpha) ? td.imageAlpha : 1
  if (td.repeat && typeof td.repeat === 'object') {
    const r = td.repeat as { x?: number; y?: number }
    if (typeof r.x === 'number') form.repeatX = r.x
    if (typeof r.y === 'number') form.repeatY = r.y
  } else if (s.repeat) {
    form.repeatX = s.repeat.x
    form.repeatY = s.repeat.y
  }

  form.fill = s.fill !== false
  form.outline = s.outline !== false
  const outP = parseCssColorForForm(
    typeof td.outlineColorHex === 'string' ? td.outlineColorHex : undefined,
    DEFAULT_OUTLINE,
  )
  form.outlineColor = outP.hex
  form.outlineWidth = typeof td.outlineWidth === 'number' ? td.outlineWidth : s.outlineWidth ?? 1
  form.show = s.show
}

function resetForm(): void {
  form.id = ''
  form.materialType = 'color'
  form.solidColor = DEFAULT_SOLID
  form.solidAlpha = 0.85
  form.gradStart = DEFAULT_GRAD_A
  form.gradEnd = DEFAULT_GRAD_B
  form.gradAlpha = 0.9
  form.multiStopsJson = DEFAULT_MULTI_JSON
  form.imageUrl = ''
  form.imageAlpha = 1
  form.repeatX = 2
  form.repeatY = 2
  form.height = 8000
  form.extrudedHeight = null
  form.clampToGround = false
  form.fill = true
  form.outline = true
  form.outlineColor = DEFAULT_OUTLINE
  form.outlineWidth = 1
  form.show = true
  draftVertices.value = []
}

function onWallRowClick(record: WallSnapshot): void {
  stopAreaDraw()
  selectedId.value = record.id
  const snap = window.FastX?.Wall?.getWall(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteWallRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Wall?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    stopAreaDraw()
    resetForm()
  }
  refreshTable()
  message.success('已删除')
}

const primaryWallText = computed(() =>
  selectedId.value ? '确定' : isAreaDrawing.value ? '完成标绘' : '绘制',
)

function onAddVertexRow(): void {
  draftVertices.value.push({
    key: newVertexKey(),
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
  })
  void nextTick(() => updateVertexTableScrollY())
}

function onRemoveVertexRow(key: string): void {
  draftVertices.value = draftVertices.value.filter((v) => v.key !== key)
}

function onClearVertices(): void {
  draftVertices.value = []
}

function onImageFile(ev: Event): void {
  const inp = ev.target as HTMLInputElement
  const file = inp.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件')
    inp.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = typeof reader.result === 'string' ? reader.result : ''
    if (!dataUrl) {
      message.error('读取图片失败')
      return
    }
    form.imageUrl = dataUrl
    message.success('已载入本地图片')
  }
  reader.readAsDataURL(file)
  inp.value = ''
}

function echoTargetDataForApi(): Record<string, unknown> {
  return {
    solidAlpha: form.solidAlpha,
    gradAlpha: form.gradAlpha,
    imageAlpha: form.imageAlpha,
    outlineColorHex: form.outlineColor,
    outlineWidth: form.outline ? form.outlineWidth : 0,
  }
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const W = window.FastX?.Wall
  const v = mapStore.getViewer()
  if (!id || !W || !v || v.isDestroyed()) return
  if (draftVertices.value.length < 2) {
    message.warning('墙轮廓至少需要 2 个顶点')
    return
  }
  let payload: UpdateWallProperties
  try {
    payload = buildUpdatePayload()
  } catch (err) {
    message.warning(err instanceof Error ? err.message : String(err))
    return
  }
  const ok = W.updateWall(id, {
    ...payload,
    targetData: echoTargetDataForApi(),
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
    const snap = W.getWall(id)
    if (snap) fillFormFromSnapshot(snap)
  } else {
    message.error('保存失败')
  }
}

function addWallFromForm(): void {
  if (draftVertices.value.length < 2) {
    message.warning('请先添加至少 2 个轮廓顶点（可拾取或手输）')
    return
  }
  const W = window.FastX?.Wall
  const v = mapStore.getViewer()
  if (!W || !v || v.isDestroyed()) return
  stopAreaDraw()
  let payload: AddWallOptions
  try {
    payload = buildAddPayload()
  } catch (err) {
    message.warning(err instanceof Error ? err.message : String(err))
    return
  }
  const idOpt = form.id.trim() || undefined
  const entity = W.add(v, {
    ...payload,
    id: idOpt,
    targetData: echoTargetDataForApi(),
  })
  if (!entity) {
    message.error('添加失败：ID 重复或参数无效')
    return
  }
  message.success('已添加墙体')
  selectedId.value = null
  refreshTable()
  resetForm()
}

function onPrimaryClick(): void {
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
      message.warning('墙轮廓至少需要 2 个顶点')
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
  draftVertices.value = []
  const ok = am.start(v, buildWallStartParams())
  if (!ok) {
    message.error('无法开始墙体绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')

  // --- Wall 单类 add（不用空域管理时注释上一段，改用下方）---
  // addWallFromForm()
}

function onCancelSelect(): void {
  selectedId.value = null
  stopAreaDraw()
  resetForm()
}

const vertexColumns: TableColumnType<DraftVertex>[] = [
  { title: '经度', dataIndex: 'longitude', key: 'longitude', width: 96, align: 'center' },
  { title: '纬度', dataIndex: 'latitude', key: 'latitude', width: 96, align: 'center' },
  { title: '高度', dataIndex: 'height', key: 'height', width: 72, align: 'center' },
  { title: '操作', key: 'va', width: 48, align: 'center' },
]

const wallColumns: TableColumnType<WallSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  {
    title: '材质',
    dataIndex: 'materialType',
    key: 'materialType',
    width: 120,
    align: 'center',
    customRender: ({ text }) =>
      materialTypeOptions.find((o) => o.value === text)?.label ?? String(text ?? '—'),
  },
  {
    title: '顶点',
    key: 'vc',
    width: 56,
    align: 'center',
    customRender: ({ record }) => String((record as WallSnapshot).positions?.length ?? 0),
  },
  {
    title: '墙高(m)',
    dataIndex: 'height',
    key: 'height',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? String(Math.round(text)) : '—'),
  },
  { title: '操作', key: 'action', width: 48, align: 'center', fixed: 'right' },
]

function wallRowClassName(record: WallSnapshot): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customWallRow(record: WallSnapshot) {
  return { onClick: () => onWallRowClick(record) }
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
  await nextTick()
  updateTableScrollY()
  updateVertexTableScrollY()
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  vertexResizeObserver = new ResizeObserver(() => updateVertexTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
  if (vertexTableShellRef.value) vertexResizeObserver.observe(vertexTableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  vertexResizeObserver?.disconnect()
  tableResizeObserver = null
  vertexResizeObserver = null
  am?.cancel()
  am?.unpublish()
  isAreaDrawing.value = false
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.FastX?.Wall?.clear(v)
  }
})
keepAlternateDemoEntry(addWallFromForm)
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point">
    <XDialog :width="560" height="88vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row hzd-field-row--block">
                  <span class="hzd-field-label">轮廓顶点</span>
                  <div class="hzd-field-control hzd-field-control--stack">
                    <div class="hzd-vertex-toolbar">
                      <span class="hzd-muted">至少 2 个点</span>
                      <a-tooltip title="添加一行顶点">
                        <a-button type="text" size="small" class="hzd-clear-ring-btn" aria-label="添加顶点" @click="onAddVertexRow">
                          <template #icon><PlusOutlined /></template>
                        </a-button>
                      </a-tooltip>
                      <a-tooltip title="清空轮廓顶点">
                        <a-button type="text" size="small" class="hzd-clear-ring-btn" aria-label="清空顶点" @click="onClearVertices">
                          <template #icon><ClearOutlined /></template>
                        </a-button>
                      </a-tooltip>
                    </div>
                    <div ref="vertexTableShellRef" class="hzd-vertex-table-wrap hzd-scroll-skin">
                      <a-table
                        class="hzd-table hzd-table--compact"
                        :columns="vertexColumns"
                        :data-source="draftVertices"
                        :pagination="false"
                        row-key="key"
                        size="small"
                        :scroll="{ y: vertexTableScrollY }"
                      >
                        <template #bodyCell="{ column, record }">
                          <template v-if="column.key === 'longitude'">
                            <a-input-number
                              v-model:value="record.longitude"
                              class="hzd-control-fill"
                              size="small"
                              :step="0.0001"
                              :controls="true"
                            />
                          </template>
                          <template v-else-if="column.key === 'latitude'">
                            <a-input-number
                              v-model:value="record.latitude"
                              class="hzd-control-fill"
                              size="small"
                              :step="0.0001"
                              :controls="true"
                            />
                          </template>
                          <template v-else-if="column.key === 'height'">
                            <a-input-number v-model:value="record.height" class="hzd-control-fill" size="small" :step="1" />
                          </template>
                          <template v-else-if="column.key === 'va'">
                            <a-tooltip title="删除该点">
                              <a-button
                                type="text"
                                danger
                                size="small"
                                class="hzd-del-btn"
                                aria-label="删除顶点"
                                @click="onRemoveVertexRow(record.key)"
                              >
                                <template #icon><DeleteOutlined /></template>
                              </a-button>
                            </a-tooltip>
                          </template>
                        </template>
                      </a-table>
                    </div>
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">墙 ID</span>
                  <div class="hzd-field-control">
                    <a-input v-model:value="form.id" class="hzd-control-fill" size="small" allow-clear placeholder="可选" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">材质类型</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.materialType"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="materialTypeOptions"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>

                <template v-if="form.materialType === 'color'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">填充色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.solidColor }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.solidColor)"
                          @input="onColorPick('solid', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.solidAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                </template>

                <template
                  v-if="form.materialType === 'gradientVertical' || form.materialType === 'gradientHorizontal'"
                >
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">起始色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.gradStart }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.gradStart)"
                          @input="onColorPick('gradStart', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">结束色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.gradEnd }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.gradEnd)"
                          @input="onColorPick('gradEnd', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">渐变透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.gradAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                </template>

                <template v-if="form.materialType === 'gradientMultiColor'">
                  <div class="hzd-field-row hzd-field-row--textarea">
                    <span class="hzd-field-label">颜色节点 JSON</span>
                    <div class="hzd-field-control">
                      <a-textarea v-model:value="form.multiStopsJson" class="hzd-textarea-fill" :rows="5" size="small" />
                    </div>
                  </div>
                </template>

                <template v-if="form.materialType === 'imageRepeat' || form.materialType === 'imageStretch'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">上传图片</span>
                    <div class="hzd-field-control hzd-field-control--file">
                      <label class="hzd-file-btn">
                        <span>选择图片</span>
                        <input type="file" class="hzd-file-hit" accept="image/*" @change="onImageFile" />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">图片透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.imageAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div v-if="form.materialType === 'imageRepeat'" class="hzd-field-row">
                    <span class="hzd-field-label">重复 X</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.repeatX" class="hzd-control-fill" size="small" :min="0.01" :step="0.5" />
                    </div>
                  </div>
                  <div v-if="form.materialType === 'imageRepeat'" class="hzd-field-row">
                    <span class="hzd-field-label">重复 Y</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.repeatY" class="hzd-control-fill" size="small" :min="0.01" :step="0.5" />
                    </div>
                  </div>
                  <p class="hzd-muted hzd-field-footnote">请先选择本地图片再标绘；使用 Data URL 传入，无需网络地址。</p>
                </template>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">墙高 (m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :min="1" :step="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">底高 (m)</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.extrudedHeight"
                      class="hzd-control-fill"
                      size="small"
                      :min="0"
                      :step="10"
                      placeholder="可选"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">贴地</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.clampToGround" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.fill" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓线</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.outline" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.outlineColor }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="hex6ForColorInput(form.outlineColor)"
                        @input="onColorPick('outline', $event)"
                      />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓宽</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.outlineWidth" class="hzd-control-fill" size="small" :min="0" :max="8" />
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
                    <div class="hzd-actions-primary-row hzd-actions-primary-row--solo">
                      <a-button
                        type="primary"
                        class="map-tool-primary-btn hzd-primary-tall"
                        @click="onPrimaryClick"
                      >
                        {{ primaryWallText }}
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
            <div class="hzd-pane-title">墙体列表</div>
            <div ref="tableShellRef" class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll">
              <a-table
                class="hzd-table"
                :columns="wallColumns"
                :data-source="tableData"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ x: 480, y: tableScrollY }"
                :row-class-name="wallRowClassName"
                :custom-row="customWallRow"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'action'">
                    <a-tooltip title="删除">
                      <a-button
                        type="text"
                        danger
                        size="small"
                        class="hzd-del-btn"
                        @click="onDeleteWallRow(record.id, $event)"
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

.hzd-vertex-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
}

.hzd-vertex-toolbar .hzd-muted {
  flex: 1 1 auto;
  text-align: left;
  margin-right: 4px;
}

.hzd-vertex-table-wrap {
  flex: 1;
  min-height: 0;
  max-height: min(22vh, 200px);
  overflow: auto;
}

.hzd-pane--form {
  flex: 0 1 auto;
  max-height: min(52vh, 480px);
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
  align-items: start;
  min-height: 0;
}

.hzd-field-row--block .hzd-field-label {
  padding-top: 6px;
}

.hzd-field-row--textarea {
  align-items: start;
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

.hzd-field-control--stack {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.hzd-field-control--slider {
  justify-content: flex-end;
}

.hzd-field-control--slider .hzd-slider-fill {
  width: 80%;
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

.hzd-field-control :deep(.ant-input) {
  width: 100%;
}

.hzd-textarea-fill {
  width: 100% !important;
  max-width: 100%;
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
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
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

.hzd-color-native {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 80%;
  position: relative;
  min-height: 28px;
}

.hzd-color-hit {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.hzd-swatch {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.hzd-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

.hzd-field-footnote {
  margin: 0 0 4px;
  line-height: 1.45;
  font-size: 11px;
  max-width: 100%;
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

.hzd-cancel-icon-btn {
  align-self: center;
  color: rgba(255, 255, 255, 0.55) !important;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
}

.hzd-cancel-icon-btn:hover {
  color: rgba(180, 220, 255, 0.95) !important;
  background: rgba(255, 255, 255, 0.06) !important;
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

.hzd-table--compact :deep(.ant-table-thead > tr > th) {
  padding: 6px 4px !important;
  font-size: 11px;
}

.hzd-table--compact :deep(.ant-table-tbody > tr > td) {
  padding: 5px 4px !important;
  font-size: 11px;
}

.hzd-table-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.hzd-table-area--scroll :deep(.ant-table-body) {
  overflow: auto !important;
}
</style>
