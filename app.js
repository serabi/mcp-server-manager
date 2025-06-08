let mcpServers = {};
let originalConfig = {};
let toolsList = [];

// API endpoints
const API = {
    MERGED_CONFIG: '/api/merged-config',
    CURSOR_CONFIG: '/api/cursor-config',
    CLAUDE_CONFIG: '/api/claude-config',
    TOOLS: '/api/tools',
    SAVE_CONFIGS: '/api/save-configs',
    RESTORE_BACKUP: '/api/restore-backup',
    LIST_BACKUPS: '/api/list-backups'
};

function showMessage(message, isError = true) {
    const messageDiv = document.getElementById(isError ? 'errorMessage' : 'successMessage');
    const otherDiv = document.getElementById(isError ? 'successMessage' : 'errorMessage');
    
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    otherDiv.style.display = 'none';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 10000); // Show for 10 seconds
}

async function fetchWithTimeout(url, options = {}) {
    const timeout = options.timeout || 5000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    console.log('Fetching:', url, options);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        return data;
    } catch (error) {
        clearTimeout(id);
        console.error('Fetch error:', error);
        throw error;
    }
}

async function loadConfigs() {
    console.log('Loading configurations...');
    try {
        // Load merged config first
        console.log('Fetching merged config from:', API.MERGED_CONFIG);
        const mergedConfig = await fetchWithTimeout(API.MERGED_CONFIG);
        console.log('Received merged config:', mergedConfig);
        
        if (!mergedConfig.mcpServers) {
            throw new Error('Invalid config format: missing mcpServers');
        }
        
        mcpServers = mergedConfig.mcpServers;
        originalConfig = JSON.parse(JSON.stringify(mcpServers));
        
        console.log('Loaded servers:', Object.keys(mcpServers));
        
        // Render initial view
        renderServers();
    } catch (error) {
        console.error('Error loading configs:', error);
        showMessage('Failed to load server configurations. Please refresh the page.');
    }
}

function showView(view, clickedTab) {
    console.log('Switching view to:', view);
    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    clickedTab.classList.add('active');

    // Update views
    document.getElementById('serversView').style.display = view === 'servers' ? 'grid' : 'none';
    document.getElementById('claudeView').style.display = view === 'claude' ? 'block' : 'none';
    document.getElementById('cursorView').style.display = view === 'cursor' ? 'block' : 'none';
    document.getElementById('backupsView').style.display = view === 'backups' ? 'block' : 'none';

    // Refresh views when switching to them
    if (view === 'claude') {
        renderClaudeView();
    } else if (view === 'cursor') {
        renderCursorView();
    } else if (view === 'backups') {
        renderBackupsView();
    }
}

function renderServers() {
    console.log('Rendering servers view with servers:', Object.keys(mcpServers));
    const grid = document.getElementById('serversView');
    grid.innerHTML = '';

    // Add header with new server button
    const header = document.createElement('div');
    header.className = 'servers-header';
    header.innerHTML = `
        <div class="servers-header-content">
            <h2>MCP Servers Library</h2>
            <div class="servers-header-controls">
                <button class="new-server-button" onclick="createNewServer()">+ New MCP Server</button>
                <button class="import-json-button" onclick="showJsonImport()">Import JSON</button>
            </div>
        </div>
    `;
    grid.appendChild(header);

    // Create grid container for server cards
    const serversGrid = document.createElement('div');
    serversGrid.className = 'servers-grid';

    // Sort servers alphabetically
    const sortedServers = Object.entries(mcpServers).sort(([a], [b]) => a.localeCompare(b));

    sortedServers.forEach(([name, config]) => {
        console.log('Rendering server:', name, config);
        const card = document.createElement('div');
        card.className = 'server-card';
        
        const serverPath = Array.isArray(config.args) ? config.args[0] : '';
        const envVars = config.env || {};

        card.innerHTML = `
            <div class="server-header">
                <span class="server-name">${name}</span>
                <div class="server-controls">
                    <button class="edit-button" onclick="editServer('${name}')">Edit</button>
                    <button class="delete-button" onclick="deleteServer('${name}')">Delete</button>
                </div>
            </div>
            <div class="server-details">
                <div class="server-field">
                    <label>Command:</label>
                    <span>${config.command || 'node'}</span>
                </div>
                <div class="server-field">
                    <label>Script Path:</label>
                    <span class="server-path">${serverPath}</span>
                </div>
                ${Object.keys(envVars).length > 0 ? '<div class="env-vars">' + 
                    Object.entries(envVars).map(([key]) => 
                        `<div class="env-var">
                            <span>${key}:</span>
                            <span>********</span>
                        </div>`
                    ).join('') + '</div>' : ''}
                <div class="platform-selection">
                    <label class="platform-checkbox">
                        <input type="checkbox" ${config.enabledForClaude !== false ? 'checked' : ''} 
                               onchange="toggleServerPlatform('${name}', 'claude', this.checked)">
                        <span class="checkmark"></span>
                        Claude
                    </label>
                    <label class="platform-checkbox">
                        <input type="checkbox" ${config.enabledForCursor !== false ? 'checked' : ''} 
                               onchange="toggleServerPlatform('${name}', 'cursor', this.checked)">
                        <span class="checkmark"></span>
                        Cursor
                    </label>
                </div>
            </div>
        `;
        
        serversGrid.appendChild(card);
    });

    grid.appendChild(serversGrid);
}

