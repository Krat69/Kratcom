import { useState, useEffect } from 'react';
import type { Caso } from '../types/baremo';

const STORAGE_KEY = 'baremo_casos';

export function useCasos() {
  const [casos, setCasos] = useState<Caso[]>([]);

  // Cargar casos del localStorage al iniciar
  useEffect(() => {
    loadCasos();
  }, []);

  const loadCasos = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convertir strings de fecha a objetos Date
        const casosConFechas = parsed.map((caso: any) => ({
          ...caso,
          fecha: new Date(caso.fecha),
          cliente: {
            ...caso.cliente,
            fechaNacimiento: new Date(caso.cliente.fechaNacimiento),
          },
        }));
        setCasos(casosConFechas);
      }
    } catch (error) {
      console.error('Error al cargar casos:', error);
    }
  };

  const saveCasos = (nuevosCasos: Caso[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevosCasos));
      setCasos(nuevosCasos);
    } catch (error) {
      console.error('Error al guardar casos:', error);
    }
  };

  const addCaso = (caso: Caso) => {
    const nuevosCasos = [...casos, caso];
    saveCasos(nuevosCasos);
  };

  const updateCaso = (id: string, casoActualizado: Caso) => {
    const nuevosCasos = casos.map((c) => (c.id === id ? casoActualizado : c));
    saveCasos(nuevosCasos);
  };

  const deleteCaso = (id: string) => {
    const nuevosCasos = casos.filter((c) => c.id !== id);
    saveCasos(nuevosCasos);
  };

  const getCasoById = (id: string): Caso | undefined => {
    return casos.find((c) => c.id === id);
  };

  const exportCasos = () => {
    const dataStr = JSON.stringify(casos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `casos-baremo-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCasos = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        // Validar y convertir fechas
        const casosImportados = imported.map((caso: any) => ({
          ...caso,
          fecha: new Date(caso.fecha),
          cliente: {
            ...caso.cliente,
            fechaNacimiento: new Date(caso.cliente.fechaNacimiento),
          },
        }));
        saveCasos([...casos, ...casosImportados]);
      } catch (error) {
        console.error('Error al importar casos:', error);
        alert('Error al importar el archivo. Verifica que sea un archivo JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  return {
    casos,
    addCaso,
    updateCaso,
    deleteCaso,
    getCasoById,
    exportCasos,
    importCasos,
  };
}
