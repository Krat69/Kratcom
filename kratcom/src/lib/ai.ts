// Conexión con la IA (API de Claude, SDK oficial de Anthropic ejecutado en el
// navegador). Por diseño, TODO lo que pasa por aquí llega ya seudonimizado:
// los llamantes anonimizan antes de invocar sendToAI, y la clave de API se
// guarda únicamente en este dispositivo.

const CONFIG_KEY = 'kratcom-ai-config';

export interface AIConfig {
  apiKey: string;
  model: string;
}

export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (recomendado)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido)' },
];

const DEFAULT_MODEL = 'claude-opus-5';

export function getAIConfig(): AIConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AIConfig>;
      return { apiKey: parsed.apiKey ?? '', model: parsed.model || DEFAULT_MODEL };
    }
  } catch {
    // config corrupta: se ignora
  }
  return { apiKey: '', model: DEFAULT_MODEL };
}

export function setAIConfig(config: AIConfig): void {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({ apiKey: config.apiKey.trim(), model: config.model || DEFAULT_MODEL })
  );
}

export function isAIConfigured(): boolean {
  return getAIConfig().apiKey.length > 0;
}

const SYSTEM_PROMPT = `Eres el asistente de KratCom, una interfaz privada de IA. El dispositivo del usuario seudonimiza los datos personales antes de enviarte nada: los tokens con formato [[TIPO_n]] (por ejemplo [[PERSONA_1]], [[DNI_2]], [[IBAN_1]]) sustituyen nombres, identificadores, cuentas, direcciones y otros datos personales reales que tú nunca conoces.

Reglas sobre los tokens:
- Consérvalos EXACTAMENTE igual (mismos corchetes, tipo y número) siempre que te refieras a esa persona o dato en tus respuestas; el dispositivo del usuario los restaurará localmente.
- No inventes tokens nuevos ni intentes adivinar los valores reales.
- Trata cada token como un identificador estable: [[PERSONA_1]] es siempre la misma persona dentro de la conversación.

Responde en el idioma del usuario (normalmente español) y sé claro y directo.`;

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Texto para el modo manual (sin clave de API): el usuario lo pega en su
// app de Claude. Si hay tokens, se añade la instrucción de conservarlos.
export function buildManualPayload(anonymizedText: string): string {
  const hasTokens = /\[\[[A-Z_]+_\d+\]\]/.test(anonymizedText);
  if (!hasTokens) return anonymizedText;
  return (
    anonymizedText +
    '\n\n(NOTA: los tokens con formato [[TIPO_n]] sustituyen datos personales ' +
    'seudonimizados en mi dispositivo. Consérvalos EXACTAMENTE igual en tu respuesta.)'
  );
}

// Envía la conversación (ya anonimizada) y devuelve la respuesta completa.
// onText recibe el texto acumulado según llega el streaming.
export async function sendToAI(
  messages: AIMessage[],
  onText?: (accumulated: string) => void
): Promise<string> {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error('Configura tu clave de API de Anthropic en los ajustes (⚙️)');
  }

  // Import diferido: el SDK solo se descarga cuando se usa la IA
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const stream = client.messages.stream({
    model: config.model,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages,
  });

  let accumulated = '';
  stream.on('text', delta => {
    accumulated += delta;
    onText?.(accumulated);
  });

  const final = await stream.finalMessage();

  if (final.stop_reason === 'refusal') {
    throw new Error('La IA ha declinado responder a esta solicitud');
  }

  const text = final.content
    .filter((block): block is Extract<(typeof final.content)[number], { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return text || accumulated;
}
