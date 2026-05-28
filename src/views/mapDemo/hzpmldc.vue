<script setup lang="ts">
import { keepAlternateDemoEntry } from './components/common/keepAlternateDemoEntry'
import { DeleteOutlined, DownOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import {
  DEFAULT_PLANE_VIDEO,
  normalizePlaneVideoOptions,
  type LegacyPlaneVideoOptions,
  type AreaDrawStartParams,
  type LngLatHeight,
  type MouseEventListenOptions,
  type MouseEventPickPayload,
  type PlaneMaterialTypeValue,
  type PlaneSnapshot,
  type PlaneVideoOptions,
  type UpdatePlaneProperties,
} from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './components/common/drawFormColor'
import { waitForMapViewer } from './components/common/useCoordinateDemo'

const title = '绘制（Plane）平面类（底层 entity）'

const DEFAULT_FILL = '#00bcd4'
const DEFAULT_OUTLINE = '#ffffff'

const materialTypeOptions: { value: PlaneMaterialTypeValue; label: string }[] = [
  { value: 'color', label: '纯色' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
]

const mapStore = useMapLayerStore()
let am = window.FastX?.AreaManager
const isAreaDrawing = ref(false)
/** 与廊道/折线体示例一致：仅拾取中心点写入表单，「标绘」用当前表单提交 */
const coordPickArmed = ref(false)
const selectedId = ref<string | null>(null)

const form = reactive({
  id: '',
  longitude: 120.95,
  latitude: 23.75,
  height: 500,
  width: 80000,
  planeHeight: 60000,
  headingDegrees: 0,
  pitchDegrees: 0,
  rollDegrees: 0,
  materialType: 'color' as PlaneMaterialTypeValue,
  showFill: true,
  color: DEFAULT_FILL,
  alpha: 0.85,
  imageUrl: '',
  videoUrl: '',
  videoPlaying: DEFAULT_PLANE_VIDEO.playing,
  videoLoop: DEFAULT_PLANE_VIDEO.loop,
  videoMuted: DEFAULT_PLANE_VIDEO.muted,
  videoPlaybackRate: DEFAULT_PLANE_VIDEO.playbackRate,
  videoPlayCount: DEFAULT_PLANE_VIDEO.playCount,
  videoShowControls: DEFAULT_PLANE_VIDEO.showControls,
  repeatX: 1,
  repeatY: 1,
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
/** 本页创建的视频 blob URL，卸载前统一释放 */
const createdVideoBlobUrls = new Set<string>()

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

function haversineM(a: LngLatHeight, b: LngLatHeight): number {
  const R = 6371000
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function syncPlaneFromAnchors(points: LngLatHeight[]): void {
  if (points.length >= 1) {
    form.longitude = points[0]!.longitude
    form.latitude = points[0]!.latitude
    form.height = points[0]!.height ?? 0
  }
  if (points.length >= 2) {
    const span = haversineM(points[0]!, points[1]!)
    form.width = span
    form.planeHeight = span
  }
}

function buildPlaneStartParams(): AreaDrawStartParams {
  const payload = planeEntityPayload()
  return {
    shapeType: 'plane',
    id: form.id.trim() || undefined,
    height: 0,
    dimensions: { width: form.width, height: form.planeHeight },
    headingDegrees: payload.headingDegrees,
    pitchDegrees: payload.pitchDegrees,
    rollDegrees: payload.rollDegrees,
    materialType: payload.materialType,
    color: form.color,
    alpha: payload.alpha,
    imageUrl: payload.imageUrl,
    videoUrl: payload.videoUrl,
    imageRepeat: payload.imageRepeat,
    video: payload.video,
    fill: payload.fill,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: form.outlineAlpha,
    outlineWidth: form.outlineWidth,
    show: form.show,
    targetData: { ...payload, showFill: form.showFill },
    preview: {
      anchorPointColor: '#00bcd4',
      cursorPointColor: '#00bcd4',
      lineColor: form.color,
      fillColor: form.color,
      fillAlpha: form.alpha,
    },
    onAnchorChange: (points) => {
      syncPlaneFromAnchors(points)
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
    if (result.shapeType !== 'plane') return
    stopAreaDraw()
    message.success('已添加平面')
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
  const P = window.FastX?.Plane
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
  const mt = s.materialType ?? (typeof td.materialType === 'string' ? (td.materialType as PlaneMaterialTypeValue) : undefined)
  if (mt && materialTypeOptions.some((o) => o.value === mt)) {
    form.materialType = mt
  } else {
    form.materialType = 'color'
  }
  form.imageUrl = typeof td.imageUrl === 'string' ? td.imageUrl : s.imageUrl ?? ''
  form.videoUrl = typeof td.videoUrl === 'string' ? td.videoUrl : s.videoUrl ?? ''
  const v = normalizePlaneVideoOptions(
    (s.video ?? td.video) as LegacyPlaneVideoOptions | undefined,
  )
  if (form.materialType === 'video') {
    form.videoPlaying = v.playing !== false
    form.videoLoop = v.loop !== false
    form.videoMuted = v.muted !== false
    form.videoPlaybackRate = finiteNum(v.playbackRate, DEFAULT_PLANE_VIDEO.playbackRate)
    form.videoPlayCount = Math.max(0, Math.floor(finiteNum(v.playCount, DEFAULT_PLANE_VIDEO.playCount)))
    form.videoShowControls = v.showControls === true
  }
  const rep = s.imageRepeat ?? td.imageRepeat
  if (rep && typeof rep === 'object') {
    form.repeatX = finiteNum((rep as { x?: number }).x, 1)
    form.repeatY = finiteNum((rep as { y?: number }).y, 1)
  } else {
    form.repeatX = 1
    form.repeatY = 1
  }
}

function applyDefaultVideoForm(): void {
  form.videoPlaying = DEFAULT_PLANE_VIDEO.playing
  form.videoLoop = DEFAULT_PLANE_VIDEO.loop
  form.videoMuted = DEFAULT_PLANE_VIDEO.muted
  form.videoPlaybackRate = DEFAULT_PLANE_VIDEO.playbackRate
  form.videoPlayCount = DEFAULT_PLANE_VIDEO.playCount
  form.videoShowControls = DEFAULT_PLANE_VIDEO.showControls
}

function resetFormToInitial(): void {
  form.id = ''
  form.longitude = 120.95
  form.latitude = 23.75
  form.height = 500
  form.width = 80000
  form.planeHeight = 60000
  form.headingDegrees = 0
  form.pitchDegrees = 0
  form.rollDegrees = 0
  form.materialType = 'color'
  form.showFill = true
  form.color = DEFAULT_FILL
  form.alpha = 0.85
  form.imageUrl = ''
  form.videoUrl = ''
  applyDefaultVideoForm()
  form.repeatX = 1
  form.repeatY = 1
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
  stopAreaDraw()
  disarmPick()
  selectedId.value = record.id
  const snap = window.FastX?.Plane?.getPlane(record.id)
  if (snap) fillFormFromSnapshot(snap)
}

function onDeleteRow(id: string, e: Event): void {
  e.stopPropagation()
  window.FastX?.Plane?.remove(id)
  if (selectedId.value === id) {
    selectedId.value = null
    disarmPick()
    resetFormToInitial()
  }
  refreshTable()
  message.success('已删除')
}

const primaryEntityText = computed(() =>
  selectedId.value ? '确定' : isAreaDrawing.value ? '完成标绘' : '绘制',
)

const primaryButtonType = computed(() => {
  if (coordPickArmed.value && !selectedId.value) return 'default' as const
  return 'primary' as const
})

function videoOptionsFromForm(): PlaneVideoOptions {
  return {
    playing: form.videoPlaying,
    loop: form.videoLoop,
    muted: form.videoMuted,
    playbackRate: finiteNum(form.videoPlaybackRate, DEFAULT_PLANE_VIDEO.playbackRate),
    playCount: Math.max(0, Math.floor(finiteNum(form.videoPlayCount, DEFAULT_PLANE_VIDEO.playCount))),
    showControls: form.videoShowControls,
  }
}

function validateMaterialForSubmit(): boolean {
  if (form.materialType === 'image' && !form.imageUrl.trim()) {
    message.warning('图片材质请先上传图片')
    return false
  }
  if (form.materialType === 'video' && !form.videoUrl.trim()) {
    message.warning('视频材质请先上传本地视频')
    return false
  }
  return true
}

function planeEntityPayload(): UpdatePlaneProperties {
  const dims = readPlaneDims()
  const alpha = fillAlpha()
  const heading = finiteNum(form.headingDegrees, 0)
  const pitch = finiteNum(form.pitchDegrees, 0)
  const roll = finiteNum(form.rollDegrees, 0)
  const payload: UpdatePlaneProperties = {
    longitude: finiteNum(form.longitude, 0),
    latitude: finiteNum(form.latitude, 0),
    height: finiteNum(form.height, 0),
    dimensions: dims ? { width: dims.w, height: dims.ph } : undefined,
    headingDegrees: heading,
    pitchDegrees: pitch,
    rollDegrees: roll,
    materialType: form.materialType,
    alpha,
    color: form.color,
    imageRepeat: { x: finiteNum(form.repeatX, 1), y: finiteNum(form.repeatY, 1) },
    fill: form.showFill,
    outline: form.outline,
    outlineColor: form.outlineColor,
    outlineAlpha: finiteNum(form.outlineAlpha, 0.9),
    outlineWidth: finiteNum(form.outlineWidth, 1),
    show: form.show,
    targetData: {
      materialType: form.materialType,
      color: form.color,
      alpha,
      imageUrl: form.imageUrl || undefined,
      videoUrl: form.videoUrl || undefined,
      video: form.materialType === 'video' ? videoOptionsFromForm() : undefined,
      imageRepeat: { x: finiteNum(form.repeatX, 1), y: finiteNum(form.repeatY, 1) },
      outlineColor: form.outlineColor,
      outlineAlpha: finiteNum(form.outlineAlpha, 0.9),
      headingDegrees: heading,
      pitchDegrees: pitch,
      rollDegrees: roll,
    },
  }
  if (form.materialType === 'image') payload.imageUrl = form.imageUrl.trim()
  else if (form.materialType === 'video') {
    payload.videoUrl = form.videoUrl.trim()
    payload.video = videoOptionsFromForm()
  }
  return payload
}

function revokeVideoBlobIfUnused(url: string): void {
  if (!url.startsWith('blob:')) return
  const v = mapStore.getViewer()
  const P = window.FastX?.Plane
  if (!v || v.isDestroyed() || !P) {
    URL.revokeObjectURL(url)
    createdVideoBlobUrls.delete(url)
    return
  }
  const used = P.getAllPlanes(v).some((s) => {
    const u = (typeof s.targetData.videoUrl === 'string' && s.targetData.videoUrl) || s.videoUrl
    return u === url
  })
  if (!used) {
    URL.revokeObjectURL(url)
    createdVideoBlobUrls.delete(url)
  }
}

function onVideoFile(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('video/')) {
    message.warning('请选择视频文件')
    return
  }
  if (form.videoUrl.startsWith('blob:')) revokeVideoBlobIfUnused(form.videoUrl)
  const url = URL.createObjectURL(file)
  createdVideoBlobUrls.add(url)
  form.videoUrl = url
  message.success('视频已载入')
}

const planeApi = () => window.FastX?.Plane

function onVideoPlay(): void {
  const id = selectedId.value
  if (!id) {
    message.info('请先选中列表中的平面')
    return
  }
  if (!planeApi()?.playPlaneVideo(id)) message.warning('播放失败（需为视频材质且已上传）')
}

function onVideoPause(): void {
  const id = selectedId.value
  if (!id) return
  if (!planeApi()?.pausePlaneVideo(id)) message.warning('暂停失败')
}

function onVideoRestart(): void {
  const id = selectedId.value
  if (!id) return
  if (!planeApi()?.restartPlaneVideo(id)) message.warning('重新播放失败')
}

function applyVideoOptionsToSelected(): void {
  const id = selectedId.value
  if (!id) {
    message.info('请先选中列表中的平面')
    return
  }
  if (form.materialType !== 'video') return
  if (!planeApi()?.applyPlaneVideoOptions(id, videoOptionsFromForm())) {
    message.warning('应用视频参数失败')
    return
  }
  message.success('视频参数已应用')
}

function onImageFile(ev: Event): void {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      form.imageUrl = reader.result
      message.success('图片已载入')
    }
  }
  reader.readAsDataURL(file)
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
  const P = planeApi()
  const v = mapStore.getViewer()
  if (!id || !P || !v || v.isDestroyed()) return
  if (!readPlaneDims()) {
    message.warning('平面宽、高须为有效正数（米）')
    return
  }
  if (!validateMaterialForSubmit()) return
  const ok = P.updatePlane(id, planeEntityPayload())
  if (ok) {
    message.success('已保存修改')
    refreshTable()
  } else message.error('保存失败')
}

function addPlaneFromForm(): void {
  const v = mapStore.getViewer()
  const P = planeApi()
  const dims = readPlaneDims()
  if (!v || v.isDestroyed() || !P) return
  if (!dims) {
    message.warning('平面宽、高须为有效正数（米）')
    return
  }
  if (!validateMaterialForSubmit()) return
  const payload = planeEntityPayload()
  const entity = P.add(v, {
    id: form.id.trim() || undefined,
    position: {
      longitude: payload.longitude!,
      latitude: payload.latitude!,
      height: payload.height!,
    },
    ...payload,
    color: form.color,
    outlineColor: form.outlineColor,
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
      message.warning('平面至少需要 2 个点（中心 + 边缘）')
      return
    }
    if (!validateMaterialForSubmit()) return
    am.end()
    isAreaDrawing.value = false
    return
  }

  const v = mapStore.getViewer()
  if (!v || v.isDestroyed()) {
    message.error('地图未就绪')
    return
  }
  if (!readPlaneDims()) {
    message.warning('平面宽、高须为有效正数（米）')
    return
  }
  const ok = am.start(v, buildPlaneStartParams())
  if (!ok) {
    message.error('无法开始平面绘制')
    return
  }
  isAreaDrawing.value = true
  message.info('鼠标左键点击绘制，右键结束绘制！')

  // --- Plane 单类 add（不用空域管理时注释上一段，改用本行）---
  // addPlaneFromForm()
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
  const Ctor = window.FastX?.MouseEvent as (new (viewer: Viewer) => MapMouseBinder) | undefined
  if (!Ctor) {
    message.error('window.FastX.MouseEvent 未就绪')
    return
  }
  mouseBinder?.destroy()
  const binder = new Ctor(v)
  binder.listen({ onLeftClick: onMapLeftClick })
  mouseBinder = binder
}

function onColorPick(field: 'color' | 'outlineColor', ev: Event): void {
  const el = ev.target as HTMLInputElement
  const hex = normalizeHex(
    el.value,
    field === 'outlineColor' ? DEFAULT_OUTLINE : DEFAULT_FILL,
  )
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
  {
    title: '材质',
    dataIndex: 'materialType',
    key: 'materialType',
    width: 72,
    align: 'center',
    customRender: ({ text }) =>
      materialTypeOptions.find((o) => o.value === text)?.label ?? String(text ?? '—'),
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
  am = window.FastX?.AreaManager
  setupAreaManagerPublish()
  // bindMouse(v)
  await nextTick()
  updateTableScrollY()
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  stopAreaDraw()
  mouseBinder?.destroy()
  mouseBinder = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) {
    window.FastX?.Plane?.clear(v)
  }
  for (const url of createdVideoBlobUrls) URL.revokeObjectURL(url)
  createdVideoBlobUrls.clear()
})
keepAlternateDemoEntry(addPlaneFromForm, toggleCoordPick, bindMouse, primaryButtonType)
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
                <p class="hzd-muted hzd-field-footnote">
                  航向绕上轴；俯仰绕东轴（正=抬头）；翻滚绕北轴（正=右倾）。支持正负角度。
                </p>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示填充</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.showFill" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">材质类型</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.materialType"
                      class="hzd-control-fill hzd-select-like-input"
                      size="small"
                      popup-class-name="hzd-select-dropdown-dark"
                      :options="materialTypeOptions"
                    >
                      <template #suffixIcon>
                        <DownOutlined class="hzd-select-suffix-icon" />
                      </template>
                    </a-select>
                  </div>
                </div>

                <template v-if="form.materialType === 'color'">
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
                </template>

                <template v-if="form.materialType === 'image'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">上传图片</span>
                    <div class="hzd-field-control hzd-field-control--file">
                      <label class="hzd-file-btn">
                        <span>选择图片</span>
                        <input type="file" accept="image/*" class="hzd-file-hit" @change="onImageFile" />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">图片透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">重复 X</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.repeatX" class="hzd-control-fill" size="small" :min="0.01" :step="0.5" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">重复 Y</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.repeatY" class="hzd-control-fill" size="small" :min="0.01" :step="0.5" />
                    </div>
                  </div>
                </template>

                <template v-if="form.materialType === 'video'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">上传视频</span>
                    <div class="hzd-field-control hzd-field-control--file">
                      <label class="hzd-file-btn">
                        <span>选择视频</span>
                        <input type="file" accept="video/*" class="hzd-file-hit" @change="onVideoFile" />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">视频透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">播放</span>
                    <div class="hzd-field-control">
                      <a-switch v-model:checked="form.videoPlaying" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">循环</span>
                    <div class="hzd-field-control">
                      <a-switch v-model:checked="form.videoLoop" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">静音</span>
                    <div class="hzd-field-control">
                      <a-switch v-model:checked="form.videoMuted" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">原生控件</span>
                    <div class="hzd-field-control">
                      <a-switch v-model:checked="form.videoShowControls" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">倍速</span>
                    <div class="hzd-field-control">
                      <a-input-number
                        v-model:value="form.videoPlaybackRate"
                        class="hzd-control-fill"
                        size="small"
                        :min="0.25"
                        :max="16"
                        :step="0.25"
                      />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">播放次数</span>
                    <div class="hzd-field-control">
                      <a-input-number
                        v-model:value="form.videoPlayCount"
                        class="hzd-control-fill"
                        size="small"
                        :min="0"
                        :max="9999"
                        :step="1"
                      />
                    </div>
                  </div>
                  <p class="hzd-muted hzd-field-footnote">播放次数为 0 表示不限制；&gt;0 时每次自然结束计 1 次，达到后暂停。</p>
                  <div v-if="selectedId" class="hzd-field-row hzd-field-row--video-actions">
                    <div class="hzd-actions-col hzd-actions-col--inline">
                      <a-button size="small" @click="onVideoPlay">播放</a-button>
                      <a-button size="small" @click="onVideoPause">暂停</a-button>
                      <a-button size="small" @click="onVideoRestart">重新播放</a-button>
                      <a-button size="small" type="primary" @click="applyVideoOptionsToSelected">应用视频参数</a-button>
                    </div>
                  </div>
                  <p class="hzd-muted hzd-field-footnote">使用浏览器本地 blob URL；标绘/确定会写入材质，选中后可即时应用播放参数。</p>
                </template>

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
                      <a-button
                        type="primary"
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

.hzd-field-control--file {
  justify-content: flex-end;
}

.hzd-file-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(120, 180, 255, 0.45);
  background: rgba(30, 60, 95, 0.55);
  color: rgba(230, 242, 255, 0.92);
  cursor: pointer;
  width: 80%;
  max-width: 100%;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.hzd-file-btn:hover {
  border-color: rgba(160, 210, 255, 0.75);
  background: rgba(45, 85, 130, 0.65);
}

.hzd-file-hit {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.hzd-muted {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
}

.hzd-field-footnote {
  margin: 0 0 4px;
  padding-left: 0;
  text-align: left;
  grid-column: 1 / -1;
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

.hzd-actions-col--inline {
  flex-direction: row;
  flex-wrap: wrap;
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
