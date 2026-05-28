<script setup lang="ts">
import { keepAlternateDemoEntry } from './components/common/keepAlternateDemoEntry'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { AreaDrawStartParams, LngLatHeight, ModelSnapshot } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Model）模型类（底层entity）'

const mapStore = useMapLayerStore()

let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 0,
  modelUri: '' as string,
  scale: 1,
  minimumPixelSize: 64,
  runAnimations: true,
  /** 航向（°）：0°朝北，顺时针增大；+90°朝东（同 Cesium HeadingPitchRoll） */
  headingDegrees: 0,
  /** 俯仰（°）：正抬头，负俯冲 */
  pitchDegrees: 0,
  /** 横滚（°）：正右倾（从机尾向机头看顺时针） */
  rollDegrees: 0,
  show: true,
})

const tableData = ref<ModelSnapshot[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
let tableResizeObserver: ResizeObserver | null = null
let modelBlobUrl: string | null = null
/** 本页创建过的 blob URL，卸载前统一释放 */
const createdBlobUrls = new Set<string>()

let viewerRef: Viewer | null = null

function syncFormFromPick(points: LngLatHeight[]): void {
  const p = points[points.length - 1]
  if (!p) return
  form.longitude = p.longitude
  form.latitude = p.latitude
  form.height = p.height ?? 0
}

function buildModelStartParams(): AreaDrawStartParams {
  return {
    shapeType: 'model',
    id: form.id.trim() || undefined,
    height: 0,
    uri: form.modelUri.trim(),
    scale: form.scale,
    minimumPixelSize: form.minimumPixelSize,
    runAnimations: form.runAnimations,
    headingDegrees: form.headingDegrees,
    pitchDegrees: form.pitchDegrees,
    rollDegrees: form.rollDegrees,
    show: form.show,
    targetData: { modelUri: form.modelUri.trim() },
    preview: { anchorPointColor: '#1890ff', cursorPointColor: '#1890ff' },
    onAnchorChange: (points) => {
      syncFormFromPick(points)
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
    if (result.shapeType !== 'model') return
    stopAreaDraw()
    message.success('已添加模型')
    refreshTable()
    resetFormToInitial()
  })
}

function revokeBlobIfUnused(url: string | null): void {
  if (!url || !url.startsWith('blob:')) return
  const v = mapStore.getViewer()
  const M = window.FastX?.Model
  if (!v || v.isDestroyed() || !M) {
    URL.revokeObjectURL(url)
    createdBlobUrls.delete(url)
    return
  }
  const used = M.getAllModels(v).some((s) => {
    const u = (typeof s.targetData.modelUri === 'string' && s.targetData.modelUri) || s.uri
    return u === url
  })
  if (!used) {
    URL.revokeObjectURL(url)
    createdBlobUrls.delete(url)
  }
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
  const M = window.FastX?.Model
  if (!v || v.isDestroyed() || !M) {
    tableData.value = []
    return
  }
  tableData.value = M.getAllModels(v)
  void nextTick(() => updateTableScrollY())
}

function fillFormFromSnapshot(s: ModelSnapshot): void {
  form.id = s.id
  form.longitude = s.longitude
  form.latitude = s.latitude
  form.height = s.height
  form.scale = s.scale ?? 1
  form.minimumPixelSize = s.minimumPixelSize ?? 64
  form.runAnimations = s.runAnimations !== false
  form.headingDegrees = s.headingDegrees ?? 0
  form.pitchDegrees = s.pitchDegrees ?? 0
  form.rollDegrees = s.rollDegrees ?? 0
  form.show = s.show
  const td = s.targetData
  const uri = typeof td.modelUri === 'string' ? td.modelUri : s.uri
  form.modelUri = uri ?? ''
  if (uri && uri.startsWith('blob:')) modelBlobUrl = uri
}

function resetFormToInitial(): void {
  form.id = ''
  form.longitude = 120.95
  form.latitude = 23.75
  form.height = 0
  form.modelUri = ''
  modelBlobUrl = null
  form.scale = 1
  form.minimumPixelSize = 64
  form.runAnimations = true
  form.headingDegrees = 0
  form.pitchDegrees = 0
  form.rollDegrees = 0
  form.show = true
}

function onCancelSelect(): void {
  selectedId.value = null
  stopAreaDraw()
  resetFormToInitial()
}

function isAllowedModelFile(file: File): boolean {
  const n = file.name.toLowerCase()
  return n.endsWith('.glb') || n.endsWith('.gltf') || file.type === 'model/gltf-binary' || file.type === 'model/gltf+json'
}

function onModelFile(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!isAllowedModelFile(file)) {
    message.warning('仅支持上传 .glb 或 .gltf 模型文件')
    return
  }
  if (modelBlobUrl) {
    revokeBlobIfUnused(modelBlobUrl)
  }
  const url = URL.createObjectURL(file)
  createdBlobUrls.add(url)
  modelBlobUrl = url
  form.modelUri = url
}

