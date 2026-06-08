<script setup lang="ts">
import { ClearOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import * as Cesium from 'cesium'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Viewer } from 'cesium'
import { FastX, Utils } from '../../FastX'
import type {
  MouseEventListenOptions,
  MouseEventPickPayload,
  PathSnapshot,
  PlayClockWindow,
  TrajectoryLngLatKeyframe,
} from '../../FastX'
import type Trajectory from '../../FastX/Trajectory/Trajectory'
import type Mover from '../../FastX/Trajectory/Mover'

const TrajectoryApi = FastX.Trajectory
const MoverApi = FastX.Mover
const {
  DEFAULT_PLAY_SPAN_SEC,
  ZERO_HMS,
  formatHmsFromSeconds,
  msFromIso,
  resolvePlayClockWindowFromMs,
  validatePlayClockRange,
  syncViewerClock,
} = Utils.timelineClock
import dayjs, { type Dayjs } from 'dayjs'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import { normalizeHex, parseCssColorForForm } from './common/drawFormColor'
import { waitForMapViewer } from './common/useCoordinateDemo'

const DEMO_MODEL_REL = 'models/gltf/J15.gltf'
const DEFAULT_TRAIL_COLOR = '#ffcc00'
const DEFAULT_TRAIL_TIME = 25
const DEFAULT_CLOCK_MULTIPLIER = 5

function resolveDemoModelUri(): string {
  const base = import.meta.env.BASE_URL || '/'
  const rel = `${base.replace(/\/?$/, '/')}${DEMO_MODEL_REL}`
  if (typeof window !== 'undefined') return new URL(rel, window.location.href).href
  return rel
}

const DEMO_MODEL_URI = resolveDemoModelUri()

interface PathKeyframeRow {
  key: string
  label: string
  longitude: number | null
  latitude: number | null
  height: number | null
}

interface TrajectorySceneSession {
  pathId: string
  routeId: string
  trajectory: Trajectory
}

type RowRecord = PathSnapshot & { keyframeCount: number }

type MapMouseBinder = {
  listen: (options: MouseEventListenOptions) => void
  destroy: () => void
}

function createKeyframeRow(index: number, partial?: Partial<PathKeyframeRow>): PathKeyframeRow {
  return {
    key: `kf_${index}_${Date.now().toString(36)}`,
    label: `#${index + 1}`,
    longitude: null,
    latitude: null,
    height: 0,
    ...partial,
  }
}

function routeIdFor(pathId: string): string {
  return `${pathId}__route`
}

function randomRouteLineColor(): string {
  const h = Math.floor(Math.random() * 360)
  return `hsl(${h}, 72%, 68%)`
}

const title = '绘制（Path）路径类（底层entity）'
const mapStore = useMapLayerStore()

const playStart = ref<Dayjs>(dayjs())
const playEnd = ref<Dayjs>(dayjs().add(DEFAULT_PLAY_SPAN_SEC, 'second'))
/** 驱动总进度条与播放；仅在完成路径 / 确定 / 删除时与表单同步 */
const activePlayStart = ref(playStart.value)
const activePlayEnd = ref(playEnd.value)

const plotArmed = ref(false)
const selectedId = ref<string | null>(null)
const keyframeRows = ref<PathKeyframeRow[]>([])

const form = reactive({
  id: '',
  width: 4,
  color: DEFAULT_TRAIL_COLOR,
  alpha: 0.85,
  leadTime: 0,
  trailTime: DEFAULT_TRAIL_TIME,
  resolution: 20,
  showRouteLine: true,
  autoPlay: true,
  playCount: 1,
  loopPlayback: true,
  clockMultiplier: DEFAULT_CLOCK_MULTIPLIER,
  show: true,
})

