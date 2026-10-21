/**
 * CAM-PET // ESL Workbench - Interactive Frontend Controller
 * SystemC 10x16 CAM Power Estimation & Verification EDA Dashboard
 */

// Canonical Test Case Definitions
const PRESET_TEST_CASES = [
    { id: 'TC1', name: 'TC1: 0xA5A5', op: 'SEARCH', pattern: 0xA5A5, desc: 'Exact Match @ Row 0 &bull; 0.317 mW' },
    { id: 'TC2', name: 'TC2: 0x5A5A', op: 'SEARCH', pattern: 0x5A5A, desc: '139b Miss &bull; 2.087 mW' },
    { id: 'TC3', name: 'TC3: Direct Write', op: 'WRITE', writeAddr: 3, writeData: 0x1234, desc: 'Direct @ Row 3 &bull; 0.002 mW' },
    { id: 'TC4', name: 'TC4: Indirect Write', op: 'WRITE', writeAddr: 5, writeData: 0xDEAD, desc: 'Indirect Base 2+3 &bull; 0.002 mW' },
    { id: 'TC5', name: 'TC5: 0xDEAD', op: 'SEARCH', pattern: 0xDEAD, desc: 'Hit @ Row 5 &bull; 1.022 mW' }
];

// Application State
const state = {
    simulationData: null,
    currentCycleIndex: 0,
    isPlaying: false,
    timer: null,
    playbackSpeed: 800,
    opMode: 'SEARCH'
};

// DOM Element Cache
let dom = {};

// Helper: Convert number to 16-bit binary string
function toBin16(num) {
    return (Number(num) >>> 0).toString(2).padStart(16, '0');
}

// Helper: Convert number to 4-digit Hex string
function toHex4(num) {
    return '0x' + (Number(num) >>> 0).toString(16).toUpperCase().padStart(4, '0');
}

// Clean Hex Parsing without throwing NaN
function parseHexSafe(str, defaultVal = 0) {
    if (typeof str === 'number') return str & 0xFFFF;
    if (!str) return defaultVal;
    const clean = str.trim().replace(/^0x/i, '');
    const val = parseInt(clean, 16);
    return isNaN(val) ? defaultVal : (val & 0xFFFF);
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    setupEventListeners();
    setupKeyboardShortcuts();
    loadSimulationData();
});

function cacheDomElements() {
    dom = {
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
        
        // Navigation & Status
        systemStatus: document.getElementById('system-status'),
        statusText: document.getElementById('status-text'),
        btnRecompile: document.getElementById('btn-recompile'),
        btnReset: document.getElementById('btn-reset'),

        // Radial Gauge & Power Breakdown
        gaugeArc: document.getElementById('gauge-arc'),
        gaugePowerValue: document.getElementById('gauge-power-value'),
        statEnergy: document.getElementById('stat-energy'),
        regimeTag: document.getElementById('regime-tag'),
        breakdownTotal: document.getElementById('breakdown-total'),
        barLeakage: document.getElementById('bar-leakage'),
        barDynamic: document.getElementById('bar-dynamic'),
        valPLeakage: document.getElementById('val-p-leakage'),
        valPDynamic: document.getElementById('val-p-dynamic'),
        statResult: document.getElementById('stat-result'),
        statMismatches: document.getElementById('stat-mismatches'),

        // Command Injection Form
        modeSearch: document.getElementById('mode-search'),
        modeWrite: document.getElementById('mode-write'),
        groupSearchPattern: document.getElementById('group-search-pattern'),
        groupWriteControls: document.getElementById('group-write-controls'),
        inputPattern: document.getElementById('input-pattern'),
        inputWriteAddr: document.getElementById('input-write-addr'),
        inputWriteData: document.getElementById('input-write-data'),
        patternValidity: document.getElementById('pattern-validity'),
        btnExecuteQuery: document.getElementById('btn-execute-query'),

        // Banner & CAM Grid
        bannerOpType: document.getElementById('banner-op-type'),
        bannerHex: document.getElementById('banner-hex'),
        bannerBinArray: document.getElementById('banner-bin-array'),
        camGrid: document.getElementById('cam-grid'),

        // Telemetry Console
        consoleOutput: document.getElementById('console-output'),
        btnCopyLog: document.getElementById('btn-copy-log'),
        btnClearLog: document.getElementById('btn-clear-log')
    };
}

