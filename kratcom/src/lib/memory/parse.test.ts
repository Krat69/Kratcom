import { describe, expect, it } from 'vitest';
import {
  allEntries,
  countEntries,
  createEmptyMemory,
  ensureSection,
  findSection,
  getFrontmatterValue,
  parseMemory,
  serializeMemory,
  setFrontmatterValue,
} from '@/lib/memory/parse';

const SAMPLE = `---
version: 1
actualizado: 2026-08-09T18:04:00+02:00
hechos: 3
---

# Memoria de KratCom

## Perfil
- <!--id:f1 conf:1.0 visto:2026-08-09--> Vive en Las Palmas de Gran Canaria.
- Esta línea la escribí yo a mano.

## Preferencias

- <!--id:f2 conf:0.8 visto:2026-08-09--> Prefiere respuestas breves.

Un párrafo suelto que el usuario dejó aquí.

## Hechos
`;

describe('parseMemory / serializeMemory', () => {
  it('devuelve el fichero byte a byte cuando nada ha cambiado', () => {
    expect(serializeMemory(parseMemory(SAMPLE))).toBe(SAMPLE);
  });

  it('es idempotente al volver a parsear', () => {
    const once = serializeMemory(parseMemory(SAMPLE));
    const twice = serializeMemory(parseMemory(once));
    expect(twice).toBe(once);
  });

  it('distingue las entradas de la app de las escritas a mano', () => {
    const entries = allEntries(parseMemory(SAMPLE));
    expect(entries.map(e => e.id)).toEqual(['f1', null, 'f2']);
    expect(entries[1].text).toBe('Esta línea la escribí yo a mano.');
  });

  it('lee los metadatos de cada entrada', () => {
    const [first] = allEntries(parseMemory(SAMPLE));
    expect(first.meta).toEqual({ conf: '1.0', visto: '2026-08-09' });
    expect(first.text).toBe('Vive en Las Palmas de Gran Canaria.');
  });

  it('conserva el texto libre dentro de una sección', () => {
    const doc = parseMemory(SAMPLE);
    const preferences = findSection(doc, 'Preferencias');
    const raws = preferences!.blocks.filter(b => b.kind === 'raw').map(b => (b as { text: string }).text);
    expect(raws).toContain('Un párrafo suelto que el usuario dejó aquí.');
  });

  it('no confunde una lista dentro de un bloque de código con entradas', () => {
    const withCode = `## Hechos

\`\`\`
- esto es código, no un hecho
\`\`\`
- <!--id:f9--> Esto sí es un hecho registrado.
`;
    const doc = parseMemory(withCode);
    expect(allEntries(doc)).toHaveLength(1);
    expect(allEntries(doc)[0].id).toBe('f9');
    expect(serializeMemory(doc)).toBe(withCode);
  });

  it('no trata un encabezado dentro de un bloque de código como sección', () => {
    const withCode = `## Hechos

\`\`\`md
## Perfil
\`\`\`
`;
    const doc = parseMemory(withCode);
    expect(doc.sections.map(s => s.title)).toEqual(['Hechos']);
    expect(serializeMemory(doc)).toBe(withCode);
  });

  it('cuenta las entradas de todas las secciones', () => {
    expect(countEntries(parseMemory(SAMPLE))).toBe(3);
  });
});

describe('frontmatter', () => {
  it('actualiza una clave sin tocar el resto', () => {
    const doc = parseMemory(SAMPLE);
    setFrontmatterValue(doc, 'hechos', '7');
    expect(getFrontmatterValue(doc, 'hechos')).toBe('7');
    expect(getFrontmatterValue(doc, 'version')).toBe('1');
    expect(serializeMemory(doc)).toContain('actualizado: 2026-08-09T18:04:00+02:00');
  });

  it('añade la clave si no existía', () => {
    const doc = parseMemory(SAMPLE);
    setFrontmatterValue(doc, 'idioma', 'es');
    expect(serializeMemory(doc)).toContain('idioma: es');
  });
});

describe('createEmptyMemory', () => {
  it('crea un documento con las secciones por defecto y sin entradas', () => {
    const doc = createEmptyMemory('2026-08-09T18:04:00.000Z');
    expect(doc.sections.map(s => s.title)).toEqual([
      'Perfil',
      'Preferencias',
      'Hechos',
      'Proyectos abiertos',
    ]);
    expect(countEntries(doc)).toBe(0);
    // Debe sobrevivir a una vuelta completa por el parser.
    expect(serializeMemory(parseMemory(serializeMemory(doc)))).toBe(serializeMemory(doc));
  });
});

describe('ensureSection', () => {
  it('reutiliza la sección existente sin duplicarla', () => {
    const doc = parseMemory(SAMPLE);
    const before = doc.sections.length;
    ensureSection(doc, 'perfil');
    expect(doc.sections).toHaveLength(before);
  });

  it('crea la sección que falta al final', () => {
    const doc = parseMemory(SAMPLE);
    ensureSection(doc, 'Archivo');
    expect(doc.sections.at(-1)!.title).toBe('Archivo');
    expect(serializeMemory(doc)).toContain('## Archivo');
  });
});
