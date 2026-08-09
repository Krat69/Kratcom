// Conexión con la IA. Dos motores:
//  - Google Gemini (franja gratuita real: clave gratis en aistudio.google.com)
//  - Claude (API de Anthropic, SDK oficial, pago por uso)
// Por diseño, TODO lo que pasa por aquí llega ya seudonimizado: los llamantes
// anonimizan antes de invocar sendToAI, y las claves se guardan únicamente en
// este dispositivo.

const CONFIG_KEY = 'kratcom-ai-config';

export type AIProvider = 'gemini' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  geminiKey: string;
  geminiModel: string;
  anthropicKey: string;
  anthropicModel: string;
}

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (gratis, recomendado)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (mejor, franja gratuita menor)' },
];

export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (máxima calidad)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (el más barato)' },
];

const DEFAULTS: AIConfig = {
  provider: 'gemini',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  anthropicKey: '',
  anthropicModel: 'claude-opus-5',
};

export function getAIConfig(): AIConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AIConfig> & { apiKey?: string; model?: string };
      const config: AIConfig = { ...DEFAULTS, ...parsed };
      // Migración del formato antiguo {apiKey, model} (solo Anthropic)
      if (parsed.apiKey && !parsed.anthropicKey) {
        config.anthropicKey = parsed.apiKey;
        config.anthropicModel = parsed.model || DEFAULTS.anthropicModel;
        config.provider = 'anthropic';
      }
      return config;
    }
  } catch {
    // config corrupta: se ignora
  }
  return { ...DEFAULTS };
}

export function setAIConfig(config: AIConfig): void {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      ...config,
      geminiKey: config.geminiKey.trim(),
      anthropicKey: config.anthropicKey.trim(),
    })
  );
}

export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return config.provider === 'gemini' ? !!config.geminiKey : !!config.anthropicKey;
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

// Texto para el modo manual (sin motor configurado): el usuario lo pega en su
// app de IA. Si hay tokens, se añade la instrucción de conservarlos.
export function buildManualPayload(anonymizedText: string): string {
  const hasTokens = /\[\[[A-Z_]+_\d+\]\]/.test(anonymizedText);
  if (!hasTokens) return anonymizedText;
  return (
    anonymizedText +
    '\n\n(NOTA: los tokens con formato [[TIPO_n]] sustituyen datos personales ' +
    'seudonimizados en mi dispositivo. Consérvalos EXACTAMENTE igual en tu respuesta.)'
  );
}

async function sendToGemini(
  messages: AIMessage[],
  config: AIConfig,
  onText?: (accumulated: string) => void
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      }),
    });
  } catch {
    throw new Error('No se pudo conectar con Gemini — revisa tu conexión a internet');
  }

  if (!response.ok) {
    let detail = `error ${response.status}`;
    try {
      const err = await response.json();
      detail = err?.error?.message ?? detail;
    } catch {
      // sin cuerpo JSON
    }
    if (response.status === 429) {
      throw new Error('Límite gratuito de Gemini alcanzado; espera un minuto y reintenta');
    }
    throw new Error(`Gemini: ${detail}`);
  }

  const data = await response.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('') ?? '';

  if (!text) {
    const reason = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason;
    throw new Error(
      reason ? `La IA declinó responder (${reason})` : 'La IA devolvió una respuesta vacía'
    );
  }

  onText?.(text);
  return text;
}

async function sendToClaude(
  messages: AIMessage[],
  config: AIConfig,
  onText?: (accumulated: string) => void
): Promise<string> {
  // Import diferido: el SDK solo se descarga cuando se usa Claude
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: config.anthropicKey,
    dangerouslyAllowBrowser: true,
  });

  const stream = client.messages.stream({
    model: config.anthropicModel,
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

// Envía la conversación (ya anonimizada) al motor configurado y devuelve la
// respuesta completa. onText recibe el texto acumulado (streaming en Claude;
// en Gemini llega de una vez al final).
export async function sendToAI(
  messages: AIMessage[],
  onText?: (accumulated: string) => void
): Promise<string> {
  const config = getAIConfig();
  if (config.provider === 'gemini') {
    if (!config.geminiKey) {
      throw new Error('Configura tu clave gratuita de Gemini en los ajustes (⚙️)');
    }
    return sendToGemini(messages, config, onText);
  }
  if (!config.anthropicKey) {
    throw new Error('Configura tu clave de API de Anthropic en los ajustes (⚙️)');
  }
  return sendToClaude(messages, config, onText);
}
