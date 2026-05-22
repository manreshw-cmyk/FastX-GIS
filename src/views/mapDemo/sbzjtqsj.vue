<script setup lang="ts">
import { ref } from 'vue'
import { useMapMouseEventPage } from './components/common/useMapMouseEventPage'

const title = '鼠标左键抬起（LeftEventUp）事件'
const clickCount = ref(0)

useMapMouseEventPage(() => ({
  onLeftUp: () => {
    clickCount.value += 1
  },
}))
</script>

<template>
  <div class="map-tool-float map-tool-float--pass-through">
    <XDialog :width="300">
      <div class="map-tool-head">{{ title }}</div>
      <div class="map-tool-hit-count" aria-live="polite">{{ clickCount }}</div>
      <p class="map-tool-hit-hint">在地球画布上左键抬起，数字每触发一次加 1</p>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.map-tool-hit-count {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  color: rgba(140, 210, 255, 0.98);
  letter-spacing: 0.04em;
  padding: 6px 0 2px;
}

.map-tool-hit-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  color: rgba(255, 255, 255, 0.45);
}
</style>
