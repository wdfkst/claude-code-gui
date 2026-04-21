# M1 · 基础骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 fangkejia-pro 的空项目搭起来：Electron + Vue 3 + TypeScript 能跑、双进程 IPC 能通、路径沙箱安全工具有单测保护、四栏主窗口布局有占位组件。完成后可作为后续所有里程碑的稳定地基。

**Architecture:** Electron 双进程（main + renderer），通过 preload + contextBridge 隔离。构建用 `electron-vite`（统一管理 main/preload/renderer 三个 bundle），测试用 Vitest（只测纯 Node 模块，Electron 相关用手工冒烟）。

**Tech Stack:** Electron 33.x · Vue 3.5 · TypeScript 5.x · electron-vite · Vitest 2.x · Pinia（仅初始化）

**Parent Spec:** `docs/superpowers/specs/2026-04-21-fangkejia-pro-design.md`

**Prerequisites:**
- Node.js 20+ 已装（`node -v` 验证）
- Git 已装
- 工作目录 `F:\左文Project\fangkejia-pro` 是空的（仅含 `docs/`、`.superpowers/`、`memory/` 这些工具目录）

---

## File Structure

本 plan 结束后，仓库结构：

```
fangkejia-pro/
├── .gitignore
├── .editorconfig
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── vitest.config.ts
├── index.html
├── src/
│   ├── main/
│   │   ├── index.ts                  # Electron 主进程入口
│   │   ├── ipc/
│   │   │   └── handlers.ts           # 注册所有 IPC handler
│   │   └── utils/
│   │       ├── path-sandbox.ts       # 路径越界校验（有单测）
│   │       └── logger.ts             # 带敏感字段过滤的日志
│   ├── preload/
│   │   └── index.ts                  # contextBridge 暴露受控 IPC API
│   └── renderer/
│       ├── main.ts                   # Vue 入口
│       ├── env.d.ts                  # window.api 类型声明
│       ├── App.vue                   # 根组件 + 四栏布局骨架
│       ├── components/
│       │   ├── ActivityBar.vue       # 48px 最左图标栏（占位）
│       │   ├── SidePanel.vue         # 220px 侧栏（占位）
│       │   ├── MonacoPane.vue        # 代码预览（占位）
│       │   ├── ChatPanel.vue         # 对话面板（含 ping 测试按钮）
│       │   └── StatusBar.vue         # 底部状态栏（占位）
│       ├── stores/
│       │   └── index.ts              # Pinia 根实例
│       ├── utils/
│       │   └── ipc.ts                # window.api 封装 + 统一错误
│       └── styles/
│           └── global.css            # 主题/字体全局样式
├── shared/
│   ├── ipc-channels.ts               # IPC channel 名称常量
│   └── types.ts                      # IPC DTO 类型
├── tests/
│   ├── setup.ts
│   └── unit/
│       ├── path-sandbox.test.ts
│       ├── logger.test.ts
│       └── handlers.test.ts
├── docs/
│   └── superpowers/                  # 已存在（spec + plan）
└── README.md
```

**注：** `electron-builder.yml` 和打包产物（`dist/`）M1 不创建；打包配置留到 M7（发布阶段）。`package.json` 里的 `build:win` script 写着但 M1 不运行它。

**职责边界：**
- `shared/` 被 main 和 renderer 共同 import，里面只有纯类型和常量，不含可执行代码
- `src/main/` 拥有所有 Node.js 权限
- `src/preload/` 在 sandbox 模式下运行，只能用 `contextBridge` + `ipcRenderer`
- `src/renderer/` 是纯 Web 代码，无 Node 权限

---

## 执行原则

- **TDD**：纯 Node 模块（path-sandbox、logger、handlers 的纯函数部分）先写测试
- **小步提交**：每个 Task 末尾提交一次
- **commit message**：用 `feat:`、`chore:`、`test:` 前缀；简短描述
- **路径**：配置里统一用 Linux 风格（forward slash），跨平台兼容

---

