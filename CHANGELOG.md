# Changelog

All notable changes to this project will be documented in this file.

## [0.1.7] - 2026-04-23

### Changed
- Default runner switched from `bunx` to `npx -y` across `README.md`, `README.ko.md`, and `docs/guide/installation.md`. In real-world Codex setups bunx kept hitting the `MCP startup failed: handshaking with MCP server failed: connection closed: initialize response` error even after raising `startup_timeout_sec`. npm/Node ships on more user machines, the `npx -y` invocation is well-understood by Codex agents, and on Windows the cold install behaves more predictably than the bunx flow.
  - Prerequisites §1.3 now checks `node --version` / `npm --version` instead of `bun --version`.
  - The mandatory §2 TOML block now reads `command = "npx" / args = ["-y", "@nayagamez/claude-cli-mcp"]`.
  - Cursor / Windsurf JSON examples (§7) updated to the same.
  - `bunx` is preserved as Alternative A inside Troubleshooting §5.7 (alongside the absolute `node.exe` path option), so users with an existing Bun setup still have a documented path.
  - The pre-warm guidance in §5.1 is now `npm install -g @nayagamez/claude-cli-mcp` (skips on-the-fly fetch entirely on subsequent runs).

## [0.1.6] - 2026-04-23

### Changed
- `docs/guide/installation.md` rewritten as a strict, no-decision checklist after a reviewer flagged that the previous structure left agents room to skip the two most-skipped steps: (a) restarting Codex after editing `config.toml`, and (b) including `startup_timeout_sec`/`tool_timeout_sec` in the TOML block.
  - **§1 Prerequisites** is now three verifiable commands (`claude --version`, `claude auth status`, `bun --version`) with the exact pass criteria; auth options collapsed into a single sub-table.
  - **§2 Install** presents a single mandatory TOML block. The previous `codex mcp add` one-liner was removed because it cannot set timeout keys, which made the alternative path silently produce broken installs.
  - **§3 Restart** is now its own numbered step with two sub-steps (`/exit` everywhere, then `codex`) and an explicit "do not proceed to §4 until you are inside a session started after the edit". Previously this lived inside §3 Verify and was ignored by agents.
  - **§4 Verify** specifies the exact prompt to type and the exact expected output (`Session ID:` line + Claude reply).
  - **§5 Troubleshooting** gains an `npx` fallback entry (5.1) for cases where bunx cold-start cannot be tamed via timeouts alone.
  - **§7 Other MCP clients** (Cursor/Windsurf) split out so the Codex flow stays linear; clarifies that those clients lack Codex's timeout keys.

## [0.1.5] - 2026-04-23

### Added
- `docs/guide/installation.md`: new §4 Troubleshooting section covering the 6 most common failure modes:
  - `MCP startup failed: ... initialize response` (timeout) — pre-warm bunx, bump `startup_timeout_sec`, or fall back to `npx -y`.
  - `tool not found` / "MCP server not loaded" — Codex doesn't hot-reload; `/exit` and restart.
  - `MCP server failed to reconnect` — `claude` not on PATH, auth missing, or a child crash. Enable `CLAUDE_MCP_DEBUG=1`.
  - `tool call cancelled` / timed out — bump `tool_timeout_sec`.
  - `Not logged in · Please run /login` in the response — fix Claude Code auth (sign-in, `setup-token`, or `ANTHROPIC_API_KEY`).
  - Windows-specific: silent exit / hang (upstream #50616) and shell-shim runner failures (upstream codex#16229) with absolute-path workaround.

### Changed
- `docs/guide/installation.md`: hoisted the "Restart Codex now" instruction out of §3 Verify and into a mandatory callout immediately after the Codex `config.toml` block, since skipping the restart is the #1 source of "tool not found" confusion.

## [0.1.4] - 2026-04-23

### Changed
- README + `docs/guide/installation.md`: the recommended Codex CLI install is now a direct `config.toml` edit that includes `startup_timeout_sec = 30` and `tool_timeout_sec = 600`. Codex's default 10s startup timeout is shorter than `bunx`'s cold-install + Claude Code's first response, which caused `MCP startup failed: handshaking with MCP server failed: connection closed: initialize response` for many users. The `codex mcp add` one-liner is kept as an alternative for cached/fast environments.

## [0.1.3] - 2026-04-23

### Changed
- README: Bun install moved up to Prerequisites §3 (it's the default runner — should not be hidden inside Setup → Manual Setup). The duplicate Bun install snippet at the bottom of Manual Setup was removed.

## [0.1.2] - 2026-04-23

### Changed
- README: restore the "For Humans / For LLM Agents" Setup pattern from `codex-cli-mcp` so an LLM agent can install this server end-to-end by being handed a single one-liner that points at `docs/guide/installation.md`. Manual setup blocks moved under a `Manual Setup` heading.

## [0.1.1] - 2026-04-23

### Changed
- README Setup section reorganized: Codex CLI is now the primary client example (the actual intended use case — Codex delegating to Claude Code as a sub-agent). Removed the misleading Claude-Code-installs-Claude-Code example. Cursor/Windsurf consolidated into a single block.

## [0.1.0] - 2026-04-23

### Added
- Initial release. Forked from `@nayagamez/codex-cli-mcp` (architecture preserved, adapted for `claude` CLI).
- `claude` tool: start a new Claude Code CLI session.
- `claude-reply` tool: continue an existing session by `sessionId` (`--resume`).
- Stream-json parser handling `system/init`, `system/api_retry`, `system/plugin_install`, `system/notification`, `assistant`, `user`, `result`, `rate_limit_event`, `stream_event`, with default passthrough for unknown event types.
- Structured error fields (`isError`, `errorCode`, `errorMessage`) on `ClaudeResult` to surface auth-failure / max-turns / process-exit cleanly.
- `--input-format stream-json` + stdin user envelope to bypass the Windows `cmd.exe` 8191-char arg limit.
- Real-time MCP progress notifications and idle-based timeout (resets on every event).
- Auto-scrub of parent Claude Code env vars (`CLAUDECODE`, `CLAUDE_CODE_SIMPLE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_PROJECT_DIR`) to prevent stop-hook injection when invoked from inside a Claude Code session.
- `bare` opt-in flag (`--bare`) for scripted/CI use (requires `ANTHROPIC_API_KEY` or `apiKeyHelper`).

### Tool schema
- `claude`: `prompt` (req), `model`, `effort`, `permissionMode` (default `bypassPermissions`), `cwd`, `addDirs[]`, `allowedTools[]`, `disallowedTools[]`, `appendSystemPrompt`, `mcpConfig[]`, `maxTurns`, `bare`, `timeout`.
- `claude-reply`: `prompt` (req), `sessionId` (req), `model`, `effort`, `permissionMode`, `allowedTools[]`, `disallowedTools[]`, `appendSystemPrompt`, `mcpConfig[]`, `maxTurns`, `forkSession`, `bare`, `timeout`. (No `cwd` — sessions are tied to original cwd, see Claude Code issue #5768.)

### Known issues (documented in README)
- `bypassPermissions` known instability ([anthropics/claude-code#39523](https://github.com/anthropics/claude-code/issues/39523))
- Resume requires original cwd ([anthropics/claude-code#5768](https://github.com/anthropics/claude-code/issues/5768))
- Windows native CLI bugs ([anthropics/claude-code#50616](https://github.com/anthropics/claude-code/issues/50616))
- `--bare` will become the default for `-p` in a future Claude Code release
