import { useState } from 'react';
import { Sidebar, AppView } from './components/Sidebar';
import { AIChat } from './components/AIChat';
import { AISettings } from './components/AISettings';
import { TasksPanel } from './components/TasksPanel';
import { useConversations } from './hooks/useConversations';
import { MenuIcon, CloseIcon, ShieldIcon, PlusIcon } from './components/Icons';

function App() {
  const {
    conversations,
    createConversation,
    appendMessage,
    updateMessage,
    removeMessage,
    deleteConversation,
  } = useConversations();
  const [view, setView] = useState<AppView>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversations[0]?.id ?? null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeConversation =
    conversations.find(c => c.id === activeConversationId) ?? null;

  const handleNewConversation = () => {
    const conversation = createConversation();
    setActiveConversationId(conversation.id);
    setView('chat');
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setView('chat');
    setSidebarOpen(false);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    if (activeConversationId === id) setActiveConversationId(null);
  };

  const headerTitle =
    view === 'tasks' ? 'Tareas privadas' : activeConversation?.title ?? 'KratCom';

  return (
    <div className="h-screen w-screen bg-gray-800 text-white flex overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeView={view}
        isOpen={sidebarOpen}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onSelectTasks={() => {
          setView('tasks');
          setSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setSettingsOpen(true);
          setSidebarOpen(false);
        }}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center justify-between p-2 h-16 bg-gray-800 border-b border-gray-700">
          <span className="flex items-center font-bold text-white truncate">
            <ShieldIcon className="w-5 h-5 mr-1.5 text-green-400 flex-shrink-0" />
            <span className="truncate">{headerTitle}</span>
          </span>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 flex-shrink-0">
            {sidebarOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-10"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {view === 'tasks' ? (
            <TasksPanel />
          ) : activeConversation ? (
            <AIChat
              conversation={activeConversation}
              appendMessage={appendMessage}
              updateMessage={updateMessage}
              removeMessage={removeMessage}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-md space-y-4">
                <ShieldIcon className="w-14 h-14 mx-auto text-green-500" />
                <h2 className="text-xl font-bold text-white">KratCom · Interfaz privada de IA</h2>
                <p className="text-sm text-gray-400">
                  Habla con la IA o encárgale tareas con documentos. Los datos personales se
                  seudonimizan en tu dispositivo antes de salir, y las respuestas se rehidratan
                  localmente: la IA nunca ve a quién se refieren.
                </p>
                <button
                  onClick={handleNewConversation}
                  className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Nueva conversación
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {settingsOpen && <AISettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default App;
