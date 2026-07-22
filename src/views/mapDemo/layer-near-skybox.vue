<script setup lang="ts">
import * as Cesium from 'cesium'
import { message } from 'ant-design-vue'
import { ref } from 'vue'
import { fastxDataUrl, useLayerDemoCleanup } from './common/layer-demo-shared'

const title = '自定义近景天空盒'
const { getLayer, map } = useLayerDemoCleanup()

// 当前正在校验并渲染的天空盒按钮 key。
const loadingKey = ref<string | null>(null)
// 当前渲染成功的天空盒按钮 key。
const activeKey = ref<string | null>(null)
// 相机低于该高度时启用近景天空盒。
const maxHeight = ref(300000)

// 五组天空盒资源固定放在 public/assets/images/skybox/skybox_1~5 下。
const skyboxButtons = [1, 2, 3, 4, 5].map((index) => ({
  key: `skybox_${index}`,
  label: `天空盒${index}`,
  url: fastxDataUrl(`assets/images/skybox/skybox_${index}`),
}))

// 切换近景天空盒；相机高于阈值时会自动恢复默认天空盒。
async function handleRenderSkyBox(item: (typeof skyboxButtons)[number]) {
  const layer = getLayer()
  if (!layer) return

  loadingKey.value = item.key
  try {
    await layer.setCustomNearSkyBox(item.url, { maxHeight: maxHeight.value })
    activeKey.value = item.key
    message.success(`已渲染${item.label}`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '近景天空盒渲染失败')
  } finally {
    loadingKey.value = null
  }
}

// 恢复 Viewer 默认天空盒。
function handleReset() {
  const layer = getLayer()
  if (!layer) return
  layer.resetNearSkyBox()
  activeKey.value = null
  message.info('已重置近景天空盒')
}

// 飞到低空视角，便于观察近景天空盒是否生效。
function handleFlyNear() {
  const viewer = map.getViewer()
  if (!viewer || viewer.isDestroyed()) {
    message.warning('地图尚未就绪')
    return
  }
  const height = Math.max(10000, Math.min((maxHeight.value ?? 300000) * 0.55, 180000))
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.3913, 39.9075, height),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-18),
      roll: 0,
    },
    duration: 1.2,
  })
}
</script>

<template>
  <div class="map-tool-float map-tool-float--skybox">
    <XDialog :width="430">
      <div class="map-tool-head">{{ title }}</div>
      <div class="skybox-actions">
        <div class="skybox-setting">
          <span class="skybox-setting__label">生效高度(m)</span>
          <a-input-number
            v-model:value="maxHeight"
            class="skybox-setting__input"
            size="small"
            :min="10000"
            :step="10000"
            :controls="true"
          />
        </div>
        <div class="skybox-button-row">
          <a-button
            v-for="item in skyboxButtons"
            :key="item.key"
            size="small"
            class="map-tool-primary-btn skybox-btn"
            :class="{ 'skybox-btn--active': activeKey === item.key }"
            :loading="loadingKey === item.key"
            :disabled="loadingKey !== null && loadingKey !== item.key"
            @click="handleRenderSkyBox(item)"
          >
            {{ item.label }}
          </a-button>
        </div>
        <div class="skybox-actions__bottom">
          <a-button class="layer-demo-btn-clear skybox-plain-btn" block @click="handleFlyNear">飞到近景</a-button>
          <a-button class="layer-demo-btn-clear skybox-plain-btn" block @click="handleReset">重置</a-button>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.map-tool-float--skybox {
  :deep(.x-dialog-panel) {
    border-color: rgba(64, 150, 255, 0.2);
    box-shadow:
      0 10px 34px rgba(0, 0, 0, 0.42),
      inset 0 0 0 1px rgba(64, 150, 255, 0.08);
  }
}

.skybox-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.skybox-setting {
  display: grid;
  grid-template-columns: 88px 1fr;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(8, 16, 28, 0.42);
  border: 1px solid rgba(64, 150, 255, 0.16);
  border-radius: 8px;
}

.skybox-setting__label {
  color: rgba(226, 238, 255, 0.82);
  font-size: 12px;
  font-weight: 600;
}

.skybox-setting__input {
  width: 100%;
}

.skybox-button-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  padding: 5px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
    rgba(8, 16, 28, 0.42);
  border: 1px solid rgba(64, 150, 255, 0.16);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.skybox-btn.ant-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 32px;
  padding: 0 6px;
  overflow: hidden;
  color: rgba(226, 238, 255, 0.88);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: rgba(18, 32, 52, 0.62);
  border-color: rgba(88, 158, 234, 0.22);
  border-radius: 7px;
  box-shadow: none;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.skybox-btn.ant-btn:hover,
.skybox-btn.ant-btn:focus {
  color: #fff;
  background: rgba(35, 78, 123, 0.72);
  border-color: rgba(96, 177, 255, 0.52);
  box-shadow:
    0 0 0 1px rgba(64, 150, 255, 0.18),
    0 4px 12px rgba(64, 150, 255, 0.16);
}

.skybox-btn--active.ant-btn,
.skybox-btn--active.ant-btn:hover,
.skybox-btn--active.ant-btn:focus {
  color: #fff;
  background:
    linear-gradient(180deg, rgba(43, 142, 255, 0.86), rgba(30, 99, 202, 0.78)),
    rgba(22, 48, 82, 0.9);
  border-color: rgba(104, 190, 255, 0.82);
  box-shadow:
    0 0 0 1px rgba(64, 150, 255, 0.18),
    0 6px 14px rgba(24, 112, 255, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.skybox-actions__bottom {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skybox-plain-btn.ant-btn {
  height: 36px;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
  border-radius: 8px;
}

.skybox-plain-btn.ant-btn:hover,
.skybox-plain-btn.ant-btn:focus {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(64, 150, 255, 0.34);
}
</style>
