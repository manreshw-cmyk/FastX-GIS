<script setup lang="ts">
import { keepAlternateDemoEntry } from './components/common/keepAlternateDemoEntry'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { AreaDrawStartParams, BoxSnapshot, LngLatHeight, MouseEventListenOptions, MouseEventPickPayload } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './components/common/drawFormColor'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Box）盒子/立方体类（底层entity）'

const DEFAULT_FILL = '#00bcd4'
const DEFAULT_OUTLINE = '#ffffff'

const mapStore = useMapLayerStore()

let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const plotArmed = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 0,
  dimX: 20000,
  dimY: 20000,
  dimZ: 20000,
  color: DEFAULT_FILL,
  alpha: 0.75,
  outline: true,
  outlineColor: DEFAULT_OUTLINE,
  outlineAlpha: 0.9,
  outlineWidth: 1,
  show: true,
})

const tableData = ref<BoxSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

type MapMouseBinder = {
  listen: (options: MouseEventListenOptions) => void
  destroy: () => void
}

let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

function syncBoxFromAnchors(points: LngLatHeight[]): void {
  if (points.length >= 1) {
    form.longitude = points[0]!.longitude
    form.latitude = points[0]!.latitude
    form.height = points[0]!.height ?? 0
  }
  if (points.length >= 2) {
    form.longitude = (points[0]!.longitude + points[1]!.longitude) / 2
    form.latitude = (points[0]!.latitude + points[1]!.latitude) / 2
    form.height = ((points[0]!.height ?? 0) + (points[1]!.height ?? 0)) / 2
  }
}

function buildBoxStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'box',
    id: form.id.trim() || undefined,
    height: 0,
    dimensions: [form.dimX, form.dimY, form.dimZ],
    color: form.color,
    alpha: form.alpha,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outline ? form.outlineWidth : 0,
    show: form.show,
    targetData: {
      fillColor: form.color,
      fillAlpha: form.alpha,
      outlineColor: form.outlineColor,
      outlineAlpha: form.outlineAlpha,
    },
    preview: {
      anchorPointColor: '#00bcd4',
      cursorPointColor: '#00bcd4',
      lineColor: form.color,
      fillColor: form.color,
      fillAlpha: form.alpha,
      outlineColor: form.outlineColor,
      outlineWidth: form.outlineWidth,
    },
    onAnchorChange: (points) => {
      syncBoxFromAnchors(points)
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
    if (result.shapeType !== 'box') return
    stopAreaDraw()
    message.success('已添加盒子')
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
  const B = window.FastX?.Box
  if (!v || v.isDestroyed() || !B) {
    tableData.value = []
    return
  }
  tableData.value = B.getAllBoxes(v)
  void nextTick(() => updateTableScrollY())
}

function fillFormFromSnapshot(s: BoxSnapshot): void {
  form.id = s.id
  form.longitude = s.longitude
  form.latitude = s.latitude
  form.height = s.height
  form.dimX = s.dimensions.x
  form.dimY = s.dimensions.y
  form.dimZ = s.dimensions.z
  const td = s.targetData
  const fillCss =
    s.fillColorCss ??
    (typeof td.fillColor === 'string' && td.fillColor.trim() ? String(td.fillColor) : undefined)
  const fillP = parseCssColorForForm(fillCss, DEFAULT_FILL)
  form.color = fillP.hex
  const tdA = typeof td.fillAlpha === 'number' && Number.isFinite(td.fillAlpha) ? td.fillAlpha : undefined
  form.alpha = tdA ?? fillP.alpha
  form.outline = s.outline !== false
  const outCss =
    s.outlineColorCss ??
    (typeof td.outlineColor === 'string' && td.outlineColor.trim() ? String(td.outlineColor) : undefined)
  const outP = parseCssColorForForm(outCss, DEFAULT_OUTLINE)
  form.outlineColor = outP.hex
  const tdOA =
    typeof td.outlineAlpha === 'number' && Number.isFinite(td.outlineAlpha) ? td.outlineAlpha : undefined
  form.outlineAlpha = tdOA ?? outP.alpha
  form.outlineWidth = s.outlineWidth ?? 1
  form.show = s.show
}

function resetFormToInitial(): void {
  form.id = ''
  form.longitude = 120.95
  form.latitude = 23.75
  form.height = 0
  form.dimX = 20000
  form.dimY = 20000
  form.dimZ = 20000
  form.color = DEFAULT_FILL
  form.alpha = 0.75
  form.outline = true
  form.outlineColor = DEFAULT_OUTLINE
  form.outlineAlpha = 0.9
  form.outlineWidth = 1
  form.show = true
}

function onCancelSelect(): void {
  selectedId.value = null
  plotArmed.value = false
  stopAreaDraw()
  resetFormToInitial()
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  if (field === 'color') form.color = normalizeHex(el.value, DEFAULT_FILL)
  else form.outlineColor = normalizeHex(el.value, DEFAULT_OUTLINE)
}

