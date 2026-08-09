import {
  FALLBACK_SECTION,
  type MemoryDoc,
  type MemoryEntry,
  allEntries,
  ensureSection,
  findSection,
} from '@/lib/memory/parse';

// Aplicación de cambios sobre memoria.md.
//
// El modelo NUNCA escribe el fichero: propone hechos y este módulo decide, en
// TypeScript determinista, qué entra y qué no. Un modelo de 1B al que se le
// pide devolver el .md entero reescrito acaba, antes o después, devolviendo
// medio fichero — y ahí se pierde la memoria del usuario.
//
// Dos invariantes que no se negocian:
//   1. Una entrada escrita a mano (sin marca de la app) no se modifica ni se
//      borra jamás de forma automática.
//   2. Ante la duda, no se escribe. Perder un hecho es recuperable; ensuciar
//      la memoria con basura, en la práctica, no.

export interface AddFactOp {
  kind: 'add';
  text: string;
  section?: string;
  confidence?: number;
}

export interface UpdateFactOp {
  kind: 'update';
  id: string;
  text: string;
}

export interface DropFactOp {
  kind: 'drop';
  id: string;
}

export type MemoryOp = AddFactOp | UpdateFactOp | DropFactOp;

export interface MemoryConflict {
  newText: string;
  existingId: string | null;
  existingText: string;
  similarity: number;
}

export interface MergeResult {
  added: MemoryEntry[];
  updated: number;
  dropped: number;
  skipped: { text: string; reason: string }[];
  /** Casos «esto se parece mucho a lo que ya había»: los resuelve el usuario. */
  conflicts: MemoryConflict[];
  needsCompaction: boolean;
}

export const MIN_FACT_LENGTH = 8;
export const MAX_FACT_LENGTH = 300;
export const MAX_ENTRIES_PER_SECTION = 60;

/** A partir de aquí consideramos que es literalmente el mismo hecho. */
export const DUPLICATE_THRESHOLD = 0.85;
/** Zona gris: se guarda igualmente, pero se avisa al usuario. */
export const NEAR_DUPLICATE_THRESHOLD = 0.7;

export function normalizeFact(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos fuera: «vivía» y «vivia» son lo mismo
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(text: string): Set<string> {
  const padded = ` ${text} `;
  const result = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) result.add(padded.slice(i, i + 3));
  return result;
}

/** Jaccard sobre trigramas: 0 = nada que ver, 1 = idéntico. */
export function similarity(a: string, b: string): number {
  const left = normalizeFact(a);
  const right = normalizeFact(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const first = trigrams(left);
  const second = trigrams(right);
  let shared = 0;
  for (const gram of first) if (second.has(gram)) shared++;
  const union = first.size + second.size - shared;
  return union === 0 ? 0 : shared / union;
}

function validateFact(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < MIN_FACT_LENGTH) return 'demasiado corto';
  if (clean.length > MAX_FACT_LENGTH) return 'demasiado largo';
  // Un comentario HTML dentro del texto rompería los metadatos de la línea.
  if (clean.includes('<!--') || clean.includes('-->')) return 'contiene marcas reservadas';
  if (clean.endsWith('?') || clean.endsWith('¿')) return 'es una pregunta, no un hecho';
  return null;
}

