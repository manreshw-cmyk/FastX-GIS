import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserInfo {
  username: string
  password: string
}

const USER_INFO_STORAGE_KEY = 'cesium-xgx-user-info'

export const useUserStore = defineStore('user', () => {
  const readUserInfoFromStorage = (): UserInfo | null => {
    const raw = localStorage.getItem(USER_INFO_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as UserInfo
    } catch {
      localStorage.removeItem(USER_INFO_STORAGE_KEY)
      return null
    }
  }

  const userInfo = ref<UserInfo | null>(readUserInfoFromStorage())

  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info
    localStorage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(info))
  }

  const clearUserInfo = () => {
    userInfo.value = null
    localStorage.removeItem(USER_INFO_STORAGE_KEY)
  }

  return {
    userInfo,
    setUserInfo,
    clearUserInfo,
  }
})
