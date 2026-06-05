<script setup lang="ts">
import { message } from "ant-design-vue";
import { ref, watch } from "vue";
import defaultThumb from "../../assets/images/login-bgc.png";
import { useMapLayerStore } from "../../stores/modules/mapLayer";
import {
  BASE_IMAGERY_ITEM_ID,
  TERRAIN_QUANTIZED_ITEM_ID,
  type BaseImageryPresetKind,
} from "../Layer/layer-panel-presets";

defineOptions({ name: "XMapLayersPanel" });

// —— 数据目录（后期在此手动增删；thumb 对应 assets/images/tools 或 layers 下「文件名不含扩展名」）——

type ImageryAction = "custom" | "cesium-world" | "none" | "placeholder";
type TerrainAction = "quantized" | "none";

interface ImageryCatalogItem {
  id: string;
  label: string;
  /** 与图片文件名一致，如 `天地图影像` → `tools/天地图影像.png` */
  thumb?: string;
  action: ImageryAction;
}

interface TerrainCatalogItem {
  id: string;
  label: string;
  thumb?: string;
  action: TerrainAction;
}

/** 影像底图列表（首项为默认选中） */
const IMAGERY_CATALOG: ImageryCatalogItem[] = [
  { id: "tdt-img", label: "天地图影像", thumb: "天地图影像", action: "custom" },
  { id: "tdt-vec", label: "天地图电子", action: "placeholder" },
  { id: "gaode-img", label: "高德影像", action: "placeholder" },
  { id: "gaode-vec", label: "高德电子", action: "placeholder" },
  { id: "baidu-img", label: "百度影像", action: "placeholder" },
  { id: "baidu-vec", label: "百度电子", action: "placeholder" },
  { id: "tencent-img", label: "腾讯影像", action: "placeholder" },
  { id: "tencent-vec", label: "腾讯电子", action: "placeholder" },
  { id: "blue", label: "蓝色底图", action: "placeholder" },
  { id: "green", label: "绿色底图", action: "placeholder" },
  { id: "dark", label: "黑色底图", action: "placeholder" },
  { id: "arcgis", label: "ArcGIS影像", action: "placeholder" },
  { id: "bing", label: "微软影像", action: "placeholder" },
  { id: "offline", label: "离线影像地图 (供参考)", action: "placeholder" },
  { id: "single", label: "单张图片", action: "placeholder" },
  { id: "cesium", label: "Cesium 默认影像", action: "cesium-world" },
  { id: "none", label: "无底图", action: "none" },
];

/** 地形服务列表 */
const TERRAIN_CATALOG: TerrainCatalogItem[] = [
  { id: "terrain-tw", label: "台湾地形", thumb: "台湾地形", action: "quantized" },
  { id: "terrain-none", label: "无地形", thumb: "无地形", action: "none" },
];

const DEFAULT_IMAGERY_ID = IMAGERY_CATALOG[0]!.id;

/** tools / layers 目录下的缩略图（Vite 打包） */
const THUMB_URL_BY_NAME: Record<string, string> = {};
for (const [path, url] of Object.entries(
  import.meta.glob("../../assets/images/{tools,layers}/*.{png,jpg,jpeg,webp}", {
    eager: true,
    import: "default",
  }) as Record<string, string>,
)) {
  const name = path.split("/").pop()?.replace(/\.[^.]+$/i, "");
  if (name) THUMB_URL_BY_NAME[name] = url;
}

const visible = defineModel<boolean>("visible", { default: false });

const map = useMapLayerStore();
const imageryActiveId = ref(DEFAULT_IMAGERY_ID);
const terrainActiveId = ref(TERRAIN_QUANTIZED_ITEM_ID);
const switching = ref(false);

function thumbSrc(thumb?: string): string {
  if (thumb && THUMB_URL_BY_NAME[thumb]) return THUMB_URL_BY_NAME[thumb]!;
  return defaultThumb;
}

function syncFromLayer(): void {
  const layer = map.getLayer();
  if (!layer) return;
  imageryActiveId.value = BASE_IMAGERY_ITEM_ID[layer.getBaseImageryPreset()];
  terrainActiveId.value = layer.isTerrainQuantizedEnabled()
    ? TERRAIN_QUANTIZED_ITEM_ID
    : "terrain-none";
}

function closePanel(): void {
  visible.value = false;
}

async function withSwitch(task: () => Promise<void>): Promise<void> {
  switching.value = true;
  try {
    await task();
  } finally {
    switching.value = false;
  }
}

async function onImagerySelect(item: ImageryCatalogItem): Promise<void> {
  if (item.action === "placeholder") {
    message.info(`${item.label} 尚未接入，敬请期待`);
    return;
  }
  const layer = map.getLayer();
  if (!layer) return message.warning("地图尚未就绪");

  await withSwitch(async () => {
    try {
      const preset: BaseImageryPresetKind =
        item.action === "custom"
          ? "custom"
          : item.action === "cesium-world"
            ? "cesium-world"
            : "none";
      await layer.setBaseImageryPreset(preset);
      imageryActiveId.value = item.id;
    } catch (err) {
      message.error(err instanceof Error ? err.message : "底图切换失败");
    }
  });
}

