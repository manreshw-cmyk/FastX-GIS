<script setup lang="ts">
import { message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

const map = useMapLayerStore()
const on = ref(false)
let removePost: (() => void) | null = null
let poll: ReturnType<typeof setInterval> | null = null

function sync() {
  const layer = map.getLayer()
  if (!layer) return
  on.value = layer.isOverviewMapVisible()
}

function tryAttach(): boolean {
  const v = map.getViewer()
  const layer = map.getLayer()
  if (!v || v.isDestroyed() || !layer) return false
  sync()
  removePost = v.scene.postRender.addEventListener(sync)
  return true
}

function onSwitch(checked: boolean) {
  const layer = map.getLayer()
  if (!layer) return message.warning('地图尚未就绪')
  layer.setOverviewMapVisible(checked, { bidirectionalSync: true })
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
      <div class="map-tool-head">鹰眼</div>
      <p class="map-tool-desc">小窗概览主图区域，可拖拽与滚轮联动主图</p>
      <div class="map-tool-row">
        <span class="map-tool-row-label">显示鹰眼</span>
        <a-switch :checked="on" size="small" @update:checked="onSwitch" />
      </div>
    </XDialog>
  </div>
</template>
