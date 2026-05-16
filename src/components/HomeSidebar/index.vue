<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MenuProps } from 'ant-design-vue'

const props = defineProps<{
  menuItems: MenuProps['items']
  activeKey: string
}>()

const collapsed = ref(false)
const emit = defineEmits<{
  select: [key: string]
}>()

const openKeys = computed(() =>
  collapsed.value
    ? []
    : (props.menuItems || [])
        .map((item) => (item && typeof item === 'object' && 'key' in item ? String(item.key) : ''))
        .filter(Boolean),
)

const handleClick = ({ key }: { key: string }) => {
  emit('select', key)
}

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <a-layout-sider
    width="240"
    class="home-sider"
    collapsible
    v-model:collapsed="collapsed"
    :collapsed-width="72"
    :trigger="null"
  >
    <div class="sider-tools">
      <span v-if="!collapsed" class="sider-title">相关实例</span>
      <a-button type="text" class="collapse-btn" @click="toggleCollapsed">
        <template #icon>
          <menu-unfold-outlined v-if="collapsed" />
          <menu-fold-outlined v-else />
        </template>
      </a-button>
    </div>
    <a-menu
      mode="inline"
      :selected-keys="[activeKey]"
      :open-keys="openKeys"
      :items="menuItems"
      @click="handleClick"
    />
  </a-layout-sider>
</template>

<style scoped lang="scss">
.home-sider {
  background: rgba(7, 21, 33, 0.9);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.22);
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
  }

  .sider-tools {
    position: relative;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    .sider-title {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(245, 250, 255, 0.92);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .collapse-btn {
      color: rgba(255, 255, 255, 0.86);
    }
  }

  :deep(.ant-menu) {
    background: transparent;
    border-right: none;
    color: rgba(255, 255, 255, 0.78);
    padding-top: 8px;
  }

  :deep(.ant-menu-submenu-title) {
    color: rgba(245, 250, 255, 0.92);
    font-weight: 600;
  }

  :deep(.ant-menu-submenu-arrow) {
    color: rgba(255, 255, 255, 0.7);
  }

  :deep(.ant-menu-item:hover) {
    background: rgba(0, 0, 0, 0.5) !important;
  }

  :deep(.ant-menu-item-selected) {
    color: #fff;
    background: linear-gradient(90deg, rgba(34, 139, 230, 0.32), rgba(34, 139, 230, 0.1));
  }

  :deep(.ant-menu-submenu-title:hover) {
    background: rgba(0, 0, 0, 0.5) !important;
  }
}
</style>
