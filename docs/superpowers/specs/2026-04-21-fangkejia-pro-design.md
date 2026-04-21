# fangkejia-pro v1 设计文档

**日期：** 2026-04-21
**状态：** v1 初版设计，待实现
**项目路径：** `F:\左文Project\fangkejia-pro`

---

## 1. 项目概述

**fangkejia-pro** 是一个桌面 GUI 应用，对标 Cursor 的轻量 IDE 体验，核心定位是**更好地使用 Claude Code**。用户在原生 `claude` CLI 上遇到的痛点（多会话切换麻烦、上下文不可视、对话历史不可检索、对话 UI 简陋、缺乏代码回滚）在本应用中集中解决。

**不是：**
- 不是另一个 AI 编码助手（不重新实现 agent）
- 不是全功能 IDE（v1 Monaco 只读，不替代 VSCode）
- 不是 Web 服务（纯本地桌面应用）

---

## 2. v1 范围

### 包含
- ✅ 多会话管理（新建 / 切换 / 列表）
- ✅ 对话 UI（Markdown / 代码高亮 / 工具调用展示 / 流式输出）
- ✅ 文件树 + Monaco 只读预览
- ✅ 代码回滚（β 粒度：恢复代码 + 截断对话；**只还原 AI 本次修改过的文件**）
- ✅ 上下文显示（当前 token 用量 + 已加载文件列表）
- ✅ 对话内关键字搜索（SQLite LIKE，非 FTS5）
- ✅ CLAUDE.md / commands / subagents 文件浏览 + 在 Monaco 里打开编辑

### 显式不包含（留 v1.1+）
- ❌ 全文检索（FTS5）
- ❌ 上下文时间线图 / 手动清理上下文
- ❌ inline diff 展开（只显示 "+N 行 / -M 行" 摘要）
- ❌ Monaco 可编辑模式（用户去自己的 VSCode 编辑）
- ❌ CLAUDE.md / commands / subagents 的专用表单式编辑器
- ❌ MCP / Hooks / Settings GUI
- ❌ 会话归档 / 置顶 / 标签
- ❌ 插件系统
- ❌ 多项目工作区（一窗口多项目）
- ❌ 跨设备同步

---

## 3. 技术栈

| 层次 | 选择 |
|------|------|
| 运行时壳 | Electron（最新稳定 major）|
| 前端框架 | Vue 3 + TypeScript + Vite |
| UI 组件库 | Element Plus（v1 首选，也可选 Naive UI） |
| 状态管理 | Pinia |
| 代码编辑器 | Monaco Editor（官方 npm 包） |
| 主进程语言 | Node.js（TypeScript） |
| 数据库 | SQLite（`better-sqlite3`） |
| Claude Code 集成 | `@anthropic-ai/claude-agent-sdk`（npm） |
| Markdown 渲染 | `markdown-it` + `DOMPurify` + `highlight.js` |
| 测试 | Vitest（单元 + 集成）|
| 打包 | `electron-builder` |

**依赖原则：** v1 外部 npm 依赖保持**不超过 15 个直接依赖**，避免供应链膨胀。

---

## 4. 整体架构

### 4.1 进程模型

Electron 双进程：

- **Renderer Process**（Chromium + Vue 3）：仅负责 UI。**关闭 Node 集成**（`nodeIntegration: false, contextIsolation: true, sandbox: true`），无 fs / 子进程权限。
- **Main Process**（Node.js）：所有"危险"操作（文件 I/O、SQLite、CC SDK、路径校验、快照管理）在此进行。
- **Preload script**：通过 `contextBridge` 暴露受控 IPC API 给 Renderer。

Renderer 不直接写文件，不直接跑 SDK；所有跨进程调用通过 IPC。

### 4.2 Main 进程模块

