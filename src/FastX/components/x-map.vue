<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Viewer } from 'cesium'
import { Layer } from '../Layer'
import type { LayerInitConfig } from '../Layer/types'
import { Coordinates } from '../Coordinates'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import type { XMapConfig } from './x-map.types'
import XMapToolbar from './x-map-toolbar.vue'

defineOptions({ name: 'XMap' })

const props = defineProps<{
  xConfig: XMapConfig
}>()

const emit = defineEmits<{
  ready: [{ layer: Layer; viewer: Viewer | null }]
}>()

const cesiumId = `x-map-cesium-${Math.random().toString(36).slice(2, 11)}`
const layerRef = ref<Layer | null>(null)
const mouseStatusText = ref('层级: —  经度: —  纬度: —  高度: —')
const mouseStatusVisible = ref(true)

let removeMouseListener: (() => void) | null = null

/**
 * Viewer 构造阶段：MSAA（`msaaSamples`）+ WebGL `antialias`。
 * FXAA 见 {@link applySceneFxaa}（Cesium 在 Scene 上暴露，非 Viewer 构造参数）。
 */
function resolveViewerOptions(c: XMapConfig): Viewer.ConstructorOptions {
  const wantAA = c.antialias !== false
  const vo = { ...(c.viewerOptions ?? {}) } as Viewer.ConstructorOptions
  const ctx = { ...(vo.contextOptions ?? {}) } as Record<string, unknown>
  const webgl = { ...((ctx.webgl as Record<string, unknown> | undefined) ?? {}) }
  if (wantAA) {
    if (webgl.antialias === undefined) webgl.antialias = true
    if (vo.msaaSamples === undefined) vo.msaaSamples = 4
  } else {
    webgl.antialias = false
    vo.msaaSamples = 1
  }
  ctx.webgl = webgl
  vo.contextOptions = ctx as Viewer.ConstructorOptions['contextOptions']
  return vo
}

/** 对应底层 `scene.postProcessStages.fxaa.enabled`（与文档里的 `fxaa: true` 等价）。 */
function applySceneFxaa(viewer: Viewer, enabled: boolean): void {
  if (viewer.isDestroyed()) return
  viewer.scene.postProcessStages.fxaa.enabled = enabled
}

function detachMouseStatusBar() {
  removeMouseListener?.()
  removeMouseListener = null
}

function attachMouseStatusBar(viewer: Viewer) {
  detachMouseStatusBar()
  const canvas = viewer.scene.canvas
  const onMove = (e: MouseEvent) => {
    const llh = Coordinates.screenClientXYToLngLatHeight(viewer, e.clientX, e.clientY)
    const lev = Coordinates.estimateImageryZoomLevel(viewer)
    if (!llh) {
      mouseStatusText.value = `层级: ${lev}  经度: —  纬度: —  高度: —`
      return
    }
    mouseStatusText.value = `层级: ${lev}  经度: ${llh.longitude.toFixed(4)}  纬度: ${llh.latitude.toFixed(4)}  高度: ${llh.height.toFixed(4)}`
  }
  canvas.addEventListener('mousemove', onMove)
  removeMouseListener = () => {
    canvas.removeEventListener('mousemove', onMove)
  }
}

async function mountMap() {
  detachMouseStatusBar()
  const prev = layerRef.value
  if (prev) {
    useMapLayerStore().clearIfCurrent(prev)
    prev.destroy()
  }
  layerRef.value = null
  const c = props.xConfig
  const layer = new Layer()
  const config: LayerInitConfig = {
    mapName: c.mapName,
    center: c.center,
    orientation: c.orientation,
    imageryUrlTemplate: c.imageryUrlTemplate,
    terrainUrl: c.terrainUrl,
    initialCamera: c.initialCamera,
    depthTestAgainstTerrain: c.depthTestAgainstTerrain ?? false,
    showLonLatGridAtStartup: c.showLonLatGridAtStartup,
    lonLatGridOptions: c.lonLatGridOptions,
    viewerOptions: resolveViewerOptions(c),
  }
  await layer.initMap(cesiumId, config)
  layerRef.value = layer
  useMapLayerStore().bindLayer(layer)
  if (c.showOverview === true) {
    layer.setOverviewMapVisible(true, {
      bidirectionalSync: c.overviewBidirectionalSync !== false,
      width: c.overviewWidth,
      height: c.overviewHeight,
      heightRatio: c.overviewHeightRatio,
    })
  } else {
    layer.setOverviewMapVisible(false)
  }
  layer.setSkyAtmosphereVisible(true)
  layer.setGlobeLightingEnabled(false)
  const v = layer.getViewer()
  if (v && !v.isDestroyed()) {
    applySceneFxaa(v, c.antialias !== false)
    attachMouseStatusBar(v)
  }
  emit('ready', { layer, viewer: layer.getViewer() })
}

onMounted(() => {
  void mountMap()
})

onUnmounted(() => {
  detachMouseStatusBar()
  const inst = layerRef.value
  if (inst) {
    useMapLayerStore().clearIfCurrent(inst)
    inst.destroy()
  }
  layerRef.value = null
})

defineExpose({
  getLayer: () => layerRef.value,
})
</script>

<template>
  <div class="x-map-root">
    <div :id="cesiumId" class="x-map-cesium" />
    <XMapToolbar v-model:mouse-status-visible="mouseStatusVisible" />
    <div v-show="mouseStatusVisible" class="x-map-mouse-status" aria-live="polite">{{ mouseStatusText }}</div>
  </div>
</template>

<style scoped lang="scss">
.x-map-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.x-map-cesium {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.x-map-mouse-status {
  position: absolute;
  left: 35%;
  bottom: 12px;
  z-index: 5;
  pointer-events: none;
  padding: 6px 12px;
  max-width: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(15, 28, 48, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 4px;
  font:
    12px/1.5 ui-sans-serif,
    system-ui,
    sans-serif;
  color: rgba(255, 255, 255, 0.94);
  white-space: nowrap;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
</style>
