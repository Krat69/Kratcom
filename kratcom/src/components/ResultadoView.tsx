import type { Caso, ResultadoCalculo } from '../types/baremo';

interface ResultadoViewProps {
  caso: Caso;
  resultado: ResultadoCalculo;
  onNuevoCaso: () => void;
  onGuardar: () => void;
  onExportar: () => void;
}

export function ResultadoView({ caso, resultado, onNuevoCaso, onGuardar, onExportar }: ResultadoViewProps) {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Resultado de Indemnización</h2>
          <div className="flex gap-2">
            <button
              onClick={onExportar}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm"
            >
              Exportar PDF
            </button>
            <button
              onClick={onGuardar}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
            >
              Guardar Caso
            </button>
            <button
              onClick={onNuevoCaso}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
            >
              Nuevo Caso
            </button>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">DATOS DEL CLIENTE</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Nombre:</span>
              <p className="text-white font-medium">{caso.cliente.nombre} {caso.cliente.apellidos}</p>
            </div>
            <div>
              <span className="text-gray-400">DNI:</span>
              <p className="text-white font-medium">{caso.cliente.dni}</p>
            </div>
            <div>
              <span className="text-gray-400">Edad:</span>
              <p className="text-white font-medium">{caso.cliente.edad} años</p>
            </div>
            <div>
              <span className="text-gray-400">Tipo:</span>
              <p className="text-white font-medium capitalize">{caso.tipoAccidente}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado Total */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 mb-6 text-center">
        <h3 className="text-white text-lg mb-2">INDEMNIZACIÓN TOTAL</h3>
        <p className="text-5xl font-bold text-white">
          {formatCurrency(resultado.total)}
        </p>
        <p className="text-blue-200 text-sm mt-2">Baremo de Tráfico 2024</p>
      </div>

      {/* Resumen */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
          Resumen
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resultado.indemnizacionBasica > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
              <span className="text-gray-300">Indemnización Básica</span>
              <span className="text-white font-semibold">{formatCurrency(resultado.indemnizacionBasica)}</span>
            </div>
          )}

          {resultado.perjuiciosParticulares > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
              <span className="text-gray-300">Perjuicios Particulares</span>
              <span className="text-white font-semibold">{formatCurrency(resultado.perjuiciosParticulares)}</span>
            </div>
          )}

          {resultado.lesionesTemporales > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
              <span className="text-gray-300">Lesiones Temporales</span>
              <span className="text-white font-semibold">{formatCurrency(resultado.lesionesTemporales)}</span>
            </div>
          )}

          {resultado.secuelas > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
              <span className="text-gray-300">Secuelas Permanentes</span>
              <span className="text-white font-semibold">{formatCurrency(resultado.secuelas)}</span>
            </div>
          )}

          {resultado.perjuicioMoral > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
              <span className="text-gray-300">Perjuicio Moral</span>
              <span className="text-white font-semibold">{formatCurrency(resultado.perjuicioMoral)}</span>
            </div>
          )}

          {resultado.factorCorrector > 0 && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
              <span className="text-gray-300">Factor Corrector (Edad)</span>
              <span className="text-white font-semibold">{formatCurrency(resultado.factorCorrector)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Desglose Detallado */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
          Desglose Detallado
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 font-medium py-2 px-3">Concepto</th>
                <th className="text-left text-gray-400 font-medium py-2 px-3">Descripción</th>
                <th className="text-right text-gray-400 font-medium py-2 px-3">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {resultado.desglose.map((item, index) => (
                <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="text-white py-3 px-3 font-medium">{item.concepto}</td>
                  <td className="text-gray-400 py-3 px-3">{item.descripcion}</td>
                  <td className="text-white py-3 px-3 text-right font-semibold">
                    {formatCurrency(item.cantidad)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-700">
                <td colSpan={2} className="text-white py-3 px-3 font-bold text-lg">
                  TOTAL
                </td>
                <td className="text-white py-3 px-3 text-right font-bold text-lg">
                  {formatCurrency(resultado.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Información legal */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mt-6">
        <h4 className="text-sm font-semibold text-yellow-300 mb-2">Información Legal</h4>
        <ul className="text-xs text-yellow-200 space-y-1">
          <li>• Este cálculo es orientativo y se basa en la Ley 35/2015 sobre valoración de daños y perjuicios</li>
          <li>• Las cantidades están actualizadas según el Baremo de Tráfico 2024</li>
          <li>• No incluye gastos de asistencia sanitaria futura, ni lucros cesantes específicos</li>
          <li>• Se recomienda revisión legal profesional antes de presentar reclamación</li>
          <li>• Los montos pueden variar según las circunstancias específicas del caso</li>
        </ul>
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
