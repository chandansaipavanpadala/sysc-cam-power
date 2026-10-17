# ==============================================================================
# Makefile for SystemC CAM Power Model Assignment
# ==============================================================================

# Compiler & SystemC Configuration
CXX       = g++
CXXFLAGS  = -std=c++17 -DSC_ALLOW_DEPRECATED_IEEE_API -Wall -O2
SYSTEMC   = C:/systemc

INCLUDES  = -I$(SYSTEMC)/include
LDFLAGS   = -L$(SYSTEMC)/lib -lsystemc

# Target & Source Files
TARGET    = sim.exe
SRCS      = main.cpp cam_power_model.cpp
OBJS      = $(SRCS:.cpp=.o)

# Default Rule
all: $(TARGET)

$(TARGET): $(SRCS)
	@echo "Compiling SystemC CAM Power Model..."
	$(CXX) $(CXXFLAGS) $(INCLUDES) $(SRCS) $(LDFLAGS) -o $(TARGET)
	@echo "Build successful: Executable generated at $(TARGET)"

# Run Rule
run: $(TARGET)
	@echo "Executing SystemC Simulation..."
	$(TARGET)

# Clean Rule
clean:
	@echo "Cleaning up generated files..."
	rm -f *.o $(TARGET) cam_trace.vcd

.PHONY: all run clean
