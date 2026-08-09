import Capacitor
import Foundation

/// Plugin LlamaNative para iOS.
///
/// Contrato idéntico al de Android (src/lib/engine/native.ts): load, generate
/// con eventos `token`, abort, unload.
///
/// Igual que en Android, las generaciones se serializan en una cola propia: el
/// contexto de llama.cpp no admite decodificaciones concurrentes.
@objc(LlamaNativePlugin)
public class LlamaNativePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "LlamaNativePlugin"
    public let jsName = "LlamaNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abort", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unload", returnType: CAPPluginReturnPromise)
    ]

    /// Serializa carga, generación y liberación.
    private let queue = DispatchQueue(label: "es.cratias.kratcom.llama", qos: .userInitiated)

    /// Protege el acceso a `session` desde `abort`, que llega en otro hilo
    /// mientras la cola sigue generando. Solo se sostiene lo que tarda una
    /// llamada a `stop`, que es un `store` atómico.
    private let sessionLock = NSLock()
    private var _session: LlamaSession?

    private var session: LlamaSession? {
        get { sessionLock.lock(); defer { sessionLock.unlock() }; return _session }
        set { sessionLock.lock(); _session = newValue; sessionLock.unlock() }
    }

    private let requestLock = NSLock()
    private var _activeRequestId: String?

    private var activeRequestId: String? {
        get { requestLock.lock(); defer { requestLock.unlock() }; return _activeRequestId }
        set { requestLock.lock(); _activeRequestId = newValue; requestLock.unlock() }
    }

    @objc func load(_ call: CAPPluginCall) {
        guard let modelPath = call.getString("modelPath"), !modelPath.isEmpty else {
            call.reject("Falta la ruta del modelo")
            return
        }
        let contextSize = Int32(call.getInt("contextSize") ?? 4096)
        let threads = Int32(call.getInt("threads") ?? 4)
        let gpuLayers = Int32(call.getInt("gpuLayers") ?? 0)

        queue.async { [weak self] in
            guard let self else { return }
            do {
                // Capacitor entrega las rutas como file:///…; el nativo quiere
                // una ruta del sistema de ficheros a secas.
                let path = modelPath.hasPrefix("file://")
                    ? (URL(string: modelPath)?.path ?? modelPath)
                    : modelPath
                self.session = try LlamaSession(
                    modelPath: path,
                    contextSize: contextSize,
                    threads: threads,
                    gpuLayers: gpuLayers
                )
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let requestId = call.getString("requestId") else {
            call.reject("Falta requestId")
            return
        }
        guard let rawMessages = call.getArray("messages") as? [[String: Any]] else {
            call.reject("Mensajes mal formados")
            return
        }

        let messages: [(role: String, content: String)] = rawMessages.compactMap { item in
            guard let role = item["role"] as? String,
                  let content = item["content"] as? String else { return nil }
            return (role, content)
        }
        guard !messages.isEmpty else {
            call.reject("No hay nada que responder")
            return
        }

        let maxTokens = Int32(call.getInt("maxTokens") ?? 512)
        let temperature = Float(call.getDouble("temperature") ?? 0.7)

        queue.async { [weak self] in
            guard let self else { return }
            guard let session = self.session else {
                call.reject("El modelo todavía no está cargado")
                return
            }

            self.activeRequestId = requestId
            defer { self.activeRequestId = nil }

            do {
                let text = try session.generate(
                    messages: messages,
                    maxTokens: maxTokens,
                    temperature: temperature
                ) { [weak self] piece in
                    self?.notifyListeners("token", data: ["requestId": requestId, "token": piece])
                }
                call.resolve(["text": text])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func abort(_ call: CAPPluginCall) {
        // Solo se corta si la petición en curso es la que se quiere cancelar:
        // una cancelación que llega tarde no debe matar la siguiente.
        if let requestId = call.getString("requestId"), requestId == activeRequestId {
            session?.stop()
        }
        call.resolve()
    }

    @objc func unload(_ call: CAPPluginCall) {
        session?.stop()
        queue.async { [weak self] in
            self?.session = nil
            call.resolve()
        }
    }
}
