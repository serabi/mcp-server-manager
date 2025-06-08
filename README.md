# MCP Server Manager

> **Note**: This project is inspired by and builds upon [MediaPublishing/mcp-manager](https://github.com/MediaPublishing/mcp-manager). This version adds configurable paths, cross-platform support, and improved security features.

A web-based GUI tool for managing Model Context Protocol (MCP) servers in Claude and Cursor. This tool allows you to easily enable/disable MCP servers and their tools through a user-friendly interface.

## Features

- Enable/disable MCP servers with simple toggle switches
- **Configurable config file paths** - Use environment variables to specify custom locations
- View available tools for each server
- **Automatic backup creation** - Backups are created automatically when saving changes
- **Backup management** - View and restore from any previous backup with timestamp information
- **App-specific backup handling** - Separate backup management for Claude and Cursor configurations
- Responsive design that works on any screen size



## Installation

1. Clone this repository:
```bash
git clone https://github.com/serabi/mcp-server-manager.git
cd mcp-server-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create a configuration file:
```bash
cp config.example.json config.json
```

4. Start the server:
```bash
npm start
```

5. Open http://localhost:3456 in your browser

## Importing Existing Configuration

If you already have MCP servers configured in Claude or Cursor, you can import them into the server library during startup:

```bash
# Interactive import mode
npm run start:import

# Or using the flag directly
npm start -- --import
```

This will:
- Scan your existing Claude and Cursor configuration files
- Show you which servers are available to import
- Let you select which configuration to import from
- Merge the imported servers with your existing server library
- Preserve your current library while adding new servers

The import tool will show you:
- How many servers each config file contains
- Which servers would be added vs. updated
- A confirmation before making any changes

## Configuration

The MCP Server Manager uses a main configuration file and automatically detects platform-specific config locations:

- `config.json`: Main configuration file for the server
- Platform config files (auto-detected based on your OS):
  - **macOS**: 
    - Claude: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - Cursor: `~/.cursor/mcp.json`
  - **Windows**: 
    - Claude: `~/AppData/Roaming/Claude/claude_desktop_config.json`
    - Cursor: `~/.cursor/mcp.json`
  - **Linux**: 
    - Claude: `~/.config/Claude/claude_desktop_config.json`
    - Cursor: `~/.cursor/mcp.json`

### Custom Configuration Paths

For testing or non-standard setups, you can override the default paths using environment variables:

```bash
export CURSOR_CONFIG_PATH="/path/to/custom/cursor/config.json"
export CLAUDE_CONFIG_PATH="/path/to/custom/claude/config.json"
npm start
```

### Example Configuration

```json
{
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    },
    "brave-search": {
      "command": "node",
      "args": ["/path/to/brave-search/dist/index.js"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    },
    "github": {
      "command": "node",
      "args": ["/path/to/github/dist/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
      }
    },
    "perplexity": {
      "command": "node",
      "args": ["/path/to/perplexity/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-perplexity-api-key"
      }
    }
  }
}
```
## Server Commands

### Allowed Commands
- `node` - For Node.js MCP servers
- `python` / `python3` - For Python MCP servers  
- `npx` / `npm` - For npm package-based servers

### Allowed Script Extensions
- `.js`, `.mjs` - JavaScript/ES modules
- `.py` - Python scripts
- `.ts`, `.mts` - TypeScript files

## Usage

1. Launch the MCP Server Manager
2. Navigate between tabs:
   - **Servers Library**: Manage your MCP server configurations
   - **Claude**: View active Claude configuration
   - **Cursor**: View active Cursor configuration  
   - **Backups**: View and restore from previous backups
3. Use the toggle switches to enable/disable servers for each platform
4. Click "Save Changes" to apply your changes (this automatically creates a backup)
5. Restart Claude or Cursor to activate the new configuration

### Backup Management

The application automatically creates backups of your configurations whenever you save changes. To manage backups:

1. Click the **Backups** tab to view all available backups
2. Backups are organized by platform (Claude and Cursor) and sorted by date
3. Click "Restore This Backup" on any backup to restore that specific configuration
4. Backups are stored alongside your configuration files with timestamps:
   - Claude backups: `claude_desktop_config.json.backup.{timestamp}`
   - Cursor backups: `mcp.json.backup.{timestamp}`

You can also access backup functionality from the Claude and Cursor tabs using the "See and Restore Backups" button.

## Keywords

- Model Context Protocol (MCP)
- Claude AI
- Anthropic Claude
- Cursor Editor
- MCP Server Management
- Claude Configuration
- AI Tools Management
- Claude Extensions
- MCP Tools
- AI Development Tools

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Attribution

This project is inspired by and builds upon [MediaPublishing/mcp-manager](https://github.com/MediaPublishing/mcp-manager). Key enhancements in this version include:

- Configurable configuration file paths via environment variables
- Cross-platform path detection (macOS, Windows, Linux)
- Enhanced security with path validation
- Automatic backup creation and management system
- Advanced backup restoration with timestamp-based selection
- Platform-specific configuration management for Claude and Cursor


## Acknowledgments

- Original project: [MediaPublishing/mcp-manager](https://github.com/MediaPublishing/mcp-manager)
- Built for use with Anthropic's Claude AI
- Compatible with the Cursor editor
- Uses the Model Context Protocol (MCP)
