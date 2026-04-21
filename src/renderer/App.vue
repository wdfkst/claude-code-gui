<script setup lang="ts">
import ActivityBar from './components/ActivityBar.vue';
import SidePanel from './components/SidePanel.vue';
import MonacoPane from './components/MonacoPane.vue';
import ChatPanel from './components/ChatPanel.vue';
import StatusBar from './components/StatusBar.vue';
</script>

<template>
  <div class="app">
    <div class="main">
      <ActivityBar />
      <SidePanel />
      <MonacoPane />
      <ChatPanel />
    </div>
    <StatusBar />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}
.main {
  flex: 1;
  display: flex;
  min-height: 0;
}
</style>
