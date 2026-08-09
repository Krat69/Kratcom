// Contrato único de inferencia local. Toda la app habla con esta interfaz y
// nunca con una implementación concreta, de modo que el motor WASM (que
// funciona en cualquier plataforma) y el motor nativo (llama.cpp compilado
// para Android/iOS/Linux) son intercambiables sin tocar la UI.
//
// Regla de la app: no existe ningún motor remoto. Nada de lo que el usuario
// escribe sale del dispositivo bajo ninguna circunstancia.

export type EngineKind = 'wasm' | 'native';

export interface EngineMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  /** Tope de tokens generados. */
  maxTokens?: number;
  temperature?: number;
  /** Texto acumulado hasta el momento, para pintar la respuesta según llega. */
  onToken?: (accumulated: string) => void;
  signal?: AbortSignal;
}

export interface LoadProgress {
  /** 0..1, o null si el tamaño total aún no se conoce. */
  ratio: number | null;
  loadedBytes: number;
  totalBytes: number;
  phase: 'descargando' | 'cargando' | 'listo';
}

export interface LocalEngine {
  readonly kind: EngineKind;

  /** ¿Puede ejecutarse esta implementación en la plataforma actual? */
  isAvailable(): Promise<boolean>;

  /** Carga el modelo (descargándolo la primera vez). Idempotente. */
  load(model: ModelSpec, opts: EngineRuntimeOptions, onProgress?: (p: LoadProgress) => void): Promise<void>;

  isLoaded(modelId?: string): boolean;

  generate(messages: EngineMessage[], opts?: GenerateOptions): Promise<string>;

  /** Aproximación al número de tokens; se usa para el presupuesto de contexto. */
  countTokens(text: string): Promise<number>;

  unload(): Promise<void>;
}

export interface EngineRuntimeOptions {
  /** Hilos de CPU. undefined = decide la implementación. */
  threads?: number;
  /** Fuerza CPU aunque haya GPU disponible (WebGPU / Metal). */
  cpuOnly: boolean;
  /** Ventana de contexto en tokens. */
  contextSize: number;
}

export interface ModelSpec {
  id: string;
  label: string;
  /** Repositorio de Hugging Face, p. ej. 'bartowski/Llama-3.2-1B-Instruct-GGUF'. */
  repo: string;
  /** Fichero GGUF dentro del repo. */
  file: string;
  /** Tamaño aproximado en bytes, para avisar antes de descargar. */
  approxBytes: number;
  /** RAM libre recomendada para cargarlo sin que el sistema mate el proceso. */
  minDeviceRamMb: number;
  contextSize: number;
  note: string;
}
