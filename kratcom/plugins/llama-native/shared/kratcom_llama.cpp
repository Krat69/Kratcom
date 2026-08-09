#include "include/kratcom_llama.h"

#include "llama.h"

#include <atomic>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

namespace {

void set_error(char *err, int err_len, const char *message) {
    if (!err || err_len <= 0) return;
    std::snprintf(err, static_cast<size_t>(err_len), "%s", message);
}

// llama.cpp habla por su propio canal de logs; en producción solo interesan
// los errores, y aun esos no deben acabar en la consola del usuario.
void quiet_log(ggml_log_level level, const char *text, void *) {
    if (level >= GGML_LOG_LEVEL_ERROR) {
        std::fprintf(stderr, "[llama] %s", text);
    }
}

std::once_flag g_backend_once;

} // namespace

struct kratcom_llama_session {
    llama_model *model = nullptr;
    llama_context *ctx = nullptr;
    const llama_vocab *vocab = nullptr;
    std::atomic<bool> stop_requested{false};
};

kratcom_llama_session *kratcom_llama_load(const char *model_path,
                                          int n_ctx,
                                          int n_threads,
                                          int n_gpu_layers,
                                          char *err,
                                          int err_len) {
    if (!model_path) {
        set_error(err, err_len, "ruta del modelo vacía");
        return nullptr;
    }

    std::call_once(g_backend_once, []() {
        llama_log_set(quiet_log, nullptr);
        llama_backend_init();
    });

    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = n_gpu_layers;

    llama_model *model = llama_model_load_from_file(model_path, model_params);
    if (!model) {
        set_error(err, err_len, "no se pudo abrir el modelo (¿fichero incompleto?)");
        return nullptr;
    }

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = static_cast<uint32_t>(n_ctx);
    ctx_params.n_batch = static_cast<uint32_t>(n_ctx);
    ctx_params.n_threads = n_threads;
    ctx_params.n_threads_batch = n_threads;

    llama_context *ctx = llama_init_from_model(model, ctx_params);
    if (!ctx) {
        llama_model_free(model);
        set_error(err, err_len, "no hay memoria suficiente para el contexto");
        return nullptr;
    }

    auto *session = new kratcom_llama_session();
    session->model = model;
    session->ctx = ctx;
    session->vocab = llama_model_get_vocab(model);
    return session;
}

void kratcom_llama_free(kratcom_llama_session *session) {
    if (!session) return;
    if (session->ctx) llama_free(session->ctx);
    if (session->model) llama_model_free(session->model);
    delete session;
}

void kratcom_llama_stop(kratcom_llama_session *session) {
    if (session) session->stop_requested.store(true);
}

namespace {

/**
 * Aplica la plantilla de chat que viene dentro del GGUF. Reimplementarla a
 * mano por cada familia de modelos es la vía rápida a respuestas raras: cada
 * uno espera sus propios marcadores.
 */
bool build_prompt(const kratcom_llama_session *session,
                  const char *const *roles,
                  const char *const *contents,
                  int n_messages,
                  std::string &out,
                  char *err,
                  int err_len) {
    std::vector<llama_chat_message> chat;
    chat.reserve(static_cast<size_t>(n_messages));
    for (int i = 0; i < n_messages; i++) {
        chat.push_back({roles[i], contents[i]});
    }

    const char *tmpl = llama_model_chat_template(session->model, nullptr);
    if (!tmpl) {
        set_error(err, err_len, "el modelo no trae plantilla de chat");
        return false;
    }

    std::vector<char> buf(8192);
    int32_t written = llama_chat_apply_template(tmpl, chat.data(), chat.size(), true,
                                                buf.data(), static_cast<int32_t>(buf.size()));
    if (written > static_cast<int32_t>(buf.size())) {
        buf.resize(static_cast<size_t>(written));
        written = llama_chat_apply_template(tmpl, chat.data(), chat.size(), true,
                                            buf.data(), static_cast<int32_t>(buf.size()));
    }
    if (written < 0) {
        set_error(err, err_len, "no se pudo aplicar la plantilla de chat");
        return false;
    }

    out.assign(buf.data(), static_cast<size_t>(written));
    return true;
}

std::vector<llama_token> tokenize(const llama_vocab *vocab, const std::string &text, bool add_special) {
    // Primera llamada con n_tokens_max negativo: llama.cpp devuelve cuántos
    // hacen falta (en negativo) en vez de truncar en silencio.
    int32_t needed = -llama_tokenize(vocab, text.data(), static_cast<int32_t>(text.size()),
                                     nullptr, 0, add_special, true);
    std::vector<llama_token> tokens(static_cast<size_t>(needed));
    int32_t written = llama_tokenize(vocab, text.data(), static_cast<int32_t>(text.size()),
                                     tokens.data(), needed, add_special, true);
    if (written < 0) return {};
    tokens.resize(static_cast<size_t>(written));
    return tokens;
}

std::string token_to_text(const llama_vocab *vocab, llama_token token) {
    char buf[256];
    int32_t n = llama_token_to_piece(vocab, token, buf, sizeof(buf), 0, false);
    if (n < 0) {
        std::vector<char> big(static_cast<size_t>(-n));
        n = llama_token_to_piece(vocab, token, big.data(), static_cast<int32_t>(big.size()), 0, false);
        return n > 0 ? std::string(big.data(), static_cast<size_t>(n)) : std::string();
    }
    return std::string(buf, static_cast<size_t>(n));
}

} // namespace

