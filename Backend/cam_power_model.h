#ifndef CAM_POWER_MODEL_H
#define CAM_POWER_MODEL_H

#include <systemc.h>
#include <iostream>

// Constants for CAM Configuration
#define CAM_DEPTH 10    // Number of memory entries
#define CAM_WIDTH 16    // Bit width of each word

#include <vector>
#include <string>
#include <fstream>
#include <iomanip>

struct CycleData {
    int cycle;
    double time_ns;
    std::string op_type; // "SEARCH", "WRITE", "DISABLED"
    uint16_t search_pattern;
    uint16_t write_data;
    int write_addr;
    bool hit;
    int hit_addr;
    int total_mismatches;
    double power_mw;
    double accumulated_energy_mj;
    uint16_t cam_snapshot[CAM_DEPTH];
    int line_mismatches[CAM_DEPTH];
};

SC_MODULE(CAM_Power_Model) {
    // Clock and Control Inputs
    sc_in<bool>               clk;
    sc_in<bool>               enable;
    sc_in<bool>               write_en;
    sc_in<sc_uint<4>>         write_addr;      // 4-bit address for 10 entries (0..9)
    sc_in<sc_uint<CAM_WIDTH>> search_pattern;  // Query word to search
    sc_in<sc_uint<CAM_WIDTH>> write_data;      // Word to write during write cycle

    // Outputs
    sc_out<bool>              match_found;     // High if pattern matches any CAM entry
    sc_out<sc_uint<4>>        match_addr;      // Index of matched entry
    sc_out<double>            estimated_power_mw; // Estimated match-line power in mW

    // Internal CAM Memory Storage
    sc_uint<CAM_WIDTH>        cam_array[CAM_DEPTH];

    // Empirical Power Parameters (from IEEE Paper Model)
    const double P_LEAKAGE_MW;    // Base static leakage power in mW
    const double E_MISMATCH_FACTOR; // Dynamic energy coefficient per bit mismatch (mJ/cycle)

    // Statistical Counters for ESL Verification
    unsigned long total_searches;
    unsigned long total_hits;
    unsigned long total_misses;
    double        accumulated_energy_mj;
    int           current_cycle;

    // Recorded cycle history for JSON web export
    std::vector<CycleData> cycle_history;

    // Process Method
    void cam_operation();

    // Summary Report Generator
    void print_power_report() const;

    // Export simulation trace to JSON for visual web dashboard
    void export_json(const std::string& filename) const;

    // Constructor declaration
    SC_HAS_PROCESS(CAM_Power_Model);
    CAM_Power_Model(sc_module_name name);
};

#endif // CAM_POWER_MODEL_H