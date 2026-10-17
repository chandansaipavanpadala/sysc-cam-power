#ifndef CAM_POWER_MODEL_H
#define CAM_POWER_MODEL_H

#include <systemc.h>
#include <iostream>
#include <vector>
#include <string>
#include <fstream>
#include <iomanip>
#include <cstdint>

// ============================================================================
// Addressing Mode Enumeration
// ============================================================================
enum AddressingMode {
    DIRECT_ADDRESSING   = 0, // Effective Address = write_addr
    INDIRECT_ADDRESSING = 1  // Effective Address = base_pointer_reg + write_addr
};

// ============================================================================
// Cycle Data Trace Structure for JSON Export & Verification Telemetry
// Dynamically sized to support arbitrary CAM depths and widths
// ============================================================================
struct CycleData {
    int                   cycle;
    double                time_ns;
    std::string           op_type;            // "SEARCH", "WRITE", "DISABLED"
    bool                  addr_mode_indirect; // false = Direct, true = Indirect (Base+Offset)
    uint32_t              base_pointer;       // Base Pointer register value
    uint32_t              write_addr_offset;  // Raw address / offset input
    uint32_t              effective_addr;     // Calculated physical CAM row
    uint64_t              search_pattern;
    uint64_t              write_data;
    bool                  hit;
    int                   hit_addr;
    int                   total_mismatches;
    double                power_mw;
    double                accumulated_energy_mj;
    std::vector<uint64_t> cam_snapshot;       // Dynamically sized snapshot of memory contents
    std::vector<int>      line_mismatches;    // Dynamically sized per-row mismatch counts
};

// ============================================================================
// Templated SystemC CAM Power Model Module
// Eliminates all hardcoded depth and width macros via C++ template metaprogramming
// ============================================================================
template <unsigned int CAM_DEPTH = 10, unsigned int CAM_WIDTH = 16>
class CAM_Power_Model : public sc_module {
public:
    // Typedef dynamically selecting sc_biguint for >64 bits (IPv6) and sc_uint for <=64 bits
    using data_t = typename std::conditional<(CAM_WIDTH > 64), sc_biguint<CAM_WIDTH>, sc_uint<CAM_WIDTH>>::type;

    // ------------------------------------------------------------------------
    // SystemC Primitive Channel Interfaces (Ports)
    // ------------------------------------------------------------------------
    // Clock & Control Inputs
    sc_in<bool>         clk;                // Master synchronous clock
    sc_in<bool>         enable;             // Clock gating / Module enable
    sc_in<bool>         write_en;           // Write Enable: 1 = Write, 0 = Search
    sc_in<bool>         addr_mode_indirect; // Addressing Mode: 0 = Direct, 1 = Indirect

    // Address & Data Inputs (32-bit address space for scalable capacity)
    sc_in<sc_uint<32>>  write_addr;         // Address / Offset input bus
    sc_in<data_t>       search_pattern;     // Associative query word
    sc_in<data_t>       write_data;         // Data payload to write

    // Output Telemetry & Result Ports
    sc_out<bool>        match_found;        // Asserted on associative match (HIT)
    sc_out<sc_uint<32>> match_addr;         // Lowest matched row index (Priority Encoded)
    sc_out<double>      estimated_power_mw; // Real-time estimated match-line power in mW

    // ------------------------------------------------------------------------
    // Internal Microarchitectural Registers & Storage
    // ------------------------------------------------------------------------
    data_t              cam_array[CAM_DEPTH]; // Associative storage cells
    sc_uint<32>         base_pointer_reg;     // Base address register for indirect addressing

    // Dynamic Empirical Power Model Parameters (Passed via Constructor)
    double              p_leakage;            // Static subthreshold leakage power (mW)
    double              e_mismatch_factor;    // Dynamic switching energy per bit mismatch (mW/bit)

    // Statistical Counters for ESL Power & Performance Verification
    unsigned long       total_searches;
    unsigned long       total_hits;
    unsigned long       total_misses;
    double              accumulated_energy_mj;
    int                 current_cycle;

