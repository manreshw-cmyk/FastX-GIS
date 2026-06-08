<script setup lang="ts">
import { DeleteOutlined, DownOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type {
  AreaDrawStartParams,
  HeatmapBounds,
  HeatmapCreateOptions,
  HeatmapDimension,
  HeatmapKind,
  HeatmapRenderType,
  HeatmapSnapshot,
  LngLatHeight,
} from '../../FastX'
import { DEFAULT_HEATMAP_GRADIENT, ensureHeatmapJs } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex } from './common/drawFormColor'
import { waitForMapViewer } from './common/useCoordinateDemo'

// ─── 常量 ───────────────────────────────────────────────

const title = '2/3维热力图'

/** 框选样式：与等高线分析一致 */
const BOX_LINE = '#59ff9b'
const BOX_FILL_ALPHA = 0.25

const KIND_LABEL: Record<HeatmapKind, string> = {
  '2d-mesh': '二维·网状',
  '2d-surface': '二维·面状',
  '3d-mesh': '三维·网状',
  '3d-surface': '三维·面状',
}

const dimensionOptions = [
  { value: '2d', label: '二维' },
  { value: '3d', label: '三维' },
] as const

const renderTypeOptions = [
  { value: 'mesh', label: '网状' },
  { value: 'surface', label: '面状' },
] as const

// ─── 状态 ───────────────────────────────────────────────

const mapStore = useMapLayerStore()
let areaManager = window.FastX?.AreaManager
let viewerRef: Viewer | null = null

/** 是否正在框选范围 */
const isAreaDrawing = ref(false)
/** 表格当前选中热力图 id */
const selectedId = ref<string | null>(null)
const tableData = ref<HeatmapSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

const dimension = ref<HeatmapDimension>('2d')
const renderType = ref<HeatmapRenderType>('surface')
/** 当前框选 / 编辑中的经纬度范围 */
const bounds = reactive<HeatmapBounds>({ west: 0, south: 0, east: 0, north: 0 })

/** 表单：样式与演示数据参数 */
const form = reactive({
  gridSize: 14,
  colorLow: DEFAULT_HEATMAP_GRADIENT[0]!.color,
  colorHigh: DEFAULT_HEATMAP_GRADIENT[4]!.color,
  opacity: 0.88,
  show: true,
  seed: 1,
})

const primaryButtonText = computed(() => {
  if (selectedId.value) return '确定'
  return isAreaDrawing.value ? '完成标绘' : '绘制'
})

// ─── 工具 ───────────────────────────────────────────────

function getHeatmapApi() {
  return window.FastX?.Heatmap
}

/** 由对角锚点更新 bounds */
function syncBoundsFromAnchors(points: LngLatHeight[]): void {
  if (points.length >= 1) {
    bounds.west = bounds.east = points[0]!.longitude
    bounds.south = bounds.north = points[0]!.latitude
  }
  if (points.length >= 2) {
    bounds.west = Math.min(points[0]!.longitude, points[1]!.longitude)
    bounds.east = Math.max(points[0]!.longitude, points[1]!.longitude)
    bounds.south = Math.min(points[0]!.latitude, points[1]!.latitude)
    bounds.north = Math.max(points[0]!.latitude, points[1]!.latitude)
  }
}

/** 组装 heatmap.js 色带与透明度 */
function buildStyle() {
  const max = form.opacity
  const gradient = DEFAULT_HEATMAP_GRADIENT.map((stop, i, arr) => ({
    ...stop,
    color: i === 0 ? form.colorLow : i === arr.length - 1 ? form.colorHigh : stop.color,
  }))
  return { gradient, minOpacity: max * 0.45, maxOpacity: max }
}

/** 校验范围并生成 FastX.Heatmap.create/update 参数 */
function buildHeatmapPayload(): HeatmapCreateOptions | null {
  const viewer = mapStore.getViewer()
  if (!viewer || viewer.isDestroyed()) return null
  if (Math.abs(bounds.east - bounds.west) < 1e-6 || Math.abs(bounds.north - bounds.south) < 1e-6) return null

  return {
    viewer,
    dimension: dimension.value,
    renderType: renderType.value,
    bounds: { ...bounds },
    gridCols: form.gridSize,
    gridRows: form.gridSize,
    style: buildStyle(),
    show: form.show,
    seed: form.seed,
  }
}

