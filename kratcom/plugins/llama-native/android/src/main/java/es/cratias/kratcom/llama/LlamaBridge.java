package es.cratias.kratcom.llama;

/**
 * Frontera con el código nativo. Métodos estáticos y tipos primitivos: cuanto
 * menos sepa JNI de objetos Java, menos sitios donde equivocarse.
 *
 * Ninguna de estas llamadas es segura de invocar en paralelo sobre el mismo
 * handle, salvo {@link #nativeStop}. Quien serializa es {@link LlamaNativePlugin}.
 */
final class LlamaBridge {

    /** Recibe cada fragmento de texto según se genera. */
    interface TokenSink {
        void onToken(String text);
    }

    static {
        System.loadLibrary("kratcom_llama");
    }

    private LlamaBridge() {}

    /** Devuelve el handle nativo, o lanza RuntimeException con el motivo. */
    static native long nativeLoad(String modelPath, int contextSize, int threads, int gpuLayers);

    static native void nativeFree(long handle);

    /** 0 = terminó, 1 = detenido por el usuario. Lanza si hubo error. */
    static native int nativeGenerate(
        long handle,
        String[] roles,
        String[] contents,
        int maxTokens,
        float temperature,
        TokenSink sink
    );

    static native void nativeStop(long handle);

    static native int nativeTokenCount(long handle, String text);
}
