<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, ref, watch } from 'vue'
import { Coordinates } from '../Coordinates'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

defineOptions({ name: 'XMapLocatePanel' })

const visible = defineModel<boolean>('visible', { default: false })

const map = useMapLayerStore()
const coordMode = ref<'decimal' | 'dms'>('decimal')
const lonDecimal = ref<number | null>(null)
const latDecimal = ref<number | null>(null)
const lonDmsText = ref('')
const latDmsText = ref('')
const locating = ref(false)

const isDecimal = computed(() => coordMode.value === 'decimal')
const modeToggleLabel = computed(() => (isDecimal.value ? 'DMS' : '°'))
const modeToggleTitle = computed(() => (isDecimal.value ? '切换为度分秒' : '切换为十进制度'))

const DMS_PATTERN = /^(-)?(\d+)\s*°\s*(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)\s*[″"]?$/

const fillFromCamera = (): void => {
  const layer = map.getLayer()
  if (!layer) return
  const c = layer.getCameraCenterLngLatHeight()
  lonDecimal.value = Number(c.longitude.toFixed(6))
  latDecimal.value = Number(c.latitude.toFixed(6))
  lonDmsText.value = Coordinates.decimalDegreesToDmsSymbolicString(c.longitude)
  latDmsText.value = Coordinates.decimalDegreesToDmsSymbolicString(c.latitude)
}

const parseSymbolicDms = (raw: string): number | null => {
  const m = raw.trim().match(DMS_PATTERN)
  if (!m) return null
  const mag = Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600
  const v = m[1] === '-' ? -mag : mag
  return Number.isFinite(v) ? v : null
}

const isValidRange = (longitude: number, latitude: number): boolean =>
  longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90

const resolveDecimalCoords = (): { longitude: number; latitude: number } | null => {
  if (isDecimal.value) {
    if (lonDecimal.value == null || latDecimal.value == null) {
      message.warning('请填写经度、纬度')
      return null
    }
    if (!Number.isFinite(lonDecimal.value) || !Number.isFinite(latDecimal.value)) {
      message.warning('经纬度格式无效')
      return null
    }
    if (!isValidRange(lonDecimal.value, latDecimal.value)) {
      message.warning('经纬度超出有效范围')
      return null
    }
    return { longitude: lonDecimal.value, latitude: latDecimal.value }
  }

  const longitude = parseSymbolicDms(lonDmsText.value)
  const latitude = parseSymbolicDms(latDmsText.value)
  if (longitude == null || latitude == null) {
    message.warning('请按 127°1.00′17.04″ 格式填写度分秒')
    return null
  }
  if (!isValidRange(longitude, latitude)) {
    message.warning('经纬度超出有效范围')
    return null
  }
  return { longitude, latitude }
}

const toggleCoordMode = (): void => {
  if (isDecimal.value) {
    if (lonDecimal.value != null && latDecimal.value != null) {
      lonDmsText.value = Coordinates.decimalDegreesToDmsSymbolicString(lonDecimal.value)
      latDmsText.value = Coordinates.decimalDegreesToDmsSymbolicString(latDecimal.value)
    }
    coordMode.value = 'dms'
    return
  }
  const lon = parseSymbolicDms(lonDmsText.value)
  const lat = parseSymbolicDms(latDmsText.value)
  if (lon != null) lonDecimal.value = Number(lon.toFixed(6))
  if (lat != null) latDecimal.value = Number(lat.toFixed(6))
  coordMode.value = 'decimal'
}

const applyLocate = async (): Promise<void> => {
  const layer = map.getLayer()
  if (!layer) {
    message.warning('地图尚未就绪')
    return
  }
  const coords = resolveDecimalCoords()
  if (!coords) return

  locating.value = true
  try {
    const height = layer.getCameraCenterLngLatHeight().height
    await layer.setMapCenter(
      { longitude: coords.longitude, latitude: coords.latitude, height },
      { useAnimation: true, duration: 1.2 },
    )
    message.success('已定位到目标坐标')
  } finally {
    locating.value = false
  }
}

watch(visible, (open) => {
  if (open) fillFromCamera()
})
</script>

<template>
  <div v-show="visible" class="x-map-locate-panel" role="dialog" aria-label="坐标定位">
    <div class="x-map-locate-field">
      <span class="x-map-locate-label">经度</span>
      <a-input-number
        v-if="isDecimal"
        v-model:value="lonDecimal"
        :controls="false"
        :bordered="false"
        class="x-map-locate-control"
        placeholder="请输入经度"
      />
      <a-input
        v-else
        v-model:value="lonDmsText"
        :bordered="false"
        class="x-map-locate-control x-map-locate-control--wide"
        placeholder="127°1.00′17.04″"
      />
    </div>

    <div class="x-map-locate-field">
      <span class="x-map-locate-label">纬度</span>
      <a-input-number
        v-if="isDecimal"
        v-model:value="latDecimal"
        :controls="false"
        :bordered="false"
        class="x-map-locate-control"
        placeholder="请输入纬度"
      />
      <a-input
        v-else
        v-model:value="latDmsText"
        :bordered="false"
        class="x-map-locate-control x-map-locate-control--wide"
        placeholder="23°29′14.00″"
      />
    </div>

    <button type="button" class="x-map-locate-action x-map-locate-action--mode" :title="modeToggleTitle" @click="toggleCoordMode">
      <span class="x-map-locate-action-icon" aria-hidden="true">↻</span>
      <span>{{ modeToggleLabel }}</span>
    </button>

    <button
      type="button"
      class="x-map-locate-action x-map-locate-action--go"
      title="定位"
      aria-label="定位"
      :disabled="locating"
      @click="applyLocate"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6" />
        <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
$panel-bg: rgba(5, 24, 38, 0.96);
$panel-border: rgba(255, 255, 255, 0.14);
$text: #e9f6ff;
$text-muted: rgba(230, 244, 255, 0.65);
$input-bg: rgba(255, 255, 255, 0.1);
$input-border: rgba(255, 255, 255, 0.18);
$input-focus: rgba(64, 150, 255, 0.85);

.x-map-locate-panel {
  position: absolute;
  top: 10px;
  left: 46px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: $panel-bg;
  border: 1px solid $panel-border;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.32);
  pointer-events: auto;
}

