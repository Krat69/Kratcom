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

// Modelos GGUF oficiales servidos desde Hugging Face (solo DESCARGA de pesos
// públicos: ningún dato del usuario viaja en esa petición). Se cachean en el
// navegador tras la primera descarga.
export const LOCAL_MODELS = [
  {
    id: 'qwen2.5-0.5b',
    label: 'Qwen 2.5 0.5B (~470 MB — cualquier móvil)',
    sizeLabel: '470 MB',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  },
  {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B (~1,1 GB — móviles potentes)',
    sizeLabel: '1,1 GB',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
  },
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
  localModel: 'qwen2.5-0.5b',
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

// ¿Soporta este navegador la IA 100% local? (WebAssembly: cualquier
// navegador moderno de móvil u ordenador lo tiene)
export function isLocalAISupported(): boolean {
  return typeof WebAssembly !== 'undefined';
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

// Motor 100% local (wllama: llama.cpp compilado a WebAssembly). Corre por
// CPU en cualquier navegador moderno — sin WebGPU, sin requisitos de
// hardware. El modelo se descarga una vez, se cachea en el navegador y la
// inferencia ocurre íntegramente en el dispositivo. Como nada sale del
// teléfono, trabaja con los datos REALES (rehidratados con el mapeo) — un
// modelo pequeño se maneja mejor con texto natural que con tokens — y la
// respuesta se vuelve a seudonimizar antes de devolverla, para que el
// almacenamiento siga sin datos en claro.
const LOCAL_SYSTEM_PROMPT =
  'Eres un asistente útil, claro y conciso. Responde siempre en el idioma del usuario (normalmente español).';

// Límite prudente para el contexto reducido del modelo local (n_ctx 2048)
const LOCAL_MAX_CHARS = 6000;

let localEngine: { modelId: string; wllama: InstanceType<typeof import('@wllama/wllama').Wllama> } | null = null;

async function sendToLocal(
  messages: AIMessage[],
  config: AIConfig,
  onText?: (accumulated: string) => void,
  mapping?: Record<string, string>
): Promise<string> {
  if (!isLocalAISupported()) {
    throw new Error(
      'Este navegador no soporta WebAssembly, necesario para la IA local. Alternativa: motor Gemini (gratis) en ajustes.'
    );
  }

  const model = LOCAL_MODELS.find(m => m.id === config.localModel) ?? LOCAL_MODELS[0];

  if (localEngine && localEngine.modelId !== model.id) {
    try {
      await localEngine.wllama.exit();
    } catch {
      // sin consecuencias: se crea un motor nuevo
    }
    localEngine = null;
  }

  if (!localEngine) {
    onText?.('⏳ Preparando la IA local…');
    const [{ Wllama }, { default: wasmUrl }] = await Promise.all([
      import('@wllama/wllama'),
      import('@wllama/wllama/esm/wasm/wllama.wasm?url'),
    ]);
    const wllama = new Wllama({ default: wasmUrl }, { suppressNativeLog: true });
    await wllama.loadModelFromUrl(model.url, {
      n_ctx: 2048,
      progressCallback: ({ loaded, total }) => {
        const percent = total ? Math.round((loaded / total) * 100) : 0;
        onText?.(
          `⏳ Descargando el modelo local… ${percent}%\n(~${model.sizeLabel}, solo la primera vez; después queda guardado en el dispositivo)`
        );
      },
    });
    localEngine = { modelId: model.id, wllama };
  }

  const prepared = (mapping
    ? messages.map(m => ({ ...m, content: deanonymize(m.content, mapping) }))
    : [...messages]
  ).map(m =>
    m.content.length > LOCAL_MAX_CHARS
      ? { ...m, content: m.content.slice(0, LOCAL_MAX_CHARS) + '\n[…texto recortado para el modelo local…]' }
      : m
  );

  onText?.('⏳ Pensando…');
  const chunks = await localEngine.wllama.createChatCompletion({
    messages: [{ role: 'system', content: LOCAL_SYSTEM_PROMPT }, ...prepared],
    stream: true,
    max_tokens: 800,
    temperature: 0.7,
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
