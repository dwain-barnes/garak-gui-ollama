// Configuration
const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

// State management
let state = {
    models: [],
    probes: [],
    detectors: [],
    selectedProbes: new Set(),
    selectedDetectors: new Set(),
    scanHistory: [],
    currentScan: null,
    ws: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await checkHealth();
    await loadModels();
    await loadProbes();
    await loadDetectors();
    await loadHistory();
    
    // Setup search filters
    setupSearchFilters();
});

// Health check
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        
        updateConnectionStatus(data.ollama === 'connected');
    } catch (error) {
        console.error('Health check failed:', error);
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(isConnected) {
    const statusDiv = document.getElementById('connectionStatus');
    const dot = statusDiv.querySelector('div');
    const text = statusDiv.querySelector('span');
    
    if (isConnected) {
        dot.className = 'w-3 h-3 rounded-full bg-green-500';
        text.textContent = 'Ollama Connected';
        text.className = 'text-sm text-green-600 font-medium';
    } else {
        dot.className = 'w-3 h-3 rounded-full bg-red-500';
        text.textContent = 'Ollama Disconnected';
        text.className = 'text-sm text-red-600 font-medium';
    }
}

// Load models from Ollama
async function loadModels() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/models`);
        const data = await response.json();
        state.models = data.models;
        
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '';
        
        if (state.models.length === 0) {
            modelSelect.innerHTML = '<option value="">No models found. Please pull models in Ollama.</option>';
            return;
        }
        
        modelSelect.innerHTML = '<option value="">Select a model...</option>';
        state.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} (${formatSize(model.size)})`;
            modelSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading models:', error);
        showNotification('Error loading models', 'error');
    }
}

// Load available Garak probes
async function loadProbes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/probes`);
        const data = await response.json();
        state.probes = data.probes;
        
        renderProbes();
    } catch (error) {
        console.error('Error loading probes:', error);
        showNotification('Error loading probes', 'error');
    }
}

// Load available Garak detectors
async function loadDetectors() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/detectors`);
        const data = await response.json();
        state.detectors = data.detectors;
        
        renderDetectors();
    } catch (error) {
        console.error('Error loading detectors:', error);
        showNotification('Error loading detectors', 'error');
    }
}