// Setup Event Handlers
function setupEventListeners() {
    // Stepper Controls
    dom.btnFirst.addEventListener('click', () => jumpToCycle(0));
    dom.btnPrev.addEventListener('click', () => jumpToCycle(state.currentCycleIndex - 1));
    dom.btnNext.addEventListener('click', () => jumpToCycle(state.currentCycleIndex + 1));
    dom.btnLast.addEventListener('click', () => jumpToCycle((state.simulationData?.cycles?.length || 1) - 1));
    dom.btnPlay.addEventListener('click', togglePlayPause);

    dom.playbackSpeed.addEventListener('change', (e) => {
        state.playbackSpeed = parseInt(e.target.value, 10);
        if (state.isPlaying) {
            pauseSimulation();
            playSimulation();
        }
    });

    // Test Case Quick Buttons
    dom.testcaseList.querySelectorAll('.tc-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const tcIndex = parseInt(btn.getAttribute('data-tc-index'), 10);
            jumpToTestCase(tcIndex);
        });
    });

    // Segmented Mode Switch
    dom.modeSearch.addEventListener('click', () => setOperationMode('SEARCH'));
    dom.modeWrite.addEventListener('click', () => setOperationMode('WRITE'));

    // Input Validation Feedback
    dom.inputPattern.addEventListener('input', () => {
        const val = dom.inputPattern.value.trim().replace(/^0x/i, '');
        const isValid = /^[0-9A-Fa-f]{1,4}$/.test(val);
        dom.patternValidity.textContent = isValid ? '16-bit' : 'Invalid';
        dom.patternValidity.style.color = isValid ? 'var(--emerald-hit)' : 'var(--rose-miss)';
    });

    // Command Triggers
    dom.btnExecuteQuery.addEventListener('click', executeCustomQuery);
    dom.btnRecompile.addEventListener('click', executeSystemCBackend);
    dom.btnReset.addEventListener('click', resetToBaseline);

    // Console Actions
    dom.btnCopyLog.addEventListener('click', () => {
        const text = dom.consoleOutput.innerText;
        navigator.clipboard.writeText(text).then(() => {
            logConsole('Console log copied to clipboard', 'info');
        });
    });

    dom.btnClearLog.addEventListener('click', () => {
        dom.consoleOutput.innerHTML = '';
        logConsole('Console buffer cleared', 'info');
    });


}

// Global Keyboard Navigation
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Ignore if user is currently typing in input fields
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeCustomQuery();
            }
            return;
        }

        switch (e.key) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                jumpToCycle(state.currentCycleIndex - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                jumpToCycle(state.currentCycleIndex + 1);
                break;
            case 'Home':
                e.preventDefault();
                jumpToCycle(0);
                break;
            case 'End':
                e.preventDefault();
                jumpToCycle((state.simulationData?.cycles?.length || 1) - 1);
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                e.preventDefault();
                jumpToTestCase(parseInt(e.key, 10) - 1);
                break;
        }
    });
}

function setOperationMode(mode) {
    state.opMode = mode;
    if (mode === 'SEARCH') {
        dom.modeSearch.classList.add('active');
        dom.modeWrite.classList.remove('active');
        dom.groupSearchPattern.classList.remove('hidden');
        dom.groupWriteControls.classList.add('hidden');
    } else {
        dom.modeWrite.classList.add('active');
        dom.modeSearch.classList.remove('active');
        dom.groupSearchPattern.classList.add('hidden');
        dom.groupWriteControls.classList.remove('hidden');
    }
}

