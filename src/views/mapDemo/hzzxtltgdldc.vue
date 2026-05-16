<script setup lang="ts">
import { ClearOutlined, DeleteOutlined, DownOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import * as Cesium from 'cesium'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions, MouseEventPickPayload, PolylineVolumeSnapshot } from '../../CesiumX'
import { defaultShapeParamsForType, parseShapeTypeKey, resolveShapeParamsFromTargetData } from '../../CesiumX/Draw/PolylineVolume/index'
import type { ShapeParams } from '../../CesiumX/Draw/PolylineVolume/shape'
import { ShapeType } from '../../CesiumX/Draw/PolylineVolume/shape'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { waitForMapViewer } from './useCoordinateDemo'

const title = '绘制（PolylineVolume）折线体（立体管道）类（底层 entity）'

const DEFAULT_FILL = '#00bcd4'
const DEFAULT_OUTLINE = '#ffffff'
const GRANULARITY_DEFAULT = Cesium.Math.RADIANS_PER_DEGREE

const cornerTypeOptions = [
  { value: 'ROUNDED', label: 'ROUNDED 圆角' },
  { value: 'MITERED', label: 'MITERED 斜接' },
  { value: 'BEVELED', label: 'BEVELED 斜切' },
] as const

const shapeTypeOptions = (Object.values(ShapeType) as ShapeType[]).map((value) => ({
  value,
  label:
    ({
      [ShapeType.CIRCLE]: 'circle 圆形',
      [ShapeType.ELLIPSE]: 'ellipse 椭圆',
      [ShapeType.HEXAGON]: 'hexagon 六边形',
      [ShapeType.OCTAGON]: 'octagon 八边形',
      [ShapeType.RECTANGLE]: 'rectangle 矩形',
      [ShapeType.SQUARE]: 'square 正方形',
      [ShapeType.DIAMOND]: 'diamond 菱形',
      [ShapeType.TRIANGLE]: 'triangle 三角形',
      [ShapeType.STAR]: 'star 星形',
      [ShapeType.CROSS]: 'cross 十字',
      [ShapeType.CAPSULE]: 'capsule 胶囊',
      [ShapeType.I_SHAPE]: 'iShape 工形',
      [ShapeType.L_SHAPE]: 'lShape L 形',
      [ShapeType.RING]: 'ring 环形',
    }[value] ?? value),
}))

const mapStore = useMapLayerStore()
const vertexPickArmed = ref(false)
const selectedEntityId = ref<string | null>(null)
/** 表格回显写入 `shapeType` 时不应触发「重置为默认截面参数」 */
const suppressShapeTypeChange = ref(false)

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

const shapeParamsState = ref<ShapeParams>(defaultShapeParamsForType(ShapeType.CIRCLE))

const formEntity = reactive({
  id: '',
  shapeType: ShapeType.CIRCLE as ShapeType,
  cornerType: 'ROUNDED' as 'ROUNDED' | 'MITERED' | 'BEVELED',
  granularity: GRANULARITY_DEFAULT,
  showFill: true,
  color: DEFAULT_FILL,
  alpha: 0.75,
  outline: false,
  outlineColor: DEFAULT_OUTLINE,
  outlineAlpha: 0.9,
  outlineWidth: 1,
  show: true,
})

const tableEntity = ref<PolylineVolumeSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const vertexTableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
const vertexTableScrollY = ref(96)
let tableResizeObserver: ResizeObserver | null = null
let vertexResizeObserver: ResizeObserver | null = null

type MapMouseBinder = { listen: (options: MouseEventListenOptions) => void; destroy: () => void }
let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

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
  const P = window.XGX?.PolylineVolume
  if (!v || v.isDestroyed() || !P) {
    tableEntity.value = []
    return
  }
  tableEntity.value = P.getAllPolylineVolumes(v)
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

