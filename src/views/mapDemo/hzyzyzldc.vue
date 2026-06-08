<script setup lang="ts">
import { keepAlternateDemoEntry } from './common/keepAlternateDemoEntry'
import { DeleteOutlined, DownOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { AreaDrawStartParams, CylinderSnapshot, LngLatHeight, MouseEventListenOptions, MouseEventPickPayload } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { waitForMapViewer } from './common/useCoordinateDemo'

const title = '绘制（Cylinder）圆锥/圆柱类（底层entity渲染）'
const DEFAULT_FILL_COLOR = '#1890ff'
const DEFAULT_OUTLINE_COLOR = '#ffffff'

const mapStore = useMapLayerStore()
let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const coordPickArmed = ref(false)
const selectedEntityId = ref<string | null>(null)

const sliceOptions = [
  { label: '16', value: 16 },
  { label: '32', value: 32 },
  { label: '48', value: 48 },
  { label: '64', value: 64 },
]

const formEntity = reactive({
  id: '',
  longitude: null as number | null,
  latitude: null as number | null,
  height: 0,
  /** 轴向长度（m）；圆锥体常用，标绘时默认 0，选中行后可编辑 */
  length: 0,
  topRadius: null as number | null,
  bottomRadius: null as number | null,
  headingDegrees: 0,
  pitchDegrees: 0,
  rollDegrees: 0,
  slices: 32,
  showFill: true,
  color: DEFAULT_FILL_COLOR,
  alpha: 1,
  outline: true,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineAlpha: 1,
  outlineWidth: 2,
  show: true,
})

const tableEntity = ref<CylinderSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

type MapMouseBinder = { listen: (options: MouseEventListenOptions) => void; destroy: () => void }
let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

function haversineDistanceM(a: LngLatHeight, b: LngLatHeight): number {
  const R = 6371008.8
  const r0 = (a.latitude * Math.PI) / 180
  const r1 = (b.latitude * Math.PI) / 180
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r0) * Math.cos(r1) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function syncCylinderFromAnchors(points: LngLatHeight[], anchorCount = points.length): void {
  if (anchorCount >= 1 && points.length >= 1) {
    formEntity.longitude = points[0]!.longitude
    formEntity.latitude = points[0]!.latitude
    formEntity.height = points[0]!.height ?? 0
  } else {
    formEntity.longitude = null
    formEntity.latitude = null
  }
  if (anchorCount >= 1 && points.length >= 2) {
    formEntity.bottomRadius = haversineDistanceM(points[0]!, points[1]!)
  } else {
    formEntity.bottomRadius = null
  }
  if (anchorCount >= 2 && points.length >= 3) {
    formEntity.topRadius = haversineDistanceM(points[0]!, points[2]!)
  } else if (anchorCount >= 2 && points.length >= 2) {
    formEntity.topRadius = haversineDistanceM(points[0]!, points[1]!)
  } else {
    formEntity.topRadius = null
  }
}

function buildCylinderStartParams(): AreaDrawStartParams {
  const length =
    typeof formEntity.length === 'number' && formEntity.length > 0 ? formEntity.length : undefined
  return {
    shapeType: 'cylinder',
    id: formEntity.id.trim() || undefined,
    length,
    headingDegrees: 0,
    pitchDegrees: 0,
    rollDegrees: 0,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    showFill: formEntity.showFill,
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    style: { slices: formEntity.slices },
    targetData: { showFill: formEntity.showFill, slices: formEntity.slices },
    preview: {
      anchorPointColor: '#1890ff',
      cursorPointColor: '#1890ff',
      lineColor: formEntity.color,
      fillColor: formEntity.color,
      fillAlpha: formEntity.alpha,
    },
    onAnchorChange: (points, anchorCount) => {
      syncCylinderFromAnchors(points, anchorCount ?? points.length)
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
    if (result.shapeType !== 'cylinder') return
    stopAreaDraw()
    message.success('已添加圆柱 / 圆锥')
    refreshTable()
    resetFormEntity()
  })
}

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 40
  tableScrollY.value = Math.max(72, Math.floor(shell.clientHeight - headH - 6))
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  const C = window.FastX?.Cylinder
  if (!v || v.isDestroyed() || !C) {
    tableEntity.value = []
    return
  }
  tableEntity.value = C.getAllCylinders(v)
  void nextTick(() => updateTableScrollY())
}

