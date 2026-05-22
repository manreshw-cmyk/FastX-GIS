/**
 * 轨迹定义：由关键帧生成 `SampledPositionProperty`，供 Entity / Path / Mover 绑定。
 * 不依赖 Viewer、Entity 或绘制类。
 */

import * as Cesium from 'cesium'

import type { TrajectoryKeyframe, TrajectoryLngLatKeyframe, TrajectoryOptions } from '../Types'
export type { TrajectoryKeyframe, TrajectoryLngLatKeyframe, TrajectoryOptions }

function assignUniformTimes(count: number, durationSeconds: number): number[] {
  if (count <= 1) return [0]
  const dur = durationSeconds > 0 ? durationSeconds : 60
  const times: number[] = []
  for (let i = 0; i < count; i++) {
    times.push((dur * i) / (count - 1))
  }
  return times
}

function resolveTimes(keyframes: TrajectoryLngLatKeyframe[], durationSeconds: number): number[] {
  const explicit = keyframes.every((k) => k.timeSeconds !== undefined && Number.isFinite(k.timeSeconds))
  if (explicit) {
    const times = keyframes.map((k) => Math.max(0, Number(k.timeSeconds)))
    // 多帧同一时刻时 SampledPositionProperty 只保留末点 → 模型会出现在终点
    if (new Set(times).size < 2) {
      return assignUniformTimes(keyframes.length, durationSeconds)
    }
    return times
  }
  return assignUniformTimes(keyframes.length, durationSeconds)
}

export default class Trajectory {
  private readonly property: Cesium.SampledPositionProperty
  private readonly startTime: Cesium.JulianDate
  private readonly endTime: Cesium.JulianDate
  private readonly durationSeconds: number
  private readonly keyframes: TrajectoryKeyframe[]

  constructor(keyframes: TrajectoryKeyframe[], options?: TrajectoryOptions) {
    if (keyframes.length < 2) {
      throw new Error('[FastX.Trajectory] 至少需要 2 个关键帧')
    }

    this.keyframes = keyframes.map((k) => ({
      position: Cesium.Cartesian3.clone(k.position),
      timeSeconds: k.timeSeconds,
    }))

    this.startTime = options?.startTime?.clone() ?? Cesium.JulianDate.now()
    this.property = new Cesium.SampledPositionProperty()

    const degree = options?.interpolationDegree ?? 1
    this.property.setInterpolationOptions({
      interpolationDegree: degree,
      interpolationAlgorithm:
        degree <= 1 ? Cesium.LinearApproximation : Cesium.HermitePolynomialApproximation,
    })
    this.property.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD
    this.property.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD

    // 每帧须用新的 JulianDate；复用同一对象会导致 addSample 全部落在末帧时刻
    for (const kf of this.keyframes) {
      const when = Cesium.JulianDate.addSeconds(this.startTime, kf.timeSeconds, new Cesium.JulianDate())
      this.property.addSample(when, kf.position)
    }

    const lastT = Math.max(...this.keyframes.map((k) => k.timeSeconds), 0)
    const optDur = options?.durationSeconds
    let span =
      typeof optDur === 'number' && Number.isFinite(optDur) && optDur > 0
        ? Math.max(lastT, optDur)
        : lastT > 0
          ? lastT
          : 60
    if (options?.endTime) {
      const byEnd = Cesium.JulianDate.secondsDifference(options.endTime, this.startTime)
      if (byEnd > 0) span = Math.max(span, byEnd)
    }
    this.durationSeconds = span
    this.endTime = options?.endTime?.clone()
      ?? Cesium.JulianDate.addSeconds(this.startTime, this.durationSeconds, new Cesium.JulianDate())
  }

  getPositionProperty(): Cesium.SampledPositionProperty {
    return this.property
  }

  getPositionAtTime(time: Cesium.JulianDate): Cesium.Cartesian3 | undefined {
    return this.property.getValue(time)
  }

  getStartTime(): Cesium.JulianDate {
    return this.startTime.clone()
  }

  getEndTime(): Cesium.JulianDate {
    return this.endTime.clone()
  }

  getDuration(): number {
    return this.durationSeconds
  }

  getKeyframes(): TrajectoryKeyframe[] {
    return this.keyframes.map((k) => ({
      position: Cesium.Cartesian3.clone(k.position),
      timeSeconds: k.timeSeconds,
    }))
  }

  getAvailability(): Cesium.TimeIntervalCollection {
    return new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({
        start: this.startTime.clone(),
        stop: this.endTime.clone(),
      }),
    ])
  }

  /** 经纬度关键帧；未写 `timeSeconds` 时在 `durationSeconds` 内均匀分配 */
  static fromLngLatKeyframes(
    points: TrajectoryLngLatKeyframe[],
    durationSeconds: number,
    options?: TrajectoryOptions,
  ): Trajectory {
    if (points.length < 2) {
      throw new Error('[FastX.Trajectory] 至少需要 2 个经纬度关键帧')
    }
    const times = resolveTimes(points, durationSeconds)
    const keyframes: TrajectoryKeyframe[] = points.map((p, i) => ({
      position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.height ?? 0),
      timeSeconds: times[i]!,
    }))
    return new Trajectory(keyframes, {
      ...options,
      durationSeconds: durationSeconds > 0 ? durationSeconds : options?.durationSeconds,
    })
  }

  static fromDegrees(
    points: Array<{ lng: number; lat: number; height?: number; timeSeconds: number }>,
    options?: TrajectoryOptions,
  ): Trajectory {
    const keyframes = points.map((p) => ({
      position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.height ?? 0),
      timeSeconds: p.timeSeconds,
    }))
    return new Trajectory(keyframes, options)
  }

  static fromCartesian(
    points: Array<{ position: Cesium.Cartesian3; timeSeconds: number }>,
    options?: TrajectoryOptions,
  ): Trajectory {
    const keyframes = points.map((p) => ({
      position: p.position,
      timeSeconds: p.timeSeconds,
    }))
    return new Trajectory(keyframes, options)
  }
}
