<script setup lang="ts">
import { computed, defineAsyncComponent, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import { useMapLayerStore } from '../../stores/modules/mapLayer'
import type { MenuProps } from 'ant-design-vue'
import { AppstoreOutlined } from '@ant-design/icons-vue'
import HomeSidebar from '../../components/HomeSidebar/index.vue'
import { homeMenuTree } from '../../common/home-content'
import { mapDemoComponentMetaMap } from './components/common/component-map'
import { resolveMapBaseUrls } from '../../config/map-runtime'
import type { XMapConfig } from '../../FastX/components/x-map.types'

const router = useRouter()
const mapLayerStore = useMapLayerStore()
const demoModules = import.meta.glob('./*.vue')
const firstCardKey = homeMenuTree[0]?.children[0]?.key ?? ''

/** 从进入本页起算，地图 `@ready` 后至少展示约 1s，避免一闪而过；遮罩期间阻塞操作 */
const mapLoadStart = performance.now()
const mapStageLoading = ref(true)
let mapLoadingFallbackTimer: number | undefined

function readInitialMenuKeyFromHistory(): string {
  const st = window.history.state as Record<string, unknown> | null
  const k = typeof st?.mapDemoCardKey === 'string' ? st.mapDemoCardKey : ''
  return k && mapDemoComponentMetaMap[k] ? k : firstCardKey
}

const activeMenuKey = ref(readInitialMenuKeyFromHistory())

const urls = resolveMapBaseUrls()
const xMapConfig = reactive<XMapConfig>({
  mapName: 'mapDemo',
  center: {
    longitude: 120.95,
    latitude: 23.75,
    height: 850_000,
  },
  /** 正上方垂直俯视（pitch -90°） */
  orientation: {
    headingDegrees: 0,
    pitchDegrees: -90,
    rollDegrees: 0,
  },
  imageryUrlTemplate: urls.imageryUrlTemplate,
  terrainUrl: urls.terrainUrl,
  initialCamera: { useAnimation: true, duration: 2.5 },
  depthTestAgainstTerrain: false,
  /** 启动时显示经纬网格，便于标绘对照 */
  showGridAtStartup: false,
  /** 未传时 `XMap` 亦默认开启；此处显式写出便于对照文档 */
  antialias: true,
})

const menuItems: MenuProps['items'] = homeMenuTree.map((group) => ({
  key: group.key,
  label: group.label,
  icon: h(AppstoreOutlined),
  children: group.children.map((item) => ({
    key: item.key,
    label: item.label,
    icon: h(AppstoreOutlined),
  })),
}))

const currentMeta = computed(() => mapDemoComponentMetaMap[activeMenuKey.value])
const currentComponent = computed<Component | null>(() => {
  const meta = currentMeta.value
  if (!meta) return null
  const loader = demoModules[meta.componentPath] as (() => Promise<Component>) | undefined
  if (!loader) return null
  return defineAsyncComponent(() => loader())
})

/** 地址栏仅保留 `/mapDemo`，卡片入口通过 `history.state.mapDemoCardKey` 传入。 */
onMounted(() => {
  void router.replace({ path: '/mapDemo' })
  mapLoadingFallbackTimer = window.setTimeout(() => {
    mapStageLoading.value = false
    mapLoadingFallbackTimer = undefined
  }, 60_000)
})

onBeforeUnmount(() => {
  if (mapLoadingFallbackTimer !== undefined) {
    window.clearTimeout(mapLoadingFallbackTimer)
    mapLoadingFallbackTimer = undefined
  }
})

/** 切换左侧菜单时清空主图实体，并将各页共用的地图 UI 恢复为初始状态（避免上一页开关带到下一页）。 */
watch(activeMenuKey, () => {
  mapLayerStore.clearAllMapEntities()
  mapLayerStore.resetSharedMapDemoUiState()
  const v = mapLayerStore.getViewer()
  if (v && !v.isDestroyed()) {
    window.FastX?.Point?.clear(v)
    window.FastX?.PointCollection?.removeAll(v)
    window.FastX?.Label?.clear(v)
    window.FastX?.LabelCollection?.removeAll(v)
    window.FastX?.PolyLine?.clear(v)
    window.FastX?.PolyLineCollection?.clear(v)
    window.FastX?.Circle?.clear(v)
    window.FastX?.CircleCollection?.clear(v)
    window.FastX?.Polygon?.clear(v)
    window.FastX?.PolygonCollection?.clear(v)
    window.FastX?.Sector?.clear(v)
    window.FastX?.SectorCollection?.clear(v)
    window.FastX?.Rectangle?.clear(v)
    window.FastX?.RectangleCollection?.clear(v)
    window.FastX?.Cylinder?.clear(v)
    window.FastX?.CylinderCollection?.clear(v)
    window.FastX?.Corridor?.clear(v)
    window.FastX?.CorridorCollection?.clear(v)
    window.FastX?.Runway?.clear(v)
    window.FastX?.RunwayCollection?.clear(v)
    window.FastX?.Ellipsoid?.clear(v)
    window.FastX?.EllipsoidCollection?.clear(v)
    window.FastX?.Wall?.clear(v)
    window.FastX?.Billboard?.clear(v)
    window.FastX?.BillboardCollection?.clear(v)
    window.FastX?.Model?.clear(v)
    window.FastX?.ModelCollection?.clear(v)
    window.FastX?.Box?.clear(v)
    window.FastX?.BoxCollection?.clear(v)
    window.FastX?.PolylineVolume?.clear(v)
    window.FastX?.PolylineVolumeCollection?.clear(v)
    window.FastX?.Plane?.clear(v)
    window.FastX?.PlaneCollection?.clear(v)
  }
  window.FastX?.Point?.pruneInvalid()
  window.FastX?.PointCollection?.pruneInvalid()
  window.FastX?.Label?.pruneInvalid()
  window.FastX?.LabelCollection?.pruneInvalid()
  window.FastX?.PolyLine?.pruneInvalid()
  window.FastX?.PolyLineCollection?.pruneInvalid()
  window.FastX?.Circle?.pruneInvalid()
  window.FastX?.CircleCollection?.pruneInvalid()
  window.FastX?.Polygon?.pruneInvalid()
  window.FastX?.PolygonCollection?.pruneInvalid()
  window.FastX?.Sector?.pruneInvalid()
  window.FastX?.SectorCollection?.pruneInvalid()
  window.FastX?.Rectangle?.pruneInvalid()
  window.FastX?.RectangleCollection?.pruneInvalid()
  window.FastX?.Cylinder?.pruneInvalid()
  window.FastX?.CylinderCollection?.pruneInvalid()
  window.FastX?.Corridor?.pruneInvalid()
  window.FastX?.CorridorCollection?.pruneInvalid()
  window.FastX?.Runway?.pruneInvalid()
  window.FastX?.RunwayCollection?.pruneInvalid()
  window.FastX?.Ellipsoid?.pruneInvalid()
  window.FastX?.EllipsoidCollection?.pruneInvalid()
  window.FastX?.Wall?.pruneInvalid()
  window.FastX?.Billboard?.pruneInvalid()
  window.FastX?.BillboardCollection?.pruneInvalid()
  window.FastX?.Model?.pruneInvalid()
  window.FastX?.ModelCollection?.pruneInvalid()
  window.FastX?.Box?.pruneInvalid()
  window.FastX?.BoxCollection?.pruneInvalid()
  window.FastX?.PolylineVolume?.pruneInvalid()
  window.FastX?.PolylineVolumeCollection?.pruneInvalid()
  window.FastX?.Plane?.pruneInvalid()
  window.FastX?.PlaneCollection?.pruneInvalid()
})

const handleSelectMenu = (key: string) => {
  activeMenuKey.value = key
}

const handleBackHome = async () => {
  await router.push('/home')
}

function onMapReady() {
  const o = xMapConfig.orientation
  mapLayerStore.setInitialMapView(
    { ...xMapConfig.center },
    {
      headingDegrees: o?.headingDegrees ?? 0,
      pitchDegrees: o?.pitchDegrees ?? -45,
      rollDegrees: o?.rollDegrees ?? 0,
    },
  )
  const elapsed = performance.now() - mapLoadStart
  const rest = Math.max(0, 1000 - elapsed)
  window.setTimeout(() => {
    mapStageLoading.value = false
    if (mapLoadingFallbackTimer !== undefined) {
      window.clearTimeout(mapLoadingFallbackTimer)
      mapLoadingFallbackTimer = undefined
    }
  }, rest)
}
</script>

<template>
  <a-layout class="map-demo-layout">
    <a-layout has-sider class="main-layout">
      <HomeSidebar :menu-items="menuItems" :active-key="activeMenuKey" @select="handleSelectMenu" />

      <a-layout-content class="content-wrap">
        <div class="content-head">
          <a-button type="text" class="map-demo-back-btn" @click="handleBackHome">
            <template #icon>
              <arrow-left-outlined />
            </template>
            返回首页
          </a-button>
          <span class="content-head-title">{{ currentMeta?.title || '未找到功能页面' }}</span>
        </div>

        <div class="content-body map-stage">
          <div class="map-demo-map-wrap">
            <XMap :x-config="xMapConfig" @ready="onMapReady" />
          </div>
          <div v-show="mapStageLoading" class="map-demo-map-loading" aria-busy="true" aria-label="地图加载中">
            <a-spin size="large" tip="地图加载中，请稍候…" />
          </div>
          <div class="map-demo-panel">
            <component :is="currentComponent" v-if="currentComponent" :key="activeMenuKey" />
            <a-empty v-else description="未找到对应功能页面" />
          </div>
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped lang="scss">
.map-demo-layout {
  height: 100vh;

  .main-layout {
    height: 100%;
    background: #f2f6fb;
  }

  .content-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .content-head {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
    height: 56px;
    padding: 0 18px;
    background: rgba(5, 24, 38, 0.96);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);

    .map-demo-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 36px;
      padding: 0 10px;
      border-radius: 8px;
      color: rgba(230, 244, 255, 0.92) !important;
      font-weight: 600;
      font-size: 13px;
      background: rgba(255, 255, 255, 0.08);

      &:hover {
        color: #fff !important;
        background: rgba(255, 255, 255, 0.16) !important;
      }
    }

    .content-head-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #e9f6ff;
    }
  }

  .content-body.map-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: #0b1220;
  }

  .map-demo-map-loading {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(11, 18, 32, 0.72);
    backdrop-filter: blur(4px);
  }

  .map-demo-map-wrap {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .map-demo-panel {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: visible;
    background: transparent;
  }

  .map-demo-panel > * {
    pointer-events: auto;
  }
}
</style>

