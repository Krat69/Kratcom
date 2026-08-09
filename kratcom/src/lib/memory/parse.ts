// Lectura y escritura de memoria.md.
//
// Requisito de diseño que manda sobre todos los demás: el fichero es del
// usuario. Puede abrirlo con cualquier editor, reordenarlo, añadir párrafos o
// borrar la mitad, y la app tiene que respetarlo. Por eso el parser guarda la
// línea original (`raw`) de cada bloque y la vuelve a escribir tal cual salvo
// que la app la haya modificado de forma explícita: lo que no entendemos, no
// lo tocamos.
//
// Los metadatos de máquina viajan en comentarios HTML, invisibles al
// renderizar el Markdown y borrables sin romper nada.

export interface MemoryEntry {
  /** null = línea escrita a mano por el usuario; la app no la modifica ni la borra. */
  id: string | null;
  text: string;
  meta: Record<string, string>;
  /** Línea original. null en entradas creadas por la app en esta sesión. */
  raw: string | null;
  dirty: boolean;
}

export type MemoryBlock =
  | { kind: 'entry'; entry: MemoryEntry }
  | { kind: 'raw'; text: string };

export interface MemorySection {
  title: string;
  headingRaw: string;
  blocks: MemoryBlock[];
}

export interface MemoryDoc {
  frontmatterRaw: string[];
  hasFrontmatter: boolean;
  preamble: string[];
  sections: MemorySection[];
}

export const DEFAULT_SECTIONS = ['Perfil', 'Preferencias', 'Hechos', 'Proyectos abiertos'] as const;
export const FALLBACK_SECTION = 'Hechos';