int kratcom_llama_generate(kratcom_llama_session *session,
                           const char *const *roles,
                           const char *const *contents,
                           int n_messages,
                           int max_tokens,
                           float temperature,
                           kratcom_token_cb callback,
                           void *user_data,
                           char *err,
                           int err_len) {
    if (!session || !session->ctx) {
        set_error(err, err_len, "sesión no inicializada");
        return -1;
    }

    session->stop_requested.store(false);

    std::string prompt;
    if (!build_prompt(session, roles, contents, n_messages, prompt, err, err_len)) {
        return -2;
    }

    // Cada generación parte de cero: el historial completo viaja en `messages`,
    // así que reutilizar la caché de la anterior mezclaría conversaciones.
    llama_memory_clear(llama_get_memory(session->ctx), true);

    std::vector<llama_token> tokens = tokenize(session->vocab, prompt, true);
    if (tokens.empty()) {
        set_error(err, err_len, "no se pudo tokenizar la conversación");
        return -3;
    }

    // Un documento adjunto largo desborda la ventana con facilidad. Se avisa
    // en lugar de truncar en silencio: perder la mitad del documento sin
    // decirlo daría respuestas confiadas sobre texto que el modelo no vio.
    const uint32_t n_ctx = llama_n_ctx(session->ctx);
    if (tokens.size() + static_cast<size_t>(max_tokens) > n_ctx) {
        set_error(err, err_len,
                  "El texto es demasiado largo para la ventana del modelo. "
                  "Empieza una conversación nueva o usa un documento más corto.");
        return -4;
    }

    llama_sampler_chain_params chain_params = llama_sampler_chain_default_params();
    chain_params.no_perf = true;
    llama_sampler *sampler = llama_sampler_chain_init(chain_params);
    llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
    llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.95f, 1));
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(temperature));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    int result = 0;

    // Evaluación del prompt de una tacada.
    if (llama_decode(session->ctx, llama_batch_get_one(tokens.data(),
                                                       static_cast<int32_t>(tokens.size()))) != 0) {
        set_error(err, err_len, "falló la evaluación de la conversación");
        llama_sampler_free(sampler);
        return -5;
    }

    for (int generated = 0; generated < max_tokens; generated++) {
        if (session->stop_requested.load()) {
            result = 1;
            break;
        }

        llama_token token = llama_sampler_sample(sampler, session->ctx, -1);
        if (llama_vocab_is_eog(session->vocab, token)) break;

        llama_sampler_accept(sampler, token);

        const std::string piece = token_to_text(session->vocab, token);
        if (!piece.empty() && callback) callback(piece.c_str(), user_data);

        if (llama_decode(session->ctx, llama_batch_get_one(&token, 1)) != 0) {
            set_error(err, err_len, "falló la generación a mitad de la respuesta");
            result = -6;
            break;
        }
    }

    llama_sampler_free(sampler);
    return result;
}

int kratcom_llama_token_count(kratcom_llama_session *session, const char *text) {
    if (!session || !session->vocab || !text) return 0;
    return static_cast<int>(tokenize(session->vocab, std::string(text), false).size());
}
