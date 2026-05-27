<script setup lang="ts">
import { ClearOutlined, DeleteOutlined, DownOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { AreaDrawStartParams, CorridorSnapshot, LngLatHeight } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Corridor）廊道类（底层entity渲染）'

const DEFAULT_FILL = '#13c2c2'
const DEFAULT_OUTLINE = '#ffffff'

const cornerTypeOptions = [
  { value: 'ROUNDED', label: 'ROUNDED 圆角' },
  { value: 'MITERED', label: 'MITERED 斜接' },
  { value: 'BEVELED', label: 'BEVELED 斜切' },
] as const

const mapStore = useMapLayerStore()
let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const selectedEntityId = ref<string | null>(null)

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

const formEntity = reactive({
  id: '',
  width: 25_000,
  height: 0,
  extrudedHeight: 0,
  cornerType: 'ROUNDED' as 'ROUNDED' | 'MITERED' | 'BEVELED',
  showFill: true,
  color: DEFAULT_FILL,
  alpha: 1,
  outline: true,
  outlineColor: DEFAULT_OUTLINE,
  outlineAlpha: 1,
  outlineWidth: 2,
  show: true,
})

const tableEntity = ref<CorridorSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const vertexTableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
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

function buildCorridorStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'corridor',
    id: formEntity.id.trim() || undefined,
    width: formEntity.width,
    height: formEntity.height,
    extrudedHeight: formEntity.extrudedHeight,
    cornerType: formEntity.cornerType,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    targetData: { showFill: formEntity.showFill },
    preview: { lineColor: formEntity.color, anchorPointColor: '#13c2c2', cursorPointColor: '#13c2c2' },
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
  if (!am) return
  am.publish((result) => {
    if (result.shapeType !== 'corridor') return
    stopAreaDraw()
    message.success('已添加廊道 Entity')
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

function updateVertexTableScrollY(): void {
  const shell = vertexTableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  vertexTableScrollY.value = Math.max(48, Math.floor(shell.clientHeight - (thead?.offsetHeight ?? 32) - 4))
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  const C = window.FastX?.Corridor
  if (!v || v.isDestroyed() || !C) {
    tableEntity.value = []
    return
  }
  tableEntity.value = C.getAllCorridors(v)
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

function normalizeHex(css: string, fallback: string): string {
  const t = css.trim()
  if (/^#[0-9a-fA-F]{6}$/i.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/i.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

/** Cesium `toCssColorString()` 常为 `rgba(...)`，需拆成色值 + 透明度再回显到表单 */
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

function cornerTypeFromSnapshot(s: CorridorSnapshot): 'ROUNDED' | 'MITERED' | 'BEVELED' {
  const k = s.cornerType
  if (k === 'ROUNDED' || k === 'MITERED' || k === 'BEVELED') return k
  const raw = s.targetData?.cornerType
  if (raw === 'ROUNDED' || raw === 'MITERED' || raw === 'BEVELED') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw === 0) return 'ROUNDED'
    if (raw === 1) return 'MITERED'
    if (raw === 2) return 'BEVELED'
  }
  return 'ROUNDED'
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const fb = field === 'color' ? DEFAULT_FILL : DEFAULT_OUTLINE
  const hex = normalizeHex(el.value, fb)
  if (field === 'color') formEntity.color = hex
  else formEntity.outlineColor = hex
}

function fillAlphaForEntity(): number {
  return formEntity.showFill ? formEntity.alpha : 0
}

function draftToPositions(): [number, number, number][] {
  return draftVertices.value.map((v) => [v.longitude, v.latitude, v.height])
}

function fillFormEntityFromSnapshot(s: CorridorSnapshot): void {
  formEntity.id = s.id
  formEntity.width = s.width
  formEntity.height = s.height
  formEntity.extrudedHeight = s.extrudedHeight
  formEntity.cornerType = cornerTypeFromSnapshot(s)
  const td = s.targetData
  const fillCss =
    s.colorCss ?? (typeof td.color === 'string' && td.color.trim() ? td.color : undefined)
  const fillParsed = parseCssColorForForm(fillCss, DEFAULT_FILL)
  formEntity.color = fillParsed.hex
  const tdAlpha = typeof td.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined
  formEntity.alpha = tdAlpha ?? fillParsed.alpha
  formEntity.showFill = s.showFill !== false
  formEntity.outline = s.outline !== false
  const outCss =
    s.outlineColorCss ??
    (typeof td.outlineColor === 'string' && td.outlineColor.trim()
      ? td.outlineColor
      : undefined)
  const outParsed = parseCssColorForForm(outCss, DEFAULT_OUTLINE)
  formEntity.outlineColor = outParsed.hex
  const tdOA =
    typeof td.outlineAlpha === 'number' && Number.isFinite(td.outlineAlpha) ? td.outlineAlpha : undefined
  formEntity.outlineAlpha = tdOA ?? outParsed.alpha
  formEntity.outlineWidth = s.outlineWidth ?? 2
  formEntity.show = s.show
  const posRows = Array.isArray(s.positions) ? s.positions : []
  draftVertices.value = posRows.map((p) => ({
    key: newVertexKey(),
    longitude: Number(p[0]),
    latitude: Number(p[1]),
    height: Number(p[2] ?? 0),
  }))
}

function resetFormEntity(): void {
  formEntity.id = ''
  formEntity.width = 25_000
  formEntity.height = 0
  formEntity.extrudedHeight = 0
  formEntity.cornerType = 'ROUNDED'
  formEntity.showFill = true
  formEntity.color = DEFAULT_FILL
  formEntity.alpha = 1
  formEntity.outline = true
  formEntity.outlineColor = DEFAULT_OUTLINE
  formEntity.outlineAlpha = 1
  formEntity.outlineWidth = 2
  formEntity.show = true
  draftVertices.value = []
}

function disarmPick(): void {
  stopAreaDraw()
}

function onEntityRowClick(record: CorridorSnapshot): void {
  disarmPick()
  selectedEntityId.value = record.id
  const snap = window.FastX?.Corridor?.getCorridor(record.id)
  if (snap) fillFormEntityFromSnapshot(snap)
}

function onDeleteEntityRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Corridor?.remove(id)
  if (selectedEntityId.value === id) {
    selectedEntityId.value = null
    disarmPick()
    resetFormEntity()
  }
  refreshTable()
  message.success('已删除')
}

function onDeleteDraftRow(key: string, e: Event): void {
  e.stopPropagation()
  draftVertices.value = draftVertices.value.filter((v) => v.key !== key)
}

function onClearDraftVertices(): void {
  draftVertices.value = []
  message.info('已清空中心线顶点')
}

const primaryEntityText = computed(() => (selectedEntityId.value ? '确定' : isAreaDrawing.value ? '完成标绘' : '绘制'))

function applyEntityUpdate(): void {
  const id = selectedEntityId.value
  const C = window.FastX?.Corridor
  const v = mapStore.getViewer()
  if (!id || !C || !v || v.isDestroyed()) return
  if (draftVertices.value.length < 2) {
    message.warning('中心线至少需要 2 个顶点')
    return
  }
  const ok = C.updateCorridor(id, {
    positions: draftToPositions(),
    width: formEntity.width,
    height: formEntity.height,
    extrudedHeight: formEntity.extrudedHeight,
    cornerType: formEntity.cornerType,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    targetData: { showFill: formEntity.showFill },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else message.error('保存失败')
}

function addEntityFromForm(): void {
  if (draftVertices.value.length < 2) {
    message.warning('请至少添加 2 个中心线顶点')
    return
  }
  const C = window.FastX?.Corridor
  const v = mapStore.getViewer()
  if (!C || !v || v.isDestroyed()) return
  disarmPick()
  const idOpt = formEntity.id.trim() || undefined
  const entity = C.add(v, {
    id: idOpt,
    positions: draftToPositions(),
    width: formEntity.width,
    height: formEntity.height,
    extrudedHeight: formEntity.extrudedHeight,
    cornerType: formEntity.cornerType,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    targetData: { showFill: formEntity.showFill },
  })
  if (!entity) {
    message.error('添加失败：请检查 id 是否重复、宽度或顶点是否有效')
    return
  }
  message.success('已添加廊道 Entity')
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
    if (am.pointCount < 2) {
      message.warning('中心线至少需要 2 个顶点')
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
  const ok = am.start(v, buildCorridorStartParams())
  if (!ok) {
    message.error('无法开始廊道绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')
  // --- Corridor 单类 add（不用空域管理时注释上一段，改用下方）---
  // addEntityFromForm()
}

function onCancelEntitySelect(): void {
  selectedEntityId.value = null
  stopAreaDraw()
  resetFormEntity()
}

const vertexColumns: TableColumnType<DraftVertex>[] = [
  { title: '#', key: 'idx', width: 40, align: 'center', customRender: ({ index }) => String(index + 1) },
  {
    title: '经度(°)',
    dataIndex: 'longitude',
    key: 'longitude',
    width: 88,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '纬度(°)',
    dataIndex: 'latitude',
    key: 'latitude',
    width: 88,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '高(m)',
    dataIndex: 'height',
    key: 'height',
    width: 64,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(1) : String(text)),
  },
  { title: '', key: 'action', width: 44, align: 'center', fixed: 'right' },
]

const columnsEntity: TableColumnType<CorridorSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  { title: '顶点数', dataIndex: 'vertexCount', key: 'vertexCount', width: 64, align: 'center' },
  {
    title: '宽(m)',
    dataIndex: 'width',
    key: 'width',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(0) : String(text)),
  },
  { title: '拐角', key: 'ct', width: 72, align: 'center', customRender: ({ record }) => record.cornerType ?? '—' },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: CorridorSnapshot): string {
  return record.id === selectedEntityId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: CorridorSnapshot) {
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
    window.FastX?.Corridor?.clear(v)
  }
})
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
                  <span class="hzd-field-label">廊道 ID</span>
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

                <div class="hzd-field-row hzd-field-row--block">
                  <span class="hzd-field-label">中心线顶点</span>
                  <div class="hzd-field-control hzd-field-control--stack">
                    <div class="hzd-vertex-toolbar">
                      <span class="hzd-muted">至少 2 个点</span>
                      <a-tooltip title="清空中心线顶点">
                        <a-button type="text" size="small" class="hzd-clear-ring-btn" aria-label="清空" @click="onClearDraftVertices">
                          <template #icon><ClearOutlined /></template>
                        </a-button>
                      </a-tooltip>
                    </div>
                    <p class="hzd-muted hzd-field-footnote">各点「高」为椭球高程（米）。廊道使用绝对坐标（heightReference = none）。</p>
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
                          <template v-if="column.key === 'action'">
                            <a-tooltip title="删除该点">
                              <a-button type="text" danger size="small" class="hzd-del-btn" aria-label="删除顶点" @click="onDeleteDraftRow(record.key, $event)">
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
                  <span class="hzd-field-label">廊道总宽(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="formEntity.width" class="hzd-control-fill" size="small" :min="1" :step="1000" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高度 height(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="formEntity.height" class="hzd-control-fill" size="small" :step="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">挤出 extruded(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="formEntity.extrudedHeight" class="hzd-control-fill" size="small" :step="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">拐角 cornerType</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="formEntity.cornerType"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="[...cornerTypeOptions]"
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

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <div class="hzd-actions-primary-row">
                      <!-- 原「地图追加顶点」按钮：已由「绘制」直接 am.start
                      <a-tooltip title="地图追加顶点">
                        <a-button
                          :type="vertexPickArmed ? 'primary' : 'default'"
                          class="hzd-pick-coord-btn hzd-primary-tall"
                          aria-label="拾取顶点"
                          @click="toggleVertexPick"
                        >
                          <template #icon><EnvironmentOutlined /></template>
                        </a-button>
                      </a-tooltip>
                      -->
                      <a-button type="primary" class="map-tool-primary-btn hzd-primary-tall hzd-primary-flex" @click="onEntityPrimary">
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
            <div class="hzd-pane-title">廊道列表</div>
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

.hzd-field-row--block {
  align-items: start;
  min-height: 0;
}

.hzd-field-row--block .hzd-field-label {
  padding-top: 6px;
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

.hzd-field-control > .ant-space {
  width: 80%;
  justify-content: flex-end;
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

.hzd-vertex-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
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

.hzd-table--compact :deep(.ant-table-thead > tr > th) {
  padding: 6px 4px !important;
  font-size: 11px;
}

.hzd-table--compact :deep(.ant-table-tbody > tr > td) {
  padding: 5px 4px !important;
  font-size: 11px;
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
