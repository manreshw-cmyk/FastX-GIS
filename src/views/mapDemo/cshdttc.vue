<script setup lang='ts'>
const title = '初始化地图（图层）'
const cardKey = 'layer-1'
</script>

<template>
  <div class='demo-page'>
    <a-card :title='title' :bordered='false'>
      <p>当前功能卡片 Key：{{ cardKey }}</p>
      <p>功能内容开发中，后续将在此处接入 FastX 能力。</p>
    </a-card>
  </div>
</template>

<style scoped lang='scss'>
.demo-page {
  padding: 16px;
}
</style>
