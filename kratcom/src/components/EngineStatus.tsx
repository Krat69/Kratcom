import { useEffect, useState } from 'react';
import { type EngineState, subscribeEngine } from '@/lib/engine';
import { findModel, formatBytes } from '@/lib/engine/catalog';
import { getEngineConfig } from '@/lib/engine/config';
import { ChipIcon } from '@/components/Icons';

export function useEngineState(): EngineState {
  const [state, setState] = useState<EngineState>({ status: 'idle' });
  useEffect(() => subscribeEngine(setState), []);
  return state;
}

/**
 * Franja de estado del motor. La descarga del modelo es de ~1 GB y tarda: si
 * no se enseña el progreso, el usuario cree que la app se ha colgado.
 */
export function EngineStatusBanner({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const state = useEngineState();

  if (state.status === 'idle' || state.status === 'ready') return null;

  if (state.status === 'error') {
    return (
      <div className="mx-4 mb-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-100">
        <p className="font-medium">No se pudo preparar la IA local</p>
        <p className="mt-1">{state.message}</p>
        {onOpenSettings && (
          <button onClick={onOpenSettings} className="mt-2 underline font-medium">
            Abrir ajustes del modelo
          </button>
        )}
      </div>
    );
  }

  const model = findModel(getEngineConfig().modelId);
  const { progress } = state;
  const percent = progress.ratio === null ? null : Math.round(progress.ratio * 100);

  return (
    <div className="mx-4 mb-2 p-3 bg-blue-900/30 border border-blue-800 rounded-lg text-xs text-blue-100 space-y-2">
      <p className="flex items-center font-medium">
        <ChipIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
        {progress.phase === 'descargando'
          ? `Descargando ${model.label} (${formatBytes(model.approxBytes)})…`
          : `Cargando ${model.label} en memoria…`}
      </p>
      <div className="h-1.5 bg-blue-950 rounded-full overflow-hidden">
        <div
          className={`h-full bg-blue-400 transition-[width] duration-300 ${percent === null ? 'animate-pulse w-1/3' : ''}`}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p className="text-blue-300">
        {percent === null ? 'Preparando…' : `${percent}%`}
        {progress.phase === 'descargando' &&
          ' · Solo la primera vez. Después funciona sin conexión, incluso en modo avión.'}
      </p>
    </div>
  );
}
