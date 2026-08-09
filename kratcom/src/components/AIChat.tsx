import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation, CustomTerm } from '@/types';
import { createAnonymizer } from '@/lib/anonymizer';
import { extractText } from '@/lib/extractText';
import { buildManualPayload, isAIConfigured, sendToAI } from '@/lib/ai';
import { loadCustomTerms, loadMapping, saveMapping } from '@/lib/vault';
import { TokenText } from '@/components/TokenText';
import {
  EyeIcon,
  EyeOffIcon,
  SendIcon,
  ShieldIcon,
  UploadIcon,
  CloseIcon,
} from '@/components/Icons';

interface AIChatProps {
  conversation: Conversation;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, text: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  onOpenSettings: () => void;
}

interface Attachment {
  name: string;
  text: string;
}

export function AIChat({
  conversation,
  appendMessage,
  updateMessage,
  removeMessage,
  onOpenSettings,
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customTerms, setCustomTerms] = useState<CustomTerm[]>([]);
  const [revealed, setRevealed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modo manual (sin clave de API): payload anonimizado pendiente de llevar
  // a la app de Claude, y respuesta pegada por el usuario.
  const [manualPayload, setManualPayload] = useState<string | null>(null);
  const [manualResponse, setManualResponse] = useState('');
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadMapping(conversation.id).then(m => setMapping(m ?? {}));
    void loadCustomTerms().then(setCustomTerms);
  }, [conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

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
    if ((!trimmed && !attachment) || busy || manualPayload) return;
    setError(null);
    setBusy(true);

    try {
      // 1. Seudonimización local ANTES de que nada salga del dispositivo,
      //    reutilizando los tokens de turnos anteriores de esta conversación.
      const raw = attachment
        ? `${trimmed}\n\nDOCUMENTO ADJUNTO (${attachment.name}):\n${attachment.text}`
        : trimmed;
      const anonymizer = createAnonymizer(customTerms, mapping);
      const anonymized = anonymizer.process(raw);
      const newMapping = anonymizer.getMapping();
      await saveMapping(conversation.id, newMapping);
      setMapping(newMapping);

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: anonymized,
        timestamp: new Date().toISOString(),
        attachmentName: attachment?.name,
      };
      appendMessage(conversation.id, userMessage);
      setInput('');
      setAttachment(null);

      // Sin clave de API: modo manual — se prepara el texto anonimizado para
      // copiarlo/compartirlo a la app de Claude del usuario.
      if (!isAIConfigured()) {
        setManualPayload(buildManualPayload(anonymized));
        setManualNotice(null);
        return;
      }

      const assistantId = `${Date.now()}-a`;
      appendMessage(conversation.id, {
        id: assistantId,
        role: 'assistant',
        text: '',
        timestamp: new Date().toISOString(),
      });

      // 2. La IA solo recibe el historial seudonimizado.
      const history = [...conversation.messages, userMessage]
        .filter(m => m.text.length > 0)
        .map(m => ({ role: m.role, content: m.text }));

      try {
        const finalText = await sendToAI(
          history,
          accumulated => updateMessage(conversation.id, assistantId, accumulated),
          newMapping
        );
        updateMessage(conversation.id, assistantId, finalText);
      } catch (err) {
        removeMessage(conversation.id, assistantId);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setBusy(false);
    }
  };

  const handleManualCopy = async () => {
    if (!manualPayload) return;
    try {
      if (navigator.share) {
        await navigator.share({ text: manualPayload });
        setManualNotice('Compartido. Cuando Claude responda, pega su respuesta abajo.');
      } else {
        await navigator.clipboard.writeText(manualPayload);
        setManualNotice('Copiado. Pégalo en tu app de Claude y trae aquí su respuesta.');
      }
    } catch {
      // el usuario canceló el diálogo de compartir
    }
  };

  const handleManualSave = () => {
    const text = manualResponse.trim();
    if (!text) return;
    appendMessage(conversation.id, {
      id: `${Date.now()}-a`,
      role: 'assistant',
      text,
      timestamp: new Date().toISOString(),
    });
    setManualPayload(null);
    setManualResponse('');
    setManualNotice(null);
  };

  const protectedCount = Object.keys(mapping).length;
  const reveal = revealed ? mapping : null;

  return (
    <div className="flex-1 flex flex-col bg-gray-800 min-h-0">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-700">
        <div className="min-w-0">
          <h1 className="font-bold text-white truncate hidden md:block">{conversation.title}</h1>
          <p className="text-xs text-gray-400 flex items-center">
            <ShieldIcon className="w-3.5 h-3.5 mr-1 text-green-400" />
            {protectedCount === 0
              ? 'Los datos personales se protegen antes de enviar'
              : `${protectedCount} dato${protectedCount === 1 ? '' : 's'} protegido${protectedCount === 1 ? '' : 's'} en esta conversación`}
          </p>
        </div>
        {protectedCount > 0 && (
          <button
            onClick={() => setRevealed(!revealed)}
            className="flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 flex-shrink-0 ml-2"
            title={revealed ? 'Mostrar lo que sale del dispositivo (tokens)' : 'Mostrar datos reales (solo en este dispositivo)'}
          >
            {revealed ? <EyeOffIcon className="w-4 h-4 mr-1" /> : <EyeIcon className="w-4 h-4 mr-1" />}
            {revealed ? 'Ver lo enviado' : 'Ver datos reales'}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10 max-w-md mx-auto space-y-2">
            <ShieldIcon className="w-10 h-10 mx-auto text-green-500" />
            <p className="font-medium text-gray-300">Interfaz privada de IA</p>
            <p>
              Escribe o adjunta un documento. Los datos personales (nombres, DNI, IBAN, teléfonos…)
              se sustituyen por tokens en tu teléfono antes de enviarse; la IA nunca los ve y las
              respuestas se rehidratan localmente.
            </p>
          </div>
        )}

        {conversation.messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
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
              {message.text ? (
                <TokenText text={message.text} revealMapping={reveal} />
              ) : (
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

      {!isAIConfigured() && !manualPayload && (
        <div className="mx-4 mb-2 p-3 bg-amber-900/30 border border-amber-800 rounded-lg text-xs text-amber-100">
          <span className="font-medium">Para que la app responda sola:</span>{' '}
          <button onClick={onOpenSettings} className="underline font-medium">
            configura el motor de IA (⚙️)
          </button>{' '}
          — Gemini es gratis (clave sin tarjeta en 2 min). Mientras tanto, al enviar se activa el
          modo copiar/pegar.
        </div>
      )}

      {manualPayload && (
        <div className="mx-4 mb-2 p-3 bg-gray-900 border border-blue-800 rounded-lg space-y-2">
          <p className="text-sm text-gray-200 font-medium">
            Mensaje anonimizado listo — sin clave de API, el envío es en 2 pasos:
          </p>
          <button
            onClick={() => void handleManualCopy()}
            className="w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium"
          >
            1 · Copiar / compartir a tu app de Claude
          </button>
          {manualNotice && <p className="text-xs text-green-300">{manualNotice}</p>}
          <textarea
            value={manualResponse}
            onChange={e => setManualResponse(e.target.value)}
            placeholder="2 · Pega aquí la respuesta de Claude (con los tokens [[TIPO_n]] intactos)"
            rows={3}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleManualSave}
              disabled={!manualResponse.trim()}
              className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium"
            >
              Guardar respuesta
            </button>
            <button
              onClick={() => {
                setManualPayload(null);
                setManualNotice(null);
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mx-4 mb-2 text-sm text-red-400">{error}</p>}

      {attachment && (
        <div className="mx-4 mb-2 flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
          <span className="truncate">
            📎 {attachment.name}{' '}
            <span className="text-gray-500">
              ({attachment.text.length.toLocaleString('es-ES')} caracteres, extraído localmente)
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
            aria-label="Adjuntar documento (se procesa y anonimiza en el dispositivo)"
          >
            <UploadIcon className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleSend()}
            placeholder="Escribe a la IA (los datos personales se protegen solos)"
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
          <button
            onClick={() => void handleSend()}
            disabled={busy || !!manualPayload || (!input.trim() && !attachment)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-150"
            aria-label="Enviar"
          >
            <SendIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
