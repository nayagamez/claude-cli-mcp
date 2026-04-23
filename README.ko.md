<div align="center">

<picture>
  <img alt="claude-cli-mcp" src="docs/images/banner.svg" width="100%">
</picture>

### Anthropic Claude Code CLI를 MCP 클라이언트에 연결하세요

[English](./README.md) | 한국어

<a href="https://www.npmjs.com/package/@nayagamez/claude-cli-mcp">npm</a> · <a href="https://github.com/nayagamez/claude-cli-mcp">GitHub</a> · <a href="https://github.com/nayagamez/claude-cli-mcp/issues">Issues</a>

[![npm version](https://img.shields.io/npm/v/@nayagamez/claude-cli-mcp?color=00d4aa&label=npm)](https://www.npmjs.com/package/@nayagamez/claude-cli-mcp)
[![license](https://img.shields.io/github/license/nayagamez/claude-cli-mcp?color=7b61ff)](https://github.com/nayagamez/claude-cli-mcp/blob/main/LICENSE)

</div>

---

## 개요

[Anthropic Claude Code CLI](https://code.claude.com)를 MCP 도구로 래핑한 MCP(Model Context Protocol) 서버. **Claude Desktop**, **Cursor**, **Windsurf**, 그리고 **Claude Code 자체** 같은 MCP 클라이언트에서 Claude Code를 헤드리스 모드로 호출할 수 있게 합니다.

> [`@nayagamez/codex-cli-mcp`](https://github.com/nayagamez/codex-cli-mcp)에서 포팅. 동일한 아키텍처(stdio MCP, stream-json 파서, idle timeout, progress notification) — `claude` CLI 시맨틱에 맞게 적응.

## 사전 준비

### 1. Claude Code CLI 설치

권장 방법은 **네이티브 인스톨러** (Node.js 불필요, 자동 업데이트):

```bash
# macOS / Linux / WSL
curl -fsSL https://claude.ai/install.sh | bash

# Windows PowerShell
irm https://claude.ai/install.ps1 | iex

# Windows CMD
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

기타: `brew install --cask claude-code` · `winget install Anthropic.ClaudeCode` · apt/dnf/apk ([downloads.claude.ai](https://downloads.claude.ai)) · `npm install -g @anthropic-ai/claude-code` (advanced).

Windows 네이티브 설치는 [Git for Windows](https://git-scm.com/downloads/win) 필수. 자세한 사항은 [Claude Code setup docs](https://code.claude.com/docs/en/setup) 참조.

### 2. 인증

`claude`를 실행하고 브라우저 안내에 따라 로그인. Pro, Max, Team, Enterprise, API 플랜이 필요합니다.

헤드리스 / CI 환경:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

[Authentication 문서](https://code.claude.com/docs/en/authentication) 참조.

## 도구

### `claude`

새 Claude Code 세션 시작.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `prompt` | string | ✅ | 전송할 프롬프트 |
| `model` | string |  | 모델 ID 또는 alias (`sonnet`, `opus`, `haiku` 등) |
| `effort` | enum |  | `low`, `medium`, `high`, `xhigh`, `max` |
| `permissionMode` | enum |  | `default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions` (기본: **`bypassPermissions`**) |
| `cwd` | string |  | 작업 디렉토리 |
| `addDirs` | string[] |  | 추가 read/write 디렉토리 (`--add-dir`) |
| `allowedTools` | string[] |  | 예: `["Bash(git *)", "Edit"]` |
| `disallowedTools` | string[] |  | 사용 금지 도구 |
| `appendSystemPrompt` | string |  | 기본 시스템 프롬프트에 추가할 텍스트 |
| `mcpConfig` | string[] |  | MCP 서버 config 파일/JSON 문자열 |
| `maxTurns` | number |  | agentic turn 수 제한 (헤드리스 안전 정지) |
| `bare` | boolean |  | `--bare` 모드 (hooks/skills/plugins/MCP 스킵). **API key 필수** |
| `timeout` | number |  | Idle timeout (ms, 기본 `600000`) |

응답에는 `claude-reply`에 전달할 수 있는 **Session ID**가 포함됩니다.

### `claude-reply`

기존 Claude Code 세션 이어가기.

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `prompt` | string | ✅ | 후속 프롬프트 |
| `sessionId` | string | ✅ | 이전 `claude` 호출의 Session ID |
| `model`, `effort`, `permissionMode`, `allowedTools`, `disallowedTools`, `appendSystemPrompt`, `mcpConfig`, `maxTurns`, `bare`, `timeout` | | | `claude`와 동일 |
| `forkSession` | boolean |  | 원본 ID 대신 새 세션 ID 생성 (`--fork-session`) |

> **`cwd` 파라미터 없음.** 세션은 시작 디렉토리에 묶여 있음 (Claude Code [issue #5768](https://github.com/anthropics/claude-code/issues/5768)). 호출 측이 같은 cwd에서 실행해야 함.

## ⚠️ 알려진 이슈 / 경고

1. **`bypassPermissions`가 기본값** — `codex --full-auto`와 parity. Bypass 모드에는 알려진 불안정성([issue #39523](https://github.com/anthropics/claude-code/issues/39523))이 있어 protected dir write가 여전히 prompt하거나 mode가 mid-session에 reset될 수 있음. 민감한 워크스페이스에서는 `permissionMode: "acceptEdits"` 또는 `"auto"` 사용 권장.
2. **Resume은 원래 cwd 필요** — 세션을 다른 디렉토리로 옮길 수 없음. 같은 cwd에서 실행은 사용자 책임 ([issue #5768](https://github.com/anthropics/claude-code/issues/5768)).
3. **Windows 네이티브 CLI 버그** — Windows 네이티브에서 Claude Code가 조용히 종료, hang, 또는 `Query closed before response received` 보고할 수 있음 ([issue #50616](https://github.com/anthropics/claude-code/issues/50616)). 권장 fallback: WSL.
4. **`bare: true`는 OAuth 깨짐** — `--bare`는 OAuth/keychain 읽기를 건너뜀. 인증은 `ANTHROPIC_API_KEY` 또는 `apiKeyHelper`로만 가능. Pro/Max OAuth 사용자는 `bare: false` (기본값) 유지 필수.
5. **`--bare`는 `-p`의 미래 기본값** — Anthropic이 `--bare`를 향후 `-p`의 기본값으로 만들겠다고 명시 ([headless docs](https://code.claude.com/docs/en/headless#start-faster-with-bare-mode)). v0.1은 OAuth 호환성 위해 `bare: false` 명시 기본값 유지. 향후 동작 재검토 필요.

## 설정

> 주 사용처는 **OpenAI Codex CLI에서 Claude Code를 sub-agent로 호출**하는 것. Cursor/Windsurf도 지원. Claude Code에서 이 서버를 부르는 건 무의미 (Claude가 Claude를 부르는 격).
>
> 아래 예시는 [Bun](https://bun.sh)의 `bunx`를 기본 러너로 사용 — 시작이 빠르고 Node 호환. npm을 선호하면 `bunx` → `npx -y`로 바꾸면 됨 (npm은 자동 설치 동의 위해 `-y` 필요, bunx는 기본적으로 자동 설치).

### Codex CLI

`codex mcp add`는 글로벌 `~/.codex/config.toml`에 기록:

```bash
codex mcp add claude-cli-mcp -- bunx @nayagamez/claude-cli-mcp
```

동일한 효과의 직접 편집 (프로젝트 스코프 `.codex/config.toml`에도 동일 사용):

```toml
[mcp_servers.claude-cli-mcp]
command = "bunx"
args = ["@nayagamez/claude-cli-mcp"]
```

Codex를 재시작해서 로드. 프로젝트 스코프와 trusted-project 동작은 [installation guide](./docs/guide/installation.md) 참조.

### Cursor / Windsurf

해당 MCP 설정 파일 (`.cursor/mcp.json`, `~/.cursor/mcp.json`, `.windsurf/mcp.json` 등):

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

**Bun 설치** (없는 경우):
```bash
# macOS / Linux / WSL
curl -fsSL https://bun.sh/install | bash
# Windows PowerShell
powershell -c "irm bun.sh/install.ps1 | iex"
```

## Progress Notifications

Claude가 요청을 처리하는 동안 실시간으로 MCP progress notification을 전송:

- `[5s] Session started (<id>, model: claude-sonnet-4-6)` — init 수신
- `[12s] Tool use: Bash` — 에이전트가 도구 호출
- `[18s] Message: Refactoring the auth module...` — assistant 텍스트
- `[24s] Retry 2/3 in 1000ms (rate_limit)` — `system/api_retry` 이벤트
- `[25s] Result: success (24230ms, $0.0142)` — 최종 결과

### Idle 기반 Timeout

Timeout은 **idle-based**: 이벤트가 올 때마다 타이머 리셋. 활동이 계속되는 long-running 작업은 timeout되지 않고, 진짜 stuck 프로세스만 설정된 idle 후 죽임.

- 기본: **10분**
- per-call: `timeout` 파라미터, 글로벌: `CLAUDE_TIMEOUT_MS`

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CLAUDE_CLI_PATH` | `claude` | Claude Code CLI 바이너리 경로 |
| `CLAUDE_TIMEOUT_MS` | `600000` (10분) | 자식 Claude 프로세스 idle timeout |
| `CLAUDE_MCP_DEBUG` | _(unset)_ | stderr 디버그 로깅 활성화 |

서버는 자식 프로세스에서 다음 env를 **자동으로 scrub**하여 부모 Claude Code 상태가 헤드리스 호출에 새지 않게 합니다:

- `CLAUDECODE`, `CLAUDE_CODE_SIMPLE` (공식 부모 감지 신호)
- `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_PROJECT_DIR` (관측된 stop-hook 침투 관여 변수)

`ANTHROPIC_API_KEY`, `apiKeyHelper`, Bedrock/Vertex/Foundry 자격증명은 보존됩니다.

## 동작 방식

```
MCP 클라이언트  →  도구 호출 (claude / claude-reply)
                →  `claude -p --output-format stream-json --verbose ...` spawn
                →  stream-json user envelope을 stdin으로 전송
                →  stdout에서 JSONL 이벤트 파싱
                →  각 이벤트마다 progress notification 전송 (idle 타이머 리셋)
                →  집계된 결과 + session id 반환
```

1. MCP 클라이언트가 `claude` 또는 `claude-reply` 도구 호출
2. 서버가 `claude`를 `-p`, `--output-format stream-json`, `--input-format stream-json`, `--verbose` + 사용자 지정 플래그로 spawn
3. 프롬프트는 한 줄 user envelope으로 stdin에 전달 (Windows 8191자 `cmd.exe` 제한 회피)
4. stream-json 이벤트 실시간 파싱 (`system/init`, `system/api_retry`, `system/plugin_install`, `assistant`, `user`, `result`, `rate_limit_event`)
5. 모든 이벤트에 progress notification 전송, idle 타이머 리셋
6. 최종 결과: session id + messages + tool uses + 구조화 error + usage + cost

## 라이선스

MIT
