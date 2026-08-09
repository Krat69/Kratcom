import { generate } from '@/lib/engine';
import type { AddFactOp } from '@/lib/memory/merge';

// Extracción de hechos duraderos a partir de un turno de conversación.
//
// Es una segunda inferencia local, barata y con la temperatura muy baja. El
// formato de salida es deliberadamente pobre —una línea por hecho— porque un
// modelo de 1B a 3B mantiene un formato simple mucho mejor que un JSON, y
// cualquier línea que no encaje se descarta sin más.

const MAX_FACTS_PER_TURN = 5;

const EXTRACTOR_PROMPT = `Tu tarea es detectar datos DURADEROS sobre el usuario en una conversación.

Un dato duradero sigue siendo cierto dentro de un mes: cómo se llama, dónde vive, a qué se dedica, qué prefiere, qué proyectos tiene, personas y fechas importantes de su vida.

NO son datos duraderos: lo que pregunta, lo que responde el asistente, opiniones del asistente, datos de una sola vez, cálculos, ni nada que ya sea evidente.

Responde SOLO con líneas con este formato exacto:
HECHO: <una frase corta en tercera persona>

Si no hay ningún dato duradero, responde exactamente:
NINGUNO

Ejemplos de respuesta correcta:
HECHO: Vive en Las Palmas de Gran Canaria.
HECHO: Prefiere respuestas breves y directas.

No expliques nada. No añadas texto fuera de las líneas HECHO:.`;

export interface ConversationTurn {
  user: string;
  assistant: string;
}

/**
 * Devuelve los hechos candidatos del turno. No escribe nada: quien decide qué
 * entra en el fichero es `applyOps`, que aplica las reglas de duplicados y de
 * respeto a lo escrito a mano.
 */
export async function extractFacts(
  turn: ConversationTurn,
  opts: { signal?: AbortSignal } = {}
): Promise<AddFactOp[]> {
  const conversation = `Usuario: ${turn.user.trim()}\n\nAsistente: ${turn.assistant.trim()}`;

  const raw = await generate(
    [
      { role: 'system', content: EXTRACTOR_PROMPT },
      { role: 'user', content: conversation },
    ],
    {
      // Un extractor creativo es un extractor que inventa.
      temperature: 0.1,
      maxTokens: 256,
      signal: opts.signal,
    }
  );

  return parseFacts(raw);
}

/** Separado de la inferencia para poder probarlo sin cargar ningún modelo. */
export function parseFacts(raw: string): AddFactOp[] {
  const facts: AddFactOp[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (/^NINGUNO\b/i.test(trimmed)) break;

    const match = /^[-*\s]*HECHO\s*:\s*(.+)$/i.exec(trimmed);
    if (!match) continue;

    const text = match[1].trim().replace(/^["'«]|["'»]$/g, '');
    // El modelo a veces repite la plantilla o deja el marcador vacío.
    if (!text || /^<.*>$/.test(text)) continue;

    facts.push({ kind: 'add', text, confidence: 0.7 });
    if (facts.length >= MAX_FACTS_PER_TURN) break;
  }

  return facts;
}