## Task 1: 初始化项目 + Git + 依赖

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.editorconfig`

- [ ] **Step 1.1: 进入项目目录初始化 git**

```bash
cd "F:/左文Project/fangkejia-pro"
git init
git config --local core.autocrlf false
```

Expected output: `Initialized empty Git repository in .../fangkejia-pro/.git/`

- [ ] **Step 1.2: 创建 `package.json`**

写入 `F:/左文Project/fangkejia-pro/package.json`：

```json
{
  "name": "fangkejia-pro",
  "version": "0.0.1",
  "description": "A Cursor-like desktop GUI for Claude Code",
  "author": "fangkejia-pro",
  "license": "MIT",
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:win": "electron-vite build && electron-builder --win",
    "preview": "electron-vite preview",
    "typecheck": "vue-tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 1.3: 安装依赖**

```bash
npm install --save-exact vue@3.5.13 pinia@2.3.0
npm install --save-exact --save-dev electron@33.3.1 electron-vite@3.0.0 electron-builder@25.1.8 vue-tsc@2.2.0 typescript@5.7.3 vite@6.0.7 @vitejs/plugin-vue@5.2.1 vitest@2.1.8 @vue/test-utils@2.4.6 @types/node@22.10.5 jsdom@25.0.1
```

Expected: 目录下出现 `node_modules/` 和 `package-lock.json`。

**如果 `better-sqlite3` 相关编译错误出现**：本 plan 不需要 `better-sqlite3`，如果 npm 报错提到它，忽略（M3 再装）。

- [ ] **Step 1.4: 创建 `.gitignore`**

写入 `F:/左文Project/fangkejia-pro/.gitignore`：

```
node_modules/
out/
dist/
*.log
.DS_Store
.vscode/
.idea/
.fangkejia/
coverage/
```

- [ ] **Step 1.5: 创建 `.editorconfig`**

写入 `F:/左文Project/fangkejia-pro/.editorconfig`：

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 1.6: 首次提交**

```bash
cd "F:/左文Project/fangkejia-pro"
git add package.json package-lock.json .gitignore .editorconfig
git commit -m "chore: initialize project with Electron + Vue 3 + TypeScript"
```

Expected: 1 个 commit 产生。

---

## Task 2: TypeScript 配置

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 2.1: 创建根 `tsconfig.json`**

写入 `F:/左文Project/fangkejia-pro/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.vue",
    "shared/**/*.ts",
    "tests/**/*.ts"
  ],
  "exclude": ["node_modules", "out", "dist"]
}
```

- [ ] **Step 2.2: 创建 `tsconfig.node.json`** (electron-vite 的构建脚本用这个)

写入 `F:/左文Project/fangkejia-pro/tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 2.3: 验证 typecheck 可运行（会报错无源文件，正常）**

```bash
npx vue-tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: 可能报 `Cannot find input file` 或类似——OK，因为源文件还没创建。只要不是 tsconfig 语法错就行。

- [ ] **Step 2.4: 提交**

```bash
git add tsconfig.json tsconfig.node.json
git commit -m "chore: add TypeScript configuration"
```

---

## Task 3: electron-vite 构建配置

**Files:**
- Create: `electron.vite.config.ts`

- [ ] **Step 3.1: 创建构建配置**

写入 `F:/左文Project/fangkejia-pro/electron.vite.config.ts`：

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [vue()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'shared'),
      },
    },
  },
});
```

- [ ] **Step 3.2: 提交**

```bash
git add electron.vite.config.ts
git commit -m "chore: add electron-vite build config"
```

---

## Task 4: Shared 层类型 + IPC channel 常量

**Files:**
- Create: `shared/ipc-channels.ts`
- Create: `shared/types.ts`

- [ ] **Step 4.1: 创建 channel 常量**

写入 `F:/左文Project/fangkejia-pro/shared/ipc-channels.ts`：

```ts
/**
 * All IPC channels used in fangkejia-pro.
 * Every IPC call must use a constant from this file.
 */
