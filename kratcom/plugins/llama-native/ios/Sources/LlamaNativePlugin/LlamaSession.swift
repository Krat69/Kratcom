import Foundation

/// Envoltorio Swift del núcleo de inferencia en C.
///
/// Es el equivalente de LlamaBridge.java: solo traduce tipos y gestiona la
/// vida del puntero. La lógica de llama.cpp está en shared/kratcom_llama.cpp,
/// el mismo fichero que compila Android.
final class LlamaSession {

    enum LlamaError: LocalizedError {
        case load(String)
        case generate(String)
        case notLoaded

        var errorDescription: String? {
            switch self {
            case .load(let message): return message
            case .generate(let message): return message
            case .notLoaded: return "El modelo todavía no está cargado"
            }
        }
    }

    private var session: OpaquePointer?

    init(modelPath: String, contextSize: Int32, threads: Int32, gpuLayers: Int32) throws {
        var buffer = [CChar](repeating: 0, count: 512)
        let handle = kratcom_llama_load(modelPath, contextSize, threads, gpuLayers, &buffer, 512)
        guard let handle else {
            throw LlamaError.load(String(cString: buffer))
        }
        session = OpaquePointer(handle)
    }

    deinit {
        if let session {
            kratcom_llama_free(UnsafeMutablePointer(session))
        }
    }

    /// Detiene la generación en curso. Seguro desde cualquier hilo.
    func stop() {
        guard let session else { return }
        kratcom_llama_stop(UnsafeMutablePointer(session))
    }

    func tokenCount(_ text: String) -> Int32 {
        guard let session else { return 0 }
        return kratcom_llama_token_count(UnsafeMutablePointer(session), text)
    }

    /// Devuelve el texto completo. `onToken` se invoca en el hilo llamante.
    @discardableResult
    func generate(
        messages: [(role: String, content: String)],
        maxTokens: Int32,
        temperature: Float,
        onToken: @escaping (String) -> Void
    ) throws -> String {
        guard let session else { throw LlamaError.notLoaded }

        var answer = ""
        // El closure viaja hasta C como puntero opaco; hay que mantenerlo vivo
        // durante toda la llamada, de ahí la caja por referencia.
        final class Sink {
            let handler: (String) -> Void
            var accumulated = ""
            init(_ handler: @escaping (String) -> Void) { self.handler = handler }
        }
        let sink = Sink(onToken)

        var buffer = [CChar](repeating: 0, count: 512)

        // Las cadenas C deben sobrevivir a la llamada, así que se materializan
        // antes y se conservan hasta que `generate` regresa.
        let roleBuffers = messages.map { strdup($0.role) }
        let contentBuffers = messages.map { strdup($0.content) }
        defer {
            roleBuffers.forEach { free($0) }
            contentBuffers.forEach { free($0) }
        }

        var roles = roleBuffers.map { UnsafePointer<CChar>($0) }
        var contents = contentBuffers.map { UnsafePointer<CChar>($0) }

        let result = withUnsafeMutablePointer(to: &roles) { rolesPtr in
            withUnsafeMutablePointer(to: &contents) { contentsPtr in
                rolesPtr.pointee.withUnsafeMutableBufferPointer { rolesBuf in
                    contentsPtr.pointee.withUnsafeMutableBufferPointer { contentsBuf in
                        kratcom_llama_generate(
                            UnsafeMutablePointer(session),
                            rolesBuf.baseAddress,
                            contentsBuf.baseAddress,
                            Int32(messages.count),
                            maxTokens,
                            temperature,
                            { text, userData in
                                guard let text, let userData else { return }
                                let sink = Unmanaged<Sink>.fromOpaque(userData).takeUnretainedValue()
                                let piece = String(cString: text)
                                sink.accumulated += piece
                                sink.handler(piece)
                            },
                            Unmanaged.passUnretained(sink).toOpaque(),
                            &buffer,
                            512
                        )
                    }
                }
            }
        }

        answer = sink.accumulated

        if result < 0 {
            let message = String(cString: buffer)
            throw LlamaError.generate(message.isEmpty ? "Falló la generación" : message)
        }
        // result == 1 significa que el usuario paró: no es un error, y lo ya
        // generado se devuelve tal cual.
        return answer
    }
}
