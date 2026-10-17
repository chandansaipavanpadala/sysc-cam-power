#include <systemc.h>
#include <iostream>
#include <vector>
#include <string>
#include "cam_power_model.h"

int sc_main(int argc, char* argv[]) {
    // ========================================================================
    // SYSTEMC PRIMITIVE CHANNEL TAXONOMY & INSTRUMENTATION
    // All 10 communication channels inherit from sc_prim_channel
    // Managed via request_update() and update() during delta cycles
    // ========================================================================

    // 1. Synchronous Clock Channel (1x)
    // 100 MHz oscillator domain (10 ns period, 50% duty cycle)
    sc_clock clk("clk", 10, SC_NS);

    // 2. Control Signal Channels (3x sc_signal<bool>)
    sc_signal<bool>               enable("enable");                           // Clock gating enable
    sc_signal<bool>               write_en("write_en");                       // 1 = Write mode, 0 = Search mode
    sc_signal<bool>               addr_mode_indirect("addr_mode_indirect");   // 0 = Direct, 1 = Indirect (Base+Offset)

    // 3. Address Bus Channels (2x sc_signal<sc_uint<32>>)
    sc_signal<sc_uint<32>>        write_addr("write_addr");                   // Input write address / offset
    sc_signal<sc_uint<32>>        match_addr("match_addr");                   // Output prioritized match index

    // 4. Associative Data Bus Channels (2x sc_signal<sc_uint<16>>)
    sc_signal<sc_uint<16>>        search_pattern("search_pattern");           // Parallel query data vector
    sc_signal<sc_uint<16>>        write_data("write_data");                   // Memory write data payload

    // 5. Output Telemetry Channels (2x primitive channels)
    sc_signal<bool>               match_found("match_found");                 // HIT/MISS status flag
    sc_signal<double>             estimated_power_mw("estimated_power_mw");   // Dynamic match-line power (mW)

    // Total Instrumented Channels: 1 Clock + 3 Control + 2 Address + 2 Data + 2 Telemetry = 10 Channels

    // ========================================================================
    // COMPONENT INSTANTIATION VIA C++ TEMPLATES & DYNAMIC CONSTRUCTOR
    // Parameters: <CAM_DEPTH = 10, CAM_WIDTH = 16>
    // Empirical coefficients: p_leakage = 0.002 mW, e_mismatch = 0.015 mW/bit
    // Base Pointer Register initialized to 2 for Indirect Addressing demonstration
    // ========================================================================
    const unsigned int CFG_DEPTH = 10;
    const unsigned int CFG_WIDTH = 16;
    const double       CFG_P_LEAK = 0.002;
    const double       CFG_E_FACTOR = 0.015;
    const sc_uint<32>  CFG_BASE_PTR = 2;

    CAM_Power_Model<CFG_DEPTH, CFG_WIDTH> cam("CAM_Inst", CFG_P_LEAK, CFG_E_FACTOR, CFG_BASE_PTR);

    // Bind Port Interfaces to Primitive Signal Channels
    cam.clk(clk);
    cam.enable(enable);
    cam.write_en(write_en);
    cam.addr_mode_indirect(addr_mode_indirect);
    cam.write_addr(write_addr);
    cam.search_pattern(search_pattern);
    cam.write_data(write_data);
    cam.match_found(match_found);
    cam.match_addr(match_addr);
    cam.estimated_power_mw(estimated_power_mw);

    // ========================================================================
    // DYNAMIC MEMORY INITIALIZATION
    // Replaces static initialization loops with dynamic vector loading
    // ========================================================================
    std::vector<sc_uint<CFG_WIDTH>> initial_cam_data = {
        0xA5A5, 0xA5A6, 0xA5A7, 0xA5A8, 0xA5A9,
        0xA5AA, 0xA5AB, 0xA5AC, 0xA5AD, 0xA5AE
    };
    cam.load_initial_memory(initial_cam_data);

    // ========================================================================
    // VCD WAVEFORM TRACING SETUP (All 10 Channels Instrumented)
    // ========================================================================
    sc_trace_file *tf = sc_create_vcd_trace_file("cam_trace");
    tf->set_time_unit(1, SC_NS);

    sc_trace(tf, clk, "clk");
    sc_trace(tf, enable, "enable");
    sc_trace(tf, write_en, "write_en");
    sc_trace(tf, addr_mode_indirect, "addr_mode_indirect");
    sc_trace(tf, write_addr, "write_addr");
    sc_trace(tf, search_pattern, "search_pattern");
    sc_trace(tf, write_data, "write_data");
    sc_trace(tf, match_found, "match_found");
    sc_trace(tf, match_addr, "match_addr");
    sc_trace(tf, estimated_power_mw, "estimated_power_mw");

    // ========================================================================
    // DIAGNOSTIC STARTUP BANNER & SYSTEMC DELTA CYCLE EXPLANATION
    // ========================================================================
    std::cout << "\n====================================================================\n";
    std::cout << "     SYSTEMC ESL CAM POWER & ADDRESSING VERIFICATION TESTBENCH      \n";
    std::cout << "====================================================================\n";
    std::cout << "  Configuration      : " << CFG_DEPTH << " Entries x " << CFG_WIDTH << " Bits\n";
    std::cout << "  Base Pointer Reg   : " << cam.get_base_pointer() << " (Indirect Addressing Base)\n";
    std::cout << "  Static Leakage     : " << CFG_P_LEAK << " mW\n";
    std::cout << "  Dynamic Coefficient: " << CFG_E_FACTOR << " mW/mismatch-bit\n";
    std::cout << "  Clock Frequency    : 100 MHz (Period: 10 ns)\n";
    std::cout << "  SystemC Channels   : 10 Primitive Channels (sc_prim_channel)\n";
    std::cout << "  Kernel Execution   : Evaluate-Update delta cycle phases enabled\n";
    std::cout << "====================================================================\n\n";

    // Initialize control signals (Direct Addressing by default)
    enable.write(true);
    write_en.write(false);
    addr_mode_indirect.write(false);
    write_addr.write(0);
    write_data.write(0);
    search_pattern.write(0);

    // ========================================================================
    // VERIFICATION TEST SUITE (5 Canonical Test Scenarios)
    // ========================================================================

    // --- TEST CASE 1: Associative Search (Content Addressing - HIT at Index 0) ---
    std::cout << "--- TEST CASE 1: Associative Search for Pattern 0xA5A5 (Expected HIT at Index 0) ---\n";
    std::cout << "    [Delta Cycle] Staging search_pattern=0xA5A5 -> evaluate phase -> update phase\n";
    search_pattern.write(0xA5A5);
    sc_start(10, SC_NS);

    // --- TEST CASE 2: High-Mismatch Associative Search (Content Addressing - MISS) ---
    std::cout << "\n--- TEST CASE 2: Associative Search for Inverted Pattern 0x5A5A (Expected Peak MISS) ---\n";
    std::cout << "    [Delta Cycle] Staging search_pattern=0x5A5A -> evaluate phase -> update phase\n";
    search_pattern.write(0x5A5A);
    sc_start(10, SC_NS);

    // --- TEST CASE 3: Direct Write Mode (addr_mode_indirect = 0, Write 0x1234 to Index 3) ---
    std::cout << "\n--- TEST CASE 3: Direct Addressing Write (addr_mode_indirect=0, Write 0x1234 to Index 3) ---\n";
    std::cout << "    [Addressing Math] Effective Address = write_addr = 3\n";
    write_en.write(true);
    addr_mode_indirect.write(false);
    write_addr.write(3);
    write_data.write(0x1234);
    sc_start(10, SC_NS);

    // --- TEST CASE 4: Indirect / Base-Offset Write Mode (addr_mode_indirect = 1, Base=2, Offset=3 -> Index 5) ---
    std::cout << "\n--- TEST CASE 4: Indirect Addressing Write (addr_mode_indirect=1, Base=2, Offset=3 -> Index 5) ---\n";
    std::cout << "    [Addressing Math] Effective Address = Base(2) + Offset(3) = 5\n";
    write_en.write(true);
    addr_mode_indirect.write(true);
    write_addr.write(3); // Offset = 3
    write_data.write(0xDEAD);
    sc_start(10, SC_NS);

    // --- TEST CASE 5: Associative Search Verifying Indirect Write (Expected HIT at Index 5) ---
    std::cout << "\n--- TEST CASE 5: Associative Search for 0xDEAD (Verifying Indirect Write HIT at Index 5) ---\n";
    write_en.write(false);
    addr_mode_indirect.write(false);
    search_pattern.write(0xDEAD);
    sc_start(10, SC_NS);

    // ========================================================================
    // CLI PARAMETER PARSER (Interactive Execution from Web Server / Command Line)
    // ========================================================================
    bool wait_for_keypress = true;
    std::string custom_op = "";
    unsigned int custom_pattern = 0;
    unsigned int custom_write_addr = 0;
    unsigned int custom_write_data = 0;
    bool custom_indirect = false;
    bool has_custom = false;

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--no-pause" || arg == "-n") {
            wait_for_keypress = false;
        } else if (arg == "--op" && i + 1 < argc) {
            custom_op = argv[++i];
            has_custom = true;
        } else if (arg == "--pattern" && i + 1 < argc) {
            std::string p = argv[++i];
            custom_pattern = std::stoul(p, nullptr, 0);
        } else if (arg == "--addr" && i + 1 < argc) {
            custom_write_addr = std::stoul(argv[++i], nullptr, 0);
        } else if (arg == "--data" && i + 1 < argc) {
            std::string d = argv[++i];
            custom_write_data = std::stoul(d, nullptr, 0);
        } else if (arg == "--indirect") {
            custom_indirect = true;
        }
    }

    // Execute Custom User Cycle if requested via CLI
    if (has_custom) {
        std::cout << "\n--- CUSTOM CYCLE EXECUTION (" << custom_op << ") ---\n";
        if (custom_op == "WRITE") {
            write_en.write(true);
            addr_mode_indirect.write(custom_indirect);
            write_addr.write(custom_write_addr);
            write_data.write(custom_write_data);
        } else {
            write_en.write(false);
            addr_mode_indirect.write(false);
            search_pattern.write(custom_pattern);
        }
        sc_start(10, SC_NS);
    }

    // ========================================================================
    // FINAL ESL TELEMETRY REPORT & DATA EXPORT
    // ========================================================================
    cam.print_power_report();
    cam.export_json("simulation_data.json");

    // Close waveform trace file
    sc_close_vcd_trace_file(tf);
    std::cout << "[VCD TRACE] Waveform dump saved successfully to 'cam_trace.vcd'\n";
    std::cout << "\n--- Simulation Finished Successfully ---\n";

    if (wait_for_keypress) {
        system("pause");
    }
    return 0;
}