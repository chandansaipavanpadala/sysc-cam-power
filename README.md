# SystemC Content Addressable Memory (CAM) Power Estimation Tool for Early Design Verification

> **Academic SoC Assignment (20 Marks)**  
> **Course Module:** System-on-Chip (SoC) Design & Verification  
> **Reference IEEE Paper:** *"A SystemC Content Addressable Memory (CAM) Power Estimation Tool for Early Design Verification"*

---

## 📋 Executive Summary (Unit III: ESL Power, Performance, & Area Modeling)

In modern System-on-Chip (SoC) design, power consumption is a primary architectural constraint alongside performance and area. Traditional RTL-level (Verilog/VHDL) power estimation occurs late in the design cycle after logic synthesis and place-and-route, making architectural modifications costly and slow.

This project implements an **Electronic System-Level (ESL)** high-level power estimation tool written in **SystemC (C++ library)**. By modeling a 10-entry, 16-bit wide **Content Addressable Memory (CAM)** at the transaction/cycle-accurate abstraction layer, hardware architects can:
1. Estimate dynamic match-line switching power prior to register-transfer level (RTL) coding.
2. Measure the impact of search bit-mismatches on total system power.
3. Validate clock-gating strategies and architectural power budgets early in early design verification.

---

## 🌐 Real-World Application Context

Content Addressable Memory (CAM) provides **$O(1)$ single-cycle parallel lookup**, making it essential in two major industry domains:

### 1. High-Speed Network IP Lookup (IPv6 Routers)
Core enterprise routers process millions of packets per second. Unlike RAM which returns data given an address, CAM compares incoming IP address headers against all stored routing table prefixes simultaneously in a single clock cycle. This project models match-line power dissipation during high-frequency parallel IP lookups.

### 2. Smart Construction Site Safety & Structural Health Monitoring (SHM) IoT Networks
Edge IoT nodes in smart construction safety networks continuously monitor structural vibration, stress, and worker safety parameters. CAM modules act as ultra-low-latency anomaly detectors. Incoming sensor vectors are matched against pre-stored safety thresholds; match-line power modeling allows embedded designers to optimize battery lifespan for wireless sensor nodes.

---

## 📁 Repository File Structure

```text
├── cam_power_model.h     # SystemC CAM Module Declaration & Port Interface
├── cam_power_model.cpp   # Bitwise XOR Match-Line Logic & Power Estimation Formula
├── main.cpp              # Testbench with 5 Test Scenarios & VCD Waveform Generator
├── Makefile              # Native GCC/g++ Build Script
├── CMakeLists.txt        # CMake Build Configuration
├── run_sim.bat           # Windows Trusted Execution Runner (Bypasses WDAC Policy)
└── README.md             # Project Documentation & Viva Defense Guide
```

---

## ⚙️ Architecture & Power Estimation Model

### 1. Parallel Match-Line Bitwise XOR Logic
Each CAM entry compares all 16 bits in parallel against the query `search_pattern` using bitwise XOR (`^`):
$$\text{mismatch\_map} = \text{cam\_array}[i] \oplus \text{search\_pattern}$$
If all 16 bits match ($\text{mismatch\_map} = 0$), the Priority Encoder flags a **HIT** and outputs the entry index.

### 2. Match-Line Dynamic Power Formula
In physical CMOS CAM designs, match-lines are pre-charged high each cycle. Bit mismatches discharge the match-line capacitance, dissipating dynamic energy:
$$\text{Power (mW)} = P_{\text{leakage}} + \left( \sum_{i=0}^{\text{DEPTH}-1} \text{Mismatched\_Bits}_i \right) \times E_{\text{mismatch\_factor}}$$

Where:
- $P_{\text{leakage}} = 0.002\text{ mW}$ (Static leakage floor)
- $E_{\text{mismatch\_factor}} = 0.015\text{ mW per mismatched bit}$

---

## 🚀 How to Build & Run Simulation

### On Windows (Recommended):
Run the provided batch runner script in PowerShell or CMD:
```powershell
.\run_sim.bat
```

### On Linux / macOS:
```bash
make
make run
```

---

## 📈 Waveform Visualization Guide (EDA Playground & GTKWave)

