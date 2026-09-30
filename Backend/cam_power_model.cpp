#include "cam_power_model.h"

// Constructor Implementation
CAM_Power_Model::CAM_Power_Model(sc_module_name name)
    : sc_module(name),
      P_LEAKAGE_MW(0.002),       // 2 microwatts base static leakage
      E_MISMATCH_FACTOR(0.015),  // 0.015 mW per mismatched bit
      total_searches(0),
      total_hits(0),
      total_misses(0),
      accumulated_energy_mj(0.0),
      current_cycle(0)
{
    SC_METHOD(cam_operation);
    sensitive << clk.pos();
    dont_initialize();

    // Initialize CAM entries with distinct deterministic patterns
    // Entry 0: 0xA5A5, Entry 1: 0xA5A6, ..., Entry 9: 0xA5AE
    for (int i = 0; i < CAM_DEPTH; i++) {
        cam_array[i] = static_cast<sc_uint<CAM_WIDTH>>(0xA5A5 + i);
    }
}

// Core Execution Method triggered on rising clock edge
void CAM_Power_Model::cam_operation() {
    current_cycle++;
    double time_val = sc_time_stamp().to_double() / 1000.0; // ns

    CycleData data;
    data.cycle = current_cycle;
    data.time_ns = time_val;
    data.search_pattern = static_cast<uint16_t>(search_pattern.read());
    data.write_data = static_cast<uint16_t>(write_data.read());
    data.write_addr = static_cast<int>(write_addr.read());

    // Clock-Gating Check: If disabled, clear outputs & report zero dynamic power
    if (!enable.read()) {
        match_found.write(false);
        match_addr.write(0);
        estimated_power_mw.write(0.0);
        
        data.op_type = "DISABLED";
        data.hit = false;
        data.hit_addr = -1;
        data.total_mismatches = 0;
        data.power_mw = 0.0;
        data.accumulated_energy_mj = accumulated_energy_mj;
        for (int i = 0; i < CAM_DEPTH; i++) {
            data.cam_snapshot[i] = static_cast<uint16_t>(cam_array[i]);
            data.line_mismatches[i] = 0;
        }
        cycle_history.push_back(data);
        return;
    }

    // Write Operation Cycle
    if (write_en.read()) {
        sc_uint<4> addr = write_addr.read();
        if (addr < CAM_DEPTH) {
            cam_array[addr] = write_data.read();
            std::cout << "[CAM WRITE] @" << sc_time_stamp()
                      << " | Addr: " << std::dec << addr
                      << " | Data: 0x" << std::hex << write_data.read()
                      << std::endl;
        }
        match_found.write(false);
        match_addr.write(0);
        estimated_power_mw.write(P_LEAKAGE_MW);

        data.op_type = "WRITE";
        data.hit = false;
        data.hit_addr = -1;
        data.total_mismatches = 0;
        data.power_mw = P_LEAKAGE_MW;
        data.accumulated_energy_mj = accumulated_energy_mj;
        for (int i = 0; i < CAM_DEPTH; i++) {
            data.cam_snapshot[i] = static_cast<uint16_t>(cam_array[i]);
            data.line_mismatches[i] = 0;
        }
        cycle_history.push_back(data);
        return;
    }

    // Parallel Search Operation & Match-Line Power Estimation
    sc_uint<CAM_WIDTH> pattern = search_pattern.read();
    bool hit = false;
    sc_uint<4> hit_index = 0;
    unsigned int total_mismatched_bits = 0;

    total_searches++;

    // Evaluate all 10 match lines in parallel via XOR
    for (int i = 0; i < CAM_DEPTH; i++) {
        sc_uint<CAM_WIDTH> entry = cam_array[i];
        sc_uint<CAM_WIDTH> mismatch_map = entry ^ pattern; // Bitwise XOR

        unsigned int line_mismatches = 0;
        for (int b = 0; b < CAM_WIDTH; b++) {
            if (mismatch_map[b] == 1) {
                line_mismatches++;
            }
        }

        total_mismatched_bits += line_mismatches;
        data.line_mismatches[i] = line_mismatches;

        // Priority Encoder Logic: First matching line sets hit
        if (line_mismatches == 0 && !hit) {
            hit = true;
            hit_index = static_cast<sc_uint<4>>(i);
        }
    }

    // Power Calculation Formula: P_total = P_leakage + (Total_Mismatches * E_factor)
    double current_power = P_LEAKAGE_MW + (total_mismatched_bits * E_MISMATCH_FACTOR);

    // Update Statistics
    if (hit) {
        total_hits++;
        match_found.write(true);
        match_addr.write(hit_index);
    } else {
        total_misses++;
        match_found.write(false);
        match_addr.write(0);
    }

    estimated_power_mw.write(current_power);

    // Accumulate total energy (Power in mW * 10 ns clock period = Energy in picojoules/nanojoules)
    accumulated_energy_mj += (current_power * 10.0e-6); // Convert mW*ns to mJ

    data.op_type = "SEARCH";
    data.hit = hit;
    data.hit_addr = hit ? static_cast<int>(hit_index) : -1;
    data.total_mismatches = total_mismatched_bits;
    data.power_mw = current_power;
    data.accumulated_energy_mj = accumulated_energy_mj;
    for (int i = 0; i < CAM_DEPTH; i++) {
        data.cam_snapshot[i] = static_cast<uint16_t>(cam_array[i]);
    }
    cycle_history.push_back(data);

    // Formatted Log Output
    std::cout << "[CAM SEARCH] @" << sc_time_stamp()
              << " | Pattern: 0x" << std::hex << pattern
              << " | Result: " << (hit ? "HIT " : "MISS")
              << " | Addr: " << std::dec << (hit ? static_cast<int>(hit_index) : -1)
              << " | Bit Mismatches: " << total_mismatched_bits
              << " | Power: " << current_power << " mW"
              << std::endl;
}