// Load Simulation Dataset from Backend
async function loadSimulationData() {
    dom.statusText.textContent = 'Loading Dataset...';
    try {
        const res = await fetch('/simulation_data.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        if (!data || !Array.isArray(data.cycles) || data.cycles.length === 0) {
            throw new Error('Invalid JSON structure');
        }

        state.simulationData = data;
        dom.totalCycles.textContent = data.cycles.length;
        dom.statusText.textContent = 'SystemC Kernel Active';
        dom.systemStatus.className = 'engine-badge live';
        
        renderCycle(0);
        logConsole(`[DATASET] Loaded ${data.cycles.length} cycles from SystemC simulation trace`, 'success');
    } catch (err) {
        console.warn('Falling back to built-in simulation dataset:', err);
        loadFallbackDataset();
    }
}

// Fallback Dataset for Standalone Testing
function loadFallbackDataset() {
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
                accumulated_energy_mj: 0.00002404,
                cam_snapshot: [42405, 42406, 42407, 42408, 42409, 42410, 42411, 42412, 42413, 42414],
                line_mismatches: [16, 14, 15, 13, 14, 12, 13, 14, 15, 13]
            },
            {
                cycle: 3,
                time_ns: 20,
                op_type: "WRITE",
                addr_mode_indirect: false,
                base_pointer: 2,
                write_addr_offset: 3,
                effective_addr: 3,
                search_pattern: "0x5a5a",
                search_pattern_dec: 23130,
                write_data: "0x1234",
                write_addr: 3,
                hit: false,
                hit_addr: -1,
                total_mismatches: 0,
                power_mw: 0.002,
                accumulated_energy_mj: 0.00002404,
                cam_snapshot: [42405, 42406, 42407, 4660, 42409, 42410, 42411, 42412, 42413, 42414],
                line_mismatches: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                cycle: 4,
                time_ns: 30,
                op_type: "WRITE",
                addr_mode_indirect: true,
                base_pointer: 2,
                write_addr_offset: 3,
                effective_addr: 5,
                search_pattern: "0x5a5a",
                search_pattern_dec: 23130,
                write_data: "0xdead",
                write_addr: 5,
                hit: false,
                hit_addr: -1,
                total_mismatches: 0,
                power_mw: 0.002,
                accumulated_energy_mj: 0.00002404,
                cam_snapshot: [42405, 42406, 42407, 4660, 42409, 57005, 42411, 42412, 42413, 42414],
                line_mismatches: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                cycle: 5,
                time_ns: 40,
                op_type: "SEARCH",
                addr_mode_indirect: false,
                base_pointer: 2,
                write_addr_offset: 3,
                effective_addr: 0,
                search_pattern: "0xdead",
                search_pattern_dec: 57005,
                write_data: "0xdead",
                write_addr: 5,
                hit: true,
                hit_addr: 5,
                total_mismatches: 68,
                power_mw: 1.022,
                accumulated_energy_mj: 0.00003426,
                cam_snapshot: [42405, 42406, 42407, 4660, 42409, 57005, 42411, 42412, 42413, 42414],
                line_mismatches: [7, 9, 8, 8, 7, 0, 8, 7, 6, 8]
            }
        ]
    };
    dom.totalCycles.textContent = state.simulationData.cycles.length;
    dom.statusText.textContent = 'Standalone Client Active';
    dom.systemStatus.className = 'engine-badge';
    renderCycle(0);
    logConsole('[STANDALONE] Loaded baseline 5-cycle verification profile', 'info');
}

