<script setup lang="ts">
import { ClearOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import type { Viewer } from 'cesium'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type {
  AreaDrawShapeType,
  AreaDrawStartParams,
  LngLatHeight,
  PlotArrowSnapshot,
  UpdatePlotArrowProperties,
} from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './common/drawFormColor'
import { waitForMapViewer } from './common/useCoordinateDemo'

const title = '军事箭头标绘'
const DEFAULT_FILL_COLOR = '#ffcc33'
const DEFAULT_OUTLINE_COLOR = '#ffffff'

type ArrowShapeType = Extract<
  AreaDrawShapeType,
  | 'straightArrow'
  | 'fineStraightArrow'
  | 'curveArrow'
  | 'attackDirectionArrow'
  | 'doubleArrow'
  | 'swallowtailAttackArrow'
  | 'pincerArrow'
>

interface ArrowTypeOption {
  label: string
  value: ArrowShapeType
  entityName: string
  minPoints: number
}

interface DraftVertex {
  key: string
  longitude: number
  latitude: number
  height: number
}

interface ArrowTableRow extends PlotArrowSnapshot {
  shapeType: ArrowShapeType
  shapeLabel: string
}

interface RuntimeArrowApi {
  updatePlotArrow?: (id: string, patch: UpdatePlotArrowProperties) => boolean
  getAllPlotArrows?: (viewer?: Viewer) => PlotArrowSnapshot[]
  remove?: (id: string) => boolean | void
  clear?: (viewer?: Viewer) => void
}

const ARROW_TYPES: ArrowTypeOption[] = [
  {
    label: '直箭头',
    value: 'straightArrow',
    entityName: 'StraightArrow',
    minPoints: 2,
  },
  {
    label: '细直箭头',
    value: 'fineStraightArrow',
    entityName: 'FineStraightArrow',
    minPoints: 2,
  },
  {
    label: '曲线箭头',
    value: 'curveArrow',
    entityName: 'CurveArrow',
    minPoints: 2,
  },
  {
    label: '进攻方向箭头',
    value: 'attackDirectionArrow',
    entityName: 'AttackDirectionArrow',
    minPoints: 3,
  },
  {
    label: '双箭头',
    value: 'doubleArrow',
    entityName: 'DoubleArrow',
    minPoints: 3,
  },
  {
    label: '燕尾攻击箭头',
    value: 'swallowtailAttackArrow',
    entityName: 'SwallowtailAttackArrow',
    minPoints: 3,
  },
  {
    label: '钳击箭头',
    value: 'pincerArrow',
    entityName: 'PincerArrow',
    minPoints: 3,
  },
]

const mapStore = useMapLayerStore()
let am = window.FastX?.AreaManager
let viewerRef: Viewer | null = null
let tableResizeObserver: ResizeObserver | null = null
let vertexTableResizeObserver: ResizeObserver | null = null

const isAreaDrawing = ref(false)
const selectedId = ref<string | null>(null)
const selectedShapeType = ref<ArrowShapeType | null>(null)
const draftVertices = ref<DraftVertex[]>([])
const tableData = ref<ArrowTableRow[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const vertexTableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
const vertexTableScrollY = ref(96)

const form = reactive({
  id: '',
  shapeType: 'straightArrow' as ArrowShapeType,
  color: DEFAULT_FILL_COLOR,
  alpha: 0.55,
  showFill: true,
  outline: true,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineAlpha: 1,
  outlineWidth: 2,
  width: 0,
  headWidthRatio: 2.4,
  headLengthRatio: 0.24,
  neckWidthRatio: 0.82,
  tailWidthRatio: 0.72,
  swallowTailRatio: 0.85,
  curveSegments: 12,
  curveTension: 0.32,
  height: 0,
  clampToGround: false,
  show: true,
})

const shapeOptions = computed(() =>
  ARROW_TYPES.map((item) => ({
    label: item.label,
    value: item.value,
  })),
)

const currentArrowType = computed(() => ARROW_TYPES.find((item) => item.value === form.shapeType) ?? ARROW_TYPES[0]!)

const primaryButtonText = computed(() => {
  if (selectedId.value) return '确定'
  return isAreaDrawing.value ? '完成标绘' : '鼠标绘制'
})

function newVertexKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `av_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function getRuntimeApi(name: string): RuntimeArrowApi | undefined {
  return (window.FastX as unknown as Record<string, RuntimeArrowApi> | undefined)?.[name]
}

function entityApi(type = form.shapeType): RuntimeArrowApi | undefined {
  return getRuntimeApi((ARROW_TYPES.find((item) => item.value === type) ?? ARROW_TYPES[0]!).entityName)
}

function shapeLabel(type: ArrowShapeType): string {
  return ARROW_TYPES.find((item) => item.value === type)?.label ?? type
}

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  tableScrollY.value = Math.max(72, Math.floor(shell.clientHeight - (thead?.offsetHeight ?? 40) - 6))
}

function updateVertexTableScrollY(): void {
  const shell = vertexTableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  vertexTableScrollY.value = Math.max(48, Math.floor(shell.clientHeight - (thead?.offsetHeight ?? 32) - 4))
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  if (!v || v.isDestroyed()) {
    tableData.value = []
    return
  }

  const rows: ArrowTableRow[] = []
  for (const type of ARROW_TYPES) {
    for (const item of entityApi(type.value)?.getAllPlotArrows?.(v) ?? []) {
      rows.push({ ...item, shapeType: type.value, shapeLabel: type.label })
    }
  }
  tableData.value = rows
  void nextTick(() => {
    updateTableScrollY()
    updateVertexTableScrollY()
  })
}

function syncDraftVertices(points: LngLatHeight[]): void {
  draftVertices.value = points.map((point) => ({
    key: newVertexKey(),
    longitude: point.longitude,
    latitude: point.latitude,
    height: point.height ?? 0,
  }))
}

function positionsForApi(): number[][] {
  return draftVertices.value.map((point) => [point.longitude, point.latitude, point.height])
}

function fillAlphaForApi(): number {
  return form.showFill ? form.alpha : 0
}

function hex6ForColorInput(css: string): string {
  const value = css.trim()
  return value.startsWith('#') && value.length >= 7 ? value.slice(0, 7) : '#000000'
}

function buildArrowPatch(): UpdatePlotArrowProperties {
  return {
    positions: positionsForApi(),
    color: form.color,
    alpha: fillAlphaForApi(),
    showFill: form.showFill,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outlineWidth,
    width: form.width > 0 ? form.width : undefined,
    headWidthRatio: form.headWidthRatio,
    headLengthRatio: form.headLengthRatio,
    neckWidthRatio: form.neckWidthRatio,
    tailWidthRatio: form.tailWidthRatio,
    swallowTailRatio: form.swallowTailRatio,
    curveSegments: form.curveSegments,
    curveTension: form.curveTension,
    height: form.height,
    clampToGround: form.clampToGround,
    show: form.show,
    targetData: {
      shapeType: form.shapeType,
      shapeLabel: shapeLabel(form.shapeType),
      showFill: form.showFill,
    },
    style: {
      perPositionHeight: !form.clampToGround,
    },
  }
}

function buildStartParams(): AreaDrawStartParams {
  const patch = buildArrowPatch()
  return {
    shapeType: form.shapeType,
    id: form.id.trim() || undefined,
    ...patch,
    color: form.color,
    outlineColor: form.outlineColor,
    style: {
      perPositionHeight: !form.clampToGround,
    },
    preview: {
      anchorPointColor: form.color,
      cursorPointColor: form.color,
      lineColor: form.outlineColor,
      fillColor: form.color,
      fillAlpha: form.alpha,
      outlineColor: form.outlineColor,
      outlineWidth: form.outlineWidth,
    },
    onAnchorChange: (points) => {
      syncDraftVertices(points)
      if (points.length === 0) isAreaDrawing.value = false
    },
  }
}

function ensureEnoughPoints(): boolean {
  if (draftVertices.value.length >= currentArrowType.value.minPoints) return true
  message.warning(`${currentArrowType.value.label} 至少需要 ${currentArrowType.value.minPoints} 个控制点`)
  return false
}

function stopAreaDraw(): void {
  am?.cancel()
  isAreaDrawing.value = false
}

function clearSelection(): void {
  selectedId.value = null
  selectedShapeType.value = null
}

function resetFormToInitial(): void {
  form.id = ''
  form.shapeType = 'straightArrow'
  form.color = DEFAULT_FILL_COLOR
  form.alpha = 0.55
  form.showFill = true
  form.outline = true
  form.outlineColor = DEFAULT_OUTLINE_COLOR
  form.outlineAlpha = 1
  form.outlineWidth = 2
  form.width = 0
  form.headWidthRatio = 2.4
  form.headLengthRatio = 0.24
  form.neckWidthRatio = 0.82
  form.tailWidthRatio = 0.72
  form.swallowTailRatio = 0.85
  form.curveSegments = 12
  form.curveTension = 0.32
  form.height = 0
  form.clampToGround = false
  form.show = true
  draftVertices.value = []
}

function fillFormFromSnapshot(row: ArrowTableRow): void {
  form.id = row.id
  form.shapeType = row.shapeType
  const td = row.targetData ?? {}
  const fillColor = row.colorCss ?? (typeof td.color === 'string' ? td.color : undefined)
  const fillParsed = parseCssColorForForm(fillColor, DEFAULT_FILL_COLOR)
  form.color = fillParsed.hex
  form.alpha = typeof td.alpha === 'number' ? td.alpha : fillParsed.alpha
  form.showFill = typeof td.showFill === 'boolean' ? td.showFill : row.showFill
  form.outline = row.outline !== false
  const outlineColor = row.outlineColorCss ?? (typeof td.outlineColor === 'string' ? td.outlineColor : undefined)
  const outlineParsed = parseCssColorForForm(outlineColor, DEFAULT_OUTLINE_COLOR)
  form.outlineColor = outlineParsed.hex
  form.outlineAlpha = typeof td.outlineAlpha === 'number' ? td.outlineAlpha : outlineParsed.alpha
  form.outlineWidth = row.outlineWidth ?? 2
  form.width = typeof td.width === 'number' ? td.width : 0
  form.headWidthRatio = typeof td.headWidthRatio === 'number' ? td.headWidthRatio : form.headWidthRatio
  form.headLengthRatio = typeof td.headLengthRatio === 'number' ? td.headLengthRatio : form.headLengthRatio
  form.neckWidthRatio = typeof td.neckWidthRatio === 'number' ? td.neckWidthRatio : form.neckWidthRatio
  form.tailWidthRatio = typeof td.tailWidthRatio === 'number' ? td.tailWidthRatio : form.tailWidthRatio
  form.swallowTailRatio = typeof td.swallowTailRatio === 'number' ? td.swallowTailRatio : form.swallowTailRatio
  form.curveSegments = typeof td.curveSegments === 'number' ? td.curveSegments : form.curveSegments
  form.curveTension = typeof td.curveTension === 'number' ? td.curveTension : form.curveTension
  form.height = row.height ?? 0
  form.clampToGround = row.clampToGround
  form.show = row.show
  draftVertices.value = row.positions.map((point) => ({
    key: newVertexKey(),
    longitude: Number(point[0]),
    latitude: Number(point[1]),
    height: Number(point[2] ?? 0),
  }))
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const fallback = field === 'color' ? DEFAULT_FILL_COLOR : DEFAULT_OUTLINE_COLOR
  const value = normalizeHex(el.value, fallback)
  if (field === 'color') form.color = value
  else form.outlineColor = value
}

function clearVertices(): void {
  draftVertices.value = []
}

function removeVertex(index: number): void {
  draftVertices.value.splice(index, 1)
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const type = selectedShapeType.value
  if (!id || !type || !ensureEnoughPoints()) return

  const ok = entityApi(type)?.updatePlotArrow?.(id, buildArrowPatch()) === true
  if (ok) {
    message.success('已保存修改')
    refreshTable()
    return
  }
  message.error('保存失败，请确认对象仍存在')
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }
  if (isAreaDrawing.value) {
    am?.end()
    isAreaDrawing.value = false
    return
  }
  stopAreaDraw()
  const viewer = mapStore.getViewer()
  if (!viewer) {
    message.error('地图未初始化，无法开始箭头标绘')
    return
  }
  const ok = am?.start(viewer, buildStartParams())
  if (!ok) {
    message.error('无法开始箭头标绘')
    return
  }
  isAreaDrawing.value = true
}

function onCancelSelect(): void {
  clearSelection()
  stopAreaDraw()
  resetFormToInitial()
}

function onRowClick(row: ArrowTableRow): void {
  stopAreaDraw()
  selectedId.value = row.id
  selectedShapeType.value = row.shapeType
  fillFormFromSnapshot(row)
}

function onDeleteRow(row: ArrowTableRow, e: Event): void {
  e.stopPropagation()
  entityApi(row.shapeType)?.remove?.(row.id)
  if (selectedId.value === row.id) onCancelSelect()
  refreshTable()
  message.success('已删除')
}

function tableRowClassName(row: ArrowTableRow): string {
  return row.id === selectedId.value ? 'hzd-arrow-row--active' : ''
}

function customTableRow(row: ArrowTableRow) {
  return {
    onClick: () => onRowClick(row),
  }
}

function tableRowKey(row: ArrowTableRow): string {
  return `${row.shapeType}:${row.id}`
}

function setupAreaManagerPublish(): void {
  if (!am) return
  const allowed = new Set<AreaDrawShapeType>(ARROW_TYPES.map((item) => item.value))
  am.publish((result) => {
    if (!allowed.has(result.shapeType)) return
    stopAreaDraw()
    message.success('已添加箭头')
    refreshTable()
    clearSelection()
    resetFormToInitial()
  })
}

function clearAllArrows(viewer?: Viewer): void {
  for (const type of ARROW_TYPES) {
    entityApi(type.value)?.clear?.(viewer)
  }
}

const vertexColumns: TableColumnType<DraftVertex>[] = [
  { title: '#', key: 'idx', width: 42, align: 'center', customRender: ({ index }) => String(index + 1) },
  {
    title: '经度',
    dataIndex: 'longitude',
    key: 'longitude',
    width: 82,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '纬度',
    dataIndex: 'latitude',
    key: 'latitude',
    width: 82,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '高',
    dataIndex: 'height',
    key: 'height',
    width: 58,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(0) : String(text)),
  },
  { title: '', key: 'action', width: 42, align: 'center', fixed: 'right' },
]

const columns: TableColumnType<ArrowTableRow>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 108, align: 'center' },
  { title: '类型', dataIndex: 'shapeLabel', key: 'shapeLabel', width: 96, align: 'center' },
  { title: '点数', dataIndex: 'vertexCount', key: 'vertexCount', width: 54, align: 'center' },
  { title: '操作', key: 'action', width: 54, align: 'center', fixed: 'right' },
]

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
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
  vertexTableResizeObserver = new ResizeObserver(() => updateVertexTableScrollY())
  if (vertexTableShellRef.value) vertexTableResizeObserver.observe(vertexTableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  vertexTableResizeObserver?.disconnect()
  vertexTableResizeObserver = null
  am?.cancel()
  am?.unpublish()
  isAreaDrawing.value = false
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) clearAllArrows(v)
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-arrow">
    <XDialog :width="600" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">箭头 ID</span>
                  <div class="hzd-field-control">
                    <a-input
                      v-model:value="form.id"
                      class="hzd-control-fill"
                      size="small"
                      allow-clear
                      placeholder="可选，留空自动生成"
                      :disabled="!!selectedId"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">箭头类型</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.shapeType"
                      class="hzd-control-fill hzd-select-like-input"
                      popup-class-name="hzd-select-dropdown-dark"
                      size="small"
                      :options="shapeOptions"
                      :disabled="!!selectedId"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="hex6ForColorInput(form.color)" @input="onColorPick('color', $event)" />
                    </label>
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示填充</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.showFill" size="small" />
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
                        :value="hex6ForColorInput(form.outlineColor)"
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
                    <a-input-number v-model:value="form.outlineWidth" class="hzd-control-fill" size="small" :min="0" :step="1" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示轮廓</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.outline" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">基础宽度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.width" class="hzd-control-fill" size="small" :min="0" :step="100" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">箭头宽比</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.headWidthRatio" :min="1" :max="4" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">箭头长比</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.headLengthRatio" :min="0.08" :max="0.48" :step="0.01" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">箭颈宽比</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.neckWidthRatio" :min="0.2" :max="1.4" :step="0.02" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">箭尾宽比</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.tailWidthRatio" :min="0.1" :max="1.2" :step="0.02" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">燕尾深度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.swallowTailRatio" :min="0" :max="1.5" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">曲线采样</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.curveSegments" class="hzd-control-fill" size="small" :min="4" :max="48" :step="1" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">曲线张力</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.curveTension" :min="0" :max="1.2" :step="0.02" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">绘制高度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :step="1000" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">贴地</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.clampToGround" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">控制点</span>
                  <div class="hzd-field-control">
                    <div class="hzd-vertex-toolbar">
                      <span class="hzd-muted">{{ draftVertices.length }} / {{ currentArrowType.minPoints }}</span>
                      <a-button class="hzd-clear-ring-btn" type="text" size="small" title="清空" @click="clearVertices">
                        <template #icon><ClearOutlined /></template>
                      </a-button>
                    </div>
                  </div>
                </div>

                <div class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll hzd-vertex-table-wrap" ref="vertexTableShellRef">
                  <a-table
                    class="hzd-table hzd-table--compact"
                    size="small"
                    :columns="vertexColumns"
                    :data-source="draftVertices"
                    :pagination="false"
                    :scroll="{ y: vertexTableScrollY, x: 306 }"
                    row-key="key"
                  >
                    <template #bodyCell="{ column, index }">
                      <template v-if="column.key === 'action'">
                        <a-button class="hzd-del-btn" type="text" size="small" title="删除" @click.stop="removeVertex(index)">
                          <template #icon><DeleteOutlined /></template>
                        </a-button>
                      </template>
                    </template>
                  </a-table>
                </div>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <a-button type="primary" block class="hzd-primary-tall" @click="onPrimaryClick">
                      {{ primaryButtonText }}
                    </a-button>
                    <a-button v-if="selectedId || isAreaDrawing" type="link" class="hzd-cancel-select" @click="onCancelSelect">
                      取消
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">对象列表</div>
            <div class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll" ref="tableShellRef">
              <a-table
                class="hzd-table"
                size="small"
                :columns="columns"
                :data-source="tableData"
                :pagination="false"
                :scroll="{ y: tableScrollY, x: 384 }"
                :row-class-name="tableRowClassName"
                :custom-row="customTableRow"
                :row-key="tableRowKey"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'action'">
                    <a-button class="hzd-del-btn" type="text" size="small" title="删除" @click="onDeleteRow(record, $event)">
                      <template #icon><DeleteOutlined /></template>
                    </a-button>
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
.map-tool-float--hzd-arrow {
  pointer-events: auto;
}

.map-tool-float--hzd-arrow :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-tool-float--hzd-arrow :deep(.x-dialog-inner) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 10px;
}

.hzd-dialog-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.88);
}

.hzd-dialog-body > .map-tool-head {
  flex-shrink: 0;
}

.hzd-page-title {
  margin-bottom: 8px;
}

.hzd-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  max-height: min(58vh, 560px);
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
  flex: 0 0 auto;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
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
  grid-template-columns: 1fr;
  min-height: 0;
}

.hzd-field-row--actions .hzd-actions-col {
  grid-column: 1 / -1;
  width: 100%;
}

.hzd-field-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
}

.hzd-field-control {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.hzd-field-control .hzd-control-fill,
.hzd-field-control :deep(.ant-input),
.hzd-field-control :deep(.ant-input-number),
.hzd-field-control :deep(.ant-input-affix-wrapper),
.hzd-field-control :deep(.ant-select) {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input),
.hzd-field-control :deep(.ant-select-selector),
.hzd-field-control :deep(.ant-input-number),
.hzd-field-control :deep(.ant-input-affix-wrapper) {
  min-height: 28px !important;
  background: rgba(2, 12, 24, 0.56) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  box-shadow: none !important;
}

.hzd-field-control :deep(.ant-input-number-input),
.hzd-field-control :deep(.ant-input),
.hzd-field-control :deep(.ant-select-selection-item) {
  color: rgba(255, 255, 255, 0.88) !important;
}

.hzd-field-control :deep(.ant-input-affix-wrapper > input.ant-input) {
  width: 100% !important;
  min-height: 0 !important;
  background: transparent !important;
  border: 0 !important;
}

.hzd-field-control :deep(.ant-input-number-handler-wrap) {
  background: rgba(255, 255, 255, 0.04) !important;
  border-left-color: rgba(255, 255, 255, 0.1) !important;
}

.hzd-field-control :deep(.ant-input-number-handler) {
  border-color: rgba(255, 255, 255, 0.08) !important;
}

.hzd-field-control :deep(.ant-input-number-handler-up-inner),
.hzd-field-control :deep(.ant-input-number-handler-down-inner) {
  color: rgba(255, 255, 255, 0.52) !important;
}

.hzd-field-control :deep(.ant-input:hover),
.hzd-field-control :deep(.ant-input-number:hover),
.hzd-field-control :deep(.ant-input-affix-wrapper:hover),
.hzd-field-control :deep(.ant-select-selector:hover) {
  border-color: rgba(104, 166, 255, 0.48) !important;
}

.hzd-field-control :deep(.ant-input:focus),
.hzd-field-control :deep(.ant-input-focused),
.hzd-field-control :deep(.ant-input-number-focused),
.hzd-field-control :deep(.ant-input-affix-wrapper-focused),
.hzd-field-control :deep(.ant-select-focused .ant-select-selector) {
  border-color: rgba(104, 166, 255, 0.72) !important;
  box-shadow: 0 0 0 2px rgba(80, 145, 235, 0.18) !important;
}

.hzd-field-control :deep(.ant-select-arrow),
.hzd-field-control :deep(.ant-input-clear-icon) {
  color: rgba(255, 255, 255, 0.55) !important;
}

.hzd-field-control :deep(.ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.35) !important;
}

.hzd-muted {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.hzd-color-native {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 80%;
  min-height: 32px;
  cursor: pointer;
}

.hzd-color-hit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: 0;
  padding: 0;
}

.hzd-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2) inset;
}

.hzd-slider-fill {
  width: 80%;
  max-width: 100%;
  margin: 0;
}

.hzd-vertex-toolbar {
  width: 80%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.hzd-clear-ring-btn,
.hzd-del-btn {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
}

.hzd-clear-ring-btn {
  color: rgba(255, 255, 255, 0.68) !important;
}

.hzd-del-btn {
  color: rgba(255, 130, 130, 0.95) !important;
}

.hzd-del-btn:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
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

.hzd-vertex-table-wrap :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-vertex-table-wrap :deep(.ant-table-thead > tr > th),
.hzd-vertex-table-wrap :deep(.ant-table-tbody > tr > td) {
  text-align: center !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.78) !important;
}

.hzd-vertex-table-wrap :deep(.ant-table-thead > tr > th) {
  padding: 6px 4px !important;
  background: rgba(255, 255, 255, 0.055) !important;
  font-size: 11px;
  font-weight: 600 !important;
  color: rgba(255, 255, 255, 0.72) !important;
}

.hzd-vertex-table-wrap :deep(.ant-table-tbody > tr > td) {
  padding: 5px 4px !important;
  background: rgba(0, 0, 0, 0.12) !important;
  font-size: 11px;
}

.hzd-vertex-table-wrap :deep(.ant-table-body)::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.hzd-vertex-table-wrap :deep(.ant-table-body)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
}

.hzd-vertex-table-wrap :deep(.ant-table-body)::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-vertex-table-wrap :deep(.ant-table-body)::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
}

.hzd-vertex-table-wrap :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(60, 130, 210, 0.16) !important;
}

.hzd-vertex-table-wrap :deep(.ant-empty-description) {
  color: rgba(255, 255, 255, 0.45) !important;
}

.hzd-actions-col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: stretch;
}

.hzd-primary-tall {
  min-height: 35px !important;
  height: 35px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}

.hzd-cancel-select {
  align-self: center;
  height: auto !important;
  padding: 0 4px !important;
  color: rgba(255, 255, 255, 0.58) !important;
}

.hzd-table-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hzd-table :deep(.ant-table),
.hzd-table :deep(.ant-table-container),
.hzd-table :deep(.ant-table-content) {
  background: transparent !important;
}

.hzd-table :deep(.ant-table-thead > tr > th),
.hzd-table :deep(.ant-table-tbody > tr > td) {
  text-align: center !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.78) !important;
}

.hzd-table :deep(.ant-table-thead > tr > th) {
  padding: 8px 6px !important;
  background: rgba(255, 255, 255, 0.055) !important;
  font-weight: 600 !important;
  color: rgba(255, 255, 255, 0.72) !important;
}

.hzd-table :deep(.ant-table-tbody > tr > td) {
  padding: 7px 6px !important;
  background: rgba(0, 0, 0, 0.12) !important;
}

.hzd-table :deep(.ant-table-cell-fix-left),
.hzd-table :deep(.ant-table-cell-fix-right) {
  background: rgba(3, 14, 28, 0.92) !important;
}

.hzd-table--compact :deep(.ant-table-thead > tr > th) {
  padding: 6px 4px !important;
  font-size: 11px;
}

.hzd-table--compact :deep(.ant-table-tbody > tr > td) {
  padding: 5px 4px !important;
  font-size: 11px;
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

.hzd-table-area--scroll :deep(.ant-table-body) {
  flex: 1;
  overflow: auto !important;
  background: rgba(0, 0, 0, 0.16) !important;
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

.hzd-table :deep(.hzd-arrow-row--active > td),
.hzd-arrow-row--active :deep(td) {
  background: rgba(24, 144, 255, 0.16) !important;
}

.hzd-table :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(60, 130, 210, 0.16) !important;
}

.hzd-table :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-left),
.hzd-table :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-right) {
  background: rgba(46, 110, 190, 0.24) !important;
}

.hzd-table :deep(.ant-table-placeholder) {
  background: rgba(0, 0, 0, 0.12) !important;
}

.hzd-table :deep(.ant-empty-description) {
  color: rgba(255, 255, 255, 0.45) !important;
}
</style>
