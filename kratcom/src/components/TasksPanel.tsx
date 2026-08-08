import React, { useEffect, useRef, useState } from 'react';
import type { CustomTerm, DetectedEntity, Task } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { createAnonymizer, deanonymize } from '@/lib/anonymizer';
import { extractText } from '@/lib/extractText';
import { dispatchTask, getEndpoint, setEndpoint } from '@/lib/dispatch';
import { loadCustomTerms, loadMapping, saveCustomTerms, saveMapping } from '@/lib/vault';
import { TokenText, TYPE_LABELS } from '@/components/TokenText';
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  GearIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/Icons';

const STATUS_STYLES: Record<Task['status'], string> = {
  borrador: 'bg-gray-600 text-gray-200',
  enviada: 'bg-blue-600 text-blue-100',
  completada: 'bg-green-700 text-green-100',
};

function PrivacyBanner() {
  return (
    <div className="flex items-start bg-green-900/40 border border-green-700 rounded-lg p-3 text-sm text-green-200">
      <ShieldIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
      <p>
        Los datos personales detectados se han sustituido por tokens <em>antes</em> de salir del
        teléfono. Los valores reales quedan cifrados en la bóveda local de este dispositivo y solo
        tú puedes verlos.
      </p>
    </div>
  );
}

function EntityLegend({
  entities,
  mapping,
}: {
  entities: DetectedEntity[];
  mapping?: Record<string, string> | null;
}) {
  if (entities.length === 0) {
    return <p className="text-sm text-gray-400">No se detectaron datos personales.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entities.map(entity => (
        <span
          key={entity.token}
          className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-700 text-xs text-gray-200"
        >
          <span className="font-mono mr-1">{entity.token}</span>
          {TYPE_LABELS[entity.type]}
          {mapping?.[entity.token] ? (
            <span className="ml-1 text-amber-300">= {mapping[entity.token]}</span>
          ) : (
            entity.count > 1 && <span className="ml-1 text-gray-400">×{entity.count}</span>
          )}
        </span>
      ))}
    </div>
  );
}

interface ComposerResult {
  instructions: string;
  documentText?: string;
  documentName?: string;
  entities: DetectedEntity[];
  mapping: Record<string, string>;
}