    // Recorded cycle history for JSON web visualizer export
    std::vector<CycleData> cycle_history;

    // ------------------------------------------------------------------------
    // Member Functions
    // ------------------------------------------------------------------------
    void cam_operation();
    void load_initial_memory(const std::vector<data_t>& init_data);
    void set_base_pointer(sc_uint<32> base_ptr) { base_pointer_reg = base_ptr; }
    sc_uint<32> get_base_pointer() const { return base_pointer_reg; }
    void print_power_report() const;
    void export_json(const std::string& filename) const;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    SC_HAS_PROCESS(CAM_Power_Model);
    CAM_Power_Model(sc_module_name name, 
                    double p_leak = 0.002, 
                    double e_factor = 0.015, 
                    sc_uint<32> init_base_ptr = 0)
        : sc_module(name),
          base_pointer_reg(init_base_ptr),
          p_leakage(p_leak),
          e_mismatch_factor(e_factor),
          total_searches(0),
          total_hits(0),
          total_misses(0),
          accumulated_energy_mj(0.0),
          current_cycle(0)
    {
        SC_METHOD(cam_operation);
        sensitive << clk.pos();
        dont_initialize();

        // Initialize memory cells to default zero
        for (unsigned int i = 0; i < CAM_DEPTH; i++) {
            cam_array[i] = 0;
        }
    }
};

// ============================================================================
// Template Method Implementations (Inline for header-only template linkage)
// ============================================================================

template <unsigned int CAM_DEPTH, unsigned int CAM_WIDTH>
void CAM_Power_Model<CAM_DEPTH, CAM_WIDTH>::load_initial_memory(
    const std::vector<typename CAM_Power_Model<CAM_DEPTH, CAM_WIDTH>::data_t>& init_data) 
{
    unsigned int count = std::min(static_cast<unsigned int>(init_data.size()), CAM_DEPTH);
    for (unsigned int i = 0; i < count; i++) {
        cam_array[i] = init_data[i];
    }
    std::cout << "[CAM INIT] Dynamically loaded " << count 
              << " entries into CAM array (" << CAM_DEPTH << "x" << CAM_WIDTH << ")\n";
}

