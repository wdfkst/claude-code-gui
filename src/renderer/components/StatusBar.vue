<script setup lang="ts">
// Placeholder for M1. Real status data (project path, token count, etc.) in later milestones.
</script>

<template>
  <footer class="status-bar">
    <span>📁 （未打开项目）</span>
    <span class="flex" />
    <span>M1 骨架</span>
    <span>🔒 所有命令需确认</span>
  </footer>
</template>

<style scoped>
.status-bar {
  height: var(--height-status-bar);
  background: var(--color-status);
  color: white;
  font-size: 10px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 14px;
}
.flex {
  flex: 1;
}
</style>
