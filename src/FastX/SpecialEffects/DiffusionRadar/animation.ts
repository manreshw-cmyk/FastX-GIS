import type { DiffusionRadarResolvedOptions } from ".";

/** 扩散雷达动画状态。 */
export interface DiffusionRadarAnimationState {
  /** 动画开始时间戳。 */
  startTime: number;
}

/** 单条扩散波纹的动画状态。 */
export interface DiffusionRadarWaveState {
  /** 当前波纹扩散进度，范围 0 到 1。 */
  progress: number;
  /** 当前波纹半径，单位：米。 */
  radius: number;
  /** 当前波纹透明度。 */
  alpha: number;
}

/** 创建扩散雷达动画状态。 */
export function createDiffusionRadarAnimationState(startTime = Date.now()): DiffusionRadarAnimationState {
  return { startTime };
}

/** 计算指定波纹在当前时刻的扩散状态。 */
export function calcDiffusionRadarWaveState(
  options: Pick<DiffusionRadarResolvedOptions, "radius" | "waveCount" | "duration" | "lineAlpha">,
  animation: DiffusionRadarAnimationState,
  waveIndex: number,
): DiffusionRadarWaveState {
  const count = Math.max(1, Math.floor(options.waveCount));
  const duration = Math.max(1, options.duration);
  const elapsedRatio = ((Date.now() - animation.startTime) % duration) / duration;
  const progress = (elapsedRatio + waveIndex / count) % 1;
  return {
    progress,
    radius: options.radius * progress,
    alpha: options.lineAlpha * (1 - progress),
  };
}

/** 生成量化后的动画状态键，用于 Primitive 波纹重建节流。 */
export function createDiffusionRadarWaveStateKey(
  options: Pick<DiffusionRadarResolvedOptions, "duration">,
  animation: DiffusionRadarAnimationState,
  progressSteps = 96,
): string {
  const duration = Math.max(1, options.duration);
  const progress = ((Date.now() - animation.startTime) % duration) / duration;
  return String(Math.round(progress * progressSteps));
}
