import { useState } from 'react';
import { AI_MODELS, getAIConfig, setAIConfig } from '@/lib/ai';
import { getEndpoint, setEndpoint } from '@/lib/dispatch';
import { CloseIcon, ShieldIcon } from '@/components/Icons';

interface AISettingsProps {
  onClose: () => void;
}

export function AISettings({ onClose }: AISettingsProps) {
  const [config, setConfig] = useState(getAIConfig);
  const [endpointDraft, setEndpointDraft] = useState(getEndpoint);

  const handleSave = () => {
    setAIConfig(config);
    setEndpoint(endpointDraft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Ajustes de la IA</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white" aria-label="Cerrar">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Clave de API de Anthropic</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={e => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="sk-ant-..."
            autoComplete="off"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Se guarda únicamente en este dispositivo. Puedes crearla en console.anthropic.com.
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Modelo</label>
          <select
            value={config.model}
            onChange={e => setConfig({ ...config, model: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {AI_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Webhook alternativo para tareas (opcional)
          </label>
          <input
            type="url"
            value={endpointDraft}
            onChange={e => setEndpointDraft(e.target.value)}
            placeholder="https://... (vacío = usar la IA o compartir)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-start bg-green-900/40 border border-green-700 rounded-lg p-3 text-xs text-green-200">
          <ShieldIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
          <p>
            La IA solo recibe texto seudonimizado: los datos personales se sustituyen por tokens en
            tu dispositivo y los valores reales quedan cifrados aquí.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
