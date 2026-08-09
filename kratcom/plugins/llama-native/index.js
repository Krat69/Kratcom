// El plugin no expone API propia en JavaScript: la app lo registra por su
// nombre desde src/lib/engine/native.ts, que es quien define el contrato.
// Este fichero existe para que npm y Capacitor puedan resolver el paquete.
module.exports = {};