export const IpcChannels = {
  PING: 'ipc:ping',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
```

- [ ] **Step 4.2: 创建共享类型**

写入 `F:/左文Project/fangkejia-pro/shared/types.ts`：

```ts
/**
 * Standard envelope for every IPC response.
 * Handlers return IpcResult<T>; renderer checks `ok` before using `data`.
 */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface PingInput {
  message: string;
}

export interface PingOutput {
  pong: string;
  serverTime: number;
}
```

- [ ] **Step 4.3: 提交**

```bash
git add shared/
git commit -m "feat(shared): add IPC channel constants and type envelopes"
```

---

## Task 5: Path sandbox 工具（TDD）

**Files:**
- Create: `src/main/utils/path-sandbox.ts`
- Create: `tests/unit/path-sandbox.test.ts`
- Create: `tests/setup.ts`
- Create: `vitest.config.ts`

- [ ] **Step 5.1: 先创建 vitest 配置**

写入 `F:/左文Project/fangkejia-pro/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
});
```

- [ ] **Step 5.2: 创建空的 setup**

写入 `F:/左文Project/fangkejia-pro/tests/setup.ts`：

```ts
// Global test setup — reserved for later use.
export {};
```

- [ ] **Step 5.3: 写失败的测试**

写入 `F:/左文Project/fangkejia-pro/tests/unit/path-sandbox.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { sandbox, SecurityError } from '@main/utils/path-sandbox';

describe('sandbox()', () => {
  const root = '/project';

  it('accepts a path inside the root', () => {
    expect(sandbox(root, 'src/App.vue')).toBe('/project/src/App.vue');
  });

  it('accepts the root itself as empty relative', () => {
    expect(sandbox(root, '.')).toBe('/project');
  });

  it('rejects a path with .. that escapes root', () => {
    expect(() => sandbox(root, '../etc/passwd')).toThrow(SecurityError);
  });

  it('rejects a path with deep .. that escapes root', () => {
    expect(() => sandbox(root, 'src/../../etc/passwd')).toThrow(SecurityError);
  });

  it('rejects an absolute path unrelated to root', () => {
    expect(() => sandbox(root, '/etc/passwd')).toThrow(SecurityError);
  });

  it('accepts an absolute path inside the root', () => {
    expect(sandbox(root, '/project/src/App.vue')).toBe('/project/src/App.vue');
  });

  it('normalizes repeated slashes', () => {
    expect(sandbox(root, 'src//App.vue')).toBe('/project/src/App.vue');
  });
});
```

- [ ] **Step 5.4: 运行测试，确认失败**

```bash
npm test 2>&1 | head -30
```

Expected: 全部测试 FAIL，报错类似 `Cannot find module '@main/utils/path-sandbox'`。

- [ ] **Step 5.5: 写最小实现**

写入 `F:/左文Project/fangkejia-pro/src/main/utils/path-sandbox.ts`：

```ts
import path from 'node:path';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Resolve `userPath` against `projectRoot` and guarantee it doesn't escape.
 * Returns the absolute, normalized path.
 *
 * @throws SecurityError if userPath escapes projectRoot
 */
export function sandbox(projectRoot: string, userPath: string): string {
  const normalizedRoot = path.resolve(projectRoot);
  const resolved = path.resolve(normalizedRoot, userPath);
  const rel = path.relative(normalizedRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new SecurityError(
      `Path escapes project root: userPath=${userPath} root=${normalizedRoot}`,
    );
  }
  return resolved;
}
```

- [ ] **Step 5.6: 运行测试，确认通过**

```bash
npm test 2>&1 | tail -20
```

Expected: 7 个测试全部 PASS。

**注意：** 如果在 Windows 上某些 POSIX 风格路径断言失败（例如 `/project` 被解析成 `C:\project`），修改测试用 `path.resolve('/project')` 构造预期值，或在 test 顶部 skip 非 POSIX 环境：

```ts
const IS_POSIX = path.sep === '/';
describe.skipIf(!IS_POSIX)('sandbox() (POSIX)', ...)
```

如果你在 Windows 上跑，推荐改成用 `path.resolve` 动态构造预期值让测试跨平台兼容。

- [ ] **Step 5.7: 提交**

```bash
git add src/main/utils/path-sandbox.ts tests/ vitest.config.ts
git commit -m "feat(main): add path-sandbox utility with unit tests"
```

---

## Task 6: Logger 工具

**Files:**
- Create: `src/main/utils/logger.ts`

- [ ] **Step 6.1: 创建简单 logger**

写入 `F:/左文Project/fangkejia-pro/src/main/utils/logger.ts`：

```ts
/**
 * Minimal logger that filters sensitive fields.
 * v1 just prints to stdout; file-based logging comes in a later milestone.
 */