/** 矩形框选启动参数 */
function buildSelectStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'rectangle',
    extrudedHeight: 0,
    color: BOX_LINE,
    alpha: BOX_FILL_ALPHA,
    outline: true,
    outlineColor: BOX_LINE,
    outlineAlpha: 1,
    outlineWidth: 2,
    show: true,
    targetData: { showFill: true, heatmapSelect: true },
    preview: {
      anchorPointColor: BOX_LINE,
      cursorPointColor: BOX_LINE,
      lineColor: BOX_LINE,
      fillColor: BOX_LINE,
      fillAlpha: BOX_FILL_ALPHA,
    },
    onAnchorChange: (points) => {
      syncBoundsFromAnchors(points)
      if (!points.length) isAreaDrawing.value = false
    },
  }
}

// ─── 框选与 CRUD ─────────────────────────────────────────

function stopAreaDraw(): void {
  areaManager?.cancel()
  isAreaDrawing.value = false
}

function refreshTable(): void {
  const viewer = mapStore.getViewer()
  tableData.value = viewer && !viewer.isDestroyed() ? (getHeatmapApi()?.getAll(viewer) ?? []) : []
  void nextTick(updateTableScrollY)
}

function addHeatmapFromBounds(): void {
  const api = getHeatmapApi()
  const payload = buildHeatmapPayload()
  if (!api || !payload) {
    message.warning('请先框选有效范围')
    return
  }
  stopAreaDraw()
  const id = api.create(payload)
  if (!id) {
    message.error('热力图创建失败，请确认 heatmap.js 已加载')
    return
  }
  message.success('已添加热力图')
  refreshTable()
  resetFormToInitial()
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const api = getHeatmapApi()
  const payload = buildHeatmapPayload()
  if (!id || !api || !payload) return
  if (api.update(id, payload)) {
    // message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败，请确认该热力图仍存在')
  }
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }

  areaManager = window.FastX?.AreaManager
  if (!areaManager) {
    message.error('FastX.AreaManager 未就绪')
    return
  }

  if (isAreaDrawing.value) {
    if (areaManager.pointCount < 2) {
      message.warning('至少需要 2 个点（对角）')
      return
    }
    areaManager.end()
    isAreaDrawing.value = false
    return
  }

  const viewer = mapStore.getViewer()
  if (!viewer || viewer.isDestroyed()) {
    message.error('地图未就绪')
    return
  }
  if (!areaManager.start(viewer, buildSelectStartParams())) {
    message.error('无法开始框选')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')
}

function onCancelSelect(): void {
  selectedId.value = null
  stopAreaDraw()
  resetFormToInitial()
}

/** 递增 seed 并刷新选中项的随机演示数据 */
function onRegenerateSeed(): void {
  form.seed = (form.seed + 1) % 10000
  if (selectedId.value) applyUpdateToSelected()
}

function onColorPick(field: 'colorLow' | 'colorHigh', ev: Event): void {
  form[field] = normalizeHex((ev.target as HTMLInputElement).value, form[field])
}

function fillFormFromSnapshot(s: HeatmapSnapshot): void {
  bounds.west = s.bounds.west
  bounds.south = s.bounds.south
  bounds.east = s.bounds.east
  bounds.north = s.bounds.north
  form.gridSize = s.gridCols
  form.show = s.show
  const [dim, rt] = s.kind.split('-') as [HeatmapDimension, HeatmapRenderType]
  dimension.value = dim
  renderType.value = rt
}

function resetFormToInitial(): void {
  form.gridSize = 14
  form.colorLow = DEFAULT_HEATMAP_GRADIENT[0]!.color
  form.colorHigh = DEFAULT_HEATMAP_GRADIENT[4]!.color
  form.opacity = 0.88
  form.show = true
  form.seed = 1
  dimension.value = '2d'
  renderType.value = 'surface'
  bounds.west = bounds.south = bounds.east = bounds.north = 0
}

function onRowClick(record: HeatmapSnapshot): void {
  stopAreaDraw()
  selectedId.value = record.id
  fillFormFromSnapshot(record)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  getHeatmapApi()?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    stopAreaDraw()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

/** 框选完成后自动创建热力图 */
function setupAreaManagerPublish(): void {
  if (!areaManager) return
  areaManager.publish((result) => {
    if (result.shapeType !== 'rectangle') return
    stopAreaDraw()
    const snap = window.FastX?.Rectangle?.getRectangle(result.id)
    if (snap) {
      bounds.west = snap.west
      bounds.south = snap.south
      bounds.east = snap.east
      bounds.north = snap.north
    }
    window.FastX?.Rectangle?.remove(result.id)
    addHeatmapFromBounds()
  })
}

// ─── 表格 ───────────────────────────────────────────────

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const head = shell.querySelector('.ant-table-thead') as HTMLElement | null
  tableScrollY.value = Math.max(72, shell.clientHeight - (head?.offsetHeight ?? 40) - 6)
}

