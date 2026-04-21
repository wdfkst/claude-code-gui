# M2 · Claude Agent SDK 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 fangkejia-pro 能真正发送消息到 Claude Code，并把流式响应（文字 / 思考 / 工具调用 / 结果）展示在 ChatPanel 里。完成后用户可以在 app 里和 CC 对话（没有持久化、没有多会话、没有文件回滚——那些是 M3/M5）。

**Architecture:** Main 进程里加 `AgentProvider` 抽象（为未来多 provider 埋点）+ `ClaudeCodeProvider` 封装 `@anthropic-ai/claude-agent-sdk`。`ccBridge` 拿 SDK 的 AsyncIterator 逐事件推给 Renderer（`webContents.send`）。Renderer 端 Pinia `useChatStore` 按事件类型累加消息，ChatPanel 渲染气泡 + 工具调用卡片。Bash 工具走 `canUseTool` 弹审批框（简版，M6 会扩展成"本会话全允许"）。Markdown 用 markdown-it + DOMPurify 防 XSS。

**Tech Stack 新增：** `@anthropic-ai/claude-agent-sdk` · `markdown-it` · `dompurify` · `highlight.js` · `@types/markdown-it`

**Parent Spec:** `docs/superpowers/specs/2026-04-21-fangkejia-pro-design.md`（§6.1 发送消息流程 / §8.1 Markdown 清洗 / §11 AgentProvider）

**Prerequisites:**
- M1 完成（当前状态：`git tag m1-done` ✓）
- 用户已在机器上装了 Claude Code CLI 并登录过（`claude` 命令能在终端跑）
- 网络通向 Anthropic API

---

## Scope

### v1 included（本 plan）
- ✅ `AgentProvider` 接口 + `ClaudeCodeProvider` 实现
- ✅ 真实流式对话（assistant / thinking / tool_use / tool_result / result / error）
- ✅ Markdown 渲染（含 XSS 防护单测）
- ✅ 工具调用卡片（折叠显示）
- ✅ Bash 审批简版（弹 modal，单次 allow/deny）
- ✅ 中止正在进行的对话（abort 按钮）

### Not in M2（明确留到别的里程碑）
- ❌ 会话持久化 → M3
- ❌ 多会话切换 → M3
- ❌ 文件快照 / 回滚 → M5
- ❌ "本会话全允许 Bash"、命令白名单 → M6
- ❌ 文件树、Monaco 打开文件 → M4
- ❌ @文件 引用 / / 命令 补全 → M4/M6

---

## File Structure

本 plan 结束后新增 / 修改：

```
src/
├── main/
│   ├── providers/                    ← 新建目录
│   │   ├── AgentProvider.ts         ← 新：接口
│   │   └── claude-code.ts           ← 新：SDK 封装
│   ├── services/                    ← 新建目录
│   │   ├── ccBridge.ts              ← 新：orchestrator
│   │   └── approvalService.ts       ← 新：Bash 审批
│   ├── ipc/
│   │   └── handlers.ts              ← 修：加 cc:send/cc:abort/approval:respond
│   └── index.ts                     ← 修：注册新 handlers
├── preload/
│   └── index.ts                     ← 修：扩展 api
└── renderer/
    ├── components/
    │   ├── ChatPanel.vue            ← 重写
    │   ├── MessageBubble.vue        ← 新
    │   ├── ToolUseCard.vue          ← 新
    │   └── BashApprovalDialog.vue   ← 新
    ├── stores/
    │   └── useChatStore.ts          ← 新
    └── utils/
        └── markdown.ts              ← 新

shared/
├── events.ts                         ← 新：NormalizedEvent
├── ipc-channels.ts                  ← 修：加新 channel
└── types.ts                         ← 修：加 ChatMessage / ApprovalRequest

tests/unit/
├── markdown.test.ts                 ← 新（XSS 防护关键）
├── chat-store.test.ts               ← 新
└── claude-code-provider.test.ts     ← 新（事件映射）
```

---

## 执行原则

- TDD 覆盖：markdown、chat-store、provider 事件映射
- 每个 Task 末尾提交
- 先把"SDK 能跑通"验证掉再动 UI（Task 1 是 preflight）
- 如果 SDK 版本 / API 和 plan 里写的不同，**停下问我**——不要自己猜

---

## Task 1: Preflight · 确认 SDK 可用 + 安装依赖

**Files:** `package.json` (modify)

- [ ] **Step 1.1: 验证 SDK 包名和可用版本**

```bash
cd "F:/左文Project/fangkejia-pro"
npm view @anthropic-ai/claude-agent-sdk version 2>&1
```

**如果返回版本号** → 正确包名，用这个版本号。继续 Step 1.2。

**如果报 404** → 试备用包名：
```bash
npm view @anthropic-ai/claude-code-sdk version
npm view @anthropic-ai/sdk version
```
**停下**向我报告实际能用的包名，我再调 plan。绝对不要自己猜测改名。

- [ ] **Step 1.2: 安装 SDK + Markdown 相关依赖**

把 Step 1.1 输出的版本号替换到 `<version>` 里：

```bash
# 例如 Step 1.1 输出 "0.2.1"，就填 0.2.1
npm install --save-exact @anthropic-ai/claude-agent-sdk@<version>
npm install --save-exact markdown-it@14.1.0 dompurify@3.2.3 highlight.js@11.11.1
npm install --save-exact --save-dev @types/markdown-it@14.1.2 @types/dompurify@3.0.5
```

**注：** 如果 `dompurify` 在 Node 环境装不上（缺 jsdom 宿主），**暂停**告诉我——可能要改走 `isomorphic-dompurify` 或在 renderer 端单独用。

- [ ] **Step 1.3: 最小 SDK 连通性测试（临时脚本，测完删）**

写入临时文件 `F:/左文Project/fangkejia-pro/scripts/sdk-smoke.mjs`：

```js
import { query } from '@anthropic-ai/claude-agent-sdk';

const iter = query({
  prompt: 'Reply with exactly the string "PONG" and nothing else.',
  options: { cwd: process.cwd() },
});

for await (const event of iter) {
  console.log('EVENT:', JSON.stringify(event, null, 2));
  if (event.type === 'result') break;
}
```

运行：
```bash
node scripts/sdk-smoke.mjs 2>&1 | head -80
```

**期望：** 能看到多条 JSON 事件流出，包含 `type: "assistant"` 和最终 `type: "result"`，响应里含 "PONG"。

**如果报错：**
- `Cannot find package`：Step 1.2 没装好
- `Not authenticated`：用户 `~/.claude/` 没登录；提示用户先 `claude` 登录
- `query is not a function`：包名对但 API 不同（可能导出是 default 或别的名字）——**暂停**把 `npm view @anthropic-ai/claude-agent-sdk` 的完整 meta 给我，我根据实际 API 改 plan

