<script setup lang="ts">
/** 组件已在 main.ts 中 `app.use(Antd)` 全局注册；`message` 为命令式 API 需单独引入；`TableColumnType` 为纯类型，构建后不会打入包体 */
import { DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions, MouseEventPickPayload, SectorSnapshot } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './components/common/drawFormColor'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Sector）扇形类（底层entity）'

/** 仅作新建时的默认色；用户通过系统取色板自选 */
const DEFAULT_FILL_COLOR = '#722ed1'
/** 默认用浅色轮廓，在遥感底图上更易辨认（可自改） */
const DEFAULT_OUTLINE_COLOR = '#ffffff'

const mapStore = useMapLayerStore()

/** 为 true 时下一次地图左键将经纬度（及有效时的高度）写入表单 */
const coordPickArmed = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  longitude: null as number | null,
  latitude: null as number | null,
  height: 0,
  /** 半径（米） */
  radius: 50_000,
  /** 起始角（°），自北顺时针 */
  startAzimuthDegrees: 0,
  /** 结束角（°），自北顺时针 */
  endAzimuthDegrees: 60,
  /** 圆弧分段（下拉） */
  arcSegments: 32,
  /** 拉伸高度（m），整块扇形统一挤出 */
  extrudedHeight: 0,
  /** 是否绘制填充色（关则填充透明度等效为 0，轮廓仍可显示） */
  showFill: true,
  color: DEFAULT_FILL_COLOR,
  alpha: 1,
  outline: true,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineAlpha: 1,
  outlineWidth: 2,
  show: true,
})

const arcSegmentOptions = [
  { label: '8', value: 8 },
  { label: '16', value: 16 },
  { label: '32', value: 32 },
  { label: '64', value: 64 },
]

const tableData = ref<SectorSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null

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

function refreshTable(): void {
  const v = mapStore.getViewer()
  const S = window.FastX?.Sector
  if (!v || v.isDestroyed() || !S) {
    tableData.value = []
    return
  }
  tableData.value = S.getAllSectors(v)
  void nextTick(() => updateTableScrollY())
}

