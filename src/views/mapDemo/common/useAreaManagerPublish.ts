import type { AreaDrawOutput, AreaDrawShapeType } from '../../../FastX'

/** 空域管理绘制完成回调（仅处理指定 shapeType） */
export function bindAreaManagerPublish(
  shapeType: AreaDrawShapeType,
  onDone: (result: AreaDrawOutput) => void,
  stopDrawing: () => void,
): void {
  const am = window.FastX?.AreaManager
  if (!am) return
  am.publish((result) => {
    if (result.shapeType !== shapeType) return
    stopDrawing()
    onDone(result)
  })
}
