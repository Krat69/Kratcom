import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // Ruta base configurable: '/' en Vercel, '/Kratcom/' en GitHub Pages
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    // pdf.js (extracción local de PDF) usa sintaxis moderna (top-level await)
    target: 'es2022',
  },
})