function fillFormFromSnapshot(s: SectorSnapshot): void {
  form.id = s.id
  form.longitude = s.longitude
  form.latitude = s.latitude
  form.height = s.height
  form.radius = s.radius > 0 ? s.radius : form.radius
  form.startAzimuthDegrees = Number.isFinite(s.startAzimuthDegrees) ? s.startAzimuthDegrees : 0
  form.endAzimuthDegrees = Number.isFinite(s.endAzimuthDegrees) ? s.endAzimuthDegrees : 60
  form.arcSegments = s.arcSegments >= 2 ? s.arcSegments : 32
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

function fillAlphaForApi(): number {
  return form.showFill ? form.alpha : 0
}

/** 取消选中或删除当前行后恢复为「新建扇形」初始参数 */
function resetFormToInitial(): void {
  form.id = ''
  form.longitude = null
  form.latitude = null
  form.height = 0
  form.radius = 50_000
  form.startAzimuthDegrees = 0
  form.endAzimuthDegrees = 60
  form.arcSegments = 32
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

/** HTML color input 仅支持 #RRGGBB */
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

function disarmCoordPick(): void {
  coordPickArmed.value = false
}

function onRowClick(record: SectorSnapshot): void {
  disarmCoordPick()
  selectedId.value = record.id
  const snap = window.FastX?.Sector?.getSector(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Sector?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    disarmCoordPick()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryButtonText = computed(() => (selectedId.value ? '确定' : '标绘'))

const pickCoordButtonType = computed(() => (coordPickArmed.value ? ('primary' as const) : ('default' as const)))

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const S = window.FastX?.Sector
  const v = mapStore.getViewer()
  if (!id || !S || !v || v.isDestroyed()) return
  if (form.longitude == null || form.latitude == null) {
    message.warning('请填写或拾取经纬度后再保存')
    return
  }
  const ok = S.updateSector(id, {
    longitude: form.longitude,
    latitude: form.latitude,
    height: form.height,
    radius: form.radius,
    startAzimuthDegrees: form.startAzimuthDegrees,
    endAzimuthDegrees: form.endAzimuthDegrees,
    arcSegments: form.arcSegments,
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
    message.error('保存失败，请确认该扇形仍存在')
  }
}

function addSectorFromForm(): void {
  const lon = form.longitude
  const lat = form.latitude
  if (lon == null || lat == null) {
    message.warning('请先通过地图拾取或手动输入经度、纬度后再标绘')
    return
  }
  const S = window.FastX?.Sector
  const v = mapStore.getViewer()
  if (!S || !v || v.isDestroyed()) return

  disarmCoordPick()
  const idOpt = form.id.trim() || undefined
  const entity = S.add(v, {
    id: idOpt,
    position: {
      longitude: lon,
      latitude: lat,
      height: form.height,
    },
    radius: form.radius,
    startAzimuthDegrees: form.startAzimuthDegrees,
    endAzimuthDegrees: form.endAzimuthDegrees,
    arcSegments: form.arcSegments,
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
    message.error('添加失败：id 可能重复或半径/角度无效，请检查后重试')
    return
  }
  message.success('已添加扇形')
  refreshTable()
  form.id = ''
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }
  addSectorFromForm()
}

function onCancelSelect(): void {
  selectedId.value = null
  disarmCoordPick()
  resetFormToInitial()
}

function onToggleCoordPick(): void {
  if (coordPickArmed.value) {
    coordPickArmed.value = false
    message.info('已取消拾取经纬度')
    return
  }
  coordPickArmed.value = true
  message.info('请在地图上左键点击拾取经纬度')
}

function isValidPickLonLat(pick: MouseEventPickPayload): boolean {
  return Number.isFinite(pick.longitude) && Number.isFinite(pick.latitude)
}

/** 将拾取结果写入表单；成功返回 true */
function applyPickToFormLonLat(pick: MouseEventPickPayload): boolean {
  if (!isValidPickLonLat(pick)) {
    message.warning('未能拾取到有效坐标，请点击地球可见区域后重试')
    return false
  }
  form.longitude = pick.longitude
  form.latitude = pick.latitude
  if (Number.isFinite(pick.height)) {
    form.height = pick.height
  }
  return true
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!coordPickArmed.value) return
  if (!applyPickToFormLonLat(pick)) return
  coordPickArmed.value = false
  message.success('已写入经纬度')
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

const columns: TableColumnType<SectorSnapshot>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 100, align: 'center' },
  {
    title: '经度(°)',
    dataIndex: 'longitude',
    key: 'longitude',
    width: 84,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '纬度(°)',
    dataIndex: 'latitude',
    key: 'latitude',
    width: 84,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(4) : String(text)),
  },
  {
    title: '半径(m)',
    dataIndex: 'radius',
    key: 'radius',
    width: 88,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? Math.round(text).toLocaleString() : String(text)),
  },
  {
    title: '分段',
    dataIndex: 'arcSegments',
    key: 'arcSegments',
    width: 48,
    align: 'center',
  },
  { title: '操作', key: 'action', width: 52, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: SectorSnapshot): string {
  return record.id === selectedId.value ? 'hzd-sector-row--active' : ''
}

function customTableRow(record: SectorSnapshot) {
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
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) {
    tableResizeObserver.observe(tableShellRef.value)
  }
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  mouseBinder?.destroy()
  mouseBinder = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.FastX?.Sector?.clear(v)
  }
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-sector">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扇形 ID</span>
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
                      placeholder="可拾取或手输"
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
                      placeholder="可拾取或手输"
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
                  <span class="hzd-field-label">半径（m）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.radius"
                      class="hzd-control-fill"
                      size="small"
                      :min="100"
                      :max="2000000"
                      :step="1000"
                      :controls="true"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">起始角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.startAzimuthDegrees"
                      class="hzd-control-fill"
                      size="small"
                      :step="1"
                      :controls="true"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">结束角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.endAzimuthDegrees"
                      class="hzd-control-fill"
                      size="small"
                      :step="1"
                      :controls="true"
                    />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">圆弧分段</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.arcSegments"
                      class="hzd-control-fill hzd-select-like-input"
                      popup-class-name="hzd-select-dropdown-dark"
                      size="small"
                      :options="arcSegmentOptions"
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

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示轮廓线</span>
                  <div class="hzd-field-control">
                    <a-space align="center" :size="12">
                      <a-switch v-model:checked="form.outline" size="small" />
                    </a-space>
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
                <p class="hzd-muted hzd-field-footnote">
                  起始角、结束角自北顺时针（度）；扇面由 Entity 内 PolygonGraphics 近似。线宽受 WebGL 限制，多数环境实际仍较细。
                </p>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <div class="hzd-actions-primary-row">
                      <a-tooltip :title="coordPickArmed ? '取消拾取' : '地图拾取经纬度'">
                        <a-button
                          :type="pickCoordButtonType"
                          class="hzd-pick-coord-btn hzd-primary-tall"
                          aria-label="地图拾取经纬度"
                          @click="onToggleCoordPick"
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
            <div class="hzd-pane-title">扇形列表</div>
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
.map-tool-float--hzd-sector :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-tool-float--hzd-sector :deep(.x-dialog-inner) {
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
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.hzd-field-footnote {
  margin: -2px 0 0;
  line-height: 1.45;
  font-size: 11px;
  max-width: 100%;
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
