<div align="center">

### Bridge Anthropic Claude Code CLI to any MCP client

English | [한국어](./README.ko.md)

<a href="https://www.npmjs.com/package/@nayagamez/claude-cli-mcp">npm</a> · <a href="https://github.com/nayagamez/claude-cli-mcp">GitHub</a> · <a href="https://github.com/nayagamez/claude-cli-mcp/issues">Issues</a>

[![npm version](https://img.shields.io/npm/v/@nayagamez/claude-cli-mcp?color=00d4aa&label=npm)](https://www.npmjs.com/package/@nayagamez/claude-cli-mcp)
[![license](https://img.shields.io/github/license/nayagamez/claude-cli-mcp?color=7b61ff)](https://github.com/nayagamez/claude-cli-mcp/blob/main/LICENSE)

</div>

---

## Overview

An MCP (Model Context Protocol) server that wraps [Anthropic Claude Code CLI](https://code.claude.com) as tools. Lets MCP clients like **Claude Desktop**, **Cursor**, **Windsurf**, and **Claude Code itself** invoke headless Claude Code sessions.

> Forked from [`@nayagamez/codex-cli-mcp`](https://github.com/nayagamez/codex-cli-mcp). Same architecture (stdio MCP, stream-json parser, idle timeout, progress notifications) — adapted for `claude` CLI semantics.

## Prerequisites

### 1. Install Claude Code CLI

The recommended method is the **native installer** (Node.js not required, auto-updates):

```bash
# macOS / Linux / WSL
curl -fsSL https://claude.ai/install.sh | bash

# Windows PowerShell
irm https://claude.ai/install.ps1 | iex

# Windows CMD
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Other options: `brew install --cask claude-code` · `winget install Anthropic.ClaudeCode` · apt/dnf/apk via [downloads.claude.ai](https://downloads.claude.ai) · `npm install -g @anthropic-ai/claude-code` (advanced).

Windows native install requires [Git for Windows](https://git-scm.com/downloads/win). See [Claude Code setup docs](https://code.claude.com/docs/en/setup) for details.

### 2. Authenticate

Run `claude` and follow the browser prompt to sign in. Requires a Pro, Max, Team, Enterprise, or API plan.

For headless / CI:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

See [Authentication docs](https://code.claude.com/docs/en/authentication).

## Tools

### `claude`

Start a new Claude Code session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send |
| `model` | string | No | Model id or alias (`sonnet`, `opus`, `haiku`, or full id) |
| `effort` | enum | No | `low`, `medium`, `high`, `xhigh`, `max` |
| `permissionMode` | enum | No | `default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions` (default: **`bypassPermissions`**) |
| `cwd` | string | No | Working directory |
| `addDirs` | string[] | No | Additional read/write directories (`--add-dir`) |
| `allowedTools` | string[] | No | e.g. `["Bash(git *)", "Edit"]` |
| `disallowedTools` | string[] | No | Tools that may not be used |
| `appendSystemPrompt` | string | No | Text appended to default system prompt |
| `mcpConfig` | string[] | No | MCP server config files or JSON strings |
| `maxTurns` | number | No | Limit agentic turns (headless safety stop) |
| `bare` | boolean | No | `--bare` mode (skip hooks/skills/plugins/MCP). **Requires API key** |
| `timeout` | number | No | Idle timeout in ms (default: `600000`) |

The response includes a **Session ID** that can be passed to `claude-reply`.

### `claude-reply`

Continue an existing Claude Code session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Follow-up prompt |
| `sessionId` | string | Yes | Session ID from a previous `claude` call |
| `model`, `effort`, `permissionMode`, `allowedTools`, `disallowedTools`, `appendSystemPrompt`, `mcpConfig`, `maxTurns`, `bare`, `timeout` | | No | Same as `claude` |
| `forkSession` | boolean | No | Create a new session ID instead of reusing the original (`--fork-session`) |

> **No `cwd` parameter.** Sessions are tied to the directory they were started in (Claude Code [issue #5768](https://github.com/anthropics/claude-code/issues/5768)). Run from the original cwd.

## ⚠️ Known Issues & Warnings

1. **`bypassPermissions` is the default** — Matches `codex --full-auto` parity. Bypass mode has known instability ([issue #39523](https://github.com/anthropics/claude-code/issues/39523)) where protected directory writes still prompt and the mode can reset mid-session. For sensitive workspaces use `permissionMode: "acceptEdits"` or `"auto"`.
2. **Resume requires the original cwd** — Sessions cannot be moved across directories. Same-cwd execution is the user's responsibility ([issue #5768](https://github.com/anthropics/claude-code/issues/5768)).
3. **Windows native CLI bug** — Claude Code on Windows native may exit silently with no output, hang, or report `Query closed before response received` ([issue #50616](https://github.com/anthropics/claude-code/issues/50616)). Recommended fallback: WSL.
4. **`bare: true` breaks OAuth** — `--bare` skips OAuth and keychain reads. Authentication must come from `ANTHROPIC_API_KEY` or `apiKeyHelper`. Pro/Max OAuth users must keep `bare: false` (the default).
5. **`--bare` is the future default for `-p`** — Anthropic has stated `--bare` will become the default for `-p` in a future release ([headless docs](https://code.claude.com/docs/en/headless#start-faster-with-bare-mode)). v0.1 explicitly defaults to `bare: false` for OAuth compatibility; behavior may need to be revisited.

## Setup

> Examples below use `bunx` ([Bun](https://bun.sh)) as the default runner — faster startup, drop-in Node-compatible. If you prefer npm, swap `bunx` → `npx -y` in any snippet (npm needs `-y` to skip the auto-install confirmation; bunx auto-installs without it).

### Claude Code

```bash
claude mcp add claude-cli-mcp -- bunx @nayagamez/claude-cli-mcp
```

Add `--scope project` for shared team config or `--scope user` for global.

### Claude Desktop / Cursor / Windsurf

Add to the appropriate MCP config:

```json
{
  "mcpServers": {
    "claude-cli-mcp": {
      "command": "bunx",
      "args": ["@nayagamez/claude-cli-mcp"]
    }
  }
}
```

**Install Bun** (if you don't have it):
```bash
# macOS / Linux / WSL
curl -fsSL https://bun.sh/install | bash
# Windows PowerShell
powershell -c "irm bun.sh/install.ps1 | iex"
```

## Progress Notifications

The server sends MCP progress notifications in real-time as Claude processes your request:

- `[5s] Session started (<id>, model: claude-sonnet-4-6)` — init received
- `[12s] Tool use: Bash` — agent invoked a tool
- `[18s] Message: Refactoring the auth module...` — assistant text
- `[24s] Retry 2/3 in 1000ms (rate_limit)` — `system/api_retry` event
- `[25s] Result: success (24230ms, $0.0142)` — final result

### Idle-based Timeout

Timeout is **idle-based**: the timer resets on every event. Long-running tasks with continuous activity never time out; truly stuck processes are killed after the configured idle period.

- Default: **10 minutes**
- Override per-call via `timeout`, or globally via `CLAUDE_TIMEOUT_MS`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CLI_PATH` | `claude` | Path to the Claude Code CLI binary |
| `CLAUDE_TIMEOUT_MS` | `600000` (10 min) | Idle timeout for child Claude process |
| `CLAUDE_MCP_DEBUG` | _(unset)_ | Set to enable debug logging to stderr |

The server **automatically scrubs** the following env vars from the spawned child to prevent parent Claude Code state from leaking into headless invocations:

- `CLAUDECODE`, `CLAUDE_CODE_SIMPLE` (officially documented parent-detection signals)
- `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_PROJECT_DIR` (observed contributors to parent stop-hook injection)

`ANTHROPIC_API_KEY`, `apiKeyHelper`, and Bedrock/Vertex/Foundry credentials are preserved.

## How It Works

```
MCP Client  →  Tool Call (claude / claude-reply)
            →  Spawn `claude -p --output-format stream-json --verbose ...`
            →  Pipe a stream-json user envelope into stdin
            →  Parse JSONL events from stdout
            →  Send progress notifications on each event (idle timer resets)
            →  Return aggregated result + session id
```

1. MCP client sends `claude` or `claude-reply` tool call
2. Server spawns `claude` with `-p`, `--output-format stream-json`, `--input-format stream-json`, `--verbose`, plus user-specified flags
3. Prompt is delivered as a single-line user envelope on stdin (avoids Windows 8191-char `cmd.exe` limit)
4. stream-json events are parsed in real time (`system/init`, `system/api_retry`, `system/plugin_install`, `assistant`, `user`, `result`, `rate_limit_event`)
5. Progress notifications are sent on every event; idle timer resets
6. Final result includes session id, messages, tool uses, structured error, usage, and cost

## License

MIT
