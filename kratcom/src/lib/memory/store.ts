import { DIARY_DIR, MEMORY_BACKUP, MEMORY_ROOT } from '@/lib/memory/paths';
import { memoryFs } from '@/lib/memory/fs';

// Acceso a disco de la memoria. Todo lo que escribe en el .md del usuario pasa
// por aquí, y por una razón: si una escritura se corta a la mitad, el usuario
// pierde su memoria. De ahí el orden temporal -> copia de seguridad ->
// reemplazo, y el que nunca se borre el .bak.

async function ensureDirs(): Promise<void> {
  const fs = memoryFs();
  await fs.mkdir(MEMORY_ROOT);
  await fs.mkdir(DIARY_DIR);
}

export async function readFile(path: string): Promise<string | null> {
  return memoryFs().read(path);
}

export async function fileExists(path: string): Promise<boolean> {
  return (await memoryFs().stat(path)) !== null;
}

/**
 * Escritura en tres pasos: primero el temporal, luego la copia de seguridad del
 * contenido anterior, y solo entonces el reemplazo.
 *
 * Lo que se garantiza no es la atomicidad —el puente de ficheros no la ofrece
 * en todas las plataformas— sino que siempre quede una versión recuperable: si
 * el proceso muere a mitad, o está el fichero viejo o está el .bak.
 */
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  await ensureDirs();
  const fs = memoryFs();
  const tmp = `${path}.tmp`;

  await fs.write(tmp, content);

  const previous = await fs.read(path);
  if (previous !== null) {
    await fs.write(backupPathFor(path), previous);
    await fs.remove(path);
  }

  const renamed = await fs.rename(tmp, path);
  if (!renamed) {
    // Sin rename disponible: se escribe directamente y se limpia el temporal.
    await fs.write(path, content);
    await fs.remove(tmp);
  }
}

function backupPathFor(path: string): string {
  return path.endsWith('memoria.md') ? MEMORY_BACKUP : `${path}.bak`;
}

/** Añade al final de un fichero (los diarios solo crecen, nunca se reescriben). */
export async function appendToFile(path: string, content: string): Promise<void> {
  await ensureDirs();
  const fs = memoryFs();
  const existing = await fs.read(path);
  await fs.write(path, existing === null ? content : existing + content);
}

export async function listDiaryFiles(): Promise<string[]> {
  const entries = await memoryFs().readdir(DIARY_DIR);
  return entries
    .filter(entry => entry.isFile && entry.name.endsWith('.md'))
    .map(entry => entry.name)
    .sort()
    .reverse(); // más recientes primero
}

export async function deleteFile(path: string): Promise<void> {
  await memoryFs().remove(path);
}

/** Ruta legible para enseñársela al usuario en los ajustes. */
export async function memoryFolderUri(): Promise<string> {
  return memoryFs().resolve(MEMORY_ROOT);
}