// Jump to Specific Preset Test Case (Fix for Test Case Button Bug)
function jumpToTestCase(tcIndex) {
    if (!state.simulationData || !Array.isArray(state.simulationData.cycles)) return;
    const tc = PRESET_TEST_CASES[tcIndex];
    if (!tc) return;

    const cycles = state.simulationData.cycles;
    let targetIndex = -1;

    // Smart Matching by Operation & Pattern
    if (tc.op === 'WRITE') {
        if (tc.id === 'TC3') {
            targetIndex = cycles.findIndex(c => c.op_type === 'WRITE' && (c.write_addr === 3 || (c.write_data && c.write_data.toLowerCase().includes('1234'))));
        } else if (tc.id === 'TC4') {
            targetIndex = cycles.findIndex(c => c.op_type === 'WRITE' && (c.write_addr === 5 || (c.write_data && c.write_data.toLowerCase().includes('dead'))));
        } else {
            targetIndex = cycles.findIndex(c => c.op_type === 'WRITE' && c.write_addr === tc.writeAddr);
        }
    } else {
        const hexLow = '0x' + tc.pattern.toString(16).toLowerCase();
        targetIndex = cycles.findIndex(c => c.op_type === 'SEARCH' && (
            c.search_pattern_dec === tc.pattern ||
            (c.search_pattern && c.search_pattern.toLowerCase() === hexLow)
        ));
    }

    // Fallback: If not found by pattern match, use direct 0-based array index
    if (targetIndex === -1) {
        targetIndex = Math.max(0, Math.min(tcIndex, cycles.length - 1));
    }

    jumpToCycle(targetIndex);
}

// Jump to Cycle Index
function jumpToCycle(idx) {
    if (!state.simulationData || !Array.isArray(state.simulationData.cycles)) return;
    const maxIdx = state.simulationData.cycles.length - 1;
    const target = Math.max(0, Math.min(maxIdx, idx));
    renderCycle(target);
}

// Primary Render Engine
function renderCycle(index) {
    if (!state.simulationData || !state.simulationData.cycles[index]) return;
    state.currentCycleIndex = index;
    const cycle = state.simulationData.cycles[index];

    // 1. Update Stepper Header
    dom.cycleNum.textContent = cycle.cycle || (index + 1);
    dom.totalCycles.textContent = state.simulationData.cycles.length;
    dom.cycleTime.textContent = Number(cycle.time_ns).toFixed(1);

    // 2. Synchronize Test Case Preset Pill Buttons
    synchronizeActiveTestCase(cycle, index);

    // 3. Update Operation & Query Broadcast Banner
    renderQueryBanner(cycle);

    // 4. Update Instant Power & Energy Gauges
    renderPowerGauges(cycle);

    // 5. Render 10x16 Interactive CAM Hardware Array
    renderCamGrid(cycle);



    // 7. Emit Timestamped Log Entry
    emitConsoleLog(cycle);
}

// Synchronize Toolbar Active Pill
function synchronizeActiveTestCase(cycle, index) {
    const pills = dom.testcaseList.querySelectorAll('.tc-pill');
    pills.forEach(p => p.classList.remove('active'));

    // Check if current cycle matches any preset test case
    let activeTc = -1;
    if (cycle.op_type === 'WRITE') {
        const writeData = cycle.write_data ? parseInt(cycle.write_data, 16) : 0;
        // TC4: Indirect Write (addr_mode_indirect == true, write_data == 0xDEAD, effective_addr == 5)
        // TC3: Direct Write (addr_mode_indirect == false, write_data == 0x1234, effective_addr == 3)
        if (cycle.addr_mode_indirect === true || writeData === 0xDEAD || cycle.effective_addr === 5 || cycle.write_addr === 5) {
            activeTc = 3; // TC4: Indirect Write
        } else if (cycle.addr_mode_indirect === false || writeData === 0x1234 || cycle.effective_addr === 3 || cycle.write_addr === 3) {
            activeTc = 2; // TC3: Direct Write
        } else {
            activeTc = 2; // Default write fallback
        }
    } else {
        const dec = cycle.search_pattern_dec || parseInt(cycle.search_pattern, 16);
        if (dec === 0xA5A5) activeTc = 0;       // TC1: 0xA5A5
        else if (dec === 0x5A5A) activeTc = 1;  // TC2: 0x5A5A
        else if (dec === 0xDEAD) activeTc = 4;  // TC5: 0xDEAD (Verification Hit @ Row 5)
    }

    // Direct fallback by cycle index if activeTc could not be resolved from pattern/data
    if (activeTc === -1 && typeof index === 'number' && index >= 0 && index < PRESET_TEST_CASES.length) {
        activeTc = index;
    }

    if (activeTc !== -1 && pills[activeTc]) {
        pills[activeTc].classList.add('active');
    }
}