**如果跑通：** 继续 Step 1.4。

- [ ] **Step 1.4: 删掉临时脚本 + 提交**

```bash
rm -rf scripts/sdk-smoke.mjs
# 如果 scripts/ 变空目录，也删掉
rmdir scripts 2>/dev/null || true

git add package.json package-lock.json
git commit -m "chore: install Claude Agent SDK and markdown deps"
```

---

## Task 2: 规范化事件类型（Shared 层）

**Files:**
- Create: `shared/events.ts`
- Modify: `shared/types.ts`
- Modify: `shared/ipc-channels.ts`

- [ ] **Step 2.1: 定义 NormalizedEvent**

写入 `F:/左文Project/fangkejia-pro/shared/events.ts`：

```ts
/**
 * Provider-agnostic event stream. Each AgentProvider maps its
 * native events into one of these.
 */
export type NormalizedEvent =
  | { type: 'assistant'; content: string; partial: boolean }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; toolUseId: string; toolName: string; toolInput: unknown }
  | { type: 'tool_result'; toolUseId: string; output: string; isError: boolean }
  | { type: 'system'; subtype: string; data: unknown }
  | { type: 'result'; sessionId: string; tokensIn: number; tokensOut: number }
  | { type: 'error'; code: string; message: string };

export interface SendMessageRequest {
  prompt: string;
  /** Optional cwd; defaults to process.cwd() on main side. */
  cwd?: string;
  /** For resuming. null / undefined = new session. */
  resumeSessionId?: string | null;
}

export interface ApprovalRequest {
  id: string;                       // uuid, used to correlate response
  toolName: 'Bash';                 // only Bash for now
  command: string;
  description?: string;
}

export interface ApprovalResponse {
  id: string;
  decision: 'allow' | 'deny';
}
```

- [ ] **Step 2.2: 扩展 IPC channel 常量**

把 `F:/左文Project/fangkejia-pro/shared/ipc-channels.ts` 内容**完整替换为**：

```ts
/**
 * All IPC channels used in fangkejia-pro.
 * Every IPC call must use a constant from this file.
 */
export const IpcChannels = {
  // M1
  PING: 'ipc:ping',

  // M2 — request/response (ipcRenderer.invoke)
  CC_SEND: 'cc:send',
  CC_ABORT: 'cc:abort',
  APPROVAL_RESPOND: 'approval:respond',

  // M2 — pub-sub (webContents.send → ipcRenderer.on)
  CC_EVENT: 'cc:event',
  CC_DONE: 'cc:done',
  APPROVAL_REQUEST: 'approval:request',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
```

- [ ] **Step 2.3: 提交**

```bash
git add shared/events.ts shared/ipc-channels.ts
git commit -m "feat(shared): add NormalizedEvent types and M2 IPC channels"
```

---

## Task 3: AgentProvider 接口

**Files:**
- Create: `src/main/providers/AgentProvider.ts`

- [ ] **Step 3.1: 写接口定义**

写入 `F:/左文Project/fangkejia-pro/src/main/providers/AgentProvider.ts`：

```ts
import type { NormalizedEvent, SendMessageRequest } from '@shared/events';

export interface ProviderFeatures {
  hooks: boolean;
  resume: boolean;
  slashCommands: boolean;
  subagents: boolean;
}

export type ApprovalHook = (
  toolName: string,
  toolInput: Record<string, unknown>,
) => Promise<{ allow: boolean; reason?: string }>;

export interface QueryOpts {
  /** Called per tool use; return allow:false to deny. */
  canUseTool?: ApprovalHook;
  /** Pre-tool hook: fires before tool execution. v1 uses for snapshotting (M5), not here. */
  onPreToolUse?: (toolName: string, toolInput: Record<string, unknown>) => Promise<void>;
}

export interface AgentProvider {
  readonly id: string;
  readonly displayName: string;
  readonly features: ProviderFeatures;

  /**
   * Execute one user turn. Returns an AsyncIterable of NormalizedEvent.
   * Iteration ends when the provider signals completion (result event emitted just before end).
   */
  query(req: SendMessageRequest, opts?: QueryOpts): AsyncIterable<NormalizedEvent>;

  /** Abort the currently-running query (if any). No-op if none. */
  abortCurrent(): Promise<void>;
}
```

- [ ] **Step 3.2: 提交**

```bash
git add src/main/providers/AgentProvider.ts
git commit -m "feat(main): define AgentProvider interface for multi-provider support"
```

---

## Task 4: ClaudeCodeProvider 实现（TDD）

**Files:**
- Create: `src/main/providers/claude-code.ts`
- Create: `tests/unit/claude-code-provider.test.ts`

SDK 事件类型和我们的 `NormalizedEvent` 的映射集中在 **一个纯函数** `mapSdkEventToNormalized`，这样可以无 SDK 运行时前提下单测。

- [ ] **Step 4.1: 先写测试（事件映射）**

写入 `F:/左文Project/fangkejia-pro/tests/unit/claude-code-provider.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { mapSdkEventToNormalized } from '@main/providers/claude-code';

describe('mapSdkEventToNormalized', () => {
  it('maps assistant text chunk', () => {
    const sdk = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello' }] },
    };
    const n = mapSdkEventToNormalized(sdk);
    expect(n).toEqual({ type: 'assistant', content: 'Hello', partial: true });
  });

  it('maps tool_use', () => {
    const sdk = {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'tool_abc', name: 'Bash', input: { command: 'ls' } },
        ],
      },
    };
    const n = mapSdkEventToNormalized(sdk);
    expect(n).toEqual({
      type: 'tool_use',
      toolUseId: 'tool_abc',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    });
  });

  it('maps result event with token counts', () => {
    const sdk = {
      type: 'result',
      session_id: 'sess_123',
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    const n = mapSdkEventToNormalized(sdk);
    expect(n).toEqual({
      type: 'result',
      sessionId: 'sess_123',
      tokensIn: 100,
      tokensOut: 50,
    });
  });

  it('returns null for unknown event types', () => {
    expect(mapSdkEventToNormalized({ type: 'wtf' } as any)).toBeNull();
  });
});
```

- [ ] **Step 4.2: 跑测试验证 FAIL**

```bash
npm test -- tests/unit/claude-code-provider.test.ts 2>&1 | tail -15
```

期望：FAIL（Cannot find module）。

- [ ] **Step 4.3: 写 provider 实现（最小版）**

写入 `F:/左文Project/fangkejia-pro/src/main/providers/claude-code.ts`：

