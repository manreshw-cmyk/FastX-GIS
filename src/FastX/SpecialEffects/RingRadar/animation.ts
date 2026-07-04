import type { RingRadarResolvedOptions } from ".";

/** 环形雷达扫描动画状态。 */
export interface RingRadarAnimationState {
  /** 动画开始时间戳。 */
  startTime: number;
}

/** 创建环形雷达扫描动画状态。 */
export function createRingRadarAnimationState(startTime = Date.now()): RingRadarAnimationState {
  return { startTime };
}

/** 计算当前扫描角度，单位：度。 */
export function calcRingRadarScanAngle(
  options: Pick<RingRadarResolvedOptions, "scanSpeed">,
  animation: RingRadarAnimationState,
): number {
  return normalizeAngle(secondsFrom(animation) * options.scanSpeed);
}

/** 计算闪烁后的扫描叶片透明度。 */
export function calcRingRadarScanAlpha(
  alpha: number,
  blink: boolean,
  animation: RingRadarAnimationState,
): number {
  if (!blink) return alpha;
  const seconds = secondsFrom(animation);
  return alpha * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(seconds * Math.PI * 3)));
}

/** 生成动画量化 key，用于降低 Primitive 扫描叶片重建频率。 */
export function createRingRadarScanStateKey(
  options: Pick<RingRadarResolvedOptions, "scanSpeed" | "scanBlink" | "scanBladeAlpha">,
  animation: RingRadarAnimationState,
  angleSteps = 720,
  alphaSteps = 40,
): string {
  const angle = Math.round((calcRingRadarScanAngle(options, animation) / 360) * angleSteps);
  const alpha = options.scanBlink
    ? Math.round(calcRingRadarScanAlpha(options.scanBladeAlpha, true, animation) * alphaSteps)
    : Math.round(options.scanBladeAlpha * alphaSteps);
  return `${angle}:${alpha}`;
}

function secondsFrom(animation: RingRadarAnimationState): number {
  return Math.max(0, (Date.now() - animation.startTime) / 1000);
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
