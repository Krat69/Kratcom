// Arnés de prueba del núcleo de inferencia compartido.
//
// Ejecuta el mismo código que corre en Android e iOS, pero compilado para
// este ordenador, para poder comprobar de verdad la plantilla de chat, el
// muestreo, el corte por EOG y la cancelación.

#include "kratcom_llama.h"

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>

static std::string g_output;

static void on_token(const char *text, void *) {
    g_output += text;
    std::fputs(text, stdout);
    std::fflush(stdout);
}

static int failures = 0;

static void check(const char *name, bool ok, const std::string &detail = "") {
    std::printf("%s %s%s%s\n", ok ? "OK  " : "FALLA", name,
                detail.empty() ? "" : " — ", detail.c_str());
    if (!ok) failures++;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        std::fprintf(stderr, "uso: harness <modelo.gguf>\n");
        return 2;
    }

    char err[512] = {0};
    kratcom_llama_session *session = kratcom_llama_load(argv[1], 2048, 4, 0, err, sizeof(err));
    check("carga el modelo", session != nullptr, err);
    if (!session) return 1;

    // --- Conteo de tokens ---------------------------------------------------
    const int count = kratcom_llama_token_count(session, "Hola, ¿qué tal estás hoy?");
    check("tokeniza texto", count > 3 && count < 30, "tokens=" + std::to_string(count));

    // --- Generación normal --------------------------------------------------
    const char *roles[] = {"system", "user"};
    const char *contents[] = {
        "Eres un asistente conciso. Responde en español con una sola frase corta.",
        "¿Cuál es la capital de Francia?"};

    std::printf("\n--- respuesta ---\n");
    g_output.clear();
    auto start = std::chrono::steady_clock::now();
    int rc = kratcom_llama_generate(session, roles, contents, 2, 64, 0.2f,
                                    on_token, nullptr, err, sizeof(err));
    auto elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
    std::printf("\n-----------------\n");

    check("genera sin error", rc == 0, rc != 0 ? err : "");
    check("produce texto", !g_output.empty(), std::to_string(g_output.size()) + " caracteres");
    check("la respuesta menciona París",
          g_output.find("arís") != std::string::npos || g_output.find("aris") != std::string::npos,
          g_output.substr(0, 80));
    check("se detiene sola antes del tope", g_output.size() < 400,
          "en " + std::to_string(elapsed).substr(0, 4) + " s");

    // --- Segunda generación: el contexto no debe arrastrarse -----------------
    const char *roles2[] = {"user"};
    const char *contents2[] = {"Repite exactamente esta palabra: bicicleta"};
    g_output.clear();
    rc = kratcom_llama_generate(session, roles2, contents2, 1, 32, 0.1f,
                                on_token, nullptr, err, sizeof(err));
    check("una segunda generación funciona", rc == 0 && !g_output.empty(), err);
    check("no arrastra la conversación anterior",
          g_output.find("arís") == std::string::npos, g_output.substr(0, 80));

    // --- Cancelación --------------------------------------------------------
    const char *roles3[] = {"user"};
    const char *contents3[] = {"Escribe una lista muy larga de cien ciudades europeas."};
    g_output.clear();

    // Se espera a que haya salido texto de verdad antes de cancelar: medir por
    // reloj hace la prueba dependiente de lo ocupada que esté la máquina.
    std::thread stopper([session]() {
        for (int i = 0; i < 400 && g_output.empty(); i++) {
            std::this_thread::sleep_for(std::chrono::milliseconds(25));
        }
        kratcom_llama_stop(session);
    });
    rc = kratcom_llama_generate(session, roles3, contents3, 1, 500, 0.7f,
                                on_token, nullptr, err, sizeof(err));
    stopper.join();
    check("la cancelación devuelve 1", rc == 1, "rc=" + std::to_string(rc));
    check("y conserva lo ya generado", !g_output.empty(),
          std::to_string(g_output.size()) + " caracteres");

    kratcom_llama_free(session);

    std::printf("\n%s\n", failures == 0 ? "TODO CORRECTO" : "HAY FALLOS");
    return failures == 0 ? 0 : 1;
}
