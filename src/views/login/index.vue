<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons-vue'
import { useUserStore } from '../../stores/modules/user'

interface LoginForm {
  username: string
  password: string
}

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()

const loading = ref(false)
const formState = reactive<LoginForm>({
  username: 'admin',
  password: '1',
})

const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码' }],
}

const handleLogin = async () => {
  try {
    await formRef.value?.validate()
    loading.value = true

    if (formState.username !== 'admin' || formState.password !== '1') {
      message.error('用户名或密码错误')
      return
    }

    userStore.setUserInfo({
      username: formState.username,
      password: formState.password,
    })

    message.destroy()
    message.success({ content: '登录成功', duration: 3 })
    router.push('/home')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <a-card class="login-card" :bordered="false">
      <div class="login-logo-wrap">
        <img src="../../assets/images/logo.png" alt="logo" class="login-logo" />
      </div>
      <a-typography-title :level="4" class="login-title">CesiumX GIS</a-typography-title>

      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <a-form-item name="username" label="用户名">
          <a-input
            v-model:value="formState.username"
            class="login-input"
            placeholder="请输入用户名"
          />
        </a-form-item>

        <a-form-item name="password" label="密码">
          <a-input-password
            v-model:value="formState.password"
            class="login-input"
            placeholder="请输入密码"
          >
            <template #iconRender="value">
              <EyeTwoTone v-if="value" />
              <EyeInvisibleOutlined v-else />
            </template>
          </a-input-password>
        </a-form-item>

        <a-button class="login-button" type="primary" block :loading="loading" @click="handleLogin">
          登录
        </a-button>
      </a-form>
    </a-card>
  </div>
</template>