```ts
import type {
  AgentProvider,
  ProviderFeatures,
  QueryOpts,
} from './AgentProvider';
import type { NormalizedEvent, SendMessageRequest } from '@shared/events';
import { logger } from '../utils/logger.js';

/**
 * Pure mapper — NO SDK import inside. Tested in isolation.
 * Accepts an SDK event object (shape documented below) and returns
 * a NormalizedEvent, or null if we don't care about this event type.
 *
 * SDK event shapes covered (based on claude-agent-sdk docs as of 2026-04):
 *   { type: 'assistant', message: { content: [{ type: 'text', text: string } | { type: 'tool_use', id, name, input }] } }
 *   { type: 'user',      message: { content: [{ type: 'tool_result', tool_use_id, content, is_error? }] } }
 *   { type: 'result',    session_id, usage: { input_tokens, output_tokens } }
 *   { type: 'system',    subtype, ... }
 */
export function mapSdkEventToNormalized(evt: any): NormalizedEvent | null {
  if (!evt || typeof evt !== 'object') return null;

  switch (evt.type) {
    case 'assistant': {
      const content = evt.message?.content;
      if (!Array.isArray(content) || content.length === 0) return null;
      const block = content[0];
      if (block.type === 'text') {
        return { type: 'assistant', content: String(block.text ?? ''), partial: true };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          toolUseId: String(block.id),
          toolName: String(block.name),
          toolInput: block.input ?? {},
        };
      }
      if (block.type === 'thinking') {
        return { type: 'thinking', content: String(block.thinking ?? block.text ?? '') };
      }
      return null;
    }
    case 'user': {
      const content = evt.message?.content;
      if (!Array.isArray(content) || content.length === 0) return null;
      const block = content[0];
      if (block.type === 'tool_result') {
        return {
          type: 'tool_result',
          toolUseId: String(block.tool_use_id),
          output:
            typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content),
          isError: Boolean(block.is_error),
        };
      }
      return null;
    }
    case 'result':
      return {
        type: 'result',
        sessionId: String(evt.session_id ?? ''),
        tokensIn: Number(evt.usage?.input_tokens ?? 0),
        tokensOut: Number(evt.usage?.output_tokens ?? 0),
      };
    case 'system':
      return {
        type: 'system',
        subtype: String(evt.subtype ?? 'unknown'),
        data: evt,
      };
    default:
      return null;
  }
}

export class ClaudeCodeProvider implements AgentProvider {
  readonly id = 'claude-code';
  readonly displayName = 'Claude Code';
  readonly features: ProviderFeatures = {
    hooks: true,
    resume: true,
    slashCommands: true,
    subagents: true,
  };

  private abortController: AbortController | null = null;

  async *query(
    req: SendMessageRequest,
    opts?: QueryOpts,
  ): AsyncIterable<NormalizedEvent> {
    // Dynamic import keeps this module test-importable without the SDK.
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    this.abortController = new AbortController();
    const cwd = req.cwd ?? process.cwd();

    const sdkOptions: any = {
      cwd,
      abortController: this.abortController,
    };

    if (req.resumeSessionId) {
      sdkOptions.resume = req.resumeSessionId;
    }

    if (opts?.canUseTool) {
      sdkOptions.canUseTool = async (toolName: string, toolInput: any) => {
        const decision = await opts.canUseTool!(toolName, toolInput);
        return decision.allow
          ? { behavior: 'allow', updatedInput: toolInput }
          : { behavior: 'deny', message: decision.reason ?? 'User denied' };
      };
    }

    try {
      const iter = query({ prompt: req.prompt, options: sdkOptions });
      for await (const sdkEvt of iter) {
        const n = mapSdkEventToNormalized(sdkEvt);
        if (n) yield n;
      }
    } catch (e) {
      logger.error('ClaudeCodeProvider.query error', { error: String(e) });
      yield {
        type: 'error',
        code: 'SDK_ERROR',
        message: e instanceof Error ? e.message : String(e),
      };
    } finally {
      this.abortController = null;
    }
  }

  async abortCurrent(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
```

- [ ] **Step 4.4: 跑测试，确认 4 个映射测试 PASS**

```bash
npm test 2>&1 | tail -10
```

期望：16 个测试全过（M1 12 个 + 4 个新的）。

- [ ] **Step 4.5: 提交**

```bash
git add src/main/providers/claude-code.ts tests/unit/claude-code-provider.test.ts
git commit -m "feat(main): implement ClaudeCodeProvider with SDK event mapping"
```

---

## Task 5: approvalService（Bash 审批简版）

**Files:**
- Create: `src/main/services/approvalService.ts`

- [ ] **Step 5.1: 写 approvalService**

写入 `F:/左文Project/fangkejia-pro/src/main/services/approvalService.ts`：

```ts
import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { ApprovalRequest, ApprovalResponse } from '@shared/events';

/**
 * Manages Bash tool approval flow.
 *
 * Flow:
 *   main → webContents.send('approval:request', req)
 *   renderer shows modal, user clicks allow/deny
 *   renderer → ipcRenderer.invoke('approval:respond', { id, decision })
 *   main resolves the pending promise
 */

const pending = new Map<string, (decision: 'allow' | 'deny') => void>();

export async function askApproval(
  win: BrowserWindow,
  partial: Omit<ApprovalRequest, 'id'>,
): Promise<'allow' | 'deny'> {
  const id = randomUUID();
  const req: ApprovalRequest = { id, ...partial };

  return new Promise<'allow' | 'deny'>((resolve) => {
    pending.set(id, resolve);
    win.webContents.send(IpcChannels.APPROVAL_REQUEST, req);
  });
}

export function handleApprovalResponse(resp: ApprovalResponse): void {
  const resolver = pending.get(resp.id);
  if (resolver) {
    resolver(resp.decision);
    pending.delete(resp.id);
  }
}

/**
 * Clear any pending approvals (e.g. when a conversation is aborted).
 * Pending promises resolve as 'deny' to unblock the SDK.
 */
export function abortAllPending(): void {
  for (const resolver of pending.values()) {
    resolver('deny');
  }
  pending.clear();
}
```

- [ ] **Step 5.2: 提交**

```bash
git add src/main/services/approvalService.ts
git commit -m "feat(main): add Bash tool approval service"
```

---

## Task 6: ccBridge（orchestrator）

**Files:**
- Create: `src/main/services/ccBridge.ts`

- [ ] **Step 6.1: 写 ccBridge**

写入 `F:/左文Project/fangkejia-pro/src/main/services/ccBridge.ts`：

