/**
 * 播放时钟与 Cesium 时间轴互转（`JulianDate` / 毫秒 / 时分秒展示）。
 * 供 Path 示例、Mover 等将 UI 起止时间对齐到 `viewer.clock`。
 */

import * as Cesium from 'cesium'

/** 默认播放区间长度（秒）：未指定终点时由起点 + 该值推算 */
export const DEFAULT_PLAY_SPAN_SEC = 120

export const ZERO_HMS = '00:00:00'

export interface PlayClockWindow {
  start: Cesium.JulianDate
  end: Cesium.JulianDate
  durationSec: number
}

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0')
}

/** 将秒数格式化为 `HH:mm:ss`（用于进度条左右时间标签） */
export function formatHmsFromSeconds(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

/** 相对轨迹起点的已播放时长（`HH:mm:ss`） */
export function formatHmsFromJulianDelta(start: Cesium.JulianDate, time: Cesium.JulianDate): string {
  return formatHmsFromSeconds(Cesium.JulianDate.secondsDifference(time, start))
}

export function nowMs(): number {
  return Date.now()
}

export function defaultPlayEndMs(startMs: number, spanSec = DEFAULT_PLAY_SPAN_SEC): number {
  return startMs + spanSec * 1000
}

export function msToJulian(ms: number): Cesium.JulianDate {
  return Cesium.JulianDate.fromDate(new Date(ms))
}

export function julianToMs(jd: Cesium.JulianDate): number {
  return Cesium.JulianDate.toDate(jd).getTime()
}

/** ISO8601 或可被 `Date.parse` 识别的字符串 → 毫秒 */
export function msFromIso(iso: string): number | undefined {
  try {
    const jd = Cesium.JulianDate.fromIso8601(iso)
    if (jd) return julianToMs(jd)
  } catch {
    /* fallthrough */
  }
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : undefined
}

/** UI 起止毫秒 → Cesium 时钟窗口；无效时返回 `null` */
export function resolvePlayClockWindowFromMs(
  startMs: number | null | undefined,
  endMs: number | null | undefined,
): PlayClockWindow | null {
  const s = Number.isFinite(startMs) ? (startMs as number) : nowMs()
  if (!Number.isFinite(endMs)) return null
  const e = endMs as number
  if (e <= s) return null
  const start = msToJulian(s)
  const end = msToJulian(e)
  const durationSec = Cesium.JulianDate.secondsDifference(end, start)
  if (durationSec <= 0) return null
  return { start, end, durationSec }
}

/** 标绘前校验：结束时间必须严格大于开始时间 */
export function validatePlayClockRange(startMs: number, endMs: number): boolean {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
}

/** 将时钟窗口写入 `viewer.clock`（与参考 HTML 一致，先对齐再播放） */
export function syncViewerClock(
  viewer: Cesium.Viewer,
  window: PlayClockWindow,
  options?: { loop?: boolean; multiplier?: number; shouldAnimate?: boolean },
): void {
  const start = window.start.clone()
  const stop = window.end.clone()
  viewer.clock.startTime = start
  viewer.clock.stopTime = stop
  viewer.clock.currentTime = start.clone()
  viewer.clock.clockRange = options?.loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
  if (options?.multiplier !== undefined && options.multiplier > 0) {
    viewer.clock.multiplier = options.multiplier
  }
  if (options?.shouldAnimate !== undefined) {
    viewer.clock.shouldAnimate = options.shouldAnimate
  }
}
