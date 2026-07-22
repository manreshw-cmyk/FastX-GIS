<script setup lang="ts">
import * as Cesium from 'cesium'
import { message } from 'ant-design-vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { fastxDataUrl, useLayerDemoCleanup } from './common/layer-demo-shared'

const title = '绘制3D Tiles（Tileset）类'
const { map } = useLayerDemoCleanup()

type TilesetSample = {
  /** 按钮和选中态使用的唯一 key。 */
  key: string
  /** 页面按钮主标题。 */
  label: string
  /** 页面按钮辅助说明。 */
  desc: string
  /** 本地 tileset.json 地址。 */
  url: string
  /** 飞行定位时使用的相机距离，单位：米。 */
  range: number
}

// 两组公开真实建筑 3D Tiles，均已下载到 public/3d-tiles，示例加载时不依赖外网。
const tilesetSamples: TilesetSample[] = [
  {
    key: 'agi-headquarters',
    label: 'AGI总部倾斜摄影',
    desc: '真实园区建筑，373瓦片',
    url: fastxDataUrl('3d-tiles/agi-headquarters/tileset.json'),
    range: 620,
  },
  {
    key: 'plateau-minato',
    label: 'PLATEAU港区建筑',
    desc: 'LOD4建筑裁剪版，19瓦片',
    url: fastxDataUrl('3d-tiles/plateau-minato-lod4-light/tileset.json'),
    range: 1600,
  },
]

const loadingKey = ref<string | null>(null)
const activeKey = ref<string | null>(null)
const showTileset = ref(true)
let activeTileset: Cesium.Cesium3DTileset | null = null
let activeTilesetId: string | null = null

function getTilesetApi(silent = false) {
  const api = window.FastX?.Tileset
  if (!api && !silent) message.error('window.FastX.Tileset 未就绪')
  return api
}

function requestRender(): void {
  const viewer = map.getViewer()
  if (viewer && !viewer.isDestroyed()) viewer.scene.requestRender()
}

// 移除当前 tileset，避免切换示例时多个模型叠加。
function removeActiveTileset(): void {
  const api = getTilesetApi(true)
  if (api && activeTilesetId) {
    api.remove(activeTilesetId)
  }
  activeTileset = null
  activeTilesetId = null
  activeKey.value = null
  requestRender()
}

// 加载指定 3D Tiles 样本并飞到包围范围。
async function handleLoadTileset(sample: TilesetSample): Promise<void> {
  const viewer = map.getViewer()
  if (!viewer || viewer.isDestroyed()) {
    message.warning('地图尚未就绪')
    return
  }

  loadingKey.value = sample.key
  try {
    removeActiveTileset()
    const api = getTilesetApi()
    if (!api) return
    const id = await api.add(viewer, {
      id: sample.key,
      url: sample.url,
      show: showTileset.value,
      maximumScreenSpaceError: 2,
      dynamicScreenSpaceError: true,
    })
    if (!id) throw new Error('3D Tiles 创建失败，请检查 id 或 url')
    activeTilesetId = id
    activeTileset = api.get(id) ?? null
    if (!activeTileset) throw new Error('3D Tiles 实例获取失败')
    activeKey.value = sample.key
    await viewer.flyTo(activeTileset, {
      duration: 1.4,
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(18),
        Cesium.Math.toRadians(-28),
        sample.range,
      ),
    })
    message.success(`已加载${sample.label}`)
  } catch (e) {
    removeActiveTileset()
    message.error(e instanceof Error ? e.message : '3D Tiles 加载失败')
  } finally {
    loadingKey.value = null
  }
}

function handleClear(): void {
  removeActiveTileset()
  message.info('已清除 3D Tiles')
}

watch(showTileset, (visible) => {
  const api = getTilesetApi()
  if (!api || !activeTilesetId) return
  api.setVisible(activeTilesetId, visible)
  requestRender()
})

onBeforeUnmount(() => {
  removeActiveTileset()
})
</script>

<template>
  <div class="map-tool-float map-tool-float--tileset">
    <XDialog :width="460">
      <div class="map-tool-head">{{ title }}</div>
      <div class="tileset-shell">
        <div class="tileset-samples">
          <a-button
            v-for="sample in tilesetSamples"
            :key="sample.key"
            class="tileset-sample-btn"
            :class="{ 'tileset-sample-btn--active': activeKey === sample.key }"
            :loading="loadingKey === sample.key"
            :disabled="loadingKey !== null && loadingKey !== sample.key"
            @click="handleLoadTileset(sample)"
          >
            <span class="tileset-sample-btn__label">{{ sample.label }}</span>
            <span class="tileset-sample-btn__desc">{{ sample.desc }}</span>
          </a-button>
        </div>

        <div class="tileset-toolbar">
          <div class="tileset-toolbar__item">
            <span>显示</span>
            <a-switch v-model:checked="showTileset" size="small" />
          </div>
          <a-button class="layer-demo-btn-clear tileset-clear-btn" block @click="handleClear">清除</a-button>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
.map-tool-float--tileset {
  :deep(.x-dialog-panel) {
    border-color: rgba(64, 150, 255, 0.2);
    box-shadow:
      0 10px 34px rgba(0, 0, 0, 0.42),
      inset 0 0 0 1px rgba(64, 150, 255, 0.08);
  }
}

.tileset-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.tileset-samples {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tileset-sample-btn.ant-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  height: 58px;
  padding: 8px 10px;
  color: rgba(226, 238, 255, 0.9);
  text-align: left;
  background: rgba(18, 32, 52, 0.66);
  border-color: rgba(88, 158, 234, 0.22);
  border-radius: 8px;
  box-shadow: none;
}

.tileset-sample-btn.ant-btn:hover,
.tileset-sample-btn.ant-btn:focus {
  color: #fff;
  background: rgba(35, 78, 123, 0.72);
  border-color: rgba(96, 177, 255, 0.52);
}

.tileset-sample-btn--active.ant-btn,
.tileset-sample-btn--active.ant-btn:hover,
.tileset-sample-btn--active.ant-btn:focus {
  background:
    linear-gradient(180deg, rgba(43, 142, 255, 0.86), rgba(30, 99, 202, 0.78)),
    rgba(22, 48, 82, 0.9);
  border-color: rgba(104, 190, 255, 0.82);
}

.tileset-sample-btn__label {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tileset-sample-btn__desc {
  max-width: 100%;
  overflow: hidden;
  color: rgba(218, 233, 255, 0.64);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tileset-toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tileset-toolbar__item {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  color: rgba(226, 238, 255, 0.82);
  font-size: 12px;
  font-weight: 600;
  background: rgba(8, 16, 28, 0.42);
  border: 1px solid rgba(64, 150, 255, 0.16);
  border-radius: 8px;
}

.tileset-clear-btn.ant-btn {
  height: 36px;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
  border-radius: 8px;
}

.tileset-clear-btn.ant-btn:hover,
.tileset-clear-btn.ant-btn:focus {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(64, 150, 255, 0.34);
}
</style>
