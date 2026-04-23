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

Codex stores MCP server entries in `config.toml`. **The `codex mcp add` command always writes to the global file `~/.codex/config.toml`.** For project-scoped install you must edit `.codex/config.toml` directly.

#### If user chose **All projects (global)**

Run:

```bash
codex mcp add claude-cli-mcp -- bunx @nayagamez/claude-cli-mcp
```

This writes a `[mcp_servers.claude-cli-mcp]` block to `~/.codex/config.toml`. Equivalent manual edit:

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]
```

#### If user chose **This project only (private)**

Edit (or create) `.codex/config.toml` in the project root and add the same block:

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]
```

> Codex only loads `.codex/config.toml` for projects the user has marked as trusted. The user may need to confirm trust the next time they open the project.

#### Optional — override Claude Code binary path

If `claude` is not on `PATH`, add an env subtable. The `[mcp_servers.<name>.env]` form sets the env directly (use this for static values). The separate `env_vars = [...]` array key tells Codex to forward variables that are already set in the user's shell.

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]

[mcp_servers.claude-cli-mcp.env]
CLAUDE_CLI_PATH = "/absolute/path/to/claude"
```

After saving, restart Codex (close and reopen the CLI session, or restart the IDE extension) to load the new server.

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

In a fresh `codex` session, ask Codex to call the new tool. Codex's MCP tool naming uses the `mcp__<server>__<tool>` convention. Try:

```
prompt: Call the mcp__claude-cli-mcp__claude tool with prompt "say hi only" and report what you get back.
```

If you see a Session ID in the response, the setup is complete. You can also verify the server is loaded with:

```bash
codex mcp list
```

It should list `claude-cli-mcp`.

### Cursor / Windsurf

Open the MCP panel in the IDE and confirm the `claude` and `claude-reply` tools appear. Trigger one with `prompt: "say hi only"`. A Session ID in the response means setup is complete.

## 4. Important Warnings

When using this server, be aware of:

1. **Default permission mode is `bypassPermissions`** — matches `codex --full-auto` parity. For sensitive workspaces, pass `permissionMode: "acceptEdits"` or `"auto"`.
2. **Resume requires the original cwd** — `claude-reply` must run from the directory the original session was started in (Claude Code [issue #5768](https://github.com/anthropics/claude-code/issues/5768)).
3. **Windows native CLI bug** — Claude Code on Windows native may exit silently or hang ([issue #50616](https://github.com/anthropics/claude-code/issues/50616)). WSL is the recommended fallback.
4. **`bare: true` requires API key** — `--bare` mode skips OAuth; only works with `ANTHROPIC_API_KEY` or `apiKeyHelper`.
