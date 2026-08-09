import type { Task } from '@/types';
import { isAIConfigured, sendToAI } from '@/lib/ai';

// Frontera de salida de la aplicación: esta es la ÚNICA función que envía
// contenido de tareas fuera del dispositivo, y solo recibe el objeto Task,
// que por construcción contiene únicamente texto ya seudonimizado (los
// valores reales viven en la bóveda cifrada y jamás pasan por aquí).

const ENDPOINT_KEY = 'kratcom-task-endpoint';

export function getEndpoint(): string {
  return localStorage.getItem(ENDPOINT_KEY) ?? '';
}

export function setEndpoint(url: string): void {
  if (url.trim()) {
    localStorage.setItem(ENDPOINT_KEY, url.trim());
  } else {
    localStorage.removeItem(ENDPOINT_KEY);
  }
}

export function buildOutboundPayload(task: Task): string {
  const legend = task.entities
    .map(e => `- ${e.token}: ${e.type.replace(/_/g, ' ').toLowerCase()} (seudonimizado)`)
    .join('\n');

  return [
    `TAREA: ${task.title}`,
    '',
    'INSTRUCCIONES:',
    task.instructions,
    task.documentText ? `\nDOCUMENTO (${task.documentName ?? 'adjunto'}):\n${task.documentText}` : '',
    task.entities.length
      ? `\nNOTA: los tokens [[TIPO_n]] sustituyen datos personales seudonimizados en origen. ` +
        `Consérvalos EXACTAMENTE igual en tu respuesta; se restaurarán en el dispositivo del remitente.\n${legend}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export type DispatchMethod = 'ai' | 'webhook' | 'share' | 'clipboard';

export interface DispatchResult {
  method: DispatchMethod;
  detail: string;
  // Presente solo en modo 'ai': la respuesta (aún seudonimizada) de la IA.
  responseText?: string;
}

export async function dispatchTask(task: Task): Promise<DispatchResult> {
  const payload = buildOutboundPayload(task);
  const endpoint = getEndpoint();

  if (isAIConfigured()) {
    const responseText = await sendToAI([{ role: 'user', content: payload }]);
    return { method: 'ai', detail: 'Procesada por la IA', responseText };
  }

  if (endpoint) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        payload,
        tokens: task.entities.map(e => ({ token: e.token, type: e.type })),
      }),
    });
    if (!response.ok) {
      throw new Error(`El endpoint respondió ${response.status}`);
    }
    return { method: 'webhook', detail: `Enviada al endpoint configurado (${response.status})` };
  }

  if (navigator.share) {
    await navigator.share({ title: task.title, text: payload });
    return { method: 'share', detail: 'Compartida con la app que elegiste' };
  }

  await navigator.clipboard.writeText(payload);
  return { method: 'clipboard', detail: 'Copiada al portapapeles (versión anonimizada)' };
}
