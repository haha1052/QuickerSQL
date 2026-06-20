# QuickerSQL 测试规则 v7.0

> 优先级：高（与 coding.md 并列）。
> 适用：所有"新建业务 Service / 数据库层 / 前端 store"场景。

---

## 一、项目测试现状（先对齐现状，再定要求）

| 测试类型 | 现状 | 位置 |
|---------|------|------|
| Rust 单元测试（数据库层） | 已有 | `src-tauri/src/database/tests.rs` |
| Rust 集成测试 | 无标准目录（`src-tauri/tests/` 不存在） | 建议 `src-tauri/tests/` |
| Rust 模块内测试（`# [cfg(test)]`） | 已存在若干处 | `src-tauri/src/database/security.rs`、`router.rs` 等 |
| 前端单元测试 | 无 | 建议 `src/__tests__/` 或 `src/**/*.test.tsx` |
| 端到端 / e2e | 无 | 桌面应用 e2e 成本高，暂不强制 |

---

## 二、强制测试要求（新代码 / 修改代码必须满足）

### 2.1 对 backend Rust 的要求

**(A) 新建 `*_service.rs` 文件**

- ✅ 必须在文件末尾添加 `#[cfg(test)] mod tests { ... }` 内联测试模块
- ✅ 至少测试以下场景：
  - 正常路径的 CRUD 操作（create / get / list / update / delete）
  - 输入为空字符串 / 非法字符时的错误处理
  - `Result::Err` 路径（例如删除不存在的 ID）
- ✅ 测试函数命名约定：`test_{场景}_{期望结果}`，如 `test_create_task_success`、`test_delete_task_not_found`

**(B) 新建 `commands/*.rs` 文件**

- ✅ 命令函数只做参数校验 + Service 调用，**不需要单独写测试**（逻辑在 Service 层已覆盖）
- ✅ 若命令函数内部有复杂校验逻辑（例如校验参数长度、格式），必须在文件末尾添加内联测试模块

**(C) `database/` 层改动**

- ✅ `database/tests.rs` 是数据库层统一测试文件
- ✅ 新增 `SqlIdentifier` 规则 / 新驱动时必须同步更新 `tests.rs` 的对应测试用例

### 2.2 对 frontend TS 的要求

- ✅ 新建 `*Store.ts` 必须至少包含 1 个 smoke test（初始化后能否读取默认 state）
- ✅ 新建复杂 `{Feature}Panel.tsx`（含超过 3 个 state 变量）时，至少用 Vitest 写 1 个 render 测试，或在 PR 描述中说明"已在应用中手动验证"
- ✅ **不强制覆盖率门槛**（见 §3 说明）

### 2.3 编译验证门禁（必须每次通过）

```bash
cd src-tauri
cargo check --quiet            # 0 errors 才能提交
cargo test --quiet             # 0 failing 才能提交
cd ..
# 如果 npx tsc 可用
npx tsc --noEmit --pretty      # 0 errors 才能提交
```

---

## 三、覆盖率门槛说明（为什么不强制百分比）

### 3.1 不设强制数字门槛的理由

| 理由 | 说明 |
|------|------|
| Tauri 桌面应用特性 | `#[tauri::command]` 函数依赖 Tauri runtime，纯 Rust cargo test 无法启动 webview，不能用传统的覆盖率工具衡量 |
| 前端 UI 组件的可测性 | `echarts-for-react`、`ag-grid-react` 等第三方组件的 canvas/虚拟化 DOM 在 jsdom 环境下难以真实验证 |
| SQLite 文件系统绑定 | `database/tests.rs` 需读写真实 SQLite 文件，CI 环境下需临时目录处理 |
| 个人开发者项目 | 本项目为单人开发的桌面工具，强制 80% 覆盖率会大幅降低迭代速度 |

### 3.2 推荐的软性目标

| 模块 | 目标 | 验证方式 |
|------|------|---------|
| `database/` 层 | 每个 `enum` / `struct` 至少 1 个测试 | `cargo test -p quickersql` 有对应函数 |
| `services/*_service.rs` | CRUD 各至少 1 个路径 | `grep 'fn test_' src-tauri/src/services/foo_service.rs` |
| `store/*Store.ts` | state 初始化 + 主要 action | 在任务 PR 中描述"已手动验证 X/Y/Z 三个动作" |

### 3.3 明确的反模式

- ❌ **为了达到覆盖率而写的"断言 true"空测试**（示例：`#[test] fn dummy() { assert!(true); }`）
- ❌ **跳过所有测试** `#[ignore]` 批量使用
- ❌ **在测试中直接 `unwrap()` / `.expect()`** 导致 CI 失败时难定位

---

## 四、测试目录规范

```
src-tauri/
├── src/
│   ├── database/
│   │   └── tests.rs            ← 数据库层统一测试（已有，继续使用）
│   ├── services/
│   │   ├── task_service.rs     ← 内含 mod tests（建议内联在文件尾）
│   │   ├── dashboard_service.rs ← 内含 mod tests
│   │   └── ...
│   └── commands/
│       └── automation.rs       ← 如含复杂校验则内联 mod tests
└── tests/                      ← 保留目录（若以后有集成测试可以放这里）

src/
└── __tests__/                  ← 可选前端测试（项目级目录，不强制创建）
```

**推荐的测试结构示例（Rust 内联）：**

```rust
// 文件末尾
#[cfg(test)]
mod tests {
    use super::*;

    fn setup_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        // 在此执行 CREATE TABLE ... 等准备工作
        conn
    }

    #[test]
    fn test_create_task_success() {
        let conn = setup_conn();
        // ...
    }

    #[test]
    fn test_create_task_empty_name_fails() {
        // ...
    }
}
```

**推荐的前端测试结构示例（TypeScript，仅当开启前端测试后遵循）：**

```ts
// src/__tests__/taskStore.test.ts  （可选目录，默认不创建以减少依赖）
import { useTaskStore } from "../store/taskStore";

describe("taskStore", () => {
  it("initial loading state is false", () => {
    const s = useTaskStore.getState();
    expect(s.loading).toBe(false);
  });
});
```

---

## 五、版本与变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v7.0 | 2026-06-20 | 初版。分层测试要求（Rust Service 层强制内联 mod tests；commands 层依赖 Service 测试；前端 Store 层需 smoke test）、编译门禁命令、不设百分比覆盖率的理由、推荐目录规范、模板示例 |