// Render Query Broadcast Banner
function renderQueryBanner(cycle) {
    const isWrite = cycle.op_type === 'WRITE';
    dom.bannerOpType.textContent = isWrite ? 'WRITE OP' : 'SEARCH';
    dom.bannerOpType.className = 'op-badge ' + (isWrite ? 'write' : 'search');

    const searchVal = cycle.search_pattern_dec || parseInt(cycle.search_pattern, 16) || 0;
    const writeVal = cycle.write_data ? parseInt(cycle.write_data, 16) : 0;
    const activeVal = isWrite ? writeVal : searchVal;
    const binStr = toBin16(activeVal);

    dom.bannerHex.textContent = toHex4(activeVal);

    // Render 16 Bit Chips
    dom.bannerBinArray.innerHTML = '';
    for (let b = 0; b < 16; b++) {
        const chip = document.createElement('div');
        chip.className = 'bit-chip';
        chip.textContent = binStr[b];
        dom.bannerBinArray.appendChild(chip);
    }
}

// Render Radial Arc Gauge & Power Breakdown
function renderPowerGauges(cycle) {
    const power = Number(cycle.power_mw || 0);
    dom.gaugePowerValue.textContent = power.toFixed(3);

    // Energy formatting
    const energy = Number(cycle.accumulated_energy_mj || 0);
    if (energy < 0.001) {
        dom.statEnergy.textContent = (energy * 1000).toFixed(3) + ' µJ';
    } else {
        dom.statEnergy.textContent = energy.toFixed(4) + ' mJ';
    }

    // Radial Gauge Arc Stroke (Circumference: 2 * PI * 66 = 414.69)
    const maxScale = 2.5; // mW
    const circumference = 414.69;
    const fillRatio = Math.min(1.0, Math.max(0.01, power / maxScale));
    const offset = circumference * (1 - fillRatio);
    dom.gaugeArc.style.strokeDashoffset = offset;

    // Dynamic Color Arc Transition
    let arcColor = 'var(--emerald-hit)';
    let regime = 'MATCH HIT';
    let regimeClass = 'pill-badge hit';

    if (power === 0.0) {
        arcColor = 'var(--text-muted)';
        regime = 'CLOCK GATED';
        regimeClass = 'pill-badge';
    } else if (power <= 0.005) {
        arcColor = 'var(--purple-write)';
        regime = 'LEAKAGE (2 µW)';
        regimeClass = 'pill-badge write';
    } else if (power <= 0.45) {
        arcColor = 'var(--emerald-hit)';
        regime = cycle.hit ? 'MATCH HIT' : 'LOW MISS';
        regimeClass = cycle.hit ? 'pill-badge hit' : 'pill-badge low';
    } else if (power <= 1.2) {
        arcColor = 'var(--amber-power)';
        regime = 'MED POWER';
        regimeClass = 'pill-badge low';
    } else {
        arcColor = 'var(--rose-miss)';
        regime = 'PEAK MISS (2.09 mW)';
        regimeClass = 'pill-badge peak';
    }

    dom.gaugeArc.style.stroke = arcColor;
    dom.regimeTag.textContent = regime;
    dom.regimeTag.className = regimeClass;

    // Power Breakdown: Static Leakage vs Dynamic Switching
    const pLeakage = Number(state.simulationData?.p_leakage_mw || 0.002);
    const pDynamic = Math.max(0, power - pLeakage);
    const dynamicPercent = power > 0 ? (pDynamic / power) * 100 : 0;
    const leakagePercent = power > 0 ? (pLeakage / power) * 100 : 100;

    dom.barLeakage.style.width = leakagePercent.toFixed(1) + '%';
    dom.barDynamic.style.width = dynamicPercent.toFixed(1) + '%';
    dom.breakdownTotal.textContent = `P_tot = ${power.toFixed(3)} mW`;
    dom.valPLeakage.textContent = pLeakage.toFixed(3) + ' mW';
    dom.valPDynamic.textContent = pDynamic.toFixed(3) + ' mW';

    // Result & Mismatch tiles
    dom.statMismatches.textContent = `${cycle.total_mismatches || 0} bits`;
    if (cycle.op_type === 'WRITE') {
        dom.statResult.textContent = `WRITE @ Row ${cycle.write_addr}`;
        dom.statResult.className = 'tile-stat';
        dom.statResult.style.color = 'var(--purple-write)';
    } else if (cycle.hit) {
        dom.statResult.textContent = `HIT @ Row ${cycle.hit_addr}`;
        dom.statResult.className = 'tile-stat hit-text';
        dom.statResult.style.color = 'var(--emerald-hit)';
    } else {
        dom.statResult.textContent = 'MISS (No Match)';
        dom.statResult.className = 'tile-stat miss-text';
        dom.statResult.style.color = 'var(--rose-miss)';
    }
}