async function renderClaudeView() {
    console.log('Rendering Claude view');
    const claudeView = document.getElementById('claudeView');
    claudeView.innerHTML = '<div class="loading">Loading Claude configuration...</div>';

    try {
        // Fetch Claude's current configuration
        const claudeConfig = await fetchWithTimeout(API.CLAUDE_CONFIG);
        console.log('Claude config:', claudeConfig);

        claudeView.innerHTML = '';

        if (!claudeConfig.mcpServers || Object.keys(claudeConfig.mcpServers).length === 0) {
            claudeView.innerHTML = `
                <div class="no-servers-section">
                    <div class="no-servers-message">
                        <h3>Claude has no MCP servers configured</h3>
                        <p>Add servers on the Servers Library tab and save to populate this configuration.</p>
                    </div>
                    <div class="json-section">
                        <div class="json-header">
                            <h3>Claude Configuration (claude_desktop_config.json)</h3>
                            <div class="json-controls">
                                <button class="refresh-json-button" onclick="refreshJsonDisplay()">Refresh</button>
                                <button class="backup-button" onclick="showView('backups', document.querySelector('.tab:nth-child(4)'))">See and Restore Backups</button>
                            </div>
                        </div>
                        <div class="json-container">
                            <pre id="claudeJsonDisplay" class="json-display json-empty">{
  "mcpServers": {}
}</pre>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Create header
        const header = document.createElement('div');
        header.className = 'claude-header';
        header.innerHTML = `
            <h2>Claude's Current MCP Servers</h2>
            <p>These are the MCP servers currently configured and active in Claude.</p>
        `;
        claudeView.appendChild(header);

        // Sort servers alphabetically
        const sortedServers = Object.entries(claudeConfig.mcpServers).sort(([a], [b]) => a.localeCompare(b));

        // Create server grid
        const serversGrid = document.createElement('div');
        serversGrid.className = 'claude-servers-grid';

        sortedServers.forEach(([name, config]) => {
            const serverCard = document.createElement('div');
            serverCard.className = 'claude-server-card';
            
            const serverPath = Array.isArray(config.args) ? config.args[0] : '';
            const envVars = config.env || {};
            const additionalArgs = Array.isArray(config.args) && config.args.length > 1 ? config.args.slice(1) : [];

            serverCard.innerHTML = `
                <div class="claude-server-header">
                    <span class="claude-server-name">${name}</span>
                    <span class="claude-server-status">Active</span>
                </div>
                <div class="claude-server-details">
                    <div class="claude-server-field">
                        <label>Command:</label>
                        <span>${config.command || 'node'}</span>
                    </div>
                    <div class="claude-server-field">
                        <label>Script:</label>
                        <span class="claude-server-path">${serverPath}</span>
                    </div>
                    ${additionalArgs.length > 0 ? `
                        <div class="claude-server-field">
                            <label>Arguments:</label>
                            <span>${additionalArgs.join(', ')}</span>
                        </div>
                    ` : ''}
                    ${Object.keys(envVars).length > 0 ? `
                        <div class="claude-server-field">
                            <label>Environment Variables:</label>
                            <div class="claude-env-vars">
                                ${Object.keys(envVars).map(key => `<span class="env-var-tag">${key}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            serversGrid.appendChild(serverCard);
        });

        claudeView.appendChild(serversGrid);

        // Add JSON display section
        const jsonSection = document.createElement('div');
        jsonSection.className = 'json-section';
        jsonSection.innerHTML = `
            <div class="json-header">
                <h3>Claude Configuration (claude_desktop_config.json)</h3>
                <div class="json-controls">
                    <button class="refresh-json-button" onclick="refreshJsonDisplay()">Refresh</button>
                    <button class="backup-button" onclick="showView('backups', document.querySelector('.tab:nth-child(4)'))">See and Restore Backups</button>
                </div>
            </div>
            <div class="json-container">
                <pre id="claudeJsonDisplay" class="json-display">${JSON.stringify(claudeConfig, null, 2)}</pre>
            </div>
        `;
        claudeView.appendChild(jsonSection);

    } catch (error) {
        console.error('Error loading Claude config:', error);
        claudeView.innerHTML = '<div class="error-message">Failed to load Claude configuration. Make sure Claude is installed and configured.</div>';
    }
}

