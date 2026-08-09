import { allEntries, type MemoryDoc } from '@/lib/memory/parse';
import { normalizeFact } from '@/lib/memory/merge';
import { estimateTokens } from '@/lib/engine/tokens';

// Construcción del contexto que se le pasa al modelo en cada turno.
//
// La ventana de un modelo pequeño es de 4096 tokens y hay que repartirla entre
// memoria, diarios, historial de la conversación y la respuesta. Aquí solo se
// decide qué parte de la memoria entra, con un presupuesto explícito: nada de
// «meter todo y que Dios reparta suerte», porque desbordar el contexto no da
// un error claro, sino respuestas que ignoran el principio del prompt.

export interface DiaryEntry {
  dateKey: string;
  time: string;
  text: string;
}

export interface MemoryContext {
  /** Bloque listo para inyectar como mensaje de sistema. Vacío si no hay nada. */
  text: string;
  factsUsed: number;
  diaryDaysUsed: string[];
  approxTokens: number;
}

export const DEFAULT_FACT_BUDGET_TOKENS = 700;
export const DEFAULT_DIARY_BUDGET_TOKENS = 500;

const DIARY_HEADING = /^##\s+(\d{1,2}:\d{2})\s*$/;

/** Lee un diario diario (valga la redundancia) en entradas con hora. */
export function parseDiary(text: string, dateKey: string): DiaryEntry[] {
  const entries: DiaryEntry[] = [];
  let time = '';
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (time && body) entries.push({ dateKey, time, text: body });
    buffer = [];
  };

  const lines = text.split('\n');
  // El frontmatter del diario no es contenido: se salta entero.
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (close > 0) start = close + 1;
  }

  for (const line of lines.slice(start)) {
    const heading = DIARY_HEADING.exec(line);
    if (heading) {
      flush();
      time = heading[1];
      continue;
    }
    if (time) buffer.push(line);
  }
  flush();

  return entries;
}

export function renderDiaryEntry(entry: DiaryEntry): string {
  return `[${entry.dateKey} ${entry.time}] ${entry.text.replace(/\n+/g, ' ')}`;
}

// BM25 clásico sobre las entradas de diario, tratando cada entrada como un
// documento. Es suficiente para «¿qué habíamos hablado del contrato?» y no
// requiere embeddings, que en un móvil costarían otra pasada de modelo.
const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
  return normalizeFact(text).split(' ').filter(word => word.length > 2);
}

export function rankDiaryEntries(entries: DiaryEntry[], query: string, limit: number): DiaryEntry[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || entries.length === 0) return [];

  const docs = entries.map(entry => tokenize(entry.text));
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length || 1;

  const scored = entries.map((entry, index) => {
    const doc = docs[index];
    let score = 0;
    for (const term of queryTerms) {
      const frequency = doc.filter(word => word === term).length;
      if (frequency === 0) continue;
      const containing = docs.filter(other => other.includes(term)).length;
      const idf = Math.log(1 + (docs.length - containing + 0.5) / (containing + 0.5));
      score +=
        idf * ((frequency * (K1 + 1)) / (frequency + K1 * (1 - B + (B * doc.length) / avgLength)));
    }
    return { entry, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.entry);
}

export interface BuildContextOptions {
  doc: MemoryDoc | null;
  /** Entradas de los últimos días, ya cargadas. */
  recentDiary: DiaryEntry[];
  /** Entradas más antiguas, candidatas a recuperación por relevancia. */
  olderDiary: DiaryEntry[];
  /** Lo que el usuario acaba de escribir, para buscar en los diarios antiguos. */
  query: string;
  factBudgetTokens?: number;
  diaryBudgetTokens?: number;
}

export function buildMemoryContext(options: BuildContextOptions): MemoryContext {
  const factBudget = options.factBudgetTokens ?? DEFAULT_FACT_BUDGET_TOKENS;
  const diaryBudget = options.diaryBudgetTokens ?? DEFAULT_DIARY_BUDGET_TOKENS;

  const factLines: string[] = [];
  let factTokens = 0;
  if (options.doc) {
    for (const entry of allEntries(options.doc)) {
      const line = `- ${entry.text}`;
      const cost = estimateTokens(line);
      if (factTokens + cost > factBudget) break;
      factLines.push(line);
      factTokens += cost;
    }
  }

  const diaryLines: string[] = [];
  const daysUsed = new Set<string>();
  let diaryTokens = 0;

  const relevant = rankDiaryEntries(options.olderDiary, options.query, 3);
  // Primero lo reciente (marca el hilo de la conversación), después lo antiguo
  // que resulte relevante para lo que se acaba de preguntar.
  for (const entry of [...options.recentDiary, ...relevant]) {
    const line = renderDiaryEntry(entry);
    const cost = estimateTokens(line);
    if (diaryTokens + cost > diaryBudget) break;
    diaryLines.push(line);
    daysUsed.add(entry.dateKey);
    diaryTokens += cost;
  }

  if (factLines.length === 0 && diaryLines.length === 0) {
    return { text: '', factsUsed: 0, diaryDaysUsed: [], approxTokens: 0 };
  }

  const parts = ['Esto es lo que recuerdas del usuario de conversaciones anteriores.'];
  if (factLines.length > 0) {
    parts.push('', 'MEMORIA:', ...factLines);
  }
  if (diaryLines.length > 0) {
    parts.push('', 'NOTAS DE DÍAS ANTERIORES:', ...diaryLines);
  }
  parts.push(
    '',
    'Úsalo con naturalidad, solo si viene a cuento. No enumeres lo que recuerdas ni digas que tienes una memoria: simplemente tenlo en cuenta.'
  );

  const text = parts.join('\n');
  return {
    text,
    factsUsed: factLines.length,
    diaryDaysUsed: [...daysUsed],
    approxTokens: estimateTokens(text),
  };
}
