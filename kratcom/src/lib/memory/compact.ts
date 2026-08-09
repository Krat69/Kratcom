import { generate } from '@/lib/engine';
import {
  type MemoryDoc,
  type MemoryEntry,
  allEntries,
  ensureSection,
} from '@/lib/memory/parse';
import { MAX_ENTRIES_PER_SECTION } from '@/lib/memory/merge';

// Compactación: cuando una sección crece demasiado, los hechos más antiguos
// de la app se resumen y se mueven a «Archivo».
//
// Norma de seguridad: si el resumen falla, o sale sospechosamente corto, no se
// toca nada. Es preferible un memoria.md largo a uno mutilado.

const ARCHIVE_SECTION = 'Archivo';
const COMPACT_PROMPT = `Resume esta lista de datos sobre una persona en menos líneas, sin perder ninguna información importante.

Reglas:
- Agrupa los datos relacionados en una sola frase.
- Conserva nombres, lugares, fechas y cifras exactamente como están.
- No inventes nada que no esté en la lista.
- Responde SOLO con líneas que empiecen por "- ". Nada más.`;

export interface CompactionResult {
  compacted: boolean;
  entriesBefore: number;
  entriesAfter: number;
  reason?: string;
}

export function needsCompaction(doc: MemoryDoc): boolean {
  return doc.sections.some(
    section => section.blocks.filter(block => block.kind === 'entry').length > MAX_ENTRIES_PER_SECTION
  );
}

export async function compactMemory(
  doc: MemoryDoc,
  opts: { today: string; signal?: AbortSignal } = { today: '' }
): Promise<CompactionResult> {
  const before = allEntries(doc).length;

  const section = doc.sections.find(
    s => s.blocks.filter(block => block.kind === 'entry').length > MAX_ENTRIES_PER_SECTION
  );
  if (!section || section.title === ARCHIVE_SECTION) {
    return { compacted: false, entriesBefore: before, entriesAfter: before, reason: 'nada que compactar' };
  }

  // Solo se compactan entradas de la app: lo escrito a mano se queda donde
  // está, íntegro, pase lo que pase.
  const candidates: { index: number; entry: MemoryEntry }[] = [];
  section.blocks.forEach((block, index) => {
    if (block.kind === 'entry' && block.entry.id !== null) {
      candidates.push({ index, entry: block.entry });
    }
  });

  const overflow = candidates
    .sort((a, b) => (a.entry.meta.visto ?? '').localeCompare(b.entry.meta.visto ?? ''))
    .slice(0, Math.max(0, candidates.length - MAX_ENTRIES_PER_SECTION + 10));

  if (overflow.length < 5) {
    return { compacted: false, entriesBefore: before, entriesAfter: before, reason: 'poco que ganar' };
  }

  let summary: string;
  try {
    summary = await generate(
      [
        { role: 'system', content: COMPACT_PROMPT },
        { role: 'user', content: overflow.map(item => `- ${item.entry.text}`).join('\n') },
      ],
      { temperature: 0.2, maxTokens: 512, signal: opts.signal }
    );
  } catch (err) {
    return {
      compacted: false,
      entriesBefore: before,
      entriesAfter: before,
      reason: err instanceof Error ? err.message : 'el resumen falló',
    };
  }

  const lines = summary
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line.length >= 8 && !line.includes('<!--'));

  // Un resumen que no reduce nada, o que reduce demasiado, es un resumen en el
  // que no se puede confiar: se descarta y el fichero se queda como estaba.
  if (lines.length === 0 || lines.length >= overflow.length || lines.length < overflow.length / 8) {
    return {
      compacted: false,
      entriesBefore: before,
      entriesAfter: before,
      reason: 'el resumen no era fiable',
    };
  }

  const removeAt = new Set(overflow.map(item => item.index));
  section.blocks = section.blocks.filter((_, index) => !removeAt.has(index));

  const archive = ensureSection(doc, ARCHIVE_SECTION);
  // Identificadores derivados del propio documento: sin relojes ni azar, para
  // que compactar dos veces el mismo fichero dé el mismo resultado.
  let counter = allEntries(doc).reduce((max, entry) => {
    const match = entry.id ? /^a(\d+)$/.exec(entry.id) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const stamp = opts.today || (overflow.at(-1)?.entry.meta.visto ?? '');
  for (const line of lines) {
    archive.blocks.push({
      kind: 'entry',
      entry: {
        id: `a${++counter}`,
        text: line,
        meta: { conf: '0.6', visto: stamp },
        raw: null,
        dirty: true,
      },
    });
  }

  const after = allEntries(doc).length;
  return { compacted: true, entriesBefore: before, entriesAfter: after };
}
