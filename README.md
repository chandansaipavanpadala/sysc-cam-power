# SystemC Content Addressable Memory (CAM) Power Estimation & Web Visualization Workbench

An Electronic System-Level (ESL) hardware modeling and simulation framework for Content Addressable Memory (CAM) architectures. Built using SystemC (C++ IEEE 1666 standard) and an interactive web visual workbench, this tool provides architectural power estimation, bitwise match-line evaluation, VCD waveform tracing, and dynamic web visualization.

---

## System Overview

In modern System-on-Chip (SoC) design, power dissipation is a primary constraint alongside performance and die area. Traditional Register-Transfer Level (RTL) power estimation performed in Verilog or VHDL occurs late in the design cycle after logic synthesis and place-and-route, making architectural modifications time-consuming and expensive.

This project implements an ESL cycle-accurate power estimation model of a 10-entry, 16-bit Content Addressable Memory (CAM) module. By modeling hardware at the system abstraction layer, hardware architects can:
1. Estimate dynamic match-line switching power prior to RTL implementation.
2. Quantify the power impact of bit mismatches across memory rows during high-frequency lookups.
3. Validate clock-gating strategies and early system-level power budgets.
4. Visualize hardware memory states, bitwise XOR comparisons, and digital waveforms in real time.

---

## Architecture & Microarchitecture

### System-Level Integration Architecture

The framework consists of a native C++ SystemC simulation engine (`Backend/`) coupled via a lightweight server bridge (`server.js`) to an Electronic Design Automation (EDA) web visual workbench (`Frontend/`).

```mermaid
graph TD
    subgraph Backend ["Backend: SystemC Simulation Engine"]
        A["main.cpp (Testbench & Command Handler)"]
        B["CAM_Power_Model (cam_power_model.cpp)"]
        C["SystemC Core Kernel (IEEE 1666)"]
        D["simulation_data.json (Cycle State Trace)"]
        E["cam_trace.vcd (Value Change Dump Signal Trace)"]
        
        A -->|Instantiates & Triggers| B
        B -->|Schedules via| C
        B -->|Exports Cycle Logs| D
        B -->|Generates Traces| E
    end

    subgraph ServerBridge ["Middleware: Server Bridge"]
        F["server.js (Node.js HTTP & API Gateway)"]
    end

    subgraph Frontend ["Frontend: Web Visual Workbench"]
        G["index.html (EDA Dashboard Layout)"]
        H["app.js (Matrix, Waveform & Playback Engine)"]
        I["style.css (Dark Glassmorphic UI Design System)"]
        
        G --- H
        G --- I
    end

    Backend -->|Generates State & Traces| ServerBridge
    ServerBridge -->|Serves Static Files & REST APIs| Frontend
    Frontend -->|POST /api/simulate & POST /api/recompile| ServerBridge
    ServerBridge -->|Triggers Execution| A
```

### CAM Hardware Microarchitecture Block Diagram

```text
                               +----------------------------------------+
                               |        Clock & Control Unit            |
                               | (clk, enable, write_en, write_addr)    |
                               +-------------------+--------------------+
                                                   |
                                                   v
+-----------------------+              +-----------+--------------------+
|  Query Word Register  |------------->|  10-Entry x 16-Bit CAM Memory  |
|   (search_pattern)    |              |       Storage Array            |
+-----------------------+              +-----------+--------------------+
            |                                      |
            v                                      v
+-----------------------------------------------------------------------+
|                 Parallel Bitwise XOR Comparator Matrix                |
|       Line 0: CAM[0] ^ Pattern  ---> Line 0 Mismatches & Match Line   |
|       Line 1: CAM[1] ^ Pattern  ---> Line 1 Mismatches & Match Line   |
|       ...                                                             |
|       Line 9: CAM[9] ^ Pattern  ---> Line 9 Mismatches & Match Line   |
+-----------------------------------------------------------------------+
            |                                      |
            v                                      v
+-----------------------+              +--------------------------------+
| Priority Encoder Unit |              |  Match-Line Dynamic & Static   |
| (First Match Finder)  |              |    Power Calculation Engine    |
+-----------+-----------+              +---------------+----------------+
            |                                          |
            v                                          v
+-----------------------+              +--------------------------------+
| Outputs: match_found, |              | Output: estimated_power_mw     |
|       match_addr      |              | Accumulator: energy_mj         |
+-----------------------+              +--------------------------------+
```

