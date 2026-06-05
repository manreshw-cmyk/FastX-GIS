<script setup lang="ts">
import * as Cesium from "cesium";
import { message } from "ant-design-vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useMapLayerStore } from "../../stores/modules/mapLayer";
import XMapLocatePanel from "./x-map-locate-panel.vue";
import XMapLayersPanel from "./x-map-layers-panel.vue";

defineOptions({ name: "XMapToolbar" });

// —— 类型与配置（增删按钮改 TOOLBAR_ITEMS）——
type ToolbarActionKey =
  | "layers"
  | "scene"
  | "atmosphere"
  | "lighting"
  | "reset"
  | "north"
  | "locate"
  | "zoomIn"
  | "zoomOut"
  | "scale"
  | "navigation"
  | "mouseStatus";

type ToolbarButtonItem = {
  kind: "button";
  key: ToolbarActionKey;
  title: string;
  icon: keyof typeof TOOLBAR_ICONS;
  muted?: boolean;
  toggle?: boolean;
};

type ToolbarZoomGroupItem = {
  kind: "zoom";
  items: {
    key: "zoomIn" | "zoomOut";
    title: string;
    icon: "zoomIn" | "zoomOut";
  }[];
};

type ToolbarItem = ToolbarButtonItem | ToolbarZoomGroupItem;

/** SVG 路径（viewBox 0 0 24 24） */
const TOOLBAR_ICONS = {
  layers:
    '<path fill="currentColor" d="M12 4 4 8.5v7L12 20l8-4.5v-7L12 4Zm0 2.2 5.5 3.1v5.4L12 18 6.5 14.7V9.3L12 6.2Z"/><path fill="currentColor" d="M12 8 8 10v4l4 2 4-2v-4l-4-2Z" opacity="0.55"/>',
  atmosphere:
    '<path d="M6 14a6 6 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="11" r="1.2" fill="currentColor"/><circle cx="14" cy="10" r="1.5" fill="currentColor"/>',
  lighting:
    '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  reset:
    '<path d="M12 5.2 6 10.2V18h4v-5h4v5h4v-7.8L12 5.2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  north:
    '<path d="M12 4 8.5 18h2.2l.8-3.2h2.5l.8 3.2H15.5L12 4Z" fill="currentColor"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.35"/>',
  locate:
    '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  zoomIn:
    '<path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  zoomOut:
    '<path d="M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  scale:
    '<path d="M5 16h8M5 13h12M5 10h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 16V8M13 16V11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  navigation:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 3.5 9.2 17h1.8l.6-2.4h3.2l.6 2.4H17L12 3.5Z" fill="currentColor"/><path d="M12 12h4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>',
  mouse:
    '<path d="M5 4l6.5 14.5 1.8-5.3L19 11.5 5 4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
} as const;

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { kind: "button", key: "layers", title: "图层", icon: "layers", toggle: true },
  {
    kind: "button",
    key: "scene",
    title: "二三维",
    icon: "layers",
    toggle: true,
  },
  {
    kind: "button",
    key: "atmosphere",
    title: "大气层",
    icon: "atmosphere",
    toggle: true,
  },
  {
    kind: "button",
    key: "lighting",
    title: "光照",
    icon: "lighting",
    toggle: true,
  },
  { kind: "button", key: "reset", title: "复位", icon: "reset" },
  { kind: "button", key: "north", title: "指北针", icon: "north" },
  {
    kind: "button",
    key: "locate",
    title: "定位",
    icon: "locate",
    toggle: true,
  },
  {
    kind: "zoom",
    items: [
      { key: "zoomIn", title: "放大", icon: "zoomIn" },
      { key: "zoomOut", title: "缩小", icon: "zoomOut" },
    ],
  },
  {
    kind: "button",
    key: "scale",
    title: "比例尺",
    icon: "scale",
    toggle: true,
  },
  {
    kind: "button",
    key: "navigation",
    title: "导航罗盘",
    icon: "navigation",
    toggle: true,
  },
  {
    kind: "button",
    key: "mouseStatus",
    title: "鼠标实时位置",
    icon: "mouse",
    toggle: true,
  },
];

