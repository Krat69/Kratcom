import { describe, expect, it } from 'vitest';
import { parseMemory } from '@/lib/memory/parse';
import {
  type DiaryEntry,
  buildMemoryContext,
  parseDiary,
  rankDiaryEntries,
} from '@/lib/memory/retrieve';

const DIARY = `---
fecha: 2026-08-09
---

## 09:15
**Tú:** ¿Cómo va el contrato de alquiler del local?
**IA:** Vence en marzo y hay que preavisar con dos meses.

## 18:04
**Tú:** Recuérdame comprar tornillos.
**IA:** Anotado.
`;

describe('parseDiary', () => {
  it('separa las entradas por hora y descarta el frontmatter', () => {
    const entries = parseDiary(DIARY, '2026-08-09');
    expect(entries).toHaveLength(2);
    expect(entries[0].time).toBe('09:15');
    expect(entries[0].dateKey).toBe('2026-08-09');
    expect(entries[0].text).toContain('contrato de alquiler');
    expect(entries[0].text).not.toContain('fecha: 2026-08-09');
  });

  it('devuelve lista vacía si el fichero no tiene entradas', () => {
    expect(parseDiary('---\nfecha: 2026-08-09\n---\n', '2026-08-09')).toEqual([]);
  });
});

describe('rankDiaryEntries', () => {
  const entries: DiaryEntry[] = [
    { dateKey: '2026-08-01', time: '10:00', text: 'Hablamos del contrato de alquiler del local.' },
    { dateKey: '2026-08-02', time: '11:00', text: 'Receta de bizcocho de zanahoria.' },
    { dateKey: '2026-08-03', time: '12:00', text: 'Revisión del contrato con el abogado.' },
  ];

  it('devuelve primero lo relacionado con la consulta', () => {
    const ranked = rankDiaryEntries(entries, '¿qué decía el contrato?', 2);
    expect(ranked).toHaveLength(2);
    expect(ranked.every(e => e.text.toLowerCase().includes('contrato'))).toBe(true);
  });

  it('no devuelve nada si ningún término coincide', () => {
    expect(rankDiaryEntries(entries, 'astronomía galáctica', 3)).toEqual([]);
  });

  it('respeta el límite pedido', () => {
    expect(rankDiaryEntries(entries, 'contrato alquiler abogado local', 1)).toHaveLength(1);
  });
});

describe('buildMemoryContext', () => {
  const doc = parseMemory(`## Perfil
- <!--id:f1--> Vive en Las Palmas.
- <!--id:f2--> Trabaja de arquitecta técnica.
`);

  it('no genera contexto cuando no hay nada que recordar', () => {
    const context = buildMemoryContext({
      doc: null,
      recentDiary: [],
      olderDiary: [],
      query: 'hola',
    });
    expect(context.text).toBe('');
    expect(context.factsUsed).toBe(0);
  });

  it('incluye los hechos y las notas recientes', () => {
    const context = buildMemoryContext({
      doc,
      recentDiary: [{ dateKey: '2026-08-08', time: '10:00', text: 'Hablamos del riego.' }],
      olderDiary: [],
      query: 'hola',
    });

    expect(context.text).toContain('Vive en Las Palmas.');
    expect(context.text).toContain('[2026-08-08 10:00] Hablamos del riego.');
    expect(context.factsUsed).toBe(2);
    expect(context.diaryDaysUsed).toEqual(['2026-08-08']);
  });

  it('rescata una nota antigua solo si es relevante para la consulta', () => {
    const olderDiary: DiaryEntry[] = [
      { dateKey: '2026-07-01', time: '09:00', text: 'El contrato vence en marzo.' },
      { dateKey: '2026-07-02', time: '09:00', text: 'Bizcocho de zanahoria.' },
    ];

    const relevant = buildMemoryContext({ doc, recentDiary: [], olderDiary, query: 'el contrato' });
    expect(relevant.text).toContain('El contrato vence en marzo.');
    expect(relevant.text).not.toContain('Bizcocho');

    const unrelated = buildMemoryContext({ doc, recentDiary: [], olderDiary, query: 'el tiempo' });
    expect(unrelated.text).not.toContain('El contrato');
  });

  it('respeta el presupuesto de tokens y corta antes de desbordar', () => {
    const bigDoc = parseMemory(
      `## Hechos\n` +
        Array.from({ length: 200 }, (_, i) => `- <!--id:f${i}--> Hecho número ${i} bastante largo.`).join('\n')
    );

    const context = buildMemoryContext({
      doc: bigDoc,
      recentDiary: [],
      olderDiary: [],
      query: 'hola',
      factBudgetTokens: 100,
    });

    expect(context.factsUsed).toBeGreaterThan(0);
    expect(context.factsUsed).toBeLessThan(200);
    expect(context.approxTokens).toBeLessThan(300);
  });
});
