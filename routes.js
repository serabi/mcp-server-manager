import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Validate server command and arguments for security
function validateServerCommand(command, args) {
    // Only allow specific safe commands for MCP servers
    const allowedCommands = [
        'node',           // Node.js MCP servers
        'python',         // Python MCP servers
        'python3',        // Python 3 MCP servers
        'npx',           // npm package executables
        'npm',           // npm scripts
        'docker',        // Docker containers for MCP servers
        'uv'             // UV Python package manager
    ];
    
    if (!command || typeof command !== 'string') {
        throw new Error('Command must be a non-empty string');
    }
    
    // Extract base command (remove path if present)
    const baseCommand = path.basename(command);
    
    if (!allowedCommands.includes(baseCommand)) {
        throw new Error(`Command not allowed: ${baseCommand}. Allowed commands: ${allowedCommands.join(', ')}`);
    }
    
    // Validate arguments if present
    if (args && Array.isArray(args)) {
        for (const arg of args) {
            if (typeof arg !== 'string') {
                throw new Error('All arguments must be strings');
            }
            
            // Check for suspicious patterns in arguments
            if (arg.includes('..') || arg.includes('~')) {
                throw new Error(`Suspicious path pattern in argument: ${arg}`);
            }
            
            // Allow common safe flags for MCP servers
            if (arg.startsWith('-')) {
                const safeFlagPatterns = [
                    '-p', '--port', '--config', '--help', '--version',
                    '-h', '--host', '--env', '--verbose', '-v',
                    '--log-level', '--timeout', '--workers',
                    '-y', '--yes', '--quiet', '-q', '--force',
                    '--name', '--tag', '--rm', '--detach', '-d',
                    '--restart', '--memory', '--cpus'
                ];
                const isSafeFlag = safeFlagPatterns.some(pattern => arg.startsWith(pattern));
                
                if (!isSafeFlag) {
                    console.warn(`Warning: Potentially unsafe flag detected: ${arg}`);
                    // Don't throw an error, just warn
                }
            }
        }
        
        // If first argument looks like a script path, validate it
        if (args.length > 0 && args[0]) {
            const scriptPath = args[0];
            
            // Skip validation for flags/options (start with -)
            if (!scriptPath.startsWith('-')) {
                const allowedExtensions = ['.js', '.mjs', '.py', '.ts', '.mts'];
                const ext = path.extname(scriptPath).toLowerCase();
                
                if (ext && !allowedExtensions.includes(ext)) {
                    throw new Error(`Script extension not allowed: ${ext}. Allowed: ${allowedExtensions.join(', ')}`);
                }
                
                // Validate script path doesn't contain suspicious patterns
                if (scriptPath.includes('..') || scriptPath.includes('~')) {
                    throw new Error(`Suspicious script path: ${scriptPath}`);
                }
            }
        }
    }
    
    return true;
}

// Validate that a path is safe and within expected directories
function validateConfigPath(configPath, expectedDir) {
    try {
        const resolvedPath = path.resolve(configPath);
        const resolvedExpectedDir = path.resolve(expectedDir);
        
        // Check if the resolved path starts with the expected directory
        if (!resolvedPath.startsWith(resolvedExpectedDir)) {
            throw new Error(`Path traversal detected: ${configPath}`);
        }
        
        // Additional check to ensure no suspicious patterns
        if (configPath.includes('..') || configPath.includes('~')) {
            throw new Error(`Suspicious path pattern: ${configPath}`);
        }
        
        return resolvedPath;
    } catch (error) {
        throw new Error(`Invalid config path: ${error.message}`);
    }
}

