# claude-cli-mcp Installation Guide

> This guide is intended for LLM agents. Follow each step in order.
>
> The primary target is **OpenAI Codex CLI** — this MCP server lets Codex delegate work to Claude Code as a sub-agent. Cursor and Windsurf are also supported. Calling this server from Claude Code itself or Claude Desktop is generally not useful.

## 1. Prerequisites

### 1.1 Install Claude Code CLI (the binary this server wraps)

The recommended method is the **native installer** (no Node.js required, auto-updates):

**macOS / Linux / WSL:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

**Windows CMD:**
```batch
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Other supported methods:
- Homebrew: `brew install --cask claude-code`
- WinGet: `winget install Anthropic.ClaudeCode`
- apt/dnf/apk via [downloads.claude.ai](https://downloads.claude.ai)
- npm (advanced): `npm install -g @anthropic-ai/claude-code`

Windows native install requires [Git for Windows](https://git-scm.com/downloads/win). See [Claude Code setup docs](https://code.claude.com/docs/en/setup) for details.

### 1.2 Authenticate Claude Code

**Option A — Sign in (Recommended for desktop use)**

Run `claude` and follow the browser prompt. Requires a Pro, Max, Team, Enterprise, or Console (API) account.

**Option B — Long-lived OAuth token (Recommended for CI / headless)**

If the user has a Claude subscription, generate a long-lived OAuth token they can use without browser flow:

```bash
claude setup-token
```

This prints a token to the terminal (it is not saved). Set it as `CLAUDE_CODE_OAUTH_TOKEN` before invoking the MCP server:

```bash
export CLAUDE_CODE_OAUTH_TOKEN=<paste-token-here>
```

The token requires a Pro, Max, Team, or Enterprise plan and is scoped to inference only. **Note:** `--bare` mode does *not* read `CLAUDE_CODE_OAUTH_TOKEN` — if you set `bare: true` on the MCP tool, use Option C (`ANTHROPIC_API_KEY`) or an `apiKeyHelper` instead.

**Option C — Console API key**

For pure API-billing use:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

See the [Claude Code Authentication docs](https://code.claude.com/docs/en/authentication).

### 1.3 Install Bun (default runner) — optional but recommended

The MCP server is published to npm but the snippets in this guide invoke it via `bunx` for faster startup. If the user does not have Bun, install it:

```bash
# macOS / Linux / WSL
curl -fsSL https://bun.sh/install | bash

# Windows PowerShell
powershell -c "irm bun.sh/install.ps1 | iex"
```

If the user explicitly prefers npm, replace every `bunx` with `npx` (and `"command": "bunx"` with `"command": "npx"` in JSON/TOML configs). The server runs unchanged on either runtime.

## 2. Configure MCP Client

### 2.1 Ask the user for scope

**STOP — you must ask the user before proceeding.**

Ask the user in the same language they are using (e.g. if the conversation is in Korean, ask in Korean).

Ask: "Where do you want claude-cli-mcp available?"

| Choice | Meaning |
|--------|---------|
| **This project only (private)** | Only me, only this project |
| **All projects (global)** | Only me, across all projects |

> Codex does not have a built-in "shared with team" scope analogous to Claude Code's `--scope project`. Project-scoped Codex configs (`.codex/config.toml`) only load for projects the user has marked as trusted; mention this if the user asks for team-shared config.

Wait for the user's answer, then use it in the steps below.

### 2.2 Detect the MCP client

Determine which MCP client you are running in. Match one of the sections below.

### Codex CLI (primary target)

Codex stores MCP server entries in `config.toml`. **The `codex mcp add` command always writes to the global file `~/.codex/config.toml` and does NOT set timeout keys.** Because `bunx`'s first run downloads the package and Claude Code itself takes a moment to start, you almost certainly want to extend the default timeouts. Editing `config.toml` directly is the recommended path.

#### If user chose **All projects (global)** — edit `~/.codex/config.toml`
#### If user chose **This project only (private)** — edit (or create) `.codex/config.toml` in the project root

In both cases add the same TOML block:

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]

# Codex defaults are 10s / 60s. bunx cold install + Claude Code first
# response easily exceed those. Override generously.
startup_timeout_sec = 30
tool_timeout_sec = 600
```

> Codex only loads `.codex/config.toml` for projects the user has marked as trusted. Confirm trust the next time you open the project.

#### Alternative — `codex mcp add` (global only, no timeouts)

If you don't need to set timeouts (e.g. the package is already cached and you have a fast network), you can use:

```bash
codex mcp add claude-cli-mcp -- bunx @nayagamez/claude-cli-mcp
```

This writes the block above without `startup_timeout_sec` / `tool_timeout_sec`. You can re-edit `~/.codex/config.toml` afterwards to add them.

#### Optional — override Claude Code binary path

If `claude` is not on `PATH`, add an env subtable. The `[mcp_servers.<name>.env]` form sets static values; the separate `env_vars = [...]` array tells Codex to forward variables that are already set in the user's shell.

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]
startup_timeout_sec = 30
tool_timeout_sec = 600