---

## Mathematical Power & Energy Model

### 1. Parallel Match-Line Bitwise XOR Evaluation
In a binary Content Addressable Memory, each entry compares all 16 bits simultaneously against the query `search_pattern` using bitwise XOR logic:

$$\text{MismatchMap}_i = \text{CamArray}[i] \oplus \text{SearchPattern}$$

For each bit position $b \in \{0, \dots, 15\}$, the bitwise mismatch is evaluated. The total bit mismatches for line $i$ is calculated as:

$$\text{LineMismatches}_i = \sum_{b=0}^{15} \text{MismatchMap}_i[b]$$

If $\text{LineMismatches}_i = 0$, entry $i$ is designated a **MATCH (HIT)**.

### 2. Match-Line Dynamic Power Formula
In physical CMOS CAM designs, match-lines are pre-charged to $V_{DD}$ every clock cycle. Any mismatched bit pair turns on a discharge path, dumping the pre-charged line capacitance to ground and consuming dynamic energy.

The system-level power model computes instantaneous match-line power per cycle according to:

$$P_{\text{total}} = P_{\text{leakage}} + \left( \sum_{i=0}^{\text{DEPTH}-1} \text{LineMismatches}_i \right) \times E_{\text{mismatch-factor}}$$

Where empirical model coefficients are defined as:
* Static Base Leakage Floor ($P_{\text{leakage}}$): $0.002 \text{ mW}$ ($2 \ \mu\text{W}$)
* Dynamic Mismatch Energy Coefficient ($E_{\text{mismatch-factor}}$): $0.015 \text{ mW per mismatched bit}$

### 3. Accumulated Energy Formula
Total accumulated energy across $N$ simulation cycles is given by:

$$E_{\text{accumulated}} = \sum_{k=1}^{N} \left( P_{\text{total}}[k] \times T_{\text{clk}} \right)$$

where $T_{\text{clk}} = 10 \text{ ns}$ ($100 \text{ MHz}$ clock frequency).

---

## Repository Directory Structure

```text
sysc-cam-power/
├── Backend/
│   ├── cam_power_model.h         # SystemC Module Class Interface & Port Declarations
│   ├── cam_power_model.cpp       # Bitwise XOR Match Logic & JSON Exporter Implementation
│   ├── main.cpp                  # Simulation Testbench Suite & Command Parser
│   ├── run_sim.bat               # Windows Command Line Launcher
│   ├── Makefile                  # GCC/g++ MinGW Build Automation File
│   ├── CMakeLists.txt            # CMake Cross-Platform Build File
│   ├── sim.exe                   # Compiled SystemC Binary Executable
│   ├── cam_trace.vcd             # Value Change Dump Signal Waveform File
│   └── simulation_data.json      # SystemC Cycle-by-Cycle JSON Trace Dataset
│
├── Frontend/
│   ├── index.html                # Visual Workbench Dashboard HTML Structure
│   ├── style.css                 # Dark EDA Glassmorphic Styling System
│   ├── app.js                    # UI Interactivity, Matrix & Waveform Canvas Plotter
│   └── server.js                 # Node.js HTTP Server & SystemC Execution Gateway
│
├── run_web.bat                   # Top-Level One-Click Launch Script
├── LICENSE                       # Project License File
└── README.md                     # Technical System Documentation
```

---

## Backend Implementation (`Backend/`)

### 1. Header Interface (`cam_power_model.h`)
Defines the `CAM_Power_Model` SystemC module inheriting from `sc_module`.

```cpp
SC_MODULE(CAM_Power_Model) {
    // Port Inputs
    sc_in<bool>               clk;
    sc_in<bool>               enable;
    sc_in<bool>               write_en;
    sc_in<sc_uint<4>>         write_addr;
    sc_in<sc_uint<CAM_WIDTH>> search_pattern;
    sc_in<sc_uint<CAM_WIDTH>> write_data;

    // Port Outputs
    sc_out<bool>              match_found;
    sc_out<sc_uint<4>>        match_addr;
    sc_out<double>            estimated_power_mw;

    // Internal Storage & History
    sc_uint<CAM_WIDTH>        cam_array[CAM_DEPTH];
    std::vector<CycleData>    cycle_history;
    
    // Process Method & JSON Exporter
    void cam_operation();
    void export_json(const std::string& filename) const;
    
    SC_HAS_PROCESS(CAM_Power_Model);
    CAM_Power_Model(sc_module_name name);
};
```

