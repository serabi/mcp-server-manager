import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import os from 'os';
import readline from 'readline';
import apiRoutes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3456;

// Parse command line arguments
const args = process.argv.slice(2);
const shouldImport = args.includes('--import') || args.includes('-i');

// Helper function to get config file paths (copied from routes.js logic)
function getConfigPaths() {
    const home = os.homedir();
    const isMac = process.platform === 'darwin';
    
    if (isMac) {
        return {
            CURSOR_CONFIG_PATH: path.join(home, '.cursor/mcp.json'),
            CLAUDE_CONFIG_PATH: path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json')
        };
    } else if (process.platform === 'win32') {
        return {
            CURSOR_CONFIG_PATH: path.join(home, '.cursor/mcp.json'),
            CLAUDE_CONFIG_PATH: path.join(home, 'AppData/Roaming/Claude/claude_desktop_config.json')
        };
    } else {
        return {
            CURSOR_CONFIG_PATH: path.join(home, '.cursor/mcp.json'),
            CLAUDE_CONFIG_PATH: path.join(home, '.config/Claude/claude_desktop_config.json')
        };
    }
}

// Helper function to read config file safely
async function readConfigFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { mcpServers: {} };
        }
        throw error;
    }
}

// Helper function to write config file
async function writeConfigFile(filePath, data) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// Interactive import function
async function importConfigInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    try {
        console.log('\nMCP Server Import Tool');
        console.log('======================');

        const { CURSOR_CONFIG_PATH, CLAUDE_CONFIG_PATH } = getConfigPaths();
        const configJsonPath = path.join(__dirname, 'config.json');

        // Check which config files exist
        const availableConfigs = [];
        
        try {
            const cursorConfig = await readConfigFile(CURSOR_CONFIG_PATH);
            if (Object.keys(cursorConfig.mcpServers || {}).length > 0) {
                availableConfigs.push({
                    name: 'Cursor config',
                    path: CURSOR_CONFIG_PATH,
                    servers: Object.keys(cursorConfig.mcpServers),
                    config: cursorConfig
                });
            }
        } catch (e) {
            console.log('Warning: Cursor config not readable:', e.message);
        }

        try {
            const claudeConfig = await readConfigFile(CLAUDE_CONFIG_PATH);
            if (Object.keys(claudeConfig.mcpServers || {}).length > 0) {
                availableConfigs.push({
                    name: 'Claude config',
                    path: CLAUDE_CONFIG_PATH,
                    servers: Object.keys(claudeConfig.mcpServers),
                    config: claudeConfig
                });
            }
        } catch (e) {
            console.log('Warning: Claude config not readable:', e.message);
        }

        if (availableConfigs.length === 0) {
            console.log('No existing config files with MCP servers found.');
            console.log('Config files checked:');
            console.log(`- Cursor: ${CURSOR_CONFIG_PATH}`);
            console.log(`- Claude: ${CLAUDE_CONFIG_PATH}`);
            return;
        }

        console.log('\nAvailable config files to import from:');
        availableConfigs.forEach((config, index) => {
            console.log(`${index + 1}. ${config.name} (${config.servers.length} servers)`);
            console.log(`   Path: ${config.path}`);
            console.log(`   Servers: ${config.servers.join(', ')}`);
            console.log('');
        });

        const choice = await question('Select a config file to import from (number): ');
        const selectedIndex = parseInt(choice) - 1;

        if (selectedIndex < 0 || selectedIndex >= availableConfigs.length) {
            console.log('Invalid selection.');
            return;
        }

        const selectedConfig = availableConfigs[selectedIndex];
        console.log(`\nSelected: ${selectedConfig.name}`);

        // Load current server library
        const currentConfig = await readConfigFile(configJsonPath);
        const currentServers = Object.keys(currentConfig.mcpServers || {});

        console.log(`\nCurrent server library has ${currentServers.length} servers:`, 
                   currentServers.length > 0 ? currentServers.join(', ') : 'none');

        // Show servers that would be imported
        const importServers = Object.keys(selectedConfig.config.mcpServers);
        const newServers = importServers.filter(name => !currentServers.includes(name));
        const existingServers = importServers.filter(name => currentServers.includes(name));

        console.log(`\nServers to be imported:`);
        if (newServers.length > 0) {
            console.log(`   New servers (${newServers.length}): ${newServers.join(', ')}`);
        }
        if (existingServers.length > 0) {
            console.log(`   Existing servers (${existingServers.length}): ${existingServers.join(', ')}`);
            console.log('   Warning: Existing servers will be overwritten with imported settings.');
        }

        const confirmImport = await question('\nProceed with import? (y/N): ');
        if (confirmImport.toLowerCase() !== 'y' && confirmImport.toLowerCase() !== 'yes') {
            console.log('Import cancelled.');
            return;
        }

        // Perform the import
        const mergedServers = {
            ...currentConfig.mcpServers,
            ...selectedConfig.config.mcpServers
        };

        // Remove platform-specific flags from imported servers since they belong in the main library
        Object.values(mergedServers).forEach(server => {
            delete server.enabledForClaude;
            delete server.enabledForCursor;
        });

        const newConfig = { mcpServers: mergedServers };
        await writeConfigFile(configJsonPath, newConfig);

        console.log('Import completed successfully!');
        console.log(`Server library now contains ${Object.keys(mergedServers).length} servers.`);
        if (newServers.length > 0) {
            console.log(`Added ${newServers.length} new servers: ${newServers.join(', ')}`);
        }
        if (existingServers.length > 0) {
            console.log(`Updated ${existingServers.length} existing servers: ${existingServers.join(', ')}`);
        }

    } catch (error) {
        console.error('Error during import:', error.message);
    } finally {
        rl.close();
    }
}

// Main startup function
async function startServer() {
    if (shouldImport) {
        await importConfigInteractive();
        console.log('\nStarting MCP Manager...\n');
    }

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API Routes
    console.log('Mounting API routes at /api');
    app.use('/api', apiRoutes);

    // Static file serving
    const staticDir = __dirname;
    console.log('Setting up static file serving from:', staticDir);
    app.use(express.static(staticDir));

    // Serve index.html for all other routes
    app.get('*', (req, res) => {
        console.log('Serving index.html for:', req.path);
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // Start server
    app.listen(port, () => {
        console.log(`MCP Manager running at http://localhost:${port}`);
        console.log('Current directory:', __dirname);
        console.log('Available routes:');
        console.log('  GET  /api/test');
        console.log('  GET  /api/cursor-config');
        console.log('  GET  /api/claude-config');
        console.log('  GET  /api/tools');
        console.log('  POST /api/save-configs');
        if (shouldImport) {
            console.log('\nTip: You can run "npm start --import" anytime to import servers again.');
        } else {
            console.log('\nTip: Run "npm start --import" to import servers from existing config files.');
        }
    });
}

// Start the application
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
