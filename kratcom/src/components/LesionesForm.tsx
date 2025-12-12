import { useState } from 'react';
import type { LesionesData } from '../types/baremo';
import { getGravedadSecuela } from '../data/baremo2024';

interface LesionesFormProps {
  lesiones: LesionesData;
  onUpdate: (lesiones: LesionesData) => void;
  onBack: () => void;
}

export function LesionesForm({ lesiones, onUpdate, onBack }: LesionesFormProps) {
  const [data, setData] = useState<LesionesData>(lesiones);

  const handleChange = (field: keyof LesionesData, value: number | string) => {
    const updated = { ...data, [field]: value };

    // Auto-calcular gravedad de secuela
    if (field === 'puntosSecuela' && typeof value === 'number') {
      updated.gravedadSecuela = getGravedadSecuela(value);
    }

    setData(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(data);
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-white">Detalles de Lesiones</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lesiones Temporales */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">
            Lesiones Temporales
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Días de Hospitalización
              </label>
              <input
                type="number"
                min="0"
                value={data.diasHospitalizacion || ''}
                onChange={(e) => handleChange('diasHospitalizacion', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Días que estuvo ingresado en hospital
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Días Impeditivos (Baja)
              </label>
              <input
                type="number"
                min="0"
                value={data.diasImpeditivoBaja || ''}
                onChange={(e) => handleChange('diasImpeditivoBaja', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Días que impiden totalmente las actividades habituales
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Días No Impeditivos (Baja)
              </label>
              <input
                type="number"
                min="0"
                value={data.diasNoImpeditivoBaja || ''}
                onChange={(e) => handleChange('diasNoImpeditivoBaja', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Días que no impiden pero limitan actividades
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Días Moderados (Baja)
              </label>
              <input
                type="number"
                min="0"
                value={data.diasModeradoBaja || ''}
                onChange={(e) => handleChange('diasModeradoBaja', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Días con limitaciones moderadas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Días Básicos (Baja)
              </label>
              <input
                type="number"
                min="0"
                value={data.diasBasicoBaja || ''}
                onChange={(e) => handleChange('diasBasicoBaja', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Días con limitaciones básicas
              </p>
            </div>
          </div>
        </div>

        {/* Secuelas Permanentes */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">
            Secuelas Permanentes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Puntos de Secuela
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={data.puntosSecuela || ''}
                onChange={(e) => handleChange('puntosSecuela', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                De 1 a 100 puntos según tabla de secuelas
              </p>
            </div>

            {data.puntosSecuela > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Gravedad de la Secuela
                </label>
                <div className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                  {data.gravedadSecuela === 'muy_grave' && (
                    <span className="text-red-400 font-semibold">MUY GRAVE (76-100 puntos)</span>
                  )}
                  {data.gravedadSecuela === 'grave' && (
                    <span className="text-orange-400 font-semibold">GRAVE (61-75 puntos)</span>
                  )}
                  {data.gravedadSecuela === 'moderado' && (
                    <span className="text-yellow-400 font-semibold">MODERADA (25-60 puntos)</span>
                  )}
                  {data.gravedadSecuela === 'leve' && (
                    <span className="text-green-400 font-semibold">LEVE (1-24 puntos)</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Calculada automáticamente según puntos
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Descripción de las Lesiones
            </label>
            <textarea
              rows={4}
              value={data.descripcionLesiones}
              onChange={(e) => handleChange('descripcionLesiones', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describa las lesiones sufridas, tratamientos, cirugías, etc."
            />
          </div>
        </div>

        {/* Información adicional */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Información</h4>
          <ul className="text-xs text-blue-200 space-y-1">
            <li>• Los días de baja se calculan según el tiempo transcurrido desde el accidente hasta la estabilización</li>
            <li>• Los puntos de secuela se determinan según la tabla del anexo del baremo (Ley 35/2015)</li>
            <li>• Las secuelas deben estar consolidadas y ser permanentes</li>
            <li>• Se aplicarán factores correctores según la edad del lesionado</li>
          </ul>
        </div>

        {/* Botones */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            Atrás
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Calcular Indemnización
          </button>
        </div>
      </form>
    </div>
  );
}
