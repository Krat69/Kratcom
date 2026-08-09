import { useEffect, useState } from 'react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {
  loadDiaryDays,
  loadDiaryEntries,
  readMemoryRaw,
  writeMemoryRaw,
} from '@/lib/memory';
import type { DiaryEntry } from '@/lib/memory';
import { MEMORY_FILE, diaryPath } from '@/lib/memory/paths';
import { deleteFile, memoryFolderUri, readFile } from '@/lib/memory/store';
import { BookIcon, ShieldIcon, TrashIcon } from '@/components/Icons';

// Panel de memoria: el usuario tiene que poder ver, corregir y borrar todo lo
// que la app recuerda de él. Una memoria persistente que no se puede auditar
// es una memoria en la que no se puede confiar.

type Tab = 'memoria' | 'diario';

export function MemoryPanel() {
  const [tab, setTab] = useState<Tab>('memoria');
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [folder, setFolder] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [content, uri, diaryDays] = await Promise.all([
        readMemoryRaw(),
        memoryFolderUri(),
        loadDiaryDays(),
      ]);
      setDraft(content);
      setSaved(content);
      setFolder(uri);
      setDays(diaryDays);
      setLoading(false);
    })();
  }, []);

  const dirty = draft !== saved;

  const handleSave = async () => {
    await writeMemoryRaw(draft);
    setSaved(draft);
    setNotice('Memoria guardada. La app respetará tus cambios.');
  };

  const handleOpenDay = async (day: string) => {
    if (openDay === day) {
      setOpenDay(null);
      return;
    }
    setOpenDay(day);
    setDayEntries(await loadDiaryEntries(day));
  };

  const handleDeleteDay = async (day: string) => {
    await deleteFile(diaryPath(day));
    setDays(prev => prev.filter(d => d !== day));
    if (openDay === day) setOpenDay(null);
    setNotice(`Diario del ${day} borrado.`);
  };

  const handleShare = async () => {
    const content = await readFile(MEMORY_FILE);
    if (!content) return;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'memoria.md', text: content, dialogTitle: 'Exportar memoria' });
      } else {
        await navigator.clipboard.writeText(content);
        setNotice('memoria.md copiado al portapapeles.');
      }
    } catch {
      // el usuario canceló el diálogo de compartir
    }
  };

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-gray-400">Cargando memoria…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center">
        <BookIcon className="w-6 h-6 mr-2 text-green-400" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">Memoria</h2>
          <p className="text-xs text-gray-400 truncate" title={folder}>
            {folder}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['memoria', 'diario'] as Tab[]).map(name => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              tab === name ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {name === 'memoria' ? 'memoria.md' : `Diario (${days.length})`}
          </button>
        ))}
      </div>

      {notice && <p className="text-xs text-green-300">{notice}</p>}

      {tab === 'memoria' ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              setNotice(null);
            }}
            spellCheck={false}
            rows={20}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={!dirty}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg text-sm text-white font-medium"
            >
              Guardar cambios
            </button>
            <button
              onClick={() => setDraft(saved)}
              disabled={!dirty}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-sm text-gray-200"
            >
              Descartar
            </button>
            <button
              onClick={() => void handleShare()}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200"
            >
              Exportar
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Es un fichero Markdown normal y corriente. Puedes editarlo aquí o con cualquier otra
            app: las líneas que escribas a mano no se modifican ni se borran solas.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              Todavía no hay diarios. Se crea uno por cada día que uses la app.
            </p>
          ) : (
            <ul className="space-y-1">
              {days.map(day => (
                <li key={day} className="bg-gray-900 border border-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <button
                      onClick={() => void handleOpenDay(day)}
                      className="flex-1 text-left px-3 py-2 text-sm text-gray-200 hover:text-white"
                    >
                      {new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </button>
                    <button
                      onClick={() => void handleDeleteDay(day)}
                      className="p-2 text-gray-600 hover:text-red-400"
                      aria-label={`Borrar el diario del ${day}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  {openDay === day && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-800 pt-2">
                      {dayEntries.length === 0 ? (
                        <p className="text-xs text-gray-500">Sin entradas.</p>
                      ) : (
                        dayEntries.map(entry => (
                          <div key={`${entry.dateKey}-${entry.time}`} className="text-xs">
                            <p className="text-gray-500">{entry.time}</p>
                            <p className="text-gray-300 whitespace-pre-wrap">{entry.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-start bg-green-900/40 border border-green-700 rounded-lg p-3 text-xs text-green-200">
        <ShieldIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
        <p>
          Todo esto vive únicamente en este dispositivo. La app no tiene servidores ni cuentas: la
          única vez que usa la red es para descargar el modelo.
        </p>
      </div>
    </div>
  );
}