async function renderCursorView() {
    console.log('Rendering Cursor view');
    const cursorView = document.getElementById('cursorView');
    cursorView.innerHTML = '<div class="loading">Loading Cursor configuration...</div>';

    try {
        // Fetch Cursor's current configuration
        const cursorConfig = await fetchWithTimeout(API.CURSOR_CONFIG);
        console.log('Cursor config:', cursorConfig);

        cursorView.innerHTML = '';

        if (!cursorConfig.mcpServers || Object.keys(cursorConfig.mcpServers).length === 0) {
            cursorView.innerHTML = `
                <div class="no-servers-section">
                    <div class="no-servers-message">
                        <h3>Cursor has no MCP servers configured</h3>
                        <p>Add servers on the Servers Library tab and save to populate this configuration.</p>
                    </div>
                    <div class="json-section">
                        <div class="json-header">
                            <h3>Cursor Configuration (~/.cursor/mcp.json)</h3>
                            <div class="json-controls">
                                <button class="refresh-json-button" onclick="refreshCursorJsonDisplay()">Refresh</button>
                                <button class="backup-button" onclick="showView('backups', document.querySelector('.tab:nth-child(4)'))">See and Restore Backups</button>
                            </div>
                        </div>
                        <div class="json-container">
                            <pre id="cursorJsonDisplay" class="json-display json-empty">{
  "mcpServers": {}
}</pre>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Create header
        const header = document.createElement('div');
        header.className = 'cursor-header';
        header.innerHTML = `
            <h2>Cursor's Current MCP Servers</h2>
            <p>These are the MCP servers currently configured and active in Cursor.</p>
        `;
        cursorView.appendChild(header);

        // Sort servers alphabetically
        const sortedServers = Object.entries(cursorConfig.mcpServers).sort(([a], [b]) => a.localeCompare(b));

        // Create server grid
        const serversGrid = document.createElement('div');
        serversGrid.className = 'cursor-servers-grid';

        sortedServers.forEach(([name, config]) => {
            const serverCard = document.createElement('div');
            serverCard.className = 'cursor-server-card';
            
            const serverPath = Array.isArray(config.args) ? config.args[0] : '';
            const envVars = config.env || {};
            const additionalArgs = Array.isArray(config.args) && config.args.length > 1 ? config.args.slice(1) : [];

            serverCard.innerHTML = `
                <div class="cursor-server-header">
                    <span class="cursor-server-name">${name}</span>
                    <span class="cursor-server-status">${config.disabled ? 'Disabled' : 'Active'}</span>
                </div>
                <div class="cursor-server-details">
                    <div class="cursor-server-field">
                        <label>Command:</label>
                        <span>${config.command || 'node'}</span>
                    </div>
                    <div class="cursor-server-field">
                        <label>Script:</label>
                        <span class="cursor-server-path">${serverPath}</span>
                    </div>
                    ${additionalArgs.length > 0 ? `
                        <div class="cursor-server-field">
                            <label>Arguments:</label>
                            <span>${additionalArgs.join(', ')}</span>
                        </div>
                    ` : ''}
                    ${Object.keys(envVars).length > 0 ? `
                        <div class="cursor-server-field">
                            <label>Environment Variables:</label>
                            <div class="cursor-env-vars">
                                ${Object.keys(envVars).map(key => `<span class="env-var-tag">${key}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            serversGrid.appendChild(serverCard);
        });

        cursorView.appendChild(serversGrid);

        // Add JSON display section
        const jsonSection = document.createElement('div');
        jsonSection.className = 'json-section';
        jsonSection.innerHTML = `
            <div class="json-header">
                <h3>Cursor Configuration (~/.cursor/mcp.json)</h3>
                <div class="json-controls">
                    <button class="refresh-json-button" onclick="refreshCursorJsonDisplay()">Refresh</button>
                    <button class="backup-button" onclick="showView('backups', document.querySelector('.tab:nth-child(4)'))">See and Restore Backups</button>
                </div>
            </div>
            <div class="json-container">
                <pre id="cursorJsonDisplay" class="json-display">${JSON.stringify(cursorConfig, null, 2)}</pre>
            </div>
        `;
        cursorView.appendChild(jsonSection);

    } catch (error) {
        console.error('Error loading Cursor config:', error);
        cursorView.innerHTML = '<div class="error-message">Failed to load Cursor configuration. Make sure Cursor is installed and configured.</div>';
    }
}

function toggleServerPlatform(name, platform, enabled) {
    console.log('Toggling server platform:', name, platform, enabled);
    if (mcpServers[name]) {
        if (platform === 'claude') {
            mcpServers[name].enabledForClaude = enabled;
        } else if (platform === 'cursor') {
            mcpServers[name].enabledForCursor = enabled;
        }
    }
}

