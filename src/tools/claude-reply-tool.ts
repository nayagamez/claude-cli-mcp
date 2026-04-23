/**
 * "claude-reply" MCP tool — continue an existing Claude Code CLI session.
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { resumeClaude } from '../claude-runner.js'
import { formatResult } from './format.js'
import log from '../util/logger.js'

const DESCRIPTION = `Continue a Claude Code CLI conversation by providing the session ID from a previous claude call and a follow-up prompt.

Uses \`claude --resume <session-id>\` to load the previous session and continue.

NOTE: Sessions are tied to the directory they were started in (Claude Code issue #5768). The MCP server cannot change the resumed session's working directory — make sure the host process runs from the original cwd, otherwise the session may not be found.`

const schema = {
  prompt: z.string().describe('The follow-up prompt to send to Claude'),
  sessionId: z
    .string()
    .describe('The session ID from a previous claude tool call'),
  model: z
    .string()
    .optional()
    .describe('Model id or alias. Do NOT set unless the user explicitly requests one.'),
  effort: z
    .enum(['low', 'medium', 'high', 'xhigh', 'max'])
    .optional()
    .describe('Reasoning effort. Auto-select based on task complexity.'),
  permissionMode: z
    .enum(['default', 'plan', 'acceptEdits', 'auto', 'dontAsk', 'bypassPermissions'])
    .optional()
    .describe('Permission mode. Whether resume honors mid-session changes is experimental — see plan §6.5.'),
  allowedTools: z
    .array(z.string())
    .optional()
    .describe('Tools Claude may use without permission prompt (e.g. ["Bash(git *)", "Edit"]).'),
  disallowedTools: z
    .array(z.string())
    .optional()
    .describe('Tools Claude must not use.'),
  appendSystemPrompt: z
    .string()
    .optional()
    .describe('Text appended to the default system prompt.'),
  mcpConfig: z
    .array(z.string())
    .optional()
    .describe('MCP server config files or JSON strings (--mcp-config, repeatable).'),
  maxTurns: z
    .number()
    .optional()
    .describe('Limit the number of agentic turns (--max-turns).'),
  forkSession: z
    .boolean()
    .optional()
    .describe('Create a new session ID instead of reusing the original (--fork-session).'),
  bare: z
    .boolean()
    .optional()
    .describe('Run with --bare. Requires ANTHROPIC_API_KEY or apiKeyHelper.'),
  timeout: z
    .number()
    .optional()
    .describe('Idle timeout in milliseconds (default: 600000 = 10 min).'),
}

export function registerClaudeReplyTool(server: McpServer): void {
  server.tool('claude-reply', DESCRIPTION, schema, async (input, extra) => {
    try {
      const progressToken = extra._meta?.progressToken
      const onProgress =
        progressToken !== undefined
          ? (progress: number, message: string) => {
              extra
                .sendNotification({
                  method: 'notifications/progress' as const,
                  params: { progressToken, progress, message },
                })
                .catch(() => {}) // best-effort
            }
          : undefined

      const result = await resumeClaude(input, onProgress)
      const text = formatResult(result)

      return {
        content: [{ type: 'text' as const, text }],
        ...(result.isError && { isError: true }),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('claude-reply tool error:', message)
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      }
    }
  })
}
