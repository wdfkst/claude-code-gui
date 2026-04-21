/// <reference types="vite/client" />

import type { RendererApi } from '../preload';

declare global {
  interface Window {
    api: RendererApi;
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
