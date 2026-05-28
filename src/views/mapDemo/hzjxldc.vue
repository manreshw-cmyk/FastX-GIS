<script setup lang="ts">
import { keepAlternateDemoEntry } from './components/common/keepAlternateDemoEntry'
import { DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { AreaDrawStartParams, LngLatHeight, RectangleSnapshot } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './components/common/drawFormColor'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Rectangle）矩形类（底层entity）'
const DEFAULT_FILL_COLOR = '#13c2c2'
const DEFAULT_OUTLINE_COLOR = '#ffffff'

const mapStore = useMapLayerStore()
let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  west: null as number | null,
  south: null as number | null,
  east: null as number | null,
  north: null as number | null,
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

const tableData = ref<RectangleSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

let viewerRef: Viewer | null = null

function syncRectangleFromAnchors(points: LngLatHeight[]): void {
  if (points.length >= 1) {
    form.west = points[0]!.longitude
    form.south = points[0]!.latitude
    form.east = points[0]!.longitude
    form.north = points[0]!.latitude
  }
  if (points.length >= 2) {
    form.west = Math.min(points[0]!.longitude, points[1]!.longitude)
    form.east = Math.max(points[0]!.longitude, points[1]!.longitude)
    form.south = Math.min(points[0]!.latitude, points[1]!.latitude)
    form.north = Math.max(points[0]!.latitude, points[1]!.latitude)
  }
}

function buildRectangleStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'rectangle',
    id: form.id.trim() || undefined,
    extrudedHeight: form.extrudedHeight,
    color: form.color,
    alpha: fillAlphaForApi(),
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outlineWidth,
    show: form.show,
    targetData: { showFill: form.showFill },
    preview: {
      anchorPointColor: '#13c2c2',
      cursorPointColor: '#13c2c2',
      lineColor: form.color,
      fillColor: form.color,
      fillAlpha: form.alpha,
    },
    onAnchorChange: (points) => {
      syncRectangleFromAnchors(points)
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
    if (result.shapeType !== 'rectangle') return
    stopAreaDraw()
    message.success('已添加矩形')
    refreshTable()
    resetFormToInitial()
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
  const R = window.FastX?.Rectangle
  if (!v || v.isDestroyed() || !R) {
    tableData.value = []
    return
  }
  tableData.value = R.getAllRectangles(v)
  void nextTick(() => updateTableScrollY())
}

function fillFormFromSnapshot(s: RectangleSnapshot): void {
  form.id = s.id
  form.west = s.west
  form.south = s.south
  form.east = s.east
  form.north = s.north
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
}

function resetFormToInitial(): void {
  form.id = ''
  form.west = null
  form.south = null
  form.east = null
  form.north = null
  form.extrudedHeight = 0
  form.showFill = true
  form.color = DEFAULT_FILL_COLOR
  form.alpha = 1
  form.outline = true
  form.outlineColor = DEFAULT_OUTLINE_COLOR
  form.outlineAlpha = 1
  form.outlineWidth = 2
  form.show = true
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

function onRowClick(record: RectangleSnapshot): void {
  stopAreaDraw()
  selectedId.value = record.id
  const snap = window.FastX?.Rectangle?.getRectangle(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Rectangle?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    stopAreaDraw()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryButtonText = computed(() => (selectedId.value ? '确定' : isAreaDrawing.value ? '完成标绘' : '绘制'))

function boundsReady(): boolean {
  return (
    form.west != null &&
    form.south != null &&
    form.east != null &&
    form.north != null &&
    Number.isFinite(form.west) &&
    Number.isFinite(form.south) &&
    Number.isFinite(form.east) &&
    Number.isFinite(form.north)
  )
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const R = window.FastX?.Rectangle
  const v = mapStore.getViewer()
  if (!id || !R || !v || v.isDestroyed()) return
  if (!boundsReady()) {
    message.warning('请填写或拾取完整的西、南、东、北边界后再保存')
    return
  }
  const ok = R.updateRectangle(id, {
    west: form.west!,
    south: form.south!,
    east: form.east!,
    north: form.north!,
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
    message.error('保存失败，请确认该矩形仍存在')
  }
}

function addRectangleFromForm(): void {
  if (!boundsReady()) {
    message.warning('请填写或拾取西、南、东、北边界后再标绘')
    return
  }
  const R = window.FastX?.Rectangle
  const v = mapStore.getViewer()
  if (!R || !v || v.isDestroyed()) return

  stopAreaDraw()
  const idOpt = form.id.trim() || undefined
  const entity = R.add(v, {
    id: idOpt,
    west: form.west!,
    south: form.south!,
    east: form.east!,
    north: form.north!,
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
    message.error('添加失败：id 可能重复或边界无效')
    return
  }
  message.success('已添加矩形')
  refreshTable()
  form.id = ''
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
      message.warning('至少需要 2 个点（对角）')
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
  form.west = null
  form.south = null
  form.east = null
  form.north = null
  const ok = am.start(v, buildRectangleStartParams())
  if (!ok) {
    message.error('无法开始矩形绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')
  // --- Rectangle 单类 add（不用空域管理时注释上一段，改用下方）---
  // addRectangleFromForm()
}

function onCancelSelect(): void {
  selectedId.value = null
  stopAreaDraw()
  resetFormToInitial()
}

const columns: TableColumnType<RectangleSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 96, align: 'center' },
  {
    title: '西°',
    dataIndex: 'west',
    key: 'west',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '南°',
    dataIndex: 'south',
    key: 'south',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '东°',
    dataIndex: 'east',
    key: 'east',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '北°',
    dataIndex: 'north',
    key: 'north',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '拉伸(m)',
    key: 'extrudedHeight',
    width: 64,
    align: 'center',
    customRender: ({ record }) => (typeof record.extrudedHeight === 'number' ? record.extrudedHeight.toFixed(0) : ''),
  },
  { title: '操作', key: 'action', width: 48, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: RectangleSnapshot): string {
  return record.id === selectedId.value ? 'hzd-rectangle-row--active' : ''
}

function customTableRow(record: RectangleSnapshot) {
  return { onClick: () => onRowClick(record) }
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
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  am?.cancel()
  am?.unpublish()
  isAreaDrawing.value = false
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) window.FastX?.Rectangle?.clear(v)
})
keepAlternateDemoEntry(addRectangleFromForm)
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-rectangle">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">矩形 ID</span>
                  <div class="hzd-field-control">
                    <a-input v-model:value="form.id" class="hzd-control-fill" size="small" allow-clear placeholder="可选" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">西界（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.west" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">南界（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.south" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">东界（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.east" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">北界（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.north" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">拉伸高度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.extrudedHeight" class="hzd-control-fill" size="small" :step="10" :controls="true" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示填充</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.showFill" size="small" />
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
                  <span class="hzd-field-label">轮廓线</span>
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

                <p class="hzd-muted hzd-field-footnote">西≤东、南≤北会自动校正；跨日界线等复杂范围需自行保证边界合法。</p>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <div class="hzd-actions-primary-row">
                      <!-- 原角点拾取按钮：已由「绘制」直接 am.start
                      <a-tooltip title="拾取西南角（西、南）">
                        <a-button :type="pickSwType" class="hzd-pick-coord-btn hzd-primary-tall" aria-label="拾取西南" @click="togglePick('sw')">
                          <template #icon><EnvironmentOutlined /></template>
                        </a-button>
                      </a-tooltip>
                      <a-tooltip title="拾取东北角（东、北）">
                        <a-button :type="pickNeType" class="hzd-pick-coord-btn hzd-primary-tall" aria-label="拾取东北" @click="togglePick('ne')">
                          <template #icon><EnvironmentOutlined /></template>
                        </a-button>
                      </a-tooltip>
                      -->
                      <a-button type="primary" class="map-tool-primary-btn hzd-primary-tall hzd-primary-flex" @click="onPrimaryClick">
                        {{ primaryButtonText }}
                      </a-button>
                    </div>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">取消选中</a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">矩形列表</div>
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
.map-tool-float--hzd-rectangle :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.map-tool-float--hzd-rectangle :deep(.x-dialog-inner) {
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
  max-height: min(50vh, 460px);
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
}
.hzd-field-row--actions .hzd-actions-col {
  grid-column: 1 / -1;
  width: 100%;
}
.hzd-field-label {
  font-size: 12px;
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
.hzd-field-control :deep(.ant-input) {
  width: 100%;
}
.hzd-muted {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}
.hzd-field-footnote {
  margin: 0;
  line-height: 1.45;
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
}
.hzd-color-hit {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}
.hzd-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
}
.hzd-slider-fill {
  width: 80%;
  max-width: 100%;
  margin: 0;
}
.hzd-actions-col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 0 !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}
.hzd-cancel-select {
  color: rgba(255, 255, 255, 0.55) !important;
  align-self: center;
}
.hzd-del-btn {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  color: rgba(255, 130, 130, 0.95) !important;
}
.hzd-table :deep(.ant-table-thead > tr > th),
.hzd-table :deep(.ant-table-tbody > tr > td) {
  text-align: center !important;
  font-size: 12px;
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
}
</style>
