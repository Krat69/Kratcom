import type { ModelSpec } from '@/lib/engine/types';

// Catálogo de modelos GGUF cuantizados Q4_K_M. Los tamaños son los reales
// devueltos por Hugging Face (content-length), no estimaciones: se usan para
// avisar antes de gastar la tarifa de datos del usuario.
//
// La descarga del modelo es la ÚNICA petición de red que hace la app. Una vez
// en el dispositivo, todo funciona en modo avión.

export const MODELS: ModelSpec[] = [
  {
    id: 'llama-3.2-1b-q4',
    label: 'Llama 3.2 1B',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    approxBytes: 807_694_464,
    minDeviceRamMb: 2048,
    contextSize: 4096,
    note: 'El más ligero y rápido. Recomendado en iPhone y móviles modestos.',
  },
  {
    id: 'qwen2.5-1.5b-q4',
    label: 'Qwen 2.5 1.5B',
    repo: 'bartowski/Qwen2.5-1.5B-Instruct-GGUF',
    file: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    approxBytes: 986_048_768,
    minDeviceRamMb: 3072,
    contextSize: 4096,
    note: 'Equilibrio entre calidad y tamaño. Buen español.',
  },
  {
    id: 'qwen2.5-3b-q4',
    label: 'Qwen 2.5 3B',
    repo: 'bartowski/Qwen2.5-3B-Instruct-GGUF',
    file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    approxBytes: 1_929_903_264,
    minDeviceRamMb: 6144,
    contextSize: 4096,
    note: 'La mejor calidad, solo para móviles potentes y ordenador.',
  },
];

export const DEFAULT_MODEL_ID = 'qwen2.5-1.5b-q4';

export function findModel(id: string): ModelSpec {
  return MODELS.find(m => m.id === id) ?? MODELS.find(m => m.id === DEFAULT_MODEL_ID)!;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} GB`;
}