const playbackProgress = ref(0)
const isScrubbing = ref(false)
const timelineTrackRef = ref<HTMLElement | null>(null)
const tableData = ref<RowRecord[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const keyframeShellRef = ref<HTMLElement | null>(null)
const tableScrollY = ref(160)
const keyframeScrollY = ref(120)

const sessions = new Map<string, TrajectorySceneSession>()
/** 驱动全局进度条与 Mover 的路径 id */
const playbackMasterId = ref<string | null>(null)
const playbackRevision = ref(0)
let wasPlayingBeforeScrub = false
let globalMover: Mover | null = null
let scrubRenderRaf = 0
let tableResizeObserver: ResizeObserver | null = null
let keyframeResizeObserver: ResizeObserver | null = null
let viewerRef: Viewer | null = null
let mouseBinder: MapMouseBinder | null = null

const globalClockWindow = computed((): PlayClockWindow | null => {
  playbackRevision.value
  const traj = getMasterTrajectory()
  if (traj) {
    return {
      start: traj.getStartTime(),
      end: traj.getEndTime(),
      durationSec: traj.getDuration(),
    }
  }
  return resolvePlayClockWindowFromMs(activePlayStart.value.valueOf(), activePlayEnd.value.valueOf())
})
const globalDurationSec = computed(() => globalClockWindow.value?.durationSec ?? 0)
const timelineEnabled = computed(
  () => tableData.value.length > 0 && sessions.size > 0 && globalDurationSec.value > 0,
)
const timelineCurrentHms = computed(() =>
  timelineEnabled.value
    ? formatHmsFromSeconds(globalDurationSec.value * playbackProgress.value)
    : ZERO_HMS,
)
const timelineTotalHms = computed(() =>
  timelineEnabled.value ? formatHmsFromSeconds(globalDurationSec.value) : ZERO_HMS,
)
const timelinePercent = computed(() =>
  timelineEnabled.value ? Math.round(playbackProgress.value * 1000) / 10 : 0,
)
const showPlayCount = computed(() => !form.loopPlayback)
const playCountDisabled = computed(() => form.loopPlayback || !form.autoPlay)

const primaryButtonText = computed(() => {
  if (selectedId.value) return '确定'
  if (plotArmed.value) {
    const n = rowsToLngLatKeyframes()?.length ?? 0
    return n >= 2 ? '完成路径' : '取消标绘'
  }
  return '标绘'
})
const primaryButtonType = computed(() => {
  if (plotArmed.value && !selectedId.value && (rowsToLngLatKeyframes()?.length ?? 0) < 2) {
    return 'default' as const
  }
  return 'primary' as const
})

watch(
  () => form.loopPlayback,
  (loop) => {
    if (loop) form.autoPlay = true
  },
)

function syncActiveClockFromForm(): void {
  activePlayStart.value = playStart.value
  activePlayEnd.value = playEnd.value
}

function initDefaultPlayClock(): void {
  const s = dayjs()
  const e = s.add(DEFAULT_PLAY_SPAN_SEC, 'second')
  playStart.value = s
  playEnd.value = e
  activePlayStart.value = s
  activePlayEnd.value = e
}

function armPlotClock(): void {
  const endMs = playEnd.value.valueOf()
  playStart.value = dayjs()
  if (!validatePlayClockRange(playStart.value.valueOf(), endMs)) {
    playEnd.value = dayjs().add(DEFAULT_PLAY_SPAN_SEC, 'second')
  }
}

function resolveFormClockWindow() {
  const win = resolvePlayClockWindowFromMs(playStart.value.valueOf(), playEnd.value.valueOf())
  if (!win) message.warning('结束时间必须大于开始时间')
  return win
}

type BuildClockSource = 'form' | 'active' | 'snapshot'

function resolveBuildClockWindow(
  snap: PathSnapshot | null | undefined,
  source: BuildClockSource,
): PlayClockWindow | null {
  if (source === 'active') {
    return resolvePlayClockWindowFromMs(activePlayStart.value.valueOf(), activePlayEnd.value.valueOf())
  }
  if (source === 'snapshot' && snap) {
    const td = snap.targetData
    const startMs =
      typeof td.playStartMs === 'number'
        ? td.playStartMs
        : typeof td.clockStartIso === 'string'
          ? msFromIso(td.clockStartIso)
          : undefined
    const endMs =
      typeof td.playEndMs === 'number'
        ? td.playEndMs
        : typeof td.clockStopIso === 'string'
          ? msFromIso(td.clockStopIso)
          : undefined
    const win = resolvePlayClockWindowFromMs(startMs, endMs)
    if (win) return win
  }
  return resolveFormClockWindow()
}

function readClockMultiplier(): number {
  const n = Number(form.clockMultiplier)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CLOCK_MULTIPLIER
}

function resetPlaybackProgress(): void {
  playbackProgress.value = 0
}

function stopGlobalMover(): void {
  globalMover?.stop()
}

function bumpPlaybackRevision(): void {
  playbackRevision.value += 1
}

function getMasterSession(): TrajectorySceneSession | null {
  if (playbackMasterId.value) {
    const s = sessions.get(playbackMasterId.value)
    if (s) return s
  }
  const firstId = tableData.value[0]?.id
  if (firstId) {
    const s = sessions.get(firstId)
    if (s) return s
  }
  return sessions.values().next().value ?? null
}

function pickPlaybackMaster(): void {
  if (playbackMasterId.value && sessions.has(playbackMasterId.value)) return
  playbackMasterId.value = tableData.value[0]?.id ?? null
}

function scheduleScrubRender(viewer: Viewer): void {
  if (scrubRenderRaf) return
  scrubRenderRaf = requestAnimationFrame(() => {
    scrubRenderRaf = 0
    if (!viewer.isDestroyed()) viewer.scene.requestRender()
  })
}

function ensureGlobalMover(viewer: Viewer): Mover {
  if (!globalMover) globalMover = MoverApi.fromViewer(viewer, { autoStart: false })
  return globalMover
}

function getMasterTrajectory(): Trajectory | null {
  return getMasterSession()?.trajectory ?? null
}

function disposeSession(pathId: string): void {
  const session = sessions.get(pathId)
  if (!session) return
  window.FastX?.Path?.remove(pathId)
  window.FastX?.PolyLine?.remove(session.routeId)
  sessions.delete(pathId)
  if (playbackMasterId.value === pathId) {
    playbackMasterId.value = null
  }
  bumpPlaybackRevision()
}

function attachModelToPathEntity(entity: Cesium.Entity, position: Cesium.PositionProperty): void {
  entity.orientation = new Cesium.VelocityOrientationProperty(position)
  entity.model = new Cesium.ModelGraphics({
    uri: DEMO_MODEL_URI,
    scale: 0.35,
    minimumPixelSize: 40,
    runAnimations: false,
    show: form.show !== false,
  })
}

async function ensurePathEntityModelReady(viewer: Viewer): Promise<void> {
  await Cesium.Resource.fetch({ url: DEMO_MODEL_URI })
  await new Promise<void>((resolve) => {
    let frames = 0
    const remove = viewer.scene.postRender.addEventListener(() => {
      frames += 1
      if (frames >= 3) {
        remove()
        resolve()
      }
    })
  })
}

function bindGlobalTimelineCallbacks(mover: Mover): void {
  mover.setCallbacks({
    onTimeUpdate: (_t: Cesium.JulianDate, p: number) => {
      if (!isScrubbing.value) playbackProgress.value = p
    },
    onComplete: () => {
      playbackProgress.value = 1
    },
  })
}

function seekGlobalProgress(progress: number): void {
  const mover = globalMover
  const v = mapStore.getViewer()
  if (!mover || !v || v.isDestroyed() || !getMasterTrajectory()) return
  const p = Math.max(0, Math.min(1, progress))
  playbackProgress.value = p
  mover.seekToProgress(p)
  if (isScrubbing.value) scheduleScrubRender(v)
  else v.scene.requestRender()
}

function progressFromClientX(clientX: number): number {
  const track = timelineTrackRef.value
  if (!track) return 0
  const rect = track.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

function endTimelineScrub(): void {
  const mover = globalMover
  const v = mapStore.getViewer()
  isScrubbing.value = false
  if (wasPlayingBeforeScrub && form.autoPlay && mover) {
    mover.resume()
  }
  if (v && !v.isDestroyed()) v.scene.requestRender()
}

function onTimelinePointerDown(e: MouseEvent): void {
  if (!timelineEnabled.value) return
  e.preventDefault()
  const mover = globalMover
  if (!mover || !getMasterTrajectory()) return
  isScrubbing.value = true
  wasPlayingBeforeScrub = mover.getState().isPlaying && !mover.getState().isPaused
  if (wasPlayingBeforeScrub) mover.pause()
  seekGlobalProgress(progressFromClientX(e.clientX))
  const onMove = (ev: MouseEvent) => seekGlobalProgress(progressFromClientX(ev.clientX))
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    endTimelineScrub()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function applyGlobalPlayback(resetProgress = false): void {
  const v = mapStore.getViewer()
  const traj = getMasterTrajectory()
  const win = globalClockWindow.value
  if (!v || v.isDestroyed() || !win || !traj) {
    stopGlobalMover()
    return
  }
  if (resetProgress) {
    stopGlobalMover()
    resetPlaybackProgress()
  }

  const mover = ensureGlobalMover(v)
  bindGlobalTimelineCallbacks(mover)
  mover.setLoop(form.loopPlayback)
  mover.setPlayCount(form.playCount)
  mover.setSpeed(readClockMultiplier())
  mover.setTrajectory(traj)
  syncViewerClock(v, win, {
    loop: form.loopPlayback,
    multiplier: readClockMultiplier(),
    shouldAnimate: false,
    resetTime: resetProgress,
  })
  mover.seekToProgress(playbackProgress.value)
  playbackProgress.value = mover.getProgress()

  if (form.autoPlay) {
    mover.start()
  } else {
    mover.stop()
  }
  v.scene.requestRender()
}

/** 多路径时按当前活动时钟重建，保证与全局进度条一致 */
async function unifySessionsToActiveClock(): Promise<void> {
  const v = mapStore.getViewer()
  if (!v || v.isDestroyed() || tableData.value.length < 2) return
  for (const row of tableData.value) {
    const snap = window.FastX?.Path?.getPath(row.id)
    if (!snap) continue
    const kfs = readStoredKeyframes(snap)
    if (kfs.length < 2) continue
    const keep =
      typeof snap.targetData.routeLineColor === 'string'
        ? String(snap.targetData.routeLineColor)
        : undefined
    disposeSession(row.id)
    await buildTrajectoryScene(v, row.id, kfs, keep, true, 'active')
  }
  bumpPlaybackRevision()
}

/** 完成路径 / 确定 / 删除：提交表单时钟 → 重置进度 → 从起点重播 */
async function restartGlobalPlayback(): Promise<void> {
  syncActiveClockFromForm()
  if (tableData.value.length > 1) {
    await unifySessionsToActiveClock()
  }
  pickPlaybackMaster()
  applyGlobalPlayback(true)
}

function rowsToLngLatKeyframes(): TrajectoryLngLatKeyframe[] | undefined {
  const out: TrajectoryLngLatKeyframe[] = []
  for (const row of keyframeRows.value) {
    if (row.longitude == null || row.latitude == null) continue
    if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) continue
    out.push({
      longitude: row.longitude,
      latitude: row.latitude,
      height: row.height ?? 0,
    })
  }
  return out.length >= 2 ? out : undefined
}

function keyframesToRows(kfs: TrajectoryLngLatKeyframe[]): PathKeyframeRow[] {
  return kfs.map((k, i) =>
    createKeyframeRow(i, {
      longitude: k.longitude,
      latitude: k.latitude,
      height: k.height ?? 0,
    }),
  )
}

function readStoredKeyframes(snap: PathSnapshot): TrajectoryLngLatKeyframe[] {
  const raw = snap.targetData.keyframes
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (k): k is TrajectoryLngLatKeyframe =>
        k != null &&
        typeof k === 'object' &&
        Number.isFinite((k as TrajectoryLngLatKeyframe).longitude) &&
        Number.isFinite((k as TrajectoryLngLatKeyframe).latitude),
    )
    .map((k) => ({
      longitude: Number((k as TrajectoryLngLatKeyframe).longitude),
      latitude: Number((k as TrajectoryLngLatKeyframe).latitude),
      height: Number((k as TrajectoryLngLatKeyframe).height) || 0,
    }))
}

async function buildTrajectoryScene(
  viewer: Viewer,
  pathId: string,
  lngLatKeyframes: TrajectoryLngLatKeyframe[],
  keepRouteLineColor?: string,
  deferPlayback = false,
  clockSource: BuildClockSource = 'form',
): Promise<boolean> {
  const PathApi = window.FastX?.Path
  const PolyLineApi = window.FastX?.PolyLine
  if (!PathApi || !PolyLineApi) return false

  const snapForClock = window.FastX?.Path?.getPath(pathId)
  disposeSession(pathId)
  const clock = resolveBuildClockWindow(snapForClock ?? undefined, clockSource)
  if (!clock) return false

  const { start: clockStart, end: clockEnd, durationSec } = clock
  const trailTime =
    form.trailTime > 0 ? Math.min(form.trailTime, durationSec) : Math.min(durationSec, DEFAULT_TRAIL_TIME)
  const routeLineColor = keepRouteLineColor ?? randomRouteLineColor()

  let trajectory: Trajectory
  try {
    trajectory = TrajectoryApi.fromLngLatKeyframes(lngLatKeyframes, durationSec, {
      startTime: clockStart.clone(),
      endTime: clockEnd.clone(),
      durationSeconds: durationSec,
    })
  } catch {
    return false
  }

  const position = trajectory.getPositionProperty()
  const rId = routeIdFor(pathId)
  const targetData = {
    keyframes: lngLatKeyframes.map((k) => ({ ...k })),
    durationSeconds: durationSec,
    playStartMs: playStart.value.valueOf(),
    playEndMs: playEnd.value.valueOf(),
    clockStartIso: Cesium.JulianDate.toIso8601(clockStart),
    clockStopIso: Cesium.JulianDate.toIso8601(clockEnd),
    trailTime,
    modelUri: DEMO_MODEL_URI,
    routeLineColor,
    showRouteLine: form.showRouteLine,
    autoPlay: form.autoPlay,
    playCount: form.playCount,
    loopPlayback: form.loopPlayback,
    clockMultiplier: form.clockMultiplier,
  }

  if (form.showRouteLine) {
    PolyLineApi.add(viewer, {
      id: rId,
      positions: lngLatKeyframes.map(
        (k) => [k.longitude, k.latitude, k.height ?? 0] as [number, number, number],
      ),
      lineKind: 'solid',
      color: routeLineColor,
      alpha: 0.55,
      width: 2,
      show: form.show,
      targetData: { pathRouteFor: pathId, routeLineColor },
    })
  }

  const pathEntity = PathApi.add(viewer, {
    id: pathId,
    position,
    width: form.width,
    color: form.color,
    alpha: form.alpha,
    leadTime: form.leadTime,
    trailTime,
    resolution: Math.min(form.resolution, 8),
    show: form.show,
    targetData,
  })
  if (!pathEntity) {
    PolyLineApi.remove(rId)
    return false
  }

  attachModelToPathEntity(PathApi.getEntity(pathId) ?? pathEntity, position)

  try {
    await ensurePathEntityModelReady(viewer)
  } catch (err) {
    console.error('[hzljldc] 模型资源未就绪', err)
    PathApi.remove(pathId)
    PolyLineApi.remove(rId)
    message.error('模型未就绪，请检查 models/gltf/J15.gltf')
    return false
  }

  sessions.set(pathId, { pathId, routeId: rId, trajectory })
  playbackMasterId.value = pathId
  bumpPlaybackRevision()
  if (!deferPlayback) void restartGlobalPlayback()
  viewer.scene.requestRender()
  return true
}

async function ensureSession(pathId: string): Promise<void> {
  if (sessions.has(pathId)) return
  const v = mapStore.getViewer()
  const snap = window.FastX?.Path?.getPath(pathId)
  if (!v || v.isDestroyed() || !snap) return
  const kfs = readStoredKeyframes(snap)
  if (kfs.length < 2) return
  const keep =
    typeof snap.targetData.routeLineColor === 'string'
      ? String(snap.targetData.routeLineColor)
      : undefined
  await buildTrajectoryScene(v, pathId, kfs, keep, true, 'snapshot')
}

async function ensureAllSessions(): Promise<void> {
  const v = mapStore.getViewer()
  if (!v || v.isDestroyed()) return
  for (const row of tableData.value) {
    await ensureSession(row.id)
  }
}

function toRows(snapshots: PathSnapshot[]): RowRecord[] {
  return snapshots.map((s) => {
    const kfs = s.targetData.keyframes
    const count = Array.isArray(kfs) ? kfs.length : 0
    return { ...s, keyframeCount: count }
  })
}

function refreshTable(): void {
  const v = mapStore.getViewer()
  const P = window.FastX?.Path
  if (!v || v.isDestroyed() || !P) {
    tableData.value = []
    return
  }
  tableData.value = toRows(P.getAllPaths(v))
  void nextTick(() => updateTableScrollY())
}

function syncBodyScrollY(
  shell: HTMLElement | null,
  scrollY: { value: number },
  min: number,
  headFallback: number,
): void {
  if (!shell) return
  const head = shell.querySelector('.ant-table-thead') as HTMLElement | null
  scrollY.value = Math.max(min, Math.floor(shell.clientHeight - (head?.offsetHeight ?? headFallback) - 6))
}

function updateTableScrollY(): void {
  syncBodyScrollY(tableShellRef.value, tableScrollY, 72, 40)
}

function updateKeyframeScrollY(): void {
  syncBodyScrollY(keyframeShellRef.value, keyframeScrollY, 64, 28)
}

function fillFormFromSnapshot(s: PathSnapshot, opts?: { skipClock?: boolean }): void {
  const td = s.targetData
  form.id = s.id
  form.trailTime =
    typeof td.trailTime === 'number' && Number.isFinite(td.trailTime) && td.trailTime > 0
      ? td.trailTime
      : typeof s.trailTime === 'number' && Number.isFinite(s.trailTime) && s.trailTime > 0
        ? s.trailTime
        : DEFAULT_TRAIL_TIME
  const fillP = parseCssColorForForm(
    s.colorCss ?? (typeof td.color === 'string' ? String(td.color) : undefined),
    DEFAULT_TRAIL_COLOR,
  )
  form.color = fillP.hex
  form.alpha =
    (typeof td.alpha === 'number' && Number.isFinite(td.alpha) ? td.alpha : undefined) ?? fillP.alpha
  form.width = s.width
  form.leadTime = s.leadTime
  form.resolution = s.resolution
  form.showRouteLine = td.showRouteLine !== false
  form.autoPlay = td.autoPlay !== false
  form.playCount = typeof td.playCount === 'number' && td.playCount >= 1 ? td.playCount : 1
  form.loopPlayback = td.loopPlayback === true
  form.clockMultiplier =
    typeof td.clockMultiplier === 'number' && Number.isFinite(td.clockMultiplier)
      ? td.clockMultiplier
      : DEFAULT_CLOCK_MULTIPLIER
  if (!opts?.skipClock) {
    const startMs =
      typeof td.playStartMs === 'number'
        ? td.playStartMs
        : typeof td.clockStartIso === 'string'
          ? msFromIso(td.clockStartIso)
          : undefined
    const endMs =
      typeof td.playEndMs === 'number'
        ? td.playEndMs
        : typeof td.clockStopIso === 'string'
          ? msFromIso(td.clockStopIso)
          : undefined
    if (startMs != null) playStart.value = dayjs(startMs)
    if (endMs != null) playEnd.value = dayjs(endMs)
  }
  form.show = s.show
  keyframeRows.value = keyframesToRows(readStoredKeyframes(s))
  void nextTick(() => updateKeyframeScrollY())
}

function resetFormToInitial(): void {
  form.id = ''
  form.width = 4
  form.color = DEFAULT_TRAIL_COLOR
  form.alpha = 0.85
  form.leadTime = 0
  form.trailTime = DEFAULT_TRAIL_TIME
  form.resolution = 20
  form.showRouteLine = true
  form.autoPlay = true
  form.playCount = 1
  form.loopPlayback = true
  form.clockMultiplier = DEFAULT_CLOCK_MULTIPLIER
  initDefaultPlayClock()
  form.show = true
  keyframeRows.value = []
}

function resetFormAfterPlotSuccess(): void {
  selectedId.value = null
  plotArmed.value = false
  resetFormToInitial()
}

function resetPlotDraftOnly(): void {
  form.id = ''
  keyframeRows.value = []
}

async function onRowClick(record: RowRecord): Promise<void> {
  plotArmed.value = false
  selectedId.value = record.id
  playbackMasterId.value = record.id
  const snap = window.FastX?.Path?.getPath(record.id)
  if (snap) fillFormFromSnapshot(snap)
  await ensureSession(record.id)
}

async function onDeleteRow(id: string, e: Event): Promise<void> {
  e.stopPropagation()
  disposeSession(id)
  if (selectedId.value === id) {
    selectedId.value = null
    plotArmed.value = false
    resetFormToInitial()
  }
  refreshTable()
  if (tableData.value.length === 0) {
    resetPlaybackProgress()
    stopGlobalMover()
  } else {
    await ensureAllSessions()
    pickPlaybackMaster()
    await restartGlobalPlayback()
  }
  message.success('已删除')
}

function onCancelSelect(): void {
  selectedId.value = null
  plotArmed.value = false
  resetPlotDraftOnly()
}

async function applyUpdateToSelected(): Promise<void> {
  const pathId = selectedId.value
  const v = mapStore.getViewer()
  if (!pathId || !v || v.isDestroyed()) return
  const lngLatKeyframes = rowsToLngLatKeyframes()
  if (!lngLatKeyframes) {
    message.warning('至少需要 2 个有效关键帧后再保存')
    return
  }
  const snapBefore = window.FastX?.Path?.getPath(pathId)
  const keep =
    snapBefore && typeof snapBefore.targetData.routeLineColor === 'string'
      ? String(snapBefore.targetData.routeLineColor)
      : undefined
  const ok = await buildTrajectoryScene(v, pathId, lngLatKeyframes, keep)
  if (ok) {
    message.success('已保存修改')
    refreshTable()
    fillFormFromSnapshot(window.FastX!.Path!.getPath(pathId)!, { skipClock: true })
  } else {
    message.error('保存失败，请确认关键帧与 id 有效')
  }
}

async function finishDraftPath(): Promise<void> {
  const v = mapStore.getViewer()
  if (!v || v.isDestroyed()) return
  const lngLatKeyframes = rowsToLngLatKeyframes()
  if (!lngLatKeyframes) {
    message.warning('至少需要 2 个有效关键帧')
    return
  }
  const pathId = form.id.trim() || `path_${Date.now().toString(36)}`
  const ok = await buildTrajectoryScene(v, pathId, lngLatKeyframes)
  plotArmed.value = false
  if (!ok) {
    message.error('添加失败：id 可能重复或参数无效')
    return
  }
  message.success('已创建模型、全航迹与历史尾迹并开始播放')
  refreshTable()
  resetFormAfterPlotSuccess()
}

function onPrimaryClick(): void {
  if (selectedId.value) {
    void applyUpdateToSelected()
    return
  }
  if (plotArmed.value) {
    if ((rowsToLngLatKeyframes()?.length ?? 0) >= 2) {
      void finishDraftPath()
      return
    }
    plotArmed.value = false
    keyframeRows.value = []
    message.info('已取消标绘')
    return
  }
  selectedId.value = null
  resetPlotDraftOnly()
  armPlotClock()
  plotArmed.value = true
  message.info('请在地图上依次左键添加关键帧，至少 2 个点后点「完成路径」')
}

function onMapLeftClick(pick: MouseEventPickPayload): void {
  if (!plotArmed.value || selectedId.value) return
  if (!Number.isFinite(pick.longitude) || !Number.isFinite(pick.latitude)) {
    message.warning('未能拾取到有效坐标，请点在地球可见区域后重试')
    return
  }
  const idx = keyframeRows.value.length
  keyframeRows.value.push(
    createKeyframeRow(idx, {
      longitude: pick.longitude,
      latitude: pick.latitude,
      height: Number.isFinite(pick.height) ? pick.height : 0,
    }),
  )
  void nextTick(() => updateKeyframeScrollY())
  message.success(`已添加关键帧 ${keyframeRows.value.length}`)
}

function bindMouse(v: Viewer): void {
  const Ctor = window.FastX?.MouseEvent as (new (viewer: Viewer) => MapMouseBinder) | undefined
  if (!Ctor) {
    message.error('window.FastX.MouseEvent 未就绪')
    return
  }
  mouseBinder?.destroy()
  const binder = new Ctor(v)
  binder.listen({ onLeftClick: onMapLeftClick })
  mouseBinder = binder
}

function hex6ForColorInput(css: string): string {
  const t = css.trim()
  return t.startsWith('#') && t.length >= 7 ? t.slice(0, 7) : '#000000'
}

function onColorPick(ev: Event): void {
  form.color = normalizeHex((ev.target as HTMLInputElement).value, DEFAULT_TRAIL_COLOR)
}

function onDeleteKeyframe(key: string): void {
  keyframeRows.value = keyframeRows.value.filter((r) => r.key !== key)
  keyframeRows.value.forEach((r, i) => {
    r.label = `#${i + 1}`
  })
}

function onClearKeyframes(): void {
  keyframeRows.value = []
}

function tableRowClassName(record: RowRecord): string {
  return record.id === selectedId.value ? 'hzd-path-row--active' : ''
}

function customTableRow(record: RowRecord) {
  return { onClick: () => onRowClick(record) }
}

const keyframeColumns: TableColumnType<PathKeyframeRow>[] = [
  { title: '', dataIndex: 'label', key: 'label', width: 40, align: 'center' },
  { title: '经度(°)', key: 'longitude', width: 100, align: 'center' },
  { title: '纬度(°)', key: 'latitude', width: 100, align: 'center' },
  { title: '高(m)', key: 'height', width: 72, align: 'center' },
  { title: '', key: 'action', width: 40, align: 'center' },
]

const columns: TableColumnType<RowRecord>[] = [
  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true, width: 88, align: 'center' },
  { title: '帧数', dataIndex: 'keyframeCount', key: 'keyframeCount', width: 44, align: 'center' },
  {
    title: '时长(s)',
    key: 'durationSeconds',
    width: 56,
    align: 'center',
    customRender: ({ record }) => {
      const d = record.targetData.durationSeconds
      return typeof d === 'number' && Number.isFinite(d) ? Math.round(d) : '—'
    },
  },
  {
    title: '尾迹(s)',
    dataIndex: 'trailTime',
    key: 'trailTime',
    width: 56,
    align: 'center',
    customRender: ({ text }) => (typeof text === 'number' ? Math.round(text) : String(text)),
  },
  {
    title: '循环',
    key: 'loopPlayback',
    width: 40,
    align: 'center',
    customRender: ({ record }) => (record.targetData.loopPlayback ? '是' : '否'),
  },
  { title: '操作', key: 'action', width: 48, align: 'center', fixed: 'right' },
]