```
main/
├── index.ts              # Electron app 入口 + 窗口创建
├── ipc/
│   └── handlers.ts       # 所有 IPC 路由注册
├── services/
│   ├── ccBridge.ts       # @anthropic-ai/claude-agent-sdk 封装
│   ├── sessionStore.ts   # SQLite CRUD（sessions / messages / manifests）
│   ├── snapshotStore.ts  # 回滚安全核心：快照写入 + 回滚还原
│   ├── projectService.ts # 打开项目 / 文件树遍历 / 最近项目
│   └── approvalService.ts# Bash 工具审批（canUseTool 回调）
├── providers/
│   ├── AgentProvider.ts  # 抽象接口（见 §11）
│   └── claude-code.ts    # v1 唯一实现
├── utils/
│   ├── path-sandbox.ts   # 路径越界检查
│   ├── hash.ts           # SHA-256 包装
│   └── logger.ts         # 日志（带敏感字段过滤）
└── db/
    ├── schema.ts         # SQL 建表语句
    └── migrations.ts     # 版本迁移
```

**关键约束：** 只有 `snapshotStore` 可以写 `.fangkejia/snapshots/`；只有 `sessionStore` 可以写 SQLite。其他模块通过它们的 API 访问。

### 4.3 Renderer 进程模块

```
renderer/
├── App.vue
├── components/
│   ├── ActivityBar.vue       # 最左侧 48px 图标栏
│   ├── SidePanel.vue         # 文件树 + 会话列表共用一列
│   ├── FileTreePanel.vue
│   ├── SessionListPanel.vue
│   ├── MonacoPane.vue        # tab 式只读预览
│   ├── ChatPanel.vue         # 对话气泡 + 输入框
│   ├── MessageBubble.vue     # 单条消息（含回滚按钮）
│   ├── ToolUseCard.vue       # 工具调用展示
│   ├── ContextBadge.vue      # 状态栏 token 指示
│   ├── RollbackDialog.vue    # 回滚三选一对话框
│   └── BashApprovalDialog.vue# Bash 审批弹窗
├── stores/
│   ├── useSessionStore.ts
│   ├── useChatStore.ts
│   ├── useFileStore.ts
│   └── useSnapshotStore.ts
├── utils/
│   ├── ipc.ts                # 对 window.api 的封装 + 统一错误处理
│   └── markdown.ts           # MD 渲染 + DOMPurify
└── main.ts
```

### 4.4 共享模块

```
shared/
├── types.ts          # IPC 消息类型、事件类型、DTO
├── ipc-channels.ts   # 所有 IPC channel 常量
└── events.ts         # 规范化的 AgentEvent 类型
```

前后端都 import `shared/`，**禁止类型漂移**。

---

## 5. 数据模型

### 5.1 SQLite Schema

每个项目一个 SQLite 文件，路径：`<项目根>/.fangkejia/data.sqlite`。

```sql
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,          -- uuid v4
  project_path    TEXT NOT NULL,             -- 绝对路径
  title           TEXT,                      -- 可重命名，默认取首条 prompt 前 30 字
  cc_session_id   TEXT,                      -- SDK 侧 session id，resume 用
  provider_id     TEXT NOT NULL DEFAULT 'claude-code',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,             -- 'user' | 'assistant' | 'system'
  content_json    TEXT NOT NULL,             -- SDK 原始消息对象 JSON
  turn_number     INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_msg_session_turn ON messages(session_id, turn_number);

CREATE TABLE turn_manifests (
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_number     INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (session_id, turn_number)
);

CREATE TABLE manifest_files (
  session_id         TEXT NOT NULL,
  turn_number        INTEGER NOT NULL,
  file_path          TEXT NOT NULL,          -- 相对项目根的 POSIX 路径
  pre_hash           TEXT NOT NULL,          -- sha256，AI 改动前
  post_hash          TEXT,                   -- sha256，AI 改动后（漂移检测用）
  snapshot_rel_path  TEXT NOT NULL,          -- 相对 .fangkejia/snapshots/
  PRIMARY KEY (session_id, turn_number, file_path),
  FOREIGN KEY (session_id, turn_number)
    REFERENCES turn_manifests(session_id, turn_number) ON DELETE CASCADE
);

PRAGMA user_version = 1;
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
```

**设计决定：**
- `messages.content_json` 存 SDK 原始 JSON，不做 schema 化——SDK 协议变了也能向后兼容
- `manifest_files` 用复合主键 `(session, turn, path)`，没有独立 id，省一列
- 级联删除：删会话 → 删消息 + 删 manifests + 删 manifest_files
- `provider_id` 默认 `claude-code`，为未来多 provider 埋点

