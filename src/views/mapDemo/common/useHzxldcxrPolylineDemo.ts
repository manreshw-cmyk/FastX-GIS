/** PolyLine Entity 标绘示例：表单、表格、鼠标拾取（供 hzxldcxr.vue 使用） */
import { message } from 'ant-design-vue'
import { keepAlternateDemoEntry } from './keepAlternateDemoEntry'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type {
  AddPolylineOptions,
  AreaDrawStartParams,
  LngLatHeight,
  PolylineLineKind,
  PolylineSnapshot,
} from '../../../FastX'
import { useMapLayerStore } from '../../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './drawFormColor'
import { waitForMapViewer } from './useCoordinateDemo'

export const LINE_KIND_FORM_OPTIONS: { value: PolylineLineKind; label: string }[] = [
  { value: 'solid', label: '实线' },
  { value: 'clamp_ground', label: '贴地线' },
  { value: 'dashed', label: '虚线' },
  { value: 'outline', label: '描边线' },
  { value: 'glowing', label: '发光线' },
  { value: 'flowing', label: '流动线' },
  { value: 'gradient', label: '渐变线' },
  { value: 'arrow', label: '箭头线' },
  { value: 'volume_block', label: '体块(折线体)' },
  { value: 'volume_tube', label: '三维管线' },
  { value: 'wall', label: '垂直墙' },
]

export const ARC_TYPE_FORM_OPTIONS = [
  { value: 'GEODESIC', label: 'GEODESIC 大地线' },
  { value: 'RHUMB', label: 'RHUMB 等角航线' },
  { value: 'NONE', label: 'NONE 直线弦' },
] as const

export const CORNER_TYPE_FORM_OPTIONS = [
  { value: 'ROUNDED', label: 'ROUNDED 圆角' },
  { value: 'MITERED', label: 'MITERED 斜接' },
  { value: 'BEVELED', label: 'BEVELED 斜切' },
] as const

