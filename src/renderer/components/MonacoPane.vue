<script setup lang="ts">
// Placeholder for M1. Real Monaco integration comes in M4.
</script>

<template>
  <section class="monaco-pane">
    <div class="tab-bar">
      <div class="tab placeholder-tab">（未打开文件）</div>
    </div>
    <div class="editor-area">
      <div class="hint">M4 接入 Monaco Editor</div>
    </div>
  </section>
</template>

<style scoped>
.monaco-pane {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
  min-width: 0;
}
.tab-bar {
  height: 32px;
  background: var(--color-bg-alt);
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-bottom: 1px solid var(--color-border);
}
.tab {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--color-text-dim);
}
.editor-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hint {
  color: var(--color-text-dim);
  font-size: 12px;
  font-style: italic;
}
</style>
