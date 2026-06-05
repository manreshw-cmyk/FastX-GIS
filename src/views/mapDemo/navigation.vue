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
  on.value = layer.isNavigationControlVisible()
}

function tryAttach(): boolean {
  const v = map.getViewer()
  const layer = map.getLayer()
  if (!v || v.isDestroyed() || !layer) return false
  sync()
  removePost = v.scene.postRender.addEventListener(sync)
  return true
}

async function onSwitch(checked: boolean) {
  const layer = map.getLayer()
  if (!layer) return message.warning('地图尚未就绪')
  try {
    await layer.setNavigationControlVisible(checked)
    on.value = layer.isNavigationControlVisible()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '导航控件加载失败')
    on.value = false
  }
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
      <div class="map-tool-head">导航罗盘</div>
      <p class="map-tool-desc">左下角 cesium-navigation 罗盘（位于比例尺上方）</p>
      <div class="map-tool-row">
        <span class="map-tool-row-label">显示导航罗盘</span>
        <a-switch :checked="on" size="small" @update:checked="onSwitch" />
      </div>
    </XDialog>
  </div>
</template>
