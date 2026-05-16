<script setup lang="ts">
import { DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions, MouseEventPickPayload, PlaneSnapshot } from '../../CesiumX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './drawFormColor'
import { waitForMapViewer } from './useCoordinateDemo'

const title = '绘制（Plane）平面类（底层 entity）'

const DEFAULT_FILL = '#00bcd4'
const DEFAULT_OUTLINE = '#ffffff'

const mapStore = useMapLayerStore()
/** 与廊道/折线体示例一致：仅拾取中心点写入表单，「标绘」用当前表单提交 */
const coordPickArmed = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 500,
  width: 200,
  planeHeight: 200,
  headingDegrees: 0,
  pitchDegrees: 0,
  rollDegrees: 0,
  showFill: true,
  color: DEFAULT_FILL,
  alpha: 0.85,
  outline: false,
  outlineColor: DEFAULT_OUTLINE,
  outlineAlpha: 0.9,
  outlineWidth: 1,
  show: true,
})

const tableData = ref<PlaneSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

type MapMouseBinder = { listen: (options: MouseEventListenOptions) => void; destroy: () => void }
let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

function hex6ForColorInput(css: string): string {
  const t = css.trim()
  if (t.startsWith('#') && t.length >= 7) return t.slice(0, 7)
  return '#000000'
}

/** `a-input-number` 清空或非数字时避免出现 `NaN`，避免 Cesium「origin has a NaN component」 */
function finiteNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
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
  const P = window.XGX?.Plane
  if (!v || v.isDestroyed() || !P) {
    tableData.value = []
    return
  }
  tableData.value = P.getAllPlanes(v)
  void nextTick(() => updateTableScrollY())
}

function fillAlpha(): number {
  if (!form.showFill) return 0
  return Math.min(1, Math.max(0, finiteNum(form.alpha, 0.85)))
}

function fillFormFromSnapshot(s: PlaneSnapshot): void {
  form.id = s.id
  form.longitude = s.longitude
  form.latitude = s.latitude
  form.height = s.height
  form.width = s.width
  form.planeHeight = s.planeHeight
  form.headingDegrees = s.headingDegrees
  form.pitchDegrees = s.pitchDegrees
  form.rollDegrees = s.rollDegrees
  const td = s.targetData
  const fillCss =
    s.colorCss ?? (typeof td.color === 'string' && td.color.trim() ? String(td.color) : undefined)
  const fillP = parseCssColorForForm(fillCss, DEFAULT_FILL)
  form.color = fillP.hex
  const tdA = typeof td.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined
  form.alpha = tdA ?? fillP.alpha
  form.showFill = s.fill !== false
  form.outline = s.outline === true
  const outCss =
    s.outlineColorCss ??
    (typeof td.outlineColor === 'string' && td.outlineColor.trim() ? String(td.outlineColor) : undefined)
  const outP = parseCssColorForForm(outCss, DEFAULT_OUTLINE)
  form.outlineColor = outP.hex
  const tdOA =
    typeof td.outlineAlpha === 'number' && Number.isFinite(td.outlineAlpha) ? td.outlineAlpha : undefined
  form.outlineAlpha = tdOA ?? outP.alpha
  form.outlineWidth = s.outlineWidth ?? 1
  form.show = s.show !== false
}

function resetFormToInitial(): void {
  form.id = ''
  form.longitude = 120.95
  form.latitude = 23.75
  form.height = 500
  form.width = 200
  form.planeHeight = 200
  form.headingDegrees = 0
  form.pitchDegrees = 0
  form.rollDegrees = 0
  form.showFill = true
  form.color = DEFAULT_FILL
  form.alpha = 0.85
  form.outline = false
  form.outlineColor = DEFAULT_OUTLINE
  form.outlineAlpha = 0.9
  form.outlineWidth = 1
  form.show = true
}

function disarmPick(): void {
  coordPickArmed.value = false
}

function onCancelSelect(): void {
  selectedId.value = null
  disarmPick()
  resetFormToInitial()
}