### 2. Module Logic (`cam_power_model.cpp`)
- **Clock Gating**: When `enable = false`, dynamic execution is bypassed, outputs are zeroed, and power drops to $0.0 \text{ mW}$.
- **Memory Write**: When `write_en = true`, the data at `write_addr` is updated in `cam_array`, and power reports base leakage ($0.002 \text{ mW}$).
- **Parallel Search**: Evaluates XOR match lines for all 10 entries simultaneously, calculates bit mismatches, sets match priority, computes power via the empirical equation, and pushes structured cycle data to `cycle_history`.
- **JSON Exporter**: Serializes memory array snapshots, mismatch arrays, hit/miss flags, power values, and cumulative energy into `simulation_data.json`.

---

## Frontend Implementation (`Frontend/`)

### 1. Dashboard Layout (`index.html`)
Presents a multi-column EDA dashboard containing:
- **Simulation Control Panel**: First, Previous, Play/Pause, Next, Last playback buttons, speed selection, and preset testcase shortcuts.
- **Custom Query Form**: Interactive form allowing users to select operation mode (Search or Write), type hex patterns (e.g. `0xA5A5` or `0xDEAD`), and execute queries live against the SystemC backend.
- **Instant Power Meter**: Digital dynamic gauge, power bar, static leakage vs dynamic power breakdown, and energy counters.
- **10 x 16 CAM Grid**: Visual memory array displaying every bit in binary format with color-coded match/mismatch status and line state indicators.
- **Digital Signal Waveform Canvas**: HTML5 Canvas rendering digital signal transitions (`clk`, `write_en`, `match_found`, `power_mw`).
- **Console Stream**: Real-time SystemC log output stream.

### 2. Interactivity & Visualization Engine (`app.js`)
- Reads and parses `simulation_data.json`.
- Dynamically updates memory row DOM elements, bitwise match highlighting (Emerald `#10b981` for match, Rose `#ef4444` for mismatch, Cyan `#06b6d4` for HIT match line).
- Renders signal traces dynamically on an HTML5 canvas synchronized with the current simulation cycle cursor.

### 3. Server Bridge Gateway (`server.js`)
A Node.js HTTP server configured to:
- Serve static web assets (`index.html`, `style.css`, `app.js`).
- Serve `simulation_data.json` from `Backend/`.
- Provide `POST /api/simulate` and `POST /api/recompile` REST endpoints to trigger backend `sim.exe` execution asynchronously.

---

## Build, Compilation, and Execution

### Prerequisites
- **Compiler**: GCC / MinGW g++ with C++17 support.
- **SystemC Library**: SystemC 2.3.x or 3.0.x installed (default path: `C:/systemc`).
- **Runtime Environment**: Node.js v14+ (for Web Visual Workbench).

---

### Option 1: Launch Interactive Web Visual Workbench (Recommended)

To compile the SystemC backend, start the bridge server, and open the web dashboard in your default browser, run:

```cmd
.\run_web.bat
```

Alternatively, from the terminal:
```bash
# 1. Compile SystemC executable inside Backend/
cd Backend
g++ -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -I C:/systemc/include -L C:/systemc/lib main.cpp cam_power_model.cpp -lsystemc -o sim.exe

# 2. Run simulation engine to generate initial trace dataset
.\sim.exe --no-pause

# 3. Launch Node server from project root
cd ..
node Frontend/server.js
```
Then navigate to `http://localhost:3000` in your web browser.

---

### Option 2: Standalone Command-Line Simulation Mode

To compile and run the SystemC simulation directly in the terminal:

```cmd
cd Backend
.\run_sim.bat
```

Using standard `Makefile`:
```bash
cd Backend
make
make run
```

Using `CMake`:
```bash
cd Backend
mkdir build && cd build
cmake ..
cmake --build .
```

---

## Simulation Verification & Test Cases

The testbench (`main.cpp`) executes 5 verification scenarios:

| Test Case | Scenario | Search Pattern | Target / Expected Result | Total Bit Mismatches | Instant Power |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Test Case 1** | Initial Search | `0xA5A5` | **HIT** at Index 0 | 21 bits | 0.317 mW |
| **Test Case 2** | High-Mismatch Search | `0x5A5A` | **MISS** (No Match) | 139 bits | 2.087 mW |
| **Test Case 3** | Memory Write | `0xDEAD` | Write `0xDEAD` to Index 5 | 0 bits (Write Cycle) | 0.002 mW |
| **Test Case 4** | Verification Search | `0xDEAD` | **HIT** at Index 5 | 68 bits | 1.022 mW |
| **Test Case 5** | Low-Mismatch Search | `0xA5A4` | **MISS** (1-bit diff from Index 0)| 26 bits | 0.392 mW |

