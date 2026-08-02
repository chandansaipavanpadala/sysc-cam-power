cmake_minimum_required(VERSION 3.5)
project(SystemC_CAM_Power_Model CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# SystemC Installation Path
set(SYSTEMC_HOME "C:/systemc" CACHE PATH "Path to SystemC installation")

include_directories(${SYSTEMC_HOME}/include)
link_directories(${SYSTEMC_HOME}/lib)

add_executable(sim main.cpp cam_power_model.cpp)
target_link_libraries(sim PRIVATE systemc)
