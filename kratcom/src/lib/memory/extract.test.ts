import { describe, expect, it } from 'vitest';
import { parseFacts } from '@/lib/memory/extract';

// El extractor habla con un modelo de 1B-3B: lo que devuelve no siempre es
// limpio. Estos casos son salidas reales que hay que tolerar sin ensuciar la
// memoria del usuario.

describe('parseFacts', () => {
  it('lee las líneas HECHO en el formato pedido', () => {
    const facts = parseFacts('HECHO: Vive en Las Palmas.\nHECHO: Prefiere respuestas breves.');
    expect(facts.map(f => f.text)).toEqual(['Vive en Las Palmas.', 'Prefiere respuestas breves.']);
    expect(facts.every(f => f.kind === 'add')).toBe(true);
  });

  it('devuelve vacío cuando el modelo dice que no hay nada', () => {
    expect(parseFacts('NINGUNO')).toEqual([]);
  });

  it('para de leer en cuanto aparece NINGUNO', () => {
    expect(parseFacts('NINGUNO\nHECHO: esto viene después y no cuenta.')).toEqual([]);
  });

  it('tolera viñetas, espacios y mayúsculas raras', () => {
    const facts = parseFacts('- hecho:  Tiene dos gatos. \n  * HECHO : Vive en Telde.');
    expect(facts.map(f => f.text)).toEqual(['Tiene dos gatos.', 'Vive en Telde.']);
  });

  it('descarta la cháchara que el modelo añade alrededor', () => {
    const facts = parseFacts(
      'Claro, aquí tienes los datos duraderos:\n\nHECHO: Se llama Ana.\n\nEspero que te sirva.'
    );
    expect(facts.map(f => f.text)).toEqual(['Se llama Ana.']);
  });

  it('quita las comillas con las que el modelo envuelve el hecho', () => {
    expect(parseFacts('HECHO: "Vive en Madrid."')[0].text).toBe('Vive en Madrid.');
    expect(parseFacts('HECHO: «Vive en Madrid.»')[0].text).toBe('Vive en Madrid.');
  });

  it('ignora la plantilla vacía que a veces se copia literalmente', () => {
    expect(parseFacts('HECHO: <una frase corta en tercera persona>')).toEqual([]);
    expect(parseFacts('HECHO:   ')).toEqual([]);
  });

  it('no acepta más de cinco hechos por turno', () => {
    const raw = Array.from({ length: 12 }, (_, i) => `HECHO: Dato número ${i} del usuario.`).join('\n');
    expect(parseFacts(raw)).toHaveLength(5);
  });
});
