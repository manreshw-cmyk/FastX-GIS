<script setup lang="ts">
import * as Cesium from 'cesium'
import { message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const map = useMapLayerStore()
const scene3D = ref(true)
let removePost: (() => void) | null = null
let poll: ReturnType<typeof setInterval> | null = null

function syncSceneMode() {
  const v = map.getViewer()
  if (!v || v.isDestroyed()) return
  if (v.scene.mode === Cesium.SceneMode.MORPHING) return
  scene3D.value = v.scene.mode === Cesium.SceneMode.SCENE3D
}

function tryAttach(): boolean {
  const v = map.getViewer()
  if (!v || v.isDestroyed()) return false
  syncSceneMode()
  removePost = v.scene.postRender.addEventListener(syncSceneMode)
  return true
}

function onSceneSwitch(checked: boolean) {
  const layer = map.getLayer()
  if (!layer) return message.warning('地图尚未就绪')
  layer.setSceneMode(checked ? '3d' : '2d', 1)
}

onMounted(() => {
  if (tryAttach()) return
  poll = setInterval(() => {
    if (tryAttach() && poll) {
      clearInterval(poll)
      poll = null
    }
  }, 120)
})

onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
  removePost?.()
})
</script>

<template>
  <div class="map-tool-float">
    <XDialog :width="288">
      <div class="map-tool-head">二三维切换</div>
      <p class="map-tool-desc">开启为三维球面，关闭为二维平面</p>
      <div class="map-tool-row">
        <span class="map-tool-row-label">三维视图</span>
        <a-switch :checked="scene3D" size="small" @update:checked="onSceneSwitch" />
      </div>
    </XDialog>
  </div>
</template>