### 5.2 磁盘布局

```
<项目根>/
├── ... (用户代码)
└── .fangkejia/                              # 自动创建，自动加进 .gitignore
    ├── data.sqlite                          # 所有会话/消息/manifest
    └── snapshots/
        └── <session-id>/
            ├── turn-3/
            │   ├── src/utils.ts             # 镜像相对路径
            │   └── src/App.vue
            └── turn-5/
                └── src/router.ts

~/.fangkejia/                                # 全局配置
├── settings.json                            # 主题 / 字体 / 快捷键
└── recent-projects.json                     # 最近打开的项目列表
```

**`.gitignore` 自动处理：** 打开项目时，若检测到 `.git/` 且 `.gitignore` 未含 `.fangkejia/`，弹提示建议添加，用户点"是"后自动追加一行。

---

## 6. 关键流程

### 6.1 发送消息流程（带自动快照）

```
1. 用户在 ChatPanel 输入 prompt → 点发送
2. Renderer → IPC: cc:send(sessionId, prompt)
3. Main.ccBridge:
   a. sessionStore.appendMessage({ role: 'user', ... })
   b. provider.query(prompt, { resume: session.cc_session_id, hooks, canUseTool })
4. for await (const event of iter):
   a. 若 event.type === 'tool_use' 且 tool ∈ {Edit, Write, MultiEdit}：
        PreToolUse hook → snapshotStore.snapshotBeforeEdit({
          sessionId, turnNumber, filePath
        })
        （读文件 → 算 pre_hash → 复制到快照目录 → INSERT manifest_files）
   b. 事件推送给 Renderer: webContents.send('cc:event', normalizedEvent)
   c. 若 event.type === 'tool_use' 执行完（PostToolUse）：
        snapshotStore.recordPostHash({ sessionId, turnNumber, filePath })
        （算 post_hash → UPDATE manifest_files）
5. 循环结束（收到 result 事件）：
   a. sessionStore.appendMessage({ role: 'assistant', ... })
   b. sessionStore.upsertManifest({ sessionId, turnNumber })
   c. sessionStore.updateCcSessionId(sessionId, event.session_id)
   d. Renderer 收到 cc:done → 输入框解锁
```

**关键不变量：**
- 快照写入发生在**工具真正执行之前**（PreToolUse）
- 若快照写入失败（磁盘满、权限），PreToolUse hook 返回 `{ continue: false }`，工具不会执行
- 没被 AI 触碰的文件**永远不会**出现在 snapshot 目录

### 6.2 回滚流程（两阶段）

**第一阶段 dryRun（只读探测）：**

```
1. 用户在 ChatPanel 点某条 AI 消息的 "⤺ 回滚到此处"
2. Renderer 弹二次确认："将还原 K 个文件 + 删除 turn N+1..最新 的对话，继续？"
3. 用户确认 → Renderer → IPC: snapshot:dryRun(sessionId, turnN)
4. Main.snapshotStore.dryRun:
   a. SELECT * FROM manifest_files WHERE session_id=? AND turn_number=?
   b. for each file:
        current_hash = sha256(读磁盘)   // 文件不存在 → current_hash = null
        if post_hash == null:
          // AI 工具执行中途失败/被中止，最终状态未知
          → conflicts.push({ file, reason: 'interrupted_turn' })
        else if current_hash == post_hash:
          → safe.push(file)
        else:
          → conflicts.push({ file, current_hash, expected: post_hash, reason: 'external_modification' })
   c. 返回 { safe, conflicts }
```

**第二阶段 commit（实际还原）：**

```
5. 若 conflicts 非空，Renderer 弹冲突对话框，三选一：
   - overwrite_all  全部覆盖
   - skip_conflicts 只还原 safe（默认）
   - cancel         取消
6. 用户选择 → Renderer → IPC: snapshot:commit(sessionId, turnN, strategy)
7. Main.snapshotStore.commit（事务内执行）:
   a. 根据 strategy 决定哪些文件要还原
   b. for each file to restore:
        copy(snapshot_rel_path → file_path)  # 覆盖磁盘文件
   c. DELETE FROM messages WHERE session_id=? AND turn_number > N
   d. DELETE FROM turn_manifests WHERE session_id=? AND turn_number > N
      （级联删除 manifest_files）
   e. UPDATE sessions SET cc_session_id=NULL WHERE id=?
      （清 SDK session id，下次对话重新开始，避免 resume 到被删消息）
8. ccBridge.abortCurrent() 若当前有活动 turn
9. Renderer 收到完成事件 → 刷新 FileTree / Monaco / ChatPanel
```

