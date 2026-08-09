// Conexión con la IA. Dos motores:
//  - Google Gemini (franja gratuita real: clave gratis en aistudio.google.com)
//  - Claude (API de Anthropic, SDK oficial, pago por uso)
// Por diseño, TODO lo que pasa por aquí llega ya seudonimizado: los llamantes
// anonimizan antes de invocar sendToAI, y las claves se guardan únicamente en
// este dispositivo.

import { deanonymize, reapplyTokens } from '@/lib/anonymizer';

const CONFIG_KEY = 'kratcom-ai-config';

export type AIProvider = 'local' | 'gemini' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  localModel: string;
  geminiKey: string;
  geminiModel: string;
  anthropicKey: string;
  anthropicModel: string;
}

export const LOCAL_MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (~0,9 GB, recomendado)' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B (~1,6 GB, mejor calidad)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (~2,3 GB, móviles potentes)' },
];

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
  provider: 'local',
  localModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
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
  if (config.provider === 'local') return true; // no necesita clave
  return config.provider === 'gemini' ? !!config.geminiKey : !!config.anthropicKey;
}

// ¿Soporta este navegador la IA 100% local (WebGPU)?
export function isLocalAISupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
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

// Motor 100% local (WebLLM + WebGPU): el modelo se descarga una vez, se
// cachea en el navegador y la inferencia ocurre íntegramente en el
// dispositivo. Como nada sale del teléfono, trabaja con los datos REALES
// (rehidratados con el mapeo) — un modelo pequeño se maneja mejor con texto
// natural que con tokens — y la respuesta se vuelve a seudonimizar antes de
// devolverla, para que el almacenamiento siga sin datos en claro.
const LOCAL_SYSTEM_PROMPT =
  'Eres un asistente útil, claro y conciso. Responde siempre en el idioma del usuario (normalmente español).';

let localEngine: { model: string; engine: { chat: { completions: { create: Function } }; unload?: () => Promise<void> } } | null = null;

async function sendToLocal(
  messages: AIMessage[],
  config: AIConfig,
  onText?: (accumulated: string) => void,
  mapping?: Record<string, string>
): Promise<string> {
  if (!isLocalAISupported()) {
    throw new Error(
      'Este navegador no soporta la IA local (WebGPU). En iPhone necesitas iOS 26 o superior; en Android, Chrome actualizado. Alternativa: motor Gemini (gratis) en ajustes.'
    );
  }

  if (localEngine && localEngine.model !== config.localModel) {
    try {
      await localEngine.engine.unload?.();
    } catch {
      // sin consecuencias: se crea un motor nuevo
    }
    localEngine = null;
  }

  if (!localEngine) {
    const webllm = await import('@mlc-ai/web-llm');
    const engine = await webllm.CreateMLCEngine(config.localModel, {
      initProgressCallback: progress => {
        const percent = Math.round((progress.progress ?? 0) * 100);
        onText?.(
          `⏳ Preparando la IA local… ${percent}%\n(la primera vez descarga el modelo; después queda guardado en el dispositivo)`
        );
      },
    });
    localEngine = { model: config.localModel, engine };
  }

  const rehydrated = mapping
    ? messages.map(m => ({ ...m, content: deanonymize(m.content, mapping) }))
    : messages;

  const chunks = await localEngine.engine.chat.completions.create({
    messages: [{ role: 'system', content: LOCAL_SYSTEM_PROMPT }, ...rehydrated],
    stream: true,
  });

  let accumulated = '';
  for await (const chunk of chunks) {
    accumulated += chunk?.choices?.[0]?.delta?.content ?? '';
    onText?.(mapping ? reapplyTokens(accumulated, mapping) : accumulated);
  }

  if (!accumulated) throw new Error('La IA local devolvió una respuesta vacía');
  return mapping ? reapplyTokens(accumulated, mapping) : accumulated;
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
// respuesta completa (siempre seudonimizada). onText recibe el texto
// acumulado según se genera. mapping (token -> dato real) solo lo usa el
// motor local, que rehidrata en el dispositivo para trabajar con texto
// natural; los motores remotos jamás lo reciben.
export async function sendToAI(
  messages: AIMessage[],
  onText?: (accumulated: string) => void,
  mapping?: Record<string, string>
): Promise<string> {
  const config = getAIConfig();
  if (config.provider === 'local') {
    return sendToLocal(messages, config, onText, mapping);
  }
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
