import type { CustomTerm, DetectedEntity, PiiType } from '@/types';

// Motor de seudonimización 100% local. Detecta datos personales típicos de
// documentación española y los sustituye por tokens estables ([[DNI_1]],
// [[PERSONA_2]]...). El mapeo token -> valor real no sale nunca de este módulo:
// se devuelve al llamante para guardarlo en la bóveda cifrada del dispositivo.
//
// Criterio de diseño: ante la duda, redactar. Un falso positivo cuesta un
// token de más; un falso negativo es una fuga de datos personales.

export interface AnonymizationResult {
  text: string;
  mapping: Record<string, string>;
  entities: DetectedEntity[];
}

interface Detection {
  start: number;
  end: number;
  type: PiiType;
  value: string;
  priority: number;
}

const CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

function isValidDni(digits: string, letter: string): boolean {
  return CONTROL_LETTERS[parseInt(digits, 10) % 23] === letter.toUpperCase();
}

function isValidNie(nie: string): boolean {
  const clean = nie.replace(/[\s-]/g, '').toUpperCase();
  const prefix = { X: '0', Y: '1', Z: '2' }[clean[0]];
  if (!prefix) return false;
  return isValidDni(prefix + clean.slice(1, 8), clean[8]);
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function ibanMod97Valid(iban: string): boolean {
  const clean = iban.replace(/[\s.-]/g, '').toUpperCase();
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= 'A' ? (ch.charCodeAt(0) - 55).toString() : ch;
    remainder = parseInt(String(remainder) + value, 10) % 97;
  }
  return remainder === 1;
}

type Detector = (text: string) => Detection[];

function regexDetector(
  regex: RegExp,
  type: PiiType,
  priority: number,
  options?: {
    group?: number;
    validate?: (match: RegExpExecArray) => boolean;
  }
): Detector {
  return (text: string) => {
    const detections: Detection[] = [];
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      if (options?.validate && !options.validate(match)) continue;
      let start = match.index;
      let value = match[0];
      if (options?.group !== undefined && match[options.group] !== undefined) {
        value = match[options.group];
        start = match.index + match[0].indexOf(value);
      }
      detections.push({ start, end: start + value.length, type, priority, value });
    }
    return detections;
  };
}

// Partícula final suelta ("de", "y"...) tras un nombre capturado: se recorta.
function trimTrailingParticles(value: string): string {
  return value.replace(/\s+(?:de(?:\s+l[ao]s?)?|del|y|e)\s*$/i, '');
}

// Separador entre palabras de un nombre: espacios sin salto de línea, para
// que una secuencia no pueda "saltar" de un párrafo a otro.
const SP = '[^\\S\\n]+';
const NAME_WORD = '(?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+|[A-ZÁÉÍÓÚÑÜ]{2,})';
const NAME_SEQ = `${NAME_WORD}(?:${SP}(?:de${SP}l[ao]s?${SP}${NAME_WORD}|del${SP}${NAME_WORD}|de${SP}${NAME_WORD}|[yeé]${SP}${NAME_WORD}|${NAME_WORD})){0,4}`;