onMounted(async () => {
  initDefaultPlayClock()
  const v = await waitForMapViewer()
  if (!v) {
    message.warning('地图未能在预期时间内就绪')
    return
  }
  viewerRef = v
  refreshTable()
  if (tableData.value.length > 0) {
    await ensureAllSessions()
    pickPlaybackMaster()
    await restartGlobalPlayback()
  }
  bindMouse(v)
  await nextTick()
  updateTableScrollY()
  updateKeyframeScrollY()
  tableResizeObserver = new ResizeObserver(() => updateTableScrollY())
  if (tableShellRef.value) tableResizeObserver.observe(tableShellRef.value)
  keyframeResizeObserver = new ResizeObserver(() => updateKeyframeScrollY())
  if (keyframeShellRef.value) keyframeResizeObserver.observe(keyframeShellRef.value)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  keyframeResizeObserver?.disconnect()
  mouseBinder?.destroy()
  for (const pathId of [...sessions.keys()]) disposeSession(pathId)
  if (scrubRenderRaf) cancelAnimationFrame(scrubRenderRaf)
  globalMover?.dispose()
  globalMover = null
  const v = viewerRef
  viewerRef = null
  if (v && !v.isDestroyed()) window.FastX?.Path?.clear(v)
})
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-path">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>

        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">路径 ID</span>
                  <div class="hzd-field-control">
                    <a-input
                      v-model:value="form.id"
                      class="hzd-control-fill"
                      size="small"
                      allow-clear
                      placeholder="可选，留空自动生成"
                      :disabled="!!selectedId"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">开始时间</span>
                  <div class="hzd-field-control">
                    <a-date-picker
                      v-model:value="playStart"
                      class="hzd-picker hzd-control-fill"
                      size="small"
                      show-time
                      :allow-clear="false"
                      format="YYYY-MM-DD HH:mm:ss"
                      placement="bottomRight"
                      popup-class-name="hzd-picker-dropdown-dark"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">结束时间</span>
                  <div class="hzd-field-control">
                    <a-date-picker
                      v-model:value="playEnd"
                      class="hzd-picker hzd-control-fill"
                      size="small"
                      show-time
                      :allow-clear="false"
                      format="YYYY-MM-DD HH:mm:ss"
                      placement="bottomRight"
                      popup-class-name="hzd-picker-dropdown-dark"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示全航迹</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.showRouteLine" size="small" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">自动播放</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.autoPlay" size="small" :disabled="form.loopPlayback" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">循环播放</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.loopPlayback" size="small" />
                  </div>
                </div>

                <div v-if="showPlayCount" class="hzd-field-row">
                  <span class="hzd-field-label">播放次数</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.playCount"
                      class="hzd-control-fill"
                      size="small"
                      :min="1"
                      :max="99"
                      :controls="true"
                      :disabled="playCountDisabled"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">时钟倍速</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.clockMultiplier"
                      class="hzd-control-fill"
                      size="small"
                      :min="0.1"
                      :max="500"
                      :step="1"
                      :controls="true"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">运动尾迹（s）</span>
                  <div class="hzd-field-control">
                    <a-input-number
                      v-model:value="form.trailTime"
                      class="hzd-control-fill"
                      size="small"
                      :min="0"
                      :max="86400"
                      :controls="true"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">尾迹颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input
                        type="color"
                        class="hzd-color-hit"
                        :value="hex6ForColorInput(form.color)"
                        @input="onColorPick($event)"
                      />
                    </label>
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">尾迹透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" />
                  </div>
                </div>
                <div class="hzd-keyframe-block">
                  <div class="hzd-keyframe-head">
                    <span class="hzd-keyframe-title">关键帧（{{ keyframeRows.length }}）</span>
                    <a-button
                      type="text"
                      size="small"
                      class="hzd-clear-kf"
                      :disabled="!keyframeRows.length"
                      @click="onClearKeyframes"
                    >
                      <template #icon><ClearOutlined /></template>
                      清空
                    </a-button>
                  </div>
                  <div ref="keyframeShellRef" class="hzd-keyframe-table hzd-scroll-skin">
                    <a-table
                      class="hzd-table hzd-table--compact"
                      :columns="keyframeColumns"
                      :data-source="keyframeRows"
                      :pagination="false"
                      row-key="key"
                      size="small"
                      :scroll="{ y: keyframeScrollY }"
                    >
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'longitude'">
                          <a-input-number
                            v-model:value="record.longitude"
                            class="hzd-control-fill"
                            size="small"
                            :step="0.0001"
                            :controls="false"
                          />
                        </template>
                        <template v-else-if="column.key === 'latitude'">
                          <a-input-number
                            v-model:value="record.latitude"
                            class="hzd-control-fill"
                            size="small"
                            :step="0.0001"
                            :controls="false"
                          />
                        </template>
                        <template v-else-if="column.key === 'height'">
                          <a-input-number
                            v-model:value="record.height"
                            class="hzd-control-fill"
                            size="small"
                            :step="1"
                            :controls="false"
                          />
                        </template>
                        <template v-else-if="column.key === 'action'">
                          <a-tooltip title="删除关键帧">
                            <a-button
                              type="text"
                              danger
                              size="small"
                              class="hzd-del-btn"
                              aria-label="删除"
                              @click="onDeleteKeyframe(record.key)"
                            >
                              <template #icon><DeleteOutlined /></template>
                            </a-button>
                          </a-tooltip>
                        </template>
                      </template>
                      <template #emptyText>
                        <span class="hzd-muted">标绘时地图左键添加，或选中列表行回显后编辑</span>
                      </template>
                    </a-table>
                  </div>
                </div>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <a-button
                      :type="primaryButtonType"
                      block
                      class="map-tool-primary-btn hzd-primary-tall"
                      @click="onPrimaryClick"
                    >
                      {{ primaryButtonText }}
                    </a-button>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">
                      取消选中
                    </a-button>
                    <p v-if="plotArmed && !selectedId" class="hzd-muted">
                      已拾取 {{ keyframeRows.length }} 个关键帧；≥2 个后点「完成路径」将组合 Trajectory / Model / PolyLine / Path。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">路径列表</div>
            <div ref="tableShellRef" class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll">
              <a-table
                class="hzd-table"
                :columns="columns"
                :data-source="tableData"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ y: tableScrollY }"
                :row-class-name="tableRowClassName"
                :custom-row="customTableRow"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'action'">
                    <a-tooltip title="删除">
                      <a-button
                        type="text"
                        danger
                        size="small"
                        class="hzd-del-btn"
                        aria-label="删除"
                        @click="onDeleteRow(record.id, $event)"
                      >
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </template>
                </template>
              </a-table>
            </div>
            <div class="hzd-timeline-block">
              <div class="hzd-timeline-title">路径总进度条</div>
              <div
                class="hzd-timeline"
                :class="{ 'hzd-timeline--disabled': !timelineEnabled }"
              >
              <span class="hzd-timeline-time">{{ timelineCurrentHms }}</span>
              <div
                ref="timelineTrackRef"
                class="hzd-timeline-track"
                role="slider"
                :aria-valuenow="timelinePercent"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-disabled="!timelineEnabled"
                @mousedown="onTimelinePointerDown"
              >
                <div class="hzd-timeline-fill" :style="{ width: `${timelinePercent}%` }" />
                <div
                  class="hzd-timeline-thumb"
                  :class="{ 'hzd-timeline-thumb--hidden': !timelineEnabled }"
                  :style="{ left: `${timelinePercent}%` }"
                />
              </div>
              <span class="hzd-timeline-time">{{ timelineTotalHms }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.map-tool-float--hzd-path :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-tool-float--hzd-path :deep(.x-dialog-inner) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 10px;
}

