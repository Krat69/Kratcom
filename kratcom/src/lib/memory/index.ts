import { MEMORY_FILE, diaryPath, dateKeyFromDiaryName, localDateKey } from '@/lib/memory/paths';
import { appendToFile, listDiaryFiles, readFile, writeFileAtomic } from '@/lib/memory/store';
import {
  type MemoryDoc,
  countEntries,
  createEmptyMemory,
  parseMemory,
  serializeMemory,
  setFrontmatterValue,
} from '@/lib/memory/parse';
import { type MemoryOp, type MergeResult, applyOps } from '@/lib/memory/merge';
import { extractFacts, type ConversationTurn } from '@/lib/memory/extract';
import { compactMemory, needsCompaction } from '@/lib/memory/compact';
import { type DiaryEntry, type MemoryContext, buildMemoryContext, parseDiary } from '@/lib/memory/retrieve';

// Orquestador de la memoria. Es lo único que el resto de la app necesita
// importar: la UI no sabe de parsers, presupuestos de tokens ni umbrales de
// duplicados.

const RECENT_DIARY_DAYS = 2;
const MAX_OLDER_DIARY_FILES = 30;

export async function loadMemoryDoc(): Promise<MemoryDoc> {
  const raw = await readFile(MEMORY_FILE);
  if (raw === null) {
    const doc = createEmptyMemory(new Date().toISOString());
    await saveMemoryDoc(doc);
    return doc;
  }
  return parseMemory(raw);
}

export async function saveMemoryDoc(doc: MemoryDoc): Promise<void> {
  setFrontmatterValue(doc, 'version', '1');
  setFrontmatterValue(doc, 'actualizado', new Date().toISOString());
  setFrontmatterValue(doc, 'hechos', String(countEntries(doc)));
  await writeFileAtomic(MEMORY_FILE, serializeMemory(doc));
}

export async function readMemoryRaw(): Promise<string> {
  return (await readFile(MEMORY_FILE)) ?? '';
}

/** Guarda el fichero tal cual lo ha escrito el usuario en el editor de la app. */
export async function writeMemoryRaw(text: string): Promise<void> {
  await writeFileAtomic(MEMORY_FILE, text);
}

async function loadDiaryFile(dateKey: string): Promise<DiaryEntry[]> {
  const raw = await readFile(diaryPath(dateKey));
  return raw === null ? [] : parseDiary(raw, dateKey);
}

export async function loadDiaryDays(): Promise<string[]> {
  return listDiaryFiles()
    .then(names => names.map(dateKeyFromDiaryName).filter((key): key is string => key !== null));
}

/** Contexto de memoria para el turno actual. */
export async function buildTurnContext(query: string): Promise<MemoryContext> {
  const [doc, days] = await Promise.all([loadMemoryDoc(), loadDiaryDays()]);

  const recentKeys = days.slice(0, RECENT_DIARY_DAYS);
  const olderKeys = days.slice(RECENT_DIARY_DAYS, MAX_OLDER_DIARY_FILES);

  const [recent, older] = await Promise.all([
    Promise.all(recentKeys.map(loadDiaryFile)).then(chunks => chunks.flat()),
    Promise.all(olderKeys.map(loadDiaryFile)).then(chunks => chunks.flat()),
  ]);

  return buildMemoryContext({ doc, recentDiary: recent, olderDiary: older, query });
}

export interface ConsolidationResult {
  merge: MergeResult;
  compacted: boolean;
}

/**
 * Consolida un turno: anota el diario y, si el extractor encuentra hechos
 * duraderos, los funde en memoria.md.
 *
 * El diario se escribe SIEMPRE y sin pasar por el modelo, porque es un
 * registro, no una interpretación. Los hechos sí pasan por el extractor, y
 * después por las reglas de `applyOps`.
 */
export async function consolidateTurn(
  turn: ConversationTurn,
  opts: { signal?: AbortSignal; dryRun?: boolean } = {}
): Promise<ConsolidationResult> {
  const now = new Date();
  const today = localDateKey(now);

  await appendDiaryEntry(turn, now);

  const facts = await extractFacts(turn, { signal: opts.signal });
  const doc = await loadMemoryDoc();
  const merge = applyOps(doc, facts, { today });

  if (opts.dryRun) {
    return { merge, compacted: false };
  }

  let compacted = false;
  if (needsCompaction(doc)) {
    const result = await compactMemory(doc, { today, signal: opts.signal });
    compacted = result.compacted;
  }

  if (merge.added.length > 0 || merge.updated > 0 || merge.dropped > 0 || compacted) {
    await saveMemoryDoc(doc);
  }

  return { merge, compacted };
}

/** Aplica operaciones decididas por el usuario (confirmar, corregir, borrar). */
export async function applyUserOps(ops: MemoryOp[]): Promise<MergeResult> {
  const doc = await loadMemoryDoc();
  const merge = applyOps(doc, ops, { today: localDateKey() });
  await saveMemoryDoc(doc);
  return merge;
}

async function appendDiaryEntry(turn: ConversationTurn, now: Date): Promise<void> {
  const dateKey = localDateKey(now);
  const time = `${now.getHours()}`.padStart(2, '0') + ':' + `${now.getMinutes()}`.padStart(2, '0');
  const path = diaryPath(dateKey);

  const isNew = (await readFile(path)) === null;
  const header = isNew ? `---\nfecha: ${dateKey}\n---\n` : '';

  const body = [
    `\n## ${time}\n`,
    `**Tú:** ${collapse(turn.user, 400)}\n`,
    `**IA:** ${collapse(turn.assistant, 400)}\n`,
  ].join('');

  await appendToFile(path, header + body);
}

function collapse(text: string, max: number): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length <= max ? single : `${single.slice(0, max - 1)}…`;
}

export type { MemoryDoc } from '@/lib/memory/parse';
export type { MemoryContext, DiaryEntry } from '@/lib/memory/retrieve';
export type { MergeResult, MemoryOp } from '@/lib/memory/merge';
export { loadDiaryFile as loadDiaryEntries };
