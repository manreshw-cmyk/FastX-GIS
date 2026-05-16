<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { MenuProps } from 'ant-design-vue'
import {
  AppstoreOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  CompassOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  DotChartOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/modules/user'
import { homeContentSections, homeMenuTree } from '../../common/home-content'
import HomeHeader from '../../components/HomeHeader/index.vue'
import HomeSidebar from '../../components/HomeSidebar/index.vue'
import HomeContent from '../../components/HomeContent/index.vue'

interface HomeContentExpose {
  scrollToSection: (key: string) => void
}

const router = useRouter()
const userStore = useUserStore()
const username = computed(() => userStore.userInfo?.username ?? '')
const defaultActiveMenuKey = homeMenuTree[0]?.children[0]?.key ?? ''
const activeMenuKey = ref(defaultActiveMenuKey)
const contentRef = ref<HomeContentExpose | null>(null)
const childToGroupKeyMap = Object.fromEntries(
  homeMenuTree.flatMap((group) => group.children.map((item) => [item.key, group.key])),
)
const groupToFirstChildKeyMap = Object.fromEntries(
  homeMenuTree.map((group) => [group.key, group.children[0]?.key ?? '']),
)
const menuIconMap = {
  'layer-terrain': AppstoreOutlined,
  'layer-imagery': GlobalOutlined,
  'layer-model': DatabaseOutlined,
  'analysis-measure': CompassOutlined,
  'analysis-overlay': DeploymentUnitOutlined,
  'visual-heatmap': ThunderboltOutlined,
  'visual-flow': ApartmentOutlined,
}
const groupIconMap = {
  layer: ClusterOutlined,
  analysis: DotChartOutlined,
  visualization: FundProjectionScreenOutlined,
}

const menuItems: MenuProps['items'] = homeMenuTree.map((group) => ({
  key: group.key,
  label: group.label,
  icon: h(groupIconMap[group.key as keyof typeof groupIconMap] || AppstoreOutlined),
  children: group.children.map((item) => ({
    key: item.key,
    label: item.label,
    icon: h(menuIconMap[item.key as keyof typeof menuIconMap] || AppstoreOutlined),
  })),
}))

const handleLogout = async () => {
  userStore.clearUserInfo()
  message.destroy()
  message.success({ content: '已退出登录', duration: 3 })
  await router.push('/login')
}

const handleSelectMenu = (key: string) => {
  activeMenuKey.value = key
  const sectionKey = childToGroupKeyMap[key] || key
  contentRef.value?.scrollToSection(sectionKey)
}

const handleActiveChange = (key: string) => {
  activeMenuKey.value = groupToFirstChildKeyMap[key] || key
}

const handleCardClick = async (payload: { cardKey: string }) => {
  await router.push({
    path: '/mapDemo',
    state: { mapDemoCardKey: payload.cardKey },
  })
}
</script>

<template>
  <a-layout class="home-layout">
    <HomeHeader :username="username" @logout="handleLogout" />

    <a-layout has-sider class="main-layout">
      <HomeSidebar :menu-items="menuItems" :active-key="activeMenuKey" @select="handleSelectMenu" />

      <div class="content-wrap">
        <HomeContent
          ref="contentRef"
          :sections="homeContentSections"
          @active-change="handleActiveChange"
          @card-click="handleCardClick"
        />
      </div>
    </a-layout>
  </a-layout>
</template>

<style scoped lang="scss">
.home-layout {
  height: 100vh;

  .main-layout {
    min-height: calc(100vh - 64px);
    background: #f2f6fb;

    .content-wrap {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
  }
}
</style>
