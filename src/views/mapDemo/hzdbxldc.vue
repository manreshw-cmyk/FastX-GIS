<script setup lang="ts">
import { ClearOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions, MouseEventPickPayload, PolygonSnapshot } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './components/common/drawFormColor'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Polygon）多边形类（底层entity）'

const DEFAULT_FILL_COLOR = '#52c41a'
const DEFAULT_OUTLINE_COLOR = '#ffffff'

const mapStore = useMapLayerStore()

/** 为 true 时下一次地图左键将顶点追加到外环列表 */
const vertexPickArmed = ref(false)
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
  extrudedHeight: 0,
  showFill: true,
  color: DEFAULT_FILL_COLOR,
  alpha: 1,
  outline: true,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineAlpha: 1,
  outlineWidth: 2,
  show: true,
})

const tableData = ref<PolygonSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
const vertexTableShellRef = ref<HTMLElement | null>(null)
const vertexTableScrollY = ref(96)
let tableResizeObserver: ResizeObserver | null = null
let vertexTableResizeObserver: ResizeObserver | null = null

type MapMouseBinder = {
  listen: (options: MouseEventListenOptions) => void
  destroy: () => void
}

let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 40
  const next = Math.floor(shell.clientHeight - headH - 6)
  tableScrollY.value = Math.max(72, next)
}

function updateVertexTableScrollY(): void {
  const shell = vertexTableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 32
  const next = Math.floor(shell.clientHeight - headH - 4)
  vertexTableScrollY.value = Math.max(48, next)
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  const P = window.FastX?.Polygon
  if (!v || v.isDestroyed() || !P) {
    tableData.value = []
    return
  }
  tableData.value = P.getAllPolygons(v)
  void nextTick(() => {
    updateTableScrollY()
    updateVertexTableScrollY()
  })
}

