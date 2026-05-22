/**
 * 运动控制器：根据 `Trajectory` 配置 Cesium `Clock` 并控制播放。
 * 不创建 Entity；模型位置请直接绑定 `Trajectory#getPositionProperty()`。
 */

import * as Cesium from 'cesium'
import type Trajectory from './Trajectory'

import type { MoverCallbacks, MoverOptions } from '../Types'
export type { MoverCallbacks, MoverOptions }

export default class Mover {
  /** 同一 `Clock` 仅保留一个活动 Mover，避免多条轨迹重复挂 `onTick` 导致卡顿 */
  private static readonly activeByClock = new WeakMap<Cesium.Clock, Mover>()

  private trajectory: Trajectory | null = null
  private readonly clock: Cesium.Clock
  private tickListener: ((clock: Cesium.Clock) => void) | null = null
  private callbacks: MoverCallbacks = {}
  private options: Required<Pick<MoverOptions, 'speedMultiplier' | 'loop' | 'playCount' | 'autoStart'>>
  private isPlaying = false
  private isPaused = false
  private completedRuns = 0

  constructor(clock: Cesium.Clock, options?: MoverOptions) {
    this.clock = clock
    this.options = {
      speedMultiplier: options?.speedMultiplier ?? 1,
      loop: options?.loop ?? false,
      playCount: Math.max(1, Math.floor(options?.playCount ?? 1)),
      autoStart: options?.autoStart ?? false,
    }
  }

  /** 从 `Viewer` 取时钟（便捷构造，仍只操作 Clock） */
  static fromViewer(viewer: Cesium.Viewer, options?: MoverOptions): Mover {
    return new Mover(viewer.clock, options)
  }

  setTrajectory(trajectory: Trajectory): void {
    this.trajectory = trajectory
    this.completedRuns = 0
    this.configureClock()
    if (this.options.autoStart) {
      this.start()
    }
  }

  getTrajectory(): Trajectory | null {
    return this.trajectory
  }

  setCallbacks(callbacks: MoverCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  setSpeed(speedMultiplier: number): void {
    this.options.speedMultiplier = speedMultiplier
    this.clock.multiplier = speedMultiplier
  }

  setLoop(loop: boolean): void {
    this.options.loop = loop
    this.clock.clockRange = loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
  }

  setPlayCount(playCount: number): void {
    this.options.playCount = Math.max(1, Math.floor(playCount))
    this.completedRuns = 0
  }

  start(): void {
    if (!this.trajectory) return
    if (this.isPlaying && !this.isPaused) return
    const prev = Mover.activeByClock.get(this.clock)
    if (prev && prev !== this) prev.stop()
    Mover.activeByClock.set(this.clock, this)
    this.isPlaying = true
    this.isPaused = false
    this.completedRuns = 0
    this.clock.shouldAnimate = true
    this.attachTickListener()
    this.callbacks.onStart?.()
  }

  stop(): void {
    this.isPlaying = false
    this.isPaused = false
    this.clock.shouldAnimate = false
    this.detachTickListener()
    if (Mover.activeByClock.get(this.clock) === this) {
      Mover.activeByClock.delete(this.clock)
    }
    this.callbacks.onStop?.()
  }

  pause(): void {
    if (!this.isPlaying || this.isPaused) return
    this.isPaused = true
    this.clock.shouldAnimate = false
    this.callbacks.onPause?.()
  }

  resume(): void {
    if (!this.isPlaying || !this.isPaused) return
    this.isPaused = false
    this.clock.shouldAnimate = true
    this.callbacks.onResume?.()
  }

  seekToTime(time: Cesium.JulianDate): void {
    if (!this.trajectory) return
    const start = this.trajectory.getStartTime()
    const stop = this.trajectory.getEndTime()
    if (Cesium.JulianDate.lessThan(time, start)) {
      this.clock.currentTime = start.clone()
    } else if (Cesium.JulianDate.greaterThan(time, stop)) {
      this.clock.currentTime = stop.clone()
    } else {
      this.clock.currentTime = time.clone()
    }
    this.emitTimeUpdate()
  }

  seekToProgress(progress: number): void {
    if (!this.trajectory) return
    const p = Math.max(0, Math.min(1, progress))
    const when = Cesium.JulianDate.addSeconds(
      this.trajectory.getStartTime(),
      this.trajectory.getDuration() * p,
      new Cesium.JulianDate(),
    )
    this.seekToTime(when)
  }

  getProgress(): number {
    if (!this.trajectory) return 0
    const elapsed = Cesium.JulianDate.secondsDifference(
      this.clock.currentTime,
      this.trajectory.getStartTime(),
    )
    const dur = this.trajectory.getDuration()
    return dur > 0 ? Math.max(0, Math.min(1, elapsed / dur)) : 0
  }

  getState(): { isPlaying: boolean; isPaused: boolean; progress: number } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      progress: this.getProgress(),
    }
  }

  dispose(): void {
    if (Mover.activeByClock.get(this.clock) === this) {
      Mover.activeByClock.delete(this.clock)
    }
    this.stop()
    this.trajectory = null
    this.callbacks = {}
  }

  private configureClock(): void {
    if (!this.trajectory) return
    this.clock.startTime = this.trajectory.getStartTime().clone()
    this.clock.stopTime = this.trajectory.getEndTime().clone()
    this.clock.currentTime = this.trajectory.getStartTime().clone()
    this.clock.clockRange = this.options.loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
    this.clock.multiplier = this.options.speedMultiplier
  }

  private attachTickListener(): void {
    this.detachTickListener()
    this.tickListener = () => this.onClockTick()
    this.clock.onTick.addEventListener(this.tickListener)
  }

  private detachTickListener(): void {
    if (this.tickListener) {
      this.clock.onTick.removeEventListener(this.tickListener)
      this.tickListener = null
    }
  }

  private onClockTick(): void {
    if (!this.trajectory || !this.isPlaying || this.isPaused) return

    this.emitTimeUpdate()

    if (this.options.loop) {
      const p = this.getProgress()
      const stop = this.trajectory.getEndTime()
      const atOrPastEnd =
        p >= 0.999 || Cesium.JulianDate.greaterThanOrEquals(this.clock.currentTime, stop)
      if (atOrPastEnd) {
        this.completedRuns += 1
        this.clock.currentTime = this.trajectory.getStartTime().clone()
        if (!this.clock.shouldAnimate) {
          this.clock.shouldAnimate = true
        }
        this.callbacks.onLoop?.()
      }
      return
    }

    if (this.getProgress() < 0.999) return

    this.completedRuns += 1
    if (this.completedRuns >= this.options.playCount) {
      this.clock.shouldAnimate = false
      this.isPlaying = false
      this.detachTickListener()
      this.callbacks.onComplete?.()
      return
    }

    this.clock.currentTime = this.trajectory.getStartTime().clone()
  }

  private emitTimeUpdate(): void {
    if (!this.trajectory) return
    this.callbacks.onTimeUpdate?.(this.clock.currentTime, this.getProgress())
  }
}
