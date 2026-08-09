import { useState } from 'react';
import {
  AIProvider,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  LOCAL_MODELS,
  getAIConfig,
  isLocalAISupported,
  setAIConfig,
} from '@/lib/ai';
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

  const providerButton = (provider: AIProvider, label: string, sub: string) => (
    <button
      onClick={() => setConfig({ ...config, provider })}
      className={`flex-1 px-3 py-2 rounded-lg border text-left ${
        config.provider === provider
          ? 'bg-blue-600/30 border-blue-500 text-white'
          : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
      }`}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs opacity-75">{sub}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Motor de IA</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white" aria-label="Cerrar">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {providerButton('local', 'En tu móvil (100% local)', 'Gratis · sin clave · nada sale del dispositivo')}
          <div className="flex gap-2">
            {providerButton('gemini', 'Google Gemini', 'Gratis (franja gratuita)')}
            {providerButton('anthropic', 'Claude', 'Mejor calidad · céntimos/uso')}
          </div>
        </div>

        {config.provider === 'local' ? (
          <>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Modelo local</label>
              <select
                value={config.localModel}
                onChange={e => setConfig({ ...config, localModel: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LOCAL_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            {!isLocalAISupported() && (
              <p className="text-xs text-amber-300 bg-amber-900/30 border border-amber-800 rounded-lg p-2">
                ⚠️ Este navegador no soporta WebGPU, necesario para la IA local. En iPhone:
                iOS 26 o superior. En Android: Chrome actualizado. Mientras tanto puedes usar
                Gemini (gratis).
              </p>
            )}
            <p className="text-xs text-gray-500">
              La IA se ejecuta íntegramente en tu dispositivo: sin clave, sin coste y sin que
              salga ningún dato — ni siquiera anonimizado. El primer uso descarga el modelo
              (recomendable con wifi); después queda guardado. Es un modelo pequeño: útil para
              resúmenes, borradores y preguntas directas; para trabajo complejo, Gemini o Claude
              dan mejor resultado.
            </p>
          </>
        ) : config.provider === 'gemini' ? (
          <>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Clave gratuita de Gemini</label>
              <input
                type="password"
                value={config.geminiKey}
                onChange={e => setConfig({ ...config, geminiKey: e.target.value })}
                placeholder="AIza..."
                autoComplete="off"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se crea gratis y sin tarjeta en{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-gray-400"
                >
                  aistudio.google.com/apikey
                </a>{' '}
                (botón «Create API key»). Se guarda solo en este dispositivo.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Modelo</label>
              <select
                value={config.geminiModel}
                onChange={e => setConfig({ ...config, geminiModel: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GEMINI_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Clave de API de Anthropic</label>
              <input
                type="password"
                value={config.anthropicKey}
                onChange={e => setConfig({ ...config, anthropicKey: e.target.value })}
                placeholder="sk-ant-..."
                autoComplete="off"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se crea en console.anthropic.com (requiere cargar saldo; se paga por uso). Se guarda
                solo en este dispositivo.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Modelo</label>
              <select
                value={config.anthropicModel}
                onChange={e => setConfig({ ...config, anthropicModel: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ANTHROPIC_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Webhook alternativo para tareas (opcional)
          </label>
          <input
            type="url"
            value={endpointDraft}
            onChange={e => setEndpointDraft(e.target.value)}
            placeholder="https://... (normalmente vacío)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-start bg-green-900/40 border border-green-700 rounded-lg p-3 text-xs text-green-200">
          <ShieldIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
          <p>
            Con el motor local, nada sale del dispositivo — ni siquiera texto anonimizado. Con
            Gemini o Claude, la IA solo recibe texto seudonimizado: los datos personales se
            sustituyen por tokens en tu dispositivo y los valores reales quedan cifrados aquí.
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
