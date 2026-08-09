import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'es.cratias.kratcom',
  appName: 'KratCom',
  webDir: 'dist',
  android: {
    // El WebView sirve desde https://localhost para que el contexto sea seguro
    // (Web Crypto, almacenamiento persistente).
    androidScheme: 'https',
  },
  ios: {
    scheme: 'KratCom',
  },
  plugins: {
    CapacitorHttp: {
      // La descarga del modelo la hace @capacitor/file-transfer de forma
      // nativa; no queremos que el puente intercepte fetch() por su cuenta.
      enabled: false,
    },
  },
};

// NOTA sobre los hilos del motor WASM en móvil:
//
// SharedArrayBuffer —y por tanto el llama.cpp multihilo en WebAssembly— exige
// aislamiento por origen (COOP + COEP). Capacitor no permite añadir cabeceras
// a su servidor local, así que dentro del WebView el motor WASM se ejecuta en
// UN SOLO HILO. Funciona, pero es lento.
//
// La solución no es pelearse con las cabeceras: es el motor nativo
// (plugins/llama-native), que no pasa por el WebView y usa todos los núcleos.
// El WASM en móvil queda como red de seguridad, no como camino principal.

export default config;