```ts
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { SendMessageRequest } from '@shared/events';
import { ClaudeCodeProvider } from '../providers/claude-code.js';
import { askApproval, abortAllPending } from './approvalService.js';
import { logger } from '../utils/logger.js';

const provider = new ClaudeCodeProvider();

/**
 * Start a new query. Streams events to the given window via IPC.
 * Returns when the query ends (result or error).
 */
export async function sendMessage(win: BrowserWindow, req: SendMessageRequest): Promise<void> {
  logger.info('cc:send', { promptPreview: req.prompt.slice(0, 60) });

  try {
    const iter = provider.query(req, {
      canUseTool: async (toolName, toolInput) => {
        if (toolName !== 'Bash') {
          return { allow: true };
        }
        const command =
          typeof (toolInput as any).command === 'string'
            ? (toolInput as any).command
            : JSON.stringify(toolInput);
        const description =
          typeof (toolInput as any).description === 'string'
            ? (toolInput as any).description
            : undefined;
        const decision = await askApproval(win, {
          toolName: 'Bash',
          command,
          description,
        });
        return decision === 'allow'
          ? { allow: true }
          : { allow: false, reason: 'User denied Bash command' };
      },
    });

    for await (const evt of iter) {
      win.webContents.send(IpcChannels.CC_EVENT, evt);
    }
  } catch (e) {
    logger.error('ccBridge.sendMessage error', { error: String(e) });
    win.webContents.send(IpcChannels.CC_EVENT, {
      type: 'error',
      code: 'BRIDGE_ERROR',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    win.webContents.send(IpcChannels.CC_DONE, {});
  }
}

export async function abortCurrent(): Promise<void> {
  logger.info('cc:abort');
  abortAllPending();
  await provider.abortCurrent();
}
```

- [ ] **Step 6.2: 提交**

```bash
git add src/main/services/ccBridge.ts
git commit -m "feat(main): add ccBridge orchestrator wiring provider to IPC"
```

---

## Task 7: 扩展 IPC handlers + 主进程注册

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 7.1: 扩展 handlers.ts**

**完整替换** `F:/左文Project/fangkejia-pro/src/main/ipc/handlers.ts`：

```ts
import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  IpcResult,
  PingInput,
  PingOutput,
} from '@shared/types';
import type {
  SendMessageRequest,
  ApprovalResponse,
} from '@shared/events';
import { sendMessage, abortCurrent } from '../services/ccBridge.js';
import { handleApprovalResponse } from '../services/approvalService.js';

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

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.PING, (_evt, input: PingInput) => handlePing(input));

  ipcMain.handle(IpcChannels.CC_SEND, async (_evt, req: SendMessageRequest): Promise<IpcResult<null>> => {
    const win = getWindow();
    if (!win) {
      return { ok: false, error: { code: 'NO_WINDOW', message: 'Main window is not available' } };
    }
    if (!req?.prompt || typeof req.prompt !== 'string') {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'prompt is required' } };
    }
    // Fire-and-forget: events stream via webContents.send during sendMessage.
    sendMessage(win, req).catch(() => {
      // sendMessage already logs + sends error event; swallow here.
    });
    return { ok: true, data: null };
  });

  ipcMain.handle(IpcChannels.CC_ABORT, async (): Promise<IpcResult<null>> => {
    await abortCurrent();
    return { ok: true, data: null };
  });

  ipcMain.handle(IpcChannels.APPROVAL_RESPOND, (_evt, resp: ApprovalResponse): IpcResult<null> => {
    if (!resp?.id || (resp.decision !== 'allow' && resp.decision !== 'deny')) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'id + decision required' } };
    }
    handleApprovalResponse(resp);
    return { ok: true, data: null };
  });
}
```

- [ ] **Step 7.2: 更新主入口传递 window 引用**

**完整替换** `F:/左文Project/fangkejia-pro/src/main/index.ts`：

```ts
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc/handlers.js';
import { logger } from './utils/logger.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | null = null;

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
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  logger.info('app ready');
  registerIpcHandlers(() => mainWindow);
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 7.3: 跑测试确认 handlers.test 没坏**

```bash
npm test 2>&1 | tail -10
```

期望：所有测试仍通过。handlePing 签名没变，存量测试继续绿。

- [ ] **Step 7.4: 提交**

```bash
git add src/main/ipc/handlers.ts src/main/index.ts
git commit -m "feat(main): wire M2 IPC handlers and window accessor"
```

---

## Task 8: 扩展 preload API

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 8.1: 扩展 preload**

**完整替换** `F:/左文Project/fangkejia-pro/src/preload/index.ts`：

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { IpcResult, PingInput, PingOutput } from '@shared/types';
import type {
  NormalizedEvent,
  SendMessageRequest,
  ApprovalRequest,
  ApprovalResponse,
} from '@shared/events';

type Unsubscribe = () => void;

const api = {
  // M1
  ping(input: PingInput): Promise<IpcResult<PingOutput>> {
    return ipcRenderer.invoke(IpcChannels.PING, input);
  },

  // M2 — request/response
  send(req: SendMessageRequest): Promise<IpcResult<null>> {
    return ipcRenderer.invoke(IpcChannels.CC_SEND, req);
  },
  abort(): Promise<IpcResult<null>> {
    return ipcRenderer.invoke(IpcChannels.CC_ABORT);
  },
  respondApproval(resp: ApprovalResponse): Promise<IpcResult<null>> {
    return ipcRenderer.invoke(IpcChannels.APPROVAL_RESPOND, resp);
  },

  // M2 — pub/sub subscriptions
  onEvent(listener: (evt: NormalizedEvent) => void): Unsubscribe {
    const handler = (_e: unknown, evt: NormalizedEvent) => listener(evt);
    ipcRenderer.on(IpcChannels.CC_EVENT, handler);
    return () => ipcRenderer.off(IpcChannels.CC_EVENT, handler);
  },
  onDone(listener: () => void): Unsubscribe {
    const handler = () => listener();
    ipcRenderer.on(IpcChannels.CC_DONE, handler);
    return () => ipcRenderer.off(IpcChannels.CC_DONE, handler);
  },
  onApprovalRequest(listener: (req: ApprovalRequest) => void): Unsubscribe {
    const handler = (_e: unknown, req: ApprovalRequest) => listener(req);
    ipcRenderer.on(IpcChannels.APPROVAL_REQUEST, handler);
    return () => ipcRenderer.off(IpcChannels.APPROVAL_REQUEST, handler);
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

export type RendererApi = typeof api;
```

- [ ] **Step 8.2: 提交**

```bash
git add src/preload/index.ts
git commit -m "feat(preload): expose M2 send/abort/approval APIs with pub-sub subscriptions"
```

---

## Task 9: Markdown 渲染器（TDD，XSS 关键）