const SENSITIVE_KEYS = [
  'api_key',
  'apiKey',
  'token',
  'password',
  'authorization',
  'cookie',
  'session',
];

function redact(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function format(level: string, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta !== undefined ? ' ' + JSON.stringify(redact(meta)) : '';
  return `[${ts}] [${level}] ${msg}${metaStr}`;
}

export const logger = {
  info(msg: string, meta?: unknown) {
    console.log(format('INFO', msg, meta));
  },
  warn(msg: string, meta?: unknown) {
    console.warn(format('WARN', msg, meta));
  },
  error(msg: string, meta?: unknown) {
    console.error(format('ERROR', msg, meta));
  },
  debug(msg: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(format('DEBUG', msg, meta));
    }
  },
};
```

- [ ] **Step 6.2: 写 logger 测试**

写入 `F:/左文Project/fangkejia-pro/tests/unit/logger.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@main/utils/logger';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints INFO messages', () => {
    logger.info('hello');
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0][0]).toContain('[INFO] hello');
  });

  it('redacts api_key from meta', () => {
    logger.info('auth', { api_key: 'secret-123', user: 'alice' });
    const out = logSpy.mock.calls[0][0] as string;
    expect(out).not.toContain('secret-123');
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('alice');
  });

  it('redacts nested sensitive fields', () => {
    logger.info('req', { body: { token: 'abc', data: 'ok' } });
    const out = logSpy.mock.calls[0][0] as string;
    expect(out).not.toContain('abc');
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('ok');
  });
});
```

- [ ] **Step 6.3: 运行测试**

```bash
npm test 2>&1 | tail -20
```

Expected: 全部通过（path-sandbox 7 + logger 3 = 10 个测试）。

- [ ] **Step 6.4: 提交**

```bash
git add src/main/utils/logger.ts tests/unit/logger.test.ts
git commit -m "feat(main): add logger with sensitive-field redaction"
```

---

## Task 7: IPC handlers 注册（TDD 纯函数部分）

**Files:**
- Create: `src/main/ipc/handlers.ts`
- Create: `tests/unit/handlers.test.ts`

- [ ] **Step 7.1: 写 handler 的失败测试**

写入 `F:/左文Project/fangkejia-pro/tests/unit/handlers.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { handlePing } from '@main/ipc/handlers';

describe('handlePing()', () => {
  it('returns pong with the original message', () => {
    const result = handlePing({ message: 'hello' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pong).toBe('hello');
      expect(typeof result.data.serverTime).toBe('number');
    }
  });

  it('returns an error envelope when message is missing', () => {
    const result = handlePing({} as any);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});
```

- [ ] **Step 7.2: 运行测试，确认失败**

```bash
npm test -- tests/unit/handlers.test.ts 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '@main/ipc/handlers'`。

- [ ] **Step 7.3: 写实现**

写入 `F:/左文Project/fangkejia-pro/src/main/ipc/handlers.ts`：

```ts
import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { IpcResult, PingInput, PingOutput } from '@shared/types';

/**
 * Pure handler — can be unit tested without Electron runtime.
 */
export function handlePing(input: PingInput): IpcResult<PingOutput> {
  if (typeof input?.message !== 'string') {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'message must be a string' },
    };
  }
  return {
    ok: true,
    data: { pong: input.message, serverTime: Date.now() },
  };
}