.hzd-dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hzd-dialog-body > .map-tool-head {
  flex-shrink: 0;
}

.hzd-page-title {
  margin-bottom: 8px;
}

.hzd-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
}

.hzd-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.hzd-pane--form {
  flex: 0 1 auto;
  max-height: min(48vh, 420px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
}

.hzd-pane--table {
  flex: 1 1 0;
  min-height: 100px;
}

.hzd-pane--table .hzd-pane-title {
  margin-bottom: 6px;
}

.hzd-timeline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px 4px;
  user-select: none;
}

.hzd-timeline--disabled {
  opacity: 0.45;
  pointer-events: none;
}

.hzd-timeline-time {
  flex: 0 0 64px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
}

.hzd-timeline-track {
  flex: 1;
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
}

.hzd-timeline-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(33, 150, 243, 0.55), rgba(33, 150, 243, 0.95));
  pointer-events: none;
}

.hzd-timeline-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.85);
  transform: translateY(-50%);
  pointer-events: none;
}

.hzd-timeline-thumb--hidden {
  opacity: 0;
}

.hzd-pane-title {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}

.hzd-pane-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 12px;
  margin-right: 0;
  box-sizing: border-box;
}

.hzd-scroll-skin {
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-scroll-skin::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.hzd-scroll-skin::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
}

