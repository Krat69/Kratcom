import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const rootDir = import.meta.dirname;

// Los tests cubren la lógica pura de la memoria (parseo, fusión, dedup y
// recuperación). No cargan ningún modelo: lo que hay que proteger aquí no es
// la calidad de la IA, sino que el fichero del usuario nunca se corrompa.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(rootDir, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
