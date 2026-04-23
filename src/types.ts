/**
 * Types for Claude Code CLI stream-json events and aggregated results.
 *
 * Claude Code CLI `--output-format stream-json` emits newline-delimited JSON.
 * Each object has a `type` field. Schemas were verified empirically in
 * `plans/00-claude-cli-spec.md` against `claude` v2.1.118.
 */

// ---------------------------------------------------------------------------
// Claude Code stream-json event types (subset we explicitly handle)
// ---------------------------------------------------------------------------

export interface SystemInitEvent {
  type: 'system'
  subtype: 'init'
  cwd: string
  session_id: string
  model: string
  permissionMode?: string
  apiKeySource?: string
  tools?: string[]
  mcp_servers?: Array<{ name: string; status: string }>
  slash_commands?: string[]
  agents?: string[]
  skills?: string[]
  plugins?: Array<{ name: string; path: string; source: string }>
  plugin_errors?: Array<{ plugin: string; type: string; message: string }>
  claude_code_version?: string
  output_style?: string
  memory_paths?: { auto?: string }
  fast_mode_state?: 'on' | 'off'
  uuid?: string
}

export interface SystemNotificationEvent {
  type: 'system'
  subtype: 'notification'
  key?: string
  text?: string
  priority?: string
  uuid?: string
  session_id?: string
}

export interface SystemApiRetryEvent {
  type: 'system'
  subtype: 'api_retry'
  attempt: number
  max_retries: number
  retry_delay_ms: number
  error_status: number | null
  error: string
  uuid?: string
  session_id?: string
}

export interface SystemPluginInstallEvent {
  type: 'system'
  subtype: 'plugin_install'
  status: 'started' | 'installed' | 'failed' | 'completed'
  name?: string
  error?: string
  uuid?: string
  session_id?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | { type: string; [key: string]: any }

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: unknown
  is_error?: boolean
}

export interface AssistantEvent {
  type: 'assistant'
  message: {
    id: string
    model: string
    role: 'assistant'
    type: 'message'
    content: ContentBlock[]
    stop_reason: string | null
    stop_sequence: string | null
    stop_details: unknown
    usage?: Record<string, unknown>
    context_management?: unknown
  }
  parent_tool_use_id: string | null
  session_id?: string
  uuid?: string
  /** present on synthetic auth-failure messages, etc. */
  error?: string
}

export interface UserEvent {
  type: 'user'
  message: {
    role: 'user'
    content: ContentBlock[] | string
  }
  parent_tool_use_id: string | null
  session_id?: string
  uuid?: string
  timestamp?: string
  isSynthetic?: boolean
}

export interface ResultEvent {
  type: 'result'
  subtype: string
  is_error: boolean
  api_error_status?: number | null
  duration_ms: number
  duration_api_ms?: number
  num_turns?: number
  stop_reason?: string
  session_id: string
  total_cost_usd?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    [key: string]: unknown
  }
  modelUsage?: Record<string, unknown>
  permission_denials?: unknown[]
  terminal_reason?: string
  fast_mode_state?: 'on' | 'off'
  uuid?: string
  errors?: string[]
  result?: string
}

export interface RateLimitEvent {
  type: 'rate_limit_event'
  rate_limit_info?: {
    status?: string
    resetsAt?: number
    rateLimitType?: string
    overageStatus?: string
    overageResetsAt?: number
    isUsingOverage?: boolean
  }
  uuid?: string
  session_id?: string
}

export interface StreamSubEvent {
  type: 'stream_event'
  event?: unknown
  uuid?: string
  session_id?: string
}

export type ClaudeEvent =
  | SystemInitEvent
  | SystemNotificationEvent
  | SystemApiRetryEvent
  | SystemPluginInstallEvent
  | AssistantEvent
  | UserEvent
  | ResultEvent
  | RateLimitEvent
  | StreamSubEvent

// ---------------------------------------------------------------------------
// Aggregated result from a Claude Code CLI run
// ---------------------------------------------------------------------------

export interface ToolUseRecord {
  id: string
  name: string
  input: unknown
}

export interface ToolResultRecord {
  toolUseId: string
  content: unknown
  isError?: boolean
}

export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export interface ClaudeResult {
  sessionId: string | null
  messages: string[]
  toolUses: ToolUseRecord[]
  toolResults: ToolResultRecord[]
  /** auxiliary error channel: extra context that did not fit into errorMessage */
  errors: string[]

  /** structured failure signal — true if the run failed for any reason */
  isError: boolean
  /** machine-readable error code (assistant.error or result.subtype on failure) */
  errorCode?: string
  /** human-readable error message (result.result or assistant text fallback) */
  errorMessage?: string

  usage: UsageInfo | null
  costUsd: number
  numTurns?: number
  durationMs?: number
  terminalReason?: string
}

// ---------------------------------------------------------------------------
// Options for running Claude Code CLI
// ---------------------------------------------------------------------------

/**
 * Callback for reporting progress during Claude execution.
 * @param progress - incremental event counter
 * @param message - human-readable progress message
 */
export type ProgressCallback = (progress: number, message: string) => void

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type PermissionMode =
  | 'default'
  | 'plan'
  | 'acceptEdits'
  | 'auto'
  | 'dontAsk'
  | 'bypassPermissions'

export interface ClaudeExecOptions {
  prompt: string
  model?: string
  effort?: ReasoningEffort
  permissionMode?: PermissionMode
  cwd?: string
  addDirs?: string[]
  allowedTools?: string[]
  disallowedTools?: string[]
  appendSystemPrompt?: string
  mcpConfig?: string[]
  maxTurns?: number
  bare?: boolean
  timeout?: number
}

export interface ClaudeResumeOptions {
  prompt: string
  sessionId: string
  model?: string
  effort?: ReasoningEffort
  permissionMode?: PermissionMode
  allowedTools?: string[]
  disallowedTools?: string[]
  appendSystemPrompt?: string
  mcpConfig?: string[]
  maxTurns?: number
  forkSession?: boolean
  bare?: boolean
  timeout?: number
}
