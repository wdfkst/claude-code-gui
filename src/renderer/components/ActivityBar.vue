<script setup lang="ts">
import { ref } from 'vue';

const items = [
  { id: 'files', icon: '📁', label: '文件' },
  { id: 'sessions', icon: '💬', label: '会话' },
  { id: 'commands', icon: '⚡', label: '命令' },
  { id: 'agents', icon: '🤖', label: 'Agents' },
];
const settings = { id: 'settings', icon: '⚙️', label: '设置' };
const active = ref('files');
</script>

<template>
  <nav class="activity-bar">
    <button
      v-for="item in items"
      :key="item.id"
      :class="['bar-item', { active: active === item.id }]"
      :title="item.label"
      @click="active = item.id"
    >
      {{ item.icon }}
    </button>
    <div class="spacer" />
    <button
      :class="['bar-item', { active: active === settings.id }]"
      :title="settings.label"
      @click="active = settings.id"
    >
      {{ settings.icon }}
    </button>
  </nav>
</template>

<style scoped>
.activity-bar {
  width: var(--width-activity-bar);
  background: var(--color-bg-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  border-right: 1px solid var(--color-border);
}
.bar-item {
  width: 100%;
  height: 40px;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: 20px;
  cursor: pointer;
  border-left: 2px solid transparent;
}
.bar-item:hover {
  color: var(--color-text);
}
.bar-item.active {
  color: var(--color-text);
  background: #094771;
  border-left-color: var(--color-accent);
}
.spacer {
  flex: 1;
}
</style>
