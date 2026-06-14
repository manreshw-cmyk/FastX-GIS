<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions } from '../../FastX/MouseEvent'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex } from './common/drawFormColor'
import { waitForMapViewer } from './common/useCoordinateDemo'
import PolygonDiffusionWall from '../../FastX/SpecialEffects/PolygonDiffusionWall'

let api: PolygonDiffusionWall | null = null
function getApi(): PolygonDiffusionWall {
  if (!api) api = new PolygonDiffusionWall()
  return api
}

const title = '多边形扩散墙'

type MouseBinder = {
  listen(options: MouseEventListenOptions, rightDoubleClickMs?: number): void
  destroy(): void
}
type MouseBinderCtor = new (viewer: Viewer) => MouseBinder

interface SfxRow {
  id: string
  longitude: number
  latitude: number
  height: number
}



function rgbaCss(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function positionAtZeroHeight(form: { longitude: number; latitude: number }) {
  return { longitude: form.longitude, latitude: form.latitude, height: 0 }
}

interface WallForm extends SfxRow {
  radius: number
  edge: number
  height: number
  speed: number
  minRadius: number
  duration: number
  color: string
  colorAlpha: number
  show: boolean
}

function createDefaultForm(): WallForm {
  return { id: '', longitude: 120.95, latitude: 23.75, height: 10000, radius: 1000000, edge: 3, speed: 5, minRadius: 10, duration: 1600, color: '#ffff00', colorAlpha: 1, show: true }
}

function buildOptions(form: WallForm) {
  return {
    id: form.id.trim() || undefined,
    center: positionAtZeroHeight(form),
    radius: form.radius,
    edge: form.edge,
    height: form.height,
    speed: form.speed,
    minRadius: form.minRadius,
    duration: form.duration,
    color: rgbaCss(form.color, form.colorAlpha),
    show: form.show,
  }
}

const mapStore = useMapLayerStore()
const selectedId = ref<string | null>(null)
const isDrawing = ref(false)
const hasMapPick = ref(false)
const form = reactive(createDefaultForm())
const tableData = ref<WallForm[]>([])
const storedById = new Map<string, WallForm>()
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null
let mouseBinder: MouseBinder | null = null

function updateTableScrollY(): void {
  const shell = tableShellRef.value
  if (!shell) return
  const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
  const headH = thead?.offsetHeight ?? 40
  const next = Math.floor(shell.clientHeight - headH - 6)
  tableScrollY.value = Math.max(72, next)
}

function refreshTable(): void {
  tableData.value = [...storedById.values()]
  void nextTick(() => updateTableScrollY())
}

function resetFormToInitial(): void {
  Object.assign(form, createDefaultForm())
  hasMapPick.value = false
}

function syncFormFromPick(longitude: number, latitude: number, _height: number): void {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
  form.longitude = longitude
  form.latitude = latitude
  hasMapPick.value = true
}

function stopDraw(): void {
  isDrawing.value = false
  mouseBinder?.destroy()
  mouseBinder = null
}

function bindMouseDraw(viewer: Viewer): void {
  mouseBinder?.destroy()
  const Ctor = window.FastX?.MouseEvent as MouseBinderCtor | undefined
  if (!Ctor) {
    message.error('window.FastX.MouseEvent 未就绪')
    return
  }
  mouseBinder = new Ctor(viewer)
  mouseBinder.listen({
    onLeftClick: (pick) => {
      if (!isDrawing.value) return
      syncFormFromPick(pick.longitude, pick.latitude, pick.height ?? 0)
    },
  })
}

function commitAdd(): boolean {
  const viewer = mapStore.getViewer()
  if (!viewer || viewer.isDestroyed()) {
    message.error('地图未就绪')
    return false
  }
  if (!hasMapPick.value && !selectedId.value) {
    message.warning('请先在地图上左键拾取位置')
    return false
  }
  const id = getApi().add(viewer, buildOptions(form))
  if (!id) {
    message.error('添加失败，请检查 id 是否重复或参数是否有效')
    return false
  }
  storedById.set(id, { ...form, id } as WallForm)
  message.success('已添加特效')
  refreshTable()
  resetFormToInitial()
  stopDraw()
  return true
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  if (!id) return
  const ok = getApi().update(id, buildOptions(form))
  if (!ok) {
    message.error('保存失败，请确认该特效仍存在')
    return
  }
  storedById.set(id, { ...form, id } as WallForm)
  message.success('已保存修改')
  refreshTable()
}

const primaryButtonText = computed(() => {
  if (selectedId.value) return '确定'
  return isDrawing.value ? '完成标绘' : '绘制'
})

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }
  if (isDrawing.value) {
    commitAdd()
    return
  }
  const viewer = mapStore.getViewer()
  if (!viewer || viewer.isDestroyed()) {
    message.error('地图未就绪')
    return
  }
  isDrawing.value = true
  hasMapPick.value = false
  bindMouseDraw(viewer)
  message.info('鼠标左键拾取位置，再次点击「完成标绘」落图')
}