.hzd-scroll-skin::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-scroll-skin::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
}

.hzd-form-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}

.hzd-field-row {
  display: grid;
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr);
  column-gap: 14px;
  align-items: center;
  min-height: 32px;
}

.hzd-field-row--actions {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 0;
  grid-template-columns: 1fr;
}

.hzd-field-row--actions .hzd-actions-col {
  grid-column: 1 / -1;
  width: 100%;
}

.hzd-field-label {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hzd-field-control {
  min-width: 0;
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.hzd-field-control--slider {
  justify-content: flex-end;
}

.hzd-field-control .hzd-control-fill {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.hzd-picker.ant-picker) {
  width: 80% !important;
  max-width: 100%;
  background: rgba(0, 0, 0, 0.35) !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  border-radius: 6px !important;
}

.hzd-field-control :deep(.hzd-picker .ant-picker-input > input) {
  color: rgba(255, 255, 255, 0.92) !important;
  font-size: 12px;
}

.hzd-field-control :deep(.hzd-picker .ant-picker-suffix),
.hzd-field-control :deep(.hzd-picker .ant-picker-clear) {
  color: rgba(255, 255, 255, 0.55) !important;
}

.hzd-field-control :deep(.hzd-picker:hover),
.hzd-field-control :deep(.hzd-picker.ant-picker-focused) {
  border-color: rgba(120, 190, 255, 0.55) !important;
  box-shadow: 0 0 0 1px rgba(80, 140, 220, 0.25) !important;
}

.hzd-timeline-block {
  flex-shrink: 0;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-timeline-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}

.hzd-field-control :deep(.ant-input-number) {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input-affix-wrapper) {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input) {
  width: 100%;
}

.hzd-field-control > .ant-space {
  width: 80%;
  justify-content: flex-end;
}

.hzd-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.hzd-field-footnote {
  padding: 0 2px;
  margin: 0;
  line-height: 1.45;
}

.hzd-color-native {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 80%;
  max-width: 100%;
  min-height: 32px;
  cursor: pointer;
  position: relative;
  padding: 2px 0;
}

.hzd-color-hit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.hzd-color-native:focus-within .hzd-swatch {
  outline: 2px solid rgba(120, 190, 255, 0.65);
  outline-offset: 2px;
}

.hzd-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2) inset;
}

