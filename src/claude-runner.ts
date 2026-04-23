/**
 * Core Claude Code CLI subprocess execution and stream-json parsing.
 *
 * Runs `claude -p --output-format stream-json --verbose` as a child process,
 * pipes a stream-json user envelope into stdin, parses JSONL events from
 * stdout line-by-line, and aggregates them into a ClaudeResult.
 *
 * Schemas verified empirically — see `plans/00-claude-cli-spec.md`.
 */

import { spawn } from 'child_process'
import log from './util/logger.js'
import type {
  ClaudeExecOptions,
  ClaudeResumeOptions,
  ClaudeResult,
  ProgressCallback,
} from './types.js'

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

function getTimeoutMs(): number {
  const env = process.env.CLAUDE_TIMEOUT_MS
  if (env) {
    const parsed = parseInt(env, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_TIMEOUT_MS
}

function getClaudeCommand(): string {
  return process.env.CLAUDE_CLI_PATH || 'claude'
}

/**
 * Build a child env that prevents the spawned `claude` from inheriting
 * parent Claude Code state (hooks, plugins, --bare flag, project dir).
 *
 * Without this, a `claude` invocation from within a Claude Code session
 * triggers parent stop hooks and re-injects user messages — see
 * `plans/00-claude-cli-spec.md` §2 (Phase 0 capture 01).
 *
 * Preserves auth env (ANTHROPIC_API_KEY, apiKeyHelper, Bedrock/Vertex/Foundry).
 */
function buildSpawnEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  // Officially documented parent-detection signals
  delete env.CLAUDECODE
  delete env.CLAUDE_CODE_SIMPLE
  // Observed contributors to stop-hook injection (Phase 0 empirical)
  delete env.CLAUDE_CODE_ENTRYPOINT
  delete env.CLAUDE_CODE_SSE_PORT
  delete env.CLAUDE_PROJECT_DIR
  return env
}

/**
 * Common CLI flags shared by exec and resume.
 * Always uses stream-json input to bypass the Windows cmd.exe 8191-char arg
 * limit and to give every prompt a stable transport.
 */
function buildCommonArgs(opts: {
  model?: string
  effort?: string
  permissionMode?: string
  allowedTools?: string[]
  disallowedTools?: string[]
  appendSystemPrompt?: string
  mcpConfig?: string[]
  maxTurns?: number
  bare?: boolean
  addDirs?: string[]
}): string[] {
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
  ]

  if (opts.bare) args.push('--bare')

  if (opts.permissionMode) {
    args.push('--permission-mode', opts.permissionMode)
  } else {
    // Match codex `--full-auto` parity. README warns about #39523.
    args.push('--permission-mode', 'bypassPermissions')
  }

  if (opts.model) args.push('--model', opts.model)
  if (opts.effort) args.push('--effort', opts.effort)
  if (typeof opts.maxTurns === 'number') args.push('--max-turns', String(opts.maxTurns))

  if (opts.appendSystemPrompt) {
    args.push('--append-system-prompt', opts.appendSystemPrompt)
  }

  if (opts.addDirs?.length) {
    args.push('--add-dir', ...opts.addDirs)
  }

  if (opts.allowedTools?.length) {
    args.push('--allowedTools', ...opts.allowedTools)
  }
  if (opts.disallowedTools?.length) {
    args.push('--disallowedTools', ...opts.disallowedTools)
  }

  if (opts.mcpConfig?.length) {
    args.push('--mcp-config', ...opts.mcpConfig)
  }

  return args
}

/** Args for a fresh session. */
function buildExecArgs(opts: ClaudeExecOptions): string[] {
  return buildCommonArgs(opts)
}

/**
 * Args for resuming an existing session.
 * Note: `cwd` cannot be changed (sessions are tied to their original cwd —
 * see plan §6.5 / GitHub issue #5768). Caller must invoke from the same dir.
 */
function buildResumeArgs(opts: ClaudeResumeOptions): string[] {
  const args = buildCommonArgs(opts)
  args.push('--resume', opts.sessionId)
  if (opts.forkSession) args.push('--fork-session')
  return args
}

/** Build the single-line stream-json user envelope written to stdin. */
function buildUserEnvelope(prompt: string): string {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: prompt },
  }) + '\n'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonObject = Record<string, any>

function parseEvent(line: string): JsonObject | null {
  try {
    const parsed = JSON.parse(line)
    if (parsed && typeof parsed.type === 'string') {
      return parsed as JsonObject
    }
    return null
  } catch {
    return null
  }
}