**关键不变量：**
- 只有 `manifest_files WHERE turn=N` 登记的文件路径才会被写
- 任何 hash 对不上的文件，未经用户显式选"overwrite_all"绝不写
- 整个 commit 在 SQLite 事务内；文件还原异常时回滚事务，保持数据一致
- 回滚期间 ChatPanel 输入禁用，防止用户在回滚中途发新消息

### 6.3 打开项目流程

```
1. 用户：File → Open Folder
2. Renderer 调原生 dialog 选目录
3. Renderer → IPC: project:open(absolutePath)
4. Main.projectService.open:
   a. 若 .fangkejia/data.sqlite 不存在，创建目录 + 跑 schema.ts 初始化
   b. 若存在但 user_version < CURRENT，跑 migrations
   c. 若检测到 .git/ 且 .gitignore 不含 .fangkejia/，返回 needsGitignoreUpdate: true
   d. 读 sessions 表最新几条返回给 Renderer
5. Renderer 渲染 SidePanel，打开最近的一个会话或空态
```

---

## 7. UI 布局

主窗口从左到右：

| 区域 | 宽度 | 内容 |
|------|------|------|
| Activity Bar | 48px | 5 个图标：📁 文件 / 💬 会话 / ⚡ 命令 / 🤖 Agents / ⚙️ 设置 |
| Side Panel | 220px | 按 Activity Bar 选中切换内容；默认显示"文件树 + 会话列表"共用一列 |
| Monaco 编辑区 | flex 1.2 | Tab 式，v1 只读，悬浮提示"点击在 VSCode 打开" |
| Chat Panel | flex 1.3 | 对话气泡 + 输入框；每条 AI 回复右侧 ⤺ 回滚、📋 复制 |
| Status Bar | 底部 | 项目路径 / 当前 git 分支 / token 用量 / 当前模型 / "🔒 所有命令需确认" 状态 |

### 核心交互细节

- **会话切换：** 点 Side Panel 会话项 → 切换到对应 chat，Monaco tab 全关（每个会话的上下文不同）。**一个窗口绑定一个项目**，同窗口内所有会话共享同一个 `project_path`；切换项目需要 File → Open Folder 重新打开（或新窗口）
- **消息气泡：**
  - 用户消息：右对齐浅色气泡
  - AI 消息：左对齐白/暗色气泡，内含文字 + 工具调用卡片；底部一排按钮（⤺ 回滚、📋 复制、🔗 分享 v1.1）
- **工具调用卡片：** 默认折叠，显示 "🔧 Edit `src/App.vue` +3 行 / -1 行 ▸"，点击展开看完整参数
- **输入框：** 支持 `@文件名` 引用、`/命令` 触发 slash command、`Shift+Enter` 换行
- **流式输出：** AI 消息边流边拼 Markdown，光标末尾闪烁（`● 进行中`）
- **Bash 审批弹窗：** 模态框展示命令 + 描述 + 三个按钮：执行一次（默认高亮）/ 本会话全允许 / 拒绝
- **回滚冲突对话框：** 列出冲突文件的路径 + 当前时间戳 + 冲突原因（"你在 AI 改完后又手动修改过"），三个按钮：全覆盖 / 跳过冲突（默认高亮）/ 取消

---

## 8. 安全实现

### 8.1 三条铁律

#### ① Markdown 清洗（防 XSS）

所有 SDK 输出的 Markdown **必须**经过：

```ts
// renderer/utils/markdown.ts
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight: (str, lang) => hljs.highlight(str, { language: lang }).value,
});

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(md.render(text), {
    ALLOWED_TAGS: ['p','pre','code','strong','em','ul','ol','li','a','h1','h2','h3','h4','blockquote','table','thead','tbody','tr','th','td','br','hr','span'],
    ALLOWED_ATTR: ['href','title','class'],
    ALLOWED_URI_REGEXP: /^(https?|mailto):/i,
  });
}
```

