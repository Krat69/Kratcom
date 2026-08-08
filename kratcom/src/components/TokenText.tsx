import type { PiiType } from '@/types';
import { tokenType } from '@/lib/anonymizer';

const TOKEN_SPLIT_REGEX = /(\[\[[A-Z_]+_\d+\]\])/g;

const TYPE_STYLES: Record<PiiType, string> = {
  PERSONA: 'bg-purple-900 text-purple-200 border-purple-600',
  DNI: 'bg-red-900 text-red-200 border-red-600',
  NIE: 'bg-red-900 text-red-200 border-red-600',
  NIF_EMPRESA: 'bg-orange-900 text-orange-200 border-orange-600',
  NUSS: 'bg-red-900 text-red-200 border-red-600',
  IBAN: 'bg-amber-900 text-amber-200 border-amber-600',
  TARJETA: 'bg-amber-900 text-amber-200 border-amber-600',
  TELEFONO: 'bg-teal-900 text-teal-200 border-teal-600',
  EMAIL: 'bg-sky-900 text-sky-200 border-sky-600',
  MATRICULA: 'bg-lime-900 text-lime-200 border-lime-600',
  REF_CATASTRAL: 'bg-lime-900 text-lime-200 border-lime-600',
  DIRECCION: 'bg-emerald-900 text-emerald-200 border-emerald-600',
  CP: 'bg-emerald-900 text-emerald-200 border-emerald-600',
  FECHA_NACIMIENTO: 'bg-pink-900 text-pink-200 border-pink-600',
  PROTEGIDO: 'bg-indigo-900 text-indigo-200 border-indigo-600',
};

export const TYPE_LABELS: Record<PiiType, string> = {
  PERSONA: 'Persona',
  DNI: 'DNI',
  NIE: 'NIE',
  NIF_EMPRESA: 'NIF empresa',
  NUSS: 'Nº Seg. Social',
  IBAN: 'IBAN',
  TARJETA: 'Tarjeta',
  TELEFONO: 'Teléfono',
  EMAIL: 'Email',
  MATRICULA: 'Matrícula',
  REF_CATASTRAL: 'Ref. catastral',
  DIRECCION: 'Dirección',
  CP: 'Cód. postal',
  FECHA_NACIMIENTO: 'F. nacimiento',
  PROTEGIDO: 'Protegido',
};

interface TokenTextProps {
  text: string;
  // Si se pasa un mapeo, los tokens se muestran con su valor real
  // (rehidratación SOLO en pantalla, nunca en lo que se envía).
  revealMapping?: Record<string, string> | null;
}

export function TokenText({ text, revealMapping }: TokenTextProps) {
  const parts = text.split(TOKEN_SPLIT_REGEX);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (!TOKEN_SPLIT_REGEX.test(part)) {
          TOKEN_SPLIT_REGEX.lastIndex = 0;
          return <span key={index}>{part}</span>;
        }
        TOKEN_SPLIT_REGEX.lastIndex = 0;
        const type = tokenType(part);
        const revealed = revealMapping?.[part];
        return (
          <span
            key={index}
            title={revealed ? part : TYPE_LABELS[type]}
            className={`inline-block px-1.5 py-0.5 mx-0.5 rounded border text-xs font-mono align-baseline ${TYPE_STYLES[type]}`}
          >
            {revealed ?? `${TYPE_LABELS[type]} ${part.match(/_(\d+)\]\]$/)?.[1] ?? ''}`}
          </span>
        );
      })}
    </span>
  );
}
