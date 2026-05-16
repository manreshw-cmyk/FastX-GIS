<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{
  username: string
}>()

const emit = defineEmits<{
  logout: []
}>()

const isFullscreen = ref(false)

function syncFullscreen() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

onMounted(() => {
  syncFullscreen()
  document.addEventListener('fullscreenchange', syncFullscreen)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
})

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch {
    /* 浏览器策略或用户拒绝 */
  }
}

const handleLogout = () => {
  emit('logout')
}
</script>

<template>
  <a-layout-header class="home-header">
    <div class="brand">
      <img src="../../assets/images/logo.png" alt="logo" class="brand-logo" />
      <span class="brand-name">CesiumX GIS</span>
    </div>

    <div class="user-actions">
      <div class="user-block">
        <user-outlined class="user-icon" />
        <span class="user-name">{{ username }}</span>
      </div>

      <a-tooltip :title="isFullscreen ? '退出全屏' : '全屏'">
        <a-button type="text" class="icon-action-btn" @click="toggleFullscreen">
          <template #icon>
            <fullscreen-exit-outlined v-if="isFullscreen" />
            <fullscreen-outlined v-else />
          </template>
        </a-button>
      </a-tooltip>

      <a-tooltip title="退出系统">
        <a-button type="text" class="icon-action-btn" @click="handleLogout">
          <template #icon>
            <logout-outlined />
          </template>
        </a-button>
      </a-tooltip>
    </div>
  </a-layout-header>
</template>

<style scoped lang="scss">
.home-header {
  height: 64px;
  padding: 0 20px;
  background: rgba(5, 24, 38, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: space-between;

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;

    .brand-logo {
      width: 30px;
      height: 30px;
      object-fit: contain;
    }

    .brand-name {
      color: #f5fbff;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.4px;
    }
  }

  .user-actions {
    display: flex;
    align-items: center;
    gap: 10px;

    .user-block {
      height: 40px;
      padding: 4px 10px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 1.1;

      .user-icon {
        color: #d9f2ff;
        font-size: 13px;
      }

      .user-name {
        margin-top: 2px;
        color: #e9f6ff;
        font-size: 12px;
        font-weight: 700;
      }
    }

    .icon-action-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);

      &:hover {
        color: #fff !important;
        background: rgba(255, 255, 255, 0.18) !important;
      }
    }

  }
}
</style>
