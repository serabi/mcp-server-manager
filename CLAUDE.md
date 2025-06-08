# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Server Manager is a web-based GUI tool for managing Model Context Protocol (MCP) servers in Claude and Cursor. It provides a simple interface to enable/disable MCP servers and view their available tools.

## Architecture

The application uses a simple Node.js/Express server architecture:

- **server.js**: Main Express server that serves static files and mounts API routes
- **routes.js**: Contains all API endpoints for config management and server operations
- **app.js**: Frontend JavaScript that handles UI interactions and API calls
- **index.html**: Single-page application interface
- **mcp-server.js**: MCP server implementation that provides the `launch_manager` tool

### Configuration Management

The app manages two separate config files:
- **Cursor config**: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` - stores full server configurations including disabled state
- **Claude config**: `~/Library/Application Support/Claude/claude_desktop_config.json` - stores only enabled servers (disabled servers are filtered out)

The `config.json` file serves as the default configuration template.

### API Endpoints

- `GET /api/cursor-config`: Returns merged configuration from saved settings and defaults
- `GET /api/claude-config`: Returns Claude-specific configuration
- `GET /api/tools`: Returns available tools from enabled servers
- `POST /api/save-configs`: Saves configurations to both Cursor and Claude config files

## Common Development Tasks

### Running the Application
```bash
npm start          # Start production server
npm run dev        # Start with nodemon for development
```

### Project Structure
```
/
├── server.js           # Express server entry point
├── routes.js           # API route handlers
├── app.js             # Frontend JavaScript
├── index.html         # UI interface
├── mcp-server.js      # MCP server implementation
├── config.json        # Server configuration
└── config.example.json # Configuration template
```

### Configuration Flow
1. Default servers are defined in `config.json`
2. User modifications are saved to platform-specific config files
3. Configurations are merged on load, with saved settings taking precedence
4. Only enabled servers are written to Claude's config file