function cornerTypeFromTd(td: Record<string, unknown>): 'ROUNDED' | 'MITERED' | 'BEVELED' {
  const raw = td.cornerType
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

function onShapeTypeChange(): void {
  if (suppressShapeTypeChange.value) return
  shapeParamsState.value = defaultShapeParamsForType(formEntity.shapeType)
}

function fillFormEntityFromSnapshot(s: PolylineVolumeSnapshot): void {
  formEntity.id = s.id
  const st = parseShapeTypeKey(s.shapeType)
  suppressShapeTypeChange.value = true
  formEntity.shapeType = st
  shapeParamsState.value = resolveShapeParamsFromTargetData({ ...s.targetData, shapeType: st }, st)
  void nextTick(() => {
    suppressShapeTypeChange.value = false
  })

  const td = s.targetData
  formEntity.cornerType = cornerTypeFromTd(td)
  const g = td.granularity
  formEntity.granularity =
    typeof g === 'number' && Number.isFinite(g) && g > 0 ? g : GRANULARITY_DEFAULT

  const fillCss =
    s.colorCss ?? (typeof td.color === 'string' && td.color.trim() ? td.color : undefined)
  const fillParsed = parseCssColorForForm(fillCss, DEFAULT_FILL)
  formEntity.color = fillParsed.hex
  const tdAlpha = typeof td.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined
  formEntity.alpha = tdAlpha ?? fillParsed.alpha
  formEntity.showFill = s.fill !== false

  formEntity.outline = s.outline === true
  const outCss =
    s.outlineColorCss ??
    (typeof td.outlineColor === 'string' && td.outlineColor.trim() ? td.outlineColor : undefined)
  const outParsed = parseCssColorForForm(outCss, DEFAULT_OUTLINE)
  formEntity.outlineColor = outParsed.hex
  const tdOA =
    typeof td.outlineAlpha === 'number' && Number.isFinite(td.outlineAlpha) ? td.outlineAlpha : undefined
  formEntity.outlineAlpha = tdOA ?? outParsed.alpha
  formEntity.outlineWidth = s.outlineWidth ?? 1
  formEntity.show = s.show !== false

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
  formEntity.shapeType = ShapeType.CIRCLE
  shapeParamsState.value = defaultShapeParamsForType(ShapeType.CIRCLE)
  formEntity.cornerType = 'ROUNDED'
  formEntity.granularity = GRANULARITY_DEFAULT
  formEntity.showFill = true
  formEntity.color = DEFAULT_FILL
  formEntity.alpha = 0.75
  formEntity.outline = false
  formEntity.outlineColor = DEFAULT_OUTLINE
  formEntity.outlineAlpha = 0.9
  formEntity.outlineWidth = 1
  formEntity.show = true
  draftVertices.value = []
}

function disarmPick(): void {
  vertexPickArmed.value = false
}

function onEntityRowClick(record: PolylineVolumeSnapshot): void {
  disarmPick()
  selectedEntityId.value = record.id
  const snap = window.XGX?.PolylineVolume?.getPolylineVolume(record.id)
  if (snap) fillFormEntityFromSnapshot(snap)
}

function onDeleteEntityRow(id: string, e: Event): void {
  e.stopPropagation()
  window.XGX?.PolylineVolume?.remove(id)
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
  message.info('已清空路径顶点')
}

const primaryEntityText = computed(() => (selectedEntityId.value ? '确定' : '标绘'))

function applyEntityUpdate(): void {
  const id = selectedEntityId.value
  const P = window.XGX?.PolylineVolume
  const v = mapStore.getViewer()
  if (!id || !P || !v || v.isDestroyed()) return
  if (draftVertices.value.length < 2) {
    message.warning('路径至少需要 2 个顶点')
    return
  }
  const ok = P.updatePolylineVolume(id, {
    positions: draftToPositions(),
    shapeType: formEntity.shapeType,
    shapeParams: shapeParamsState.value,
    cornerType: formEntity.cornerType,
    granularity: formEntity.granularity,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    fill: formEntity.showFill,
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    targetData: {
      cornerType: formEntity.cornerType,
      granularity: formEntity.granularity,
      alpha: formEntity.alpha,
      outlineAlpha: formEntity.outlineAlpha,
    },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else message.error('保存失败')
}

function addEntityFromForm(): void {
  if (draftVertices.value.length < 2) {
    message.warning('请至少添加 2 个路径顶点')
    return
  }
  const P = window.XGX?.PolylineVolume
  const v = mapStore.getViewer()
  if (!P || !v || v.isDestroyed()) return
  disarmPick()
  const idOpt = formEntity.id.trim() || undefined
  const entity = P.add(v, {
    id: idOpt,
    positions: draftToPositions(),
    shapeType: formEntity.shapeType,
    shapeParams: shapeParamsState.value,
    cornerType: formEntity.cornerType,
    granularity: formEntity.granularity,
    color: formEntity.color,
    alpha: fillAlphaForEntity(),
    fill: formEntity.showFill,
    outline: formEntity.outline,
    outlineColor: formEntity.outlineColor,
    outlineAlpha: formEntity.outlineAlpha,
    outlineWidth: formEntity.outlineWidth,
    show: formEntity.show,
    targetData: {
      cornerType: formEntity.cornerType,
      granularity: formEntity.granularity,
      alpha: formEntity.alpha,
      outlineAlpha: formEntity.outlineAlpha,
    },
  })
  if (!entity) {
    message.error('添加失败：请检查 id 是否重复或顶点是否有效')
    return
  }
  message.success('已添加折线体 Entity')
  refreshTable()
  resetFormEntity()
}

function onEntityPrimary(): void {
  if (selectedEntityId.value) applyEntityUpdate()
  else addEntityFromForm()
}

function onCancelEntitySelect(): void {
  selectedEntityId.value = null
  disarmPick()
  resetFormEntity()
}

function toggleVertexPick(): void {
  if (vertexPickArmed.value) {
    vertexPickArmed.value = false
    message.info('已取消地图添加顶点')
    return
  }
  vertexPickArmed.value = true
  message.info('请在地图上左键点击，依次追加路径顶点')
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!vertexPickArmed.value) return
  if (!Number.isFinite(pick.longitude) || !Number.isFinite(pick.latitude)) {
    message.warning('未能拾取到有效坐标')
    return
  }
  draftVertices.value.push({
    key: newVertexKey(),
    longitude: pick.longitude,
    latitude: pick.latitude,
    height: Number.isFinite(pick.height) ? pick.height : 0,
  })
  message.success(`已添加顶点（共 ${draftVertices.value.length} 个）`)
}

function bindMouse(v: Viewer): void {
  const Ctor = window.XGX?.MouseEvent as (new (viewer: Viewer) => MapMouseBinder) | undefined
  if (!Ctor) {
    message.error('window.XGX.MouseEvent 未就绪')
    return
  }
  mouseBinder?.destroy()
  const binder = new Ctor(v)
  binder.listen({ onLeftClick: onMapLeftClick })
  mouseBinder = binder
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

const columnsEntity: TableColumnType<PolylineVolumeSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  { title: '顶点数', dataIndex: 'positionsCount', key: 'positionsCount', width: 64, align: 'center' },
  { title: '截面', dataIndex: 'shapeType', key: 'shapeType', width: 88, align: 'center', ellipsis: true },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: PolylineVolumeSnapshot): string {
  return record.id === selectedEntityId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: PolylineVolumeSnapshot) {
  return { onClick: () => onEntityRowClick(record) }
}

onMounted(async () => {
  const v = await waitForMapViewer()
  if (!v) {
    message.warning('地图未能在预期时间内就绪')
    return
  }
  viewerRef = v
  refreshTable()
  bindMouse(v)
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
  mouseBinder?.destroy()
  mouseBinder = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.XGX?.PolylineVolume?.clear(v)
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
                  <span class="hzd-field-label">折线体 ID</span>
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
                  <span class="hzd-field-label">路径顶点</span>
                  <div class="hzd-field-control hzd-field-control--stack">
                    <div class="hzd-vertex-toolbar">
                      <span class="hzd-muted">至少 2 个点</span>
                      <a-tooltip title="清空路径顶点">
                        <a-button type="text" size="small" class="hzd-clear-ring-btn" aria-label="清空" @click="onClearDraftVertices">
                          <template #icon><ClearOutlined /></template>
                        </a-button>
                      </a-tooltip>
                    </div>
                    <p class="hzd-muted hzd-field-footnote">各点「高」为椭球高程（米）。折线体为绝对高度（heightReference = none）。</p>
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
                  <span class="hzd-field-label">截面形状</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="formEntity.shapeType"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="shapeTypeOptions"
                      @change="onShapeTypeChange"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
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
                  <span class="hzd-field-label">粒度 granularity</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="formEntity.granularity"
                      class="hzd-control-fill"
                      size="small"
                      :min="1e-6"
                      :step="0.001"
                      :controls="true"
                    />
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
            <div class="hzd-pane-title">折线体列表</div>
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
