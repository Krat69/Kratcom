import { Capacitor } from '@capacitor/core';
import { Directory } from '@capacitor/filesystem';

// Dónde vive la memoria en cada plataforma.
//
// El criterio es que el usuario pueda abrir y editar sus ficheros .md con
// cualquier otra app, sin pedir permisos intrusivos:
//
//   · iOS      Directory.Documents + UIFileSharingEnabled en Info.plist hace
//              que la carpeta salga en la app Archivos y se sincronice con
//              iCloud. Cero permisos.
//   · Android  Directory.External es el almacenamiento externo específico de
//              la app (Android/data/<paquete>/files): cualquier explorador de
//              archivos lo ve y NO requiere permisos, al contrario que
//              Directory.Documents, que bajo scoped storage está cerrado
//              desde API 30.
//   · Web      Directory.Data (IndexedDB). No es un fichero de verdad, pero
//              permite desarrollar y probar todo el flujo con `npm run dev`.
//   · Electron Directory.Data se resuelve al directorio de datos de la app.

export const MEMORY_ROOT = 'KratCom';
export const MEMORY_FILE = `${MEMORY_ROOT}/memoria.md`;
export const MEMORY_BACKUP = `${MEMORY_ROOT}/memoria.md.bak`;
export const DIARY_DIR = `${MEMORY_ROOT}/diario`;

export function memoryDirectory(): Directory {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return Directory.Documents;
  if (platform === 'android') return Directory.External;
  return Directory.Data;
}

/** Fecha local en formato AAAA-MM-DD (no UTC: el diario es del día del usuario). */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diaryPath(dateKey: string): string {
  return `${DIARY_DIR}/${dateKey}.md`;
}

/** 'KratCom/diario/2026-08-09.md' -> '2026-08-09' */
export function dateKeyFromDiaryName(name: string): string | null {
  const match = /(\d{4}-\d{2}-\d{2})\.md$/.exec(name);
  return match ? match[1] : null;
}