**Files:**
- Create: `src/renderer/utils/markdown.ts`
- Create: `tests/unit/markdown.test.ts`
- Modify: `vitest.config.ts`（环境加 jsdom，因为 DOMPurify 需要 DOM）

- [ ] **Step 9.1: 让 vitest 支持 DOM 环境（DOMPurify 依赖）**

**完整替换** `F:/左文Project/fangkejia-pro/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    // Default to node; per-test file can override via /** @vitest-environment jsdom */
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/unit/markdown.test.ts', 'jsdom'],
    ],
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
});
```

- [ ] **Step 9.2: 写测试（XSS 关键用例）**

写入 `F:/左文Project/fangkejia-pro/tests/unit/markdown.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@renderer/utils/markdown';

describe('renderMarkdown()', () => {
  it('renders basic markdown (headings, lists)', () => {
    const html = renderMarkdown('# Title\n\n- a\n- b');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>a</li>');
  });

  it('renders code blocks with language class', () => {
    const html = renderMarkdown('```js\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });

  it('strips script tags (XSS)', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips onclick handlers (XSS)', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('strips iframes', () => {
    const raw = '<iframe src="evil.com"></iframe>';
    const html = renderMarkdown(raw);
    expect(html).not.toContain('<iframe');
  });

  it('preserves safe https links', () => {
    const html = renderMarkdown('[safe](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('preserves inline code', () => {
    const html = renderMarkdown('Use `const` for this');
    expect(html).toContain('<code>const</code>');
  });
});
```

- [ ] **Step 9.3: 跑测试 → 应 FAIL**

```bash
npm test -- tests/unit/markdown.test.ts 2>&1 | tail -15
```

期望：FAIL（Cannot find module）。

- [ ] **Step 9.4: 写实现**

写入 `F:/左文Project/fangkejia-pro/src/renderer/utils/markdown.ts`：

```ts
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false, // disallow raw HTML in markdown source
  linkify: true,
  breaks: false,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch {
        // fallthrough to escape
      }
    }
    return md.utils.escapeHtml(str);
  },
});

const ALLOWED_TAGS = [
  'p', 'pre', 'code', 'strong', 'em', 'del',
  'ul', 'ol', 'li',
  'a', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br', 'hr', 'span', 'div',
];

const ALLOWED_ATTR = ['href', 'title', 'class', 'src', 'alt'];

export function renderMarkdown(source: string): string {
  const raw = md.render(source);
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(https?|mailto):/i,
  });
}
```

- [ ] **Step 9.5: 跑测试，确认全过**

```bash
npm test 2>&1 | tail -12
```

期望：所有测试通过（M1 12 + claude-provider 4 + markdown 7 = 23）。

- [ ] **Step 9.6: 提交**

```bash
git add src/renderer/utils/markdown.ts tests/unit/markdown.test.ts vitest.config.ts
git commit -m "feat(renderer): add markdown renderer with DOMPurify XSS protection"
```

---

## Task 10: useChatStore（TDD）

**Files:**
- Create: `src/renderer/stores/useChatStore.ts`
- Create: `tests/unit/chat-store.test.ts`

chat store 状态形如：
- `messages`: 已完成的消息列表
- `streamingAssistant`: 正在流入的 AI 消息（收完就 push 进 messages）
- `isStreaming`: 是否有活动 turn
- `pendingApproval`: 当前需要用户审批的 Bash 请求

- [ ] **Step 10.1: 写测试**

写入 `F:/左文Project/fangkejia-pro/tests/unit/chat-store.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChatStore } from '@renderer/stores/useChatStore';

describe('useChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with empty state', () => {
    const store = useChatStore();
    expect(store.messages).toEqual([]);
    expect(store.isStreaming).toBe(false);
    expect(store.streamingAssistant).toBeNull();
  });

  it('addUserMessage pushes user turn', () => {
    const store = useChatStore();
    store.addUserMessage('hello');
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('handleEvent(assistant, partial) accumulates into streamingAssistant', () => {
    const store = useChatStore();
    store.beginStream();
    store.handleEvent({ type: 'assistant', content: 'Hel', partial: true });
    store.handleEvent({ type: 'assistant', content: 'lo', partial: true });
    expect(store.streamingAssistant?.content).toBe('Hello');
    expect(store.isStreaming).toBe(true);
  });

  it('handleEvent(tool_use) appends tool card to streamingAssistant', () => {
    const store = useChatStore();
    store.beginStream();
    store.handleEvent({
      type: 'tool_use',
      toolUseId: 't1',
      toolName: 'Edit',
      toolInput: { file_path: 'a.ts' },
    });
    expect(store.streamingAssistant?.toolUses).toHaveLength(1);
    expect(store.streamingAssistant?.toolUses[0]).toMatchObject({
      toolUseId: 't1',
      toolName: 'Edit',
    });
  });

  it('handleEvent(tool_result) fills matching tool_use output', () => {
    const store = useChatStore();
    store.beginStream();
    store.handleEvent({
      type: 'tool_use',
      toolUseId: 't1',
      toolName: 'Edit',
      toolInput: {},
    });
    store.handleEvent({
      type: 'tool_result',
      toolUseId: 't1',
      output: 'done',
      isError: false,
    });
    const tool = store.streamingAssistant!.toolUses.find((t) => t.toolUseId === 't1');
    expect(tool?.output).toBe('done');
    expect(tool?.isError).toBe(false);
  });

  it('endStream commits streamingAssistant into messages', () => {
    const store = useChatStore();
    store.addUserMessage('hi');
    store.beginStream();
    store.handleEvent({ type: 'assistant', content: 'hi back', partial: true });
    store.endStream();
    expect(store.messages).toHaveLength(2);
    expect(store.messages[1]).toMatchObject({ role: 'assistant', content: 'hi back' });
    expect(store.streamingAssistant).toBeNull();
    expect(store.isStreaming).toBe(false);
  });

  it('setPendingApproval / clearPendingApproval', () => {
    const store = useChatStore();
    store.setPendingApproval({ id: 'x', toolName: 'Bash', command: 'ls' });
    expect(store.pendingApproval?.id).toBe('x');
    store.clearPendingApproval();
    expect(store.pendingApproval).toBeNull();
  });
});
```

- [ ] **Step 10.2: 跑测试确认 FAIL**

```bash
npm test -- tests/unit/chat-store.test.ts 2>&1 | tail -15
```

期望 FAIL。

- [ ] **Step 10.3: 写 store 实现**

写入 `F:/左文Project/fangkejia-pro/src/renderer/stores/useChatStore.ts`：

```ts
import { defineStore } from 'pinia';
import type { NormalizedEvent, ApprovalRequest } from '@shared/events';

