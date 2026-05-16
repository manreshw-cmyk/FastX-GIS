<script setup lang='ts'>
const title = '角度测量'
const cardKey = 'quantitative-3'
</script>

<template>
  <div class='demo-page'>
    <a-card :title='title' :bordered='false'>
      <p>当前功能卡片 Key：{{ cardKey }}</p>
      <p>功能内容开发中，后续将在此处接入 CesiumX 能力。</p>
    </a-card>
  </div>
</template>

<style scoped lang='scss'>
.demo-page {
  padding: 16px;
}
</style>
