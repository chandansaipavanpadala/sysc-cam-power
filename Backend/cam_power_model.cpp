#include "cam_power_model.h"

// ============================================================================
// Explicit Template Instantiations
// Ensures link-time availability for common System-on-Chip CAM configurations
// ============================================================================

// Standard Course Benchmark Configuration: 10 entries x 16-bit word width
template class CAM_Power_Model<10, 16>;

// 32-bit Embedded RISC-V / ARM Architecture Configuration: 10 entries x 32 bits
template class CAM_Power_Model<10, 32>;

// Enterprise IPv6 Network Router Forwarding Table: 10 entries x 128 bits
template class CAM_Power_Model<10, 128>;

// Expanded 16-entry and 32-entry Microarchitectures
template class CAM_Power_Model<16, 16>;
template class CAM_Power_Model<16, 32>;
template class CAM_Power_Model<32, 32>;
template class CAM_Power_Model<32, 128>;