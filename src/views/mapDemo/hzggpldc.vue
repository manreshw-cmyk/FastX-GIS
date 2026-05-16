<script setup lang="ts">
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { BillboardSnapshot, MouseEventListenOptions, MouseEventPickPayload } from '../../CesiumX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './drawFormColor'
import { waitForMapViewer } from './useCoordinateDemo'

const title = '绘制（Billboard）广告牌类（底层entity）'

const DEFAULT_TINT = '#ffffff'

const mapStore = useMapLayerStore()

const plotArmed = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 0,
  /** 仅通过上传得到的 data URL / blob URL，用于 Cesium billboard.image */
  imageDataUrl: '' as string,
  scale: 1,
  width: undefined as number | undefined,
  heightPx: undefined as number | undefined,
  color: DEFAULT_TINT,
  alpha: 1,
  /** 贴图平面内旋转（度）；示例页约定：0° 为正北向，逆时针增大 */
  rotationDegrees: 0,
  show: true,
})

const tableData = ref<BillboardSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null
let lastBlobUrl: string | null = null

type MapMouseBinder = {
  listen: (options: MouseEventListenOptions) => void
  destroy: () => void
}

let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

function revokeLastBlob(): void {
  if (lastBlobUrl && lastBlobUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(lastBlobUrl)
    } catch {
      /* ignore */
    }
  }
  lastBlobUrl = null
}

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
  const B = window.XGX?.Billboard
  if (!v || v.isDestroyed() || !B) {
    tableData.value = []
    return
  }
  tableData.value = B.getAllBillboards(v)
  void nextTick(() => updateTableScrollY())
}

function fillFormFromSnapshot(s: BillboardSnapshot): void {
  form.id = s.id
  form.longitude = s.longitude
  form.latitude = s.latitude
  form.height = s.height
  form.scale = s.scale ?? 1
  form.width = s.width
  form.heightPx = s.heightPx
  const td = s.targetData
  const uri = typeof td.imageUri === 'string' ? td.imageUri : undefined
  revokeLastBlob()
  form.imageDataUrl = uri ?? ''
  if (uri && uri.startsWith('blob:')) lastBlobUrl = uri
  const tintCss =
    s.colorCss ?? (typeof td.tintColor === 'string' && td.tintColor.trim() ? String(td.tintColor) : undefined)
  const tintP = parseCssColorForForm(tintCss, DEFAULT_TINT)
  form.color = tintP.hex
  const tdA = typeof td.tintAlpha === 'number' && Number.isFinite(td.tintAlpha) ? td.tintAlpha : undefined
  form.alpha = tdA ?? tintP.alpha
  form.show = s.show
  form.rotationDegrees = s.rotationDegrees ?? 0
}

function resetFormToInitial(): void {
  form.id = ''
  form.longitude = 120.95
  form.latitude = 23.75
  form.height = 0
  revokeLastBlob()
  form.imageDataUrl = ''
  form.scale = 1
  form.width = undefined
  form.heightPx = undefined
  form.color = DEFAULT_TINT
  form.alpha = 1
  form.rotationDegrees = 0
  form.show = true
}

function onCancelSelect(): void {
  selectedId.value = null
  plotArmed.value = false
  resetFormToInitial()
}

function onImageFile(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件（含 PNG / JPEG / SVG 等）')
    return
  }
  revokeLastBlob()
  if (file.type === 'image/svg+xml') {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      form.imageDataUrl = text.startsWith('data:') ? text : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
    }
    reader.readAsText(file)
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') form.imageDataUrl = reader.result
  }
  reader.readAsDataURL(file)
}