function polygonPositionsForForm(s: PolygonSnapshot): number[][] {
  if (Array.isArray(s.positions) && s.positions.length > 0) return s.positions
  const raw = s.targetData?.positions
  if (!Array.isArray(raw)) return []
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

function fillFormFromSnapshot(s: PolygonSnapshot): void {
  form.id = s.id
  form.extrudedHeight = s.extrudedHeight
  const td = s.targetData
  form.showFill = typeof td.showFill === 'boolean' ? td.showFill : s.showFill
  const fillCss =
    s.colorCss ?? (typeof td.color === 'string' && td.color.trim() ? String(td.color) : undefined)
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

  draftVertices.value = polygonPositionsForForm(s).map((p) => ({
    key: newVertexKey(),
    longitude: Number(p[0]),
    latitude: Number(p[1]),
    height: Number(p[2] ?? 0),
  }))
}

function resetFormToInitial(): void {
  form.id = ''
  form.extrudedHeight = 0
  form.showFill = true
  form.color = DEFAULT_FILL_COLOR
  form.alpha = 1
  form.outline = true
  form.outlineColor = DEFAULT_OUTLINE_COLOR
  form.outlineAlpha = 1
  form.outlineWidth = 2
  form.show = true
  draftVertices.value = []
}

function fillAlphaForApi(): number {
  return form.showFill ? form.alpha : 0
}

function hex6ForColorInput(css: string): string {
  const t = css.trim()
  if (t.startsWith('#') && t.length >= 7) return t.slice(0, 7)
  return '#000000'
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const fb = field === 'color' ? DEFAULT_FILL_COLOR : DEFAULT_OUTLINE_COLOR
  const hex = normalizeHex(el.value, fb)
  if (field === 'color') form.color = hex
  else form.outlineColor = hex
}

function disarmVertexPick(): void {
  vertexPickArmed.value = false
}

function onRowClick(record: PolygonSnapshot): void {
  disarmVertexPick()
  selectedId.value = record.id
  const snap = window.FastX?.Polygon?.getPolygon(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Polygon?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    disarmVertexPick()
    resetFormToInitial()
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
  message.info('已清空外环顶点列表')
}

const primaryButtonText = computed(() => (selectedId.value ? '确定' : '标绘'))

const pickVertexButtonType = computed(() => (vertexPickArmed.value ? ('primary' as const) : ('default' as const)))

function draftToPositions(): [number, number, number][] {
  return draftVertices.value.map((v) => [v.longitude, v.latitude, v.height])
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const P = window.FastX?.Polygon
  const v = mapStore.getViewer()
  if (!id || !P || !v || v.isDestroyed()) return
  if (draftVertices.value.length < 3) {
    message.warning('外环至少需要 3 个顶点')
    return
  }
  const ok = P.updatePolygon(id, {
    positions: draftToPositions(),
    extrudedHeight: form.extrudedHeight,
    color: form.color,
    alpha: fillAlphaForApi(),
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outlineWidth,
    show: form.show,
    targetData: { showFill: form.showFill },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败，请确认该多边形仍存在')
  }
}

function addPolygonFromForm(): void {
  if (draftVertices.value.length < 3) {
    message.warning('请先在地图上添加至少 3 个外环顶点，或选中列表项进行编辑')
    return
  }
  const P = window.FastX?.Polygon
  const v = mapStore.getViewer()
  if (!P || !v || v.isDestroyed()) return

  disarmVertexPick()
  const idOpt = form.id.trim() || undefined
  const entity = P.add(v, {
    id: idOpt,
    positions: draftToPositions(),
    extrudedHeight: form.extrudedHeight,
    color: form.color,
    alpha: fillAlphaForApi(),
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outlineWidth,
    show: form.show,
    targetData: { showFill: form.showFill },
  })

  if (!entity) {
    message.error('添加失败：id 可能重复或顶点无效，请检查后重试')
    return
  }
  message.success('已添加多边形')
  refreshTable()
  resetFormToInitial()
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }
  addPolygonFromForm()
}

function onCancelSelect(): void {
  selectedId.value = null
  disarmVertexPick()
  resetFormToInitial()
}

function onToggleVertexPick(): void {
  if (vertexPickArmed.value) {
    vertexPickArmed.value = false
    message.info('已取消地图添加顶点')
    return
  }
  vertexPickArmed.value = true
  message.info('请在地图上左键点击，依次追加外环顶点')
}

function isValidPickLonLat(pick: MouseEventPickPayload): boolean {
  return Number.isFinite(pick.longitude) && Number.isFinite(pick.latitude)
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!vertexPickArmed.value) return
  if (!isValidPickLonLat(pick)) {
    message.warning('未能拾取到有效坐标，请点击地球可见区域后重试')
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

const columns: TableColumnType<PolygonSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  { title: '顶点数', dataIndex: 'vertexCount', key: 'vertexCount', width: 64, align: 'center' },
  {
    title: '拉伸(m)',
    dataIndex: 'extrudedHeight',
    key: 'extrudedHeight',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(0) : String(text)),
  },
  {
    title: '填充',
    key: 'fill',
    width: 52,
    align: 'center',
    customRender: ({ record }) => (record.showFill !== false ? '开' : '关'),
  },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: PolygonSnapshot): string {
  return record.id === selectedId.value ? 'hzd-polygon-row--active' : ''
}

function customTableRow(record: PolygonSnapshot) {
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
  refreshTable()
  bindMouse(v)
  await nextTick()
  updateTableScrollY()
  updateVertexTableScrollY()
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) {
    tableResizeObserver.observe(tableShellRef.value)
  }
  vertexTableResizeObserver = new ResizeObserver(() => updateVertexTableScrollY())
  if (vertexTableShellRef.value) {
    vertexTableResizeObserver.observe(vertexTableShellRef.value)
  }
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  vertexTableResizeObserver?.disconnect()
  vertexTableResizeObserver = null
  mouseBinder?.destroy()
  mouseBinder = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.FastX?.Polygon?.clear(v)
  }
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-polygon">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">多边形 ID</span>
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

                <div class="hzd-field-row">
                  <span class="hzd-field-label">拉伸高度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.extrudedHeight"
                      class="hzd-control-fill"
                      size="small"
                      :step="10"
                      :controls="true"
                    />
                  </div>
                </div>

                <div class="hzd-field-row hzd-field-row--block">
                  <span class="hzd-field-label">外环顶点</span>
                  <div class="hzd-field-control hzd-field-control--stack">
                    <div class="hzd-vertex-toolbar">
                      <span class="hzd-muted">至少 3 个点</span>
                      <a-tooltip title="清空外环顶点">
                        <a-button
                          type="text"
                          size="small"
                          class="hzd-clear-ring-btn"
                          aria-label="清空外环顶点"
                          @click="onClearDraftVertices"
                        >
                          <template #icon><ClearOutlined /></template>
                        </a-button>
                      </a-tooltip>
                    </div>
                    <p class="hzd-muted hzd-field-footnote">
                      各点「高」为椭球高程（米）；相对地形高度需自行采样后写入。拉伸高度为整块多边形统一挤出。
                    </p>
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
                              <a-button
                                type="text"
                                danger
                                size="small"
                                class="hzd-del-btn"
                                aria-label="删除顶点"
                                @click="onDeleteDraftRow(record.key, $event)"
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
                  <span class="hzd-field-label">显示填充色</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.showFill" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="hex6ForColorInput(form.color)"
                        @input="onColorPick('color', $event)"
                      />
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
                      <a-tooltip :title="vertexPickArmed ? '取消添加顶点' : '地图添加顶点'">
                        <a-button
                          :type="pickVertexButtonType"
                          class="hzd-pick-coord-btn hzd-primary-tall"
                          aria-label="地图添加顶点"
                          @click="onToggleVertexPick"
                        >
                          <template #icon><EnvironmentOutlined /></template>
                        </a-button>
                      </a-tooltip>
                      <a-button type="primary" class="map-tool-primary-btn hzd-primary-tall hzd-primary-flex" @click="onPrimaryClick">
                        {{ primaryButtonText }}
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
            <div class="hzd-pane-title">多边形列表</div>
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
.map-tool-float--hzd-polygon :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-tool-float--hzd-polygon :deep(.x-dialog-inner) {
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
  max-height: min(52vh, 520px);
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

.hzd-field-control :deep(.ant-input) {
  width: 100%;
}

.hzd-field-control > .ant-space {
  width: 80%;
  justify-content: flex-end;
}

.hzd-muted {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
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
