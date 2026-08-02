/**
 * SystemC CAM Power Model - EDA Web Frontend Interactive Controller
 */

// Application State
const state = {
    simulationData: null,
    currentCycleIndex: 0,
    isPlaying: false,
    timer: null,
    playbackSpeed: 800,
    opMode: 'SEARCH',
};

// DOM Element Selectors
const elements = {
    cycleNum: document.getElementById('cycle-num'),
    totalCycles: document.getElementById('total-cycles'),
    cycleTime: document.getElementById('cycle-time'),
    btnFirst: document.getElementById('btn-first'),
    btnPrev: document.getElementById('btn-prev'),
    btnPlay: document.getElementById('btn-play'),
    btnNext: document.getElementById('btn-next'),
    btnLast: document.getElementById('btn-last'),
    playbackSpeed: document.getElementById('playback-speed'),
    testcaseList: document.getElementById('testcase-list'),
    
    // Custom Form Controls
    opMode: document.getElementById('op-mode'),
    groupSearchPattern: document.getElementById('group-search-pattern'),
    groupWriteAddr: document.getElementById('group-write-addr'),
    groupWriteData: document.getElementById('group-write-data'),
    inputPattern: document.getElementById('input-pattern'),
    inputWriteAddr: document.getElementById('input-write-addr'),
    inputWriteData: document.getElementById('input-write-data'),
    btnExecuteQuery: document.getElementById('btn-execute-query'),
    btnRecompile: document.getElementById('btn-recompile'),
    systemStatus: document.getElementById('system-status'),
    statusText: document.getElementById('status-text'),
    
    // Gauges & Metrics
    gaugePowerValue: document.getElementById('gauge-power-value'),
    powerBarFill: document.getElementById('power-bar-fill'),
    valPLeakage: document.getElementById('val-p-leakage'),
    valPDynamic: document.getElementById('val-p-dynamic'),
    statEnergy: document.getElementById('stat-energy'),
    statMismatches: document.getElementById('stat-mismatches'),
    statResult: document.getElementById('stat-result'),
    
    // Banner & Matrix
    bannerOpType: document.getElementById('banner-op-type'),
    bannerHex: document.getElementById('banner-hex'),
    bannerBinArray: document.getElementById('banner-bin-array'),
    camGrid: document.getElementById('cam-grid'),
    
    // Waveform & Console
    waveformCanvas: document.getElementById('waveform-canvas'),
    consoleOutput: document.getElementById('console-output'),
    btnCopyLog: document.getElementById('btn-copy-log')
};

// Helper: Convert number to 16-bit binary string
function toBin16(num) {
    return (num >>> 0).toString(2).padStart(16, '0');
}

// Helper: Convert number to 4-digit Hex string
function toHex4(num) {
    return '0x' + (num >>> 0).toString(16).toUpperCase().padStart(4, '0');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadSimulationData();
});