function normalizeHex(css: string, fallback: string): string {
  const t = css.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

function hex6ForColorInput(css: string): string {
  const t = css.trim()
  if (t.startsWith('#') && t.length >= 7) return t.slice(0, 7)
  return '#000000'
}

function parseCssColorForForm(
  css: string | undefined,
  fallbackHex: string,
): { hex: string; alpha: number } {
  if (!css || typeof css !== 'string') return { hex: fallbackHex, alpha: 1 }
  const t = css.trim()
  const rgba = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
  if (rgba) {
    const r = Math.min(255, Math.max(0, Math.round(Number(rgba[1]))))
    const g = Math.min(255, Math.max(0, Math.round(Number(rgba[2]))))
    const b = Math.min(255, Math.max(0, Math.round(Number(rgba[3]))))
    const a = rgba[4] !== undefined && rgba[4] !== '' ? Number(rgba[4]) : 1
    if ([r, g, b].every((x) => Number.isFinite(x))) {
      const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toLowerCase()
      return { hex, alpha: Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1 }
    }
  }
  if (/^#[0-9a-fA-F]{3}$/i.test(t) || /^#[0-9a-fA-F]{6}$/i.test(t)) {
    return { hex: normalizeHex(t, fallbackHex), alpha: 1 }
  }
  if (/^#[0-9a-fA-F]{8}$/i.test(t)) {
    const hex6 = `#${t.slice(1, 7)}`.toLowerCase()
    const aByte = parseInt(t.slice(7, 9), 16)
    const alpha = Number.isFinite(aByte) ? Math.min(1, Math.max(0, aByte / 255)) : 1
    return { hex: normalizeHex(hex6, fallbackHex), alpha }
  }
  return { hex: fallbackHex, alpha: 1 }
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const fb = field === 'color' ? DEFAULT_FILL_COLOR : DEFAULT_OUTLINE_COLOR
  const hex = normalizeHex(el.value, fb)
  if (field === 'color') formEntity.color = hex
  else formEntity.outlineColor = hex
}

function fillAlphaForEntity(): number {
  return formEntity.showFill ? formEntity.alpha : 0
}

function fillFormEntityFromSnapshot(s: CylinderSnapshot): void {
  formEntity.id = s.id
  formEntity.longitude = s.longitude
  formEntity.latitude = s.latitude
  formEntity.height = s.height
  formEntity.length = s.length
  formEntity.topRadius = s.topRadius
  formEntity.bottomRadius = s.bottomRadius
  formEntity.headingDegrees = s.headingDegrees
  formEntity.pitchDegrees = s.pitchDegrees
  formEntity.rollDegrees = s.rollDegrees
  const td = s.targetData
  const styleSnap = td?.styleSnapshot as { slices?: number } | undefined
  const sl = typeof td?.slices === 'number' ? td.slices : styleSnap?.slices
  formEntity.slices = typeof sl === 'number' && sl >= 8 ? sl : 32
  formEntity.showFill = s.showFill

  const fillParsed = parseCssColorForForm(s.colorCss, DEFAULT_FILL_COLOR)
  formEntity.color = fillParsed.hex
  const tdAlpha = typeof td?.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined
  const snapFillA = typeof s.fillAlpha === 'number' && Number.isFinite(s.fillAlpha) ? s.fillAlpha : undefined
  formEntity.alpha = tdAlpha ?? snapFillA ?? fillParsed.alpha

  formEntity.outline = s.outline !== false
  const outParsed = parseCssColorForForm(s.outlineColorCss, DEFAULT_OUTLINE_COLOR)
  formEntity.outlineColor = outParsed.hex
  const tdOA = typeof td?.outlineAlpha === 'number' && Number.isFinite(td.outlineAlpha) ? td.outlineAlpha : undefined
  const snapOA = typeof s.outlineAlpha === 'number' && Number.isFinite(s.outlineAlpha) ? s.outlineAlpha : undefined
  formEntity.outlineAlpha = tdOA ?? snapOA ?? outParsed.alpha

  formEntity.outlineWidth = s.outlineWidth ?? 2
  formEntity.show = s.show
}

function resetFormEntity(): void {
  formEntity.id = ''
  formEntity.longitude = null
  formEntity.latitude = null
  formEntity.height = 0
  formEntity.length = 0
  formEntity.topRadius = null
  formEntity.bottomRadius = null
  formEntity.headingDegrees = 0
  formEntity.pitchDegrees = 0
  formEntity.rollDegrees = 0
  formEntity.slices = 32
  formEntity.showFill = true
  formEntity.color = DEFAULT_FILL_COLOR
  formEntity.alpha = 1
  formEntity.outline = true
  formEntity.outlineColor = DEFAULT_OUTLINE_COLOR
  formEntity.outlineAlpha = 1
  formEntity.outlineWidth = 2
  formEntity.show = true
}

function centerReady(): boolean {
  return (
    formEntity.longitude != null &&
    formEntity.latitude != null &&
    Number.isFinite(formEntity.longitude) &&
    Number.isFinite(formEntity.latitude)
  )
}

function positiveLengthM(n: unknown, fallback: number): number {
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n
  return fallback
}

function nonNegativeRadiusM(n: unknown, fallback = 0): number {
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return n
  return fallback
}

function resolveLengthForSave(): number {
  const bottom = nonNegativeRadiusM(formEntity.bottomRadius, 0)
  const top = nonNegativeRadiusM(formEntity.topRadius, 0)
  return positiveLengthM(formEntity.length, Math.max(bottom, top, 1))
}

const primaryEntityText = computed(() => (selectedEntityId.value ? '确定' : '标绘'))

function applyEntityUpdate(): void {
  const id = selectedEntityId.value
  const C = window.FastX?.Cylinder
  const v = mapStore.getViewer()
  if (!id || !C || !v || v.isDestroyed()) return
  if (!centerReady()) {
    message.warning('请填写或拾取轴心经纬度')
    return
  }
  const ok = C.updateCylinder(id, {
    longitude: formEntity.longitude!,
    latitude: formEntity.latitude!,
    height: formEntity.height,
    length: resolveLengthForSave(),
    topRadius: nonNegativeRadiusM(formEntity.topRadius, 0),
    bottomRadius: nonNegativeRadiusM(formEntity.bottomRadius, 0),
    headingDegrees: formEntity.headingDegrees,
    pitchDegrees: formEntity.pitchDegrees,
    rollDegrees: formEntity.rollDegrees,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    showFill: formEntity.showFill,
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    style: { slices: formEntity.slices },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败')
  }
}

function addEntityFromForm(): void {
  if (!centerReady()) {
    message.warning('请填写或拾取轴心后再标绘')
    return
  }
  const C = window.FastX?.Cylinder
  const v = mapStore.getViewer()
  if (!C || !v || v.isDestroyed()) return
  stopAreaDraw()
  coordPickArmed.value = false
  const idOpt = formEntity.id.trim() || undefined
  const entity = C.add(v, {
    id: idOpt,
    longitude: formEntity.longitude!,
    latitude: formEntity.latitude!,
    height: formEntity.height,
    length: resolveLengthForSave(),
    topRadius: nonNegativeRadiusM(formEntity.topRadius, 0),
    bottomRadius: nonNegativeRadiusM(formEntity.bottomRadius, 0),
    headingDegrees: formEntity.headingDegrees,
    pitchDegrees: formEntity.pitchDegrees,
    rollDegrees: formEntity.rollDegrees,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    showFill: formEntity.showFill,
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    style: { slices: formEntity.slices },
  })
  if (!entity) {
    message.error('添加失败：id 重复或尺寸无效')
    return
  }
  message.success('已添加圆柱 / 圆锥')
  refreshTable()
  resetFormEntity()
}

function onEntityPrimary(): void {
  if (selectedEntityId.value) {
    applyEntityUpdate()
    return
  }

  am = window.FastX?.AreaManager
  if (!am) {
    message.error('FastX.AreaManager 未就绪')
    return
  }

  // --- 空域管理：鼠标绘制 start / end ---
  if (isAreaDrawing.value) {
    if (am.pointCount < 3) {
      message.warning('圆柱 / 圆锥至少需要 3 个点（轴心、底半径、顶半径）')
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
  resetFormEntity()
  const ok = am.start(v, buildCylinderStartParams())
  if (!ok) {
    message.error('无法开始圆柱 / 圆锥绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('左键：轴心 → 底半径 → 顶半径（第 3 点后自动完成）；右键可提前结束')

  // --- Cylinder 单类 add（不用空域管理时注释上一段，改用下方）---
  // addEntityFromForm()
}

function onCancelEntitySelect(): void {
  selectedEntityId.value = null
  coordPickArmed.value = false
  stopAreaDraw()
  resetFormEntity()
}

function togglePickCenter(): void {
  if (!selectedEntityId.value) {
    message.info('请先选中表格中的一条圆柱 / 圆锥')
    return
  }
  coordPickArmed.value = !coordPickArmed.value
  message.info(coordPickArmed.value ? '左键点击地图：写入轴心经纬度（及高度）' : '已取消拾取')
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!coordPickArmed.value) return
  if (!Number.isFinite(pick.longitude) || !Number.isFinite(pick.latitude)) {
    message.warning('未能拾取到有效坐标')
    return
  }
  formEntity.longitude = pick.longitude
  formEntity.latitude = pick.latitude
  if (Number.isFinite(pick.height)) formEntity.height = pick.height
  coordPickArmed.value = false
  message.success('已写入轴心')
}

function onEntityRowClick(record: CylinderSnapshot): void {
  stopAreaDraw()
  coordPickArmed.value = false
  selectedEntityId.value = record.id
  const snap = window.FastX?.Cylinder?.getCylinder(record.id)
  if (snap) fillFormEntityFromSnapshot(snap)
}

function onDeleteEntityRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Cylinder?.remove(id)
  if (selectedEntityId.value === id) {
    selectedEntityId.value = null
    stopAreaDraw()
    resetFormEntity()
  }
  refreshTable()
  message.success('已删除')
}

function bindMouse(v: Viewer): void {
  const Ctor = window.FastX?.MouseEvent as (new (viewer: Viewer) => MapMouseBinder) | undefined
  if (!Ctor) {
    message.error('window.FastX.MouseEvent 未就绪')
    return
  }
  mouseBinder?.destroy()
  const binder = new Ctor(v)
  binder.listen({ onLeftClick: onMapLeftClick })
  mouseBinder = binder
}

const columnsEntity: TableColumnType<CylinderSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  {
    title: '经度(°)',
    dataIndex: 'longitude',
    key: 'lng',
    width: 88,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '纬度(°)',
    dataIndex: 'latitude',
    key: 'lat',
    width: 88,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  { title: '高(m)', key: 'h', width: 64, align: 'center', customRender: ({ record }) => record.height.toFixed(0) },
  { title: '长(m)', key: 'len', width: 64, align: 'center', customRender: ({ record }) => record.length.toFixed(0) },
  { title: '顶R', key: 'tr', width: 56, align: 'center', customRender: ({ record }) => record.topRadius.toFixed(0) },
  { title: '底R', key: 'br', width: 56, align: 'center', customRender: ({ record }) => record.bottomRadius.toFixed(0) },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: CylinderSnapshot): string {
  return record.id === selectedEntityId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: CylinderSnapshot) {
  return { onClick: () => onEntityRowClick(record) }
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
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
})

onBeforeUnmount(() => {
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
    window.FastX?.Cylinder?.clear(v)
  }
})
keepAlternateDemoEntry(addEntityFromForm, bindMouse, togglePickCenter)
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
                  <span class="hzd-field-label">对象 ID</span>
                  <div class="hzd-field-control">
                    <a-input
                      v-model:value="formEntity.id"
                      class="hzd-control-fill"
                      size="small"
                      allow-clear
                      placeholder="可选，留空自动生成"
                      :disabled="!!selectedEntityId"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">经度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.longitude"
                      class="hzd-control-fill"
                      size="small"
                      :step="0.0001"
                      :controls="true"
                      :disabled="!selectedEntityId"
                      placeholder="标绘后或选中行可编辑"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">纬度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.latitude"
                      class="hzd-control-fill"
                      size="small"
                      :step="0.0001"
                      :controls="true"
                      :disabled="!selectedEntityId"
                      placeholder="标绘后或选中行可编辑"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="formEntity.height" class="hzd-control-fill" size="small" :step="100" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">顶半径（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.topRadius"
                      class="hzd-control-fill"
                      size="small"
                      :min="0"
                      :step="500"
                      :controls="true"
                      :disabled="!selectedEntityId"
                      placeholder="选中表格行后可编辑"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">底半径（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.bottomRadius"
                      class="hzd-control-fill"
                      size="small"
                      :min="0"
                      :step="500"
                      :controls="true"
                      :disabled="!selectedEntityId"
                      placeholder="选中表格行后可编辑"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轴向长度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.length"
                      class="hzd-control-fill"
                      size="small"
                      :min="0"
                      :step="1000"
                      :controls="true"
                      :disabled="!selectedEntityId"
                      placeholder="圆锥体轴向高度，选中行后可编辑"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">航向角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.headingDegrees"
                      class="hzd-control-fill"
                      size="small"
                      :step="5"
                      :disabled="!selectedEntityId"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">俯仰角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.pitchDegrees"
                      class="hzd-control-fill"
                      size="small"
                      :step="5"
                      :disabled="!selectedEntityId"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">横滚角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.rollDegrees"
                      class="hzd-control-fill"
                      size="small"
                      :step="5"
                      :disabled="!selectedEntityId"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">圆周分段</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="formEntity.slices"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      :options="sliceOptions"
                      popup-class-name="hzd-select-dropdown-dark"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示填充</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="formEntity.showFill" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: formEntity.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="hex6ForColorInput(formEntity.color)" @input="onColorPick('color', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="formEntity.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓线</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="formEntity.outline" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: formEntity.outlineColor }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="hex6ForColorInput(formEntity.outlineColor)"
                        @input="onColorPick('outlineColor', $event)"
                      />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="formEntity.outlineAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓宽度</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="formEntity.outlineWidth" class="hzd-control-fill" size="small" :min="0" :max="20" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="formEntity.show" size="small" />
                  </div>
                </div>

                <p class="hzd-muted">
                  标绘：左键依次确定轴心、底半径、顶半径（第 3 点后自动完成）。顶或底半径为 0 时为圆锥；轴向长度用于锥体高度，标绘后可在选中行编辑。航向/俯仰/横滚默认 0。
                </p>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <div class="hzd-actions-primary-row hzd-actions-primary-row--solo">
                      <a-button type="primary" class="map-tool-primary-btn hzd-primary-tall" @click="onEntityPrimary">
                        {{ primaryEntityText }}
                      </a-button>
                    </div>
                    <a-button v-if="selectedEntityId" type="link" size="small" class="hzd-cancel-select" @click="onCancelEntitySelect">取消选中</a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">圆柱 / 圆锥列表</div>
            <div ref="tableShellRef" class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll">
              <a-table
                class="hzd-table"
                :columns="columnsEntity"
                :data-source="tableEntity"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ y: tableScrollY }"
                :row-class-name="tableRowClassName"
                :custom-row="customTableRow"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'action'">
                    <a-tooltip title="删除">
                      <a-button type="text" danger size="small" class="hzd-del-btn" aria-label="删除" @click="onDeleteEntityRow(record.id, $event)">
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
  max-height: min(48vh, 420px);
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

.hzd-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
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

.hzd-table :deep(.ant-table-tbody > tr.hzd-point-row--active > td) {
  background: rgba(80, 140, 220, 0.18) !important;
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