export function useHzxldcxrPolylineDemo() {
  const title = '绘制(PolyLine)线类（底层entity渲染）'
  const DEFAULT_COLOR = '#00d4ff'
  const mapStore = useMapLayerStore()

  /** 空域管理（FastX 全局单例，示例变量统一命名为 am） */
  let am = window.FastX?.AreaManager

  /** 绘制中（用于按钮文案；am.active 非响应式） */
  const isAreaDrawing = ref(false)

  const selectedId = ref<string | null>(null)
  const draftVertices = ref<Array<{ longitude: number; latitude: number; height: number }>>([])

  const form = reactive({
    id: '',
    lineKind: 'solid' as PolylineLineKind,
    color: DEFAULT_COLOR,
    alpha: 1,
    width: 2,
    arcType: 'GEODESIC' as 'NONE' | 'GEODESIC' | 'RHUMB',
    cornerType: 'ROUNDED' as 'ROUNDED' | 'MITERED' | 'BEVELED',
    show: true,
    dashGapColor: '#000000',
    dashGapAlpha: 0.35,
    dashLength: 16,
    dashPattern: 255,
    outlineRingColor: '#1a1a1a',
    outlineRingAlpha: 1,
    outlineRingWidth: 2,
    glowPower: 0.35,
    taperPower: 1,
    flowCycleSeconds: 4,
    trailLength: 0.35,
    repeatFlow: true,
    repeatAlongLine: 8,
    flowingImageUrl: '',
    flowTint: '#ffffff',
    flowTintAlpha: 1,
    gradientColorTexture: '0.0,#00d4ff88,1.0,#ff00ffff',
    gradientImageUrl: '',
    vbWidth: 24,
    vbBase: 0,
    vbExtrude: 40,
    tubeRadius: 50,
    tubeSmooth: 20,
    wallBase: 0,
    wallExtrude: 120,
    arrowSize: 10,
    arrowColor: '#ff0000',
    arrowAlpha: 1,
  })

  type RowRecord = PolylineSnapshot & { vertexCount: number }

  const tableData = ref<RowRecord[]>([])
  const tableShellRef = ref<HTMLElement | null>(null)
  const tableScrollY = ref(160)
  let tableResizeObserver: ResizeObserver | null = null

  let viewerRef: Viewer | null = null

  function syncDraftVerticesFromPick(points: LngLatHeight[]): void {
    draftVertices.value = points.map((p) => ({
      longitude: p.longitude,
      latitude: p.latitude,
      height: p.height ?? 0,
    }))
  }

  function updateTableScrollY(): void {
    const shell = tableShellRef.value
    if (!shell) return
    const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
    const headH = thead?.offsetHeight ?? 40
    const next = Math.floor(shell.clientHeight - headH - 6)
    tableScrollY.value = Math.max(72, next)
  }

  function toRows(snapshots: PolylineSnapshot[]): RowRecord[] {
    return snapshots.map((s) => ({
      ...s,
      vertexCount: s.positions.length,
    }))
  }

  function refreshTable(): void {
    const v = mapStore.getViewer()
    const PL = window.FastX?.PolyLine
    if (!v || v.isDestroyed() || !PL) {
      tableData.value = []
      return
    }
    tableData.value = toRows(PL.getAllPolylines(v))
    void nextTick(() => updateTableScrollY())
  }

  function hex6ForColorInput(css: string): string {
    const t = css.trim()
    if (t.startsWith('#') && t.length >= 7) return t.slice(0, 7)
    return '#000000'
  }

  function onColorPick(
    field: 'color' | 'dashGapColor' | 'outlineRingColor' | 'flowTint' | 'arrowColor',
    ev: Event,
  ): void {
    const el = ev.target as HTMLInputElement
    const fb =
      field === 'color' || field === 'arrowColor'
        ? DEFAULT_COLOR
        : field === 'flowTint'
          ? '#ffffff'
          : '#000000'
    const hex = normalizeHex(el.value, fb)
    if (field === 'color') form.color = hex
    else if (field === 'dashGapColor') form.dashGapColor = hex
    else if (field === 'outlineRingColor') form.outlineRingColor = hex
    else if (field === 'arrowColor') form.arrowColor = hex
    else form.flowTint = hex
  }

  function fillFormFromSnapshot(s: PolylineSnapshot): void {
    const td = s.targetData
    form.id = s.id
    form.lineKind = s.lineKind
    const fillCss =
      s.colorCss ?? (typeof td.color === 'string' && td.color.trim() ? String(td.color) : undefined)
    const fillP = parseCssColorForForm(fillCss, DEFAULT_COLOR)
    form.color = fillP.hex
    const tdA = typeof td.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined
    form.alpha = tdA ?? fillP.alpha
    form.width = s.width
    const arc = s.arcType
    if (arc === 'NONE' || arc === 'GEODESIC' || arc === 'RHUMB') form.arcType = arc
    else form.arcType = 'GEODESIC'
    const ct = s.cornerType ?? (typeof td.cornerType === 'string' ? td.cornerType : undefined)
    if (ct === 'ROUNDED' || ct === 'MITERED' || ct === 'BEVELED') form.cornerType = ct
    else form.cornerType = 'ROUNDED'
    form.show = s.show
    const d = s.dashed
    if (d) {
      const gapP = parseCssColorForForm(
        typeof d.gapColor === 'string' ? d.gapColor : undefined,
        '#000000',
      )
      form.dashGapColor = gapP.hex
      form.dashGapAlpha =
        typeof d.gapAlpha === 'number' && Number.isFinite(d.gapAlpha) ? d.gapAlpha : gapP.alpha
      form.dashLength = d.dashLength ?? 16
      form.dashPattern = d.dashPattern ?? 255
    }
    const o = s.outline
    if (o) {
      const ringP = parseCssColorForForm(
        typeof o.outlineColor === 'string' ? o.outlineColor : undefined,
        '#1a1a1a',
      )
      form.outlineRingColor = ringP.hex
      form.outlineRingAlpha =
        typeof o.outlineAlpha === 'number' && Number.isFinite(o.outlineAlpha)
          ? o.outlineAlpha
          : ringP.alpha
      form.outlineRingWidth = o.outlineWidth ?? 2
    }
    const g = s.glowing
    if (g) {
      form.glowPower = g.glowPower ?? 0.35
      form.taperPower = g.taperPower ?? 1
    }
    const f = s.flowing
    if (f) {
      form.flowCycleSeconds = f.flowCycleSeconds ?? 4
      form.trailLength = f.trailLength ?? 0.35
      form.repeatFlow = f.repeat !== false
      form.repeatAlongLine = f.repeatAlongLine ?? 8
      form.flowingImageUrl = f.imageUrl ?? ''
      const flowP = parseCssColorForForm(
        typeof f.flowColor === 'string' ? f.flowColor : undefined,
        '#ffffff',
      )
      form.flowTint = flowP.hex
      form.flowTintAlpha =
        typeof f.flowColorAlpha === 'number' && Number.isFinite(f.flowColorAlpha)
          ? f.flowColorAlpha
          : flowP.alpha
    }
    const gr = s.gradient
    if (gr) {
      form.gradientColorTexture = gr.polylineMaterialColorTexture ?? form.gradientColorTexture
      form.gradientImageUrl = gr.imageUrl ?? ''
    }
    const vb = s.volumeBlock
    if (vb) {
      form.vbWidth = vb.blockWidth ?? 24
      form.vbBase = vb.baseHeight ?? 0
      form.vbExtrude = vb.extrudeHeight ?? 40
    }
    const vt = s.volumeTube
    if (vt) {
      form.tubeRadius = vt.radius ?? 50
      form.tubeSmooth = vt.polylineVolumeSmooth ?? 20
    }
    const w = s.wall
    if (w) {
      form.wallBase = w.baseHeight ?? 0
      form.wallExtrude = w.extrudeHeight ?? 120
    }
    const ar = s.arrow
    if (ar) {
      if (ar.arrowSize !== undefined) form.arrowSize = ar.arrowSize
      if (ar.arrowColor) {
        const arP = parseCssColorForForm(ar.arrowColor, '#ff0000')
        form.arrowColor = arP.hex
        form.arrowAlpha =
          ar.arrowAlpha !== undefined && Number.isFinite(ar.arrowAlpha) ? ar.arrowAlpha : arP.alpha
      } else if (ar.arrowAlpha !== undefined && Number.isFinite(ar.arrowAlpha)) {
        form.arrowAlpha = ar.arrowAlpha
      }
    }
  }

  /** 标绘成功结束后将参数详情恢复为默认值，便于连续标绘 */
  function resetFormToInitial(): void {
    form.id = ''
    form.lineKind = 'solid'
    form.color = DEFAULT_COLOR
    form.alpha = 1
    form.width = 2
    form.arcType = 'GEODESIC'
    form.cornerType = 'ROUNDED'
    form.show = true
    form.dashGapColor = '#000000'
    form.dashGapAlpha = 0.35
    form.dashLength = 16
    form.dashPattern = 255
    form.outlineRingColor = '#1a1a1a'
    form.outlineRingAlpha = 1
    form.outlineRingWidth = 2
    form.glowPower = 0.35
    form.taperPower = 1
    form.flowCycleSeconds = 4
    form.trailLength = 0.35
    form.repeatFlow = true
    form.repeatAlongLine = 8
    form.flowingImageUrl = ''
    form.flowTint = '#ffffff'
    form.flowTintAlpha = 1
    form.gradientColorTexture = '0.0,#00d4ff88,1.0,#ff00ffff'
    form.gradientImageUrl = ''
    form.vbWidth = 24
    form.vbBase = 0
    form.vbExtrude = 40
    form.tubeRadius = 50
    form.tubeSmooth = 20
    form.wallBase = 0
    form.wallExtrude = 120
    form.arrowSize = 10
    form.arrowColor = '#ff0000'
    form.arrowAlpha = 1
  }

  function effectiveWidth(): number {
    if (form.lineKind === 'glowing') return Math.max(form.width, 6)
    return form.width
  }

  function buildTypeParamsForLineKind(kind: PolylineLineKind) {
    const k = kind
    if (k === 'dashed')
      return {
        dashed: {
          gapColor: form.dashGapColor,
          gapAlpha: form.dashGapAlpha,
          dashLength: form.dashLength,
          dashPattern: form.dashPattern,
        },
      }
    if (k === 'outline')
      return {
        outline: {
          outlineColor: form.outlineRingColor,
          outlineAlpha: form.outlineRingAlpha,
          outlineWidth: form.outlineRingWidth,
        },
      }
    if (k === 'glowing') return { glowing: { glowPower: form.glowPower, taperPower: form.taperPower } }
    if (k === 'flowing')
      return {
        flowing: {
          imageUrl: form.flowingImageUrl.trim() || undefined,
          flowColor: form.flowTint,
          flowColorAlpha: form.flowTintAlpha,
          flowCycleSeconds: form.flowCycleSeconds,
          trailLength: form.trailLength,
          repeat: form.repeatFlow,
          repeatAlongLine: form.repeatAlongLine,
        },
      }
    if (k === 'gradient')
      return {
        gradient: {
          polylineMaterialColorTexture: form.gradientColorTexture.trim() || undefined,
          imageUrl: form.gradientImageUrl.trim() || undefined,
        },
      }
    if (k === 'volume_block')
      return {
        volumeBlock: {
          blockWidth: form.vbWidth,
          baseHeight: form.vbBase,
          extrudeHeight: form.vbExtrude,
        },
      }
    if (k === 'volume_tube')
      return {
        volumeTube: {
          radius: form.tubeRadius,
          polylineVolumeSmooth: form.tubeSmooth,
        },
      }
    if (k === 'wall')
      return {
        wall: {
          baseHeight: form.wallBase,
          extrudeHeight: form.wallExtrude,
        },
      }
    if (k === 'arrow')
      return {
        arrow: {
          arrowSize: form.arrowSize,
          arrowColor: form.arrowColor.trim() || undefined,
          arrowAlpha: form.arrowAlpha,
        },
      }
    return {}
  }

  type PlOptionsWithoutPath = Omit<AddPolylineOptions, 'positions' | 'id'>

  /**
   * 贴地线在标绘预览阶段用「非贴地实线」代替：每多点一次都会触发 Entity 更新，
   * 若每次重建 GroundPolylinePrimitive，既慢又易触发 GPU/ArrayBuffer 巨量分配。
   * 完成线段后再按真实 clamp_ground 落库。
   */
  function buildPlOptionsBase(isPreview: boolean): PlOptionsWithoutPath {
    const k = form.lineKind
    const previewAsSolidClamp = isPreview && k === 'clamp_ground'
    const lineKind = previewAsSolidClamp ? 'solid' : k
    const polylineClampToGround = previewAsSolidClamp ? 0 : k === 'clamp_ground' ? 1 : 0
    return {
      lineKind,
      color: form.color,
      alpha: form.alpha,
      width: effectiveWidth(),
      polylineClampToGround,
      arcType: form.arcType,
      cornerType: form.cornerType,
      show: isPreview ? true : form.show,
      ...buildTypeParamsForLineKind(lineKind),
    }
  }

  function buildPolylineStartParams(): AreaDrawStartParams {
    return {
      shapeType: 'polyline',
      id: form.id.trim() || undefined,
      ...buildPlOptionsBase(false),
      preview: {
        anchorPointColor: '#00d4ff',
        cursorPointColor: '#00d4ff',
        lineColor: form.color,
        outlineColor: form.color,
        outlineWidth: effectiveWidth(),
      },
      onAnchorChange: (points) => {
        syncDraftVerticesFromPick(points)
        if (points.length === 0) isAreaDrawing.value = false
      },
    } as AreaDrawStartParams
  }

  function stopAreaDraw(): void {
    am?.cancel()
    isAreaDrawing.value = false
    draftVertices.value = []
  }

  function setupAreaManagerPublish(): void {
    if (!am) return
    am.publish((result) => {
      if (result.shapeType !== 'polyline') return
      stopAreaDraw()
      message.success('已添加折线')
      refreshTable()
      resetFormToInitial()
    })
  }

  function onRowClick(record: RowRecord): void {
    stopAreaDraw()
    selectedId.value = record.id
    const snap = window.FastX?.PolyLine?.getPolyline(record.id)
    if (snap) fillFormFromSnapshot(snap)
  }

  function onDeleteRow(id: string, e: Event): void {
    e.stopPropagation()
    window.FastX?.PolyLine?.remove(id)
    if (selectedId.value === id) {
      selectedId.value = null
      stopAreaDraw()
      resetFormToInitial()
    }
    refreshTable()
    message.success('已删除')
  }

  function onCancelSelect(): void {
    selectedId.value = null
    stopAreaDraw()
    resetFormToInitial()
  }

  function applyUpdateToSelected(): void {
    const id = selectedId.value
    const PL = window.FastX?.PolyLine
    const v = mapStore.getViewer()
    if (!id || !PL || !v || v.isDestroyed()) return
    const ok = PL.updatePolyline(id, buildPlOptionsBase(false))
    if (ok) {
      message.success('已保存修改')
      refreshTable()
    } else {
      message.error('保存失败，请确认该线仍存在')
    }
  }

  /** PolyLine 单类 `add` 绘制（不经过空域管理）。 */
  function addPolylineFromForm(): void {
    const v = mapStore.getViewer()
    const PL = window.FastX?.PolyLine
    if (!v || v.isDestroyed() || !PL) return
    if (draftVertices.value.length < 2) {
      message.warning('至少需要 2 个顶点')
      return
    }
    const tuples = draftVertices.value.map(
      (p) => [p.longitude, p.latitude, p.height] as [number, number, number],
    )
    const idOpt = form.id.trim() || undefined
    stopAreaDraw()
    const entity = PL.add(v, {
      ...buildPlOptionsBase(false),
      id: idOpt,
      positions: tuples,
    })
    if (!entity) {
      message.error('添加失败：id 可能重复，请修改 id 后重试')
      return
    }
    message.success('已添加折线')
    refreshTable()
    resetFormToInitial()
  }

  const primaryButtonText = computed(() => {
    if (selectedId.value) return '确定'
    return isAreaDrawing.value ? '完成标绘' : '绘制'
  })

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
        message.warning('至少需要 2 个顶点')
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
    draftVertices.value = []
    const ok = am.start(v, buildPolylineStartParams())
    if (!ok) {
      message.error('无法开始折线绘制')
      return
    }
    isAreaDrawing.value = true
    message.info('鼠标左键点击绘制，右键结束')

    // --- PolyLine 单类 add（不用空域管理时注释上一段，改用下方）---
    // addPolylineFromForm()
  }

  const lineKindLabels: Record<PolylineLineKind, string> = {
    solid: '实线',
    clamp_ground: '贴地线',
    dashed: '虚线',
    outline: '描边线',
    glowing: '发光线',
    flowing: '流动线',
    gradient: '渐变线',
    arrow: '箭头线',
    volume_block: '体块',
    volume_tube: '三维管线',
    wall: '垂直墙',
  }

  const columns: TableColumnType<RowRecord>[] = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 120, align: 'center' },
    {
      title: '线型',
      dataIndex: 'lineKind',
      key: 'lineKind',
      width: 96,
      align: 'center',
      customRender: ({ text }) => lineKindLabels[text as PolylineLineKind] ?? String(text),
    },
    {
      title: '弧段',
      dataIndex: 'arcType',
      key: 'arcType',
      width: 72,
      align: 'center',
    },
    {
      title: '贴地',
      dataIndex: 'polylineClampToGround',
      key: 'polylineClampToGround',
      width: 44,
      align: 'center',
      customRender: ({ text }) => (text === 1 ? '是' : '否'),
    },
    { title: '顶点数', dataIndex: 'vertexCount', key: 'vertexCount', width: 72, align: 'center' },
    { title: '线宽', dataIndex: 'width', key: 'width', width: 52, align: 'center' },
    { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
  ]

  function tableRowClassName(record: RowRecord): string {
    return record.id === selectedId.value ? 'hzd-point-row--active' : ''
  }

  function customTableRow(record: RowRecord) {
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
      window.FastX?.PolyLine?.clear(v)
    }
  })

  keepAlternateDemoEntry(addPolylineFromForm)

  return {
    title,
    form,
    isAreaDrawing,
    selectedId,
    draftVertices,
    tableData,
    tableShellRef,
    tableScrollY,
    columns,
    lineKindFormOptions: LINE_KIND_FORM_OPTIONS,
    arcTypeFormOptions: ARC_TYPE_FORM_OPTIONS,
    cornerTypeFormOptions: CORNER_TYPE_FORM_OPTIONS,
    primaryButtonText,
    onPrimaryClick,
    onCancelSelect,
    onColorPick,
    hex6ForColorInput,
    onDeleteRow,
    tableRowClassName,
    customTableRow,
  }
}
