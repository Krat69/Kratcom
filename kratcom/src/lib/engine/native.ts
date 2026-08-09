import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  EngineMessage,
  EngineRuntimeOptions,
  GenerateOptions,
  LoadProgress,
  LocalEngine,
  ModelSpec,
} from '@/lib/engine/types';
import { estimateTokens } from '@/lib/engine/wasm';
import { ensureModelFile } from '@/lib/engine/download';

// Motor nativo: llama.cpp compilado para la plataforma. Multiplica por 3-5 la
// velocidad del WASM, así que es el camino normal en un dispositivo real.
//
// Hay dos puentes distintos detrás de la misma interfaz:
//   · Android / iOS  -> plugin de Capacitor `LlamaNative`
//   · Linux          -> proceso principal de Electron (node-llama-cpp) vía preload
//
// Si ninguno está presente —navegador, o build sin el plugin compilado—
// `isAvailable()` devuelve false y la app cae al motor WASM sin enterarse
// nadie. Por eso esta clase nunca lanza en la fase de detección.

interface LlamaNativePlugin {
  load(options: {
    modelPath: string;
    contextSize: number;
    threads: number;
    gpuLayers: number;
  }): Promise<void>;
  generate(options: {
    requestId: string;
    messages: EngineMessage[];
    maxTokens: number;
    temperature: number;
  }): Promise<{ text: string }>;
  abort(options: { requestId: string }): Promise<void>;
  unload(): Promise<void>;
  addListener(
    event: 'token',
    handler: (data: { requestId: string; token: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const LlamaNative = registerPlugin<LlamaNativePlugin>('LlamaNative');

/** Puente que expone el preload de Electron; ausente fuera del escritorio. */
interface ElectronLlamaBridge {
  /** false si node-llama-cpp no está instalado: entonces se usa el motor WASM. */
  available(): Promise<boolean>;
  ensureModel(
    spec: { id: string; repo: string; file: string; approxBytes: number },
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<string>;
  load(options: {
    modelPath: string;
    contextSize: number;
    threads: number;
    gpuLayers: number;
  }): Promise<void>;
  generate(
    options: { requestId: string; messages: EngineMessage[]; maxTokens: number; temperature: number },
    onToken: (token: string) => void
  ): Promise<string>;
  abort(requestId: string): Promise<void>;
  unload(): Promise<void>;
}

function electronBridge(): ElectronLlamaBridge | null {
  const bridge = (globalThis as { kratcom?: { llama?: ElectronLlamaBridge } }).kratcom?.llama;
  return bridge ?? null;
}

let requestCounter = 0;

export class NativeEngine implements LocalEngine {
  readonly kind = 'native' as const;

  private loadedModelId: string | null = null;
  private tokenListener: { remove: () => Promise<void> } | null = null;
  private tokenHandlers = new Map<string, (token: string) => void>();

  async isAvailable(): Promise<boolean> {
    const bridge = electronBridge();
    if (bridge) {
      // En el escritorio el puente existe siempre, pero node-llama-cpp es una
      // dependencia opcional: hay que preguntar si de verdad está.
      return bridge.available().catch(() => false);
    }
    if (!Capacitor.isNativePlatform()) return false;
    return Capacitor.isPluginAvailable('LlamaNative');
  }

  isLoaded(modelId?: string): boolean {
    if (!this.loadedModelId) return false;
    return modelId ? this.loadedModelId === modelId : true;
  }

  async load(
    model: ModelSpec,
    opts: EngineRuntimeOptions,
    onProgress?: (p: LoadProgress) => void
  ): Promise<void> {
    if (this.loadedModelId === model.id) return;

    // A diferencia del WASM, el motor nativo carga desde una ruta del disco.
    // En móvil la descarga la gestionan los plugins de Capacitor; en el
    // escritorio, el proceso principal de Electron. En ambos casos el código
    // de inferencia solo recibe una ruta ya lista.
    const bridge = electronBridge();
    const modelPath = bridge
      ? await bridge.ensureModel(model, ({ loaded, total }) =>
          onProgress?.({
            ratio: total > 0 ? loaded / total : null,
            loadedBytes: loaded,
            totalBytes: total,
            phase: 'descargando',
          })
        )
      : await ensureModelFile(model, onProgress);

    onProgress?.({ ratio: null, loadedBytes: 0, totalBytes: 0, phase: 'cargando' });

    const params = {
      modelPath,
      contextSize: opts.contextSize,
      threads: opts.threads ?? 4,
      gpuLayers: opts.cpuOnly ? 0 : 999,
    };

    if (bridge) {
      await bridge.load(params);
    } else {
      await LlamaNative.load(params);
      await this.ensureTokenListener();
    }

    this.loadedModelId = model.id;
    onProgress?.({ ratio: 1, loadedBytes: 0, totalBytes: 0, phase: 'listo' });
  }

  private async ensureTokenListener(): Promise<void> {
    if (this.tokenListener) return;
    // Un único listener para todas las peticiones: el plugin etiqueta cada
    // token con su requestId, de modo que el chat y la consolidación de
    // memoria pueden generar en paralelo sin mezclar el texto.
    this.tokenListener = await LlamaNative.addListener('token', ({ requestId, token }) => {
      this.tokenHandlers.get(requestId)?.(token);
    });
  }

  async generate(messages: EngineMessage[], opts: GenerateOptions = {}): Promise<string> {
    if (!this.loadedModelId) throw new Error('El modelo todavía no está cargado');

    const requestId = `req-${++requestCounter}`;
    const params = {
      requestId,
      messages,
      maxTokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.7,
    };

    let accumulated = '';
    const onToken = (token: string) => {
      accumulated += token;
      opts.onToken?.(accumulated);
    };

    const bridge = electronBridge();
    const abort = () => {
      void (bridge ? bridge.abort(requestId) : LlamaNative.abort({ requestId }));
    };
    opts.signal?.addEventListener('abort', abort, { once: true });

    try {
      if (bridge) {
        return await bridge.generate(params, onToken);
      }
      this.tokenHandlers.set(requestId, onToken);
      const { text } = await LlamaNative.generate(params);
      return text || accumulated;
    } finally {
      this.tokenHandlers.delete(requestId);
      opts.signal?.removeEventListener('abort', abort);
    }
  }

  async countTokens(text: string): Promise<number> {
    return estimateTokens(text);
  }

  async unload(): Promise<void> {
    this.loadedModelId = null;
    this.tokenHandlers.clear();
    try {
      const bridge = electronBridge();
      await (bridge ? bridge.unload() : LlamaNative.unload());
    } catch {
      // descargar un motor que ya no existe no es un fallo
    }
    await this.tokenListener?.remove();
    this.tokenListener = null;
  }
}
