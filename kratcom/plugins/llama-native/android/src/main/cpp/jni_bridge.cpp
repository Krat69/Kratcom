// Puente JNI entre el plugin de Capacitor y el núcleo de inferencia.
//
// Es deliberadamente delgado: aquí solo se traducen tipos y se propagan
// errores. Toda la lógica de llama.cpp vive en shared/kratcom_llama.cpp, que
// Android e iOS comparten sin cambios.
//
// Sobre hilos: `nativeGenerate` se llama desde un hilo de trabajo de Kotlin y
// devuelve los tokens por el mismo hilo, así que el JNIEnv recibido es válido
// durante toda la llamada y no hace falta AttachCurrentThread. `nativeStop`
// llega desde el hilo principal y solo toca un atómico.

#include <jni.h>

#include <string>
#include <vector>

#include "kratcom_llama.h"

namespace {

constexpr int ERR_LEN = 512;

void throw_runtime(JNIEnv *env, const char *message) {
    jclass clazz = env->FindClass("java/lang/RuntimeException");
    if (clazz) env->ThrowNew(clazz, message);
}

std::string to_utf8(JNIEnv *env, jstring value) {
    if (!value) return {};
    const char *chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars ? chars : "");
    if (chars) env->ReleaseStringUTFChars(value, chars);
    return result;
}

/** Contexto que viaja como user_data hasta la callback de tokens. */
struct TokenSink {
    JNIEnv *env;
    jobject sink;
    jmethodID on_token;
    bool failed;
};

void emit_token(const char *text, void *user_data) {
    auto *sink = static_cast<TokenSink *>(user_data);
    if (!sink || sink->failed) return;

    jstring value = sink->env->NewStringUTF(text);
    if (!value) {
        sink->failed = true;
        return;
    }
    sink->env->CallVoidMethod(sink->sink, sink->on_token, value);
    sink->env->DeleteLocalRef(value);

    // Si el lado Java lanzó, se deja de emitir: seguir llamando con una
    // excepción pendiente es comportamiento indefinido en JNI.
    if (sink->env->ExceptionCheck()) sink->failed = true;
}

} // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_es_cratias_kratcom_llama_LlamaBridge_nativeLoad(JNIEnv *env, jclass,
                                                     jstring model_path,
                                                     jint n_ctx,
                                                     jint n_threads,
                                                     jint n_gpu_layers) {
    const std::string path = to_utf8(env, model_path);
    char err[ERR_LEN] = {0};

    kratcom_llama_session *session =
        kratcom_llama_load(path.c_str(), n_ctx, n_threads, n_gpu_layers, err, ERR_LEN);

    if (!session) {
        throw_runtime(env, err[0] ? err : "no se pudo cargar el modelo");
        return 0;
    }
    return reinterpret_cast<jlong>(session);
}

JNIEXPORT void JNICALL
Java_es_cratias_kratcom_llama_LlamaBridge_nativeFree(JNIEnv *, jclass, jlong handle) {
    kratcom_llama_free(reinterpret_cast<kratcom_llama_session *>(handle));
}

JNIEXPORT void JNICALL
Java_es_cratias_kratcom_llama_LlamaBridge_nativeStop(JNIEnv *, jclass, jlong handle) {
    kratcom_llama_stop(reinterpret_cast<kratcom_llama_session *>(handle));
}

JNIEXPORT jint JNICALL
Java_es_cratias_kratcom_llama_LlamaBridge_nativeTokenCount(JNIEnv *env, jclass,
                                                           jlong handle, jstring text) {
    const std::string value = to_utf8(env, text);
    return kratcom_llama_token_count(reinterpret_cast<kratcom_llama_session *>(handle),
                                     value.c_str());
}

JNIEXPORT jint JNICALL
Java_es_cratias_kratcom_llama_LlamaBridge_nativeGenerate(JNIEnv *env, jclass,
                                                         jlong handle,
                                                         jobjectArray roles,
                                                         jobjectArray contents,
                                                         jint max_tokens,
                                                         jfloat temperature,
                                                         jobject sink) {
    auto *session = reinterpret_cast<kratcom_llama_session *>(handle);
    if (!session) {
        throw_runtime(env, "el modelo todavía no está cargado");
        return -1;
    }

    const jsize count = env->GetArrayLength(roles);
    if (count != env->GetArrayLength(contents)) {
        throw_runtime(env, "roles y contenidos no cuadran");
        return -1;
    }

    // Las cadenas se mantienen vivas en este vector durante toda la llamada:
    // el núcleo guarda punteros a ellas.
    std::vector<std::string> role_storage;
    std::vector<std::string> content_storage;
    role_storage.reserve(static_cast<size_t>(count));
    content_storage.reserve(static_cast<size_t>(count));

    for (jsize i = 0; i < count; i++) {
        auto role = static_cast<jstring>(env->GetObjectArrayElement(roles, i));
        auto content = static_cast<jstring>(env->GetObjectArrayElement(contents, i));
        role_storage.push_back(to_utf8(env, role));
        content_storage.push_back(to_utf8(env, content));
        env->DeleteLocalRef(role);
        env->DeleteLocalRef(content);
    }

    std::vector<const char *> role_ptrs;
    std::vector<const char *> content_ptrs;
    role_ptrs.reserve(role_storage.size());
    content_ptrs.reserve(content_storage.size());
    for (size_t i = 0; i < role_storage.size(); i++) {
        role_ptrs.push_back(role_storage[i].c_str());
        content_ptrs.push_back(content_storage[i].c_str());
    }

    jclass sink_class = env->GetObjectClass(sink);
    jmethodID on_token = env->GetMethodID(sink_class, "onToken", "(Ljava/lang/String;)V");
    if (!on_token) {
        throw_runtime(env, "la interfaz de tokens no tiene onToken(String)");
        return -1;
    }

    TokenSink token_sink{env, sink, on_token, false};
    char err[ERR_LEN] = {0};

    const int result = kratcom_llama_generate(session, role_ptrs.data(), content_ptrs.data(),
                                              static_cast<int>(count), max_tokens, temperature,
                                              emit_token, &token_sink, err, ERR_LEN);

    // Una excepción pendiente del lado Java manda sobre el código de retorno.
    if (env->ExceptionCheck()) return -1;

    if (result < 0) {
        throw_runtime(env, err[0] ? err : "falló la generación");
        return result;
    }
    return result;
}

} // extern "C"