const DETECTORS: Detector[] = [
  regexDetector(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'EMAIL', 100),

  regexDetector(/\b[A-Z]{2}\d{2}(?:[ .-]?[0-9A-Z]{4}){4,7}(?:[ .-]?[0-9A-Z]{1,3})?\b/g, 'IBAN', 95, {
    validate: m => {
      const clean = m[0].replace(/[\s.-]/g, '');
      return clean.length >= 15 && clean.length <= 34 && ibanMod97Valid(m[0]);
    },
  }),

  regexDetector(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, 'TARJETA', 90, {
    validate: m => {
      const digits = m[0].replace(/[ -]/g, '');
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
    },
  }),

  // Nº de afiliación a la Seguridad Social: 12 dígitos (2 provincia + 8 + 2 control)
  regexDetector(/(?<!\d)\d{2}[ /.-]?\d{8}[ /.-]?\d{2}(?!\d)/g, 'NUSS', 85, {
    validate: m => {
      const digits = m[0].replace(/[ /.-]/g, '');
      return parseInt(digits.slice(0, 10), 10) % 97 === parseInt(digits.slice(10), 10);
    },
  }),

  regexDetector(new RegExp(`\\b[XYZ][ -]?\\d{7}[ -]?[${CONTROL_LETTERS}]\\b`, 'gi'), 'NIE', 80, {
    validate: m => isValidNie(m[0]),
  }),

  regexDetector(new RegExp(`(?<!\\d)\\d{8}[ -]?[${CONTROL_LETTERS}]\\b`, 'gi'), 'DNI', 78, {
    validate: m => {
      const clean = m[0].replace(/[\s-]/g, '');
      return isValidDni(clean.slice(0, 8), clean[8]);
    },
  }),

  regexDetector(/\b[ABCDEFGHJKLMNPQRSUVW][ -]?\d{7}[ -]?[0-9A-J]\b/g, 'NIF_EMPRESA', 76),

  regexDetector(/(?<!\d)(?:\+34|0034)?[ .-]?[6789](?:[ .-]?\d){8}(?!\d)/g, 'TELEFONO', 70),

  regexDetector(/\b\d{4}[ -]?[BCDFGHJKLMNPRSTVWXYZ]{3}\b/g, 'MATRICULA', 65),

  // Referencia catastral: 20 caracteres alfanuméricos, mezcla de letras y dígitos
  regexDetector(/\b[0-9A-Z]{18}[A-Z]{2}\b/g, 'REF_CATASTRAL', 60, {
    validate: m => /\d/.test(m[0]) && /[A-Z]/.test(m[0]),
  }),

  regexDetector(
    /(?:nacid[oa]\s+el\s+|fecha\s+de\s+nacimiento\s*[:\-]?\s*)(\d{1,2}(?:\s+de\s+[a-zñ]+\s+de\s+\d{4}|[/.\-]\d{1,2}[/.\-]\d{2,4}))/gi,
    'FECHA_NACIMIENTO',
    55,
    { group: 1 }
  ),

  regexDetector(/(?:C\.?\s?P\.?|código\s+postal)\s*[:.]?\s*(\d{5})(?!\d)/gi, 'CP', 50, { group: 1 }),

  regexDetector(
    /\b(?:calle|c\/|avda\.?|avenida|plaza|pza\.?|paseo|camino|carretera|ctra\.?|urbanizaci[oó]n|urb\.?|pol[ií]gono|travesía|ronda)\s+[^\n,;]{3,60}(?:,\s*(?:n[ºo°]?\.?\s*)?\d+[a-zA-Z]?(?:\s*[,\s]\s*(?:piso\s*)?\d{1,2}\s*[ºo°]?\s*[A-Za-z]?)?)?/gi,
    'DIRECCION',
    45
  ),

  // "D. Juan Pérez", "Doña María de la O", "Sra. GARCÍA LÓPEZ"...
  regexDetector(
    new RegExp(
      `(?:\\b(?:Don|Doña|Sr|Sra|Srta|Excmo|Excma|Ilmo|Ilma)\\.?\\s+|\\bD\\.\\s*|\\bDª\\.?\\s*|\\bDña\\.\\s*)(${NAME_SEQ})`,
      'g'
    ),
    'PERSONA',
    40,
    { group: 1 }
  ),

  // "JUAN PÉREZ GARCÍA, con DNI/NIF/NIE ..." — patrón habitual en escritos legales
  regexDetector(
    new RegExp(
      `(?<![\\p{L}\\p{N}])(${NAME_SEQ})\\s*,?\\s+(?:con|titular\\s+del?|provist[oa]\\s+del?)\\s+(?:D\\.?N\\.?I|N\\.?I\\.?[FE])`,
      'gu'
    ),
    'PERSONA',
    42,
    { group: 1 }
  ),
];

function detectCustomTerms(text: string, terms: CustomTerm[]): Detection[] {
  const detections: Detection[] = [];
  for (const term of terms) {
    const value = term.value.trim();
    if (value.length < 2) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      detections.push({
        start: match.index,
        end: match.index + match[0].length,
        type: term.type,
        value: match[0],
        priority: 110,
      });
    }
  }
  return detections;
}