const ENTRY_WITH_META = /^(\s*[-*]\s+)<!--\s*([^>]*?)\s*-->\s*(.*)$/;
const PLAIN_ENTRY = /^(\s*[-*]\s+)(.*)$/;
const HEADING = /^##\s+(.+?)\s*$/;
const FENCE = /^\s*(```|~~~)/;

function parseMeta(raw: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const token of raw.split(/\s+/)) {
    const separator = token.indexOf(':');
    if (separator > 0) meta[token.slice(0, separator)] = token.slice(separator + 1);
  }
  return meta;
}

function renderMeta(meta: Record<string, string>): string {
  // Orden estable para que dos serializaciones del mismo estado sean iguales.
  const order = ['id', 'conf', 'visto'];
  const keys = [...order.filter(k => k in meta), ...Object.keys(meta).filter(k => !order.includes(k))];
  return keys.map(key => `${key}:${meta[key]}`).join(' ');
}

export function renderEntry(entry: MemoryEntry): string {
  if (!entry.dirty && entry.raw !== null) return entry.raw;
  if (entry.id === null) return `- ${entry.text}`;
  return `- <!--${renderMeta({ ...entry.meta, id: entry.id })}--> ${entry.text}`;
}

export function parseMemory(text: string): MemoryDoc {
  const lines = text.split('\n');
  let index = 0;

  const frontmatterRaw: string[] = [];
  let hasFrontmatter = false;
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (close > 0) {
      hasFrontmatter = true;
      frontmatterRaw.push(...lines.slice(1, close));
      index = close + 1;
    }
  }

  const preamble: string[] = [];
  const sections: MemorySection[] = [];
  let current: MemorySection | null = null;
  let inFence = false;

  for (; index < lines.length; index++) {
    const line = lines[index];

    if (FENCE.test(line)) inFence = !inFence;

    const heading = inFence ? null : HEADING.exec(line);
    if (heading) {
      current = { title: heading[1], headingRaw: line, blocks: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      preamble.push(line);
      continue;
    }

    if (inFence || FENCE.test(line)) {
      current.blocks.push({ kind: 'raw', text: line });
      continue;
    }

    const withMeta = ENTRY_WITH_META.exec(line);
    if (withMeta) {
      const meta = parseMeta(withMeta[2]);
      const { id, ...rest } = meta;
      current.blocks.push({
        kind: 'entry',
        entry: { id: id ?? null, text: withMeta[3].trim(), meta: rest, raw: line, dirty: false },
      });
      continue;
    }

    const plain = PLAIN_ENTRY.exec(line);
    if (plain && plain[2].trim()) {
      current.blocks.push({
        kind: 'entry',
        entry: { id: null, text: plain[2].trim(), meta: {}, raw: line, dirty: false },
      });
      continue;
    }

    current.blocks.push({ kind: 'raw', text: line });
  }

  return { frontmatterRaw, hasFrontmatter, preamble, sections };
}

export function serializeMemory(doc: MemoryDoc): string {
  const out: string[] = [];

  if (doc.hasFrontmatter) {
    out.push('---', ...doc.frontmatterRaw, '---');
  }
  out.push(...doc.preamble);

  for (const section of doc.sections) {
    out.push(section.headingRaw);
    for (const block of section.blocks) {
      out.push(block.kind === 'entry' ? renderEntry(block.entry) : block.text);
    }
  }

  return out.join('\n');
}

export function getFrontmatterValue(doc: MemoryDoc, key: string): string | null {
  for (const line of doc.frontmatterRaw) {
    const separator = line.indexOf(':');
    if (separator > 0 && line.slice(0, separator).trim() === key) {
      return line.slice(separator + 1).trim();
    }
  }
  return null;
}

/** Actualiza una clave del frontmatter conservando el resto tal cual. */
export function setFrontmatterValue(doc: MemoryDoc, key: string, value: string): void {
  const index = doc.frontmatterRaw.findIndex(line => {
    const separator = line.indexOf(':');
    return separator > 0 && line.slice(0, separator).trim() === key;
  });
  if (index >= 0) {
    doc.frontmatterRaw[index] = `${key}: ${value}`;
  } else {
    doc.frontmatterRaw.push(`${key}: ${value}`);
  }
  doc.hasFrontmatter = true;
}

export function allEntries(doc: MemoryDoc): MemoryEntry[] {
  return doc.sections.flatMap(section =>
    section.blocks.flatMap(block => (block.kind === 'entry' ? [block.entry] : []))
  );
}

export function countEntries(doc: MemoryDoc): number {
  return allEntries(doc).length;
}

export function findSection(doc: MemoryDoc, title: string): MemorySection | null {
  const wanted = title.trim().toLowerCase();
  return doc.sections.find(section => section.title.trim().toLowerCase() === wanted) ?? null;
}

export function ensureSection(doc: MemoryDoc, title: string): MemorySection {
  const existing = findSection(doc, title);
  if (existing) return existing;
  const section: MemorySection = { title, headingRaw: `## ${title}`, blocks: [] };
  // Una sección nueva se separa de la anterior con una línea en blanco, para
  // que el fichero siga siendo agradable de leer a mano.
  if (doc.sections.length > 0) {
    const previous = doc.sections[doc.sections.length - 1];
    if (previous.blocks.at(-1)?.kind !== 'raw' || serializeBlockText(previous.blocks.at(-1)) !== '') {
      previous.blocks.push({ kind: 'raw', text: '' });
    }
  }
  doc.sections.push(section);
  return section;
}

function serializeBlockText(block: MemoryBlock | undefined): string | null {
  if (!block) return null;
  return block.kind === 'raw' ? block.text : null;
}

export function createEmptyMemory(nowIso: string): MemoryDoc {
  const doc: MemoryDoc = {
    frontmatterRaw: [`version: 1`, `actualizado: ${nowIso}`, `hechos: 0`],
    hasFrontmatter: true,
    preamble: [
      '',
      '# Memoria de KratCom',
      '',
      '<!-- Este fichero es tuyo: puedes editarlo con cualquier editor de texto.',
      '     KratCom respeta lo que escribas a mano y solo modifica las líneas que',
      '     llevan su propia marca. Todo se procesa en este dispositivo. -->',
      '',
    ],
    sections: [],
  };
  for (const title of DEFAULT_SECTIONS) {
    doc.sections.push({ title, headingRaw: `## ${title}`, blocks: [{ kind: 'raw', text: '' }] });
  }
  return doc;
}
