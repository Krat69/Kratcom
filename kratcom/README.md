# KratCom

IA que funciona **dentro de tu dispositivo** y va acumulando lo que aprende en ficheros Markdown que tú puedes leer, editar y borrar.

Una sola base de código React + TypeScript para tres plataformas:

| Plataforma | Empaquetado | Motor de inferencia |
|---|---|---|
| Android | Capacitor (APK/AAB) | llama.cpp nativo · WASM como respaldo |
| iPhone | Capacitor (IPA) | llama.cpp nativo · WASM como respaldo |
| Linux | Electron (AppImage/deb) | node-llama-cpp · WASM como respaldo |
| Navegador | PWA | WASM (llama.cpp compilado a WebAssembly) |

## Sin nube, literalmente

No hay servidores, ni cuentas, ni claves de API. **La única petición de red que hace la app es la descarga del modelo la primera vez.** A partir de ahí funciona en modo avión, y esa es una prueba que puedes hacer tú mismo (ver *Verificación* más abajo).

Las versiones anteriores hablaban con Gemini y con Claude. Todo eso se ha eliminado: los módulos de red ya no existen y, si quedaba alguna clave guardada de entonces, la app la borra al arrancar.

## La memoria

Todo lo que la app recuerda vive en dos sitios, ambos en texto plano y legibles con cualquier editor:

```
KratCom/
  memoria.md          hechos duraderos: perfil, preferencias, proyectos
  memoria.md.bak      copia de la última versión buena
  diario/
    2026-08-09.md     un fichero por día, solo añade, nunca reescribe
```

`memoria.md` tiene este aspecto:

```md
---
version: 1
actualizado: 2026-08-09T18:04:00+02:00
hechos: 37
---

## Perfil
- <!--id:f1 conf:1.0 visto:2026-08-09--> Vive en Las Palmas de Gran Canaria.
- Esta línea la escribí yo a mano y la app no la va a tocar.

## Preferencias
- <!--id:f2 conf:0.8 visto:2026-08-09--> Prefiere respuestas breves.
```

Los metadatos van en comentarios HTML: no se ven al renderizar el Markdown y puedes borrarlos sin romper nada.

### Cómo se escribe, y por qué así

Al modelo **nunca** se le pide que reescriba el fichero. Tras cada turno propone hechos sueltos en un formato de una línea, y es código TypeScript determinista el que decide qué entra:

- Un hecho que se parece a otro por encima del 85 % se descarta como duplicado.
- Entre el 70 % y el 85 % se guarda, pero se marca como conflicto para que decidas tú: puede ser un dato que cambió o dos hechos distintos que suenan parecido, y no hay forma fiable de distinguirlos automáticamente.
- **Lo que escribas a mano no se modifica ni se borra jamás.** Una línea sin marca de la app es tuya, y punto.
- Las escrituras van por temporal → copia de seguridad → reemplazo, de modo que un corte a mitad deja siempre una versión recuperable.

Pedirle a un modelo de mil millones de parámetros que devuelva el `.md` entero acaba, antes o después, devolviendo medio fichero. De ahí estas reglas.

Los diarios no se compactan nunca. Se leen los dos últimos días completos y, del resto, solo lo que resulte relevante para lo que acabas de preguntar (BM25 sobre las entradas).

### Dónde está el fichero

| Plataforma | Carpeta |
|---|---|
| iPhone | `Documentos/KratCom/` — visible en la app **Archivos** y sincronizable con iCloud |
| Android | `Android/data/es.cratias.kratcom/files/KratCom/` — visible con cualquier explorador de archivos, sin pedir permisos |
| Linux | `~/Documentos/KratCom/` |
| Navegador | IndexedDB (solo para desarrollo; no es un fichero real) |

## Modelos

GGUF cuantizados Q4_K_M, descargados de Hugging Face y verificados por tamaño:

| Modelo | Tamaño | Para quién |
|---|---|---|
| Llama 3.2 1B | 770 MB | iPhone y móviles modestos |
| Qwen 2.5 1.5B | 940 MB | Por defecto |
| Qwen 2.5 3B | 1,80 GB | Móviles potentes y ordenador |

Son modelos pequeños: van bien para conversar, resumir y redactar borradores; no esperes de ellos razonamiento complejo.

## Desarrollo

```bash
npm install
npm run dev          # navegador, con recarga en caliente
npm test             # tests de la capa de memoria
npx tsc --noEmit     # comprobación de tipos
```

Móvil y escritorio:

```bash
npm run android      # compila, sincroniza y abre Android Studio
npm run ios          # ídem con Xcode (requiere macOS)
npm run electron:dev # app de escritorio
npm run electron:build   # AppImage y .deb en release/
```

### Lo que hay que hacer en Xcode una vez

El fichero `ios/App/App/App.entitlements` ya está creado y enlazado en el proyecto, pero el *entitlement* de memoria ampliada hay que activarlo también en la interfaz: **Signing & Capabilities → + Capability → Increased Memory Limit**. Sin él, iOS mata la app al cargar un modelo de ~1 GB.

## Estado

Funcionando:

- Motor WASM (llama.cpp en WebAssembly) en las cuatro plataformas.
- Memoria completa: `memoria.md`, diarios, extracción, deduplicación, compactación, recuperación por relevancia y editor dentro de la app. 43 tests.
- Motor nativo de escritorio (node-llama-cpp) a través del proceso principal de Electron.
- Proyectos de Android y iOS generados y configurados.

Pendiente:

- **Plugin nativo `LlamaNative` para Android e iOS.** El contrato en TypeScript ya está escrito y el motor lo detecta y lo usa en cuanto exista (`src/lib/engine/native.ts`); falta el código nativo. Ver `docs/plugin-nativo.md`.
- Firmado y distribución (Play Store, TestFlight).

Mientras el plugin no exista, en móvil se usa el motor WASM. Funciona, pero conviene saber por qué es lento: los hilos en WebAssembly necesitan `SharedArrayBuffer`, que exige aislamiento por origen (COOP/COEP), y Capacitor no permite añadir esas cabeceras a su servidor local. Dentro del WebView, por tanto, la inferencia va a **un solo hilo**. En Electron sí hay cabeceras propias y el WASM va multihilo.

## Verificación

La prueba que respalda todo lo que dice este README:

1. Abre la app y deja que descargue el modelo.
2. Activa el modo avión (o corta la red).
3. Sigue conversando con normalidad.

Si funciona igual, es que efectivamente nada sale del dispositivo.

## Tareas privadas

El apartado de tareas conserva el anonimizador de datos personales españoles (DNI, NIE, NIF, NUSS, IBAN, tarjetas con Luhn, teléfonos, direcciones, matrículas, referencias catastrales) y la bóveda cifrada con AES-GCM. Sin nube ya no protege ningún envío, pero sigue siendo útil para **compartir o exportar** una tarea sin destapar datos reales: la tarea se guarda seudonimizada y los valores auténticos quedan cifrados con una clave no extraíble en este dispositivo.

El chat, en cambio, guarda el texto tal cual, igual que `memoria.md`. Cifrar la conversación mientras la memoria se escribe en claro habría sido una incoherencia.
