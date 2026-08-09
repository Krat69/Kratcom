import { DEFAULT_MODEL_ID } from '@/lib/engine/catalog';

// Ajustes del motor local. Viven en localStorage de este dispositivo; no hay
// claves de API que guardar porque no hay ningún servicio remoto.

const CONFIG_KEY = 'kratcom-engine-config';
const LEGACY_KEYS = ['kratcom-ai-config', 'kratcom-task-endpoint'];

export type MemoryMode = 'auto' | 'confirmar' | 'off';

export interface EngineConfig {
  modelId: string;
  /** 0 = automático (mitad de los núcleos, tope 4). */
  threads: number;
  cpuOnly: boolean;
  /** Consolidación de la memoria tras cada turno. */
  memoryMode: MemoryMode;
  /** Exigir wifi antes de descargar el modelo. */
  wifiOnlyDownload: boolean;
}

const DEFAULTS: EngineConfig = {
  modelId: DEFAULT_MODEL_ID,
  threads: 0,
  cpuOnly: false,
  memoryMode: 'auto',
  wifiOnlyDownload: true,
};

export function getEngineConfig(): EngineConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return { ...DEFAULTS, ...(JSON.parse(stored) as Partial<EngineConfig>) };
  } catch {
    // configuración corrupta: se vuelve a los valores por defecto
  }
  return { ...DEFAULTS };
}

export function setEngineConfig(config: EngineConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// Las versiones anteriores guardaban claves de Gemini y de Anthropic, además
// de un endpoint de webhook. Ya no existe ninguna ruta de salida a internet,
// así que esos restos se borran en el primer arranque: dejar credenciales
// muertas en el dispositivo no aporta nada y es un riesgo gratuito.
export function purgeLegacyCloudConfig(): void {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // almacenamiento no disponible: nada que purgar
    }
  }
}

/** Hilos efectivos: la mitad de los núcleos, con tope 4 para no ahogar el móvil. */
export function resolveThreads(configured: number): number {
  if (configured > 0) return configured;
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
  return Math.max(1, Math.min(4, Math.floor(cores / 2)));
}