function preview(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

/** Extract a flat text representation from an assistant content array. */
function extractText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && typeof c === 'object' && c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('')
  }
  return ''
}

interface RunClaudeOptions {
  command: string
  args: string[]
  stdinContent: string
  cwd?: string
  overrideTimeoutMs?: number
  onProgress?: ProgressCallback
}

/**
 * Spawn the `claude` CLI and aggregate stream-json events.
 * Idle-based timeout: every parsed event resets the timer.
 */
function runClaude(opts: RunClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const { command, args, stdinContent, cwd, overrideTimeoutMs, onProgress } = opts
    const timeoutMs = overrideTimeoutMs && overrideTimeoutMs > 0 ? overrideTimeoutMs : getTimeoutMs()
    const startTime = Date.now()
    let eventCount = 0

    log.debug('Spawning:', command, args, 'cwd=', cwd ?? '<inherit>')

    // shell: false — pass argv array directly to avoid platform-specific
    // shell quoting issues (cmd.exe `^"` rules, POSIX globbing).
    // On Windows, `shell: false` requires the binary extension to be resolved;
    // Node sets `windowsHide: true` and resolves `.exe`/`.cmd` via PATHEXT
    // when `windowsVerbatimArguments` is left default and command is not a
    // batch file. Native `claude.exe` (the recommended install) works directly.
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: buildSpawnEnv(),
      cwd,
    })

    const result: ClaudeResult = {
      sessionId: null,
      messages: [],
      toolUses: [],
      toolResults: [],
      errors: [],
      isError: false,
      usage: null,
      costUsd: 0,
    }

    let lineBuffer = ''
    let settled = false
    let timer: ReturnType<typeof setTimeout>

    function resetIdleTimer(): void {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!settled) {
          settled = true
          proc.kill('SIGTERM')
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          result.isError = true
          result.errorCode ??= 'idle_timeout'
          result.errorMessage ??= `Idle timeout: no activity for ${timeoutMs / 1000}s (total elapsed: ${elapsed}s)`
          result.errors.push(result.errorMessage)
          resolve(result)
        }
      }, timeoutMs)
    }
    resetIdleTimer()

    function sendProgress(message: string): void {
      if (!onProgress) return
      eventCount++
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      onProgress(eventCount, `[${elapsed}s] ${message}`)
    }

    function captureSessionId(event: JsonObject): void {
      if (!result.sessionId && typeof event.session_id === 'string') {
        result.sessionId = event.session_id
      }
    }

    function processLine(line: string): void {
      const trimmed = line.trim()
      if (!trimmed) return
      const event = parseEvent(trimmed)
      if (!event) {
        log.debug('Unparseable line:', trimmed)
        return
      }
      resetIdleTimer()
      log.debug('Event:', event.type, event.subtype ?? '')

      switch (event.type) {
        case 'system':
          captureSessionId(event)
          switch (event.subtype) {
            case 'init':
              sendProgress(`Session started (${event.session_id}, model: ${event.model})`)
              break
            case 'api_retry':
              sendProgress(
                `Retry ${event.attempt}/${event.max_retries} in ${event.retry_delay_ms}ms (${event.error})`,
              )
              break
            case 'plugin_install':
              sendProgress(
                `Plugin install: ${event.status}${event.name ? ' ' + event.name : ''}${event.error ? ' — ' + event.error : ''}`,
              )
              break
            case 'notification':
              if (event.text) sendProgress(`Notification: ${event.text}`)
              break
            default:
              log.debug('system subtype passthrough:', event.subtype)
              break
          }
          break

        case 'rate_limit_event':
          captureSessionId(event)
          if (event.rate_limit_info) {
            const info = event.rate_limit_info as JsonObject
            sendProgress(`Rate limit: ${info.status} (${info.rateLimitType})`)
          }
          break

        case 'assistant': {
          captureSessionId(event)
          const content = event.message?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (!block || typeof block !== 'object') continue
              if (block.type === 'text' && typeof block.text === 'string' && block.text) {
                result.messages.push(block.text)
                sendProgress(`Message: ${preview(block.text)}`)
              } else if (block.type === 'tool_use' && typeof block.id === 'string') {
                result.toolUses.push({
                  id: block.id,
                  name: typeof block.name === 'string' ? block.name : 'unknown',
                  input: block.input,
                })
                sendProgress(`Tool use: ${block.name}`)
              }
              // thinking / unknown blocks: ignored in v0.1
            }
          }
          // Synthetic auth-failure / other client-side errors
          if (typeof event.error === 'string') {
            result.isError = true
            result.errorCode ??= event.error
            if (!result.errorMessage) {
              result.errorMessage = extractText(content)
            }
          }
          break
        }

        case 'user': {
          captureSessionId(event)
          const content = event.message?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (!block || typeof block !== 'object') continue
              if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
                result.toolResults.push({
                  toolUseId: block.tool_use_id,
                  content: block.content,
                  isError: typeof block.is_error === 'boolean' ? block.is_error : undefined,
                })
              }
            }
          }
          break
        }

        case 'result': {
          captureSessionId(event)
          const usage = event.usage as JsonObject | undefined
          result.usage = usage
            ? {
                inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
                outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
                cacheReadInputTokens:
                  typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0,
                cacheCreationInputTokens:
                  typeof usage.cache_creation_input_tokens === 'number'
                    ? usage.cache_creation_input_tokens
                    : 0,
              }
            : null
          result.costUsd = typeof event.total_cost_usd === 'number' ? event.total_cost_usd : 0
          if (typeof event.num_turns === 'number') result.numTurns = event.num_turns
          if (typeof event.duration_ms === 'number') result.durationMs = event.duration_ms
          if (typeof event.terminal_reason === 'string') result.terminalReason = event.terminal_reason

          // is_error is authoritative — subtype="success" can still have is_error=true (auth fail).
          if (event.is_error) {
            result.isError = true
            if (!result.errorCode) {
              result.errorCode =
                typeof event.subtype === 'string' && event.subtype !== 'success'
                  ? event.subtype
                  : 'unknown_error'
            }
            if (!result.errorMessage) {
              if (typeof event.result === 'string') {
                result.errorMessage = event.result
              } else if (Array.isArray(event.errors)) {
                result.errorMessage = event.errors.join('; ')
              } else {
                result.errorMessage = `Error: ${event.subtype ?? 'unknown'}`
              }
            }
            if (Array.isArray(event.errors)) {
              for (const e of event.errors) {
                if (typeof e === 'string' && e !== result.errorMessage) {
                  result.errors.push(e)
                }
              }
            }
          }
          sendProgress(
            `Result: ${event.subtype} (${event.duration_ms}ms, $${(event.total_cost_usd ?? 0).toFixed(4)})`,
          )
          break
        }

        case 'stream_event':
          // Only emitted with --include-partial-messages (not used in v0.1).
          break

        default:
          log.debug('Unhandled event type:', event.type)
          break
      }
    }

    proc.stdout?.on('data', (data: Buffer) => {
      lineBuffer += data.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''
      for (const line of lines) {
        processLine(line)
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      // stderr activity also resets the idle timer.
      resetIdleTimer()
      log.debug('[claude stderr]', data.toString())
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      // Mark settled BEFORE flushing remainder so a parsed event can't
      // restart the idle timer or fire a stale resolve.
      const wasSettled = settled
      settled = true
      if (lineBuffer.trim()) processLine(lineBuffer)
      // processLine may have called resetIdleTimer; clear any new timer too.
      clearTimeout(timer)
      if (!wasSettled) {
        if (code !== 0 && code !== null && !result.isError) {
          // Process exited non-zero but no stream-json error captured
          result.isError = true
          result.errorCode ??= 'process_exit'
          result.errorMessage ??= `Process exited with code ${code}`
          result.errors.push(result.errorMessage)
        }
        resolve(result)
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(new Error(`Failed to spawn claude: ${err.message}`))
      }
    })

    if (proc.stdin) {
      proc.stdin.write(stdinContent)
      proc.stdin.end()
    }
  })
}

/** Execute a new Claude Code session. */
export async function execClaude(
  options: ClaudeExecOptions,
  onProgress?: ProgressCallback,
): Promise<ClaudeResult> {
  const command = getClaudeCommand()
  const args = buildExecArgs(options)
  log.info('Starting new Claude session')
  return runClaude({
    command,
    args,
    stdinContent: buildUserEnvelope(options.prompt),
    cwd: options.cwd,
    overrideTimeoutMs: options.timeout,
    onProgress,
  })
}

/** Resume an existing Claude Code session by sessionId. */
export async function resumeClaude(
  options: ClaudeResumeOptions,
  onProgress?: ProgressCallback,
): Promise<ClaudeResult> {
  const command = getClaudeCommand()
  const args = buildResumeArgs(options)
  log.info(`Resuming Claude session: ${options.sessionId}`)
  return runClaude({
    command,
    args,
    stdinContent: buildUserEnvelope(options.prompt),
    // Resume must run from the original cwd (issue #5768) — caller's responsibility.
    overrideTimeoutMs: options.timeout,
    onProgress,
  })
}
