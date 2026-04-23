# Changelog

All notable changes to this project will be documented in this file.

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