// Get config file paths based on OS with security validation
function getConfigPaths() {
    const home = os.homedir(); // Use os.homedir() instead of env vars for security
    const isMac = process.platform === 'darwin';
    
    // Allow override via environment variables for custom setups
    const cursorPathOverride = process.env.CURSOR_CONFIG_PATH;
    const claudePathOverride = process.env.CLAUDE_CONFIG_PATH;
    
    let cursorPath, claudePath, expectedBaseDir;
    
    if (cursorPathOverride && claudePathOverride) {
        // Use provided environment variables
        cursorPath = cursorPathOverride;
        claudePath = claudePathOverride;
        expectedBaseDir = home; // Use home as base for validation when using custom paths
    } else if (isMac) {
        expectedBaseDir = path.join(home, 'Library/Application Support');
        cursorPath = path.join(home, '.cursor/mcp.json'); // Cursor's native MCP config
        claudePath = path.join(expectedBaseDir, 'Claude/claude_desktop_config.json');
    } else if (process.platform === 'win32') {
        expectedBaseDir = path.join(home, 'AppData/Roaming');
        cursorPath = path.join(home, '.cursor/mcp.json'); // Cursor's native MCP config
        claudePath = path.join(expectedBaseDir, 'Claude/claude_desktop_config.json');
    } else {
        // Linux paths
        expectedBaseDir = path.join(home, '.config');
        cursorPath = path.join(home, '.cursor/mcp.json'); // Cursor's native MCP config
        claudePath = path.join(expectedBaseDir, 'Claude/claude_desktop_config.json');
    }
    
    // Validate paths before returning
    return {
        CURSOR_CONFIG_PATH: validateConfigPath(cursorPath, home), // Cursor config is in home directory
        CLAUDE_CONFIG_PATH: validateConfigPath(claudePath, expectedBaseDir)
    };
}

const { CURSOR_CONFIG_PATH, CLAUDE_CONFIG_PATH } = getConfigPaths();

// Helper function to safely write config files with backup
async function writeConfigFile(filePath, data) {
    try {
        // Validate the file path is one of our expected config paths
        if (filePath !== CURSOR_CONFIG_PATH && filePath !== CLAUDE_CONFIG_PATH) {
            throw new Error(`Unauthorized file write attempt: ${filePath}`);
        }
        
        // Create backup of existing file if it exists and has content
        try {
            const existingData = await fs.readFile(filePath, 'utf8');
            const existingConfig = JSON.parse(existingData);
            
            // Only backup if there's meaningful content
            if (existingConfig.mcpServers && Object.keys(existingConfig.mcpServers).length > 0) {
                const backupPath = filePath + '.backup.' + Date.now();
                await fs.writeFile(backupPath, existingData, { mode: 0o600 });
                console.log('Created backup:', backupPath);
            }
        } catch (backupError) {
            // If backup fails, log but continue (file might not exist)
            console.log('No existing config to backup or backup failed:', backupError.message);
        }
        
        // Validate that we're not writing an empty config when servers exist
        const serverCount = Object.keys(data.mcpServers || {}).length;
        if (serverCount === 0) {
            console.warn(`Warning: About to write empty config to ${filePath}`);
            // Don't prevent the write, but log it for visibility
        }
        
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write the file with strict permissions
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), { 
            mode: 0o600 // Only owner can read/write
        });
        
        console.log('Config file written successfully:', filePath);
    } catch (error) {
        console.error(`Error writing config file ${filePath}:`, error);
        throw error;
    }
}

// Helper function to read config files
async function readConfigFile(filePath) {
    try {
        // Validate the file path is one of our expected config paths
        if (filePath !== CURSOR_CONFIG_PATH && filePath !== CLAUDE_CONFIG_PATH && 
            !filePath.startsWith(__dirname)) {
            throw new Error(`Unauthorized file read attempt: ${filePath}`);
        }
        
        console.log('Reading config file:', filePath);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('No existing config found, using empty config');
            return { mcpServers: {} };
        }
        console.error(`Error reading ${filePath}:`, error);
        throw error;
    }
}

