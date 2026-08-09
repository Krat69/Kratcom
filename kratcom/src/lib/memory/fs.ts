import { Encoding, Filesystem } from '@capacitor/filesystem';
import { memoryDirectory } from '@/lib/memory/paths';

// Capa de ficheros de la memoria, con dos implementaciones:
//
//   · Capacitor Filesystem — Android, iOS y navegador (en web respalda sobre
//     IndexedDB, lo que permite desarrollar el flujo entero con `npm run dev`).
//   · Puente de Electron — en el escritorio se necesita el sistema de ficheros
//     de verdad, porque ahí el .md tiene que ser un fichero que el usuario
//     pueda abrir con su editor, no una entrada en una base de datos.
//
// El resto de la app no distingue una de otra.

export interface FileEntry {
  name: string;
  isFile: boolean;
}

export interface MemoryFs {
  read(path: string): Promise<string | null>;
  write(path: string, data: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number } | null>;
  readdir(path: string): Promise<FileEntry[]>;
  mkdir(path: string): Promise<void>;
  resolve(path: string): Promise<string>;
}

/** Puente que expone el preload de Electron. Ausente fuera del escritorio. */
interface DesktopFsBridge {
  read(path: string): Promise<string | null>;
  write(path: string, data: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number } | null>;
  readdir(path: string): Promise<FileEntry[]>;
  mkdir(path: string): Promise<void>;
  resolve(path: string): Promise<string>;
}

function desktopBridge(): DesktopFsBridge | null {
  return (globalThis as { kratcom?: { fs?: DesktopFsBridge } }).kratcom?.fs ?? null;
}

const capacitorFs: MemoryFs = {
  async read(path) {
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: memoryDirectory(),
        encoding: Encoding.UTF8,
      });
      return typeof data === 'string' ? data : await data.text();
    } catch {
      return null;
    }
  },

  async write(path, data) {
    await Filesystem.writeFile({
      path,
      directory: memoryDirectory(),
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },

  async remove(path) {
    await Filesystem.deleteFile({ path, directory: memoryDirectory() }).catch(() => undefined);
  },

  async rename(from, to) {
    try {
      const directory = memoryDirectory();
      await Filesystem.rename({ from, to, directory, toDirectory: directory });
      return true;
    } catch {
      // La implementación web no siempre soporta rename; quien llama tiene un
      // camino alternativo.
      return false;
    }
  },

  async stat(path) {
    try {
      const { size } = await Filesystem.stat({ path, directory: memoryDirectory() });
      return { size };
    } catch {
      return null;
    }
  },

  async readdir(path) {
    try {
      const { files } = await Filesystem.readdir({ path, directory: memoryDirectory() });
      return files.map(file => ({ name: file.name, isFile: file.type === 'file' }));
    } catch {
      return [];
    }
  },

  async mkdir(path) {
    await Filesystem.mkdir({ path, directory: memoryDirectory(), recursive: true }).catch(
      () => undefined
    );
  },

  async resolve(path) {
    try {
      const { uri } = await Filesystem.getUri({ path, directory: memoryDirectory() });
      return decodeURIComponent(uri.replace(/^file:\/\//, ''));
    } catch {
      return path;
    }
  },
};

export function memoryFs(): MemoryFs {
  return desktopBridge() ?? capacitorFs;
}
