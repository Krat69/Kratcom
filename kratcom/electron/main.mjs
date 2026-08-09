import { app, BrowserWindow, ipcMain, protocol, net, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { readFile, writeFile, rename, rm, mkdir, stat, readdir, open } from 'node:fs/promises';

// Envoltorio de escritorio (Linux, y de paso macOS y Windows).
//
// Carga exactamente el mismo build de Vite que la app móvil, pero le da dos
// cosas que el WebView de Capacitor no puede dar:
//
//   1. Ficheros de verdad: memoria.md es un .md en la carpeta Documentos, no
//      una entrada en IndexedDB.
//   2. Aislamiento por origen (COOP/COEP), que habilita SharedArrayBuffer y
//      por tanto el motor WASM multihilo. Servir por file:// no lo permitiría,
//      así que registramos un protocolo propio.

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');

const SCHEME = 'kratcom';
const MEMORY_ROOT_NAME = 'KratCom';

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/** Raíz de los datos del usuario: visible y editable con cualquier editor. */
function memoryRoot() {
  return join(app.getPath('documents'), MEMORY_ROOT_NAME);
}

/**
 * Resuelve una ruta relativa dentro de la carpeta de memoria, rechazando
 * cualquier intento de salirse de ella. El renderer no debería poder pedir
 * ficheros arbitrarios del disco solo porque el puente exista.
 */
function safePath(relative) {
  const base = app.getPath('documents');
  const target = resolve(base, normalize(relative));
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error('Ruta fuera de la carpeta de memoria');
  }
  return target;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 380,
    backgroundColor: '#1f2937',
    title: 'KratCom',
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.removeMenu();
  void window.loadURL(`${SCHEME}://app/index.html`);

  // Los enlaces externos van al navegador del sistema, no a una ventana de la
  // app: KratCom no navega a internet por diseño.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return window;
}