.x-map-locate-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.x-map-locate-label {
  flex-shrink: 0;
  width: 28px;
  font-size: 12px;
  font-weight: 500;
  color: $text-muted;
  letter-spacing: 0.02em;
}

.x-map-locate-control {
  width: 112px !important;

  &--wide {
    width: 140px !important;
  }

  :deep(.ant-input-number),
  :deep(.ant-input) {
    width: 100%;
    border-radius: 6px;
    background: $input-bg;
    border: 1px solid $input-border;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      background 0.15s ease;
  }

  :deep(.ant-input-number-input),
  :deep(.ant-input) {
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
    line-height: 30px;
    color: $text !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  :deep(.ant-input::placeholder),
  :deep(.ant-input-number-input::placeholder) {
    color: rgba(230, 244, 255, 0.38);
  }

  :deep(.ant-input-number:hover),
  :deep(.ant-input:hover) {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.12);
  }

  :deep(.ant-input-number-focused),
  :deep(.ant-input:focus),
  :deep(.ant-input-affix-wrapper-focused) {
    border-color: $input-focus !important;
    background: rgba(255, 255, 255, 0.14) !important;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.22) !important;
  }
}

.x-map-locate-action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  min-width: 30px;
  padding: 0 8px;
  border: 1px solid $input-border;
  border-radius: 6px;
  background: $input-bg;
  color: $text;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.28);
    color: #fff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.x-map-locate-action--mode {
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.x-map-locate-action-icon {
  font-size: 13px;
  line-height: 1;
}

.x-map-locate-action--go {
  padding: 0;
  width: 30px;
  color: #7ec1ff;
  border-color: rgba(64, 150, 255, 0.45);
  background: rgba(22, 119, 255, 0.18);

  &:hover:not(:disabled) {
    background: rgba(22, 119, 255, 0.32);
    border-color: rgba(64, 150, 255, 0.75);
  }
}
</style>