// Render 10x16 Interactive CAM Memory Grid
function renderCamGrid(cycle) {
    dom.camGrid.innerHTML = '';
    const camArray = cycle.cam_snapshot || [];
    const lineMismatches = cycle.line_mismatches || [];
    const searchValDec = cycle.search_pattern_dec || parseInt(cycle.search_pattern, 16) || 0;
    const searchBinStr = toBin16(searchValDec);

    for (let r = 0; r < 10; r++) {
        const rowValDec = camArray[r] || 0;
        const rowBinStr = toBin16(rowValDec);
        const isWinningRow = (cycle.op_type === 'SEARCH' && cycle.hit && cycle.hit_addr === r);
        const isWriteRow = (cycle.op_type === 'WRITE' && cycle.write_addr === r);

        const rowElem = document.createElement('div');
        rowElem.className = 'cam-row' + (isWinningRow ? ' is-winning-hit' : '') + (isWriteRow ? ' is-write-target' : '');

        // Col 1: Entry Index
        const indexCell = document.createElement('div');
        indexCell.className = 'row-index-cell';
        indexCell.textContent = `Row ${r}`;

        // Col 2: 16 Bit Blocks with Interactive XOR Tooltip
        const bitsStrip = document.createElement('div');
        bitsStrip.className = 'bit-cell-strip';

        let rowDiffCount = 0;
        for (let b = 0; b < 16; b++) {
            const bitBlock = document.createElement('div');
            const bitVal = rowBinStr[b];
            const queryBit = searchBinStr[b];
            const isMatch = (bitVal === queryBit);

            let blockState = 'bit-idle';
            let tooltipText = `Bit [${15 - b}]: Stored = ${bitVal}`;

            if (cycle.op_type === 'SEARCH') {
                if (isMatch) {
                    blockState = 'bit-match';
                    tooltipText = `Bit [${15 - b}]: Stored(${bitVal}) ^ Query(${queryBit}) = 0 (MATCH)`;
                } else {
                    blockState = 'bit-mismatch';
                    rowDiffCount++;
                    tooltipText = `Bit [${15 - b}]: Stored(${bitVal}) ^ Query(${queryBit}) = 1 (MISMATCH)`;
                }
            } else if (isWriteRow) {
                blockState = 'bit-writing';
                tooltipText = `Row ${r} Bit [${15 - b}] Written -> ${bitVal}`;
            }

            bitBlock.className = `bit-block ${blockState}`;
            bitBlock.textContent = bitVal;

            // Hover Tooltip
            const tooltip = document.createElement('span');
            tooltip.className = 'bit-tooltip';
            tooltip.textContent = tooltipText;
            bitBlock.appendChild(tooltip);

            bitsStrip.appendChild(bitBlock);
        }

        // Col 3: Hex Value
        const hexCell = document.createElement('div');
        hexCell.className = 'row-hex-cell';
        hexCell.textContent = toHex4(rowValDec);

        // Col 4: Bit Divergence Count
        const diffCell = document.createElement('div');
        diffCell.className = 'row-diff-cell';
        const displayDiff = (cycle.op_type === 'SEARCH') ? (lineMismatches[r] !== undefined ? lineMismatches[r] : rowDiffCount) : 0;
        diffCell.textContent = `${displayDiff} diffs`;

        // Col 5: Match Line Status Badge
        const statusCell = document.createElement('div');
        statusCell.className = 'row-status-cell';
        const badge = document.createElement('span');

        if (cycle.op_type === 'SEARCH') {
            if (isWinningRow || lineMismatches[r] === 0) {
                badge.className = 'line-status-pill hit';
                badge.textContent = 'MATCH HIT';
            } else {
                badge.className = 'line-status-pill miss';
                badge.textContent = 'DISCHARGED';
            }
        } else if (cycle.op_type === 'WRITE') {
            if (isWriteRow) {
                badge.className = 'line-status-pill write';
                badge.textContent = 'WRITING';
            } else {
                badge.className = 'line-status-pill idle';
                badge.textContent = 'STANDBY';
            }
        } else {
            badge.className = 'line-status-pill idle';
            badge.textContent = 'GATED';
        }

        statusCell.appendChild(badge);

        rowElem.appendChild(indexCell);
        rowElem.appendChild(bitsStrip);
        rowElem.appendChild(hexCell);
        rowElem.appendChild(diffCell);
        rowElem.appendChild(statusCell);

        dom.camGrid.appendChild(rowElem);
    }
}



