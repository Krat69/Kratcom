cmake_minimum_required(VERSION 3.22)
project(kratcom_llama_harness CXX)

# Compila el núcleo de inferencia para ESTE ordenador y lo ejerce contra un
# GGUF de verdad. Es el mismo kratcom_llama.cpp que corre en Android e iOS: lo
# único que cambia en el móvil es el envoltorio (JNI o Swift), así que probar
# aquí cubre la parte que de verdad puede fallar en silencio —plantilla de
# chat, muestreo, corte por fin de secuencia y cancelación—.

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PLUGIN_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/..)
set(SHARED ${PLUGIN_ROOT}/shared)
set(LLAMA ${PLUGIN_ROOT}/android/src/main/cpp/llama.cpp)

if(NOT EXISTS ${LLAMA}/CMakeLists.txt)
    message(FATAL_ERROR
        "Falta el submódulo llama.cpp. Ejecuta: git submodule update --init --recursive")
endif()

set(LLAMA_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL           OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS    OFF CACHE BOOL "" FORCE)

add_subdirectory(${LLAMA} ${CMAKE_BINARY_DIR}/llama EXCLUDE_FROM_ALL)

add_executable(harness harness.cpp ${SHARED}/kratcom_llama.cpp)
target_include_directories(harness PRIVATE ${SHARED}/include)
target_link_libraries(harness PRIVATE llama ggml)