function onCancelSelect(): void {
  selectedId.value = null
  stopDraw()
  resetFormToInitial()
}

function onRowClick(record: WallForm): void {
  stopDraw()
  selectedId.value = record.id
  const stored = storedById.get(record.id)
  if (!stored) return
  Object.assign(form, { ...stored })
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation();
  getApi().remove(id)
  storedById.delete(id)
  if (selectedId.value === id) {
    selectedId.value = null
    stopDraw()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const columns: TableColumnType<WallForm>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 138, align: 'center' },
  { title: '经度(°)', dataIndex: 'longitude', key: 'longitude', width: 108, align: 'center', customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)) },
  { title: '纬度(°)', dataIndex: 'latitude', key: 'latitude', width: 108, align: 'center', customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)) },
  { title: '高度(m)', dataIndex: 'height', key: 'height', width: 86, align: 'center', customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(1) : String(text)) },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: WallForm): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: WallForm) {
  return { onClick: () => onRowClick(record) }
}

function onColorPick(ev: Event): void {
  form.color = normalizeHex((ev.target as HTMLInputElement).value, '#ffff00')
}

onMounted(async () => {
  const v = await waitForMapViewer()
  if (!v) message.warning('地图未能在预期时间内就绪')
  refreshTable()
  await nextTick()
  updateTableScrollY()
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  stopDraw()
  const v = mapStore.getViewer()
  if (v && !v.isDestroyed()) {
    getApi().clear(v)
  }
  storedById.clear()
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
                  <span class="hzd-field-label">特效 ID</span>
                  <div class="hzd-field-control">
                    <a-input v-model:value="form.id" class="hzd-control-fill" size="small" allow-clear placeholder="可选，留空自动生成" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">经度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.longitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">纬度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.latitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">扩散半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.radius" class="hzd-control-fill" size="small" :min="10" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">最小半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.minRadius" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">边数</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.edge" class="hzd-control-fill" size="small" :min="3" :max="128" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">墙高(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :min="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扩散速度</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.speed" class="hzd-control-fill" size="small" :min="0.1" :step="0.5" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">周期(ms)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.duration" class="hzd-control-fill" size="small" :min="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native"><span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" /><input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick" /></label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.colorAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
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
                    <a-button type="primary" block class="map-tool-primary-btn hzd-primary-tall" @click="onPrimaryClick">
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
            <div class="hzd-pane-title">多边形扩散墙列表</div>
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
                      <a-button type="text" danger size="small" class="hzd-del-btn" aria-label="删除" @click="onDeleteRow(record.id, $event)">
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

/** 参数右侧控件约占本列 80%，靠右与滚动条留出间距 */
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
.hzd-field-control :deep(.ant-select) { width: 80% !important; max-width: 100%; }


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
