import type { Caso } from '../types/baremo';

interface CasosListProps {
  casos: Caso[];
  onSelectCaso: (caso: Caso) => void;
  onDeleteCaso: (id: string) => void;
  onNuevoCaso: () => void;
}

export function CasosList({ casos, onSelectCaso, onDeleteCaso, onNuevoCaso }: CasosListProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Casos Guardados</h2>
        <button
          onClick={onNuevoCaso}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          + Nuevo Caso
        </button>
      </div>

      {casos.length === 0 ? (
        <div className="bg-gray-800 rounded-lg shadow-lg p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg">No hay casos guardados</p>
            <p className="text-sm mt-2">Crea un nuevo caso para comenzar</p>
          </div>
          <button
            onClick={onNuevoCaso}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Crear Primer Caso
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {casos.map((caso) => (
            <div
              key={caso.id}
              className="bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {caso.cliente.nombre} {caso.cliente.apellidos}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          caso.tipoAccidente === 'fallecimiento'
                            ? 'bg-red-900/50 text-red-300'
                            : 'bg-yellow-900/50 text-yellow-300'
                        }`}
                      >
                        {caso.tipoAccidente === 'fallecimiento' ? 'Fallecimiento' : 'Lesiones'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400">DNI:</span>
                        <p className="text-white">{caso.cliente.dni}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Edad:</span>
                        <p className="text-white">{caso.cliente.edad} años</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Fecha:</span>
                        <p className="text-white">{formatDate(caso.fecha)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Indemnización:</span>
                        <p className="text-white font-semibold">
                          {caso.resultado ? formatCurrency(caso.resultado.total) : 'No calculada'}
                        </p>
                      </div>
                    </div>

                    {caso.tipoAccidente === 'lesiones' && caso.lesiones && (
                      <div className="mt-3 text-sm text-gray-400">
                        <span>
                          {caso.lesiones.puntosSecuela > 0 && `${caso.lesiones.puntosSecuela} puntos de secuela`}
                          {caso.lesiones.diasHospitalizacion > 0 && ` • ${caso.lesiones.diasHospitalizacion} días hospitalización`}
                        </span>
                      </div>
                    )}

                    {caso.tipoAccidente === 'fallecimiento' && caso.fallecimiento && (
                      <div className="mt-3 text-sm text-gray-400">
                        <span>{caso.fallecimiento.familiares.length} familiares perjudicados</span>
                      </div>
                    )}

                    {caso.notas && (
                      <div className="mt-3 text-sm text-gray-300 italic">
                        "{caso.notas}"
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => onSelectCaso(caso)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                    >
                      Ver Detalle
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Estás seguro de eliminar este caso?')) {
                          onDeleteCaso(caso.id);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estadísticas */}
      {casos.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm text-gray-400 mb-1">Total de Casos</h4>
            <p className="text-2xl font-bold text-white">{casos.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm text-gray-400 mb-1">Casos de Lesiones</h4>
            <p className="text-2xl font-bold text-white">
              {casos.filter((c) => c.tipoAccidente === 'lesiones').length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm text-gray-400 mb-1">Casos de Fallecimiento</h4>
            <p className="text-2xl font-bold text-white">
              {casos.filter((c) => c.tipoAccidente === 'fallecimiento').length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
