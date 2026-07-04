import type { ParabolaRadarResolvedOptions } from ".";

const BLINK_MIN_ALPHA_FACTOR = 0.55;
const BLINK_ALPHA_RANGE = 0.45;
const BLINK_WAVE_BASE = 0.5;
const BLINK_WAVE_AMPLITUDE = 0.5;
const BLINK_WAVE_FREQUENCY = Math.PI * 3;

/** 抛物面雷达扫描动画状态。 */
export interface ParabolaRadarAnimationState {
  /** 动画开始时间戳。 */
  startTime: number;
}

/** 创建扫描动画状态。 */
export function createParabolaRadarAnimationState(startTime = Date.now()): ParabolaRadarAnimationState {
  return { startTime };
}

/** 计算当前扫描角度，单位：度。 */
export function calcParabolaRadarScanAngle(
  options: Pick<ParabolaRadarResolvedOptions, "scanSpeed">,
  animation: ParabolaRadarAnimationState,
): number {
  return normalizeAngle(secondsSinceStart(animation) * options.scanSpeed);
}

/** 计算叶片透明度，支持闪烁。 */
export function calcParabolaRadarScanAlpha(
  alpha: number,
  blink: boolean,
  animation: ParabolaRadarAnimationState,
): number {
  if (!blink) return alpha;
  const seconds = secondsSinceStart(animation);
  const wave = BLINK_WAVE_BASE + BLINK_WAVE_AMPLITUDE * Math.sin(seconds * BLINK_WAVE_FREQUENCY);
  return alpha * (BLINK_MIN_ALPHA_FACTOR + BLINK_ALPHA_RANGE * wave);
}

/** 生成量化后的动画状态键，用于 Primitive 扫描重建节流。 */
export function createParabolaRadarScanStateKey(
  options: Pick<ParabolaRadarResolvedOptions, "scanSpeed" | "scanBlink" | "scanBladeAlpha">,
  animation: ParabolaRadarAnimationState,
  angleSteps = 720,
  alphaSteps = 40,
): string {
  const angle = Math.round((calcParabolaRadarScanAngle(options, animation) / 360) * angleSteps);
  const alpha = options.scanBlink
    ? Math.round(calcParabolaRadarScanAlpha(options.scanBladeAlpha, true, animation) * alphaSteps)
    : Math.round(options.scanBladeAlpha * alphaSteps);
  return `${angle}:${alpha}`;
}

function secondsSinceStart(animation: ParabolaRadarAnimationState): number {
  return Math.max(0, (Date.now() - animation.startTime) / 1000);
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
