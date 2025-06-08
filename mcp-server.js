#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class McpManagerServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-manager-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'launch_manager',
          description: 'Launch the MCP Server Manager interface',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'launch_manager') {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      // Start the express server if not running
      const serverPath = join(__dirname, 'server.js');
      
      // Use spawn instead of exec to prevent command injection
      const child = spawn('node', [serverPath], {
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref(); // Allow parent process to exit independently
      
      child.on('error', (error) => {
        console.error(`Error starting server: ${error.message}`);
      });

      return {
        content: [
          {
            type: 'text',
            text: 'MCP Manager launched at http://localhost:3456',
          },
        ],
      };
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Manager Server running on stdio');
  }
}

const server = new McpManagerServer();
server.run().catch(console.error);