// Setup UI Event Listeners
function setupEventListeners() {
    elements.btnFirst.addEventListener('click', () => jumpToCycle(0));
    elements.btnPrev.addEventListener('click', () => jumpToCycle(state.currentCycleIndex - 1));
    elements.btnNext.addEventListener('click', () => jumpToCycle(state.currentCycleIndex + 1));
    elements.btnLast.addEventListener('click', () => jumpToCycle((state.simulationData?.cycles?.length || 1) - 1));
    elements.btnPlay.addEventListener('click', togglePlayPause);
    
    elements.playbackSpeed.addEventListener('change', (e) => {
        state.playbackSpeed = parseInt(e.target.value, 10);
        if (state.isPlaying) {
            pauseSimulation();
            playSimulation();
        }
    });

    elements.opMode.addEventListener('change', (e) => {
        state.opMode = e.target.value;
        if (state.opMode === 'SEARCH') {
            elements.groupSearchPattern.classList.remove('hidden');
            elements.groupWriteAddr.classList.add('hidden');
            elements.groupWriteData.classList.add('hidden');
        } else {
            elements.groupSearchPattern.classList.add('hidden');
            elements.groupWriteAddr.classList.remove('hidden');
            elements.groupWriteData.classList.remove('hidden');
        }
    });

    // Testcase Quick Buttons
    elements.testcaseList.querySelectorAll('.testcase-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetCycle = parseInt(btn.getAttribute('data-cycle'), 10) - 1;
            jumpToCycle(targetCycle);
            
            elements.testcaseList.querySelectorAll('.testcase-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Custom Execution Trigger
    elements.btnExecuteQuery.addEventListener('click', executeCustomQuery);
    elements.btnRecompile.addEventListener('click', executeSystemCBackend);
    
    elements.btnCopyLog.addEventListener('click', () => {
        const text = elements.consoleOutput.innerText;
        navigator.clipboard.writeText(text);
        alert('Console trace log copied to clipboard!');
    });
}

// Fetch Simulation Trace JSON
async function loadSimulationData() {
    try {
        const response = await fetch('simulation_data.json?t=' + Date.now());
        if (!response.ok) throw new Error('Failed to load JSON');
        state.simulationData = await response.json();
        
        elements.totalCycles.textContent = state.simulationData.cycles.length;
        renderCycle(0);
        logConsole('Loaded SystemC simulation dataset (' + state.simulationData.cycles.length + ' cycles recorded)', 'success');
    } catch (err) {
        logConsole('Notice: Loading default inline simulation profile', 'info');
        loadFallbackData();
    }
}

// Fallback Dataset in case JSON file is missing
function loadFallbackData() {
    state.simulationData = {
        cam_depth: 10,
        cam_width: 16,
        p_leakage_mw: 0.002,
        e_mismatch_factor: 0.015,
        cycles: [
            {
                cycle: 1,
                time_ns: 0,
                op_type: "SEARCH",
                search_pattern: "0xa5a5",
                search_pattern_dec: 42405,
                hit: true,
                hit_addr: 0,
                total_mismatches: 21,
                power_mw: 0.317,
                accumulated_energy_mj: 0.00000317,
                cam_snapshot: [42405, 42406, 42407, 42408, 42409, 42410, 42411, 42412, 42413, 42414],
                line_mismatches: [0, 2, 1, 3, 2, 4, 3, 2, 1, 3]
            },
            {
                cycle: 2,
                time_ns: 10,
                op_type: "SEARCH",
                search_pattern: "0x5a5a",
                search_pattern_dec: 23130,
                hit: false,
                hit_addr: -1,
                total_mismatches: 139,
                power_mw: 2.087,
                accumulated_energy_mj: 0.00002721,
                cam_snapshot: [42405, 42406, 42407, 42408, 42409, 42410, 42411, 42412, 42413, 42414],
                line_mismatches: [16, 14, 15, 13, 14, 12, 13, 14, 15, 13]
            },
            {
                cycle: 3,
                time_ns: 20,
                op_type: "WRITE",
                search_pattern: "0x5a5a",
                search_pattern_dec: 23130,
                write_data: "0xdead",
                write_addr: 5,
                hit: false,
                hit_addr: -1,
                total_mismatches: 0,
                power_mw: 0.002,
                accumulated_energy_mj: 0.00002721,
                cam_snapshot: [42405, 42406, 42407, 42408, 42409, 57005, 42411, 42412, 42413, 42414],
                line_mismatches: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                cycle: 4,
                time_ns: 30,
                op_type: "SEARCH",
                search_pattern: "0xdead",
                search_pattern_dec: 57005,
                hit: true,
                hit_addr: 5,
                total_mismatches: 68,
                power_mw: 1.022,
                accumulated_energy_mj: 0.00003743,
                cam_snapshot: [42405, 42406, 42407, 42408, 42409, 57005, 42411, 42412, 42413, 42414],
                line_mismatches: [7, 9, 8, 8, 7, 0, 8, 7, 6, 8]
            },
            {
                cycle: 5,
                time_ns: 40,
                op_type: "SEARCH",
                search_pattern: "0xa5a4",
                search_pattern_dec: 42404,
                hit: false,
                hit_addr: -1,
                total_mismatches: 26,
                power_mw: 0.392,
                accumulated_energy_mj: 0.00004135,
                cam_snapshot: [42405, 42406, 42407, 42408, 42409, 57005, 42411, 42412, 42413, 42414],
                line_mismatches: [1, 1, 2, 2, 3, 8, 4, 1, 2, 2]
            }
        ]
    };
    elements.totalCycles.textContent = state.simulationData.cycles.length;
    renderCycle(0);
}

// Render Specific Cycle Data
function renderCycle(index) {
    if (!state.simulationData || !state.simulationData.cycles[index]) return;
    state.currentCycleIndex = index;
    const cycle = state.simulationData.cycles[index];

    // Update Header Counter
    elements.cycleNum.textContent = cycle.cycle;
    elements.cycleTime.textContent = cycle.time_ns.toFixed(1);

    // Update Search Query Banner
    elements.bannerOpType.textContent = cycle.op_type;
    elements.bannerOpType.className = 'badge-op ' + cycle.op_type.toLowerCase();
    
    const searchValDec = cycle.search_pattern_dec || parseInt(cycle.search_pattern, 16);
    const searchBinStr = toBin16(searchValDec);
    elements.bannerHex.textContent = '0x' + searchValDec.toString(16).toUpperCase().padStart(4, '0');

    // Render Query Binary Chips
    elements.bannerBinArray.innerHTML = '';
    for (let b = 0; b < 16; b++) {
        const chip = document.createElement('div');
        chip.className = 'bin-chip';
        chip.textContent = searchBinStr[b];
        elements.bannerBinArray.appendChild(chip);
    }

    // Render Power & Metrics
    elements.gaugePowerValue.textContent = cycle.power_mw.toFixed(3);
    const maxPower = 2.5; // mW max scale
    const barWidthPercent = Math.min(100, Math.max(5, (cycle.power_mw / maxPower) * 100));
    elements.powerBarFill.style.width = barWidthPercent + '%';

    const leakage = state.simulationData.p_leakage_mw || 0.002;
    const dynamicP = Math.max(0, cycle.power_mw - leakage);
    elements.valPLeakage.textContent = leakage.toFixed(3) + ' mW';
    elements.valPDynamic.textContent = dynamicP.toFixed(3) + ' mW';
    elements.statEnergy.textContent = (cycle.accumulated_energy_mj || 0).toExponential(3) + ' mJ';
    elements.statMismatches.textContent = cycle.total_mismatches + ' bits';

    if (cycle.op_type === 'WRITE') {
        elements.statResult.textContent = 'WRITE @ Index ' + cycle.write_addr;
        elements.statResult.className = 'stat-value';
        elements.statResult.style.color = 'var(--purple-write)';
    } else if (cycle.hit) {
        elements.statResult.textContent = 'HIT @ Index ' + cycle.hit_addr;
        elements.statResult.className = 'stat-value badge-hit';
    } else {
        elements.statResult.textContent = 'MISS (No Match)';
        elements.statResult.className = 'stat-value badge-miss';
    }

    // Render 10x16 CAM Matrix Grid
    renderCamGrid(cycle);

    // Draw Waveform Signal Diagram
    drawWaveformTimeline();

    // Log Console Message
    if (cycle.op_type === 'WRITE') {
        logConsole(`[CAM WRITE] @${cycle.time_ns} ns | Addr: ${cycle.write_addr} | Data: ${cycle.write_data}`, 'info');
    } else {
        logConsole(`[CAM SEARCH] @${cycle.time_ns} ns | Pattern: ${cycle.search_pattern} | Result: ${cycle.hit ? 'HIT' : 'MISS'} | Addr: ${cycle.hit_addr} | Bit Mismatches: ${cycle.total_mismatches} | Power: ${cycle.power_mw} mW`, cycle.hit ? 'success' : 'warn');
    }
}

// Render 10x16 CAM Grid Array
function renderCamGrid(cycle) {
    elements.camGrid.innerHTML = '';
    const camArray = cycle.cam_snapshot || [];
    const lineMismatches = cycle.line_mismatches || [];
    const searchValDec = cycle.search_pattern_dec || parseInt(cycle.search_pattern, 16);

    for (intIdx = 0; intIdx < 10; intIdx++) {
        const rowValDec = camArray[intIdx] || 0;
        const rowBinStr = toBin16(rowValDec);
        const searchBinStr = toBin16(searchValDec);

        const isHitRow = (cycle.op_type === 'SEARCH' && cycle.hit && cycle.hit_addr === intIdx);
        const isWriteRow = (cycle.op_type === 'WRITE' && cycle.write_addr === intIdx);

        const rowElem = document.createElement('div');
        rowElem.className = 'cam-row' + (isHitRow ? ' is-hit' : '') + (isWriteRow ? ' is-write-target' : '');

        // Row Label
        const labelElem = document.createElement('div');
        labelElem.className = 'row-label';
        labelElem.innerHTML = `Entry <strong>${intIdx}</strong>`;

        // 16 Bit Cells
        const cellsContainer = document.createElement('div');
        cellsContainer.className = 'bit-cells-container';

        let rowMismatchCount = 0;
        for (let b = 0; b < 16; b++) {
            const bitCell = document.createElement('div');
            const isMatch = (rowBinStr[b] === searchBinStr[b]);

            if (cycle.op_type === 'SEARCH') {
                if (isMatch) {
                    bitCell.className = 'bit-cell matched';
                } else {
                    bitCell.className = 'bit-cell mismatched';
                    rowMismatchCount++;
                }
            } else {
                bitCell.className = 'bit-cell';
            }

            bitCell.textContent = rowBinStr[b];
            cellsContainer.appendChild(bitCell);
        }

        // Mismatch Count Label
        const mismatchElem = document.createElement('div');
        mismatchElem.className = 'row-mismatches';
        mismatchElem.textContent = (cycle.op_type === 'SEARCH') ? `${lineMismatches[intIdx] ?? rowMismatchCount} diff bits` : '0 diff bits';

        // Match Line Status Badge
        const matchBadge = document.createElement('div');
        if (cycle.op_type === 'SEARCH') {
            if (lineMismatches[intIdx] === 0 || isHitRow) {
                matchBadge.className = 'match-line-badge hit';
                matchBadge.textContent = 'MATCH HIT';
            } else {
                matchBadge.className = 'match-line-badge miss';
                matchBadge.textContent = 'DISCHARGED';
            }
        } else {
            matchBadge.className = 'match-line-badge miss';
            matchBadge.textContent = isWriteRow ? 'WRITING' : 'IDLE';
        }

        rowElem.appendChild(labelElem);
        rowElem.appendChild(cellsContainer);
        rowElem.appendChild(mismatchElem);
        rowElem.appendChild(matchBadge);

        elements.camGrid.appendChild(rowElem);
    }
}

// Draw HTML5 Canvas Waveform Trace Timeline
function drawWaveformTimeline() {
    const canvas = elements.waveformCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 800;
    canvas.height = 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cycles = state.simulationData?.cycles || [];
    if (cycles.length === 0) return;

    const padding = 60;
    const graphWidth = canvas.width - padding - 20;
    const stepX = graphWidth / Math.max(1, cycles.length - 1);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    const signals = [
        { name: 'clk', y: 30, color: '#06b6d4' },
        { name: 'write_en', y: 70, color: '#a855f7' },
        { name: 'match_found', y: 110, color: '#10b981' },
        { name: 'power_mw', y: 150, color: '#f59e0b' }
    ];

    signals.forEach(sig => {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Fira Code';
        ctx.fillText(sig.name, 10, sig.y + 4);

        ctx.beginPath();
        ctx.moveTo(padding, sig.y);
        ctx.lineTo(canvas.width - 20, sig.y);
        ctx.stroke();
    });

    // Draw signals for each cycle
    signals.forEach(sig => {
        ctx.strokeStyle = sig.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        cycles.forEach((c, idx) => {
            const x = padding + idx * stepX;
            let val = 0;
            if (sig.name === 'clk') val = (idx % 2 === 0) ? 1 : 0;
            else if (sig.name === 'write_en') val = (c.op_type === 'WRITE') ? 1 : 0;
            else if (sig.name === 'match_found') val = c.hit ? 1 : 0;
            else if (sig.name === 'power_mw') val = Math.min(1, c.power_mw / 2.5);

            const yHigh = sig.y - 12;
            const yLow = sig.y + 4;
            const yPos = sig.name === 'power_mw' ? (sig.y - (val * 18)) : (val ? yHigh : yLow);

            if (idx === 0) {
                ctx.moveTo(x, yPos);
            } else {
                if (sig.name !== 'power_mw') {
                    const prevX = padding + (idx - 1) * stepX;
                    ctx.lineTo(x, ctx.lastY || yPos);
                }
                ctx.lineTo(x, yPos);
            }
            ctx.lastY = yPos;
        });
        ctx.stroke();
    });

    // Draw Current Cycle Vertical Cursor Indicator
    const cursorX = padding + state.currentCycleIndex * stepX;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, 10);
    ctx.lineTo(cursorX, canvas.height - 10);
    ctx.stroke();
    ctx.setLineDash([]);
}

// Playback Control Functions
function togglePlayPause() {
    if (state.isPlaying) {
        pauseSimulation();
    } else {
        playSimulation();
    }
}

function playSimulation() {
    state.isPlaying = true;
    elements.btnPlay.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> <span>Pause</span>';
    state.timer = setInterval(() => {
        if (state.currentCycleIndex < (state.simulationData?.cycles?.length || 1) - 1) {
            renderCycle(state.currentCycleIndex + 1);
        } else {
            jumpToCycle(0);
        }
    }, state.playbackSpeed);
}

function pauseSimulation() {
    state.isPlaying = false;
    elements.btnPlay.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> <span>Play</span>';
    if (state.timer) clearInterval(state.timer);
}

function jumpToCycle(idx) {
    if (!state.simulationData) return;
    const maxIdx = state.simulationData.cycles.length - 1;
    const target = Math.max(0, Math.min(maxIdx, idx));
    renderCycle(target);
}

// Execute Interactive Search/Write Query via Backend API
async function executeCustomQuery() {
    const mode = state.opMode;
    let patternHex = elements.inputPattern.value.trim().replace(/^0x/i, '');
    const writeAddr = parseInt(elements.inputWriteAddr.value, 10);
    let writeDataHex = elements.inputWriteData.value.trim().replace(/^0x/i, '');

    patternHex = patternHex.padStart(4, '0').slice(-4);
    writeDataHex = writeDataHex.padStart(4, '0').slice(-4);

    const patternDec = parseInt(patternHex, 16);
    const writeDataDec = parseInt(writeDataHex, 16);

    elements.statusText.textContent = 'Evaluating SystemC...';
    elements.systemStatus.className = 'status-badge';

    try {
        const response = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                op_mode: mode,
                pattern: patternDec,
                write_addr: writeAddr,
                write_data: writeDataDec
            })
        });

        if (response.ok) {
            const newDataset = await response.json();
            state.simulationData = newDataset;
            elements.totalCycles.textContent = state.simulationData.cycles.length;
            renderCycle(state.simulationData.cycles.length - 1);
            elements.statusText.textContent = 'SystemC Engine Ready';
            elements.systemStatus.className = 'status-badge live';
            logConsole(`Custom ${mode} (0x${patternHex.toUpperCase()}) computed live by SystemC backend`, 'success');
            return;
        }
    } catch (err) {
        // Fallback live calculation in client JS if web server API endpoint is offline
        simulateInJS(mode, patternDec, writeAddr, writeDataDec);
        elements.statusText.textContent = 'Client Engine Active';
        elements.systemStatus.className = 'status-badge live';
    }
}