template <unsigned int CAM_DEPTH, unsigned int CAM_WIDTH>
void CAM_Power_Model<CAM_DEPTH, CAM_WIDTH>::cam_operation() {
    current_cycle++;
    double time_val = sc_time_stamp().to_double() / 1000.0; // ns

    CycleData data;
    data.cycle               = current_cycle;
    data.time_ns             = time_val;
    data.addr_mode_indirect  = addr_mode_indirect.read();
    data.base_pointer        = static_cast<uint32_t>(base_pointer_reg);
    data.write_addr_offset   = static_cast<uint32_t>(write_addr.read());
    data.effective_addr      = 0;
    data.search_pattern      = search_pattern.read().to_uint64();
    data.write_data          = write_data.read().to_uint64();
    data.cam_snapshot.resize(CAM_DEPTH);
    data.line_mismatches.resize(CAM_DEPTH, 0);

    // ------------------------------------------------------------------------
    // 1. Clock-Gating Check: If disabled, zero dynamic power and bypass
    // ------------------------------------------------------------------------
    if (!enable.read()) {
        match_found.write(false);
        match_addr.write(0);
        estimated_power_mw.write(0.0);

        data.op_type               = "DISABLED";
        data.hit                   = false;
        data.hit_addr              = -1;
        data.total_mismatches      = 0;
        data.power_mw              = 0.0;
        data.accumulated_energy_mj = accumulated_energy_mj;

        for (unsigned int i = 0; i < CAM_DEPTH; i++) {
            data.cam_snapshot[i] = cam_array[i].to_uint64();
        }
        cycle_history.push_back(data);
        return;
    }

    // ------------------------------------------------------------------------
    // 2. Memory Write Cycle with Configurable Addressing Modes
    // ------------------------------------------------------------------------
    if (write_en.read()) {
        uint32_t eff_addr = 0;
        bool is_indirect = addr_mode_indirect.read();

        if (!is_indirect) {
            // Direct Addressing: Physical Address = write_addr
            eff_addr = static_cast<uint32_t>(write_addr.read());
        } else {
            // Indirect Addressing: Physical Address = base_pointer_reg + write_addr (Base + Offset)
            eff_addr = static_cast<uint32_t>(base_pointer_reg + write_addr.read());
        }
        data.effective_addr = eff_addr;

        // Bounds Checking & Write Execution
        if (eff_addr < CAM_DEPTH) {
            cam_array[eff_addr] = write_data.read();
            std::cout << "[CAM WRITE] @" << sc_time_stamp()
                      << " | Mode: " << (is_indirect ? "INDIRECT (Base+Offset)" : "DIRECT")
                      << " | Base: " << (is_indirect ? std::to_string(static_cast<uint32_t>(base_pointer_reg)) : "N/A")
                      << " | Offset: " << write_addr.read()
                      << " | EffAddr: " << eff_addr
                      << " | Data: 0x" << std::hex << write_data.read()
                      << std::dec << std::endl;
        } else {
            std::cout << "[CAM WRITE ERROR] @" << sc_time_stamp()
                      << " | Address Out of Bounds: " << eff_addr
                      << " >= CAM_DEPTH (" << CAM_DEPTH << ")\n";
        }

        // Match lines are inactive during write operations
        match_found.write(false);
        match_addr.write(0);
        estimated_power_mw.write(p_leakage);

        data.op_type               = "WRITE";
        data.hit                   = false;
        data.hit_addr              = -1;
        data.total_mismatches      = 0;
        data.power_mw              = p_leakage;
        data.accumulated_energy_mj = accumulated_energy_mj;

        for (unsigned int i = 0; i < CAM_DEPTH; i++) {
            data.cam_snapshot[i] = cam_array[i].to_uint64();
        }
        cycle_history.push_back(data);
        return;
    }

    // ------------------------------------------------------------------------
    // 3. Associative / Content Addressing Mode (Parallel XOR Match-Line Search)
    // ------------------------------------------------------------------------
    data_t pattern = search_pattern.read();
    bool hit = false;
    sc_uint<32> hit_index = 0;
    unsigned int total_mismatched_bits = 0;

    total_searches++;

    // Concurrent bitwise comparison across all CAM_DEPTH entries
    for (unsigned int i = 0; i < CAM_DEPTH; i++) {
        data_t entry = cam_array[i];
        data_t mismatch_map = entry ^ pattern; // Parallel Bitwise XOR

        unsigned int line_mismatches = 0;
        for (unsigned int b = 0; b < CAM_WIDTH; b++) {
            if (mismatch_map[b] == 1) {
                line_mismatches++;
            }
        }

        total_mismatched_bits += line_mismatches;
        data.line_mismatches[i] = line_mismatches;

        // Priority Encoder Logic: lowest index with zero mismatches asserts match
        if (line_mismatches == 0 && !hit) {
            hit = true;
            hit_index = i;
        }
    }

    // Dynamic match-line switching power model
    double current_power = p_leakage + (total_mismatched_bits * e_mismatch_factor);

    // Update Output Ports
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

    // Accumulate Energy (Power in mW * 10 ns clock period = 10e-6 mJ)
    accumulated_energy_mj += (current_power * 10.0e-6);

    data.op_type               = "SEARCH";
    data.hit                   = hit;
    data.hit_addr              = hit ? static_cast<int>(hit_index) : -1;
    data.total_mismatches      = total_mismatched_bits;
    data.power_mw              = current_power;
    data.accumulated_energy_mj = accumulated_energy_mj;

    for (unsigned int i = 0; i < CAM_DEPTH; i++) {
        data.cam_snapshot[i] = cam_array[i].to_uint64();
    }
    cycle_history.push_back(data);

    // Console Telemetry Stream
    std::cout << "[CAM SEARCH] @" << sc_time_stamp()
              << " | Mode: ASSOCIATIVE (Content)"
              << " | Pattern: 0x" << std::hex << pattern
              << " | Result: " << (hit ? "HIT " : "MISS")
              << " | Addr: " << std::dec << (hit ? static_cast<int>(hit_index) : -1)
              << " | Bit Mismatches: " << total_mismatched_bits
              << " | Power: " << current_power << " mW"
              << std::endl;
}