/**
 * Wire pure handlers to ipcMain. Called once from main entry.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.PING, (_evt, input: PingInput) => handlePing(input));
}
```

- [ ] **Step 7.4: 运行测试确认通过**

```bash
npm test 2>&1 | tail -10
```

Expected: 12 个测试全部 PASS（path-sandbox 7 + logger 3 + handlers 2）。

- [ ] **Step 7.5: 提交**

```bash
git add src/main/ipc/handlers.ts tests/unit/handlers.test.ts
git commit -m "feat(main): add IPC handler framework with ping endpoint"
```

---

## Task 8: Electron 主进程入口

**Files:**
- Create: `src/main/index.ts`

- [ ] **Step 8.1: 创建主进程入口**

写入 `F:/左文Project/fangkejia-pro/src/main/index.ts`：

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc/handlers.js';
import { logger } from './utils/logger.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'fangkejia-pro',
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    // dev mode
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // production
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  logger.info('app ready');
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 8.2: 验证可以 typecheck（还会报 preload 路径错，之后修复）**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: 可能提示找不到 preload 文件——OK。主要看 `src/main/index.ts` 本身没语法错。

- [ ] **Step 8.3: 提交**

```bash
git add src/main/index.ts
git commit -m "feat(main): add Electron main process entry"
```

---

## Task 9: Preload 脚本

**Files:**
- Create: `src/preload/index.ts`

- [ ] **Step 9.1: 创建 preload**

写入 `F:/左文Project/fangkejia-pro/src/preload/index.ts`：

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { IpcResult, PingInput, PingOutput } from '@shared/types';

/**
 * Minimal, strongly-typed API exposed to the renderer.
 * Every new IPC call must be added here AND to shared/ipc-channels.ts.
 */