function createNewServer() {
    console.log('Creating new server');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>Create New MCP Server</h2>
                <button class="close-button" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="new-server-name">Server Name:</label>
                    <input type="text" id="new-server-name" placeholder="my-mcp-server" required>
                </div>
                <div class="form-group">
                    <label for="new-command">Command:</label>
                    <select id="new-command">
                        <option value="node" selected>node</option>
                        <option value="python">python</option>
                        <option value="python3">python3</option>
                        <option value="npx">npx</option>
                        <option value="npm">npm</option>
                        <option value="docker">docker</option>
                        <option value="uv">uv</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="new-script-path">Script Path:</label>
                    <input type="text" id="new-script-path" placeholder="/path/to/server.js" required>
                </div>
                <div class="form-group">
                    <label for="new-args">Additional Arguments (one per line):</label>
                    <textarea id="new-args" rows="3" placeholder="--port 3000"></textarea>
                </div>
                <div class="form-group">
                    <label>Environment Variables:</label>
                    <div id="new-env-vars-container"></div>
                    <button type="button" onclick="addEnvVar('new-env-vars-container')">Add Environment Variable</button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="cancel-button" onclick="closeModal()">Cancel</button>
                <button class="save-button" onclick="saveNewServer()">Create Server</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function editServer(name) {
    console.log('Editing server:', name);
    const config = mcpServers[name];
    if (!config) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal edit-server-modal">
            <div class="modal-header">
                <h2>Edit Server: ${name}</h2>
                <button class="close-button" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="edit-mode-toggle">
                    <button class="toggle-button active" onclick="switchEditMode('form', '${name}')" id="form-mode-btn">Form Editor</button>
                    <button class="toggle-button" onclick="switchEditMode('json', '${name}')" id="json-mode-btn">JSON Editor</button>
                </div>
                
                <!-- Form Editor -->
                <div id="form-editor" class="edit-mode-content">
                    <div class="form-group">
                        <label for="edit-command">Command:</label>
                        <select id="edit-command">
                            <option value="node" ${config.command === 'node' ? 'selected' : ''}>node</option>
                            <option value="python" ${config.command === 'python' ? 'selected' : ''}>python</option>
                            <option value="python3" ${config.command === 'python3' ? 'selected' : ''}>python3</option>
                            <option value="npx" ${config.command === 'npx' ? 'selected' : ''}>npx</option>
                            <option value="npm" ${config.command === 'npm' ? 'selected' : ''}>npm</option>
                            <option value="docker" ${config.command === 'docker' ? 'selected' : ''}>docker</option>
                            <option value="uv" ${config.command === 'uv' ? 'selected' : ''}>uv</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-script-path">Script Path:</label>
                        <input type="text" id="edit-script-path" value="${config.args && config.args[0] ? config.args[0] : ''}" placeholder="/path/to/script.js">
                    </div>
                    <div class="form-group">
                        <label for="edit-args">Additional Arguments (one per line):</label>
                        <textarea id="edit-args" rows="3" placeholder="--port 3000">${config.args && config.args.length > 1 ? config.args.slice(1).join('\n') : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Environment Variables:</label>
                        <div id="env-vars-container">
                            ${Object.entries(config.env || {}).map(([key, value]) => `
                                <div class="env-var-input">
                                    <input type="text" class="env-key" value="${key}" placeholder="Variable Name">
                                    <input type="text" class="env-value" value="${value}" placeholder="Variable Value">
                                    <button type="button" onclick="removeEnvVar(this)">Remove</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" onclick="addEnvVar('env-vars-container')">Add Environment Variable</button>
                    </div>
                </div>
                
                <!-- JSON Editor -->
                <div id="json-editor" class="edit-mode-content" style="display: none;">
                    <div class="form-group">
                        <label for="edit-json">Server Configuration JSON:</label>
                        <textarea id="edit-json" rows="15" placeholder="Enter server configuration JSON...">${JSON.stringify(config, null, 2)}</textarea>
                        <div class="json-validation-message" id="json-validation"></div>
                    </div>
                    <div class="json-help">
                        <h4>JSON Format:</h4>
                        <pre class="json-example">{
  "command": "node",
  "args": ["/path/to/server.js", "--port", "3000"],
  "env": {
    "API_KEY": "your-api-key",
    "DATABASE_URL": "sqlite:///data.db"
  }
}</pre>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="cancel-button" onclick="closeModal()">Cancel</button>
                <button class="sync-button" onclick="syncFormToJson('${name}')" id="sync-to-json-btn">Sync to JSON</button>
                <button class="sync-button" onclick="syncJsonToForm('${name}')" id="sync-to-form-btn" style="display: none;">Sync to Form</button>
                <button class="save-button" onclick="saveServerEdit('${name}')">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Add real-time JSON validation
    const jsonTextarea = document.getElementById('edit-json');
    jsonTextarea.addEventListener('input', validateEditJson);
}

function switchEditMode(mode, serverName) {
    const formEditor = document.getElementById('form-editor');
    const jsonEditor = document.getElementById('json-editor');
    const formBtn = document.getElementById('form-mode-btn');
    const jsonBtn = document.getElementById('json-mode-btn');
    const syncToJsonBtn = document.getElementById('sync-to-json-btn');
    const syncToFormBtn = document.getElementById('sync-to-form-btn');
    
    if (mode === 'form') {
        formEditor.style.display = 'block';
        jsonEditor.style.display = 'none';
        formBtn.classList.add('active');
        jsonBtn.classList.remove('active');
        syncToJsonBtn.style.display = 'inline-block';
        syncToFormBtn.style.display = 'none';
    } else {
        formEditor.style.display = 'none';
        jsonEditor.style.display = 'block';
        formBtn.classList.remove('active');
        jsonBtn.classList.add('active');
        syncToJsonBtn.style.display = 'none';
        syncToFormBtn.style.display = 'inline-block';
    }
}

function validateEditJson() {
    const jsonTextarea = document.getElementById('edit-json');
    const validationDiv = document.getElementById('json-validation');
    
    try {
        const text = jsonTextarea.value.trim();
        if (!text) {
            validationDiv.textContent = '';
            jsonTextarea.style.borderColor = '';
            return false;
        }
        
        const parsed = JSON.parse(text);
        
        // Basic validation for server config
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Configuration must be an object');
        }
        
        validationDiv.textContent = '✓ Valid JSON';
        validationDiv.className = 'json-validation-message valid';
        jsonTextarea.style.borderColor = '#4CAF50';
        return true;
        
    } catch (error) {
        validationDiv.textContent = '✗ Invalid JSON: ' + error.message;
        validationDiv.className = 'json-validation-message invalid';
        jsonTextarea.style.borderColor = '#F44336';
        return false;
    }
}

function syncFormToJson(serverName) {
    // Get form data
    const command = document.getElementById('edit-command').value;
    const scriptPath = document.getElementById('edit-script-path').value.trim();
    const additionalArgs = document.getElementById('edit-args').value
        .split('\n')
        .map(arg => arg.trim())
        .filter(arg => arg.length > 0);

    // Build args array
    const args = [];
    if (scriptPath) args.push(scriptPath);
    args.push(...additionalArgs);

    // Collect environment variables
    const env = {};
    const envInputs = document.querySelectorAll('#env-vars-container .env-var-input');
    envInputs.forEach(input => {
        const key = input.querySelector('.env-key').value.trim();
        const value = input.querySelector('.env-value').value.trim();
        if (key && value) {
            env[key] = value;
        }
    });

    // Build config object
    const config = {
        command,
        ...(args.length > 0 && { args }),
        ...(Object.keys(env).length > 0 && { env })
    };

    // Update JSON textarea
    const jsonTextarea = document.getElementById('edit-json');
    jsonTextarea.value = JSON.stringify(config, null, 2);
    
    // Validate the generated JSON
    validateEditJson();
    
    showMessage('Form data synced to JSON editor.', false);
}

function syncJsonToForm(serverName) {
    const jsonTextarea = document.getElementById('edit-json');
    
    if (!validateEditJson()) {
        showMessage('Please fix JSON errors before syncing to form.');
        return;
    }
    
    try {
        const config = JSON.parse(jsonTextarea.value);
        
        // Update form fields
        document.getElementById('edit-command').value = config.command || 'node';
        
        const args = config.args || [];
        document.getElementById('edit-script-path').value = args.length > 0 ? args[0] : '';
        document.getElementById('edit-args').value = args.length > 1 ? args.slice(1).join('\n') : '';
        
        // Clear existing env vars
        const envContainer = document.getElementById('env-vars-container');
        envContainer.innerHTML = '';
        
        // Add environment variables
        if (config.env) {
            Object.entries(config.env).forEach(([key, value]) => {
                const div = document.createElement('div');
                div.className = 'env-var-input';
                div.innerHTML = `
                    <input type="text" class="env-key" value="${key}" placeholder="Variable Name">
                    <input type="text" class="env-value" value="${value}" placeholder="Variable Value">
                    <button type="button" onclick="removeEnvVar(this)">Remove</button>
                `;
                envContainer.appendChild(div);
            });
        }
        
        showMessage('JSON data synced to form editor.', false);
        
    } catch (error) {
        showMessage('Error syncing JSON to form: ' + error.message);
    }
}

function addEnvVar(containerId = 'env-vars-container') {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'env-var-input';
    div.innerHTML = `
        <input type="text" class="env-key" placeholder="Variable Name">
        <input type="text" class="env-value" placeholder="Variable Value">
        <button type="button" onclick="removeEnvVar(this)">Remove</button>
    `;
    container.appendChild(div);
}

function removeEnvVar(button) {
    button.parentElement.remove();
}

function saveNewServer() {
    const name = document.getElementById('new-server-name').value.trim();
    const command = document.getElementById('new-command').value;
    const scriptPath = document.getElementById('new-script-path').value.trim();
    const additionalArgs = document.getElementById('new-args').value
        .split('\n')
        .map(arg => arg.trim())
        .filter(arg => arg.length > 0);

    // Validation
    if (!name) {
        showMessage('Server name is required.');
        return;
    }
    
    if (mcpServers[name]) {
        showMessage(`Server "${name}" already exists. Please choose a different name.`);
        return;
    }
    
    if (!scriptPath) {
        showMessage('Script path is required.');
        return;
    }

    // Build args array
    const args = [];
    if (scriptPath) args.push(scriptPath);
    args.push(...additionalArgs);

    // Collect environment variables
    const env = {};
    const envInputs = document.querySelectorAll('#new-env-vars-container .env-var-input');
    envInputs.forEach(input => {
        const key = input.querySelector('.env-key').value.trim();
        const value = input.querySelector('.env-value').value.trim();
        if (key && value) {
            env[key] = value;
        }
    });

    // Create new server configuration
    mcpServers[name] = {
        command,
        args: args.length > 0 ? args : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
        enabledForClaude: true,
        enabledForCursor: true
    };

    console.log('Created new server:', name, mcpServers[name]);
    
    closeModal();
    renderServers();
    showMessage(`Server "${name}" created successfully. Remember to save changes.`, false);
}

function deleteServer(name) {
    if (!confirm(`Are you sure you want to delete the server "${name}"? This action cannot be undone.`)) {
        return;
    }
    
    delete mcpServers[name];
    console.log('Deleted server:', name);
    
    renderServers();
    showMessage(`Server "${name}" deleted. Remember to save changes.`, false);
}

function saveServerEdit(name) {
    // Check which mode is active
    const jsonEditor = document.getElementById('json-editor');
    const isJsonMode = jsonEditor && jsonEditor.style.display !== 'none';
    
    let newConfig;
    
    if (isJsonMode) {
        // Save from JSON editor
        const jsonTextarea = document.getElementById('edit-json');
        
        if (!validateEditJson()) {
            showMessage('Please fix JSON errors before saving.');
            return;
        }
        
        try {
            newConfig = JSON.parse(jsonTextarea.value);
        } catch (error) {
            showMessage('Invalid JSON: ' + error.message);
            return;
        }
    } else {
        // Save from form editor
        const command = document.getElementById('edit-command').value;
        const scriptPath = document.getElementById('edit-script-path').value.trim();
        const additionalArgs = document.getElementById('edit-args').value
            .split('\n')
            .map(arg => arg.trim())
            .filter(arg => arg.length > 0);

        // Build args array
        const args = [];
        if (scriptPath) args.push(scriptPath);
        args.push(...additionalArgs);

        // Collect environment variables
        const env = {};
        const envInputs = document.querySelectorAll('#env-vars-container .env-var-input');
        envInputs.forEach(input => {
            const key = input.querySelector('.env-key').value.trim();
            const value = input.querySelector('.env-value').value.trim();
            if (key && value) {
                env[key] = value;
            }
        });

        // Build config object
        newConfig = {
            command,
            ...(args.length > 0 && { args }),
            ...(Object.keys(env).length > 0 && { env })
        };
    }

    // Update server configuration, preserving platform settings
    mcpServers[name] = {
        ...mcpServers[name],
        ...newConfig
    };

    console.log('Updated server config:', name, mcpServers[name]);
    
    closeModal();
    renderServers();
    showMessage('Server configuration updated. Remember to save changes.', false);
}

function showJsonImport() {
    console.log('Showing JSON import modal');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal json-import-modal">
            <div class="modal-header">
                <h2>Import MCP Servers from JSON</h2>
                <button class="close-button" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="json-input">Paste your MCP server configuration JSON:</label>
                    <textarea id="json-input" rows="15" placeholder='Example:
{
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}

Or paste individual server configs:
{
  "my-server": {
    "command": "python",
    "args": ["/path/to/server.py"],
    "env": {
      "DATABASE_URL": "sqlite:///data.db"
    }
  }
}'></textarea>
                </div>
                <div class="json-preview" id="json-preview" style="display: none;">
                    <h4>Preview:</h4>
                    <div class="preview-content" id="preview-content"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="cancel-button" onclick="closeModal()">Cancel</button>
                <button class="preview-button" onclick="previewJsonImport()">Preview</button>
                <button class="save-button" onclick="importJson()" disabled id="import-button">Import</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Add event listener for real-time validation
    const jsonInput = document.getElementById('json-input');
    jsonInput.addEventListener('input', validateJsonInput);
}

function validateJsonInput() {
    const jsonInput = document.getElementById('json-input');
    const importButton = document.getElementById('import-button');
    const preview = document.getElementById('json-preview');
    
    try {
        const text = jsonInput.value.trim();
        if (!text) {
            importButton.disabled = true;
            preview.style.display = 'none';
            return;
        }
        
        const parsed = JSON.parse(text);
        
        // Check if it's a valid MCP server configuration
        let servers = {};
        if (parsed.mcpServers) {
            servers = parsed.mcpServers;
        } else if (typeof parsed === 'object' && parsed !== null) {
            // Assume it's a direct server object or multiple servers
            servers = parsed;
        } else {
            throw new Error('Invalid format');
        }
        
        // Validate each server
        for (const [name, config] of Object.entries(servers)) {
            if (!config || typeof config !== 'object') {
                throw new Error(`Invalid server configuration for "${name}"`);
            }
        }
        
        importButton.disabled = false;
        jsonInput.style.borderColor = '#4CAF50';
        
    } catch (error) {
        importButton.disabled = true;
        jsonInput.style.borderColor = '#F44336';
        preview.style.display = 'none';
        console.log('JSON validation error:', error.message);
    }
}

function previewJsonImport() {
    const jsonInput = document.getElementById('json-input');
    const preview = document.getElementById('json-preview');
    const previewContent = document.getElementById('preview-content');
    
    try {
        const text = jsonInput.value.trim();
        const parsed = JSON.parse(text);
        
        let servers = {};
        if (parsed.mcpServers) {
            servers = parsed.mcpServers;
        } else {
            servers = parsed;
        }
        
        const serverNames = Object.keys(servers);
        
        let html = `<p><strong>${serverNames.length}</strong> server(s) to import:</p><ul>`;
        serverNames.forEach(name => {
            const exists = mcpServers[name];
            html += `<li><strong>${name}</strong>${exists ? ' (will update existing)' : ' (new)'}</li>`;
        });
        html += '</ul>';
        
        html += `<p class="info"><strong>Import mode:</strong> Merge with existing servers (safe)</p>`;
        
        previewContent.innerHTML = html;
        preview.style.display = 'block';
        
    } catch (error) {
        showMessage('Invalid JSON format: ' + error.message);
    }
}

function importJson() {
    const jsonInput = document.getElementById('json-input');
    
    try {
        const text = jsonInput.value.trim();
        const parsed = JSON.parse(text);
        
        let servers = {};
        if (parsed.mcpServers) {
            servers = parsed.mcpServers;
        } else {
            servers = parsed;
        }
        
        // Always merge - never replace
        let importCount = 0;
        let updateCount = 0;
        
        for (const [name, config] of Object.entries(servers)) {
            const existed = mcpServers[name];
            mcpServers[name] = {
                ...config,
                enabledForClaude: config.enabledForClaude !== false,
                enabledForCursor: config.enabledForCursor !== false
            };
            
            if (existed) {
                updateCount++;
            } else {
                importCount++;
            }
        }
        
        closeModal();
        renderServers();
        
        let message = `Successfully imported ${importCount} new server(s)`;
        if (updateCount > 0) {
            message += ` and updated ${updateCount} existing server(s)`;
        }
        message += '. Remember to save changes.';
        
        showMessage(message, false);
        
    } catch (error) {
        showMessage('Error importing JSON: ' + error.message);
    }
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

async function refreshJsonDisplay() {
    console.log('Refreshing Claude JSON display');
    const jsonDisplay = document.getElementById('claudeJsonDisplay');
    
    // Only refresh if the JSON display exists (Claude tab is active)
    if (!jsonDisplay) {
        console.log('Claude JSON display not found - Claude tab not active');
        return;
    }
    
    try {
        jsonDisplay.textContent = 'Loading...';
        
        // Fetch Claude's current configuration
        const claudeConfig = await fetchWithTimeout(API.CLAUDE_CONFIG);
        console.log('Fetched Claude config for JSON display:', claudeConfig);
        
        // Format JSON with proper indentation
        const formattedJson = JSON.stringify(claudeConfig, null, 2);
        jsonDisplay.textContent = formattedJson;
        
        // Add syntax highlighting classes if the JSON is not empty
        if (claudeConfig && Object.keys(claudeConfig).length > 0) {
            jsonDisplay.className = 'json-display json-populated';
        } else {
            jsonDisplay.className = 'json-display json-empty';
        }
        
    } catch (error) {
        console.error('Error loading Claude config for JSON display:', error);
        jsonDisplay.textContent = `Error loading configuration: ${error.message}`;
        jsonDisplay.className = 'json-display json-error';
    }
}

async function refreshCursorJsonDisplay() {
    console.log('Refreshing Cursor JSON display');
    const jsonDisplay = document.getElementById('cursorJsonDisplay');
    
    // Only refresh if the JSON display exists (Cursor tab is active)
    if (!jsonDisplay) {
        console.log('Cursor JSON display not found - Cursor tab not active');
        return;
    }
    
    try {
        jsonDisplay.textContent = 'Loading...';
        
        // Fetch Cursor's current configuration
        const cursorConfig = await fetchWithTimeout(API.CURSOR_CONFIG);
        console.log('Fetched Cursor config for JSON display:', cursorConfig);
        
        // Format JSON with proper indentation
        const formattedJson = JSON.stringify(cursorConfig, null, 2);
        jsonDisplay.textContent = formattedJson;
        
        // Add syntax highlighting classes if the JSON is not empty
        if (cursorConfig && Object.keys(cursorConfig).length > 0) {
            jsonDisplay.className = 'json-display json-populated';
        } else {
            jsonDisplay.className = 'json-display json-empty';
        }
        
    } catch (error) {
        console.error('Error loading Cursor config for JSON display:', error);
        jsonDisplay.textContent = `Error loading configuration: ${error.message}`;
        jsonDisplay.className = 'json-display json-error';
    }
}

async function renderBackupsView() {
    console.log('Rendering Backups view');
    const backupsView = document.getElementById('backupsView');
    backupsView.innerHTML = '<div class="loading">Loading backups...</div>';

    try {
        const backups = await fetchWithTimeout(API.LIST_BACKUPS);
        console.log('Backups data:', backups);

        backupsView.innerHTML = '';

        // Create header
        const header = document.createElement('div');
        header.className = 'backups-header';
        header.innerHTML = `
            <h2>Configuration Backups</h2>
            <p>Select a backup to restore. Backups are automatically created when you save changes.</p>
        `;
        backupsView.appendChild(header);

        // Check if any backups exist
        const totalBackups = backups.claude.length + backups.cursor.length;
        if (totalBackups === 0) {
            const noBackupsDiv = document.createElement('div');
            noBackupsDiv.className = 'no-backups-message';
            noBackupsDiv.innerHTML = `
                <h3>No backups found</h3>
                <p>Backups will be created automatically when you save configuration changes.</p>
            `;
            backupsView.appendChild(noBackupsDiv);
            return;
        }

        // Create platform sections
        if (backups.claude.length > 0) {
            const claudeSection = createBackupSection('Claude', backups.claude);
            backupsView.appendChild(claudeSection);
        }

        if (backups.cursor.length > 0) {
            const cursorSection = createBackupSection('Cursor', backups.cursor);
            backupsView.appendChild(cursorSection);
        }

    } catch (error) {
        console.error('Error loading backups:', error);
        backupsView.innerHTML = '<div class="error-message">Failed to load backups. Please try again.</div>';
    }
}

function createBackupSection(platform, backupList) {
    const section = document.createElement('div');
    section.className = 'backup-platform-section';
    
    const sectionHeader = document.createElement('h3');
    sectionHeader.textContent = `${platform} Backups (${backupList.length})`;
    section.appendChild(sectionHeader);

    const backupsGrid = document.createElement('div');
    backupsGrid.className = 'backups-grid';

    backupList.forEach(backup => {
        const backupCard = document.createElement('div');
        backupCard.className = 'backup-card';
        
        backupCard.innerHTML = `
            <div class="backup-info">
                <div class="backup-date">${backup.date}</div>
                <div class="backup-filename">${backup.name}</div>
            </div>
            <div class="backup-actions">
                <button class="restore-button" onclick="restoreSpecificBackup('${backup.platform}', '${backup.name}')">
                    Restore This Backup
                </button>
            </div>
        `;
        
        backupsGrid.appendChild(backupCard);
    });

    section.appendChild(backupsGrid);
    return section;
}

async function restoreSpecificBackup(platform, backupFile) {
    console.log('Restoring specific backup:', platform, backupFile);
    
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to restore the ${platform} configuration from "${backupFile}"? This will overwrite the current configuration.`)) {
        return;
    }
    
    try {
        const result = await fetchWithTimeout(API.RESTORE_BACKUP, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ platform, backupFile })
        });

        showMessage(result.message || `${platform} configuration restored successfully.`, false);
        
        // Refresh the appropriate view if it's currently active
        if (platform === 'claude' && document.getElementById('claudeView').style.display !== 'none') {
            renderClaudeView();
        }
        if (platform === 'cursor' && document.getElementById('cursorView').style.display !== 'none') {
            renderCursorView();
        }
        
        // Refresh the servers view to show updated checkbox states
        loadConfigs();
        
        // Refresh the backups view to show updated state
        if (document.getElementById('backupsView').style.display !== 'none') {
            renderBackupsView();
        }
    } catch (error) {
        console.error('Error restoring backup:', error);
        showMessage('Error restoring backup: ' + error.message);
    }
}