// Trigger Backend SystemC Re-compilation & Re-run
async function executeSystemCBackend() {
    elements.statusText.textContent = 'Running sim.exe...';
    try {
        const res = await fetch('/api/recompile', { method: 'POST' });
        if (res.ok) {
            await loadSimulationData();
            elements.statusText.textContent = 'SystemC Engine Ready';
            logConsole('Re-compiled and executed SystemC C++ backend binary successfully', 'success');
        }
    } catch (e) {
        logConsole('Running standalone mode (sim.exe output read locally)', 'info');
        loadSimulationData();
    }
}

// Local simulation fallback if standalone static html
function simulateInJS(mode, patternDec, writeAddr, writeDataDec) {
    const lastCycle = state.simulationData.cycles[state.simulationData.cycles.length - 1];
    const newCycleIdx = state.simulationData.cycles.length + 1;
    const newTime = lastCycle.time_ns + 10;
    const currentSnapshot = [...lastCycle.cam_snapshot];

    let hit = false;
    let hitAddr = -1;
    let totalMismatches = 0;
    const lineMismatches = [];

    if (mode === 'WRITE') {
        if (writeAddr >= 0 && writeAddr < 10) {
            currentSnapshot[writeAddr] = writeDataDec;
        }
    } else {
        for (let i = 0; i < 10; i++) {
            const entry = currentSnapshot[i];
            const xorMap = entry ^ patternDec;
            let diffs = 0;
            for (let b = 0; b < 16; b++) {
                if ((xorMap & (1 << b)) !== 0) diffs++;
            }
            lineMismatches.push(diffs);
            totalMismatches += diffs;

            if (diffs === 0 && !hit) {
                hit = true;
                hitAddr = i;
            }
        }
    }

    const pLeakage = 0.002;
    const powerMw = (mode === 'WRITE') ? pLeakage : (pLeakage + totalMismatches * 0.015);
    const accumEnergy = lastCycle.accumulated_energy_mj + (powerMw * 10e-6);

    const newCycle = {
        cycle: newCycleIdx,
        time_ns: newTime,
        op_type: mode,
        search_pattern: '0x' + patternDec.toString(16).padStart(4, '0'),
        search_pattern_dec: patternDec,
        write_data: '0x' + writeDataDec.toString(16).padStart(4, '0'),
        write_addr: writeAddr,
        hit: hit,
        hit_addr: hitAddr,
        total_mismatches: totalMismatches,
        power_mw: powerMw,
        accumulated_energy_mj: accumEnergy,
        cam_snapshot: currentSnapshot,
        line_mismatches: lineMismatches
    };

    state.simulationData.cycles.push(newCycle);
    elements.totalCycles.textContent = state.simulationData.cycles.length;
    renderCycle(state.simulationData.cycles.length - 1);
    logConsole(`[LIVE SIM] Calculated ${mode} cycle for 0x${patternDec.toString(16).toUpperCase()}`, 'success');
}

// Log line into Console Box
function logConsole(msg, type = 'info') {
    const line = document.createElement('div');
    line.className = 'log-line ' + type;
    line.textContent = msg;
    elements.consoleOutput.appendChild(line);
    elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
}
