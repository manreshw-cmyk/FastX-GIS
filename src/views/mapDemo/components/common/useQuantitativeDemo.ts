import { message } from 'ant-design-vue'
import type { Viewer } from 'cesium'
import { onBeforeUnmount, ref } from 'vue'
import type { MeasureStyle, MeasureTypeKey } from '../../../../FastX'
import { DEFAULT_MEASURE_STYLE } from '../../../../FastX/Quantitative/measureStyleDefaults'
import { getMapViewer, waitForMapViewer } from './useCoordinateDemo'

/** 量算示例页：测量类型选项 */
export interface MeasureTypeOption {
  value: MeasureTypeKey
  label: string
  hint: string
  desc?: string
}

/**
 * 量算分析 Demo 通用逻辑：绑定 FastX.Quantitative、切换类型、开始/清空测量。
 * @param typeOptions 当前页面的测量类型列表
 */
export function useQuantitativeDemo(typeOptions: MeasureTypeOption[]) {
  const activeType = ref<MeasureTypeKey>(typeOptions[0]!.value)
  const measuring = ref(false)
  const measureStyle = ref<MeasureStyle>({ ...DEFAULT_MEASURE_STYLE })
  let quantitative = window.FastX?.Quantitative
  let drawFinishBound = false

  /** 注册绘制结束回调，用于关闭「绘制中」状态 */
  function bindDrawFinish(): void {
    if (drawFinishBound || !quantitative) return
    quantitative.onDrawFinish(() => {
      measuring.value = false
    })
    drawFinishBound = true
  }

  /** 确保 Quantitative 与 Viewer 已就绪 */
  async function ensureReady(): Promise<boolean> {
    quantitative = window.FastX?.Quantitative
    if (!quantitative) {
      message.error('FastX.Quantitative 未就绪')
      return false
    }
    const v = await waitForMapViewer()
    if (!v) {
      message.warning('地图尚未就绪')
      return false
    }
    quantitative.bindViewer(v)
    bindDrawFinish()
    return true
  }

  /** 停止交互并复位 UI 状态 */
  function resetTool(): void {
    measuring.value = false
    quantitative?.stopInteractive()
  }

  /** 清空地图上全部量算结果 */
  function clearResults(): void {
    resetTool()
    quantitative?.removeAll()
    message.success('已清空量算结果')
  }

  /** 切换量算类型（不自动清除已有结果） */
  async function switchType(type: MeasureTypeKey): Promise<void> {
    if (activeType.value === type) return
    resetTool()
    quantitative?.setMeasureType(type)
    activeType.value = type
  }

  /** 应用样式并开始交互测量 */
  async function startMeasure(): Promise<void> {
    if (!(await ensureReady())) return
    if (measuring.value) return
    quantitative!.setPendingStyle(measureStyle.value)
    quantitative!.setMeasureType(activeType.value)
    quantitative!.startInteractive(activeType.value)
    measuring.value = true
    const hint = typeOptions.find((o) => o.value === activeType.value)?.hint
    if (hint) message.info(hint)
  }

  /** 当前类型的操作提示文案 */
  function currentHint(): string {
    return typeOptions.find((o) => o.value === activeType.value)?.hint ?? ''
  }

  onBeforeUnmount(() => {
    resetTool()
    quantitative?.removeAll()
  })

  return {
    activeType,
    measuring,
    measureStyle,
    typeOptions,
    switchType,
    startMeasure,
    clearResults,
    resetTool,
    currentHint,
    getViewer: getMapViewer,
  }
}