const mouseStatusVisible = defineModel<boolean>("mouseStatusVisible", {
  default: true,
});

const map = useMapLayerStore();
const scene3D = ref(true);
const atmosphereOn = ref(false);
const lightingOn = ref(false);
const scaleBarOn = ref(false);
const navigationOn = ref(false);
const locatePanelVisible = ref(false);
const layersPanelVisible = ref(false);

let removePost: (() => void) | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

const sceneTitle = computed(() => (scene3D.value ? "三维" : "二维"));

const toggleState = computed(
  (): Partial<Record<ToolbarActionKey, boolean>> => ({
    layers: layersPanelVisible.value,
    scene: scene3D.value,
    atmosphere: atmosphereOn.value,
    lighting: lightingOn.value,
    scale: scaleBarOn.value,
    navigation: navigationOn.value,
    mouseStatus: mouseStatusVisible.value,
    locate: locatePanelVisible.value,
  })
);

const syncFromViewer = (): void => {
  const layer = map.getLayer();
  const v = map.getViewer();
  if (!layer || !v || v.isDestroyed()) return;
  if (v.scene.mode !== Cesium.SceneMode.MORPHING) {
    scene3D.value = v.scene.mode === Cesium.SceneMode.SCENE3D;
  }
  atmosphereOn.value = !!v.scene.skyAtmosphere?.show;
  lightingOn.value = v.scene.globe.enableLighting;
  scaleBarOn.value = layer.isScaleBarVisible();
  navigationOn.value = layer.isNavigationControlVisible();
};

const tryAttach = (): boolean => {
  const v = map.getViewer();
  if (!v || v.isDestroyed()) return false;
  syncFromViewer();
  removePost = v.scene.postRender.addEventListener(syncFromViewer);
  return true;
};

const requireLayer = () => {
  const layer = map.getLayer();
  if (!layer) message.warning("地图尚未就绪");
  return layer;
};

const isToolbarActive = (key: ToolbarActionKey): boolean =>
  toggleState.value[key] ?? false;

const getToolbarTitle = (item: ToolbarButtonItem): string => {
  if (item.key === "scene")
    return scene3D.value ? "三维（点击切换二维）" : "二维（点击切换三维）";
  return item.title;
};

const flyCameraNorth = (): void => {
  const v = map.getViewer();
  if (!v || v.isDestroyed()) {
    message.warning("地图尚未就绪");
    return;
  }
  const cam = v.camera;
  cam.flyTo({
    destination: cam.positionWC.clone(),
    orientation: { heading: 0, pitch: cam.pitch, roll: 0 },
    duration: 0.6,
  });
};

const handleToolbarAction = (key: ToolbarActionKey): void => {
  const layer = requireLayer();

  switch (key) {
    case "layers":
      layersPanelVisible.value = !layersPanelVisible.value;
      break;
    case "scene":
      if (layer) layer.setSceneMode(scene3D.value ? "2d" : "3d", 1);
      break;
    case "atmosphere":
      if (layer) layer.setSkyAtmosphereVisible(!atmosphereOn.value);
      break;
    case "lighting":
      if (layer) layer.setGlobeLightingEnabled(!lightingOn.value);
      break;
    case "reset":
      if (layer)
        void layer.resetCameraToHome({ useAnimation: true, duration: 1.2 });
      break;
    case "north":
      flyCameraNorth();
      break;
    case "locate":
      locatePanelVisible.value = !locatePanelVisible.value;
      break;
    case "zoomIn":
      layer?.zoomInOut(true);
      break;
    case "zoomOut":
      layer?.zoomInOut(false);
      break;
    case "scale":
      if (layer) layer.setScaleBarVisible(!scaleBarOn.value);
      break;
    case "navigation":
      if (layer) {
        void layer
          .setNavigationControlVisible(!navigationOn.value)
          .then(() => {
            navigationOn.value = layer.isNavigationControlVisible();
          })
          .catch(() => {
            message.error("导航控件加载失败");
            navigationOn.value = false;
          });
      }
      break;
    case "mouseStatus":
      mouseStatusVisible.value = !mouseStatusVisible.value;
      break;
  }
};

