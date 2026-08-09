# KratCom

Interfaz privada de IA: una PWA (React + TypeScript + Tailwind) para hablar con Claude y encargarle tareas con documentos, **sin que los datos personales salgan del dispositivo**.

## Características

- 🤖 **Conversaciones con la IA** (API de Claude vía SDK oficial, con streaming) — cada mensaje se seudonimiza en el dispositivo antes de enviarse y la respuesta se rehidrata localmente
- 🔒 **Tareas privadas**: adjunta un documento, revisa exactamente qué saldrá del teléfono y envíalo anonimizado; si la IA está configurada, la tarea se completa automáticamente
- 📄 Extracción local de PDF (pdf.js en el navegador) y formatos de texto
- 📱 PWA instalable, diseño móvil primero
- 🔑 La clave de API se guarda solo en el dispositivo

## Cómo se protegen los datos

El flujo está diseñado para que **ningún dato personal abandone el dispositivo**, en línea con la minimización (art. 5.1.c RGPD) y la seudonimización (art. 4.5 RGPD):

1. **Extracción local**: los documentos se leen íntegramente en el navegador; el fichero original nunca se sube.
2. **Seudonimización en el dispositivo**: antes de enviar nada, un motor local detecta datos personales típicos de documentación española y los sustituye por tokens estables (`[[DNI_1]]`, `[[PERSONA_2]]`…):
   - Nombres de personas (fórmulas «D./Dña./Sr./Sra. …» y «NOMBRE APELLIDOS, con DNI…»)
   - DNI, NIE y NIF de empresa (con validación de la letra de control)
   - Nº de afiliación a la Seguridad Social, IBAN y tarjetas (con validación de dígitos de control/Luhn)
   - Teléfonos, emails, direcciones postales, códigos postales, matrículas, referencias catastrales y fechas de nacimiento
   - Términos protegidos definidos por el usuario (nombres de clientes, empresas…)
3. **Bóveda cifrada local**: la correspondencia token → dato real se cifra con AES-GCM usando una clave **no extraíble** generada en el dispositivo (WebCrypto + IndexedDB). Ni la clave ni el mapeo se transmiten nunca; conversaciones y tareas se guardan ya seudonimizadas.
4. **La IA solo ve tokens**: el system prompt le indica que conserve los tokens intactos; en pantalla puedes alternar entre «datos reales» (rehidratación local) y «lo enviado» (los tokens).
5. **Tokens estables por conversación**: el mismo dato recibe siempre el mismo token dentro de una conversación, así la IA mantiene la coherencia sin conocer los valores.

> Nota: la detección es heurística y prioriza redactar de más antes que filtrar de menos. En las tareas privadas hay revisión obligatoria antes de enviar; añade como «término protegido» cualquier dato que el motor no reconozca.

## Motores de IA

Tres motores seleccionables en ajustes (⚙️):

- **En tu móvil (100 % local, por defecto)**: wllama (llama.cpp compilado a WebAssembly) ejecuta un modelo pequeño (Qwen 2.5 0.5B/1.5B) íntegramente en el dispositivo, **por CPU y en cualquier navegador moderno** — sin WebGPU ni requisitos de hardware. Sin clave, sin coste y sin que salga ningún dato — ni siquiera anonimizado. El primer uso descarga el modelo (~470 MB el estándar; cacheado). Con este motor la app rehidrata los datos en el dispositivo para la inferencia y vuelve a seudonimizar la respuesta antes de guardarla.
- **Google Gemini**: automático y gratuito (franja gratuita, clave sin tarjeta en aistudio.google.com/apikey).
- **Claude (Anthropic)**: máxima calidad, SDK oficial con streaming, pago por uso.

Con los motores remotos, la IA solo recibe texto seudonimizado. Sin ningún motor configurado, queda el modo manual (copiar/pegar anonimizado). Para las tareas también puede configurarse un webhook alternativo.

## Instalación

```bash
git clone https://github.com/krat69/kratcom.git
cd kratcom
npm install
npm run dev     # desarrollo
npm run build   # producción
```
