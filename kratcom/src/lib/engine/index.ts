import { findModel } from '@/lib/engine/catalog';
import { getEngineConfig, resolveThreads } from '@/lib/engine/config';
import { NativeEngine } from '@/lib/engine/native';
import { WasmEngine } from '@/lib/engine/wasm';
import type {
  EngineKind,
  EngineMessage,
  GenerateOptions,
  LoadProgress,
  LocalEngine,
} from '@/lib/engine/types';

// Fachada única de inferencia. La UI llama a `generate()` y no sabe —ni
// necesita saber— si detrás hay llama.cpp nativo o WebAssembly.

export type EngineState =
  | { status: 'idle' }
  | { status: 'loading'; progress: LoadProgress }
  | { status: 'ready'; kind: EngineKind; modelId: string }
  | { status: 'error'; message: string };

let engine: LocalEngine | null = null;
let state: EngineState = { status: 'idle' };
const listeners = new Set<(s: EngineState) => void>();

function setState(next: EngineState): void {
  state = next;
  for (const listener of listeners) listener(next);
}

export function getEngineState(): EngineState {
  return state;
}

export function subscribeEngine(listener: (s: EngineState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

/**
 * Elige implementación una sola vez por sesión: nativa si la plataforma la
 * trae compilada, WASM en cualquier otro caso.
 */
async function pickEngine(): Promise<LocalEngine> {
  if (engine) return engine;
  const native = new NativeEngine();
  engine = (await native.isAvailable()) ? native : new WasmEngine();
  return engine;
}

export async function getEngineKind(): Promise<EngineKind> {
  return (await pickEngine()).kind;
}

/**
 * Garantiza que el modelo configurado está cargado y listo para generar.
 * Es idempotente y seguro de llamar en cada turno.
 */
export async function ensureEngineReady(): Promise<LocalEngine> {
  const config = getEngineConfig();
  const model = findModel(config.modelId);
  const impl = await pickEngine();

  if (impl.isLoaded(model.id)) {
    if (state.status !== 'ready') setState({ status: 'ready', kind: impl.kind, modelId: model.id });
    return impl;
  }

  setState({
    status: 'loading',
    progress: { ratio: null, loadedBytes: 0, totalBytes: model.approxBytes, phase: 'descargando' },
  });

  try {
    await impl.load(
      model,
      {
        threads: resolveThreads(config.threads),
        cpuOnly: config.cpuOnly,
        contextSize: model.contextSize,
      },
      progress => setState({ status: 'loading', progress })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el modelo';
    setState({ status: 'error', message });
    throw new Error(message);
  }

  setState({ status: 'ready', kind: impl.kind, modelId: model.id });
  return impl;
}

export async function generate(
  messages: EngineMessage[],
  opts: GenerateOptions = {}
): Promise<string> {
  const impl = await ensureEngineReady();
  const text = await impl.generate(messages, opts);
  if (!text.trim()) {
    throw new Error('La IA devolvió una respuesta vacía. Prueba a reformular la pregunta.');
  }
  return text;
}

export async function countTokens(text: string): Promise<number> {
  const impl = await pickEngine();
  return impl.countTokens(text);
}

export async function unloadEngine(): Promise<void> {
  await engine?.unload();
  setState({ status: 'idle' });
}

export type { EngineMessage, LoadProgress } from '@/lib/engine/types';