/** Siguiente identificador libre, derivado del documento (sin relojes: los tests son deterministas). */
function nextId(doc: MemoryDoc): () => string {
  let max = 0;
  for (const entry of allEntries(doc)) {
    const match = entry.id ? /^f(\d+)$/.exec(entry.id) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return () => `f${++max}`;
}

export function applyOps(
  doc: MemoryDoc,
  ops: MemoryOp[],
  options: { today: string }
): MergeResult {
  const result: MergeResult = {
    added: [],
    updated: 0,
    dropped: 0,
    skipped: [],
    conflicts: [],
    needsCompaction: false,
  };
  const makeId = nextId(doc);

  for (const op of ops) {
    if (op.kind === 'add') applyAdd(doc, op, options.today, makeId, result);
    else if (op.kind === 'update') applyUpdate(doc, op, options.today, result);
    else applyDrop(doc, op, result);
  }

  result.needsCompaction = doc.sections.some(
    section => section.blocks.filter(b => b.kind === 'entry').length > MAX_ENTRIES_PER_SECTION
  );

  return result;
}

function applyAdd(
  doc: MemoryDoc,
  op: AddFactOp,
  today: string,
  makeId: () => string,
  result: MergeResult
): void {
  const text = op.text.replace(/\s+/g, ' ').trim();
  const invalid = validateFact(text);
  if (invalid) {
    result.skipped.push({ text, reason: invalid });
    return;
  }

  let closest: { entry: MemoryEntry; score: number } | null = null;
  for (const entry of allEntries(doc)) {
    const score = similarity(text, entry.text);
    if (!closest || score > closest.score) closest = { entry, score };
  }

  if (closest && closest.score >= DUPLICATE_THRESHOLD) {
    // Ya lo sabíamos. Solo refrescamos la fecha de la entrada de la app, para
    // que la compactación sepa qué sigue vigente.
    if (closest.entry.id !== null) {
      closest.entry.meta.visto = today;
      closest.entry.dirty = true;
    }
    result.skipped.push({ text, reason: 'ya estaba en la memoria' });
    return;
  }

  if (closest && closest.score >= NEAR_DUPLICATE_THRESHOLD) {
    // Se parece mucho pero no es igual: puede ser un dato que cambió («trabaja
    // en X» -> «trabaja en Y») o dos hechos distintos que suenan parecido. No
    // hay forma fiable de distinguirlo, así que se guardan los dos y decide el
    // usuario, que es el único que sabe cuál es cierto.
    result.conflicts.push({
      newText: text,
      existingId: closest.entry.id,
      existingText: closest.entry.text,
      similarity: closest.score,
    });
  }

  const sectionTitle = resolveSection(doc, op.section, text);
  const section = ensureSection(doc, sectionTitle);
  const entry: MemoryEntry = {
    id: makeId(),
    text,
    meta: {
      conf: (op.confidence ?? 0.7).toFixed(1),
      visto: today,
    },
    raw: null,
    dirty: true,
  };

  // Se inserta tras la última entrada de la sección, no al final del bloque:
  // así el texto libre que el usuario haya dejado al pie sigue al pie.
  const lastEntryIndex = section.blocks.reduce(
    (last, block, index) => (block.kind === 'entry' ? index : last),
    -1
  );
  section.blocks.splice(lastEntryIndex + 1, 0, { kind: 'entry', entry });
  result.added.push(entry);
}

function applyUpdate(doc: MemoryDoc, op: UpdateFactOp, today: string, result: MergeResult): void {
  const invalid = validateFact(op.text);
  if (invalid) {
    result.skipped.push({ text: op.text, reason: invalid });
    return;
  }
  const entry = allEntries(doc).find(e => e.id === op.id);
  if (!entry || entry.id === null) {
    result.skipped.push({ text: op.text, reason: 'no existe esa entrada' });
    return;
  }
  entry.text = op.text.replace(/\s+/g, ' ').trim();
  entry.meta.visto = today;
  entry.dirty = true;
  result.updated++;
}

function applyDrop(doc: MemoryDoc, op: DropFactOp, result: MergeResult): void {
  for (const section of doc.sections) {
    const index = section.blocks.findIndex(
      block => block.kind === 'entry' && block.entry.id === op.id
    );
    if (index >= 0) {
      section.blocks.splice(index, 1);
      result.dropped++;
      return;
    }
  }
  result.skipped.push({ text: op.id, reason: 'no existe esa entrada' });
}

// Clasificación por palabras clave en lugar de pedírsela al modelo: un 1B no
// acierta con la etiqueta de forma consistente, y equivocarse de sección es
// más molesto que útil.
const PREFERENCE_HINTS =
  /\b(prefier|le gusta|no le gusta|odia|suele|siempre|nunca|prefiere|acostumbra)\b/i;
const PROFILE_HINTS =
  /\b(se llama|vive en|nació|es de|trabaja (en|de)|su (edad|profesión|dirección)|tiene \d+ años)\b/i;
const PROJECT_HINTS = /\b(proyecto|está (desarrollando|montando|escribiendo)|quiere (montar|crear|lanzar))\b/i;

function resolveSection(doc: MemoryDoc, requested: string | undefined, text: string): string {
  if (requested && findSection(doc, requested)) return requested;
  if (PROFILE_HINTS.test(text)) return 'Perfil';
  if (PREFERENCE_HINTS.test(text)) return 'Preferencias';
  if (PROJECT_HINTS.test(text)) return 'Proyectos abiertos';
  return FALLBACK_SECTION;
}
