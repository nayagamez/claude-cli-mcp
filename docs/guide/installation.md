# claude-cli-mcp Installation Guide

> This guide is intended for LLM agents and follows a strict, no-decision checklist. Execute every step in order. Do **not** skip a step because it "looks optional".
>
> Primary target: **OpenAI Codex CLI** (Codex delegates work to Claude Code as a sub-agent). Cursor and Windsurf are also supported (see §7).

---

## 1. Prerequisites — verify all three before continuing

Run each command and confirm the expected output. If any fails, fix it before going to §2.

### 1.1 Claude Code CLI installed

```bash
claude --version
```
Expected: a version string like `2.1.x (Claude Code)`.

If missing, install via the **native installer** (recommended; no Node.js needed):

| Platform | Command |
|---|---|
| macOS / Linux / WSL | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Windows PowerShell | `irm https://claude.ai/install.ps1 \| iex` |
| Windows CMD | `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd` |

Other methods: `brew install --cask claude-code` · `winget install Anthropic.ClaudeCode` · apt/dnf/apk via [downloads.claude.ai](https://downloads.claude.ai) · `npm install -g @anthropic-ai/claude-code` (advanced). Windows native install requires [Git for Windows](https://git-scm.com/downloads/win). Full reference: [Claude Code setup docs](https://code.claude.com/docs/en/setup).

### 1.2 Claude Code authenticated

```bash
claude auth status
```
Expected: a JSON object whose `loggedIn` field is `true` (exit code `0`).

If not logged in, pick one of the three:

| Method | When to use | Command |
|---|---|---|
| Browser sign-in | Pro/Max/Team/Enterprise/Console subscription | `claude` (follow the browser prompt) |
| Long-lived OAuth token | CI / headless | `claude setup-token` → copy → `export CLAUDE_CODE_OAUTH_TOKEN=…` |
| Console API key | Direct API billing | `export ANTHROPIC_API_KEY=sk-ant-…` |

> **Note**: `--bare` mode does **not** read `CLAUDE_CODE_OAUTH_TOKEN`. If you intend to set `bare: true` on the MCP tool, use `ANTHROPIC_API_KEY` or an `apiKeyHelper`. See [Claude Code Authentication docs](https://code.claude.com/docs/en/authentication).

After fixing, re-run `claude auth status` and confirm `loggedIn: true` before continuing.

### 1.3 Bun installed

```bash
bun --version
```
Expected: a version string like `1.x.x`.

If missing, install:

| Platform | Command |
|---|---|
| macOS / Linux / WSL | `curl -fsSL https://bun.sh/install \| bash` |
| Windows PowerShell | `powershell -c "irm bun.sh/install.ps1 \| iex"` |

> `bunx` is a native `bunx.exe` on Windows (no `.cmd` shim), which avoids [openai/codex#16229](https://github.com/openai/codex/issues/16229). If you cannot install Bun, see Troubleshooting §5 for the `npx` fallback.

---

## 2. Install for Codex CLI — paste this exact block

### 2.1 Ask the user for scope

Ask the user (in their language): "Where do you want claude-cli-mcp available?"

| Choice | File to edit |
|---|---|
| **All projects (global)** | `~/.codex/config.toml` |
| **This project only (private)** | `.codex/config.toml` in the project root (create if absent; loads only when the project is marked trusted in Codex) |

### 2.2 Add this exact TOML block to the chosen file

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]
startup_timeout_sec = 30
tool_timeout_sec = 600
```

> **Both `startup_timeout_sec` and `tool_timeout_sec` are required.** Codex's defaults (10s / 60s) are shorter than `bunx`'s cold install and Claude Code's typical first response. Do not omit them. Do not lower them.

### 2.3 (Optional) Override Claude Code binary path

Only if `claude` is not on `PATH`:

```toml
[mcp_servers.claude-cli-mcp.env]
CLAUDE_CLI_PATH = "/absolute/path/to/claude"
```

---

## 3. Restart Codex — REQUIRED, do not skip

**Codex loads MCP servers only at session startup. Editing `config.toml` while Codex is running has no effect on the running session.**

You must complete **both** sub-steps:

### 3.1 Exit every open Codex session

In each open `codex` terminal, type `/exit` and press Enter. Wait for the process to fully exit (the shell prompt returns).

### 3.2 Start a fresh Codex session

```bash
codex
```

If you skip §3, §4 will fail with `tool not found` or `MCP server not loaded`. Don't proceed to §4 until you are inside a Codex session that was started **after** the `config.toml` edit.

---

## 4. Verify — exact commands and expected outputs

### 4.1 Confirm the server is registered

```bash
codex mcp list
```
Expected: an entry containing `claude-cli-mcp`.

### 4.2 Confirm the tool actually works

In the fresh Codex session, type:

```
say hello using claude-cli-mcp
```

Expected response from Codex includes:
- A line beginning with `**Session ID:**` followed by a UUID.
- A short Claude reply (e.g., `hi` or `hello`).

If both 4.1 and 4.2 succeed, installation is complete.

---

## 5. Troubleshooting

Match the symptom verbatim.

### 5.1 `MCP startup failed: handshaking with MCP server failed: connection closed: initialize response`

Codex's startup timeout fired before the server replied. The §2 block already sets `startup_timeout_sec = 30`. If you still see this:

1. **Confirm you saved the file and restarted Codex** (§3). This is the most common cause.
2. Pre-warm the bunx cache:
   ```bash
   echo '' | bunx @nayagamez/claude-cli-mcp
   ```
   Wait a few seconds, press Ctrl-C. Subsequent Codex spawns will be faster.
3. Bump the timeout further: change `startup_timeout_sec = 30` to `60`, save, restart.
4. **Switch to the `npx` fallback** (slower per call but sometimes more stable on Windows):
   ```toml
   [mcp_servers.claude-cli-mcp]
   command = "npx"
   args = ["-y", "@nayagamez/claude-cli-mcp"]
   startup_timeout_sec = 30
   tool_timeout_sec = 600
   ```
   Save, restart Codex.

### 5.2 `tool not found` / `no such tool: mcp__claude-cli-mcp__claude` / "MCP server not loaded"

You did not restart Codex after editing `config.toml`. Re-do §3.

### 5.3 `MCP server failed to reconnect`

The child crashed mid-session.

- Verify the binary: `where claude` (Windows) or `which claude` (POSIX). If empty, fix `PATH` or set `CLAUDE_CLI_PATH` in `[mcp_servers.claude-cli-mcp.env]`.
- Confirm auth: re-run `claude auth status`.
- Enable debug logs:
  ```toml
  [mcp_servers.claude-cli-mcp.env]
  CLAUDE_MCP_DEBUG = "1"
  ```
  Restart Codex; child stderr now flows to Codex's MCP error surface.

### 5.4 `tool call cancelled` / `tool call timed out`

Codex killed the call after `tool_timeout_sec`. The §2 block sets it to `600` (10 min). If your task legitimately needs longer, raise it (e.g., `1800` = 30 min). Restart Codex.

### 5.5 Response payload contains `Not logged in · Please run /login`

The wrapped `claude` cannot authenticate. Re-do §1.2 and confirm `claude auth status` shows `loggedIn: true`. If you set `bare: true` on the tool, you must use `ANTHROPIC_API_KEY` or `apiKeyHelper` (OAuth tokens are not read in `--bare` mode).

### 5.6 Windows-specific: silent exit / hang / `Query closed before response received`

Known upstream bug ([anthropics/claude-code#50616](https://github.com/anthropics/claude-code/issues/50616)). The wrapper cannot work around it. Run Codex inside WSL, or set `CLAUDE_CLI_PATH` to a WSL path.

### 5.7 Codex on Windows fails to launch via shell-shimmed runners

Known upstream bug ([openai/codex#16229](https://github.com/openai/codex/issues/16229)). `bunx` is a native `bunx.exe` and is the safer choice on Windows. If you must use `npx` (a `.cmd` shim), point Codex at an absolute `node.exe` + the installed package's entry script:

```toml
[mcp_servers.claude-cli-mcp]
command = "C:\\Program Files\\nodejs\\node.exe"
args = ["C:\\path\\to\\global\\node_modules\\@nayagamez\\claude-cli-mcp\\dist\\index.js"]
startup_timeout_sec = 30
tool_timeout_sec = 600
```

---

## 6. Important Warnings

When using this server, be aware:

1. **Default permission mode is `bypassPermissions`** — matches `codex --full-auto` parity. For sensitive workspaces, pass `permissionMode: "acceptEdits"` or `"auto"` on the tool call.
2. **Resume requires the original cwd** — `claude-reply` must run from the directory the original session was started in (Claude Code [#5768](https://github.com/anthropics/claude-code/issues/5768)).
3. **Windows native CLI bug** — see §5.6.
4. **`bare: true` requires API key** — `--bare` skips OAuth; only `ANTHROPIC_API_KEY` or `apiKeyHelper` work.

---

## 7. Other MCP clients (Cursor / Windsurf)

If the user is on Cursor or Windsurf instead of Codex, replace §2.2 with the appropriate JSON config; everything else (§1 Prerequisites, §3 restart, §4 verify, §5 Troubleshooting) still applies — including the timeout fields if the client supports them.

### Cursor
- Project-scope: `.cursor/mcp.json` in the project root
- Global: `~/.cursor/mcp.json`

### Windsurf
- Project-scope: `.windsurf/mcp.json` in the project root
- Global: via Windsurf settings UI

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

> Cursor/Windsurf do not currently expose Codex's `startup_timeout_sec`/`tool_timeout_sec` keys. If you hit timeouts there, pre-warm the bunx cache (§5.1 step 2) before launching the editor.