<style lang="scss">
.map-demo-panel .map-tool-float {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
}

/* 地图工具二级弹窗主操作（确定 / 标绘 / 转换 / 复位等）：与 hzdldcxr 主按钮同一字重 */
.map-demo-panel .map-tool-float .map-tool-primary-btn.ant-btn-primary {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.map-demo-panel .map-tool-float .map-tool-primary-btn.ant-btn-default.hzd-primary-tall {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.map-demo-panel .map-tool-head {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.96);
}

.map-demo-panel .map-tool-float--coord .map-tool-head {
  margin-bottom: 14px;
}

.map-demo-panel > .map-tool-float.map-tool-float--pass-through {
  pointer-events: none;
}

.map-demo-panel .map-tool-desc {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.52);
  margin-bottom: 12px;
}

.map-demo-panel .map-tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 32px;
}

.map-demo-panel .map-tool-row-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
  flex-shrink: 0;
}

.map-demo-panel .coord-tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.map-demo-panel .coord-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.map-demo-panel .coord-row-label {
  flex: 0 0 132px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
}

.map-demo-panel .coord-row .ant-input-number {
  flex: 1;
  min-width: 120px;
}

.map-demo-panel .coord-row .ant-select .ant-select-selector {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: rgba(255, 255, 255, 0.92);
}

