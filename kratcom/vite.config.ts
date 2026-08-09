import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// El motor WASM usa hilos, y los hilos en el navegador necesitan
// SharedArrayBuffer, que solo está disponible en un contexto aislado por
// origen. De ahí estas dos cabeceras: sin ellas la inferencia cae a un solo
// hilo y va unas tres veces más lenta.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  // Ruta base configurable: '/' en Vercel, '/Kratcom/' en GitHub Pages
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  build: {
    // pdf.js (extracción local de PDF) usa sintaxis moderna (top-level await)
    target: 'es2022',
    // El .wasm de llama.cpp pesa ~7,5 MB: si Vite lo inlinea como base64, el
    // bundle se vuelve inmanejable. Debe seguir siendo un fichero aparte.
    assetsInlineLimit: 0,
  },
})