// Render probes list
function renderProbes(filter = '') {
    const probesList = document.getElementById('probesList');
    const filteredProbes = state.probes.filter(probe => 
        probe.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredProbes.length === 0) {
        probesList.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No probes found</div>';
        return;
    }
    
    probesList.innerHTML = filteredProbes.map(probe => {
        const isSelected = state.selectedProbes.has(probe.name);
        return `
            <div class="probe-card border-2 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} rounded-lg p-4 cursor-pointer" onclick="toggleProbe('${probe.name}')">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-medium text-gray-900 text-sm mb-1">${probe.name}</h3>
                        <p class="text-xs text-gray-600">${probe.description || 'No description'}</p>
                    </div>
                    <div class="ml-3">
                        ${isSelected ? 
                            '<svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' :
                            '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    updateProbeCount();
}

// Render detectors list
function renderDetectors(filter = '') {
    const detectorsList = document.getElementById('detectorsList');
    const filteredDetectors = state.detectors.filter(detector => 
        detector.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filteredDetectors.length === 0) {
        detectorsList.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No detectors found</div>';
        return;
    }
    
    detectorsList.innerHTML = filteredDetectors.map(detector => {
        const isSelected = state.selectedDetectors.has(detector.name);
        return `
            <div class="probe-card border-2 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} rounded-lg p-4 cursor-pointer" onclick="toggleDetector('${detector.name}')">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-medium text-gray-900 text-sm mb-1">${detector.name}</h3>
                        <p class="text-xs text-gray-600">${detector.description || 'No description'}</p>
                    </div>
                    <div class="ml-3">
                        ${isSelected ? 
                            '<svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' :
                            '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    updateDetectorCount();
}

// Toggle probe selection
function toggleProbe(probeName) {
    if (state.selectedProbes.has(probeName)) {
        state.selectedProbes.delete(probeName);
    } else {
        state.selectedProbes.add(probeName);
    }
    renderProbes(document.getElementById('probeSearch').value);
}

// Toggle detector selection
function toggleDetector(detectorName) {
    if (state.selectedDetectors.has(detectorName)) {
        state.selectedDetectors.delete(detectorName);
    } else {
        state.selectedDetectors.add(detectorName);
    }
    renderDetectors(document.getElementById('detectorSearch').value);
}

// Select/deselect all probes
function selectAllProbes() {
    const filter = document.getElementById('probeSearch').value;
    const filteredProbes = state.probes.filter(probe => 
        probe.name.toLowerCase().includes(filter.toLowerCase())
    );
    filteredProbes.forEach(probe => state.selectedProbes.add(probe.name));
    renderProbes(filter);
}

function deselectAllProbes() {
    state.selectedProbes.clear();
    renderProbes(document.getElementById('probeSearch').value);
}

// Select/deselect all detectors
function selectAllDetectors() {
    const filter = document.getElementById('detectorSearch').value;
    const filteredDetectors = state.detectors.filter(detector => 
        detector.name.toLowerCase().includes(filter.toLowerCase())
    );
    filteredDetectors.forEach(detector => state.selectedDetectors.add(detector.name));
    renderDetectors(filter);
}

function deselectAllDetectors() {
    state.selectedDetectors.clear();
    renderDetectors(document.getElementById('detectorSearch').value);
}

// Update counters
function updateProbeCount() {
    document.getElementById('probeCount').textContent = state.selectedProbes.size;
}

function updateDetectorCount() {
    document.getElementById('detectorCount').textContent = state.selectedDetectors.size;
}

// Setup search filters
function setupSearchFilters() {
    document.getElementById('probeSearch').addEventListener('input', (e) => {
        renderProbes(e.target.value);
    });
    
    document.getElementById('detectorSearch').addEventListener('input', (e) => {
        renderDetectors(e.target.value);
    });
}

// Start scan
async function startScan() {
    const modelName = document.getElementById('modelSelect').value;
    const description = document.getElementById('scanDescription').value;
    
    // Validation
    if (!modelName) {
        showNotification('Please select a model', 'error');
        return;
    }
    
    if (state.selectedProbes.size === 0) {
        showNotification('Please select at least one probe', 'error');
        return;
    }
    
    // Close any existing WebSocket connection to ensure clean state
    if (state.ws) {
        console.log('Closing existing WebSocket connection');
        state.ws.close();
        state.ws = null;
    }
    
    // Prepare scan data
    const scanData = {
        model_name: modelName,
        probes: Array.from(state.selectedProbes),
        detectors: state.selectedDetectors.size > 0 ? Array.from(state.selectedDetectors) : null,
        description: description || null
    };
    
    console.log('Starting scan with data:', scanData);
    
    // Show progress modal
    showScanModal();
    
    // Connect to WebSocket
    connectWebSocket(scanData);
}

// WebSocket connection for scan
function connectWebSocket(scanData) {
    console.log('Connecting to WebSocket with scan data:', scanData);
    const ws = new WebSocket(`${WS_BASE_URL}/ws/scan`);
    state.ws = ws;
    
    ws.onopen = () => {
        console.log('WebSocket connected, sending scan data:', scanData);
        ws.send(JSON.stringify(scanData));
        addScanLog('Connected to scan server');
        addScanLog(`Scanning model: ${scanData.model_name}`);
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleScanMessage(data);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addScanLog('Error: Connection failed', 'error');
        enableCloseButton();
    };
    
    ws.onclose = () => {
        console.log('WebSocket closed');
        enableCloseButton();
    };
}

// Handle scan messages
function handleScanMessage(data) {
    switch (data.type) {
        case 'status':
            updateScanProgress(data.progress, data.message);
            addScanLog(data.message);
            break;
            
        case 'complete':
            updateScanProgress(100, 'Scan completed!');
            addScanLog('âœ“ Scan completed successfully', 'success');
            state.currentScan = data;
            enableCloseButton();
            
            // Refresh history
            setTimeout(() => {
                loadHistory();
            }, 1000);
            break;
            
        case 'error':
            addScanLog(`âœ— Error: ${data.message}`, 'error');
            enableCloseButton();
            break;
    }
}

// Update scan progress
function updateScanProgress(progress, status) {
    document.getElementById('scanProgress').textContent = `${progress}%`;
    document.getElementById('scanProgressBar').style.width = `${progress}%`;
    document.getElementById('scanStatus').textContent = status;
}

// Add log to scan modal
function addScanLog(message, type = 'info') {
    const logsDiv = document.getElementById('scanLogs');
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-1 fade-in';
    
    const timestamp = new Date().toLocaleTimeString();
    const colorClass = type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-gray-600';
    
    logEntry.innerHTML = `<span class="text-gray-400">[${timestamp}]</span> <span class="${colorClass}">${message}</span>`;
    logsDiv.appendChild(logEntry);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

// Show/hide scan modal
function showScanModal() {
    document.getElementById('scanProgressModal').classList.remove('hidden');
    document.getElementById('closeScanBtn').disabled = true;
    document.getElementById('scanLogs').innerHTML = '';
    updateScanProgress(0, 'Initializing...');
}

function closeScanModal() {
    document.getElementById('scanProgressModal').classList.add('hidden');
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }
}

function enableCloseButton() {
    document.getElementById('closeScanBtn').disabled = false;
}

// Load scan history
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/scans`);
        const data = await response.json();
        state.scanHistory = data.scans;
        
        renderHistory();
    } catch (error) {
        console.error('Error loading history:', error);
        showNotification('Error loading scan history', 'error');
    }
}

// Render history
function renderHistory() {
    const historyList = document.getElementById('historyList');
    
    if (state.scanHistory.length === 0) {
        historyList.innerHTML = '<div class="text-center py-12 text-gray-500">No scans yet. Start your first scan!</div>';
        return;
    }
    
    // Sort by timestamp (newest first)
    const sortedHistory = [...state.scanHistory].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    historyList.innerHTML = sortedHistory.map(scan => {
        const date = new Date(scan.timestamp);
        const statusColor = scan.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          scan.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800';
        
        const hasReport = scan.results && scan.results.report_path;
        
        return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4 hover:shadow-md transition duration-200">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <h3 class="font-semibold text-gray-900">${scan.model_name}</h3>
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColor}">${scan.status}</span>
                        </div>
                        ${scan.description ? `<p class="text-sm text-gray-600 mb-2">${scan.description}</p>` : ''}
                        <p class="text-xs text-gray-500">${date.toLocaleString()}</p>
                    </div>
                    ${hasReport ? `
                        <a href="${API_BASE_URL}${scan.results.report_path}" target="_blank" class="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition duration-200 flex items-center space-x-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>View Report</span>
                        </a>
                    ` : ''}
                </div>
                
                <div class="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                        <span class="text-gray-600">Probes:</span>
                        <span class="font-medium text-gray-900">${scan.probes.length}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Detectors:</span>
                        <span class="font-medium text-gray-900">${scan.detectors?.length || 0}</span>
                    </div>
                </div>
                
                <details class="text-sm">
                    <summary class="cursor-pointer text-blue-600 hover:text-blue-700 font-medium mb-2">View Details</summary>
                    <div class="bg-gray-50 rounded p-3 mt-2">
                        <div class="mb-2">
                            <span class="font-medium text-gray-700">Probes:</span>
                            <div class="text-gray-600 text-xs mt-1">${scan.probes.join(', ')}</div>
                        </div>
                        ${scan.detectors && scan.detectors.length > 0 ? `
                            <div>
                                <span class="font-medium text-gray-700">Detectors:</span>
                                <div class="text-gray-600 text-xs mt-1">${scan.detectors.join(', ')}</div>
                            </div>
                        ` : ''}
                    </div>
                </details>
            </div>
        `;
    }).join('');
}

// Tab navigation
function showTab(tabName) {
    document.getElementById('scanTab').classList.add('hidden');
    document.getElementById('historyTab').classList.add('hidden');
    
    if (tabName === 'scan') {
        document.getElementById('scanTab').classList.remove('hidden');
    } else if (tabName === 'history') {
        document.getElementById('historyTab').classList.remove('hidden');
        loadHistory();
    }
}

// Utility functions
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function showNotification(message, type = 'info') {
    // Simple notification (you can enhance this with a proper notification system)
    const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue';
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
}