.map-demo-panel .coord-row .ant-select-arrow {
  color: rgba(255, 255, 255, 0.55);
}

.map-demo-panel .coord-actions {
  margin-top: 6px;
  width: 100%;
}

.map-demo-panel .coord-actions .ant-btn {
  width: 100%;
  min-height: 34px;
  height: auto;
  padding-top: 7px;
  padding-bottom: 7px;
  line-height: 1.35;
}

.map-demo-panel .coord-dms-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.map-demo-panel .coord-dms-group-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  letter-spacing: 0.04em;
}

.map-demo-panel .coord-row-tight .coord-row-label {
  flex: 0 0 56px;
}

.map-demo-panel .coord-row-tight .ant-input-number {
  flex: 1;
  min-width: 0;
}

.map-demo-panel .coord-out-block {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.map-demo-panel .coord-subhead {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.map-demo-panel .coord-out-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 8px;
}

.map-demo-panel .coord-out-row:last-child {
  margin-bottom: 0;
}

.map-demo-panel .coord-out-label {
  flex: 0 0 108px;
  color: rgba(255, 255, 255, 0.72);
}

.map-demo-panel .coord-out-val {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-demo-panel .coord-copy-btn {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.45) !important;
  width: 28px !important;
  height: 28px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: rgba(120, 200, 255, 0.95) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.12);
  }
}