const api = {
  ping(input: PingInput): Promise<IpcResult<PingOutput>> {
    return ipcRenderer.invoke(IpcChannels.PING, input);
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type RendererApi = typeof api;
```

- [ ] **Step 9.2: 让 renderer 能看到 window.api 类型**

写入 `F:/左文Project/fangkejia-pro/src/renderer/env.d.ts`：

```ts
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
```

- [ ] **Step 9.3: 提交**

```bash
git add src/preload/ src/renderer/env.d.ts
git commit -m "feat(preload): expose typed IPC API via contextBridge"
```

---

## Task 10: Renderer 入口 + 根组件 + 四栏骨架

**Files:**
- Create: `index.html`
- Create: `src/renderer/main.ts`
- Create: `src/renderer/App.vue`
- Create: `src/renderer/stores/index.ts`
- Create: `src/renderer/utils/ipc.ts`
- Create: `src/renderer/styles/global.css`

- [ ] **Step 10.1: 创建 `index.html`**

写入 `F:/左文Project/fangkejia-pro/index.html`：

```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'"
    />
    <title>fangkejia-pro</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/renderer/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 10.2: 创建 Pinia 根**

写入 `F:/左文Project/fangkejia-pro/src/renderer/stores/index.ts`：

```ts
import { createPinia } from 'pinia';

export const pinia = createPinia();
```

- [ ] **Step 10.3: 创建 IPC 封装**

写入 `F:/左文Project/fangkejia-pro/src/renderer/utils/ipc.ts`：

```ts
import type { IpcResult } from '@shared/types';

/**
 * Unwrap IpcResult — throws on error, returns data on success.
 * Use this when a call is expected to succeed and errors are exceptional.
 */
export async function unwrap<T>(call: Promise<IpcResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) {
    throw new Error(`[${result.error.code}] ${result.error.message}`);
  }
  return result.data;
}

/**
 * Safe call — returns a plain object, lets caller decide how to handle errors.
 */
export function safeCall<T>(call: Promise<IpcResult<T>>): Promise<IpcResult<T>> {
  return call.catch((e: Error) => ({
    ok: false as const,
    error: { code: 'IPC_ERROR', message: e.message },
  }));
}
```

- [ ] **Step 10.4: 创建全局样式**

写入 `F:/左文Project/fangkejia-pro/src/renderer/styles/global.css`：

```css
:root {
  --color-bg: #1e1e1e;
  --color-bg-elevated: #252526;
  --color-bg-alt: #2d2d30;
  --color-border: #1a1a1a;
  --color-text: #d4d4d4;
  --color-text-dim: #aaaaaa;
  --color-accent: #4fc3f7;
  --color-status: #007acc;

  --width-activity-bar: 48px;
  --width-side-panel: 220px;
  --height-status-bar: 22px;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei',
    Helvetica, Arial, sans-serif;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
  overflow: hidden;
  user-select: none;
}

code,
pre {
  font-family: 'Consolas', 'Courier New', monospace;
}
```

- [ ] **Step 10.5: 创建 Vue 入口**

写入 `F:/左文Project/fangkejia-pro/src/renderer/main.ts`：

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from './stores';
import './styles/global.css';

createApp(App).use(pinia).mount('#app');
```

- [ ] **Step 10.6: 创建根 `App.vue`**

写入 `F:/左文Project/fangkejia-pro/src/renderer/App.vue`：

```vue
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
```

- [ ] **Step 10.7: 提交（占位组件下一任务创建）**

```bash
git add index.html src/renderer/main.ts src/renderer/App.vue src/renderer/stores/ src/renderer/utils/ src/renderer/styles/
git commit -m "feat(renderer): add Vue entry, root App, and base styles"
```

---

## Task 11: 四栏占位组件

**Files:**
- Create: `src/renderer/components/ActivityBar.vue`
- Create: `src/renderer/components/SidePanel.vue`
- Create: `src/renderer/components/MonacoPane.vue`
- Create: `src/renderer/components/ChatPanel.vue`
- Create: `src/renderer/components/StatusBar.vue`

- [ ] **Step 11.1: ActivityBar**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/ActivityBar.vue`：

```vue
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
```

- [ ] **Step 11.2: SidePanel**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/SidePanel.vue`：

```vue
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
```

- [ ] **Step 11.3: MonacoPane**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/MonacoPane.vue`：

```vue
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
```

- [ ] **Step 11.4: ChatPanel（接入 ping 验证 IPC 通路）**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/ChatPanel.vue`：

```vue
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
```

- [ ] **Step 11.5: StatusBar**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/StatusBar.vue`：

```vue
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
```

- [ ] **Step 11.6: 提交**

```bash
git add src/renderer/components/
git commit -m "feat(renderer): add four-pane layout placeholder components"
```

---

## Task 12: Dev 启动冒烟测试

**Files:** （无文件修改，只验证）

- [ ] **Step 12.1: 启动 dev 模式**

```bash
npm run dev
```

Expected:
- 终端打印 `[INFO] app ready`
- Electron 窗口弹出
- 看到四栏布局：左 48px 活动栏（有 5 个图标）→ 220px 侧栏（有两个"占位"小块）→ 主编辑区（"M4 接入 Monaco Editor"）→ 对话面板（有"测试 IPC"按钮）
- 底部蓝色状态栏

- [ ] **Step 12.2: 点"测试 IPC (ping)"按钮**

Expected: 状态变为 `✓ IPC 通路 OK — 收到 pong: "hello from renderer" (serverTime=...)`。

- [ ] **Step 12.3: 打开 DevTools 检查无报错**

在 dev 模式下按 `Ctrl+Shift+I` 打开 DevTools，Console tab 应该**没有红色错误**（CSP 警告或 DeprecationWarning 可忽略）。

- [ ] **Step 12.4: 关闭 dev 后确认 typecheck 通过**

```bash
npm run typecheck 2>&1 | tail -10
```

Expected: 无 TypeScript 错误（exit code 0）。

- [ ] **Step 12.5: 跑全部单测**

```bash
npm test 2>&1 | tail -10
```

Expected: 12 个测试全部 PASS。

- [ ] **Step 12.6: 提交冒烟成功说明**

```bash
git commit --allow-empty -m "chore: M1 smoke-test passed (dev startup + IPC ping + tests + typecheck)"
```

---

## Task 13: 生产构建冒烟 + README

**Files:**
- Create: `README.md`

- [ ] **Step 13.1: 跑生产构建**

```bash
npm run build
```

Expected:
- 无错误
- 生成 `out/main/`、`out/preload/`、`out/renderer/` 三个目录
- `ls out/` 能看到这三个文件夹

- [ ] **Step 13.2: 创建 README**

写入 `F:/左文Project/fangkejia-pro/README.md`：

```markdown
# fangkejia-pro

一个对标 Cursor 的 Claude Code GUI 客户端。v1 开发中。

## 现状

- **M1 基础骨架** — ✅ 完成（Electron + Vue 3 + IPC 通路 + 四栏占位布局）
- M2 SDK 接入 — ⏳ 下一步
- M3 / M4 / M5 / M6 / M7 — ⏳ 后续

参见 `docs/superpowers/specs/2026-04-21-fangkejia-pro-design.md` 获取完整设计。

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
- `src/preload/` — 预加载脚本（contextBridge）
- `src/renderer/` — Vue 3 UI
- `shared/` — main/renderer 共享的类型和常量
- `tests/` — Vitest 单测
```

- [ ] **Step 13.3: 提交 README**

```bash
git add README.md
git commit -m "docs: add README with M1 status and dev commands"
```

---

## Task 14: 最终检查清单

- [ ] **Step 14.1: Re-run 所有验证**

```bash
npm test
npm run typecheck
npm run build
```

全部应成功（exit code 0）。

- [ ] **Step 14.2: 确认 git status 干净**

```bash
git status
git log --oneline
```

Expected:
- `git status` 显示 `nothing to commit, working tree clean`
- `git log` 至少 11 个 commit（每个 Task 1 个）

- [ ] **Step 14.3: M1 完成标记 commit**

```bash
git tag -a m1-done -m "Milestone 1 complete: basic shell with IPC"
```

---

## M1 完成标准 Checklist

完成时，以下全部为真：

- ✅ `npm run dev` 能启动，Electron 窗口显示四栏布局
- ✅ 点"测试 IPC"按钮能收到 `pong`
- ✅ DevTools Console 无报错
- ✅ `npm test` 全部通过（12 个测试）
- ✅ `npm run typecheck` 无错误
- ✅ `npm run build` 成功产出 `out/` 目录
- ✅ 至少 11 个原子 commit
- ✅ `src/main/utils/path-sandbox.ts` 和 `src/main/utils/logger.ts` 有单测保护
- ✅ `shared/` 里有 IPC 常量和类型，main/renderer 都能 import
- ✅ 所有 SDK / DB / 业务逻辑**没有**——只有骨架和 ping（M2-M7 专属）

---

## 遇到问题？

| 症状 | 可能原因 | 处理 |
|------|---------|------|
| `npm install` 时 `electron` 下载慢 | 墙 | 设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后重试 |
| `npm run dev` 白屏 | preload 路径错 | 检查 `src/main/index.ts` 里 `join(__dirname, '../preload/index.js')` 构建后的实际路径 |
| IPC ping 点按钮无反应 | `contextBridge` 没加载 | 打开 DevTools 输入 `window.api`，应看到对象。若 `undefined` 说明 preload 没跑 |
| typecheck 报 `Cannot find @shared/*` | path alias 没生效 | 检查 `tsconfig.json` 的 `paths` 和 `electron.vite.config.ts` 的 `resolve.alias` 一致 |
| Vitest 找不到 `@main/*` | `vitest.config.ts` 里 alias 漏了 | 对照 Step 5.1 补全 |
| 生产构建后窗口白屏 | `loadFile` 路径错 | 看 `out/renderer/index.html` 存在；main 里 `join(__dirname, '../renderer/index.html')` |
