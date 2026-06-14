import { DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Viewer } from 'cesium'
import type { MouseEventListenOptions } from '../../../FastX/MouseEvent'
import { useMapLayerStore } from '../../../stores/modules/mapLayer'
import { waitForMapViewer } from './useCoordinateDemo'

export { DeleteOutlined }

export interface SfxBaseRow {
  id: string
  longitude: number
  latitude: number
  height: number
}

export interface SfxPickDemoApi<TOptions = unknown> {
  add(viewer: Viewer, options: TOptions): string | undefined
  update(id: string, options: TOptions): boolean
  remove(id: string): boolean
  clear(viewer?: Viewer): void
}

type MouseBinder = {
  listen(options: MouseEventListenOptions, rightDoubleClickMs?: number): void
  destroy(): void
}

type MouseBinderCtor = new (viewer: Viewer) => MouseBinder

const TABLE_COLUMNS = <T extends SfxBaseRow>(): TableColumnType<T>[] => [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 138, align: 'center' },
  {
    title: '经度(°)',
    dataIndex: 'longitude',
    key: 'longitude',
    width: 108,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '纬度(°)',
    dataIndex: 'latitude',
    key: 'latitude',
    width: 108,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(5) : String(text)),
  },
  {
    title: '高度(m)',
    dataIndex: 'height',
    key: 'height',
    width: 86,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? text.toFixed(1) : String(text)),
  },
  { title: '操作', key: 'action', width: 56, align: 'center', fixed: 'right' },
]

/**
 * 特效示例页通用逻辑：左键拾取、列表选中、增删改与表格滚动。
 */
export function useSfxPickDemo<TForm extends SfxBaseRow, TOptions>(
  config: {
    createDefaultForm: () => TForm
    buildOptions: (form: TForm) => TOptions
    getApi: (viewer: Viewer) => SfxPickDemoApi<TOptions>
    /** 拾取时是否将 height 置 0，默认 true */
    zeroHeightOnPick?: boolean
  },
) {
  const mapStore = useMapLayerStore()
  const selectedId = ref<string | null>(null)
  const isDrawing = ref(false)
  const hasMapPick = ref(false)
  const form = reactive(config.createDefaultForm()) as TForm
  const tableData = ref<TForm[]>([])
  const storedById = new Map<string, TForm>()
  const tableShellRef = ref<HTMLElement | null>(null)
  const tableScrollY = ref(160)
  let tableResizeObserver: ResizeObserver | null = null
  let mouseBinder: MouseBinder | null = null
  let activeApi: SfxPickDemoApi<TOptions> | null = null

  const zeroHeightOnPick = config.zeroHeightOnPick !== false

  function updateTableScrollY(): void {
    const shell = tableShellRef.value
    if (!shell) return
    const thead = shell.querySelector('.ant-table-thead') as HTMLElement | null
    const headH = thead?.offsetHeight ?? 40
    tableScrollY.value = Math.max(72, Math.floor(shell.clientHeight - headH - 6))
  }

  function refreshTable(): void {
    tableData.value = [...storedById.values()]
    void nextTick(updateTableScrollY)
  }

  function resetFormToInitial(): void {
    Object.assign(form, config.createDefaultForm())
    hasMapPick.value = false
  }

  function syncFormFromPick(longitude: number, latitude: number, height: number): void {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
    form.longitude = longitude
    form.latitude = latitude
    if (zeroHeightOnPick) form.height = 0
    else if (Number.isFinite(height)) form.height = height
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

  function resolveViewer(): Viewer | null {
    const viewer = mapStore.getViewer()
    if (!viewer || viewer.isDestroyed()) {
      message.error('地图未就绪')
      return null
    }
    return viewer
  }

  function commitAdd(): boolean {
    const viewer = resolveViewer()
    if (!viewer) return false
    if (!hasMapPick.value && !selectedId.value) {
      message.warning('请先在地图上左键拾取位置')
      return false
    }
    activeApi = config.getApi(viewer)
    const id = activeApi.add(viewer, config.buildOptions(form))
    if (!id) {
      message.error('添加失败，请检查 id 是否重复或参数是否有效')
      return false
    }
    storedById.set(id, { ...form, id } as TForm)
    message.success('已添加特效')
    refreshTable()
    resetFormToInitial()
    stopDraw()
    return true
  }

  function applyUpdateToSelected(): void {
    const id = selectedId.value
    if (!id) return
    const viewer = resolveViewer()
    if (!viewer) return
    activeApi = config.getApi(viewer)
    const ok = activeApi.update(id, config.buildOptions(form))
    if (!ok) {
      message.error('保存失败，请确认该特效仍存在')
      return
    }
    storedById.set(id, { ...form, id } as TForm)
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
    const viewer = resolveViewer()
    if (!viewer) return
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

  function onRowClick(record: TForm): void {
    stopDraw()
    selectedId.value = record.id
    const stored = storedById.get(record.id)
    if (stored) Object.assign(form, { ...stored })
  }

  function onDeleteRow(id: string, e: Event): void {
    e.stopPropagation()
    const viewer = mapStore.getViewer()
    if (viewer && !viewer.isDestroyed()) {
      config.getApi(viewer).remove(id)
    }
    storedById.delete(id)
    if (selectedId.value === id) {
      selectedId.value = null
      stopDraw()
      resetFormToInitial()
    }
    refreshTable()
    message.success('已删除')
  }

  function tableRowClassName(record: TForm): string {
    return record.id === selectedId.value ? 'hzd-point-row--active' : ''
  }

  function customTableRow(record: TForm) {
    return { onClick: () => onRowClick(record) }
  }

  onMounted(async () => {
    const viewer = await waitForMapViewer()
    if (!viewer) message.warning('地图未能在预期时间内就绪')
    refreshTable()
    await nextTick()
    updateTableScrollY()
    tableResizeObserver = new ResizeObserver(updateTableScrollY)
    if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
  })

  onBeforeUnmount(() => {
    tableResizeObserver?.disconnect()
    tableResizeObserver = null
    stopDraw()
    const viewer = mapStore.getViewer()
    if (viewer && !viewer.isDestroyed()) {
      config.getApi(viewer).clear(viewer)
    }
    activeApi = null
    storedById.clear()
  })

  return {
    form,
    selectedId,
    isDrawing,
    hasMapPick,
    tableData,
    tableShellRef,
    tableScrollY,
    columns: TABLE_COLUMNS<TForm>(),
    primaryButtonText,
    onPrimaryClick,
    onCancelSelect,
    onRowClick,
    onDeleteRow,
    tableRowClassName,
    customTableRow,
    refreshTable,
  }
}

export function createLazySfxApi<T extends SfxPickDemoApi>(
  Ctor: new () => T,
): (viewer: Viewer) => T {
  let api: T | null = null
  return (_viewer: Viewer) => {
    if (!api) api = new Ctor()
    return api
  }
}

export function positionAtZeroHeight(form: { longitude: number; latitude: number }) {
  return { longitude: form.longitude, latitude: form.latitude, height: 0 }
}

export function rgbaCss(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
