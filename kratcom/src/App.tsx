import { useState } from 'react';
import { CasoForm } from './components/CasoForm';
import { LesionesForm } from './components/LesionesForm';
import { FallecimientoForm } from './components/FallecimientoForm';
import { ResultadoView } from './components/ResultadoView';
import { CasosList } from './components/CasosList';
import { useCasos } from './hooks/useCasos';
import { calculadora } from './utils/calculadora';
import type { Caso, LesionesData, FallecimientoData } from './types/baremo';

type Vista = 'lista' | 'formulario' | 'detalles' | 'resultado';

function App() {
  const { casos, addCaso, updateCaso, deleteCaso } = useCasos();
  const [vista, setVista] = useState<Vista>('lista');
  const [casoActual, setCasoActual] = useState<Caso | null>(null);

  const handleNuevoCaso = () => {
    setCasoActual(null);
    setVista('formulario');
  };

  const handleCrearCaso = (caso: Caso) => {
    setCasoActual(caso);
    setVista('detalles');
  };

  const handleActualizarLesiones = (lesiones: LesionesData) => {
    if (!casoActual) return;

    const casoActualizado = {
      ...casoActual,
      lesiones,
    };

    // Calcular resultado
    const resultado = calculadora.calcularIndemnizacion(casoActualizado);
    casoActualizado.resultado = resultado;

    setCasoActual(casoActualizado);
    setVista('resultado');
  };

  const handleActualizarFallecimiento = (fallecimiento: FallecimientoData) => {
    if (!casoActual) return;

    const casoActualizado = {
      ...casoActual,
      fallecimiento,
    };

    // Calcular resultado
    const resultado = calculadora.calcularIndemnizacion(casoActualizado);
    casoActualizado.resultado = resultado;

    setCasoActual(casoActualizado);
    setVista('resultado');
  };

  const handleGuardarCaso = () => {
    if (!casoActual) return;

    if (casos.find((c) => c.id === casoActual.id)) {
      updateCaso(casoActual.id, casoActual);
    } else {
      addCaso(casoActual);
    }

    alert('Caso guardado correctamente');
    setVista('lista');
  };

  const handleExportarPDF = () => {
    if (!casoActual || !casoActual.resultado) return;

    // Crear contenido para imprimir
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Informe de Indemnización - ${casoActual.cliente.nombre} ${casoActual.cliente.apellidos}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .total {
            background: #2563eb;
            color: white;
            padding: 30px;
            text-align: center;
            font-size: 32px;
            font-weight: bold;
            margin: 30px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INFORME DE INDEMNIZACIÓN</h1>
          <p>Baremo de Tráfico 2024</p>
          <p>Fecha: ${new Date().toLocaleDateString('es-ES')}</p>
        </div>

        <h2>Datos del Cliente</h2>
        <table>
          <tr><th>Nombre:</th><td>${casoActual.cliente.nombre} ${casoActual.cliente.apellidos}</td></tr>
          <tr><th>DNI:</th><td>${casoActual.cliente.dni}</td></tr>
          <tr><th>Edad:</th><td>${casoActual.cliente.edad} años</td></tr>
          <tr><th>Tipo de Accidente:</th><td style="text-transform: capitalize;">${casoActual.tipoAccidente}</td></tr>
        </table>

        <div class="total">
          INDEMNIZACIÓN TOTAL: ${formatCurrency(casoActual.resultado.total)}
        </div>

        <h2>Desglose Detallado</h2>
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Descripción</th>
              <th style="text-align: right;">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${casoActual.resultado.desglose
              .map(
                (item) => `
              <tr>
                <td>${item.concepto}</td>
                <td>${item.descripcion}</td>
                <td style="text-align: right;">${formatCurrency(item.cantidad)}</td>
              </tr>
            `
              )
              .join('')}
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              <td colspan="2">TOTAL</td>
              <td style="text-align: right;">${formatCurrency(casoActual.resultado.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Nota Legal:</strong> Este cálculo es orientativo y se basa en la Ley 35/2015 sobre valoración de daños y perjuicios causados a las personas en accidentes de circulación. Las cantidades están actualizadas según el Baremo de Tráfico 2024. No incluye gastos de asistencia sanitaria futura, ni lucros cesantes específicos. Se recomienda revisión legal profesional antes de presentar reclamación.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Esperar a que se cargue el contenido antes de imprimir
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleSelectCaso = (caso: Caso) => {
    setCasoActual(caso);
    setVista('resultado');
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Calculadora Baremo de Tráfico</h1>
              <p className="text-gray-400 text-sm mt-1">Sistema de cálculo de indemnizaciones 2024</p>
            </div>
            {vista !== 'lista' && (
              <button
                onClick={() => setVista('lista')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Volver a Casos
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {vista === 'lista' && (
          <CasosList
            casos={casos}
            onSelectCaso={handleSelectCaso}
            onDeleteCaso={deleteCaso}
            onNuevoCaso={handleNuevoCaso}
          />
        )}

        {vista === 'formulario' && (
          <CasoForm
            onSubmit={handleCrearCaso}
            onCancel={() => setVista('lista')}
          />
        )}

        {vista === 'detalles' && casoActual && (
          <>
            {casoActual.tipoAccidente === 'lesiones' && casoActual.lesiones && (
              <LesionesForm
                lesiones={casoActual.lesiones}
                onUpdate={handleActualizarLesiones}
                onBack={() => setVista('formulario')}
              />
            )}
            {casoActual.tipoAccidente === 'fallecimiento' && casoActual.fallecimiento && (
              <FallecimientoForm
                fallecimiento={casoActual.fallecimiento}
                onUpdate={handleActualizarFallecimiento}
                onBack={() => setVista('formulario')}
              />
            )}
          </>
        )}

        {vista === 'resultado' && casoActual && casoActual.resultado && (
          <ResultadoView
            caso={casoActual}
            resultado={casoActual.resultado}
            onNuevoCaso={handleNuevoCaso}
            onGuardar={handleGuardarCaso}
            onExportar={handleExportarPDF}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-gray-400 text-sm">
            <p>Calculadora del Baremo de Tráfico Español 2024</p>
            <p className="mt-1">Basado en la Ley 35/2015 sobre valoración de daños y perjuicios</p>
            <p className="mt-2 text-xs text-gray-500">
              Los cálculos son orientativos. Se recomienda consulta legal profesional.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