function onRowClick(record: ModelSnapshot): void {
  stopAreaDraw()
  selectedId.value = record.id
  const snap = window.FastX?.Model?.getModel(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Model?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    stopAreaDraw()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryButtonText = computed(() => {
  if (selectedId.value) return '确定'
  return isAreaDrawing.value ? '完成标绘' : '绘制'
})

function addModelFromForm(): void {
  if (!form.modelUri.trim()) {
    message.warning('请先上传 .glb 或 .gltf 模型')
    return
  }
  const M = window.FastX?.Model
  const v = mapStore.getViewer()
  if (!M || !v || v.isDestroyed()) return
  stopAreaDraw()
  const idOpt = form.id.trim() || undefined
  const entity = M.add(v, {
    id: idOpt,
    position: { longitude: form.longitude, latitude: form.latitude, height: form.height },
    uri: form.modelUri.trim(),
    scale: form.scale,
    minimumPixelSize: form.minimumPixelSize,
    runAnimations: form.runAnimations,
    headingDegrees: form.headingDegrees,
    pitchDegrees: form.pitchDegrees,
    rollDegrees: form.rollDegrees,
    show: form.show,
    targetData: { modelUri: form.modelUri.trim() },
  })
  if (!entity) {
    message.error('添加失败：id 可能重复，或模型地址无效')
    return
  }
  message.success('已添加模型')
  refreshTable()
  resetFormToInitial()
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    applyUpdateToSelected()
    return
  }
  if (!form.modelUri.trim()) {
    message.warning('请先上传 .glb 或 .gltf 模型后再开始绘制')
    return
  }
  am = window.FastX?.AreaManager
  if (!am) {
    message.error('FastX.AreaManager 未就绪')
    return
  }
  // --- 空域管理：鼠标绘制 start / end ---
  if (isAreaDrawing.value) {
    if (am.pointCount < 1) {
      message.warning('至少需要 1 个点')
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
  const ok = am.start(v, buildModelStartParams())
  if (!ok) {
    message.error('无法开始模型绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束')
  // --- Model 单类 add（不用空域管理时注释上一段，改用下方）---
  // addModelFromForm()
}

function applyUpdateToSelected(): void {
  const id = selectedId.value
  const M = window.FastX?.Model
  const v = mapStore.getViewer()
  if (!id || !M || !v || v.isDestroyed()) return
  if (!form.modelUri.trim()) {
    message.warning('请先上传 .glb 或 .gltf 模型')
    return
  }
  const ok = M.updateModel(id, {
    longitude: form.longitude,
    latitude: form.latitude,
    height: form.height,
    uri: form.modelUri.trim(),
    scale: form.scale,
    minimumPixelSize: form.minimumPixelSize,
    runAnimations: form.runAnimations,
    headingDegrees: form.headingDegrees,
    pitchDegrees: form.pitchDegrees,
    rollDegrees: form.rollDegrees,
    show: form.show,
    targetData: { modelUri: form.modelUri.trim() },
  })
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else {
    message.error('保存失败，请确认该模型仍存在')
  }
}

const columns: TableColumnType<ModelSnapshot>[] = [
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

function tableRowClassName(record: ModelSnapshot): string {
  return record.id === selectedId.value ? 'hzd-point-row--active' : ''
}

function customTableRow(record: ModelSnapshot) {
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
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.FastX?.Model?.clear(v)
  }
  for (const u of [...createdBlobUrls]) {
    try {
      URL.revokeObjectURL(u)
    } catch {
      /* ignore */
    }
  }
  createdBlobUrls.clear()
  modelBlobUrl = null
})
keepAlternateDemoEntry(addModelFromForm)
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point map-tool-float--hzd-model">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">模型 ID</span>
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
                  <span class="hzd-field-label">模型文件</span>
                  <div class="hzd-field-control hzd-field-control--file">
                    <label class="hzd-file-btn">
                      <span>上传 .glb / .gltf</span>
                      <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" class="hzd-file-input" @change="onModelFile" />
                    </label>
                  </div>
                </div>
                <div v-if="form.modelUri" class="hzd-muted-uri">{{ form.modelUri.startsWith('blob:') ? '已选择本地模型（blob URL）' : form.modelUri }}</div>

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
                    <a-input-number v-model:value="form.scale" class="hzd-control-fill" size="small" :min="0.01" :max="100" :step="0.1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">最小像素</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.minimumPixelSize" class="hzd-control-fill" size="small" :min="0" :max="512" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label hzd-field-label--with-hint">
                    <span class="hzd-label-main">航向角（°）</span>
                    <span class="hzd-label-hint">0°朝北、顺时针增大；+90°朝东</span>
                  </span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.headingDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label hzd-field-label--with-hint">
                    <span class="hzd-label-main">俯仰角（°）</span>
                    <span class="hzd-label-hint">正抬头，负俯冲</span>
                  </span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.pitchDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label hzd-field-label--with-hint">
                    <span class="hzd-label-main">横滚角（°）</span>
                    <span class="hzd-label-hint">正右倾（尾→头看顺时针）</span>
                  </span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.rollDegrees" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">播放动画</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.runAnimations" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row hzd-field-row--help">
                  <span />
                  <div class="hzd-help">
                    若 glTF 内含动画轨道（如门开合、螺旋桨转动），开启后 Cesium 会按时间轴播放；纯静态模型可关闭以略省开销。
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
            <div class="hzd-pane-title">模型列表</div>
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

.hzd-field-row:has(.hzd-field-label--with-hint) {
  align-items: start;
  padding-top: 2px;
  padding-bottom: 2px;
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

.hzd-field-label--with-hint {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}

.hzd-label-main {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
}

.hzd-label-hint {
  font-size: 10px;
  font-weight: 400;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.42);
  max-width: 118px;
}

.hzd-field-control {
  min-width: 0;
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.hzd-field-control--file {
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

.hzd-file-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80%;
  max-width: 100%;
  min-height: 30px;
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

.hzd-muted-uri {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  text-align: right;
  padding-right: 10%;
  word-break: break-all;
}

.hzd-control-fill {
  width: 80% !important;
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
