
import { useState } from 'react';  // ← Sin React
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { useDatabase } from './hooks/useDatabase';  // ← Ya correcto
import { MenuIcon, CloseIcon } from './components/Icons';

function App() {
  const { channels, users, getMessagesForChannel, addMessage } = useDatabase();
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id || '');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // As a demo, we'll hardcode the current user. In a real app, this would come from auth.
  const currentUserId = '1';

  const handleSelectChannel = (id: string) => {
    setActiveChannelId(id);
    setSidebarOpen(false); // Close sidebar on selection in mobile
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
        />

        <main className="flex-1 flex flex-col min-w-0">
          <div className="md:hidden flex items-center justify-between p-2 h-16 bg-gray-800 border-b border-gray-700">
             <div className="flex items-center">
                {activeChannel && <span className="font-bold text-white"># {activeChannel.name}</span>}
             </div>
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
                {sidebarOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
             </button>
          </div>
          {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setSidebarOpen(false)}></div>}
          
          <div className="flex-1 flex flex-col">
            <ChatWindow 
                channel={activeChannel}
                messages={messagesForChannel}
                onSendMessage={handleSendMessage}
            />
          </div>
        </main>
    </div>
  );
}

export default App;
