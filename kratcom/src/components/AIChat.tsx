import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation } from '@/types';
import { extractText } from '@/lib/extractText';
import { generate } from '@/lib/engine';
import { getEngineConfig } from '@/lib/engine/config';
import { buildTurnContext, consolidateTurn } from '@/lib/memory';
import type { MemoryContext } from '@/lib/memory';
import { EngineStatusBanner } from '@/components/EngineStatus';
import { BookIcon, CloseIcon, SendIcon, ShieldIcon, UploadIcon } from '@/components/Icons';

interface AIChatProps {
  conversation: Conversation;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, text: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
}

interface Attachment {
  name: string;
  text: string;
}

const SYSTEM_PROMPT =
  'Eres el asistente de KratCom. Funcionas íntegramente dentro del dispositivo del usuario: ' +
  'nada de lo que os decís sale de aquí. Responde en el idioma del usuario (normalmente español), ' +
  'de forma clara, directa y sin rodeos.';

// Historial que se manda al modelo. La ventana de un modelo pequeño es corta,
// así que solo viajan los últimos turnos: lo anterior ya vive en la memoria.
const HISTORY_TURNS = 6;

export function AIChat({
  conversation,
  appendMessage,
  updateMessage,
  removeMessage,
  onOpenSettings,
  onOpenMemory,
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastContext, setLastContext] = useState<MemoryContext | null>(null);
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const text = await extractText(file);
      setAttachment({ name: file.name, text });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el documento');
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachment) || busy) return;
    setError(null);
    setMemoryNotice(null);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const prompt = attachment
      ? `${trimmed}\n\nDOCUMENTO ADJUNTO (${attachment.name}):\n${attachment.text}`
      : trimmed;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: prompt,
      timestamp: new Date().toISOString(),
      attachmentName: attachment?.name,
    };
    appendMessage(conversation.id, userMessage);
    setInput('');
    setAttachment(null);

    const assistantId = `${Date.now()}-a`;
    appendMessage(conversation.id, {
      id: assistantId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
    });

    try {
      // 1. Qué recordamos de este usuario, dentro del presupuesto de contexto.
      const context = await buildTurnContext(trimmed || prompt);
      setLastContext(context);

      const history = [...conversation.messages, userMessage]
        .filter(m => m.text.length > 0)
        .slice(-HISTORY_TURNS * 2)
        .map(m => ({ role: m.role, content: m.text }));

      const system = context.text ? `${SYSTEM_PROMPT}\n\n${context.text}` : SYSTEM_PROMPT;

      // 2. Inferencia, siempre en este dispositivo.
      const answer = await generate(
        [{ role: 'system', content: system }, ...history],
        {
          maxTokens: 640,
          signal: controller.signal,
          onToken: accumulated => updateMessage(conversation.id, assistantId, accumulated),
        }
      );
      updateMessage(conversation.id, assistantId, answer);

      // 3. Consolidación: el diario siempre, los hechos según los ajustes. Si
      //    falla, la conversación ya está a salvo y solo se pierde la nota.
      const mode = getEngineConfig().memoryMode;
      if (mode !== 'off') {
        void consolidateTurn(
          { user: prompt, assistant: answer },
          { signal: controller.signal, dryRun: mode === 'confirmar' }
        )
          .then(result => {
            const added = result.merge.added.length;
            if (added > 0) {
              setMemoryNotice(
                mode === 'confirmar'
                  ? `${added} dato${added === 1 ? '' : 's'} por confirmar en la memoria`
                  : `Anotado en la memoria: ${result.merge.added.map(e => e.text).join(' · ')}`
              );
            }
          })
          .catch(() => {
            // La memoria es un extra: si el extractor falla, el chat sigue.
          });
      }
    } catch (err) {
      removeMessage(conversation.id, assistantId);
      setError(err instanceof Error ? err.message : 'No se pudo generar la respuesta');
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const handleStop = () => abortRef.current?.abort();

  return (
    <div className="flex-1 flex flex-col bg-gray-800 min-h-0">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-700">
        <div className="min-w-0">
          <h1 className="font-bold text-white truncate hidden md:block">{conversation.title}</h1>
          <p className="text-xs text-gray-400 flex items-center">
            <ShieldIcon className="w-3.5 h-3.5 mr-1 text-green-400 flex-shrink-0" />
            IA en el dispositivo · sin conexión
          </p>
        </div>
        <button
          onClick={onOpenMemory}
          className="flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 flex-shrink-0 ml-2"
          title="Ver y editar lo que la app recuerda"
        >
          <BookIcon className="w-4 h-4 mr-1" />
          {lastContext && lastContext.factsUsed > 0
            ? `Recuerda ${lastContext.factsUsed}`
            : 'Memoria'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10 max-w-md mx-auto space-y-2">
            <ShieldIcon className="w-10 h-10 mx-auto text-green-500" />
            <p className="font-medium text-gray-300">IA privada, en tu teléfono</p>
            <p>
              El modelo se ejecuta con el procesador de este dispositivo. No hay servidores, no hay
              cuentas y no hay nada que salga de aquí. Lo importante de lo que hables se irá
              guardando en un fichero <code className="text-gray-300">memoria.md</code> que puedes
              leer y editar cuando quieras.
            </p>
          </div>
        )}

        {conversation.messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-700 text-gray-100 rounded-bl-md'
              }`}
            >
              {message.attachmentName && (
                <p className={`text-xs mb-1 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                  📎 {message.attachmentName}
                </p>
              )}
              {message.text || (
                <span className="inline-flex gap-1 py-1" aria-label="La IA está escribiendo">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <EngineStatusBanner onOpenSettings={onOpenSettings} />

      {memoryNotice && (
        <button
          onClick={onOpenMemory}
          className="mx-4 mb-2 p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 text-left flex items-start hover:border-gray-600"
        >
          <BookIcon className="w-4 h-4 mr-2 flex-shrink-0 text-green-400" />
          <span>{memoryNotice}</span>
        </button>
      )}

      {error && <p className="mx-4 mb-2 text-sm text-red-400">{error}</p>}

      {attachment && (
        <div className="mx-4 mb-2 flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
          <span className="truncate">
            📎 {attachment.name}{' '}
            <span className="text-gray-500">
              ({attachment.text.length.toLocaleString('es-ES')} caracteres, leídos en el dispositivo)
            </span>
          </span>
          <button
            onClick={() => setAttachment(null)}
            className="p-1 text-gray-400 hover:text-white flex-shrink-0"
            aria-label="Quitar adjunto"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.json,.html,.htm,.xml,.log,text/*,application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200"
            aria-label="Adjuntar documento (se lee en el dispositivo)"
          >
            <UploadIcon className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleSend()}
            placeholder="Escribe a la IA de tu teléfono"
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
          {busy ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
              aria-label="Detener la generación"
            >
              Parar
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() && !attachment}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-150"
              aria-label="Enviar"
            >
              <SendIcon className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
