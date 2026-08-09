import { describe, expect, it } from 'vitest';
import { allEntries, findSection, parseMemory, serializeMemory } from '@/lib/memory/parse';
import { applyOps, normalizeFact, similarity } from '@/lib/memory/merge';

const TODAY = '2026-08-09';

const BASE = `---
version: 1
hechos: 2
---

# Memoria de KratCom

## Perfil
- <!--id:f1 conf:1.0 visto:2026-08-01--> Vive en Las Palmas de Gran Canaria.

## Preferencias
- Prefiero que me hables de usted.

## Hechos

## Proyectos abiertos
`;

const doc = () => parseMemory(BASE);

describe('similarity', () => {
  it('ignora acentos, mayúsculas y puntuación', () => {
    expect(normalizeFact('¡Vivía en Almería!')).toBe('vivia en almeria');
    expect(similarity('Vive en Almería', 'vive en almeria')).toBe(1);
  });

  it('da 1 a textos idénticos y algo bajo a textos ajenos', () => {
    expect(similarity('Tiene un perro', 'Tiene un perro')).toBe(1);
    expect(similarity('Tiene un perro', 'Trabaja de fontanero')).toBeLessThan(0.3);
  });
});

describe('applyOps · alta de hechos', () => {
  it('añade un hecho nuevo con identificador y fecha', () => {
    const memory = doc();
    const result = applyOps(memory, [{ kind: 'add', text: 'Tiene dos hijas.' }], { today: TODAY });

    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('f2');
    expect(result.added[0].meta.visto).toBe(TODAY);
    expect(serializeMemory(memory)).toContain('<!--id:f2 conf:0.7 visto:2026-08-09--> Tiene dos hijas.');
  });

  it('descarta un duplicado y refresca la fecha del original', () => {
    const memory = doc();
    const result = applyOps(
      memory,
      [{ kind: 'add', text: 'Vive en Las Palmas de Gran Canaria' }],
      { today: TODAY }
    );

    expect(result.added).toHaveLength(0);
    expect(result.skipped[0].reason).toBe('ya estaba en la memoria');
    expect(allEntries(memory).find(e => e.id === 'f1')!.meta.visto).toBe(TODAY);
  });

  it('guarda los parecidos pero los señala como conflicto para que decida el usuario', () => {
    const memory = doc();
    const result = applyOps(
      memory,
      [{ kind: 'add', text: 'Vive en Las Palmas de Gran Canaria desde 2019.' }],
      { today: TODAY }
    );

    expect(result.added).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].existingId).toBe('f1');
    expect(result.conflicts[0].similarity).toBeGreaterThanOrEqual(0.7);
  });

  it('rechaza textos inválidos sin tocar el documento', () => {
    const memory = doc();
    const before = serializeMemory(memory);
    const result = applyOps(
      memory,
      [
        { kind: 'add', text: 'corto' },
        { kind: 'add', text: '¿Dónde vive el usuario?' },
        { kind: 'add', text: `Intenta colar <!--id:f1--> metadatos.` },
        { kind: 'add', text: 'x'.repeat(400) },
      ],
      { today: TODAY }
    );

    expect(result.added).toHaveLength(0);
    expect(result.skipped.map(s => s.reason)).toEqual([
      'demasiado corto',
      'es una pregunta, no un hecho',
      'contiene marcas reservadas',
      'demasiado largo',
    ]);
    expect(serializeMemory(memory)).toBe(before);
  });

  it('coloca cada hecho en la sección que le toca', () => {
    const memory = doc();
    applyOps(
      memory,
      [
        { kind: 'add', text: 'Trabaja de arquitecta técnica.' },
        { kind: 'add', text: 'Prefiere recibir las respuestas en listas.' },
        { kind: 'add', text: 'Está desarrollando un proyecto de riego automático.' },
        { kind: 'add', text: 'El coche lo tiene en el taller esta semana.' },
      ],
      { today: TODAY }
    );

    const textOf = (title: string) =>
      findSection(memory, title)!
        .blocks.flatMap(b => (b.kind === 'entry' ? [b.entry.text] : []))
        .join(' | ');

    expect(textOf('Perfil')).toContain('arquitecta técnica');
    expect(textOf('Preferencias')).toContain('listas');
    expect(textOf('Proyectos abiertos')).toContain('riego automático');
    expect(textOf('Hechos')).toContain('taller');
  });

  it('numera los identificadores sin repetirlos aunque se llame varias veces', () => {
    const memory = doc();
    applyOps(memory, [{ kind: 'add', text: 'Tiene un gato llamado Tomás.' }], { today: TODAY });
    applyOps(memory, [{ kind: 'add', text: 'Juega al pádel los martes.' }], { today: TODAY });

    const ids = allEntries(memory).map(e => e.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['f1', 'f2', 'f3']);
  });
});

describe('applyOps · respeto a lo escrito a mano', () => {
  it('no permite modificar una entrada sin identificador', () => {
    const memory = doc();
    const result = applyOps(
      memory,
      [{ kind: 'update', id: '', text: 'Prefiere el tuteo.' }],
      { today: TODAY }
    );

    expect(result.updated).toBe(0);
    expect(serializeMemory(memory)).toContain('- Prefiero que me hables de usted.');
  });

  it('no borra una entrada escrita a mano ni por error de identificador', () => {
    const memory = doc();
    const result = applyOps(memory, [{ kind: 'drop', id: 'f99' }], { today: TODAY });

    expect(result.dropped).toBe(0);
    expect(serializeMemory(memory)).toContain('- Prefiero que me hables de usted.');
  });

  it('la edición a mano sobrevive intacta a un ciclo completo de consolidación', () => {
    const edited = BASE.replace(
      '## Hechos\n',
      '## Hechos\n- Nota mía: el contrato vence en marzo.\n\nOjo con esto.\n'
    );
    const memory = parseMemory(edited);

    applyOps(
      memory,
      [
        { kind: 'add', text: 'Tiene una reunión semanal los lunes.' },
        { kind: 'add', text: 'Vive en Las Palmas de Gran Canaria' },
        { kind: 'update', id: 'f1', text: 'Vive en Las Palmas de Gran Canaria (capital).' },
      ],
      { today: TODAY }
    );

    const output = serializeMemory(memory);
    expect(output).toContain('- Nota mía: el contrato vence en marzo.');
    expect(output).toContain('Ojo con esto.');
    expect(output).toContain('- Prefiero que me hables de usted.');
    // Y lo nuevo se ha añadido de verdad, no es que no haya hecho nada.
    expect(output).toContain('reunión semanal los lunes');
  });
});

describe('applyOps · modificación y borrado de entradas propias', () => {
  it('actualiza el texto y la fecha de una entrada de la app', () => {
    const memory = doc();
    const result = applyOps(
      memory,
      [{ kind: 'update', id: 'f1', text: 'Vive en Telde, Gran Canaria.' }],
      { today: TODAY }
    );

    expect(result.updated).toBe(1);
    const entry = allEntries(memory).find(e => e.id === 'f1')!;
    expect(entry.text).toBe('Vive en Telde, Gran Canaria.');
    expect(entry.meta.visto).toBe(TODAY);
  });

  it('borra una entrada de la app cuando se pide explícitamente', () => {
    const memory = doc();
    const result = applyOps(memory, [{ kind: 'drop', id: 'f1' }], { today: TODAY });

    expect(result.dropped).toBe(1);
    expect(serializeMemory(memory)).not.toContain('Vive en Las Palmas');
  });
});