.hzd-slider-fill {
  flex: 0 0 auto;
  width: 80%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
}

.hzd-keyframe-block {
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 8px;
}

.hzd-keyframe-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.hzd-keyframe-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.04em;
}

.hzd-clear-kf {
  color: rgba(255, 255, 255, 0.55) !important;
  font-size: 12px !important;
}

.hzd-keyframe-table {
  max-height: 140px;
  min-height: 72px;
  overflow: hidden;
}

.hzd-actions-col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.hzd-primary-tall {
  min-height: 35px !important;
  height: 35px !important;
  padding: 0 14px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}

.hzd-cancel-select {
  color: rgba(255, 255, 255, 0.55) !important;
  align-self: center;
  padding: 0 4px !important;
  height: auto !important;
}

.hzd-cancel-select:hover {
  color: rgba(180, 220, 255, 0.95) !important;
}

.hzd-del-btn {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  color: rgba(255, 130, 130, 0.95) !important;
}

.hzd-del-btn:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.hzd-table :deep(.ant-table-thead > tr > th),
.hzd-table :deep(.ant-table-tbody > tr > td) {
  text-align: center !important;
}

.hzd-table :deep(.ant-table-thead > tr > th) {
  padding: 8px 6px !important;
}

.hzd-table :deep(.ant-table-tbody > tr > td) {
  padding: 7px 6px !important;
}

