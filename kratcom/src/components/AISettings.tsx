import { useEffect, useState } from 'react';
import { MODELS, formatBytes } from '@/lib/engine/catalog';
import {
  type EngineConfig,
  type MemoryMode,
  getEngineConfig,
  resolveThreads,
  setEngineConfig,
} from '@/lib/engine/config';
import { getEngineKind, unloadEngine } from '@/lib/engine';
import { memoryFolderUri } from '@/lib/memory/store';
import { EngineStatusBanner } from '@/components/EngineStatus';
import { ChipIcon, CloseIcon, ShieldIcon } from '@/components/Icons';

interface AISettingsProps {
  onClose: () => void;
}

const MEMORY_MODES: { value: MemoryMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automática', hint: 'La app anota sola lo que parece duradero' },
  { value: 'confirmar', label: 'Con confirmación', hint: 'Propone los datos y los apruebas tú' },
  { value: 'off', label: 'Desactivada', hint: 'Solo el diario; memoria.md no cambia' },
];

export function AISettings({ onClose }: AISettingsProps) {
  const [config, setConfig] = useState<EngineConfig>(getEngineConfig);
  const [engineKind, setEngineKind] = useState<string>('…');
  const [folder, setFolder] = useState('');
  const initialModel = useState(() => getEngineConfig().modelId)[0];

  useEffect(() => {
    void getEngineKind().then(kind =>
      setEngineKind(kind === 'native' ? 'llama.cpp nativo' : 'WebAssembly')
    );
    void memoryFolderUri().then(setFolder);
  }, []);

  const handleSave = async () => {
    setEngineConfig(config);
    // Cambiar de modelo o de modo de ejecución obliga a rehacer la carga: si
    // no se descarga el motor viejo, se quedaría el anterior en memoria.
    if (config.modelId !== initialModel) {
      await unloadEngine();
    }
    onClose();
  };

  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">IA local</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white" aria-label="Cerrar">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <EngineStatusBanner />

        <div>
          <label className="block text-sm text-gray-300 mb-2">Modelo</label>
          <div className="space-y-2">
            {MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => setConfig({ ...config, modelId: model.id })}
                className={`w-full px-3 py-2 rounded-lg border text-left ${
                  config.modelId === model.id
                    ? 'bg-blue-600/30 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className="flex items-center justify-between text-sm font-medium">
                  {model.label}
                  <span className="text-xs opacity-75">{formatBytes(model.approxBytes)}</span>
                </span>
                <span className="block text-xs opacity-75">{model.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Hilos de CPU: {config.threads === 0 ? `automático (${resolveThreads(0)})` : config.threads}
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(2, cores)}
            value={config.threads}
            onChange={e => setConfig({ ...config, threads: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <p className="text-xs text-gray-500">
            0 = automático. Más hilos van más rápido pero calientan el teléfono y gastan batería.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={config.cpuOnly}
            onChange={e => setConfig({ ...config, cpuOnly: e.target.checked })}
            className="mt-1 accent-blue-500"
          />
          <span>
            Solo CPU
            <span className="block text-xs text-gray-500">
              Desactiva la GPU. Va más lento, pero resuelve los cuelgues en dispositivos con
              controladores gráficos problemáticos.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={config.wifiOnlyDownload}
            onChange={e => setConfig({ ...config, wifiOnlyDownload: e.target.checked })}
            className="mt-1 accent-blue-500"
          />
          <span>
            Avisar antes de descargar sin wifi
            <span className="block text-xs text-gray-500">
              El modelo pesa cerca de 1 GB; conviene no gastarlo de los datos móviles.
            </span>
          </span>
        </label>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Memoria persistente</label>
          <div className="space-y-2">
            {MEMORY_MODES.map(mode => (
              <button
                key={mode.value}
                onClick={() => setConfig({ ...config, memoryMode: mode.value })}
                className={`w-full px-3 py-2 rounded-lg border text-left ${
                  config.memoryMode === mode.value
                    ? 'bg-blue-600/30 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className="block text-sm font-medium">{mode.label}</span>
                <span className="block text-xs opacity-75">{mode.hint}</span>
              </button>
            ))}
          </div>
          {folder && (
            <p className="text-xs text-gray-500 mt-2 break-all">
              Los ficheros .md se guardan en <span className="text-gray-400">{folder}</span>
            </p>
          )}
        </div>

        <p className="text-xs text-gray-500 flex items-center">
          <ChipIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
          Motor en uso: {engineKind}
        </p>

        <div className="flex items-start bg-green-900/40 border border-green-700 rounded-lg p-3 text-xs text-green-200">
          <ShieldIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
          <p>
            KratCom no tiene servidores, ni cuentas, ni claves de API. La única conexión que hace es
            la descarga del modelo; a partir de ahí funciona en modo avión.
          </p>
        </div>

        <button
          onClick={() => void handleSave()}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
