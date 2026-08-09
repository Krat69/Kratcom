/**
 * Aproximación al número de tokens de un texto.
 *
 * Ningún motor expone su tokenizador de forma síncrona, y para lo único que
 * necesitamos esta cifra —repartir el presupuesto de contexto entre memoria,
 * diarios e historial— una estimación conservadora basta. En español un token
 * ronda los 3,6 caracteres; usamos 3,4 para sobreestimar el gasto y quedarnos
 * cortos antes que desbordar la ventana.
 *
 * Vive en su propio módulo, sin dependencias, para que la capa de memoria no
 * tenga que importar el motor WASM solo para contar caracteres.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.4);
}