function onRowClick(record: PlaneSnapshot): void {
  disarmPick()
  selectedId.value = record.id
  const snap = window.XGX?.Plane?.getPlane(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.XGX?.Plane?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    disarmPick()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryEntityText = computed(() => (selectedId.value ? '确定' : '标绘'))

const primaryButtonType = computed(() => {
  if (coordPickArmed.value && !selectedId.value) return 'default' as const
  return 'primary' as const
})

function planeTargetData() {
  return {
    color: form.color,
    alpha: form.alpha,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
  }
}

/** 平面宽、平面高（米）；无效返回 null */
function readPlaneDims(): { w: number; ph: number } | null {
  const w = finiteNum(form.width, NaN)
  const ph = finiteNum(form.planeHeight, NaN)
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(ph) || ph <= 0) return null
  return { w, ph }
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const P = window.XGX?.Plane
  const v = mapStore.getViewer()
  if (!id || !P || !v || v.isDestroyed()) return
  const dims = readPlaneDims()
  if (!dims) {
    message.warning('平面宽、高须为有效正数（米）')
    return
  }
  const ok = P.updatePlane(id, {
    longitude: finiteNum(form.longitude, 0),
    latitude: finiteNum(form.latitude, 0),
    height: finiteNum(form.height, 0),
    dimensions: { width: dims.w, height: dims.ph },
    headingDegrees: finiteNum(form.headingDegrees, 0),
    pitchDegrees: finiteNum(form.pitchDegrees, 0),
    rollDegrees: finiteNum(form.rollDegrees, 0),
    color: form.color,
    alpha: fillAlpha(),
    fill: form.showFill,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: finiteNum(form.outlineAlpha, 0.9),
    outlineWidth: finiteNum(form.outlineWidth, 1),
    show: form.show,
    targetData: planeTargetData(),
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else message.error('保存失败')
}

function addPlaneFromForm(): void {
  const v = mapStore.getViewer()
  const P = window.XGX?.Plane
  const dims = readPlaneDims()
  if (!v || v.isDestroyed() || !P) return
  if (!dims) {
    message.warning('平面宽、高须为有效正数（米）')
    return
  }
  const entity = P.add(v, {
    id: form.id.trim() || undefined,
    position: {
      longitude: finiteNum(form.longitude, 0),
      latitude: finiteNum(form.latitude, 0),
      height: finiteNum(form.height, 0),
    },
    dimensions: { width: dims.w, height: dims.ph },
    headingDegrees: finiteNum(form.headingDegrees, 0),
    pitchDegrees: finiteNum(form.pitchDegrees, 0),
    rollDegrees: finiteNum(form.rollDegrees, 0),
    color: form.color,
    alpha: fillAlpha(),
    fill: form.showFill,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: finiteNum(form.outlineAlpha, 0.9),
    outlineWidth: finiteNum(form.outlineWidth, 1),
    show: form.show,
    targetData: planeTargetData(),
  })
  if (!entity) {
    message.error('添加失败：id 可能重复')
    return
  }
  message.success('已添加平面 Entity')
  refreshTable()
  resetFormToInitial()
}

function onEntityPrimary(): void {
  if (selectedId.value) applyUpdateToSelected()
  else addPlaneFromForm()
}

function toggleCoordPick(): void {
  if (coordPickArmed.value) {
    disarmPick()
    message.info('已取消地图拾取中心点')
    return
  }
  coordPickArmed.value = true
  message.info('请在地图上左键点击拾取平面中心（经纬与椭球高）')
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!coordPickArmed.value || selectedId.value) return
  const lon = finiteNum(pick.longitude, NaN)
  const lat = finiteNum(pick.latitude, NaN)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    message.warning('未能拾取到有效坐标')
    return
  }
  form.longitude = lon
  form.latitude = lat
  const pickH = finiteNum(pick.height, NaN)
  form.height = Number.isFinite(pickH) ? pickH : finiteNum(form.height, 0)
  disarmPick()
  message.success('已更新中心位置')
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

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const fb = field === 'color' ? DEFAULT_FILL : DEFAULT_OUTLINE
  const hex = normalizeHex(el.value, fb)
  if (field === 'color') form.color = hex
  else form.outlineColor = hex
}

const columns: TableColumnType<PlaneSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  {
    title: '经度(°)',
    dataIndex: 'longitude',
    key: 'longitude',
    width: 92,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '纬度(°)',
    dataIndex: 'latitude',
    key: 'latitude',
    width: 92,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '尺寸(m)',
    key: 'dim',
    width: 88,
    align: 'center',
    customRender: ({ record }) => `${record.width}×${record.planeHeight}`,
  },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: PlaneSnapshot): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: PlaneSnapshot) {
  return { onClick: () => onRowClick(record) }
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
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  mouseBinder?.destroy()
  mouseBinder = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.XGX?.Plane?.clear(v)
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
                  <span class="hzd-field-label">平面 ID</span>
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

                <div class="hzd-field-row hzd-field-row--note-left">
                  <span class="hzd-note-left">中心位置可手输，或点击下列「拾取」后在地图左键拾取；「标绘」按当前表单添加实体。</span>
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
                  <span class="hzd-field-label">高度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :step="10" :controls="true" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">宽度（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.width" class="hzd-control-fill" size="small" :min="1" :step="10" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">平面高（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.planeHeight" class="hzd-control-fill" size="small" :min="1" :step="10" />
                  </div>
                </div>

                <div class="hzd-field-row hzd-field-row--note-left">
                  <span class="hzd-note-left">姿态相对 ENU：航向/俯仰/翻滚（度）；默认平面贴东–北水平面。</span>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">航向（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.headingDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">俯仰（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.pitchDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">翻滚（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.rollDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
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

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <div class="hzd-actions-primary-row">
                      <a-tooltip title="地图拾取中心点">
                        <a-button
                          :type="coordPickArmed ? 'primary' : 'default'"
                          class="hzd-pick-coord-btn hzd-primary-tall"
                          aria-label="拾取中心"
                          @click="toggleCoordPick"
                        >
                          <template #icon><EnvironmentOutlined /></template>
                        </a-button>
                      </a-tooltip>
                      <a-button
                        :type="primaryButtonType"
                        class="map-tool-primary-btn hzd-primary-tall hzd-primary-flex"
                        @click="onEntityPrimary"
                      >
                        {{ primaryEntityText }}
                      </a-button>
                    </div>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">取消选中</a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">平面列表</div>
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
  max-height: min(48vh, 460px);
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

.hzd-field-row--note-left {
  grid-template-columns: 1fr;
  min-height: 0;
}

.hzd-note-left {
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.48);
  text-align: left;
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

.hzd-control-fill {
  width: 80% !important;
  max-width: 100%;
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

.hzd-color-native {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 80%;
  min-height: 32px;
  position: relative;
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