const columns: TableColumnType<HeatmapSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 88, align: 'center' },
  {
    title: '类型',
    key: 'kind',
    width: 88,
    align: 'center',
    customRender: ({ record }) => KIND_LABEL[record.kind] ?? record.kind,
  },
  {
    title: '网格',
    key: 'grid',
    width: 56,
    align: 'center',
    customRender: ({ record }) => `${record.gridCols}×${record.gridRows}`,
  },
  { title: '操作', key: 'action', width: 48, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: HeatmapSnapshot): string {
  return record.id === selectedId.value ? 'hzd-heatmap-row--active' : ''
}

function customTableRow(record: HeatmapSnapshot) {
  return { onClick: () => onRowClick(record) }
}

// ─── 生命周期 ───────────────────────────────────────────

onMounted(async () => {
  try {
    await ensureHeatmapJs()
  } catch {
    message.warning('heatmap.js 加载失败，请检查 src/FastX/build/vendor/heatmap/heatmap.min.js')
  }

  const viewer = await waitForMapViewer()
  if (!viewer) {
    message.warning('地图未能在预期时间内就绪')
    return
  }

  viewerRef = viewer
  areaManager = window.FastX?.AreaManager
  setupAreaManagerPublish()
  refreshTable()

  await nextTick()
  updateTableScrollY()
  tableResizeObserver = new ResizeObserver(updateTableScrollY)
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  stopAreaDraw()
  areaManager?.unpublish()
  const viewer = viewerRef
  viewerRef = null
  if (viewer && !viewer.isDestroyed()) getHeatmapApi()?.clear(viewer)
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point map-tool-float--hzd-heatmap">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <!-- 参数面板 -->
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">维度</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="dimension"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="[...dimensionOptions]"
                      :disabled="isAreaDrawing"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">形态</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="renderType"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="[...renderTypeOptions]"
                      :disabled="isAreaDrawing"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">网格密度</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.gridSize"
                      class="hzd-control-fill"
                      size="small"
                      :min="4"
                      :max="40"
                      :disabled="isAreaDrawing"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">低值色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.colorLow }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="form.colorLow"
                        :disabled="isAreaDrawing"
                        @input="onColorPick('colorLow', $event)"
                      />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高值色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.colorHigh }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="form.colorHigh"
                        :disabled="isAreaDrawing"
                        @input="onColorPick('colorHigh', $event)"
                      />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider
                      v-model:value="form.opacity"
                      :min="0.3"
                      :max="1"
                      :step="0.05"
                      class="hzd-slider-fill"
                      :disabled="isAreaDrawing"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" :disabled="isAreaDrawing" />
                  </div>
                </div>

                <p class="hzd-muted hzd-field-footnote">
                  二维贴地，三维带起伏。面状=三角面，网状=纹理线框。
                </p>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <a-button
                      type="primary"
                      block
                      class="map-tool-primary-btn hzd-primary-tall"
                      @click="onPrimaryClick"
                    >
                      {{ primaryButtonText }}
                    </a-button>
                    <a-button v-if="selectedId" block class="hzd-resample-btn" @click="onRegenerateSeed">
                      <ReloadOutlined class="hzd-resample-icon" />
                      <span>重新采样</span>
                    </a-button>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">
                      取消选中
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 列表 -->
          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">热力图列表</div>
            <div ref="tableShellRef" class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll">
              <a-table
                class="hzd-table"
                :columns="columns"
                :data-source="tableData"
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
@import '@/assets/styles/hzd-draw-panel.scss';

.hzd-muted {
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.48);
  margin: 4px 0 0;
}

.hzd-field-footnote {
  padding-right: 8%;
}

.hzd-resample-btn {
  min-height: 34px !important;
  height: 34px !important;
  margin-top: 2px;
  padding: 0 14px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px !important;
  font-weight: 500 !important;
  color: rgba(210, 255, 228, 0.96) !important;
  border: 1px solid rgba(89, 255, 155, 0.42) !important;
  border-radius: 8px !important;
  background: linear-gradient(180deg, rgba(89, 255, 155, 0.16), rgba(89, 255, 155, 0.05)) !important;
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
}

.hzd-resample-btn:hover {
  color: #fff !important;
  border-color: rgba(89, 255, 155, 0.72) !important;
  background: linear-gradient(180deg, rgba(89, 255, 155, 0.24), rgba(89, 255, 155, 0.1)) !important;
}

.hzd-resample-btn:active {
  transform: translateY(1px);
}

.hzd-resample-icon {
  font-size: 13px;
}

:deep(.hzd-heatmap-row--active) td {
  background: rgba(24, 144, 255, 0.18) !important;
}
</style>