function onRowClick(record: BoxSnapshot): void {
  stopAreaDraw()
  plotArmed.value = false
  selectedId.value = record.id
  const snap = window.FastX?.Box?.getBox(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Box?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    plotArmed.value = false
    stopAreaDraw()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryButtonText = computed(() =>
  selectedId.value ? '确定' : isAreaDrawing.value ? '完成标绘' : '绘制',
)

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const B = window.FastX?.Box
  const v = mapStore.getViewer()
  if (!id || !B || !v || v.isDestroyed()) return
  const ok = B.updateBox(id, {
    longitude: form.longitude,
    latitude: form.latitude,
    height: form.height,
    dimensions: [form.dimX, form.dimY, form.dimZ],
    color: form.color,
    alpha: form.alpha,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outline ? form.outlineWidth : 0,
    show: form.show,
    targetData: { fillColor: form.color, fillAlpha: form.alpha, outlineColor: form.outlineColor, outlineAlpha: form.outlineAlpha },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败，请确认该盒子仍存在')
  }
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
  plotArmed.value = false
  const ok = am.start(v, buildBoxStartParams())
  if (!ok) {
    message.error('无法开始盒子绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')

  // --- Box 单类 add（不用空域管理时注释上一段，改用下方 onMapLeftClick）---
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!plotArmed.value || selectedId.value) return
  if (Number.isNaN(pick.longitude) || Number.isNaN(pick.latitude)) {
    message.warning('未能拾取到有效坐标，请点在地球可见区域后重试')
    return
  }
  const B = window.FastX?.Box
  const v = mapStore.getViewer()
  if (!B || !v || v.isDestroyed()) return

  const idOpt = form.id.trim() || undefined
  const entity = B.add(v, {
    id: idOpt,
    position: {
      longitude: pick.longitude,
      latitude: pick.latitude,
      height: Number.isNaN(pick.height) ? form.height : pick.height,
    },
    dimensions: [form.dimX, form.dimY, form.dimZ],
    color: form.color,
    alpha: form.alpha,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outline ? form.outlineWidth : 0,
    show: form.show,
    targetData: { fillColor: form.color, fillAlpha: form.alpha, outlineColor: form.outlineColor, outlineAlpha: form.outlineAlpha },
  })

  if (!entity) {
    message.error('添加失败：id 可能重复，请修改 id 后重新标绘')
    plotArmed.value = false
    return
  }
  plotArmed.value = false
  message.success('已添加盒子')
  refreshTable()
  resetFormToInitial()
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

const columns: TableColumnType<BoxSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 120, align: 'center' },
  {
    title: '经度(°)',
    dataIndex: 'longitude',
    key: 'longitude',
    width: 100,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '纬度(°)',
    dataIndex: 'latitude',
    key: 'latitude',
    width: 100,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '高度(m)',
    dataIndex: 'height',
    key: 'height',
    width: 80,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(1) : String(text)),
  },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: BoxSnapshot): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: BoxSnapshot) {
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
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) {
    tableResizeObserver.observe(tableShellRef.value)
  }
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
    window.FastX?.Box?.clear(v)
  }
})
keepAlternateDemoEntry(bindMouse)
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point map-tool-float--hzd-box">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">盒子 ID</span>
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
                  <span class="hzd-field-label">经度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.longitude"
                      class="hzd-control-fill"
                      size="small"
                      :step="0.0001"
                      :controls="true"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">纬度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.latitude"
                      class="hzd-control-fill"
                      size="small"
                      :step="0.0001"
                      :controls="true"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">长 X（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.dimX" class="hzd-control-fill" size="small" :min="1" :max="1e7" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">宽 Y（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.dimY" class="hzd-control-fill" size="small" :min="1" :max="1e7" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高 Z（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.dimZ" class="hzd-control-fill" size="small" :min="1" :max="1e7" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick('color', $event)" />
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
                      <input type="color" class="hzd-color-hit" :value="form.outlineColor" @input="onColorPick('outlineColor', $event)" />
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
                    <a-button
                      type="primary"
                      block
                      class="map-tool-primary-btn hzd-primary-tall"
                      @click="onPrimaryClick"
                    >
                      {{ primaryButtonText }}
                    </a-button>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">
                      取消选中
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">盒子列表</div>
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
  max-height: min(48vh, 440px);
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

.hzd-field-control :deep(.ant-input) {
  width: 100%;
}

.hzd-control-fill {
  width: 80% !important;
  max-width: 100%;
}

.hzd-color-native {
  position: relative;
  display: flex;
  justify-content: flex-end;
  width: 80%;
  min-height: 32px;
  cursor: pointer;
}

.hzd-color-hit {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.hzd-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
}

.hzd-slider-fill {
  width: 80%;
  margin: 0;
}

.hzd-actions-col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
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