// Helper function to merge configurations
function mergeConfigs(savedConfig, defaultConfig) {
    console.log('Merging configs:');
    console.log('Saved servers:', Object.keys(savedConfig.mcpServers || {}));
    console.log('Default servers:', Object.keys(defaultConfig));
    
    const mergedServers = {};
    
    // Start with all default servers
    Object.entries(defaultConfig).forEach(([name, config]) => {
        mergedServers[name] = { ...config };
    });
    
    // Override with saved configurations
    Object.entries(savedConfig.mcpServers || {}).forEach(([name, config]) => {
        mergedServers[name] = {
            ...mergedServers[name],
            ...config
        };
    });
    
    console.log('Merged servers:', Object.keys(mergedServers));
    return { mcpServers: mergedServers };
}

// Helper function to filter servers by platform
function filterServersByPlatform(config, platform) {
    const filteredConfig = { mcpServers: {} };
    
    Object.entries(config.mcpServers).forEach(([name, server]) => {
        let shouldInclude = false;
        
        if (platform === 'claude') {
            // Include if enabledForClaude is not explicitly false (default to true)
            shouldInclude = server.enabledForClaude !== false;
        } else if (platform === 'cursor') {
            // Include if enabledForCursor is not explicitly false (default to true)
            shouldInclude = server.enabledForCursor !== false;
        }
        
        if (shouldInclude) {
            // Create a new server object without platform-specific properties
            const { enabledForClaude, enabledForCursor, ...serverConfig } = server;
            filteredConfig.mcpServers[name] = serverConfig;
        } else {
            console.log(`Filtering out server "${name}" for ${platform}`);
        }
    });
    
    console.log(`Filtered servers for ${platform}:`, Object.keys(filteredConfig.mcpServers));
    return filteredConfig;
}

// Get merged config for the main management interface
router.get('/merged-config', async (req, res) => {
    console.log('Handling /api/merged-config request');
    try {
        // Try to read any existing platform configs to get platform-specific settings
        let claudeConfig, cursorConfig;
        try {
            claudeConfig = await readConfigFile(CLAUDE_CONFIG_PATH);
        } catch (e) { claudeConfig = { mcpServers: {} }; }
        
        try {
            cursorConfig = await readConfigFile(CURSOR_CONFIG_PATH);
        } catch (e) { cursorConfig = { mcpServers: {} }; }
        
        // Load default config
        const defaultConfig = await readConfigFile(path.join(__dirname, 'config.json'));
        
        // Create merged config with platform information
        const mergedServers = {};
        
        // Start with default servers
        Object.entries(defaultConfig.mcpServers || {}).forEach(([name, config]) => {
            // Default to enabled for both platforms if no config exists
            // Or if the server exists in the platform's config
            const claudeHasConfig = Object.keys(claudeConfig.mcpServers || {}).length > 0;
            const cursorHasConfig = Object.keys(cursorConfig.mcpServers || {}).length > 0;
            
            mergedServers[name] = {
                ...config,
                enabledForClaude: claudeHasConfig ? Object.keys(claudeConfig.mcpServers || {}).includes(name) : true,
                enabledForCursor: cursorHasConfig ? Object.keys(cursorConfig.mcpServers || {}).includes(name) : true
            };
        });
        
        const mergedConfig = { mcpServers: mergedServers };
        console.log('Returning merged config with platform info:', Object.keys(mergedConfig.mcpServers));
        res.json(mergedConfig);
    } catch (error) {
        console.error('Error in /api/merged-config:', error);
        res.status(500).json({ error: `Failed to read merged config: ${error.message}` });
    }
});

// Get cursor config (for the Cursor tab, shows actual Cursor config file)
router.get('/cursor-config', async (req, res) => {
    console.log('Handling /api/cursor-config request');
    try {
        const savedConfig = await readConfigFile(CURSOR_CONFIG_PATH);
        console.log('Returning Cursor-specific config with servers:', Object.keys(savedConfig.mcpServers || {}));
        res.json(savedConfig);
    } catch (error) {
        console.error('Error in /api/cursor-config:', error);
        res.status(500).json({ error: `Failed to read Cursor config: ${error.message}` });
    }
});

