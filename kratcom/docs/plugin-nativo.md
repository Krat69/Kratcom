# Plugin nativo `LlamaNative` (Android e iOS)

Trabajo pendiente. Todo el lado TypeScript ya está hecho: `src/lib/engine/native.ts` detecta el plugin, lo prefiere sobre el motor WASM y cae de vuelta al WASM si no está. En cuanto exista el código nativo, la app lo usa sin tocar ni una línea de la interfaz.

No está implementado aquí porque compilar llama.cpp para Android requiere el NDK y para iOS requiere Xcode, y escribir un binding JNI sin poder compilarlo ni ejecutarlo una sola vez sería entregar código que nadie ha visto funcionar.

## Por qué merece la pena

Dentro del WebView, el motor WASM va a un solo hilo: `SharedArrayBuffer` necesita aislamiento por origen (COOP + COEP) y Capacitor no permite añadir cabeceras a su servidor local. El plugin nativo no pasa por el WebView, así que usa todos los núcleos y, en iPhone, Metal.

Orden de magnitud para un modelo de 1B cuantizado Q4 en un móvil reciente: unos 5-8 tokens/s en WASM monohilo frente a 20-30 tokens/s nativo.

## Contrato que hay que implementar

Es el de `LlamaNativePlugin` en `src/lib/engine/native.ts`:

```ts
load({ modelPath: string, contextSize: number, threads: number, gpuLayers: number }): Promise<void>
generate({ requestId: string, messages: EngineMessage[], maxTokens: number, temperature: number }): Promise<{ text: string }>
abort({ requestId: string }): Promise<void>
unload(): Promise<void>
addListener('token', ({ requestId, token }) => void)
```

Detalles que importan:

- **`modelPath` llega ya resuelto.** La descarga y la caché las hace la app (`src/lib/engine/download.ts`, con `@capacitor/file-transfer`). El plugin solo abre un fichero que ya está en el disco.
- **Los tokens se emiten por evento**, etiquetados con su `requestId`, porque el chat y la consolidación de la memoria pueden generar a la vez y su texto no debe mezclarse.
- **`gpuLayers: 0` significa CPU pura**, y hay que respetarlo: es el ajuste «solo CPU» de la pantalla de ajustes, que existe para dispositivos con controladores gráficos problemáticos.
- La plantilla de chat sale del propio GGUF (`chat_template`); no conviene reimplementarla a mano.

## Android

- llama.cpp como submódulo de git, compilado con CMake y el NDK para `arm64-v8a`. `armeabi-v7a` no compensa: un dispositivo de 32 bits no va a mover estos modelos.
- **Alineación de páginas de 16 KB.** Google Play ya la exige para Android 15+; si el `.so` no la cumple, la subida se rechaza. Se consigue con `-Wl,-z,max-page-size=16384`.
- Conviene activar las extensiones de CPU disponibles (`LLAMA_NATIVE=OFF` más los flags de NEON/dotprod correspondientes) y comprobar el resultado en un dispositivo real, no en el emulador.

## iOS

- llama.cpp trae `build-xcframework.sh`, que produce un `llama.xcframework` listo para enlazar. Es preferible a añadir los fuentes al proyecto.
- Envoltorio en Swift, con los tokens emitidos por `notifyListeners`.
- El *entitlement* `com.apple.developer.kernel.increased-memory-limit` ya está en `ios/App/App/App.entitlements` y enlazado en el proyecto, pero hay que activarlo también en **Signing & Capabilities**.
- El simulador no sirve para medir: ni la memoria ni Metal se comportan como en el dispositivo.

## Cómo comprobar que funciona

1. `Capacitor.isPluginAvailable('LlamaNative')` devuelve `true` en el dispositivo.
2. En Ajustes, «Motor en uso» pasa de *WebAssembly* a *llama.cpp nativo*.
3. La respuesta aparece token a token, no de golpe al final.
4. El botón «Parar» del chat interrumpe la generación de verdad.
5. Con «Solo CPU» activado, el consumo de GPU cae a cero.
6. Modo avión: todo sigue funcionando con el modelo ya descargado.