[mcp_servers.claude-cli-mcp.env]
CLAUDE_CLI_PATH = "/absolute/path/to/claude"
```

> ## ⚠️ Restart Codex now — this is mandatory
>
> Codex loads MCP servers **only at session startup**. Any `codex` session that was open when you saved `config.toml` will not see `claude-cli-mcp` until you fully restart it. Skipping this is the #1 cause of "tool not found" / "MCP server not loaded" confusion.
>
> 1. In every open Codex session, type `/exit`.
> 2. Start a new `codex` session.
> 3. Proceed to §3 Verify below.

### Cursor

- If user chose **This project only (private)** → add to `.cursor/mcp.json` in the project root
- If user chose **All projects (global)** → add to `~/.cursor/mcp.json`

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

### Windsurf

- If user chose **This project only (private)** → add to `.windsurf/mcp.json` in the project root
- If user chose **All projects (global)** → add via Windsurf settings UI

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

## 3. Verify

### Codex CLI

**IMPORTANT: Codex loads MCP servers at session startup.** If you ran `codex mcp add` (or edited `config.toml`) inside an existing `codex` session, that session does NOT see the new server yet. You must restart Codex first:

1. In the current Codex session, type `/exit` to quit.
2. Run `codex` again to start a fresh session.
3. In the new session, simply ask:

   ```
   say hello using claude-cli-mcp
   ```

   Codex will invoke the `claude` tool and you should see a Session ID in the response.

You can also confirm the server is registered without making a tool call:

```bash
codex mcp list
```

It should list `claude-cli-mcp`.

> **Skipping the restart causes Codex to look very confused** (it sees the config but no tool, or replies as if the server doesn't exist). Always `/exit` and reopen.

### Cursor / Windsurf

Open the MCP panel in the IDE and confirm the `claude` and `claude-reply` tools appear. Trigger one with `prompt: "say hi only"`. A Session ID in the response means setup is complete.

## 4. Troubleshooting

If something doesn't work, match the symptom below.

### `MCP startup failed: handshaking with MCP server failed: connection closed: initialize response`

Codex's MCP startup timeout (default **10s**) was exceeded before the server replied to `initialize`. The most common cause is `bunx`'s first run downloading + extracting the package on a slow link. The TOML in §2 already sets `startup_timeout_sec = 30`. If you still see this:

- Make sure you actually saved the timeout keys and **restarted Codex** (see the box above §3).
- Pre-warm the bunx cache by running it once outside Codex:
  ```bash
  echo '' | bunx @nayagamez/claude-cli-mcp
  ```
  Press Ctrl-C after a few seconds. Subsequent Codex spawns will be much faster.
- Bump the timeout further: `startup_timeout_sec = 60`.
- As a last resort, switch the runner to `npx -y` (slower per-call but sometimes more stable on Windows):
  ```toml
  command = "npx"
  args = ["-y", "@nayagamez/claude-cli-mcp"]
  ```

### `tool not found` / `no such tool: mcp__claude-cli-mcp__claude` / "MCP server not loaded"

You edited `config.toml` while Codex was already running. Codex does **not** hot-reload MCP servers. `/exit` and start a new `codex` session.

### `MCP server failed to reconnect`

The child `claude-cli-mcp` crashed or was killed mid-session. Common causes:

- The `claude` binary isn't on `PATH`. Verify with `which claude` (or `where claude` on Windows). Set `CLAUDE_CLI_PATH` in the `[mcp_servers.<name>.env]` subtable to an absolute path.
- The Claude Code session itself failed to authenticate. Run `claude` standalone once and complete the browser login (or `claude setup-token`).
- Enable debug logs to see why the child died:
  ```toml
  [mcp_servers.claude-cli-mcp.env]
  CLAUDE_MCP_DEBUG = "1"
  ```
  Logs go to stderr; Codex surfaces them when MCP servers exit non-zero.

### `tool call cancelled` / `tool call timed out`

Codex killed the call after `tool_timeout_sec` (default **60s**). The §2 TOML sets it to `600` (10 min) — bump higher if your Claude Code task legitimately needs more.

### `Not logged in · Please run /login` (in the response payload)

The wrapped `claude` CLI cannot authenticate. Either:
- Run `claude` standalone once and complete the browser sign-in, or
- Run `claude setup-token` and `export CLAUDE_CODE_OAUTH_TOKEN=…` before launching Codex, or
- Set `ANTHROPIC_API_KEY` in the `[mcp_servers.<name>.env]` subtable (use this if you also pass `bare: true` on the tool).

### Windows-specific: silent exit / hang / `Query closed before response received`

Known upstream issue [anthropics/claude-code#50616](https://github.com/anthropics/claude-code/issues/50616). The wrapper cannot work around it. Run Codex (and Claude Code) inside WSL, or set `CLAUDE_CLI_PATH` to a WSL-resolved path.

### Codex on Windows fails to launch via shell-shimmed runners

Known upstream issue [openai/codex#16229](https://github.com/openai/codex/issues/16229). `bunx` itself is a native `bunx.exe` (no shim) and is the safer choice on Windows. If you're forced onto `npx`, point Codex at an absolute `node.exe` + the installed package's `dist/index.js` instead:

```toml
[mcp_servers.claude-cli-mcp]
command = "C:\\Program Files\\nodejs\\node.exe"
args = ["C:\\path\\to\\global\\node_modules\\@nayagamez\\claude-cli-mcp\\dist\\index.js"]
startup_timeout_sec = 30
tool_timeout_sec = 600
```

---

## 5. Important Warnings

When using this server, be aware of:

1. **Default permission mode is `bypassPermissions`** — matches `codex --full-auto` parity. For sensitive workspaces, pass `permissionMode: "acceptEdits"` or `"auto"`.
2. **Resume requires the original cwd** — `claude-reply` must run from the directory the original session was started in (Claude Code [issue #5768](https://github.com/anthropics/claude-code/issues/5768)).
3. **Windows native CLI bug** — Claude Code on Windows native may exit silently or hang ([issue #50616](https://github.com/anthropics/claude-code/issues/50616)). WSL is the recommended fallback.
4. **`bare: true` requires API key** — `--bare` mode skips OAuth; only works with `ANTHROPIC_API_KEY` or `apiKeyHelper`.