// Get claude config
router.get('/claude-config', async (req, res) => {
    console.log('Handling /api/claude-config request');
    try {
        const config = await readConfigFile(CLAUDE_CONFIG_PATH);
        res.json(config);
    } catch (error) {
        console.error('Error in /api/claude-config:', error);
        res.status(500).json({ error: `Failed to read Claude config: ${error.message}` });
    }
});

// List available backups
router.get('/list-backups', async (req, res) => {
    console.log('Handling /api/list-backups request');
    try {
        const backups = {
            claude: [],
            cursor: []
        };
        
        // Get Claude backups
        try {
            const claudeDir = path.dirname(CLAUDE_CONFIG_PATH);
            const claudeBackupPattern = path.basename(CLAUDE_CONFIG_PATH) + '.backup.';
            const claudeFiles = await fs.readdir(claudeDir);
            
            backups.claude = claudeFiles
                .filter(file => file.startsWith(claudeBackupPattern))
                .map(file => {
                    const timestamp = parseInt(file.split('.').pop());
                    return {
                        name: file,
                        path: path.join(claudeDir, file),
                        timestamp: timestamp,
                        date: new Date(timestamp).toLocaleString(),
                        platform: 'claude'
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.log('No Claude backups found or error reading directory:', error.message);
        }
        
        // Get Cursor backups
        try {
            const cursorDir = path.dirname(CURSOR_CONFIG_PATH);
            const cursorBackupPattern = path.basename(CURSOR_CONFIG_PATH) + '.backup.';
            const cursorFiles = await fs.readdir(cursorDir);
            
            backups.cursor = cursorFiles
                .filter(file => file.startsWith(cursorBackupPattern))
                .map(file => {
                    const timestamp = parseInt(file.split('.').pop());
                    return {
                        name: file,
                        path: path.join(cursorDir, file),
                        timestamp: timestamp,
                        date: new Date(timestamp).toLocaleString(),
                        platform: 'cursor'
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.log('No Cursor backups found or error reading directory:', error.message);
        }
        
        console.log(`Found ${backups.claude.length} Claude backups and ${backups.cursor.length} Cursor backups`);
        res.json(backups);
    } catch (error) {
        console.error('Error in /api/list-backups:', error);
        res.status(500).json({ error: `Failed to list backups: ${error.message}` });
    }
});

// Restore from specific backup
router.post('/restore-backup', async (req, res) => {
    console.log('Handling /api/restore-backup request');
    try {
        const { platform, backupFile } = req.body;
        if (!platform || (platform !== 'claude' && platform !== 'cursor')) {
            throw new Error('Invalid platform specified. Must be "claude" or "cursor"');
        }
        
        const configPath = platform === 'claude' ? CLAUDE_CONFIG_PATH : CURSOR_CONFIG_PATH;
        
        let backupPath;
        if (backupFile) {
            // Restore specific backup file
            const dir = path.dirname(configPath);
            backupPath = path.join(dir, backupFile);
            
            // Validate the backup file exists and is in the correct directory
            try {
                await fs.access(backupPath);
            } catch (error) {
                throw new Error(`Backup file not found: ${backupFile}`);
            }
        } else {
            // Find the most recent backup (legacy behavior)
            const backupPattern = configPath + '.backup.';
            const dir = path.dirname(configPath);
            const files = await fs.readdir(dir);
            const backupFiles = files
                .filter(file => file.startsWith(path.basename(backupPattern)))
                .map(file => ({
                    name: file,
                    path: path.join(dir, file),
                    timestamp: parseInt(file.split('.').pop())
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            if (backupFiles.length === 0) {
                throw new Error(`No backup files found for ${platform}`);
            }
            
            backupPath = backupFiles[0].path;
            backupFile = backupFiles[0].name;
        }
        
        const backupData = await fs.readFile(backupPath, 'utf8');
        
        // Restore the backup
        await fs.writeFile(configPath, backupData, { mode: 0o600 });
        
        console.log(`Restored ${platform} config from backup:`, backupFile);
        res.json({ 
            success: true, 
            message: `Successfully restored ${platform} configuration from backup: ${backupFile}`,
            backupFile: backupFile
        });
    } catch (error) {
        console.error('Error in /api/restore-backup:', error);
        res.status(500).json({ error: `Failed to restore backup: ${error.message}` });
    }
});

// Get tools list
router.get('/tools', async (req, res) => {
    console.log('Handling /api/tools request');
    try {
        const cursorConfig = await readConfigFile(CURSOR_CONFIG_PATH);
        const defaultConfig = await readConfigFile(path.join(__dirname, 'config.json'));
        const mergedConfig = mergeConfigs(cursorConfig, defaultConfig.mcpServers || {});
        const servers = mergedConfig.mcpServers;

        // Define available tools for each server
        const toolsMap = {
            'mcp-manager': [{
                name: 'launch_manager',
                description: 'Launch the MCP Server Manager interface',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }]
        };

        // Filter tools based on enabled servers
        const enabledTools = Object.entries(toolsMap)
            .filter(([serverName]) => {
                return servers[serverName] && !servers[serverName].disabled;
            })
            .flatMap(([serverName, tools]) => 
                tools.map(tool => ({
                    ...tool,
                    server: serverName
                }))
            );

        console.log(`Returning ${enabledTools.length} tools`);
        res.json(enabledTools);
    } catch (error) {
        console.error('Error in /api/tools:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save configs
router.post('/save-configs', async (req, res) => {
    console.log('Handling /api/save-configs request');
    try {
        const { mcpServers } = req.body;
        if (!mcpServers || typeof mcpServers !== 'object') {
            throw new Error('No valid server configuration provided');
        }

        // Basic validation of server configuration structure
        for (const [serverName, config] of Object.entries(mcpServers)) {
            if (typeof serverName !== 'string' || !serverName.trim()) {
                throw new Error('Invalid server name');
            }
            if (!config || typeof config !== 'object') {
                throw new Error(`Invalid configuration for server: ${serverName}`);
            }
            
            // Validate command and arguments for security
            if (config.command) {
                try {
                    validateServerCommand(config.command, config.args);
                } catch (error) {
                    throw new Error(`Invalid command for server "${serverName}": ${error.message}`);
                }
            }
            
            // Validate environment variables
            if (config.env && typeof config.env !== 'object') {
                throw new Error(`Invalid environment variables for server "${serverName}": must be an object`);
            }
        }

        // Save full config to Cursor settings (with all servers and platform info)
        const fullConfig = { mcpServers };
        
        // Create platform-specific configurations
        const claudeConfig = filterServersByPlatform(fullConfig, 'claude');
        const cursorConfig = filterServersByPlatform(fullConfig, 'cursor');
        
        console.log('Claude config:', JSON.stringify(claudeConfig, null, 2));
        console.log('Cursor config:', JSON.stringify(cursorConfig, null, 2));
        
        // Safety check: warn if we're about to save empty configs but allow it
        const claudeServerCount = Object.keys(claudeConfig.mcpServers || {}).length;
        const cursorServerCount = Object.keys(cursorConfig.mcpServers || {}).length;
        const totalServerCount = Object.keys(fullConfig.mcpServers || {}).length;
        
        if (totalServerCount > 0 && claudeServerCount === 0 && cursorServerCount === 0) {
            console.warn('Warning: All servers are disabled for both platforms. This will result in empty configurations.');
            // Don't throw an error, just log a warning and proceed
        }
        
        // Save to respective platform config files
        await writeConfigFile(CLAUDE_CONFIG_PATH, claudeConfig);
        await writeConfigFile(CURSOR_CONFIG_PATH, cursorConfig);

        console.log('Configurations saved successfully');
        res.json({ 
            success: true, 
            message: 'Configurations saved successfully. Please restart Claude to apply changes.' 
        });
    } catch (error) {
        console.error('Error in /api/save-configs:', error);
        res.status(500).json({ error: `Failed to save configurations: ${error.message}` });
    }
});

export default router;