async function restoreBackup(platform) {
    console.log('Restoring backup for platform:', platform);
    
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to restore the ${platform} configuration from backup? This will overwrite the current configuration.`)) {
        return;
    }
    
    try {
        const result = await fetchWithTimeout(API.RESTORE_BACKUP, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ platform })
        });

        showMessage(result.message || `${platform} configuration restored successfully.`, false);
        
        // Refresh the appropriate view
        if (platform === 'claude' && document.getElementById('claudeView').style.display !== 'none') {
            renderClaudeView();
        }
        if (platform === 'cursor' && document.getElementById('cursorView').style.display !== 'none') {
            renderCursorView();
        }
        
        // Refresh the servers view to show updated checkbox states
        loadConfigs();
    } catch (error) {
        console.error('Error restoring backup:', error);
        showMessage('Error restoring backup: ' + error.message);
    }
}

async function saveChanges() {
    console.log('Saving changes...');
    try {
        const result = await fetchWithTimeout(API.SAVE_CONFIGS, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mcpServers })
        });

        originalConfig = JSON.parse(JSON.stringify(mcpServers));
        showMessage(result.message || 'Configurations saved successfully. Please restart Claude to apply changes.', false);
        
        // Refresh active views if they're currently displayed
        if (document.getElementById('claudeView').style.display !== 'none') {
            renderClaudeView();
        }
        if (document.getElementById('cursorView').style.display !== 'none') {
            renderCursorView();
        }
    } catch (error) {
        console.error('Error saving configs:', error);
        showMessage('Error saving configurations: ' + error.message);
    }
}

// Initialize the app
console.log('Initializing MCP Manager...');
window.onload = loadConfigs;

// Export functions for global access
window.showView = showView;
window.toggleServerPlatform = toggleServerPlatform;
window.saveChanges = saveChanges;
window.editServer = editServer;
window.addEnvVar = addEnvVar;
window.removeEnvVar = removeEnvVar;
window.saveServerEdit = saveServerEdit;
window.closeModal = closeModal;
window.refreshJsonDisplay = refreshJsonDisplay;
window.refreshCursorJsonDisplay = refreshCursorJsonDisplay;
window.restoreBackup = restoreBackup;
window.createNewServer = createNewServer;
window.saveNewServer = saveNewServer;
window.deleteServer = deleteServer;
window.showJsonImport = showJsonImport;
window.previewJsonImport = previewJsonImport;
window.importJson = importJson;
window.validateJsonInput = validateJsonInput;
window.switchEditMode = switchEditMode;
window.validateEditJson = validateEditJson;
window.syncFormToJson = syncFormToJson;
window.syncJsonToForm = syncJsonToForm;
window.renderBackupsView = renderBackupsView;
window.restoreSpecificBackup = restoreSpecificBackup;