### Sample Terminal Simulation Report Output

```text
========================================================
     SYSTEMC CAM POWER MODEL - SIMULATION STARTED        
========================================================

--- TEST CASE 1: Searching pattern 0xA5A5 (Expected HIT at Index 0) ---
[CAM SEARCH] @0 s | Pattern: 0x0a5a5 | Result: HIT  | Addr: 0 | Bit Mismatches: 21 | Power: 0.317 mW

--- TEST CASE 2: Searching pattern 0x5A5A (Expected High-Power MISS) ---
[CAM SEARCH] @10 ns | Pattern: 0x05a5a | Result: MISS | Addr: -1 | Bit Mismatches: 139 | Power: 2.087 mW

--- TEST CASE 3: Write 0xDEAD into CAM Index 5 ---
[CAM WRITE] @20 ns | Addr: 5 | Data: 0x0dead

--- TEST CASE 4: Re-search pattern 0xDEAD (Expected HIT at Index 5) ---
[CAM SEARCH] @30 ns | Pattern: 0x0dead | Result: HIT  | Addr: 5 | Bit Mismatches: 68 | Power: 1.022 mW

--- TEST CASE 5: Searching pattern 0xA5A4 (Expected Low-Power MISS) ---
[CAM SEARCH] @40 ns | Pattern: 0x0a5a4 | Result: MISS | Addr: -1 | Bit Mismatches: 26 | Power: 0.392 mW

========================================================
         ESL SYSTEMC CAM POWER ESTIMATION REPORT         
========================================================
  CAM Depth             : 10 entries
  CAM Bit Width         : 16 bits
  Total Search Cycles   : 5
  Total Hits            : 3
  Total Misses          : 2
  Hit Rate              : 60 %
  Accumulated Energy    : 4.135e-05 mJ
========================================================

[JSON EXPORT] Simulation trace data saved to 'simulation_data.json'
[VCD TRACE] Waveform dump saved successfully to 'cam_trace.vcd'

--- Simulation Finished Successfully ---
```

---

## Waveform Tracing & Analysis

The simulation automatically logs value changes into `Backend/cam_trace.vcd` (Value Change Dump).

### Inspecting Traces with GTKWave Desktop
1. Launch GTKWave.
2. Select **File -> Open Trace** and open `Backend/cam_trace.vcd`.
3. Expand the module tree under `SystemC -> CAM_Inst`.
4. Select `clk`, `enable`, `write_en`, `search_pattern`, `match_found`, `match_addr`, and `estimated_power_mw`.
5. Click **Append** and adjust zoom (`Ctrl + 0`) to view signal timing waveforms.

---

## SystemC Design Constructs & Abstractions

1. **`SC_MODULE`**: C++ macro defining a hardware component class derived from `sc_module`.
2. **`sc_in<T>` / `sc_out<T>`**: Strongly typed hardware ports supporting SystemC data types (`sc_uint<N>`, `bool`, `double`).
3. **`SC_METHOD`**: Concurrent process method triggered by signals in its sensitivity list. Unlike threads (`SC_THREAD`), `SC_METHOD` runs to completion without calling `wait()`, maximizing simulation throughput.
4. **`sensitive << clk.pos()`**: Defines positive clock edge sensitivity for synchronous execution.
5. **`sc_trace_file`**: Infrastructure for logging cycle-accurate VCD waveform dumps.

---

## References

1. Accellera Systems Initiative, *"SystemC Language Reference Manual (IEEE Std 1666-2011)"*, IEEE Standards Association.
2. K. Pagiamtzis and A. Sheikholeslami, *"Content-addressable memory (CAM) circuits and architectures: A tutorial and survey"*, IEEE Journal of Solid-State Circuits, vol. 41, no. 3, pp. 712-727, March 2006.
3. C. Zukowski and S. Y. Wang, *"Use of simulation tools for early power estimation in digital system-on-chip design"*, IEEE Transactions on Computer-Aided Design of Integrated Circuits and Systems, vol. 22, no. 9, pp. 1145-1158.
