#include <systemc.h>
#include "cam_power_model.h"

int sc_main(int argc, char* argv[]) {
    // ------------------------------------------------------------------------
    // 1. Signal Declarations
    // ------------------------------------------------------------------------
    sc_clock clk("clk", 10, SC_NS); // 100 MHz clock signal (10 ns period)

    sc_signal<bool>               enable;
    sc_signal<bool>               write_en;
    sc_signal<sc_uint<4>>         write_addr;
    sc_signal<sc_uint<CAM_WIDTH>> search_pattern;
    sc_signal<sc_uint<CAM_WIDTH>> write_data;

    sc_signal<bool>               match_found;
    sc_signal<sc_uint<4>>         match_addr;
    sc_signal<double>             estimated_power_mw;

    // ------------------------------------------------------------------------
    // 2. Component Instantiation & Port Bindings
    // ------------------------------------------------------------------------
    CAM_Power_Model cam("CAM_Inst");
    cam.clk(clk);
    cam.enable(enable);
    cam.write_en(write_en);
    cam.write_addr(write_addr);
    cam.search_pattern(search_pattern);
    cam.write_data(write_data);
    cam.match_found(match_found);
    cam.match_addr(match_addr);
    cam.estimated_power_mw(estimated_power_mw);

    // ------------------------------------------------------------------------
    // 3. VCD Waveform Tracing Setup (GTKWave / EDA Playground)
    // ------------------------------------------------------------------------
    sc_trace_file *tf = sc_create_vcd_trace_file("cam_trace");
    tf->set_time_unit(1, SC_NS);

    sc_trace(tf, clk, "clk");
    sc_trace(tf, enable, "enable");
    sc_trace(tf, write_en, "write_en");
    sc_trace(tf, write_addr, "write_addr");
    sc_trace(tf, search_pattern, "search_pattern");
    sc_trace(tf, write_data, "write_data");
    sc_trace(tf, match_found, "match_found");
    sc_trace(tf, match_addr, "match_addr");
    sc_trace(tf, estimated_power_mw, "estimated_power_mw");

    std::cout << "\n========================================================\n";
    std::cout << "     SYSTEMC CAM POWER MODEL - SIMULATION STARTED        \n";
    std::cout << "========================================================\n\n";

    // Initialize control signals
    enable.write(true);
    write_en.write(false);
    write_addr.write(0);
    write_data.write(0);
    search_pattern.write(0);

    // ------------------------------------------------------------------------
    // 4. Test Case Execution
    // ------------------------------------------------------------------------

    // --- TEST CASE 1: Initial Search (Exact HIT condition at Entry 0) ---
    std::cout << "--- TEST CASE 1: Searching pattern 0xA5A5 (Expected HIT at Index 0) ---\n";
    search_pattern.write(0xA5A5);
    sc_start(10, SC_NS);

    // --- TEST CASE 2: High Bit-Mismatch Search (High Power MISS condition) ---
    std::cout << "\n--- TEST CASE 2: Searching pattern 0x5A5A (Expected High-Power MISS) ---\n";
    search_pattern.write(0x5A5A);
    sc_start(10, SC_NS);

    // --- TEST CASE 3: Dynamic Write Operation (Writing 0xDEAD to Index 5) ---
    std::cout << "\n--- TEST CASE 3: Write 0xDEAD into CAM Index 5 ---\n";
    write_en.write(true);
    write_addr.write(5);
    write_data.write(0xDEAD);
    sc_start(10, SC_NS);

    // --- TEST CASE 4: Re-search for Newly Written Pattern (Verification HIT) ---
    std::cout << "\n--- TEST CASE 4: Re-search pattern 0xDEAD (Expected HIT at Index 5) ---\n";
    write_en.write(false);
    search_pattern.write(0xDEAD);
    sc_start(10, SC_NS);

    // --- TEST CASE 5: Low Bit-Mismatch Search (Low Power MISS condition) ---
    std::cout << "\n--- TEST CASE 5: Searching pattern 0xA5A4 (Expected Low-Power MISS) ---\n";
    search_pattern.write(0xA5A4); // Only 1-bit difference from 0xA5A5
    sc_start(10, SC_NS);

    bool wait_for_keypress = true;
    std::string custom_op = "";
    unsigned int custom_pattern = 0;
    unsigned int custom_write_addr = 0;
    unsigned int custom_write_data = 0;
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
        }
    }

    // Execute Custom User Cycle if requested via CLI
    if (has_custom) {
        std::cout << "\n--- CUSTOM CYCLE EXECUTION (" << custom_op << ") ---\n";
        if (custom_op == "WRITE") {
            write_en.write(true);
            write_addr.write(custom_write_addr);
            write_data.write(custom_write_data);
        } else {
            write_en.write(false);
            search_pattern.write(custom_pattern);
        }
        sc_start(10, SC_NS);
    }

    // ------------------------------------------------------------------------
    // 5. Final Statistics & Clean Up
    // ------------------------------------------------------------------------
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