**禁止** Vue 组件使用 `v-html` 直接绑原始 SDK 文本；ESLint 规则阻止。

#### ② 路径沙箱（防越界读写）

```ts
// main/utils/path-sandbox.ts
import path from 'path';

export class SecurityError extends Error {}

export function sandbox(projectRoot: string, userPath: string): string {
  const resolved = path.resolve(projectRoot, userPath);
  const rel = path.relative(projectRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new SecurityError(`Path escapes project root: ${userPath}`);
  }
  return resolved;
}
```

所有 fs-相关 IPC handler 开头**必须**调 `sandbox()`。测试覆盖各种越界路径（`../`、绝对路径、符号链接等）。

#### ③ Bash 工具审批

```ts
// main/services/approvalService.ts
export async function canUseTool(toolName, toolInput) {
  if (toolName === 'Bash') {
    const decision = await askUserApproval({
      command: toolInput.command,
      description: toolInput.description,
    });
    if (decision === 'deny') {
      return { behavior: 'deny', message: 'User rejected command' };
    }
    if (decision === 'allow_session') {
      approvalService.grantSessionPermission('Bash');
    }
    return { behavior: 'allow', updatedInput: toolInput };
  }
  return { behavior: 'allow', updatedInput: toolInput };
}
```

UI：Bash 执行前**总是弹模态**，除非用户本会话选过 "allow_session"。本会话结束（关闭会话 / 关闭 app）permission 重置。

### 8.2 其他安全措施

- `.env*`、`*.pem`、`id_rsa*`、`.git/`、`node_modules/` 默认进**快照黑名单**；即使 AI 试图修改也不做快照（但 AI 仍能改——只是我们不负责回滚）
- 日志通过白名单字段过滤，绝不打印 `ANTHROPIC_API_KEY` / SDK token / `~/.claude/` 任何内容
- Electron 打开 `sandbox: true` + CSP `default-src 'self'`，不加载远程资源
- SQLite 启动时 `PRAGMA integrity_check`

---

## 9. 错误处理

统一约定：所有 IPC handler 返回 `{ ok: true, data }` 或 `{ ok: false, error: { code, message } }`。Renderer 统一判 `ok`。

| 错误类型 | 处理 |
|---------|------|
| SDK 抛异常（网络 / 认证） | Main 发 `cc:error`，ChatPanel 底部红 banner；不崩溃 |
| 快照写入失败（磁盘满） | PreToolUse hook 返回 `{ continue: false }`——**不让 AI 执行本次 Edit**，弹 toast |
| 快照文件读取失败 | 进 conflicts 列表，用户决定 |
| 回滚时目标文件被 lock | 报错 + 提示关闭占用程序 |
| SQLite 损坏 | 启动时 `PRAGMA integrity_check`；失败 → 备份旧库 + 新建空库 + 提示 |
| Renderer 崩溃 | Electron 自动重启；从 SQLite rehydrate 最后会话 |
| Main 崩溃 | app 退出；下次启动状态一致（所有写用事务） |

---

## 10. 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest | `snapshotStore` 全部方法（最关键）、`sessionStore` CRUD、`path-sandbox`、`markdown.ts` |
| 集成测试 | Vitest + 真 SQLite + 真 fs + Mock SDK | 完整"发消息 → 快照 → 回滚"流程跑通 |
| 手动冒烟 | 真项目 10 分钟核心路径 | 每次发版前 |
| E2E（Playwright） | **v1 不做**，v1.1 加 | — |

### 必须覆盖的 `snapshotStore` 测试用例