// Playback Engine
function togglePlayPause() {
    if (state.isPlaying) {
        pauseSimulation();
    } else {
        playSimulation();
    }
}

function playSimulation() {
    state.isPlaying = true;
    dom.btnPlay.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg><span>Pause</span>';
    state.timer = setInterval(() => {
        const total = state.simulationData?.cycles?.length || 1;
        if (state.currentCycleIndex < total - 1) {
            jumpToCycle(state.currentCycleIndex + 1);
        } else {
            jumpToCycle(0);
        }
    }, state.playbackSpeed);
}

function pauseSimulation() {
    state.isPlaying = false;
    dom.btnPlay.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Play</span>';
    if (state.timer) clearInterval(state.timer);
}

// Execute Custom Query in SystemC Engine
async function executeCustomQuery() {
    const mode = state.opMode;
    const patternRaw = dom.inputPattern.value.trim();
    const patternDec = parseHexSafe(patternRaw, 0xA5A5);
    const writeAddr = Math.max(0, Math.min(9, parseInt(dom.inputWriteAddr.value, 10) || 0));
    const writeDataRaw = dom.inputWriteData.value.trim();
    const writeDataDec = parseHexSafe(writeDataRaw, 0xDEAD);

    dom.statusText.textContent = 'Simulating Cycle in SystemC...';
    dom.systemStatus.className = 'engine-badge';

    try {
        const res = await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                op_mode: mode,
                pattern: patternDec,
                write_addr: writeAddr,
                write_data: writeDataDec
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.cycles)) {
                state.simulationData = data;
                dom.totalCycles.textContent = data.cycles.length;
                dom.statusText.textContent = 'SystemC Kernel Active';
                dom.systemStatus.className = 'engine-badge live';
                
                // Jump to the newly executed cycle
                jumpToCycle(data.cycles.length - 1);
                logConsole(`[CUSTOM] Executed ${mode} in C++ SystemC engine -> Cycle ${data.cycles.length}`, 'success');
                return;
            }
        }
        throw new Error('Server returned invalid simulation output');
    } catch (err) {
        console.warn('Backend simulate failed, executing in local client JS engine:', err);
        executeClientFallback(mode, patternDec, writeAddr, writeDataDec);
    }
}

