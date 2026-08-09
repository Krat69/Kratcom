import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';
import type { LoadProgress, ModelSpec } from '@/lib/engine/types';

// Descarga y caché del fichero GGUF para el motor NATIVO.
//
// El motor WASM no pasa por aquí: wllama trae su propio gestor de caché. Esta
// ruta existe porque llama.cpp nativo carga desde una ruta del disco, y así
// la descarga se comporta igual en Android, iOS y Linux.
//
// Los modelos van a Directory.Data (privado de la app, excluido de la copia
// de seguridad en iOS por convención de Capacitor): pesan ~1 GB y no tiene
// sentido subirlos a iCloud, ni que aparezcan mezclados con los ficheros del
// usuario. La memoria del usuario sí es visible, pero eso es otra carpeta.
const MODELS_DIR = 'models';

function fileNameFor(model: ModelSpec): string {
  return `${MODELS_DIR}/${model.id}.gguf`;
}

function huggingFaceUrl(model: ModelSpec): string {
  return `https://huggingface.co/${model.repo}/resolve/main/${model.file}?download=true`;
}

/**
 * Devuelve la ruta absoluta del modelo en el disco, descargándolo la primera
 * vez. Si ya está y el tamaño cuadra con el esperado, no toca la red: es lo
 * que permite que la app arranque en modo avión.
 */
export async function ensureModelFile(
  model: ModelSpec,
  onProgress?: (p: LoadProgress) => void
): Promise<string> {
  const path = fileNameFor(model);

  const cached = await statOrNull(path);
  if (cached && cached.size === model.approxBytes) {
    return cached.uri;
  }

  // Un fichero del tamaño equivocado es una descarga que se cortó a medias:
  // hay que borrarlo antes de reintentar o se queda ocupando 1 GB inútil.
  if (cached) {
    await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => undefined);
  }

  await Filesystem.mkdir({ path: MODELS_DIR, directory: Directory.Data, recursive: true }).catch(
    () => undefined // ya existía
  );

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });

  const listener = await FileTransfer.addListener('progress', status => {
    if (status.type !== 'download') return;
    onProgress?.({
      ratio: status.lengthComputable && status.contentLength > 0
        ? status.bytes / status.contentLength
        : null,
      loadedBytes: status.bytes,
      totalBytes: status.lengthComputable ? status.contentLength : model.approxBytes,
      phase: 'descargando',
    });
  });

  try {
    await FileTransfer.downloadFile({
      url: huggingFaceUrl(model),
      path: uri,
      progress: true,
    });
  } finally {
    await listener.remove();
  }

  const downloaded = await statOrNull(path);
  if (!downloaded) {
    throw new Error('La descarga terminó pero el modelo no está en el disco');
  }
  if (downloaded.size !== model.approxBytes) {
    await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => undefined);
    throw new Error(
      'El modelo descargado está incompleto (tamaño inesperado). Reinténtalo con una conexión estable.'
    );
  }

  return downloaded.uri;
}

export async function isModelDownloaded(model: ModelSpec): Promise<boolean> {
  const stat = await statOrNull(fileNameFor(model));
  return stat?.size === model.approxBytes;
}

export async function deleteModelFile(model: ModelSpec): Promise<void> {
  await Filesystem.deleteFile({ path: fileNameFor(model), directory: Directory.Data }).catch(
    () => undefined
  );
}

async function statOrNull(path: string): Promise<{ size: number; uri: string } | null> {
  try {
    const stat = await Filesystem.stat({ path, directory: Directory.Data });
    return { size: stat.size, uri: stat.uri };
  } catch {
    return null; // no existe
  }
}