// Print Executive ESL Power Summary Report
void CAM_Power_Model::print_power_report() const {
    std::cout << "\n========================================================\n";
    std::cout << "         ESL SYSTEMC CAM POWER ESTIMATION REPORT         \n";
    std::cout << "========================================================\n";
    std::cout << "  CAM Depth             : " << CAM_DEPTH << " entries\n";
    std::cout << "  CAM Bit Width         : " << CAM_WIDTH << " bits\n";
    std::cout << "  Total Search Cycles   : " << total_searches << "\n";
    std::cout << "  Total Hits            : " << total_hits << "\n";
    std::cout << "  Total Misses          : " << total_misses << "\n";
    if (total_searches > 0) {
        std::cout << "  Hit Rate              : "
                  << (static_cast<double>(total_hits) / total_searches * 100.0) << " %\n";
    }
    std::cout << "  Accumulated Energy    : " << accumulated_energy_mj << " mJ\n";
    std::cout << "========================================================\n\n";
}

// Export simulation trace to JSON for visual web dashboard
void CAM_Power_Model::export_json(const std::string& filename) const {
    std::ofstream out(filename);
    if (!out.is_open()) return;

    out << "{\n";
    out << "  \"cam_depth\": " << CAM_DEPTH << ",\n";
    out << "  \"cam_width\": " << CAM_WIDTH << ",\n";
    out << "  \"p_leakage_mw\": " << P_LEAKAGE_MW << ",\n";
    out << "  \"e_mismatch_factor\": " << E_MISMATCH_FACTOR << ",\n";
    out << "  \"total_searches\": " << total_searches << ",\n";
    out << "  \"total_hits\": " << total_hits << ",\n";
    out << "  \"total_misses\": " << total_misses << ",\n";
    out << "  \"accumulated_energy_mj\": " << accumulated_energy_mj << ",\n";
    out << "  \"cycles\": [\n";

    for (size_t c = 0; c < cycle_history.size(); c++) {
        const auto& data = cycle_history[c];
        out << "    {\n";
        out << "      \"cycle\": " << data.cycle << ",\n";
        out << "      \"time_ns\": " << data.time_ns << ",\n";
        out << "      \"op_type\": \"" << data.op_type << "\",\n";
        out << "      \"search_pattern\": \"0x" << std::hex << std::setw(4) << std::setfill('0') << data.search_pattern << std::dec << "\",\n";
        out << "      \"search_pattern_dec\": " << data.search_pattern << ",\n";
        out << "      \"write_data\": \"0x" << std::hex << std::setw(4) << std::setfill('0') << data.write_data << std::dec << "\",\n";
        out << "      \"write_addr\": " << data.write_addr << ",\n";
        out << "      \"hit\": " << (data.hit ? "true" : "false") << ",\n";
        out << "      \"hit_addr\": " << data.hit_addr << ",\n";
        out << "      \"total_mismatches\": " << data.total_mismatches << ",\n";
        out << "      \"power_mw\": " << data.power_mw << ",\n";
        out << "      \"accumulated_energy_mj\": " << data.accumulated_energy_mj << ",\n";
        out << "      \"cam_snapshot\": [";
        for (int i = 0; i < CAM_DEPTH; i++) {
            out << data.cam_snapshot[i] << (i < CAM_DEPTH - 1 ? ", " : "");
        }
        out << "],\n";
        out << "      \"line_mismatches\": [";
        for (int i = 0; i < CAM_DEPTH; i++) {
            out << data.line_mismatches[i] << (i < CAM_DEPTH - 1 ? ", " : "");
        }
        out << "]\n";
        out << "    }" << (c < cycle_history.size() - 1 ? "," : "") << "\n";
    }
    out << "  ]\n";
    out << "}\n";
    out.close();
    std::cout << "[JSON EXPORT] Simulation trace data saved to '" << filename << "'\n";
}