async function onTerrainSelect(item: TerrainCatalogItem): Promise<void> {
  const layer = map.getLayer();
  if (!layer) return message.warning("地图尚未就绪");

  await withSwitch(async () => {
    try {
      await layer.setTerrainQuantizedEnabled(item.action === "quantized");
      terrainActiveId.value = item.id;
    } catch (err) {
      message.error(err instanceof Error ? err.message : "地形切换失败");
    }
  });
}

watch(visible, (open) => {
  if (open) syncFromLayer();
});
</script>

<template>
  <Transition name="x-map-layers-drop">
    <aside
      v-show="visible"
      class="x-map-layers-panel"
      role="dialog"
      aria-label="图层"
    >
      <header class="x-map-layers-panel__head">
        <h3 class="x-map-layers-panel__title">图层</h3>
        <button
          type="button"
          class="x-map-layers-panel__close"
          aria-label="关闭"
          @click="closePanel"
        >
          ×
        </button>
      </header>

      <section class="x-map-layers-section">
        <h4 class="x-map-layers-section__title">影像</h4>
        <ul class="x-map-layers-grid">
          <li v-for="item in IMAGERY_CATALOG" :key="item.id">
            <button
              type="button"
              class="x-map-layers-card"
              :class="{ 'x-map-layers-card--active': item.id === imageryActiveId }"
              :disabled="switching"
              @click="onImagerySelect(item)"
            >
              <span class="x-map-layers-card__frame">
                <img
                  class="x-map-layers-card__thumb"
                  :src="thumbSrc(item.thumb)"
                  :alt="item.label"
                  loading="lazy"
                  draggable="false"
                />
              </span>
              <span class="x-map-layers-card__label">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="x-map-layers-section">
        <h4 class="x-map-layers-section__title">地形服务</h4>
        <ul class="x-map-layers-grid x-map-layers-grid--terrain">
          <li v-for="item in TERRAIN_CATALOG" :key="item.id">
            <button
              type="button"
              class="x-map-layers-card"
              :class="{ 'x-map-layers-card--active': item.id === terrainActiveId }"
              :disabled="switching"
              @click="onTerrainSelect(item)"
            >
              <span class="x-map-layers-card__frame">
                <img
                  class="x-map-layers-card__thumb"
                  :src="thumbSrc(item.thumb)"
                  :alt="item.label"
                  loading="lazy"
                  draggable="false"
                />
              </span>
              <span class="x-map-layers-card__label">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </section>
    </aside>
  </Transition>
</template>

<style scoped lang="scss">
$bg: rgba(5, 24, 38, 0.96);
$border: rgba(255, 255, 255, 0.12);
$text: rgba(230, 244, 255, 0.94);
$text-muted: rgba(230, 244, 255, 0.62);
$accent: rgba(64, 150, 255, 0.85);
$panel-left: 58px;
$col: 4;
$card: 70px;
$grid-gap: 12px;

.x-map-layers-panel {
  position: absolute;
  top: 58px;
  left: $panel-left;
  z-index: 7;
  width: min(
    calc(#{$card} * #{$col} + #{$grid-gap} * (#{$col} - 1) + 32px),
    calc(100vw - #{$panel-left} - 16px)
  );
  max-height: min(calc(100vh - 72px), 560px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px 14px;
  border-radius: 14px;
  background: $bg;
  border: 1px solid $border;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(0, 0, 0, 0.18) inset;
  backdrop-filter: blur(14px);
  pointer-events: auto;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(64, 150, 255, 0.45) rgba(255, 255, 255, 0.06);
}

.x-map-layers-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.x-map-layers-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: $text;
}

.x-map-layers-panel__close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: $text-muted;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }
}

.x-map-layers-section__title {
  margin: 0 0 8px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: $text;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
}

.x-map-layers-grid {
  display: grid;
  grid-template-columns: repeat(4, #{$card});
  justify-content: space-between;
  gap: 10px 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.x-map-layers-grid--terrain {
  grid-template-columns: repeat(4, #{$card});
  justify-content: flex-start;
  gap: 10px #{$grid-gap};
}

.x-map-layers-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: $card;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.x-map-layers-card__frame {
  display: block;
  width: $card;
  height: $card;
  border-radius: 10px;
  overflow: hidden;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.x-map-layers-card:hover:not(:disabled) .x-map-layers-card__frame {
  border-color: rgba(255, 255, 255, 0.26);
}

.x-map-layers-card--active .x-map-layers-card__frame {
  border-color: $accent;
  box-shadow:
    0 0 0 1px $accent,
    0 0 10px rgba(64, 150, 255, 0.28);
}

.x-map-layers-card__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.x-map-layers-card__label {
  width: 100%;
  font-size: 10px;
  line-height: 1.3;
  text-align: center;
  color: $text-muted;
  word-break: break-all;
}

.x-map-layers-card--active .x-map-layers-card__label {
  color: #7ec1ff;
}

.x-map-layers-drop-enter-active,
.x-map-layers-drop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.x-map-layers-drop-enter-from,
.x-map-layers-drop-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
