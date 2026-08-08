# KratCom

Una aplicación de chat en tiempo real, construida con React, TypeScript y Tailwind CSS.

## Características

- 💬 Chat en tiempo real por canales
- 📱 Diseño responsive para móviles y desktop
- 📦 PWA (Aplicación Web Progresiva) instalable
- 💾 Persistencia de datos con localStorage
- 🎨 Interfaz moderna e intuitiva
- 🔒 **Tareas privadas**: encarga tareas con documentos adjuntos sin que los datos personales salgan del teléfono

## Tareas privadas: cómo se protegen los datos

El flujo completo de una tarea está diseñado para que **ningún dato personal abandone el dispositivo**, en línea con el principio de minimización (art. 5.1.c RGPD) y la seudonimización (art. 4.5 RGPD):

1. **Extracción local**: el documento adjunto (PDF o texto) se lee íntegramente en el navegador del teléfono — el PDF se procesa con pdf.js en local; el fichero original nunca se sube a ningún servidor.
2. **Seudonimización en el dispositivo**: antes de enviar nada, un motor local detecta datos personales típicos de documentación española y los sustituye por tokens estables (`[[DNI_1]]`, `[[PERSONA_2]]`…):
   - Nombres de personas (fórmulas «D./Dña./Sr./Sra. …» y «NOMBRE APELLIDOS, con DNI…»)
   - DNI, NIE y NIF de empresa (con validación de la letra de control)
   - Nº de afiliación a la Seguridad Social, IBAN y tarjetas (con validación de dígitos de control/Luhn)
   - Teléfonos, emails, direcciones postales, códigos postales, matrículas, referencias catastrales y fechas de nacimiento
   - Términos protegidos definidos por el usuario (nombres de clientes, empresas…)
3. **Bóveda cifrada local**: la correspondencia token → dato real se cifra con AES-GCM usando una clave **no extraíble** generada en el dispositivo (WebCrypto + IndexedDB). Ni la clave ni el mapeo se transmiten nunca; la propia tarea se guarda ya seudonimizada.
4. **Revisión antes de enviar**: la app muestra exactamente el texto que va a salir del teléfono, con los datos protegidos resaltados, y permite añadir términos adicionales antes de confirmar.
5. **Envío anonimizado**: la única salida de red de las tareas envía el texto ya seudonimizado (a un webhook configurable, o vía compartir/portapapeles). El servicio que ejecuta la tarea (un asistente de IA, una automatización…) trabaja solo con tokens.
6. **Rehidratación local**: cuando llega la respuesta (que conserva los tokens), la app restituye los valores reales únicamente en la pantalla del dispositivo.

> Nota: la detección es heurística y prioriza redactar de más antes que filtrar de menos. Revisa siempre la vista previa antes de enviar y añade como «término protegido» cualquier dato que el motor no haya reconocido.

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/krat69/kratcom.git
cd kratcom
```

2. Instala las dependencias y arranca en desarrollo:

```bash
npm install
npm run dev
```

3. Para compilar la versión de producción:

```bash
npm run build
```
