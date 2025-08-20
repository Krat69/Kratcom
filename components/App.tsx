
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import useDatabase from './hooks/useDatabase';
import type { Channel } from './types';
import { MenuIcon, XIcon } from './components/Icons';

const App: React.FC = () => {
  const { data, addMessage, loading } = useDatabase();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!activeChannelId && data && data.channels.length > 0) {
      setActiveChannelId(data.channels[0].id);
    }
  }, [data, activeChannelId]);

  const activeChannel = useMemo((): Channel | undefined => {
    return data?.channels.find(c => c.id === activeChannelId);
  }, [data, activeChannelId]);

  const handleSendMessage = useCallback((text: string) => {
    if (activeChannelId && data?.currentUser.id) {
      addMessage(activeChannelId, data.currentUser.id, text);
    }
  }, [activeChannelId, addMessage, data?.currentUser.id]);
  
  const handleSelectChannel = useCallback((channelId: string) => {
      setActiveChannelId(channelId);
      if (window.innerWidth < 768) {
          setIsSidebarOpen(false);
      }
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Cargando KratCom...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-800 text-gray-100 flex overflow-hidden">
      {/* Mobile Menu Button */}
      <div className="absolute top-2 left-2 z-30 md:hidden">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600">
              {isSidebarOpen ? <XIcon className="h-6 w-6"/> : <MenuIcon className="h-6 w-6"/>}
          </button>
      </div>

      {/* Sidebar */}
      <div className={`absolute z-20 md:relative h-full transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <Sidebar
          data={data}
          activeChannelId={activeChannelId}
          setActiveChannelId={handleSelectChannel}
        />
      </div>

      {/* Main Chat Window */}
      <main className="flex-1 flex flex-col h-full">
        {activeChannel && data.users ? (
          <ChatWindow
            key={activeChannel.id}
            channel={activeChannel}
            users={data.users}
            onSendMessage={handleSendMessage}
            currentUser={data.currentUser}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            Seleccione un canal para comenzar.
          </div>
        )}
      </main>
    </div>
  );
};

export default App;