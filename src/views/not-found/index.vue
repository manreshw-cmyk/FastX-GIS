<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/modules/user'

const REPO_URL = 'https://github.com/manreshw-cmyk/FastX-GIS.git'

const router = useRouter()
const userStore = useUserStore()

const goHome = () => {
  router.push(userStore.userInfo ? '/home' : '/login')
}

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  goHome()
}

const openRepo = () => {
  window.open(REPO_URL, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  console.log(
    '🚨 FastX-GIS 404 页面 | 请检查路由配置，若需支持历史模式刷新不404，请配置nginx或hash路由。',
  )
})
</script>

<template>
  <div class="not-found-page">
    <div class="error-container">
      <div class="gis-bar" />
      <div class="system-badge">🗺️ FastX-GIS</div>

      <div class="glitch-wrapper">
        <div class="glitch">404</div>
      </div>

      <h1>无法定位该页面资源</h1>
      <div class="description">
        请求的地图切片或页面地址不在当前服务中，<br />
        请检查链接或返回系统首页。
      </div>

      <div class="info-card">
        <p>
          <span class="info-icon">📍</span>
          <span>可能的原因：</span>
        </p>
        <p>
          <span class="info-icon" />
          <span>• 链接地址已变更或失效</span>
        </p>
        <p>
          <span class="info-icon" />
          <span
            >• 路由路径拼接有误或不匹配当前项目</span
          >
        </p>
        <p>
          <span class="info-icon" />
          <span>• 直接访问了深层嵌套页面路由但未配置</span>
        </p>
      </div>

      <div class="button-group">
        <button type="button" class="btn btn-primary" @click="goHome">🏠 返回主页</button>
        <button type="button" class="btn btn-outline" @click="goBack">🔙 返回上一页</button>
        <button type="button" class="btn btn-outline" @click="openRepo">📦 项目仓库</button>
      </div>

      <div class="footer-coords">
        <span>🗺️ EPSG:3857</span>
        <span>📍 404 Not Found</span>
        <span>⚡ FastX-GIS Core</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  margin: 0;
  padding: 20px;
  box-sizing: border-box;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    'Poppins',
    Roboto,
    'Helvetica Neue',
    sans-serif;
  background: linear-gradient(145deg, #0b1420 0%, #111a28 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow-x: hidden;
}

.not-found-page::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(#2c3e66 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.2;
  pointer-events: none;
}

.error-container {
  max-width: 800px;
  width: 100%;
  background: rgba(18, 25, 45, 0.65);
  backdrop-filter: blur(12px);
  border-radius: 56px;
  border: 1px solid rgba(66, 153, 225, 0.3);
  box-shadow:
    0 25px 45px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(66, 153, 225, 0.1) inset;
  padding: 50px 40px 60px;
  text-align: center;
  transition: all 0.3s ease;
  z-index: 2;
}

.gis-bar {
  width: 100px;
  height: 4px;
  background: linear-gradient(90deg, #2b6cb0, #4299e1, #63b3ed);
  border-radius: 4px;
  margin: 0 auto 30px;
}

.glitch-wrapper {
  margin-bottom: 20px;
}

.glitch {
  font-size: 130px;
  font-weight: 800;
  line-height: 1;
  color: #e2e8f0;
  text-shadow:
    0.05em 0 0 rgba(255, 0, 100, 0.5),
    -0.05em -0.025em 0 rgba(0, 255, 255, 0.5);
  animation: glitch-shake 0.3s infinite alternate;
  letter-spacing: 12px;
}

@keyframes glitch-shake {
  0% {
    transform: translate(0);
    text-shadow:
      0.05em 0 0 rgba(255, 0, 100, 0.4),
      -0.05em -0.025em 0 rgba(0, 255, 255, 0.4);
  }
  100% {
    transform: translate(-0.03em, 0.02em);
    text-shadow:
      -0.05em 0.02em 0 rgba(255, 0, 100, 0.5),
      0.05em -0.01em 0 rgba(0, 255, 255, 0.5);
  }
}

.system-badge {
  display: inline-block;
  background: rgba(66, 153, 225, 0.2);
  padding: 8px 18px;
  border-radius: 40px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 1px;
  color: #90cdf4;
  border: 1px solid rgba(66, 153, 225, 0.4);
  margin-bottom: 25px;
  backdrop-filter: blur(4px);
}

h1 {
  font-size: 28px;
  font-weight: 600;
  color: #f7fafc;
  margin: 0 0 15px;
}

.description {
  font-size: 17px;
  color: #a0aec0;
  line-height: 1.6;
  margin-bottom: 35px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.info-card {
  background: rgba(0, 0, 0, 0.35);
  border-radius: 24px;
  padding: 20px 25px;
  margin: 30px 0 35px;
  text-align: left;
  border-left: 4px solid #4299e1;
}

.info-card p {
  color: #cbd5e0;
  font-size: 14px;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-card p:last-child {
  margin-bottom: 0;
}

.info-icon {
  width: 28px;
  font-size: 18px;
  text-align: center;
  flex-shrink: 0;
}

.suggestion-code {
  background: #0f172a;
  padding: 4px 10px;
  border-radius: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #63b3ed;
  margin-left: 6px;
}

.button-group {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 28px;
  border-radius: 40px;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  background: none;
}

.btn-primary {
  background: linear-gradient(95deg, #2b6cb0, #3182ce);
  color: white;
  box-shadow: 0 4px 12px rgba(43, 108, 176, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-primary:hover {
  transform: translateY(-3px);
  background: linear-gradient(95deg, #2c5282, #2b6cb0);
  box-shadow: 0 8px 20px rgba(43, 108, 176, 0.4);
}

.btn-outline {
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e0;
  border: 1px solid #4a5568;
}

.btn-outline:hover {
  background: rgba(66, 153, 225, 0.15);
  border-color: #63b3ed;
  color: #e2e8f0;
  transform: translateY(-2px);
}

.footer-coords {
  margin-top: 45px;
  font-size: 12px;
  font-family: monospace;
  color: #4a5b7c;
  letter-spacing: 0.5px;
  border-top: 1px dashed rgba(66, 153, 225, 0.3);
  padding-top: 25px;
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.footer-coords span {
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 12px;
  border-radius: 20px;
}

@media (max-width: 560px) {
  .error-container {
    padding: 35px 25px 45px;
  }

  .glitch {
    font-size: 85px;
    letter-spacing: 6px;
  }

  h1 {
    font-size: 22px;
  }

  .button-group {
    gap: 12px;
  }

  .btn {
    padding: 8px 20px;
    font-size: 13px;
  }
}
</style>
