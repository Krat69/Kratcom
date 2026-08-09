# Plugin nativo `LlamaNative`

Inferencia con llama.cpp compilado para el dispositivo, detrás del mismo contrato que el motor WebAssembly. `src/lib/engine/native.ts` lo detecta y lo prefiere automáticamente; si no está compilado, la app cae al WASM sin que la interfaz se entere.

## Por qué existe

Dentro del WebView, el motor WASM va a un solo hilo: `SharedArrayBuffer` necesita aislamiento por origen (COOP + COEP) y Capacitor no permite añadir cabeceras a su servidor local. El plugin nativo no pasa por el WebView, así que usa todos los núcleos y, en iPhone, Metal.

## Cómo está montado

```
plugins/llama-native/
  shared/
    include/kratcom_llama.h    fachada en C
    kratcom_llama.cpp          TODA la lógica de inferencia
  android/
    src/main/cpp/
      jni_bridge.cpp           traducción JNI, sin lógica
      CMakeLists.txt
      llama.cpp/               submódulo, fijado en b10333
    src/main/java/…/           LlamaBridge.java + LlamaNativePlugin.java
  ios/
    Sources/LlamaNativePlugin/ LlamaSession.swift + LlamaNativePlugin.swift
    Frameworks/                llama.xcframework (generado, no versionado)
  Package.swift
  scripts/build-ios-xcframework.sh
```

La lógica de llama.cpp está escrita **una sola vez**, en `shared/kratcom_llama.cpp`. Android e iOS compilan ese mismo fichero; lo que cambia es solo el envoltorio. La fachada es C y no C++ porque JNI habla C sin fricción y Swift puede importar una cabecera C directamente.

Decisiones que conviene conocer:

- **La plantilla de chat sale del GGUF** (`llama_model_chat_template`), no está escrita a mano. Cada familia de modelos espera sus propios marcadores y reimplementarlos es la vía rápida a respuestas raras.
- **Cada generación limpia la caché KV.** El historial completo viaja en `messages` desde el lado JavaScript, así que reutilizar el contexto anterior mezclaría conversaciones.
- **Las generaciones se serializan.** El contexto de llama.cpp no admite decodificaciones concurrentes; dos peticiones a la vez —el chat y la consolidación de la memoria— se encolan en lugar de corromperse.
- **`gpuLayers: 0` es CPU pura** y se respeta: es el ajuste «solo CPU» de la pantalla de ajustes, para dispositivos con controladores gráficos problemáticos.
- **Cancelar no es un error.** `kratcom_llama_stop` devuelve 1 y conserva lo ya generado.

## Estado de verificación

| Qué | Cómo se comprobó |
|---|---|
| El núcleo compila contra la API real de llama.cpp | `g++ -fsyntax-only` contra las cabeceras de b10333 |
| La librería arm64 enlaza | CMake + NDK r27c → `libkratcom_llama.so`, ELF aarch64 |
| Los cinco símbolos JNI se exportan | `llvm-nm -D` sobre el `.so` |
| Alineación de páginas de 16 KB (la exige Google Play) | `llvm-readelf -l` → `LOAD align 0x4000` |
| **La inferencia funciona de verdad** | `test/` — arnés con Qwen 2.5 0.5B: responde «Paris» a la capital de Francia, corta sola por EOG, la segunda generación no arrastra la anterior, y la cancelación devuelve 1 conservando el texto. Reproducible: ver `test/README.md` |
| El APK integra el plugin | `gradlew assembleDebug` con el plugin sincronizado, también en CI |

**Lo que no está verificado: iOS.** El código Swift usa exactamente la misma fachada C que sí se ha probado, pero compilarlo requiere macOS con Xcode. Antes de abrir el proyecto hay que generar el framework una vez:

```bash
cd kratcom/plugins/llama-native
./scripts/build-ios-xcframework.sh   # tarda varios minutos
```

Y activar en Xcode **Signing & Capabilities → Increased Memory Limit**, sin lo cual iOS mata la app al cargar un modelo de ~1 GB.

## Trabajar con el submódulo

```bash
git submodule update --init --recursive
```

Sin él, CMake aborta con un mensaje explícito en vez de fallar de forma críptica. Para subir de versión: entrar en el submódulo, `git checkout <etiqueta>`, volver y confirmar el cambio de puntero. Al cambiar la versión hay que regenerar el xcframework de iOS.

Solo se compila `arm64-v8a`. Un dispositivo de 32 bits no mueve estos modelos, y compilar para `armeabi-v7a` duplicaría el tiempo de build a cambio de una variante que nadie usaría.

## Comprobación en un dispositivo real

1. En Ajustes, «Motor en uso» debe decir *llama.cpp nativo* y no *WebAssembly*.
2. La respuesta aparece token a token, no de golpe al final.
3. El botón «Parar» corta de verdad y conserva lo escrito.
4. Con «Solo CPU» activado, el consumo de GPU cae a cero.
5. En modo avión, con el modelo ya descargado, todo sigue funcionando.