1. `snapshotBeforeEdit` 能正确写入 manifest 和文件，hash 计算对
2. 同一轮多个文件被改 → 每个文件一行 manifest，互不干扰
3. `dryRun` 在文件未被外部修改时，所有 manifest 文件均为 safe
4. `dryRun` 在用户手动修改某文件后，该文件进 conflicts，其他仍在 safe
5. `commit(strategy='skip_conflicts')` 只还原 safe 文件；conflicts 列表里的文件**磁盘内容保持用户修改后的状态**
6. `commit(strategy='overwrite_all')` 还原所有（包括 conflicts），用户修改**被丢弃**但原内容仍在 snapshot 目录
7. `commit` 成功后，SQLite 里 `turn > N` 的消息和 manifests 全部删除
8. `commit` 中途抛异常（模拟磁盘错误）→ 事务回滚，数据库和文件系统都回到调用前状态
9. 快照目录不含任何未被 AI 修改的文件（黑盒测：用工具列 snapshots/ 下所有文件，和 manifest_files 对照应完全吻合）
10. 黑名单文件（`.env` 等）即使在 AI 工具调用里出现，也不会被快照
11. `dryRun` 遇到 `post_hash = NULL` 的文件（模拟 PreToolUse 写完但 PostToolUse 未执行——工具中途崩溃）→ 进 conflicts 列表，reason 为 `interrupted_turn`

---

## 11. 可扩展性：多 Provider 支持

### 11.1 抽象接口

`AgentProvider` 是所有 AI CLI 适配器的共同接口：

```ts
// shared/events.ts
export type NormalizedEvent =
  | { type: 'assistant'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; toolName: string; toolInput: unknown; toolId: string }
  | { type: 'tool_result'; toolId: string; output: string; isError: boolean }
  | { type: 'system'; subtype: string; data: unknown }
  | { type: 'result'; sessionId: string; stats: { tokensIn: number; tokensOut: number } }
  | { type: 'error'; code: string; message: string };

// main/providers/AgentProvider.ts
export interface AgentProvider {
  readonly id: string;
  readonly displayName: string;
  readonly features: {
    hooks: boolean;          // 支持 PreToolUse/PostToolUse hook
    resume: boolean;         // 支持恢复 session
    slashCommands: boolean;  // 支持 slash 命令
    subagents: boolean;
  };

  query(prompt: string, opts: QueryOpts): AsyncIterableIterator<NormalizedEvent>;
  resumeSession(sessionId: string): Promise<void>;
  abortCurrent(): Promise<void>;
}
```

### 11.2 v1 唯一实现

`main/providers/claude-code.ts` 包 `@anthropic-ai/claude-agent-sdk`，把 SDK 事件映射到 `NormalizedEvent`。

### 11.3 未来接入新 provider 步骤

1. 在 `main/providers/<name>.ts` 实现 `AgentProvider`
2. 在 `providers/index.ts` 注册
3. 会话创建 UI 里加 provider 选择下拉
4. 根据 `provider.features`，对应 UI 区域（slash commands、subagents）动态 enable/disable

**已识别的坑：**
- 无 `hooks` 支持的 provider → 退化为"文件监听"方式做快照（less elegant 但可用）
- 无 `resume` 支持的 provider → 每次对话从历史消息重建 prompt 上下文
- CC 特有配置（CLAUDE.md / commands / subagents）对其他 provider 隐藏 UI

---

## 12. v1 交付里程碑

不含详细排期（排期在实现计划里定），但大致阶段：

1. **M1 · 基础骨架**（3-5 天）：Electron + Vue 起项目，空窗口三栏布局，IPC 通路打通
2. **M2 · SDK 集成**（3-5 天）：发一条消息能收到流式输出，展示在 ChatPanel
3. **M3 · 数据持久化**（2-3 天）：SQLite schema + sessionStore；多会话切换
4. **M4 · 文件树 + Monaco**（2-3 天）：打开项目、展示文件树、Monaco 只读
5. **M5 · 快照 + 回滚**（4-6 天）：snapshotStore 实现 + 回滚 UI + 所有 §10 测试用例
6. **M6 · 安全三铁律**（2-3 天）：Markdown 清洗 + 路径沙箱 + Bash 审批
7. **M7 · 打磨 + 冒烟**（2-3 天）：状态栏 / 错误 banner / 上下文徽标 / 冒烟测试

**预计总工期：** 3 周出可用的 v1 原型（单人全职）。

---

## 13. 开放问题（实现阶段再定）

- **Electron 具体版本号**（选 LTS 还是 latest？）
- **UI 组件库** Element Plus vs Naive UI 最终敲定
- **主题系统**（v1 可能只做跟随系统 light/dark）
- **多语言**（v1 先中文，国际化 v1.1）
- **发布渠道**（v1 先手工构建 .exe，自动更新 v1.1）