/* —— Point 绘制弹窗：表单与表格与深色地图面板统一 —— */
.map-demo-panel .map-tool-float--hzd-point .hzd-field-label {
  color: rgba(255, 255, 255, 0.76);
}

.map-demo-panel .map-tool-float--hzd-point .ant-input,
.map-demo-panel .map-tool-float--hzd-point .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-point .ant-input-number,
.map-demo-panel .map-tool-float--hzd-point .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-point textarea.ant-input {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-point .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-point textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-point .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.12);
}

.map-demo-panel .map-tool-float--hzd-point .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
}

.map-demo-panel .map-tool-float--hzd-point .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-point .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-point .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-point .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .ant-table-tbody > tr.hzd-point-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-point .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

/* —— Circle 绘制弹窗：与 Point 同套深色表单/表格皮肤 —— */
.map-demo-panel .map-tool-float--hzd-circle .hzd-field-label {
  color: rgba(255, 255, 255, 0.76);
}

.map-demo-panel .map-tool-float--hzd-circle .ant-input,
.map-demo-panel .map-tool-float--hzd-circle .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-circle .ant-input-number,
.map-demo-panel .map-tool-float--hzd-circle .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-circle textarea.ant-input {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-circle .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-circle textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-circle .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.12);
}

.map-demo-panel .map-tool-float--hzd-circle .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
}

.map-demo-panel .map-tool-float--hzd-circle .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-circle .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-circle .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-circle .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .ant-table-tbody > tr.hzd-circle-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-circle .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-field-label {
  color: rgba(255, 255, 255, 0.78);
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-input,
.map-demo-panel .map-tool-float--hzd-polygon .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-polygon .ant-input-number,
.map-demo-panel .map-tool-float--hzd-polygon .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-polygon textarea.ant-input {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-polygon textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.65) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-polygon .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-polygon .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .ant-table-tbody > tr.hzd-polygon-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-polygon .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-field-label {
  color: rgba(255, 255, 255, 0.78);
}

.map-demo-panel .map-tool-float--hzd-sector .ant-input,
.map-demo-panel .map-tool-float--hzd-sector .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-sector .ant-input-number,
.map-demo-panel .map-tool-float--hzd-sector .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-sector .ant-select-selector,
.map-demo-panel .map-tool-float--hzd-sector textarea.ant-input {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-sector textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.65) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-sector .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-sector .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-sector .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .ant-table-tbody > tr.hzd-sector-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-sector .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

/* —— Path 绘制弹窗：与 Sector 同套深色表单/表格皮肤 —— */
.map-demo-panel .map-tool-float--hzd-path .hzd-field-label {
  color: rgba(255, 255, 255, 0.78);
}

.map-demo-panel .map-tool-float--hzd-path .ant-input,
.map-demo-panel .map-tool-float--hzd-path .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-path .ant-input-number,
.map-demo-panel .map-tool-float--hzd-path .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-path textarea.ant-input {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-path .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-path textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-path .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.map-demo-panel .map-tool-float--hzd-path .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.65) !important;
}