function onRowClick(record: BillboardSnapshot): void {
  plotArmed.value = false
  selectedId.value = record.id
  const snap = window.XGX?.Billboard?.getBillboard(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.XGX?.Billboard?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    plotArmed.value = false
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryButtonText = computed(() => {
  if (selectedId.value) return '确定'
  if (plotArmed.value) return '取消标绘'
  return '标绘'
})

const primaryButtonType = computed(() => {
  if (plotArmed.value && !selectedId.value) return 'default' as const
  return 'primary' as const
})

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const B = window.XGX?.Billboard
  const v = mapStore.getViewer()
  if (!id || !B || !v || v.isDestroyed()) return
  if (!form.imageDataUrl.trim()) {
    message.warning('请先上传图片')
    return
  }
  const ok = B.updateBillboard(id, {
    longitude: form.longitude,
    latitude: form.latitude,
    height: form.height,
    image: form.imageDataUrl.trim(),
    scale: form.scale,
    width: form.width,
    imageHeight: form.heightPx,
    rotationDegrees: form.rotationDegrees,
    color: form.color,
    alpha: form.alpha,
    show: form.show,
    targetData: { tintColor: form.color, tintAlpha: form.alpha, rotationDegrees: form.rotationDegrees },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败，请确认该对象仍存在')
  }
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }
  if (plotArmed.value) {
    plotArmed.value = false
    resetFormToInitial()
    message.info('已取消标绘')
    return
  }
  if (!form.imageDataUrl.trim()) {
    message.warning('请先上传一张图片后再开始标绘')
    return
  }
  plotArmed.value = true
  message.info('请在地图上左键点击放置广告牌，放置成功后自动结束标绘')
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!plotArmed.value || selectedId.value) return
  if (Number.isNaN(pick.longitude) || Number.isNaN(pick.latitude)) {
    message.warning('未能拾取到有效坐标，请点在地球可见区域后重试')
    return
  }
  const B = window.XGX?.Billboard
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
    image: form.imageDataUrl.trim(),
    scale: form.scale,
    width: form.width,
    imageHeight: form.heightPx,
    rotationDegrees: form.rotationDegrees,
    color: form.color,
    alpha: form.alpha,
    show: form.show,
    targetData: { tintColor: form.color, tintAlpha: form.alpha, rotationDegrees: form.rotationDegrees },
  })
  if (!entity) {
    message.error('添加失败：id 可能重复，请修改 id 后重新标绘')
    plotArmed.value = false
    return
  }
  plotArmed.value = false
  message.success('已添加广告牌')
  refreshTable()
  resetFormToInitial()
}

function bindMouse(v: Viewer): void {
  const Ctor = window.XGX?.MouseEvent as (new (viewer: Viewer) => MapMouseBinder) | undefined
  if (!Ctor) {
    message.error('window.XGX.MouseEvent 未就绪')
    return
  }
  mouseBinder?.destroy()
  const binder = new Ctor(v)
  binder.listen({
    onLeftClick: (pick: MouseEventPickPayload) => onMapLeftClick(pick),
  })
  mouseBinder = binder
}

function onColorPick(ev: Event): void {
  const el = ev.target as HTMLInputElement
  form.color = normalizeHex(el.value, DEFAULT_TINT)
}

const columns: TableColumnType<BillboardSnapshot>[] = [
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
  {
    title: '旋转(°)',
    dataIndex: 'rotationDegrees',
    key: 'rotationDegrees',
    width: 72,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(1) : '—'),
  },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

function tableRowClassName(record: BillboardSnapshot): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: BillboardSnapshot) {
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
  revokeLastBlob()
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.XGX?.Billboard?.clear(v)
  }
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point map-tool-float--hzd-billboard">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">广告牌 ID</span>
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
                  <span class="hzd-field-label">贴图（上传）</span>
                  <div class="hzd-field-control hzd-field-control--file">
                    <label class="hzd-file-btn">
                      <span>选择图片</span>
                      <input type="file" accept="image/*" class="hzd-file-input" @change="onImageFile" />
                    </label>
                  </div>
                </div>
                <div v-if="form.imageDataUrl" class="hzd-thumb-row">
                  <img :src="form.imageDataUrl" alt="预览" class="hzd-thumb" />
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
                  <span class="hzd-field-label">缩放</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.scale" class="hzd-control-fill" size="small" :min="0.1" :max="8" :step="0.1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">宽度(px)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.width" class="hzd-control-fill" size="small" :min="1" placeholder="默认自动" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高度(px)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.heightPx" class="hzd-control-fill" size="small" :min="1" placeholder="默认自动" />
                  </div>
                </div>

                <div class="hzd-field-row hzd-field-row--note-left">
                  <span class="hzd-note-left">（0°为正北，逆时针旋转）</span>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">旋转（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.rotationDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">染色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick($event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">染色透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
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
                      :type="primaryButtonType"
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
            <div class="hzd-pane-title">广告牌列表</div>
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

.hzd-field-row--help {
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr);
  min-height: 0;
  margin-top: -4px;
  margin-bottom: 2px;
}

.hzd-help {
  grid-column: 2;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.48);
  text-align: right;
  padding-right: 10%;
}

.hzd-help code {
  font-size: 10px;
  color: rgba(200, 225, 255, 0.75);
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

.hzd-field-control--file {
  justify-content: flex-end;
}

.hzd-file-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80%;
  max-width: 100%;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid rgba(120, 180, 255, 0.45);
  font-size: 12px;
  color: rgba(200, 225, 255, 0.95);
  cursor: pointer;
  background: rgba(40, 80, 140, 0.35);
}

.hzd-file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.hzd-thumb-row {
  display: flex;
  justify-content: flex-end;
  padding-right: 10%;
}

.hzd-thumb {
  max-width: 120px;
  max-height: 120px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  object-fit: contain;
  background: rgba(0, 0, 0, 0.25);
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