onMounted(() => {
  if (tryAttach()) return;
  poll = setInterval(() => {
    if (tryAttach() && poll) {
      clearInterval(poll);
      poll = null;
    }
  }, 120);
});

onBeforeUnmount(() => {
  if (poll) clearInterval(poll);
  removePost?.();
});
</script>

<template>
  <div class="x-map-toolbar-wrap">
    <nav class="x-map-toolbar" aria-label="地图工具栏">
      <template
        v-for="(entry, index) in TOOLBAR_ITEMS"
        :key="entry.kind === 'zoom' ? `zoom-${index}` : entry.key"
      >
        <div
          v-if="entry.kind === 'zoom'"
          class="x-map-toolbar-zoom x-map-toolbar-surface"
          role="group"
          aria-label="缩放"
        >
          <button
            v-for="z in entry.items"
            :key="z.key"
            type="button"
            class="x-map-toolbar-zoom-btn x-map-toolbar-tip"
            :aria-label="z.title"
            :title="z.title"
            @click="handleToolbarAction(z.key)"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              v-html="TOOLBAR_ICONS[z.icon]"
            />
          </button>
        </div>

        <button
          v-else
          type="button"
          class="x-map-toolbar-btn x-map-toolbar-surface x-map-toolbar-tip"
          :class="{
            'x-map-toolbar-btn--active':
              entry.toggle && isToolbarActive(entry.key),
            'x-map-toolbar-btn--muted': entry.muted,
          }"
          :aria-label="getToolbarTitle(entry)"
          :title="getToolbarTitle(entry)"
          @click="handleToolbarAction(entry.key)"
        >
          <svg
            v-if="entry.key === 'scene'"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              v-if="scene3D"
              cx="12"
              cy="12"
              r="7.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <rect
              v-else
              x="5"
              y="7"
              width="14"
              height="10"
              rx="1.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <text
              x="12"
              y="13.6"
              text-anchor="middle"
              font-size="6"
              fill="currentColor"
            >
              {{ sceneTitle }}
            </text>
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            aria-hidden="true"
            v-html="TOOLBAR_ICONS[entry.icon]"
          />
        </button>
      </template>
    </nav>

    <XMapLocatePanel v-model:visible="locatePanelVisible" />
    <XMapLayersPanel v-model:visible="layersPanelVisible" />
  </div>
</template>

<style scoped lang="scss">
.x-map-toolbar-wrap {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 6;
  pointer-events: none;
}

.x-map-toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}

.x-map-toolbar-surface {
  width: 40px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(5, 24, 38, 0.82);
  color: rgba(230, 244, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  svg {
    display: block;
    width: 22px;
    height: 22px;
    margin: 0 auto;
  }

  &:hover {
    background: rgba(5, 24, 38, 0.96);
    border-color: rgba(255, 255, 255, 0.22);
    color: #fff;
  }
}

.x-map-toolbar-tip {
  position: relative;
  cursor: pointer;

  &:active {
    transform: scale(0.96);
  }

  &::after {
    content: attr(aria-label);
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    padding: 3px 7px;
    border-radius: 4px;
    background: rgba(5, 24, 38, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e9f6ff;
    font: 11px/1.4 ui-sans-serif, system-ui, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.12s ease;
    z-index: 10;
  }

  &:hover::after {
    opacity: 1;
    visibility: visible;
  }
}

.x-map-toolbar-btn {
  height: 40px;
  border-radius: 50%;
  padding: 0;

  &--active {
    background: rgba(22, 119, 255, 0.22);
    border-color: rgba(64, 150, 255, 0.65);
    color: #7ec1ff;
    box-shadow: 0 2px 10px rgba(22, 119, 255, 0.28);
  }

  &--muted {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.x-map-toolbar-zoom {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: visible;
  padding: 0;
}

.x-map-toolbar-zoom-btn {
  position: relative;
  width: 40px;
  height: 32px;
  border: none;
  background: transparent;
  color: inherit;

  &:first-child {
    border-radius: 16px 16px 0 0;
  }

  &:last-child {
    border-radius: 0 0 16px 16px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
}
</style>
