<script setup lang="ts">
import { ref } from 'vue';
import { unwrap } from '../utils/ipc';

const status = ref<string>('未测试');
const loading = ref(false);

async function testPing() {
  loading.value = true;
  status.value = '测试中…';
  try {
    const result = await unwrap(window.api.ping({ message: 'hello from renderer' }));
    status.value = `✓ IPC 通路 OK — 收到 pong: "${result.pong}" (serverTime=${result.serverTime})`;
  } catch (e) {
    status.value = `✗ 失败: ${(e as Error).message}`;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="chat-panel">
    <div class="chat-header">💬 对话（M2 接入）</div>
    <div class="chat-body">
      <div class="ipc-test">
        <button :disabled="loading" @click="testPing">测试 IPC (ping)</button>
        <div class="status">{{ status }}</div>
      </div>
    </div>
    <div class="chat-input">
      <div class="input-placeholder">（M2 接入输入框）</div>
    </div>
  </section>
</template>

<style scoped>
.chat-panel {
  flex: 1.3;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-elevated);
  min-width: 0;
}
.chat-header {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--color-text-dim);
  background: var(--color-bg-alt);
  border-bottom: 1px solid var(--color-border);
}
.chat-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}
.ipc-test button {
  background: #0e639c;
  color: white;
  border: none;
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 3px;
  cursor: pointer;
}
.ipc-test button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.status {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-dim);
  word-break: break-all;
}
.chat-input {
  border-top: 1px solid var(--color-border);
  padding: 10px;
  background: var(--color-bg-alt);
}
.input-placeholder {
  padding: 12px;
  background: #3c3c3c;
  border-radius: 4px;
  color: var(--color-text-dim);
  font-size: 12px;
}
</style>