// Client Fallback Simulation Engine
function executeClientFallback(mode, patternDec, writeAddr, writeDataDec) {
    const cycles = state.simulationData.cycles;
    const lastCycle = cycles[cycles.length - 1];
    const newCycleIdx = cycles.length + 1;
    const newTime = (lastCycle?.time_ns || 0) + 10;
    const snapshot = [...(lastCycle?.cam_snapshot || [42405, 42406, 42407, 42408, 42409, 42410, 42411, 42412, 42413, 42414])];

    let hit = false;
    let hitAddr = -1;
    let totalMismatches = 0;
    const lineMismatches = [];

    if (mode === 'WRITE') {
        snapshot[writeAddr] = writeDataDec;
    } else {
        for (let r = 0; r < 10; r++) {
            const rowVal = snapshot[r];
            const xorMap = rowVal ^ patternDec;
            let diffs = 0;
            for (let b = 0; b < 16; b++) {
                if ((xorMap & (1 << b)) !== 0) diffs++;
            }
            lineMismatches.push(diffs);
            totalMismatches += diffs;

            if (diffs === 0 && !hit) {
                hit = true;
                hitAddr = r;
            }
        }
    }

    const pLeakage = 0.002;
    const powerMw = (mode === 'WRITE') ? pLeakage : (pLeakage + totalMismatches * 0.015);
    const accumEnergy = (lastCycle?.accumulated_energy_mj || 0) + (powerMw * 10e-6);

    const newCycle = {
        cycle: newCycleIdx,
        time_ns: newTime,
        op_type: mode,
        search_pattern: toHex4(patternDec).toLowerCase(),
        search_pattern_dec: patternDec,
        write_data: toHex4(writeDataDec).toLowerCase(),
        write_addr: writeAddr,
        hit: hit,
        hit_addr: hitAddr,
        total_mismatches: totalMismatches,
        power_mw: powerMw,
        accumulated_energy_mj: accumEnergy,
        cam_snapshot: snapshot,
        line_mismatches: lineMismatches
    };

    cycles.push(newCycle);
    dom.totalCycles.textContent = cycles.length;
    dom.statusText.textContent = 'Client Engine Active';
    dom.systemStatus.className = 'engine-badge live';
    jumpToCycle(cycles.length - 1);
    logConsole(`[CLIENT SIM] Executed ${mode} in browser -> Cycle ${cycles.length}`, 'warn');
}

// Recompile SystemC Backend
async function executeSystemCBackend() {
    dom.statusText.textContent = 'Recompiling MinGW C++...';
    try {
        const res = await fetch('/api/recompile', { method: 'POST' });
        if (res.ok) {
            await loadSimulationData();
            logConsole('[BUILD] MinGW g++ compilation and execution successful', 'success');
        } else {
            const err = await res.json();
            logConsole('[BUILD ERROR] ' + (err.error || 'Compilation failed'), 'error');
        }
    } catch (e) {
        logConsole('[NOTICE] Server offline, loading local trace data', 'info');
        loadSimulationData();
    }
}

// Reset to Baseline
async function resetToBaseline() {
    try {
        await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}) // Empty parameters runs baseline 5 cycles
        });
    } catch (e) {}
    await loadSimulationData();
    jumpToCycle(0);
    logConsole('[RESET] Restored baseline 5-cycle verification suite', 'info');
}

// Append Line to Console
function emitConsoleLog(cycle) {
    if (cycle.op_type === 'WRITE') {
        logConsole(`[${cycle.time_ns.toFixed(1)} ns] WRITE row ${cycle.write_addr} with data ${cycle.write_data}`, 'info');
    } else {
        const hitStr = cycle.hit ? `HIT @ Row ${cycle.hit_addr}` : 'MISS';
        const type = cycle.hit ? 'success' : (cycle.total_mismatches > 100 ? 'warn' : 'info');
        logConsole(`[${cycle.time_ns.toFixed(1)} ns] SEARCH ${cycle.search_pattern} -> ${hitStr} (${cycle.total_mismatches} mismatches, ${cycle.power_mw.toFixed(3)} mW)`, type);
    }
}

function logConsole(msg, type = 'info') {
    if (!dom.consoleOutput) return;
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = msg;
    dom.consoleOutput.appendChild(line);
    dom.consoleOutput.scrollTop = dom.consoleOutput.scrollHeight;
}
