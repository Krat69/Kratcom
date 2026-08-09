cmake_minimum_required(VERSION 3.22.1)
project(kratcom_llama CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# llama.cpp entra como submódulo de git, fijado a una etiqueta concreta. Nada
# de descargarlo durante el build: una compilación que depende de la red no es
# reproducible.
set(LLAMA_DIR ${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp)
if(NOT EXISTS ${LLAMA_DIR}/CMakeLists.txt)
    message(FATAL_ERROR
        "Falta el submódulo llama.cpp. Ejecuta: git submodule update --init --recursive")
endif()

# Solo la biblioteca: ni ejemplos, ni tests, ni herramientas de línea de
# comandos. Compilarlos multiplicaría el tiempo de build para nada.
set(LLAMA_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL           OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP          OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS    OFF CACHE BOOL "" FORCE)

add_subdirectory(${LLAMA_DIR} ${CMAKE_CURRENT_BINARY_DIR}/llama.cpp EXCLUDE_FROM_ALL)

add_library(kratcom_llama SHARED
    jni_bridge.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../shared/kratcom_llama.cpp
)

target_include_directories(kratcom_llama PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../shared/include
)

target_link_libraries(kratcom_llama PRIVATE llama ggml android log)

# Google Play exige alineación de páginas de 16 KB desde Android 15. Sin esto
# la subida se rechaza, y el error llega tarde: al publicar, no al compilar.
target_link_options(kratcom_llama PRIVATE
    "-Wl,-z,max-page-size=16384"
    "-Wl,-z,common-page-size=16384"
)
