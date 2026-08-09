# Arnés de verificación del núcleo de inferencia

Compila `shared/kratcom_llama.cpp` —el mismo fichero que corre en Android y en iOS— para el ordenador donde estés y lo ejerce contra un GGUF real.

Existe porque compilar no demuestra nada. Los fallos que de verdad duelen aquí son silenciosos: una plantilla de chat mal aplicada da respuestas raras, un contexto que no se limpia mezcla conversaciones, y una cancelación que no funciona solo se nota cuando el usuario pulsa «Parar» y no pasa nada.

## Uso

```bash
git submodule update --init --recursive

cd plugins/llama-native/test
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j

# Cualquier GGUF instruct pequeño sirve; este pesa unos 400 MB
curl -L -o /tmp/qwen05b.gguf \
  https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf

./build/harness /tmp/qwen05b.gguf
```

## Qué comprueba

| Comprobación | Qué protege |
|---|---|
| Carga el modelo | Que la ruta y los parámetros de contexto llegan bien |
| Tokeniza texto | Que el vocabulario está accesible |
| Responde «Paris» a la capital de Francia | Que la plantilla de chat del GGUF se aplica de verdad; sin ella el modelo divaga |
| Se detiene sola antes del tope | Que el corte por fin de secuencia funciona y no se generan 500 tokens siempre |
| Una segunda generación funciona | Que el estado sobrevive entre llamadas |
| No arrastra la conversación anterior | Que la caché KV se limpia; si no, las conversaciones se mezclan |
| Cancelar devuelve 1 y conserva lo generado | Que «Parar» corta de verdad y no tira el texto que el usuario ya estaba leyendo |

La prueba de cancelación espera a que haya salido texto antes de cortar, en lugar de medir por reloj: con la máquina ocupada, un temporizador fijo cancela antes del primer token y la prueba falla sin que nada esté roto.

Salida esperada al final: `TODO CORRECTO`.