app.whenReady().then(async () => {
  protocol.handle(SCHEME, async request => {
    const { pathname } = new URL(request.url);
    const filePath = resolve(distDir, `.${normalize(pathname)}`);
    if (!filePath.startsWith(distDir)) {
      return new Response('Not found', { status: 404 });
    }

    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    // Sin estas dos cabeceras no hay SharedArrayBuffer y el motor WASM se
    // queda en un solo hilo.
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(response.body, { status: response.status, headers });
  });

  registerFsBridge();
  await registerLlamaBridge();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerFsBridge() {
  ipcMain.handle('fs:read', async (_event, path) => {
    try {
      return await readFile(safePath(path), 'utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('fs:write', async (_event, path, data) => {
    const target = safePath(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data, 'utf8');
  });

  ipcMain.handle('fs:remove', async (_event, path) => {
    await rm(safePath(path), { force: true });
  });

  ipcMain.handle('fs:rename', async (_event, from, to) => {
    try {
      await rename(safePath(from), safePath(to));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('fs:stat', async (_event, path) => {
    try {
      const info = await stat(safePath(path));
      return { size: info.size };
    } catch {
      return null;
    }
  });

  ipcMain.handle('fs:readdir', async (_event, path) => {
    try {
      const entries = await readdir(safePath(path), { withFileTypes: true });
      return entries.map(entry => ({ name: entry.name, isFile: entry.isFile() }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('fs:mkdir', async (_event, path) => {
    await mkdir(safePath(path), { recursive: true });
  });

  ipcMain.handle('fs:resolve', async (_event, path) => safePath(path));

  ipcMain.handle('fs:memoryRoot', async () => memoryRoot());
}

// ---------------------------------------------------------------------------
// Motor nativo de escritorio
//
// node-llama-cpp trae binarios precompilados, pero es una dependencia pesada y
// opcional: si no está instalada, el puente informa de que no está disponible y
// la app usa el motor WASM. Nunca debe impedir que la aplicación arranque.
// ---------------------------------------------------------------------------

let llamaModule = null;
let llamaContext = null;
let llamaSession = null;
const activeRequests = new Map();

async function registerLlamaBridge() {
  try {
    llamaModule = await import('node-llama-cpp');
  } catch {
    llamaModule = null;
  }

  ipcMain.handle('llama:available', async () => llamaModule !== null);

  // La descarga del modelo en el escritorio no puede pasar por los plugins de
  // Capacitor (en Electron caen a su implementación web, que guardaría 1 GB en
  // IndexedDB). Se hace aquí, a un fichero de verdad y con reanudación por
  // tamaño: si la descarga se cortó, el .part se descarta y se repite.
  ipcMain.handle('llama:ensureModel', async (event, spec) => {
    const dir = join(app.getPath('userData'), 'models');
    await mkdir(dir, { recursive: true });
    const target = join(dir, `${spec.id}.gguf`);

    const existing = await stat(target).catch(() => null);
    if (existing && existing.size === spec.approxBytes) return target;
    if (existing) await rm(target, { force: true });

    const url = `https://huggingface.co/${spec.repo}/resolve/main/${spec.file}?download=true`;
    const response = await net.fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`No se pudo descargar el modelo (HTTP ${response.status})`);
    }

    const total = Number(response.headers.get('content-length')) || spec.approxBytes;
    const partial = `${target}.part`;
    const handle = await open(partial, 'w');
    let loaded = 0;
    let lastReport = 0;

    try {
      for await (const chunk of response.body) {
        await handle.write(chunk);
        loaded += chunk.length;
        // Un evento por cada 2 MB: suficiente para una barra fluida sin
        // saturar el puente IPC.
        if (loaded - lastReport > 2_000_000 && !event.sender.isDestroyed()) {
          lastReport = loaded;
          event.sender.send('llama:download', { loaded, total });
        }
      }
    } finally {
      await handle.close();
    }

    if (loaded !== total) {
      await rm(partial, { force: true });
      throw new Error('La descarga quedó incompleta. Reinténtalo con una conexión estable.');
    }

    await rename(partial, target);
    return target;
  });

  ipcMain.handle('llama:load', async (_event, options) => {
    if (!llamaModule) throw new Error('node-llama-cpp no está instalado');
    const { getLlama, LlamaChatSession } = llamaModule;

    const llama = await getLlama({ gpu: options.gpuLayers === 0 ? false : 'auto' });
    const model = await llama.loadModel({ modelPath: options.modelPath });
    llamaContext = await model.createContext({
      contextSize: options.contextSize,
      threads: options.threads,
    });
    llamaSession = new LlamaChatSession({ contextSequence: llamaContext.getSequence() });
  });

  ipcMain.handle('llama:generate', async (event, options) => {
    if (!llamaSession) throw new Error('El modelo todavía no está cargado');

    const controller = new AbortController();
    activeRequests.set(options.requestId, controller);

    // El historial se reconstruye en cada llamada porque el estado de verdad
    // vive en el renderer; la sesión aquí es solo el motor.
    const system = options.messages.find(message => message.role === 'system');
    const prompt = options.messages
      .filter(message => message.role !== 'system')
      .map(message => `${message.role === 'user' ? 'Usuario' : 'Asistente'}: ${message.content}`)
      .join('\n\n');

    try {
      return await llamaSession.prompt(prompt, {
        systemPrompt: system?.content,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        signal: controller.signal,
        onTextChunk: chunk => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('llama:token', { requestId: options.requestId, token: chunk });
          }
        },
      });
    } finally {
      activeRequests.delete(options.requestId);
    }
  });

  ipcMain.handle('llama:abort', async (_event, requestId) => {
    activeRequests.get(requestId)?.abort();
  });

  ipcMain.handle('llama:unload', async () => {
    activeRequests.forEach(controller => controller.abort());
    activeRequests.clear();
    await llamaContext?.dispose().catch(() => undefined);
    llamaContext = null;
    llamaSession = null;
  });
}
