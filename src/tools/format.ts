/**
 * Format a ClaudeResult into markdown text for MCP tool responses.
 */

import type { ClaudeResult } from '../types.js'

export function formatResult(result: ClaudeResult): string {
  const sections: string[] = []

  // Session ID (always include for claude-reply usage)
  if (result.sessionId) {
    sections.push(`**Session ID:** \`${result.sessionId}\``)
  }

  // Agent messages (main response)
  if (result.messages.length > 0) {
    sections.push(result.messages.join('\n\n'))
  }

  // Tool uses
  if (result.toolUses.length > 0) {
    const lines = result.toolUses.map((t) => {
      const inputStr =
        typeof t.input === 'string' ? t.input : JSON.stringify(t.input, null, 2)
      return `**Tool:** \`${t.name}\`\n\`\`\`json\n${inputStr}\n\`\`\``
    })
    sections.push('### Tool Uses\n\n' + lines.join('\n\n'))
  }

  // Structured error (auth_failed, error_max_turns, etc.)
  if (result.isError) {
    const lines: string[] = []
    if (result.errorCode) lines.push(`**Code:** \`${result.errorCode}\``)
    if (result.errorMessage) lines.push(`**Message:** ${result.errorMessage}`)
    if (result.terminalReason) lines.push(`**Terminal reason:** ${result.terminalReason}`)
    sections.push('### Error\n\n' + lines.join('\n'))
  }

  // Auxiliary errors (anything that didn't fit the structured fields)
  if (result.errors.length > 0) {
    sections.push(
      '### Additional error context\n\n' + result.errors.map((e) => `- ${e}`).join('\n'),
    )
  }

  // Usage + cost
  if (result.usage) {
    const u = result.usage
    const costStr = result.costUsd > 0 ? ` ($${result.costUsd.toFixed(4)})` : ''
    const cacheStr =
      u.cacheReadInputTokens || u.cacheCreationInputTokens
        ? `, ${u.cacheReadInputTokens} cache-read, ${u.cacheCreationInputTokens} cache-write`
        : ''
    const turnsStr = result.numTurns ? `, ${result.numTurns} turns` : ''
    const durStr = result.durationMs ? `, ${result.durationMs}ms` : ''
    sections.push(
      `**Usage:** ${u.inputTokens} input, ${u.outputTokens} output${cacheStr}${turnsStr}${durStr}${costStr}`,
    )
  }

  return sections.join('\n\n---\n\n') || 'No output from Claude.'
}