### Method A: Viewing Waveforms on EDA Playground (EPWave)
1. Go to [EDA Playground](https://www.edaplayground.com/).
2. In the **Left Pane (`design.cpp`)**, combine `cam_power_model.h` and `cam_power_model.cpp`.
3. In the **Right Pane (`testbench.cpp`)**, paste `main.cpp`.
4. In the **Left Sidebar Settings**:
   - **Tools & Simulators**: Select `Aldec Riviera-PRO` or `SystemC 2.3.x`.
   - **Options**: Check the box **`Open EPWave after run`**.
5. Click **Run** at the top.
6. EDA Playground will execute the simulation and automatically launch **EPWave** (web-based GTKWave) in your browser.
7. Click on signals (`clk`, `search_pattern`, `match_found`, `match_addr`, `estimated_power_mw`) to add them to the display window.

### Method B: Viewing Local `cam_trace.vcd` with GTKWave Desktop
1. Install or download **GTKWave** for Windows.
2. Launch GTKWave and click **File -> Open Trace**.
3. Select `cam_trace.vcd` generated in your project folder `d:\ASEB\BTECH\SoC Assignment\cam_trace.vcd`.
4. In the **SST Panel** (left sidebar), expand `SystemC` and select `CAM_Inst`.
5. Highlight the signals (`clk`, `search_pattern`, `match_found`, `estimated_power_mw`) and click **Append**.
6. Press `Ctrl + 0` (or `Zoom -> Zoom Fit`) to view the complete simulation waveforms.

---

## 📊 Simulation Test Cases & Verification Output

The testbench (`main.cpp`) runs 5 comprehensive test scenarios:

| Test Case | Scenario | Pattern | Expected Result | Bit Mismatches | Estimated Power |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Test Case 1** | Initial Search | `0xA5A5` | **HIT** (Index 0) | 21 bits | 0.317 mW |
| **Test Case 2** | High-Mismatch Search | `0x5A5A` | **MISS** | 139 bits | 2.087 mW |
| **Test Case 3** | Write Operation | `0xDEAD` | Write to Index 5 | - | Leakage (0.002 mW) |
| **Test Case 4** | Re-Search Written Pattern | `0xDEAD` | **HIT** (Index 5) | 68 bits | 1.022 mW |
| **Test Case 5** | Low-Mismatch Search | `0xA5A4` | **MISS** | 26 bits | 0.392 mW |

### Executive ESL Summary Report Output:
```text
========================================================
         ESL SYSTEMC CAM POWER ESTIMATION REPORT         
========================================================
  CAM Depth             : 10 entries
  CAM Bit Width         : 16 bits
  Total Search Cycles   : 5
  Total Hits            : 3
  Total Misses          : 2
  Hit Rate              : 60 %
  Accumulated Energy    : 4.135e-005 mJ
========================================================
[VCD TRACE] Waveform dump saved successfully to 'cam_trace.vcd'
```

---

## 🔍 SystemC Constructs Breakdown

1. **`SC_MODULE(CAM_Power_Model)`**: Defines a hardware module container class inheriting from `sc_module`.
2. **`sc_in<type>` & `sc_out<type>`**: Input and output ports defining hardware interface boundaries (`sc_uint<N>`, `bool`, `double`).
3. **`SC_METHOD(cam_operation)`**: A lightweight concurrent process method executed when sensitive signals change.
4. **`sensitive << clk.pos()`**: Specifies sensitivity list; `cam_operation` executes on every positive edge of the clock.
5. **`sc_time_stamp()`**: Returns the current simulation time as an `sc_time` object.
6. **`sc_create_vcd_trace_file("cam_trace")`**: Generates a Value Change Dump (VCD) waveform trace file readable by GTKWave.

---

## 🎓 Line-by-Line Viva Defense Section (10 Likely Questions & Answers)

**Q1: What is the main motivation for ESL power modeling in SystemC over RTL synthesis?**  
*Answer:* ESL modeling allows system architects to evaluate power-performance trade-offs in minutes at early stages, whereas RTL synthesis requires full logic implementation and takes hours or days.

**Q2: How does a Content Addressable Memory (CAM) differ from conventional RAM?**  
*Answer:* RAM takes an address as input and outputs the stored data ($O(1)$ read). CAM takes data as input, compares it against all internal locations in parallel ($O(1)$ search), and outputs the matching address index.

**Q3: Why do bit mismatches cause power dissipation in physical CAM match-lines?**  
*Answer:* Physical CAM match-lines are pre-charged to $V_{DD}$ every clock cycle. Any mismatched transistor pair discharges the pre-charged line to ground, causing dynamic CV²f energy loss.

**Q4: Explain the difference between `SC_METHOD` and `SC_THREAD` in SystemC.**  
*Answer:* `SC_METHOD` executes from start to finish without holding state and cannot contain `wait()` statements. `SC_THREAD` maintains an independent execution context and can yield execution using `wait()`. `SC_METHOD` was chosen here for maximum simulation speed.

**Q5: What is the function of the priority encoder in your CAM module?**  
*Answer:* When multiple CAM lines match a search pattern, the priority encoder ensures that only the lowest numerical address index is returned as `match_addr`.

**Q6: Why is bitwise XOR (`^`) used in the match logic?**  
*Answer:* Bitwise XOR produces a `1` only when bits differ and `0` when bits are identical. Summing the `1` bits directly counts total bit mismatches across match-lines.

**Q7: What purpose does `sc_create_vcd_trace_file()` serve in your testbench?**  
*Answer:* It logs all cycle-by-cycle signal value changes into a standard VCD waveform file, enabling visual inspection of timing and power signals in tools like GTKWave or EDA Playground.

**Q8: How does clock gating reduce power in your design?**  
*Answer:* When `enable = false`, the module bypasses match-line evaluation loops, driving outputs to zero and reporting zero dynamic power.

**Q9: How is energy accumulated across multiple simulation cycles?**  
*Answer:* Energy is calculated as $\text{Power (mW)} \times \text{Clock Period (10 ns)}$, converted to mJ, and summed over all active search cycles (`accumulated_energy_mj`).

**Q10: Can this SystemC model be synthesized directly to hardware?**  
*Answer:* SystemC models at the ESL abstraction layer are designed for simulation and architecture exploration. They can be high-level synthesized (HLS) using tools like Catapult HLS or Xilinx Vivado HLS.

---

## 🛠️ Code Modification Guide for Viva Examination

If your professor asks you to modify the code during the viva:

### 1. Expand Width from 16 to 128 bits (IPv6 Router Lookup)
In `cam_power_model.h`, change:
```cpp
#define CAM_WIDTH 128
```

### 2. Increase CAM Depth from 10 to 64 Entries
In `cam_power_model.h`, change:
```cpp
#define CAM_DEPTH 64
sc_in<sc_uint<6>> write_addr; // 6 bits needed for 64 entries
sc_out<sc_uint<6>> match_addr;
```

### 3. Change Dynamic Energy Mismatch Coefficient
In `cam_power_model.cpp`, adjust `E_MISMATCH_FACTOR`:
```cpp
E_MISMATCH_FACTOR(0.025) // Increase energy weight per mismatched bit
```
