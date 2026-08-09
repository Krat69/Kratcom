const { contextBridge, ipcRenderer } = require('electron');

// Superficie mínima expuesta al renderer. Solo lo que la app necesita: ficheros
// dentro de la carpeta de memoria e inferencia local. Nada de acceso genérico
// al sistema, y ninguna función que haga peticiones de red.

const fs = {
  read: path => ipcRenderer.invoke('fs:read', path),
  write: (path, data) => ipcRenderer.invoke('fs:write', path, data),
  remove: path => ipcRenderer.invoke('fs:remove', path),
  rename: (from, to) => ipcRenderer.invoke('fs:rename', from, to),
  stat: path => ipcRenderer.invoke('fs:stat', path),
  readdir: path => ipcRenderer.invoke('fs:readdir', path),
  mkdir: path => ipcRenderer.invoke('fs:mkdir', path),
  resolve: path => ipcRenderer.invoke('fs:resolve', path),
};

const tokenHandlers = new Map();

ipcRenderer.on('llama:token', (_event, { requestId, token }) => {
  const handler = tokenHandlers.get(requestId);
  if (handler) handler(token);
});

const llama = {
  available: () => ipcRenderer.invoke('llama:available'),
  ensureModel: (spec, onProgress) => {
    const listener = (_event, progress) => onProgress?.(progress);
    ipcRenderer.on('llama:download', listener);
    return ipcRenderer
      .invoke('llama:ensureModel', spec)
      .finally(() => ipcRenderer.removeListener('llama:download', listener));
  },
  load: options => ipcRenderer.invoke('llama:load', options),
  generate: (options, onToken) => {
    tokenHandlers.set(options.requestId, onToken);
    return ipcRenderer
      .invoke('llama:generate', options)
      .finally(() => tokenHandlers.delete(options.requestId));
  },
  abort: requestId => ipcRenderer.invoke('llama:abort', requestId),
  unload: () => ipcRenderer.invoke('llama:unload'),
};

contextBridge.exposeInMainWorld('kratcom', { fs, llama, platform: 'electron' });