function normalizeValue(type: PiiType, value: string): string {
  switch (type) {
    case 'EMAIL':
      return value.toLowerCase();
    case 'PERSONA':
    case 'DIRECCION':
    case 'PROTEGIDO':
      return value.toLowerCase().replace(/\s+/g, ' ').trim();
    default:
      return value.toUpperCase().replace(/[\s./-]/g, '');
  }
}

const TOKEN_REGEX = /\[\[([A-Z_]+)_(\d+)\]\]/g;

export function createAnonymizer(
  customTerms: CustomTerm[] = [],
  // Mapeo previo (p. ej. de turnos anteriores de una conversación) para que
  // el mismo dato reciba siempre el mismo token.
  initialMapping: Record<string, string> = {}
) {
  const mapping: Record<string, string> = {};
  const tokenByValue = new Map<string, string>();
  const counters: Partial<Record<PiiType, number>> = {};
  const occurrences = new Map<string, number>();

  for (const [token, value] of Object.entries(initialMapping)) {
    const type = tokenType(token);
    const numberMatch = /_(\d+)\]\]$/.exec(token);
    const n = numberMatch ? parseInt(numberMatch[1], 10) : 0;
    counters[type] = Math.max(counters[type] ?? 0, n);
    mapping[token] = value;
    tokenByValue.set(`${type}:${normalizeValue(type, value)}`, token);
  }

  function tokenFor(type: PiiType, value: string): string {
    const key = `${type}:${normalizeValue(type, value)}`;
    const existing = tokenByValue.get(key);
    if (existing) return existing;
    const n = (counters[type] ?? 0) + 1;
    counters[type] = n;
    const token = `[[${type}_${n}]]`;
    tokenByValue.set(key, token);
    mapping[token] = value;
    return token;
  }

  function process(text: string): string {
    if (!text) return text;
    const all: Detection[] = [
      ...detectCustomTerms(text, customTerms),
      ...DETECTORS.flatMap(detect => detect(text)),
    ];

    // Resolución de solapamientos: gana la detección de mayor prioridad;
    // a igualdad, la más larga.
    all.sort((a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start));
    const kept: Detection[] = [];
    for (const d of all) {
      if (kept.some(k => d.start < k.end && k.start < d.end)) continue;
      if (d.type === 'PERSONA') d.value = trimTrailingParticles(d.value);
      kept.push({ ...d, end: d.start + d.value.length });
    }

    kept.sort((a, b) => b.start - a.start);
    let result = text;
    for (const d of kept) {
      const token = tokenFor(d.type, d.value);
      occurrences.set(token, (occurrences.get(token) ?? 0) + 1);
      result = result.slice(0, d.start) + token + result.slice(d.end);
    }
    return result;
  }

  function getEntities(): DetectedEntity[] {
    return Object.keys(mapping).map(token => {
      const parsed = TOKEN_REGEX.exec(token);
      TOKEN_REGEX.lastIndex = 0;
      return {
        token,
        type: (parsed ? parsed[1] : 'PROTEGIDO') as PiiType,
        count: occurrences.get(token) ?? 0,
      };
    });
  }

  return {
    process,
    getEntities,
    getMapping: () => ({ ...mapping }),
  };
}

export function anonymize(text: string, customTerms: CustomTerm[] = []): AnonymizationResult {
  const anonymizer = createAnonymizer(customTerms);
  const result = anonymizer.process(text);
  return { text: result, mapping: anonymizer.getMapping(), entities: anonymizer.getEntities() };
}

export function deanonymize(text: string, mapping: Record<string, string>): string {
  return text.replace(TOKEN_REGEX, match => mapping[match] ?? match);
}

export function tokenType(token: string): PiiType {
  const m = /\[\[([A-Z_]+)_\d+\]\]/.exec(token);
  return (m ? m[1] : 'PROTEGIDO') as PiiType;
}
