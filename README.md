# fangkejia-pro

一个对标 Cursor 的 Claude Code GUI 客户端。v1 开发中。

## 现状

- **M1 基础骨架** — ✅ 完成（Electron + Vue 3 + IPC 通路 + 四栏占位布局）
- M2 SDK 接入 — ⏳ 下一步
- M3 / M4 / M5 / M6 / M7 — ⏳ 后续

参见 `docs/superpowers/specs/2026-04-21-fangkejia-pro-design.md` 获取完整设计。
参见 `docs/superpowers/plans/2026-04-21-m1-foundation.md` 获取 M1 实施计划。

## 开发

```bash
npm install
npm run dev       # 启动开发模式（HMR）
npm test          # 运行单测
npm run typecheck # 类型检查
npm run build     # 生产构建
```

## 目录

- `src/main/` — Electron 主进程（Node.js 权限）
- `src/preload/` — 预加载脚本（contextBridge，输出为 CJS `.cjs`）
- `src/renderer/` — Vue 3 UI
- `shared/` — main/renderer 共享的类型和常量
- `tests/` — Vitest 单测
