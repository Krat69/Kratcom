import { useState } from 'react';
import type { Caso, Cliente } from '../types/baremo';

interface CasoFormProps {
  onSubmit: (caso: Caso) => void;
  onCancel: () => void;
}

export function CasoForm({ onSubmit, onCancel }: CasoFormProps) {
  const [tipoAccidente, setTipoAccidente] = useState<'lesiones' | 'fallecimiento'>('lesiones');
  const [cliente, setCliente] = useState<Cliente>({
    nombre: '',
    apellidos: '',
    dni: '',
    edad: 0,
    fechaNacimiento: new Date(),
    direccion: '',
    telefono: '',
    email: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const caso: Caso = {
      id: Date.now().toString(),
      fecha: new Date(),
      cliente,
      tipoAccidente,
      notas: '',
      lesiones: tipoAccidente === 'lesiones' ? {
        diasHospitalizacion: 0,
        diasImpeditivoBaja: 0,
        diasNoImpeditivoBaja: 0,
        diasModeradoBaja: 0,
        diasBasicoBaja: 0,
        puntosSecuela: 0,
        descripcionLesiones: '',
      } : undefined,
      fallecimiento: tipoAccidente === 'fallecimiento' ? {
        familiares: [],
        circunstancias: {
          embarazoVictima: false,
          familiaNumerosa: false,
          hijoUnico: false,
          padreUnico: false,
        },
      } : undefined,
    };

    onSubmit(caso);
  };

  return (
    <div className="max-w-3xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-white">Nuevo Caso</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de accidente */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo de Accidente
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="lesiones"
                checked={tipoAccidente === 'lesiones'}
                onChange={(e) => setTipoAccidente(e.target.value as 'lesiones')}
                className="mr-2"
              />
              <span className="text-white">Lesiones</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="fallecimiento"
                checked={tipoAccidente === 'fallecimiento'}
                onChange={(e) => setTipoAccidente(e.target.value as 'fallecimiento')}
                className="mr-2"
              />
              <span className="text-white">Fallecimiento</span>
            </label>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Datos del Cliente</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                required
                value={cliente.nombre}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Apellidos
              </label>
              <input
                type="text"
                required
                value={cliente.apellidos}
                onChange={(e) => setCliente({ ...cliente, apellidos: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                DNI/NIE
              </label>
              <input
                type="text"
                required
                value={cliente.dni}
                onChange={(e) => setCliente({ ...cliente, dni: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Edad
              </label>
              <input
                type="number"
                required
                min="0"
                max="120"
                value={cliente.edad || ''}
                onChange={(e) => setCliente({ ...cliente, edad: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={cliente.telefono}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={cliente.email}
                onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={cliente.direccion}
                onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Continuar
          </button>
        </div>
      </form>
    </div>
  );
}