.hzd-table :deep(.ant-table-tbody > tr.hzd-path-row--active > td) {
  background: rgba(64, 150, 255, 0.22);
}

.hzd-table :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.hzd-table-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hzd-table-area--scroll :deep(.ant-table-wrapper),
.hzd-table-area--scroll :deep(.ant-spin-nested-loading),
.hzd-table-area--scroll :deep(.ant-spin-container),
.hzd-table-area--scroll :deep(.ant-table),
.hzd-table-area--scroll :deep(.ant-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.hzd-table-area--scroll :deep(.ant-table-container) {
  overflow: hidden;
}

.hzd-table-area--scroll :deep(.ant-table-body) {
  flex: 1;
  overflow: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-table--compact :deep(.ant-input-number) {
  width: 100% !important;
  font-size: 11px;
}
</style>

<!-- 时间选择器弹层挂载在 body，与 mapDemo 深色下拉一致 -->
<style lang="scss">
.hzd-picker-dropdown-dark.ant-picker-dropdown {
  .ant-picker-panel-container {
    background: rgba(18, 22, 34, 0.98) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45) !important;
  }

  .ant-picker-header,
  .ant-picker-footer {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  .ant-picker-header button,
  .ant-picker-content th,
  .ant-picker-cell,
  .ant-picker-time-panel-column > li,
  .ant-picker-time-panel-cell-inner,
  .ant-picker-time-panel-column > li .ant-picker-time-panel-cell-inner {
    color: rgba(255, 255, 255, 0.92) !important;
  }

  .ant-picker-datetime-panel .ant-picker-time-panel {
    border-inline-start-color: rgba(255, 255, 255, 0.1) !important;
  }

  .ant-picker-time-panel-column > li.ant-picker-time-panel-cell-disabled .ant-picker-time-panel-cell-inner {
    color: rgba(255, 255, 255, 0.28) !important;
  }

  .ant-picker-cell:hover:not(.ant-picker-cell-disabled) .ant-picker-cell-inner {
    background: rgba(80, 130, 210, 0.28) !important;
  }

  .ant-picker-cell-selected .ant-picker-cell-inner,
  .ant-picker-cell-range-start .ant-picker-cell-inner,
  .ant-picker-cell-range-end .ant-picker-cell-inner {
    background: rgba(70, 120, 200, 0.55) !important;
  }

  .ant-picker-time-panel-column > li.ant-picker-time-panel-cell-selected {
    background: rgba(70, 120, 200, 0.38) !important;
  }

  .ant-picker-now-btn,
  .ant-picker-today-btn {
    color: rgba(140, 190, 255, 0.95) !important;
  }
}
</style>
