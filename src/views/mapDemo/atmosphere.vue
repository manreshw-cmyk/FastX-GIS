<script setup lang="ts">
import { message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const map = useMapLayerStore()
const on = ref(false)
let removePost: (() => void) | null = null
let poll: ReturnType<typeof setInterval> | null = null

function sync() {
  const v = map.getViewer()
  if (!v || v.isDestroyed()) return
  on.value = v.scene.skyAtmosphere?.show ?? false
}

function tryAttach(): boolean {
  const v = map.getViewer()
  if (!v || v.isDestroyed()) return false
  sync()
  removePost = v.scene.postRender.addEventListener(sync)
  return true
}

function onSwitch(checked: boolean) {
  const layer = map.getLayer()
  const v = map.getViewer()
  if (!layer || !v) return message.warning('地图尚未就绪')
  if (!v.scene.skyAtmosphere) return message.warning('当前场景无大气层')
  layer.setSkyAtmosphereVisible(checked)
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
      <div class="map-tool-head">大气层</div>
      <p class="map-tool-desc">天空大气散射效果，关闭可略提升性能</p>
      <div class="map-tool-row">
        <span class="map-tool-row-label">显示大气层</span>
        <a-switch :checked="on" size="small" @update:checked="onSwitch" />
      </div>
    </XDialog>
  </div>
</template>
