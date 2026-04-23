#!/usr/bin/env node
/**
 * Claude Code MCP Server — entrypoint.
 *
 * Exposes Claude Code CLI (claude -p) as MCP tools via stdio transport.
 * stdout is reserved for JSON-RPC; all diagnostics go to stderr.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerClaudeTool } from './tools/claude-tool.js'
import { registerClaudeReplyTool } from './tools/claude-reply-tool.js'
import log from './util/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'))

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'claude',
    version: pkg.version,
  })

  registerClaudeTool(server)
  registerClaudeReplyTool(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  log.info('Server started on stdio transport')
}

main().catch((err) => {
  log.error('Fatal error:', err)
  process.exit(1)
})
