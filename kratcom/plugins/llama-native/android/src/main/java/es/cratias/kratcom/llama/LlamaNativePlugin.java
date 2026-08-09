package es.cratias.kratcom.llama;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Plugin LlamaNative: inferencia con llama.cpp compilado para el dispositivo.
 *
 * El contrato es el que espera src/lib/engine/native.ts. Si este plugin no
 * está presente, la app cae al motor WebAssembly sin enterarse.
 *
 * Las generaciones se serializan en un único hilo: el contexto de llama.cpp no
 * admite decodificaciones concurrentes, así que dos peticiones a la vez —el
 * chat y la consolidación de la memoria, por ejemplo— se encolan en lugar de
 * corromperse mutuamente.
 */
@CapacitorPlugin(name = "LlamaNative")
public class LlamaNativePlugin extends Plugin {

    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    /** Serializa carga, generación y liberación: todas corren en `worker`. */
    private final Object lock = new Object();

    /**
     * Guarda únicamente la validez del handle frente a `nativeStop`.
     *
     * Hace falta un candado aparte porque `abort` llega desde el hilo principal
     * mientras una generación tiene tomado `lock`: si compartieran monitor, la
     * cancelación se quedaría esperando justo a lo que quiere cortar. Este solo
     * se sostiene el tiempo de un `store` atómico.
     */
    private final Object stopLock = new Object();

    private volatile long handle = 0;
    private volatile String activeRequestId = null;

    @PluginMethod
    public void load(PluginCall call) {
        final String modelPath = call.getString("modelPath");
        if (modelPath == null || modelPath.isEmpty()) {
            call.reject("Falta la ruta del modelo");
            return;
        }
        final int contextSize = call.getInt("contextSize", 4096);
        final int threads = call.getInt("threads", 4);
        final int gpuLayers = call.getInt("gpuLayers", 0);

        // La carga tarda segundos y toca disco: nunca en el hilo principal.
        worker.execute(() -> {
            try {
                synchronized (lock) {
                    releaseHandle();
                    final long loaded =
                        LlamaBridge.nativeLoad(stripFileScheme(modelPath), contextSize, threads, gpuLayers);
                    synchronized (stopLock) {
                        handle = loaded;
                    }
                }
                call.resolve();
            } catch (RuntimeException error) {
                call.reject(message(error));
            }
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        final String requestId = call.getString("requestId");
        if (requestId == null) {
            call.reject("Falta requestId");
            return;
        }

        final List<String> roles = new ArrayList<>();
        final List<String> contents = new ArrayList<>();
        try {
            final JSArray messages = call.getArray("messages");
            final JSONArray raw = messages == null ? new JSONArray() : messages;
            for (int i = 0; i < raw.length(); i++) {
                final JSONObject message = raw.getJSONObject(i);
                roles.add(message.getString("role"));
                contents.add(message.getString("content"));
            }
        } catch (JSONException error) {
            call.reject("Mensajes mal formados: " + error.getMessage());
            return;
        }

        if (roles.isEmpty()) {
            call.reject("No hay nada que responder");
            return;
        }

        final int maxTokens = call.getInt("maxTokens", 512);
        final float temperature = call.getDouble("temperature", 0.7d).floatValue();

        worker.execute(() -> {
            final StringBuilder answer = new StringBuilder();
            try {
                synchronized (lock) {
                    if (handle == 0) {
                        call.reject("El modelo todavía no está cargado");
                        return;
                    }
                    activeRequestId = requestId;
                    LlamaBridge.nativeGenerate(
                        handle,
                        roles.toArray(new String[0]),
                        contents.toArray(new String[0]),
                        maxTokens,
                        temperature,
                        text -> {
                            answer.append(text);
                            final JSObject event = new JSObject();
                            event.put("requestId", requestId);
                            event.put("token", text);
                            notifyListeners("token", event);
                        }
                    );
                }
                final JSObject result = new JSObject();
                result.put("text", answer.toString());
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject(message(error));
            } finally {
                activeRequestId = null;
            }
        });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        final String requestId = call.getString("requestId");
        // Solo se detiene si la petición en curso es la que se quiere cortar:
        // una cancelación que llega tarde no debe matar la siguiente.
        if (requestId != null && requestId.equals(activeRequestId)) {
            stopCurrent();
        }
        call.resolve();
    }

    @PluginMethod
    public void unload(PluginCall call) {
        stopCurrent();
        worker.execute(() -> {
            synchronized (lock) {
                releaseHandle();
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        stopCurrent();
        worker.shutdown();
        try {
            // Liberar el modelo mientras el hilo de trabajo sigue generando
            // dejaría punteros colgando: primero se espera a que pare.
            worker.awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
        synchronized (lock) {
            releaseHandle();
        }
    }

    /** Pide parar la generación en curso, si el handle sigue vivo. */
    private void stopCurrent() {
        synchronized (stopLock) {
            if (handle != 0) LlamaBridge.nativeStop(handle);
        }
    }

    /** Invalida el handle antes de liberarlo, para que nadie lo use ya muerto. */
    private void releaseHandle() {
        final long doomed;
        synchronized (stopLock) {
            doomed = handle;
            handle = 0;
        }
        if (doomed != 0) LlamaBridge.nativeFree(doomed);
    }

    /** Capacitor devuelve las rutas como file:///…; el nativo quiere una ruta a secas. */
    private static String stripFileScheme(String path) {
        return path.startsWith("file://") ? path.substring("file://".length()) : path;
    }

    private static String message(RuntimeException error) {
        final String text = error.getMessage();
        return text == null || text.isEmpty() ? "Error en el motor nativo" : text;
    }
}