template <unsigned int CAM_DEPTH, unsigned int CAM_WIDTH>
void CAM_Power_Model<CAM_DEPTH, CAM_WIDTH>::print_power_report() const {
    std::cout << "\n========================================================\n";
    std::cout << "         ESL SYSTEMC CAM POWER ESTIMATION REPORT         \n";
    std::cout << "========================================================\n";
    std::cout << "  CAM Depth             : " << CAM_DEPTH << " entries\n";
    std::cout << "  CAM Bit Width         : " << CAM_WIDTH << " bits\n";
    std::cout << "  Base Leakage (P_leak) : " << p_leakage << " mW\n";
    std::cout << "  Mismatch Factor (E_m) : " << e_mismatch_factor << " mW/bit\n";
    std::cout << "  Base Pointer Register : " << base_pointer_reg << "\n";
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

template <unsigned int CAM_DEPTH, unsigned int CAM_WIDTH>
void CAM_Power_Model<CAM_DEPTH, CAM_WIDTH>::export_json(const std::string& filename) const {
    std::ofstream out(filename);
    if (!out.is_open()) return;

    out << "{\n";
    out << "  \"cam_depth\": " << CAM_DEPTH << ",\n";
    out << "  \"cam_width\": " << CAM_WIDTH << ",\n";
    out << "  \"p_leakage_mw\": " << p_leakage << ",\n";
    out << "  \"e_mismatch_factor\": " << e_mismatch_factor << ",\n";
    out << "  \"base_pointer_reg\": " << base_pointer_reg << ",\n";
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
        out << "      \"addr_mode_indirect\": " << (data.addr_mode_indirect ? "true" : "false") << ",\n";
        out << "      \"base_pointer\": " << data.base_pointer << ",\n";
        out << "      \"write_addr_offset\": " << data.write_addr_offset << ",\n";
        out << "      \"effective_addr\": " << data.effective_addr << ",\n";
        out << "      \"search_pattern\": \"0x" << std::hex << std::setw(CAM_WIDTH / 4) << std::setfill('0') << data.search_pattern << std::dec << "\",\n";
        out << "      \"search_pattern_dec\": " << data.search_pattern << ",\n";
        out << "      \"write_data\": \"0x" << std::hex << std::setw(CAM_WIDTH / 4) << std::setfill('0') << data.write_data << std::dec << "\",\n";
        out << "      \"write_addr\": " << (data.addr_mode_indirect ? data.effective_addr : data.write_addr_offset) << ",\n";
        out << "      \"hit\": " << (data.hit ? "true" : "false") << ",\n";
        out << "      \"hit_addr\": " << data.hit_addr << ",\n";
        out << "      \"total_mismatches\": " << data.total_mismatches << ",\n";
        out << "      \"power_mw\": " << data.power_mw << ",\n";
        out << "      \"accumulated_energy_mj\": " << data.accumulated_energy_mj << ",\n";
        out << "      \"cam_snapshot\": [";
        for (unsigned int i = 0; i < CAM_DEPTH; i++) {
            out << data.cam_snapshot[i] << (i < CAM_DEPTH - 1 ? ", " : "");
        }
        out << "],\n";
        out << "      \"line_mismatches\": [";
        for (unsigned int i = 0; i < CAM_DEPTH; i++) {
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

#endif // CAM_POWER_MODEL_H