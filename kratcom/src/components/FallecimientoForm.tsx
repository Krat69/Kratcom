import { useState } from 'react';
import type { FallecimientoData, Familiar } from '../types/baremo';

interface FallecimientoFormProps {
  fallecimiento: FallecimientoData;
  onUpdate: (fallecimiento: FallecimientoData) => void;
  onBack: () => void;
}

export function FallecimientoForm({ fallecimiento, onUpdate, onBack }: FallecimientoFormProps) {
  const [data, setData] = useState<FallecimientoData>(fallecimiento);
  const [nuevoFamiliar, setNuevoFamiliar] = useState<Partial<Familiar>>({
    tipo: 'conyuge',
    nombre: '',
    edad: 0,
    convivencia: false,
  });

  const agregarFamiliar = () => {
    if (nuevoFamiliar.nombre && nuevoFamiliar.edad && nuevoFamiliar.tipo) {
      const familiar: Familiar = {
        id: Date.now().toString(),
        tipo: nuevoFamiliar.tipo as Familiar['tipo'],
        nombre: nuevoFamiliar.nombre,
        edad: nuevoFamiliar.edad,
        convivencia: nuevoFamiliar.convivencia || false,
      };

      setData({
        ...data,
        familiares: [...data.familiares, familiar],
      });

      // Resetear formulario
      setNuevoFamiliar({
        tipo: 'conyuge',
        nombre: '',
        edad: 0,
        convivencia: false,
      });
    }
  };

  const eliminarFamiliar = (id: string) => {
    setData({
      ...data,
      familiares: data.familiares.filter((f) => f.id !== id),
    });
  };

  const handleCircunstanciaChange = (field: keyof FallecimientoData['circunstancias'], value: boolean) => {
    setData({
      ...data,
      circunstancias: {
        ...data.circunstancias,
        [field]: value,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(data);
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-white">Detalles de Fallecimiento</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Familiares Perjudicados */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">
            Familiares Perjudicados
          </h3>

          {/* Listado de familiares */}
          {data.familiares.length > 0 && (
            <div className="mb-4 space-y-2">
              {data.familiares.map((familiar) => (
                <div
                  key={familiar.id}
                  className="flex items-center justify-between bg-gray-700 p-3 rounded-md"
                >
                  <div className="flex-1">
                    <span className="text-white font-medium">{familiar.nombre}</span>
                    <span className="text-gray-400 text-sm ml-3">
                      {getTipoFamiliarLabel(familiar.tipo)} • {familiar.edad} años
                      {familiar.convivencia && ' • Convivía'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarFamiliar(familiar.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para agregar familiar */}
          <div className="bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Agregar Familiar</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Parentesco
                </label>
                <select
                  value={nuevoFamiliar.tipo}
                  onChange={(e) => setNuevoFamiliar({ ...nuevoFamiliar, tipo: e.target.value as Familiar['tipo'] })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="conyuge">Cónyuge</option>
                  <option value="hijo">Hijo/a</option>
                  <option value="padre">Padre/Madre</option>
                  <option value="hermano">Hermano/a</option>
                  <option value="allegado">Allegado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nuevoFamiliar.nombre}
                  onChange={(e) => setNuevoFamiliar({ ...nuevoFamiliar, nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Edad
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={nuevoFamiliar.edad || ''}
                  onChange={(e) => setNuevoFamiliar({ ...nuevoFamiliar, edad: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nuevoFamiliar.convivencia}
                    onChange={(e) => setNuevoFamiliar({ ...nuevoFamiliar, convivencia: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">Convivía</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={agregarFamiliar}
              disabled={!nuevoFamiliar.nombre || !nuevoFamiliar.edad}
              className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors"
            >
              + Agregar Familiar
            </button>
          </div>
        </div>

        {/* Circunstancias Particulares */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-white border-b border-gray-700 pb-2">
            Circunstancias Particulares
          </h3>

          <div className="space-y-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.circunstancias.embarazoVictima}
                onChange={(e) => handleCircunstanciaChange('embarazoVictima', e.target.checked)}
                className="mr-3"
              />
              <div>
                <span className="text-white font-medium">Víctima embarazada</span>
                <p className="text-xs text-gray-400">La víctima estaba embarazada en el momento del accidente</p>
              </div>
            </label>

            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.circunstancias.familiaNumerosa}
                onChange={(e) => handleCircunstanciaChange('familiaNumerosa', e.target.checked)}
                className="mr-3"
              />
              <div>
                <span className="text-white font-medium">Familia numerosa</span>
                <p className="text-xs text-gray-400">La víctima tenía familia numerosa</p>
              </div>
            </label>

            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.circunstancias.hijoUnico}
                onChange={(e) => handleCircunstanciaChange('hijoUnico', e.target.checked)}
                className="mr-3"
              />
              <div>
                <span className="text-white font-medium">Hijo único</span>
                <p className="text-xs text-gray-400">La víctima era hijo único de sus padres</p>
              </div>
            </label>

            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.circunstancias.padreUnico}
                onChange={(e) => handleCircunstanciaChange('padreUnico', e.target.checked)}
                className="mr-3"
              />
              <div>
                <span className="text-white font-medium">Padre único</span>
                <p className="text-xs text-gray-400">La víctima era padre/madre único/a de sus hijos</p>
              </div>
            </label>
          </div>
        </div>

        {/* Información */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Información</h4>
          <ul className="text-xs text-blue-200 space-y-1">
            <li>• Las indemnizaciones varían según el parentesco y edad de los familiares</li>
            <li>• Se aplicarán perjuicios particulares según las circunstancias especiales</li>
            <li>• La convivencia con la víctima incrementa la indemnización</li>
            <li>• Pueden reclamar: cónyuge, hijos, padres, hermanos y allegados</li>
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
            disabled={data.familiares.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            Calcular Indemnización
          </button>
        </div>
      </form>
    </div>
  );
}

function getTipoFamiliarLabel(tipo: Familiar['tipo']): string {
  const labels: Record<Familiar['tipo'], string> = {
    conyuge: 'Cónyuge',
    hijo: 'Hijo/a',
    padre: 'Padre/Madre',
    hermano: 'Hermano/a',
    allegado: 'Allegado',
  };
  return labels[tipo];
}
