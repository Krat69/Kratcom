import type {
  EngineMessage,
  EngineRuntimeOptions,
  GenerateOptions,
  LoadProgress,
  LocalEngine,
  ModelSpec,
} from '@/lib/engine/types';

// Motor de referencia: llama.cpp compilado a WebAssembly (wllama). Corre en
// las tres plataformas sin una sola línea de código nativo, así que es a la
// vez la implementación universal y la red de seguridad cuando el motor
// nativo no está disponible.
//
// El fichero .wasm se empaqueta con la app (import ?url) en lugar de traerse
// de un CDN: así la app arranca sin red una vez instalada.
import wllamaWasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import { estimateTokens } from '@/lib/engine/tokens';

type WllamaInstance = import('@wllama/wllama').Wllama;


export class WasmEngine implements LocalEngine {
  readonly kind = 'wasm' as const;

  private wllama: WllamaInstance | null = null;
  private loadedModelId: string | null = null;
  private loading: Promise<void> | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof WebAssembly !== 'undefined';
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
    // Varias llamadas concurrentes (p. ej. el chat y la consolidación de
    // memoria arrancando a la vez) comparten una única carga.
    if (this.loading) return this.loading;

    this.loading = this.doLoad(model, opts, onProgress).finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async doLoad(
    model: ModelSpec,
    opts: EngineRuntimeOptions,
    onProgress?: (p: LoadProgress) => void
  ): Promise<void> {
    if (this.wllama && this.loadedModelId && this.loadedModelId !== model.id) {
      await this.unload();
    }

    const { Wllama } = await import('@wllama/wllama');
    const wllama =
      this.wllama ??
      new Wllama(
        { default: wllamaWasmUrl },
        {
          suppressNativeLog: true,
          // Con el modelo ya en caché la app funciona en modo avión, que es
          // justamente la promesa que le hacemos al usuario.
          allowOffline: true,
        }
      );
    this.wllama = wllama;

    try {
      await wllama.loadModelFromHF(
        { repo: model.repo, file: model.file },
        {
          n_ctx: opts.contextSize,
          n_threads: opts.threads,
          // WebGPU acelera mucho, pero el ajuste «solo CPU» debe poder
          // forzarse: en algunos móviles el driver es inestable.
          n_gpu_layers: opts.cpuOnly ? 0 : undefined,
          useCache: true,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            onProgress?.({
              ratio: total > 0 ? loaded / total : null,
              loadedBytes: loaded,
              totalBytes: total,
              phase: total > 0 && loaded >= total ? 'cargando' : 'descargando',
            });
          },
        }
      );
    } catch (err) {
      this.loadedModelId = null;
      throw new Error(describeLoadError(err));
    }

    this.loadedModelId = model.id;
    onProgress?.({ ratio: 1, loadedBytes: 0, totalBytes: 0, phase: 'listo' });
  }

  async generate(messages: EngineMessage[], opts: GenerateOptions = {}): Promise<string> {
    const wllama = this.wllama;
    if (!wllama || !this.loadedModelId) {
      throw new Error('El modelo todavía no está cargado');
    }

    let accumulated = '';
    await wllama.createChatCompletion({
      messages,
      stream: true,
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.7,
      abortSignal: opts.signal,
      onData: chunk => {
        accumulated += chunk.choices?.[0]?.delta?.content ?? '';
        opts.onToken?.(accumulated);
      },
    });

    return accumulated;
  }

  async countTokens(text: string): Promise<number> {
    return estimateTokens(text);
  }

  async unload(): Promise<void> {
    const wllama = this.wllama;
    this.wllama = null;
    this.loadedModelId = null;
    if (!wllama) return;
    try {
      await wllama.exit();
    } catch {
      // descargar un motor que ya murió no es un fallo que deba propagarse
    }
  }
}

// Los errores de wllama llegan como mensajes técnicos en inglés. Para el
// usuario importan tres casos, y solo esos tres.
function describeLoadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/quota|storage|space/i.test(message)) {
    return 'No hay espacio suficiente en el dispositivo para guardar el modelo. Libera espacio o elige un modelo más pequeño.';
  }
  if (/fetch|network|Failed to load|ERR_/i.test(message)) {
    return 'No se pudo descargar el modelo. Es la única vez que hace falta conexión: conéctate a wifi y reinténtalo.';
  }
  if (/memory|allocat|OOM/i.test(message)) {
    return 'El dispositivo se ha quedado sin memoria al cargar el modelo. Prueba con Llama 3.2 1B, que es el más ligero.';
  }
  return `No se pudo cargar el modelo: ${message}`;
}
