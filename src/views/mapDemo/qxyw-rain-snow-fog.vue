<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { GlobalFog, GlobalRain, GlobalSnow } from '../../FastX'
import { useMapLayerStore } from '../../stores/modules/mapLayer'

type WeatherType = 'rain' | 'snow' | 'fog'

interface WeatherOption {
  value: WeatherType
  label: string
  desc: string
}

const WEATHER_OPTIONS: readonly WeatherOption[] = [
  { value: 'rain', label: '雨', desc: '全局雨效' },
  { value: 'snow', label: '雪', desc: '全局雪效' },
  { value: 'fog', label: '雾', desc: '全局雾效' },
]

const mapStore = useMapLayerStore()
const activeType = ref<WeatherType | null>(null)

let currentEffect: GlobalRain | GlobalSnow | GlobalFog | null = null

/** 获取当前地图 Viewer。 */
function getViewer() {
  return mapStore.getViewer()
}

/** 销毁当前天气特效。 */
function destroyCurrentEffect(): void {
  currentEffect?.destroy()
  currentEffect = null
}

/** 根据当前类型创建天气特效。 */
function createWeatherEffect(type: WeatherType): GlobalRain | GlobalSnow | GlobalFog | null {
  const viewer = getViewer()
  if (!viewer) return null

  if (type === 'rain') {
    return new GlobalRain(viewer, {
      tiltAngle: -0.6,
      rainSize: 0.3,
      rainSpeed: 60,
    })
  }
  if (type === 'snow') {
    return new GlobalSnow(viewer, {
      snowSize: 0.02,
      snowSpeed: 60,
    })
  }
  return new GlobalFog(viewer, {
    visibility: 0.1,
    color: 'rgba(200, 200, 200, 0.5)',
  })
}

/** 切换天气类型并刷新后处理。 */
function applyWeather(type: WeatherType): void {
  activeType.value = type
  destroyCurrentEffect()
  currentEffect = createWeatherEffect(type)
}

onBeforeUnmount(() => {
  destroyCurrentEffect()
})
</script>

<template>
  <div class="map-tool-float map-tool-float--quantitative">
    <XDialog :width="336">
      <div class="qty-dialog-scroll">
        <div class="map-tool-head">雨雪雾</div>
        <p class="map-tool-desc">全局天气后处理示例，雨、雪、雾三种效果互斥切换。</p>

        <div class="map-tool-section">
          <div class="map-tool-row-label">天气类型</div>
          <a-radio-group :value="activeType" class="qty-type-cards" @update:value="applyWeather">
            <a-radio v-for="opt in WEATHER_OPTIONS" :key="opt.value" :value="opt.value" class="qty-type-card">
              <span class="qty-type-card__body">
                <span class="qty-type-card__title">{{ opt.label }}</span>
                <span class="qty-type-card__desc">{{ opt.desc }}</span>
              </span>
            </a-radio>
          </a-radio-group>
        </div>
      </div>
    </XDialog>
  </div>
</template>
