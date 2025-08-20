import { useState, useEffect } from 'react';
import type { WorkspaceData } from '@/types';

const DB_KEY = 'slack-clone-db';

const createInitialData = (): WorkspaceData => {
  const now = new Date();
  const users = [
    { id: 'user-1', name: 'Elena Vargas', avatar: 'https://i.pravatar.cc/40?u=user-1', title: 'Socia Directora' },
    { id: 'user-2', name: 'Carlos Mendoza', avatar: 'https://i.pravatar.cc/40?u=user-2', title: 'Abogado Senior' },
    { id: 'user-3', name: 'Sofía Castillo', avatar: 'https://i.pravatar.cc/40?u=user-3', title: 'Abogada Asociada' },
    { id: 'user-4', name: 'Javier Ríos', avatar: 'https://i.pravatar.cc/40?u=user-4', title: 'Pasante' },
  ];

  return {
    currentUser: users[0], // Elena is the default user
    users: users,
    channels: [
      {
        id: 'channel-1',
        name: 'general',
        messages: [
          { id: 'msg-1', userId: 'user-1', text: '¡Bienvenidos al nuevo canal de comunicación del despacho! Este será nuestro espacio para coordinar todo.', timestamp: new Date(now.getTime() - 1000 * 60 * 5).toISOString() },
          { id: 'msg-2', userId: 'user-2', text: 'Excelente iniciativa. Esto agilizará mucho las cosas.', timestamp: new Date(now.getTime() - 1000 * 60 * 3).toISOString() },
        ],
      },
      {
        id: 'channel-2',
        name: 'caso-gonzalez',
        messages: [
           { id: 'msg-3', userId: 'user-3', text: 'He subido los documentos preliminares del caso González. Por favor, revisarlos.', timestamp: new Date(now.getTime() - 1000 * 60 * 10).toISOString() },
           { id: 'msg-4', userId: 'user-1', text: 'Recibido. Les echo un vistazo esta tarde. Buen trabajo, Sofía.', timestamp: new Date(now.getTime() - 1000 * 60 * 9).toISOString() },
        ],
      },
      {
        id: 'channel-3',
        name: 'marketing-digital',
        messages: [],
      },
      {
        id: 'channel-4',
        name: 'random',
        messages: [
          { id: 'msg-5', userId: 'user-4', text: 'Alguien quiere ir por un café?', timestamp: new Date(now.getTime() - 1000 * 60 * 2).toISOString() }
        ],
      },
    ],
  };
};


const useMockDatabase = () => {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(DB_KEY);
      if (storedData) {
        setData(JSON.parse(storedData));
      } else {
        const initialData = createInitialData();
        localStorage.setItem(DB_KEY, JSON.stringify(initialData));
        setData(initialData);
      }
    } catch (error) {
      console.error("Failed to initialize database from localStorage", error);
      const initialData = createInitialData();
      setData(initialData);
    } finally {
        setLoading(false);
    }
  }, []);

  const addMessage = (channelId: string, userId: string, text: string) => {
    if (!data) return;

    const newMessage = {
      id: `msg-${new Date().getTime()}`,
      userId,
      text,
      timestamp: new Date().toISOString(),
    };

    const newData = { ...data };
    const channelIndex = newData.channels.findIndex(c => c.id === channelId);
    
    if (channelIndex !== -1) {
      const updatedChannel = { ...newData.channels[channelIndex] };
      updatedChannel.messages = [...updatedChannel.messages, newMessage];
      newData.channels[channelIndex] = updatedChannel;

      setData(newData);
      localStorage.setItem(DB_KEY, JSON.stringify(newData));
    }
  };

  return { data, addMessage, loading };
};

export default useMockDatabase;