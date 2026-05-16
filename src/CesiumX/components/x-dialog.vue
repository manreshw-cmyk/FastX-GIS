<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'XDialog' })

const props = withDefaults(
  defineProps<{
    /** 弹窗宽度，如 `320` 或 `'80%'` */
    width: string | number
    /** 弹窗高度；不传则高度随内容（`auto`） */
    height?: string | number
    /** 背景色；不传为磨砂深色 */
    backgroundColor?: string
  }>(),
  {},
)

function toCssSize(v: string | number): string {
  return typeof v === 'number' ? `${v}px` : v
}

const defaultPanelBg = 'rgba(16, 20, 28, 0.82)'

const panelStyle = computed(() => {
  const h = props.height
  return {
    width: toCssSize(props.width),
    ...(h !== undefined ? { height: toCssSize(h) } : { height: 'auto', minHeight: '96px' }),
    backgroundColor: props.backgroundColor ?? defaultPanelBg,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  }
})
</script>

<template>
  <div class="x-dialog" role="dialog" aria-modal="false">
    <div class="x-dialog-panel" :style="panelStyle">
      <div class="x-dialog-inner">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.x-dialog {
  display: inline-flex;
  max-width: 100%;
  max-height: 100%;
}

.x-dialog-panel {
  box-sizing: border-box;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(0, 0, 0, 0.2) inset;
  overflow: auto;
  color: rgba(255, 255, 255, 0.94);
}

.x-dialog-inner {
  padding: 16px 18px 14px;
}
</style>
