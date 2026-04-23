/**
 * "claude" MCP tool — start a new Claude Code CLI session.
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { execClaude } from '../claude-runner.js'
import { formatResult } from './format.js'
import log from '../util/logger.js'

const DESCRIPTION = `Run a Claude Code CLI session. Executes \`claude -p --output-format stream-json\` as a subprocess and returns the result.

Use this tool to start a new coding task with Claude Code. The response includes a Session ID that can be used with the claude-reply tool to continue the conversation.

WARNING: defaults to permission mode \`bypassPermissions\` (parity with codex --full-auto). Use a safer mode (e.g. \`acceptEdits\` or \`auto\`) for sensitive workspaces.`

const schema = {
  prompt: z.string().describe('The prompt to send to Claude'),
  model: z
    .string()
    .optional()
    .describe(
      'Model id or alias (e.g. "sonnet", "opus", "claude-sonnet-4-6"). Do NOT set this unless the user explicitly requests a specific model.',
    ),
  effort: z
    .enum(['low', 'medium', 'high', 'xhigh', 'max'])
    .optional()
    .describe(
      'Reasoning effort. Auto-select based on task complexity: low/medium for simple tasks, high for moderate, xhigh/max for complex multi-file work. Do NOT set if the user has not asked for a specific level.',
    ),
  permissionMode: z
    .enum(['default', 'plan', 'acceptEdits', 'auto', 'dontAsk', 'bypassPermissions'])
    .optional()
    .describe(
      'Permission mode. Defaults to "bypassPermissions" (parity with codex --full-auto). Use "acceptEdits" or "auto" for safer behavior.',
    ),
  cwd: z
    .string()
    .optional()
    .describe('Working directory for the Claude session'),
  addDirs: z
    .array(z.string())
    .optional()
    .describe('Additional directories Claude can read/edit (--add-dir).'),
  allowedTools: z
    .array(z.string())
    .optional()
    .describe(
      'Tools Claude may use without permission prompt (e.g. ["Bash(git *)", "Edit"]). See Claude permission rule syntax.',
    ),
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
    .describe('Limit the number of agentic turns (--max-turns). Headless safety stop.'),
  bare: z
    .boolean()
    .optional()
    .describe(
      'Run with --bare (skip hooks/skills/plugins/MCP/CLAUDE.md). NOTE: requires ANTHROPIC_API_KEY or apiKeyHelper — Pro/Max OAuth users will fail to authenticate.',
    ),
  timeout: z
    .number()
    .optional()
    .describe('Idle timeout in milliseconds (default: 600000 = 10 min). Resets on every event.'),
}

export function registerClaudeTool(server: McpServer): void {
  server.tool('claude', DESCRIPTION, schema, async (input, extra) => {
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

      const result = await execClaude(input, onProgress)
      const text = formatResult(result)

      return {
        content: [{ type: 'text' as const, text }],
        ...(result.isError && { isError: true }),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('claude tool error:', message)
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      }
    }
  })
}
