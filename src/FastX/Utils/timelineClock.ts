/**
 * 播放时钟与 Cesium 时间轴互转（`JulianDate` / 毫秒 / 时分秒展示）。
 */

import * as Cesium from 'cesium'
import type { PlayClockWindow } from '../Types'

const DEFAULT_PLAY_SPAN_SEC = 120
const ZERO_HMS = '00:00:00'

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0')
}

function formatHmsFromSeconds(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function formatHmsFromJulianDelta(start: Cesium.JulianDate, time: Cesium.JulianDate): string {
  return formatHmsFromSeconds(Cesium.JulianDate.secondsDifference(time, start))
}

function nowMs(): number {
  return Date.now()
}

function defaultPlayEndMs(startMs: number, spanSec = DEFAULT_PLAY_SPAN_SEC): number {
  return startMs + spanSec * 1000
}

function msToJulian(ms: number): Cesium.JulianDate {
  return Cesium.JulianDate.fromDate(new Date(ms))
}

function julianToMs(jd: Cesium.JulianDate): number {
  return Cesium.JulianDate.toDate(jd).getTime()
}

function msFromIso(iso: string): number | undefined {
  try {
    const jd = Cesium.JulianDate.fromIso8601(iso)
    if (jd) return julianToMs(jd)
  } catch {
    /* fallthrough */
  }
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : undefined
}

function resolvePlayClockWindowFromMs(
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

function validatePlayClockRange(startMs: number, endMs: number): boolean {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
}

function syncViewerClock(
  viewer: Cesium.Viewer,
  window: PlayClockWindow,
  options?: {
    loop?: boolean
    multiplier?: number
    shouldAnimate?: boolean
    resetTime?: boolean
  },
): void {
  const start = window.start.clone()
  const stop = window.end.clone()
  viewer.clock.startTime = start
  viewer.clock.stopTime = stop
  if (options?.resetTime !== false) {
    viewer.clock.currentTime = start.clone()
  }
  viewer.clock.clockRange = options?.loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED
  if (options?.multiplier !== undefined && options.multiplier > 0) {
    viewer.clock.multiplier = options.multiplier
  }
  if (options?.shouldAnimate !== undefined) {
    viewer.clock.shouldAnimate = options.shouldAnimate
  }
}

const timelineClock = {
  DEFAULT_PLAY_SPAN_SEC,
  ZERO_HMS,
  formatHmsFromSeconds,
  formatHmsFromJulianDelta,
  nowMs,
  defaultPlayEndMs,
  msToJulian,
  julianToMs,
  msFromIso,
  resolvePlayClockWindowFromMs,
  validatePlayClockRange,
  syncViewerClock,
} as const

export default timelineClock