function TaskComposer({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (title: string, result: ComposerResult, send: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [docName, setDocName] = useState<string | null>(null);
  const [docText, setDocText] = useState<string | null>(null);
  const [customTerms, setCustomTerms] = useState<CustomTerm[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [processed, setProcessed] = useState<ComposerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadCustomTerms().then(setCustomTerms);
  }, []);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await extractText(file);
      setDocName(file.name);
      setDocText(text);
      setProcessed(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el documento');
    } finally {
      setBusy(false);
    }
  };

  const runAnonymizer = (terms: CustomTerm[]): ComposerResult => {
    const anonymizer = createAnonymizer(terms);
    const anonInstructions = anonymizer.process(instructions.trim());
    const anonDoc = docText ? anonymizer.process(docText) : undefined;
    return {
      instructions: anonInstructions,
      documentText: anonDoc,
      documentName: docName ?? undefined,
      entities: anonymizer.getEntities(),
      mapping: anonymizer.getMapping(),
    };
  };

  const handleProcess = () => {
    setError(null);
    setProcessed(runAnonymizer(customTerms));
  };

  const handleAddTerm = async () => {
    const value = newTerm.trim();
    if (value.length < 2) return;
    const terms: CustomTerm[] = [...customTerms, { value, type: 'PROTEGIDO' }];
    setCustomTerms(terms);
    setNewTerm('');
    await saveCustomTerms(terms);
    setProcessed(runAnonymizer(terms));
  };

  const handleSave = async (send: boolean) => {
    if (!processed) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(title.trim() || 'Tarea sin título', processed, send);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tarea');
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center">
        <button onClick={onCancel} className="p-2 mr-2 text-gray-300 hover:text-white" aria-label="Volver">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-white">Nueva tarea privada</h2>
      </div>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título de la tarea"
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
      />

      <textarea
        value={instructions}
        onChange={e => {
          setInstructions(e.target.value);
          setProcessed(null);
        }}
        placeholder="¿Qué necesitas que se haga? (p. ej. «Resume este contrato y señala riesgos»)"
        rows={4}
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
      />

      <div>
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
          className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200 text-sm"
        >
          <UploadIcon className="w-4 h-4 mr-2" />
          {docName ? `Documento: ${docName}` : 'Adjuntar documento (se procesa en el teléfono)'}
        </button>
        {docText !== null && (
          <p className="text-xs text-gray-400 mt-1">
            {docText.length.toLocaleString('es-ES')} caracteres extraídos localmente.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!processed ? (
        <button
          onClick={handleProcess}
          disabled={busy || (!instructions.trim() && !docText)}
          className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium"
        >
          <ShieldIcon className="w-5 h-5 mr-2" />
          Anonimizar y revisar antes de enviar
        </button>
      ) : (
        <div className="space-y-4">
          <PrivacyBanner />

          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
              {processed.entities.length} dato{processed.entities.length === 1 ? '' : 's'} protegido
              {processed.entities.length === 1 ? '' : 's'}
            </h3>
            <EntityLegend entities={processed.entities} />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={e => setNewTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleAddTerm()}
              placeholder="Proteger otro término (nombre, empresa...)"
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => void handleAddTerm()}
              disabled={newTerm.trim().length < 2}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200"
              aria-label="Añadir término protegido"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
              Esto es lo único que saldrá del teléfono
            </h3>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 max-h-64 overflow-y-auto">
              {processed.instructions && <TokenText text={processed.instructions} />}
              {processed.documentText && (
                <>
                  <hr className="my-2 border-gray-700" />
                  <TokenText text={processed.documentText} />
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void handleSave(false)}
              disabled={busy}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-white font-medium"
            >
              Guardar borrador
            </button>
            <button
              onClick={() => void handleSave(true)}
              disabled={busy}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-medium"
            >
              {busy ? 'Enviando…' : 'Enviar (anonimizada)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDetail({
  task,
  initialNotice,
  onBack,
  onUpdate,
  onDelete,
  onSend,
}: {
  task: Task;
  initialNotice?: string | null;
  onBack: () => void;
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onSend: () => Promise<string | null>;
}) {
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [responseDraft, setResponseDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadMapping(task.id).then(setMapping);
  }, [task.id]);

  const reveal = revealed ? mapping : null;

  const handleSend = async () => {
    setBusy(true);
    setNotice(null);
    const failure = await onSend();
    setBusy(false);
    setNotice(failure ?? 'Tarea enviada sin datos personales.');
  };

  const handleSaveResponse = () => {
    if (!responseDraft.trim()) return;
    onUpdate({ response: responseDraft.trim(), status: 'completada' });
    setResponseDraft('');
  };

  const handleCopyRestored = async () => {
    if (!task.response || !mapping) return;
    await navigator.clipboard.writeText(deanonymize(task.response, mapping));
    setNotice('Respuesta con datos reales copiada (solo en este dispositivo).');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <button onClick={onBack} className="p-2 mr-2 text-gray-300 hover:text-white flex-shrink-0" aria-label="Volver">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-white truncate">{task.title}</h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[task.status]}`}>
            {task.status}
          </span>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400"
            aria-label="Eliminar tarea y su mapeo cifrado"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <EntityLegend entities={task.entities} mapping={reveal} />
        {task.entities.length > 0 && (
          <button
            onClick={() => setRevealed(!revealed)}
            disabled={!mapping}
            className="flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-gray-200 flex-shrink-0 ml-2"
            title="La rehidratación ocurre solo en pantalla, en este dispositivo"
          >
            {revealed ? <EyeOffIcon className="w-4 h-4 mr-1" /> : <EyeIcon className="w-4 h-4 mr-1" />}
            {revealed ? 'Ocultar datos' : 'Ver datos reales'}
          </button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
          Contenido enviado {task.documentName ? `· ${task.documentName}` : ''}
        </h3>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 max-h-64 overflow-y-auto">
          <TokenText text={task.instructions} revealMapping={reveal} />
          {task.documentText && (
            <>
              <hr className="my-2 border-gray-700" />
              <TokenText text={task.documentText} revealMapping={reveal} />
            </>
          )}
        </div>
      </div>

      {task.status === 'borrador' && (
        <button
          onClick={() => void handleSend()}
          disabled={busy}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-medium"
        >
          {busy ? 'Enviando…' : 'Enviar (anonimizada)'}
        </button>
      )}

      {notice && <p className="text-sm text-green-300">{notice}</p>}

      <div>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">Respuesta</h3>
        {task.response ? (
          <div className="space-y-2">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 max-h-64 overflow-y-auto">
              <TokenText text={task.response} revealMapping={reveal} />
            </div>
            <button
              onClick={() => void handleCopyRestored()}
              disabled={!mapping}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-gray-200"
            >
              Copiar respuesta con datos reales
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={responseDraft}
              onChange={e => setResponseDraft(e.target.value)}
              placeholder="Pega aquí la respuesta recibida (con los tokens [[TIPO_n]]); se rehidratará localmente con los datos reales."
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveResponse}
              disabled={!responseDraft.trim()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm text-white"
            >
              Guardar respuesta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TasksPanel() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(getEndpoint);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);

  const activeTask = tasks.find(t => t.id === activeTaskId);

  const sendTask = async (task: Task): Promise<string | null> => {
    try {
      const result = await dispatchTask(task);
      if (result.method === 'ai' && result.responseText) {
        // La IA respondió directamente (con los tokens intactos): la tarea
        // queda completada y la respuesta se rehidrata solo en pantalla.
        updateTask(task.id, {
          status: 'completada',
          sentAt: new Date().toISOString(),
          response: result.responseText,
        });
        return 'La IA ha completado la tarea; respuesta rehidratada abajo.';
      }
      updateTask(task.id, { status: 'enviada', sentAt: new Date().toISOString() });
      return result.method === 'webhook' ? null : `${result.detail}.`;
    } catch (err) {
      return err instanceof Error ? `No se pudo enviar: ${err.message}` : 'No se pudo enviar';
    }
  };

  const handleComposerSave = async (
    title: string,
    result: ComposerResult,
    send: boolean
  ): Promise<void> => {
    const task: Task = {
      id: Date.now().toString(),
      title,
      instructions: result.instructions,
      documentText: result.documentText,
      documentName: result.documentName,
      entities: result.entities,
      status: 'borrador',
      createdAt: new Date().toISOString(),
    };
    // El mapeo va a la bóveda cifrada ANTES de guardar la tarea; la tarea en
    // sí solo contiene texto seudonimizado.
    await saveMapping(task.id, result.mapping);
    addTask(task);
    let message: string | null = null;
    if (send) {
      message = (await sendTask(task)) ?? 'Tarea enviada sin datos personales.';
    }
    setDetailNotice(message);
    setActiveTaskId(task.id);
    setView('detail');
  };

  if (view === 'new') {
    return <TaskComposer onCancel={() => setView('list')} onSave={handleComposerSave} />;
  }

  if (view === 'detail' && activeTask) {
    return (
      <TaskDetail
        key={activeTask.id}
        task={activeTask}
        initialNotice={detailNotice}
        onBack={() => {
          setDetailNotice(null);
          setView('list');
        }}
        onUpdate={changes => updateTask(activeTask.id, changes)}
        onDelete={() => {
          deleteTask(activeTask.id);
          setDetailNotice(null);
          setView('list');
        }}
        onSend={() => sendTask(activeTask)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <ShieldIcon className="w-6 h-6 mr-2 text-green-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Tareas privadas</h2>
            <p className="text-xs text-gray-400">Los datos personales nunca salen del teléfono</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-400 hover:text-white"
          aria-label="Configurar destino de envío"
        >
          <GearIcon className="w-5 h-5" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
          <label className="block text-sm text-gray-300">
            Endpoint de envío (webhook de tu automatización o asistente)
          </label>
          <input
            type="url"
            value={endpointDraft}
            onChange={e => setEndpointDraft(e.target.value)}
            placeholder="https://... (vacío = compartir/copiar manualmente)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              setEndpoint(endpointDraft);
              setShowSettings(false);
            }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white"
          >
            Guardar
          </button>
          <p className="text-xs text-gray-500">
            Al endpoint solo llega la versión anonimizada de cada tarea; los valores reales quedan
            cifrados en este dispositivo.
          </p>
        </div>
      )}

      <button
        onClick={() => setView('new')}
        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
      >
        <PlusIcon className="w-5 h-5 mr-2" />
        Nueva tarea privada
      </button>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Crea una tarea, adjunta un documento y revisa qué sale del teléfono antes de enviarla.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map(task => (
            <li key={task.id}>
              <button
                onClick={() => {
                  setActiveTaskId(task.id);
                  setView('detail');
                }}
                className="w-full text-left bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white truncate mr-2">{task.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${STATUS_STYLES[task.status]}`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(task.createdAt).toLocaleString('es-ES')} ·{' '}
                  {task.entities.length} dato{task.entities.length === 1 ? '' : 's'} protegido
                  {task.entities.length === 1 ? '' : 's'}
                  {task.documentName ? ` · ${task.documentName}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