export interface ToolUseRecord {
  toolUseId: string;
  toolName: string;
  toolInput: unknown;
  output?: string;
  isError?: boolean;
}

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
  turnNumber: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  content: string;          // aggregated text
  thinking: string;         // aggregated thinking block (if any)
  toolUses: ToolUseRecord[];
  turnNumber: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

let nextId = 1;
function mkId(): string {
  return `msg_${nextId++}_${Date.now()}`;
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as ChatMessage[],
    streamingAssistant: null as AssistantMessage | null,
    isStreaming: false,
    pendingApproval: null as ApprovalRequest | null,
    lastError: null as string | null,
    currentTurnNumber: 0,
  }),
  actions: {
    addUserMessage(content: string) {
      this.currentTurnNumber += 1;
      this.messages.push({
        id: mkId(),
        role: 'user',
        content,
        turnNumber: this.currentTurnNumber,
      });
    },
    beginStream() {
      this.isStreaming = true;
      this.streamingAssistant = {
        id: mkId(),
        role: 'assistant',
        content: '',
        thinking: '',
        toolUses: [],
        turnNumber: this.currentTurnNumber,
      };
      this.lastError = null;
    },
    handleEvent(evt: NormalizedEvent) {
      if (!this.streamingAssistant) return;
      const s = this.streamingAssistant;
      switch (evt.type) {
        case 'assistant':
          s.content += evt.content;
          break;
        case 'thinking':
          s.thinking += evt.content;
          break;
        case 'tool_use':
          s.toolUses.push({
            toolUseId: evt.toolUseId,
            toolName: evt.toolName,
            toolInput: evt.toolInput,
          });
          break;
        case 'tool_result': {
          const match = s.toolUses.find((t) => t.toolUseId === evt.toolUseId);
          if (match) {
            match.output = evt.output;
            match.isError = evt.isError;
          }
          break;
        }
        case 'error':
          this.lastError = `[${evt.code}] ${evt.message}`;
          break;
        case 'result':
        case 'system':
          // nothing to render inline; could surface system notices later
          break;
      }
    },
    endStream() {
      if (this.streamingAssistant) {
        this.messages.push(this.streamingAssistant);
        this.streamingAssistant = null;
      }
      this.isStreaming = false;
    },
    setPendingApproval(req: ApprovalRequest) {
      this.pendingApproval = req;
    },
    clearPendingApproval() {
      this.pendingApproval = null;
    },
    reset() {
      this.messages = [];
      this.streamingAssistant = null;
      this.isStreaming = false;
      this.pendingApproval = null;
      this.lastError = null;
      this.currentTurnNumber = 0;
    },
  },
});
```

- [ ] **Step 10.4: 跑测试确认全过**

```bash
npm test 2>&1 | tail -10
```

期望：30 个测试通过（之前 23 + chat-store 7）。

- [ ] **Step 10.5: 提交**

```bash
git add src/renderer/stores/useChatStore.ts tests/unit/chat-store.test.ts
git commit -m "feat(renderer): add useChatStore for streaming message state"
```

---

## Task 11: ToolUseCard 组件

**Files:**
- Create: `src/renderer/components/ToolUseCard.vue`

- [ ] **Step 11.1: 写组件**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/ToolUseCard.vue`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ToolUseRecord } from '../stores/useChatStore';

const props = defineProps<{ tool: ToolUseRecord }>();

const expanded = ref(false);

const summary = computed(() => {
  const input = props.tool.toolInput as Record<string, unknown>;
  if (typeof input?.file_path === 'string') return input.file_path;
  if (typeof input?.command === 'string') return input.command.slice(0, 60);
  return '';
});

const stateColor = computed(() => {
  if (props.tool.isError === true) return '#ef5350';
  if (props.tool.output !== undefined) return '#43a047';
  return '#ff9800'; // pending
});

const stateLabel = computed(() => {
  if (props.tool.isError === true) return '失败';
  if (props.tool.output !== undefined) return '完成';
  return '执行中';
});
</script>

<template>
  <div class="tool-card" :style="{ borderLeftColor: stateColor }">
    <div class="tool-header" @click="expanded = !expanded">
      <span class="tool-name">🔧 {{ tool.toolName }}</span>
      <span class="tool-summary">{{ summary }}</span>
      <span class="tool-state" :style="{ color: stateColor }">{{ stateLabel }}</span>
      <span class="chevron">{{ expanded ? '▾' : '▸' }}</span>
    </div>
    <div v-if="expanded" class="tool-body">
      <div class="label">输入</div>
      <pre class="json">{{ JSON.stringify(tool.toolInput, null, 2) }}</pre>
      <template v-if="tool.output !== undefined">
        <div class="label">输出</div>
        <pre class="output" :class="{ error: tool.isError }">{{ tool.output }}</pre>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tool-card {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--color-bg-alt);
  border-left: 3px solid #888;
  border-radius: 3px;
  font-size: 11px;
}
.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.tool-name {
  color: #81c784;
  font-weight: 600;
}
.tool-summary {
  color: var(--color-text);
  flex: 1;
  font-family: 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-state {
  font-size: 10px;
}
.chevron {
  color: var(--color-text-dim);
  font-size: 10px;
}
.tool-body {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border);
}
.label {
  font-size: 10px;
  color: var(--color-text-dim);
  margin-top: 4px;
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.json,
.output {
  font-family: 'Consolas', monospace;
  font-size: 11px;
  padding: 6px 8px;
  background: var(--color-bg);
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--color-text);
  max-height: 200px;
  overflow-y: auto;
}
.output.error {
  color: #ef5350;
}
</style>
```

- [ ] **Step 11.2: 提交**

```bash
git add src/renderer/components/ToolUseCard.vue
git commit -m "feat(renderer): add ToolUseCard component for tool call display"
```

---

## Task 12: MessageBubble 组件

**Files:**
- Create: `src/renderer/components/MessageBubble.vue`

- [ ] **Step 12.1: 写组件**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/MessageBubble.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '../utils/markdown';
import type { ChatMessage } from '../stores/useChatStore';
import ToolUseCard from './ToolUseCard.vue';

const props = defineProps<{ message: ChatMessage }>();

const html = computed(() => renderMarkdown(props.message.content || ''));
const isAssistant = computed(() => props.message.role === 'assistant');
const toolUses = computed(() =>
  props.message.role === 'assistant' ? props.message.toolUses : [],
);
const thinking = computed(() =>
  props.message.role === 'assistant' ? props.message.thinking : '',
);
</script>

<template>
  <div class="bubble" :class="{ user: !isAssistant, assistant: isAssistant }">
    <div class="header">
      <span class="role">{{ isAssistant ? 'AI' : '你' }}</span>
      <span class="turn">turn {{ message.turnNumber }}</span>
    </div>

    <div v-if="thinking" class="thinking">
      <span class="label">思考</span>
      <div class="thinking-text">{{ thinking }}</div>
    </div>

    <div class="content" v-html="html" />

    <ToolUseCard v-for="t in toolUses" :key="t.toolUseId" :tool="t" />
  </div>
</template>

<style scoped>
.bubble {
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 12px;
}
.bubble.user {
  background: #37373d;
}
.bubble.assistant {
  background: var(--color-bg);
}
.header {
  font-size: 10px;
  margin-bottom: 4px;
  display: flex;
  gap: 6px;
}
.bubble.user .role {
  color: var(--color-accent);
}
.bubble.assistant .role {
  color: #ffb74d;
}
.turn {
  color: var(--color-text-dim);
}
.content {
  line-height: 1.5;
}
.content :deep(pre) {
  background: var(--color-bg-alt);
  padding: 8px 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 11px;
}
.content :deep(code) {
  font-family: 'Consolas', monospace;
}
.content :deep(p) {
  margin: 4px 0;
}
.thinking {
  margin-bottom: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  font-style: italic;
}
.thinking .label {
  font-size: 9px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  margin-right: 6px;
}
.thinking-text {
  display: inline;
  color: var(--color-text-dim);
  font-size: 11px;
}
</style>
```

