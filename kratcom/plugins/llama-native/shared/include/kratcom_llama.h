// Núcleo de inferencia compartido por Android e iOS.
//
// Expone una fachada en C, no en C++, por dos razones: JNI habla C sin
// fricción, y Swift puede importar una cabecera C directamente sin necesidad
// de interoperabilidad con C++. La lógica de llama.cpp vive una sola vez.
//
// Contrato de hilos: una sesión atiende UNA generación cada vez. El contexto
// de llama.cpp no es seguro para decodificaciones concurrentes, así que quien
// llama debe serializar (en Android lo hace un mutex en Kotlin). `stop` sí es
// seguro llamarlo desde otro hilo mientras `generate` está en marcha.

#ifndef KRATCOM_LLAMA_H
#define KRATCOM_LLAMA_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct kratcom_llama_session kratcom_llama_session;

/** Se invoca por cada fragmento de texto generado. No debe bloquear. */
typedef void (*kratcom_token_cb)(const char *text, void *user_data);

/**
 * Carga un modelo GGUF desde el disco.
 *
 * n_gpu_layers = 0 fuerza CPU pura (el ajuste «solo CPU» de la app).
 * Devuelve NULL si falla, dejando el motivo en `err`.
 */
kratcom_llama_session *kratcom_llama_load(const char *model_path,
                                          int n_ctx,
                                          int n_threads,
                                          int n_gpu_layers,
                                          char *err,
                                          int err_len);

void kratcom_llama_free(kratcom_llama_session *session);

/**
 * Genera una respuesta para la conversación dada, aplicando la plantilla de
 * chat que trae el propio GGUF.
 *
 * `roles` y `contents` son arrays paralelos de longitud `n_messages`; los
 * roles válidos son "system", "user" y "assistant".
 *
 * Devuelve 0 si terminó bien, 1 si se detuvo por petición del usuario, y un
 * valor negativo en caso de error (con el motivo en `err`).
 */
int kratcom_llama_generate(kratcom_llama_session *session,
                           const char *const *roles,
                           const char *const *contents,
                           int n_messages,
                           int max_tokens,
                           float temperature,
                           kratcom_token_cb callback,
                           void *user_data,
                           char *err,
                           int err_len);

/** Pide que la generación en curso pare. Seguro desde cualquier hilo. */
void kratcom_llama_stop(kratcom_llama_session *session);

/** Número aproximado de tokens del texto, según el tokenizador del modelo. */
int kratcom_llama_token_count(kratcom_llama_session *session, const char *text);

#ifdef __cplusplus
}
#endif

#endif // KRATCOM_LLAMA_H
