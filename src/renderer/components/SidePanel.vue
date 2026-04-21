<script setup lang="ts">
// Placeholder for M1. Real file tree + session list come in M3/M4.
</script>

<template>
  <aside class="side-panel">
    <section class="section">
      <div class="section-title">资源管理器</div>
      <div class="placeholder">（M4 接入文件树）</div>
    </section>
    <section class="section">
      <div class="section-title">会话</div>
      <div class="placeholder">（M3 接入会话列表）</div>
    </section>
  </aside>
</template>

<style scoped>
.side-panel {
  width: var(--width-side-panel);
  background: var(--color-bg-elevated);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 10px 8px;
  overflow-y: auto;
}
.section + .section {
  margin-top: 14px;
}
.section-title {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.placeholder {
  font-size: 12px;
  color: var(--color-text-dim);
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}
</style>