.map-demo-panel .map-tool-float--hzd-path .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-path .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-path .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-path .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .ant-table-tbody > tr.hzd-path-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-path .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-field-label {
  color: rgba(255, 255, 255, 0.78);
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-input,
.map-demo-panel .map-tool-float--hzd-rectangle .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-rectangle .ant-input-number,
.map-demo-panel .map-tool-float--hzd-rectangle .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-rectangle .ant-select-selector,
.map-demo-panel .map-tool-float--hzd-rectangle textarea.ant-input {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-rectangle textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.65) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-rectangle .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .ant-table-tbody > tr.hzd-rectangle-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-rectangle .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-field-label {
  color: rgba(255, 255, 255, 0.78);
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-input,
.map-demo-panel .map-tool-float--hzd-cylinder .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-cylinder .ant-input-number,
.map-demo-panel .map-tool-float--hzd-cylinder .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-cylinder .ant-select-selector,
.map-demo-panel .map-tool-float--hzd-cylinder textarea.ant-input {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-cylinder textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.65) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-slider-track {
  background: rgba(100, 180, 255, 0.65);
}

.map-demo-panel .map-tool-float--hzd-cylinder .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 190, 255, 0.45);
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-tbody > tr.hzd-cylinder-row--active > td,
.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-tbody > tr.hzd-cylinder-batch-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-cylinder .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-field-label {
  color: rgba(255, 255, 255, 0.78);
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input,
.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input-affix-wrapper,
.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input-number,
.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input-number-input,
.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-select-selector,
.map-demo-panel .map-tool-float--hzd-ellipsoid textarea.ant-input {
  background: rgba(0, 0, 0, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input::placeholder,
.map-demo-panel .map-tool-float--hzd-ellipsoid textarea.ant-input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input-number-handler-wrap {
  background: rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-input-number-handler {
  color: rgba(255, 255, 255, 0.65) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-slider-rail {
  background: rgba(255, 255, 255, 0.1);
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-slider-track {
  background: rgba(100, 160, 255, 0.55);
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .ant-slider-handle::after {
  box-shadow: 0 0 0 2px rgba(120, 180, 255, 0.85);
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table.ant-table-wrapper .ant-table,
.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table.ant-table-wrapper .ant-table-container {
  background: transparent !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .ant-table-thead > tr > th {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.72) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-size: 12px;
  font-weight: 600;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.88) !important;
  font-size: 12px;
  text-align: center !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.055) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .ant-table-tbody > tr:hover > td {
  background: rgba(64, 150, 255, 0.12) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .ant-table-tbody > tr.hzd-ellipsoid-row--active > td {
  background: rgba(64, 150, 255, 0.22) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .ant-table-cell-scrollbar {
  box-shadow: none;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .hzd-del-btn.ant-btn-text {
  color: rgba(255, 140, 140, 0.92) !important;
}

.map-demo-panel .map-tool-float--hzd-ellipsoid .hzd-table .hzd-del-btn.ant-btn-text:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

/* 下拉挂载在 body：PolyLine / Sector 等共用 */
.hzd-select-dropdown-dark.ant-select-dropdown,
.hzd-select-dropdown-dark {
  padding: 4px !important;
  background: rgba(18, 22, 34, 0.98) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45) !important;
}

.hzd-select-dropdown-dark .ant-select-item {
  color: rgba(255, 255, 255, 0.88) !important;
  border-radius: 6px !important;
}

.hzd-select-dropdown-dark .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: rgba(80, 130, 210, 0.28) !important;
}

.hzd-select-dropdown-dark .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  color: rgba(255, 255, 255, 0.95) !important;
  font-weight: 600;
  background: rgba(70, 120, 200, 0.38) !important;
}
</style>
