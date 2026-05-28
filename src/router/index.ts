import { createRouter, createWebHistory } from 'vue-router'
import pinia from '../stores'
import { useUserStore } from '../stores/modules/user'

const HomeView = () => import('../views/home/index.vue')
const LoginView = () => import('../views/login/index.vue')
const MapDemoView = () => import('../views/mapDemo/index.vue')
const NotFoundView = () => import('../views/not-found/index.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/mapDemo',
      name: 'mapDemo',
      component: MapDemoView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: NotFoundView,
    },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'notFound') {
    return true
  }

  const userStore = useUserStore(pinia)
  const hasLogin = !!userStore.userInfo

  if (!hasLogin && to.path !== '/login') {
    return '/login'
  }

  if (to.path === '/login' && hasLogin) {
    return '/home'
  }

  return true
})

export default router
