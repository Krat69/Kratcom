import { useState } from 'react';
import { Sidebar, AppView } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { TasksPanel } from './components/TasksPanel';
import { useDatabase } from './hooks/useDatabase';
import { MenuIcon, CloseIcon, ShieldIcon } from './components/Icons';
import type { Channel } from './types';

function App() {
  const { channels, users, getMessagesForChannel, addMessage } = useDatabase();
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id || '');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<AppView>('chat');

  const currentUserId = '1';

  const handleSelectChannel = (id: string) => {
    setActiveChannelId(id);
    setView('chat');
    setSidebarOpen(false);
  };

  const handleSelectView = (nextView: AppView) => {
    setView(nextView);
    setSidebarOpen(false);
  };

  const handleSendMessage = (text: string) => {
    addMessage(activeChannelId, currentUserId, text);
  };

  const activeChannel = channels.find((c: Channel) => c.id === activeChannelId);
  const messagesForChannel = getMessagesForChannel(activeChannelId);

  return (
    <div className="h-screen w-screen bg-gray-800 text-white flex overflow-hidden">
        <Sidebar
            channels={channels}
            users={users}
            activeChannelId={activeChannelId}
            onSelectChannel={handleSelectChannel}
            isOpen={sidebarOpen}
            activeView={view}
            onSelectView={handleSelectView}
        />

        <main className="flex-1 flex flex-col min-w-0">
          <div className="md:hidden flex items-center justify-between p-2 h-16 bg-gray-800 border-b border-gray-700">
             <div className="flex items-center">
                {view === 'tasks' ? (
                  <span className="flex items-center font-bold text-white">
                    <ShieldIcon className="w-5 h-5 mr-1.5 text-green-400" />
                    Tareas privadas
                  </span>
                ) : (
                  activeChannel && <span className="font-bold text-white"># {activeChannel.name}</span>
                )}
             </div>
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
                {sidebarOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
             </button>
          </div>
          {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setSidebarOpen(false)}></div>}

          <div className="flex-1 flex flex-col min-h-0">
            {view === 'tasks' ? (
              <TasksPanel />
            ) : (
              <ChatWindow
                  channel={activeChannel}
                  messages={messagesForChannel}
                  onSendMessage={handleSendMessage}
              />
            )}
          </div>
        </main>
    </div>
  );
}

export default App;