- [ ] **Step 12.2: 提交**

```bash
git add src/renderer/components/MessageBubble.vue
git commit -m "feat(renderer): add MessageBubble with Markdown rendering"
```

---

## Task 13: BashApprovalDialog 组件

**Files:**
- Create: `src/renderer/components/BashApprovalDialog.vue`

- [ ] **Step 13.1: 写组件**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/BashApprovalDialog.vue`：

```vue
<script setup lang="ts">
import { useChatStore } from '../stores/useChatStore';
import { unwrap } from '../utils/ipc';

const chat = useChatStore();

async function respond(decision: 'allow' | 'deny') {
  if (!chat.pendingApproval) return;
  const id = chat.pendingApproval.id;
  chat.clearPendingApproval();
  await unwrap(window.api.respondApproval({ id, decision }));
}
</script>

<template>
  <div v-if="chat.pendingApproval" class="overlay">
    <div class="dialog">
      <div class="title">⚠️ 命令执行确认</div>
      <div class="subtitle">AI 请求执行一条 Bash 命令</div>
      <div v-if="chat.pendingApproval.description" class="description">
        {{ chat.pendingApproval.description }}
      </div>
      <pre class="command">{{ chat.pendingApproval.command }}</pre>
      <div class="actions">
        <button class="deny" @click="respond('deny')">拒绝</button>
        <button class="allow" @click="respond('allow')">执行这一次</button>
      </div>
      <div class="hint">提示：v1 仅支持单次确认；本会话全允许/白名单将在 M6 版本加入。</div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 20px;
  width: 520px;
  max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.title {
  font-size: 15px;
  font-weight: 600;
  color: #ffa726;
  margin-bottom: 4px;
}
.subtitle {
  font-size: 12px;
  color: var(--color-text-dim);
  margin-bottom: 14px;
}
.description {
  font-size: 12px;
  color: var(--color-text);
  margin-bottom: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 3px;
}
.command {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  color: var(--color-accent);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.actions button {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
}
.allow {
  background: #0e639c;
  color: white;
}
.deny {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.hint {
  font-size: 10px;
  color: var(--color-text-dim);
  margin-top: 10px;
}
</style>
```

- [ ] **Step 13.2: 提交**

```bash
git add src/renderer/components/BashApprovalDialog.vue
git commit -m "feat(renderer): add BashApprovalDialog for single-use command approval"
```

---

## Task 14: 重写 ChatPanel 接入流式事件

**Files:**
- Modify: `src/renderer/components/ChatPanel.vue`
- Modify: `src/renderer/App.vue`（加 BashApprovalDialog 到根）

- [ ] **Step 14.1: 完整替换 ChatPanel.vue**

写入 `F:/左文Project/fangkejia-pro/src/renderer/components/ChatPanel.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useChatStore } from '../stores/useChatStore';
import { unwrap } from '../utils/ipc';
import MessageBubble from './MessageBubble.vue';

const chat = useChatStore();
const input = ref('');
const scrollBox = ref<HTMLElement | null>(null);

let offEvent: (() => void) | null = null;
let offDone: (() => void) | null = null;
let offApproval: (() => void) | null = null;

onMounted(() => {
  offEvent = window.api.onEvent((evt) => {
    chat.handleEvent(evt);
    scrollToBottom();
  });
  offDone = window.api.onDone(() => {
    chat.endStream();
    scrollToBottom();
  });
  offApproval = window.api.onApprovalRequest((req) => {
    chat.setPendingApproval(req);
  });
});

onBeforeUnmount(() => {
  offEvent?.();
  offDone?.();
  offApproval?.();
});

async function scrollToBottom() {
  await nextTick();
  if (scrollBox.value) {
    scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
  }
}

async function sendMessage() {
  const prompt = input.value.trim();
  if (!prompt || chat.isStreaming) return;
  chat.addUserMessage(prompt);
  chat.beginStream();
  input.value = '';
  await scrollToBottom();
  try {
    await unwrap(window.api.send({ prompt }));
  } catch (e) {
    chat.handleEvent({
      type: 'error',
      code: 'SEND_FAIL',
      message: (e as Error).message,
    });
    chat.endStream();
  }
}

async function abort() {
  await unwrap(window.api.abort());
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

const streamingMessage = computed(() => chat.streamingAssistant);
</script>

<template>
  <section class="chat-panel">
    <div class="chat-header">
      💬 对话
      <span v-if="chat.isStreaming" class="streaming-dot">●</span>
    </div>

    <div ref="scrollBox" class="chat-body">
      <MessageBubble v-for="m in chat.messages" :key="m.id" :message="m" />
      <MessageBubble v-if="streamingMessage" :message="streamingMessage" />

      <div v-if="chat.lastError" class="error-banner">
        {{ chat.lastError }}
      </div>

      <div v-if="chat.messages.length === 0 && !streamingMessage" class="empty">
        输入消息开始对话。Shift+Enter 换行，Enter 发送。
      </div>
    </div>

    <div class="chat-input">
      <textarea
        v-model="input"
        :disabled="chat.isStreaming"
        rows="3"
        placeholder="输入消息…（Enter 发送 / Shift+Enter 换行）"
        @keydown="onKeydown"
      />
      <div class="actions">
        <button v-if="!chat.isStreaming" @click="sendMessage" :disabled="!input.trim()">
          发送
        </button>
        <button v-else class="abort" @click="abort">中止</button>
      </div>
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
  display: flex;
  align-items: center;
  gap: 8px;
}
.streaming-dot {
  color: #66bb6a;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.chat-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}
.empty {
  color: var(--color-text-dim);
  font-size: 12px;
  text-align: center;
  margin-top: 40px;
}
.error-banner {
  background: #4a1515;
  color: #ff8a80;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
}
.chat-input {
  border-top: 1px solid var(--color-border);
  padding: 10px;
  background: var(--color-bg-alt);
}
.chat-input textarea {
  width: 100%;
  background: #3c3c3c;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px 10px;
  color: var(--color-text);
  font-size: 12px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}
.chat-input textarea:disabled {
  opacity: 0.5;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  gap: 6px;
}
.actions button {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  background: #0e639c;
  color: white;
}
.actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.actions button.abort {
  background: #c62828;
}
</style>
```

- [ ] **Step 14.2: App.vue 加 BashApprovalDialog**

**完整替换** `F:/左文Project/fangkejia-pro/src/renderer/App.vue`：

```vue
<script setup lang="ts">
import ActivityBar from './components/ActivityBar.vue';
import SidePanel from './components/SidePanel.vue';
import MonacoPane from './components/MonacoPane.vue';
import ChatPanel from './components/ChatPanel.vue';
import StatusBar from './components/StatusBar.vue';
import BashApprovalDialog from './components/BashApprovalDialog.vue';
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
    <BashApprovalDialog />
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

- [ ] **Step 14.3: typecheck 验证**

```bash
npm run typecheck 2>&1 | tail -15
```

期望无错误。

- [ ] **Step 14.4: 提交**

```bash
git add src/renderer/components/ChatPanel.vue src/renderer/App.vue
git commit -m "feat(renderer): wire ChatPanel to streaming events with abort and approval"
```

---

## Task 15: 手工冒烟 + 生产构建 + tag

**Files:** 无代码变动，仅验证。

- [ ] **Step 15.1: 跑所有单测**

```bash
npm test 2>&1 | tail -8
```

期望：~30 个测试全过。

- [ ] **Step 15.2: typecheck**

```bash
npm run typecheck
```

期望无错误。

- [ ] **Step 15.3: 生产构建**

```bash
rm -rf out && npm run build 2>&1 | tail -10
```

期望生成 `out/main/index.js`、`out/preload/index.cjs`、`out/renderer/*` 且无错误。

- [ ] **Step 15.4: 手工冒烟（需要人操作）**

```bash
npm run dev
```

**冒烟清单（要一项一项点过）：**

1. 窗口正常打开，四栏布局保留
2. 在 ChatPanel 输入框打 "你好，用一句话介绍自己"，回车
3. 观察流式输出：应看到 AI 消息气泡边流边出文字
4. DevTools Console（Ctrl+Shift+I）**无红色错误**
5. 打一条会触发工具的消息："读一下这个目录有哪些文件"
6. 观察：如果 AI 用 Bash，应弹出 BashApprovalDialog，显示命令；点"拒绝"工具被否；点"执行这一次"命令真正执行
7. 点"中止"按钮测试 abort 能正常打断
8. 试 XSS 测试：让 AI 输出 `<script>alert(1)</script>` 字面量，确认弹窗**不出现**（被 DOMPurify 过滤）

**如果任何一项失败：** 停下来报告现象，不要盲改。

- [ ] **Step 15.5: 更新 README**

**替换** `F:/左文Project/fangkejia-pro/README.md` 里"现状"一节：

```markdown
## 现状

- **M1 基础骨架** — ✅ 完成（Electron + Vue 3 + IPC 通路 + 四栏占位布局）
- **M2 SDK 接入** — ✅ 完成（Claude Agent SDK + 流式对话 + Markdown 渲染 + Bash 审批）
- M3 多会话持久化 — ⏳ 下一步
- M4 / M5 / M6 / M7 — ⏳ 后续
```

提交：

```bash
git add README.md
git commit -m "docs: update README with M2 completion"
```

- [ ] **Step 15.6: 打 tag + 推远程**

```bash
cd "F:/左文Project/fangkejia-pro"
git tag -a m2-done -m "Milestone 2 complete: real streaming conversation with Claude Agent SDK"
git push origin master
git push origin m2-done
```

---

## M2 完成标准

- ✅ 所有单测通过（~30 个）
- ✅ typecheck 无错误
- ✅ 生产构建成功
- ✅ 能发送消息并看到流式输出
- ✅ 工具调用卡片显示正常（折叠 / 展开）
- ✅ Bash 命令会弹审批框
- ✅ 中止按钮能打断正在进行的对话
- ✅ Markdown 里的 `<script>` / `javascript:` / `<iframe>` 全部被过滤
- ✅ `m2-done` tag 推到 origin

---

## 常见问题排查

| 症状 | 可能原因 | 处理 |
|------|---------|------|
| `Cannot find package '@anthropic-ai/claude-agent-sdk'` | Task 1 没装成功 | 回到 Task 1 Step 1.1 验证实际包名 |
| `Not authenticated` 错误事件 | 用户 `~/.claude/` 没登录 | 在终端先跑 `claude` 登录一次 |
| ChatPanel 收不到事件但 main 日志有 `cc:send` | preload API 没绑上 | 检查 DevTools: 输入 `window.api.onEvent` 应是 function |
| Markdown 渲染出原始 `<` 字符 | DOMPurify 过度清洗 | 检查 `ALLOWED_TAGS` 是否包含需要的标签 |
| Bash 审批弹框不出现 | `webContents.send('approval:request')` 没到 | 确认 ccBridge 里走了 canUseTool 分支 |
| 中止不生效 | AbortController 没传给 SDK | 检查 ClaudeCodeProvider 里 `sdkOptions.abortController` |
| `dompurify` 装不上（Node 环境） | Node 原生环境没 window | 我们只在 renderer 端调 renderMarkdown，Node 端测试用 jsdom 环境 |

---

## 风险与后续

- **SDK API 漂移：** Task 1 验证后基本稳定，但 `claude-agent-sdk` 是相对新的包，API 可能在小版本间有小改。建议 v1 期间锁死 Task 1 装的那个版本（`--save-exact`）
- **流式渲染性能：** 每个事件都触发 Vue 响应式更新。如果 AI 输出特别长（>10KB），可能卡。M2 先不优化，M7 加 virtual scroll
- **会话状态易失：** 刷新 / 关闭 app，消息全丢。M3 接 SQLite 后解决
