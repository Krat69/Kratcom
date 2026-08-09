import type { Task } from '@/types';
import { generate } from '@/lib/engine';
import { deanonymize, reapplyTokens } from '@/lib/anonymizer';
import { loadMapping } from '@/lib/vault';

// Ejecución de una tarea con la IA del propio dispositivo.
//
// Las tareas se guardan seudonimizadas (los valores reales viven cifrados en
// la bóveda), y eso se mantiene: sigue siendo útil para poder compartir o
// exportar una tarea sin destapar datos personales. Como la inferencia ocurre
// aquí dentro, el modelo sí trabaja con el texto real —un modelo pequeño se
// maneja mucho peor con tokens como [[PERSONA_1]] que con nombres— y la
// respuesta se vuelve a seudonimizar antes de guardarla.

const TASK_PROMPT =
  'Eres el asistente de KratCom y trabajas dentro del dispositivo del usuario. ' +
  'Resuelve la tarea que se te encarga sobre el documento adjunto, en español, ' +
  'de forma concreta y sin rodeos. No inventes datos que no estén en el documento.';

export function buildTaskPrompt(task: Task): string {
  return [
    `TAREA: ${task.title}`,
    '',
    'INSTRUCCIONES:',
    task.instructions,
    task.documentText
      ? `\nDOCUMENTO (${task.documentName ?? 'adjunto'}):\n${task.documentText}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface TaskRunResult {
  /** Respuesta ya seudonimizada, lista para guardarse en la tarea. */
  responseText: string;
}

export async function runTaskLocally(
  task: Task,
  opts: { onText?: (accumulated: string) => void; signal?: AbortSignal } = {}
): Promise<TaskRunResult> {
  const mapping = (await loadMapping(task.id)) ?? {};
  const prompt = deanonymize(buildTaskPrompt(task), mapping);

  const answer = await generate(
    [
      { role: 'system', content: TASK_PROMPT },
      { role: 'user', content: prompt },
    ],
    {
      maxTokens: 900,
      signal: opts.signal,
      onToken: accumulated => opts.onText?.(reapplyTokens(accumulated, mapping)),
    }
  );

  return { responseText: reapplyTokens(answer, mapping) };
}
