import { useState, useEffect } from 'react';
import { User, Channel, Message } from '@/types';

const STORAGE_KEY = 'kratcom-data';

const mockChannels: Channel[] = [
  { id: '1', name: 'general', description: 'Canal principal del equipo' },
  { id: '2', name: 'desarrollo', description: 'Discusiones técnicas y desarrollo' },
  { id: '3', name: 'marketing', description: 'Estrategias y campañas de marketing' },
];

const mockUsers: User[] = [
  { id: '1', name: 'Ana García', avatar: 'AG', status: 'online' },
  { id: '2', name: 'Carlos López', avatar: 'CL', status: 'away' },
  { id: '3', name: 'Elena Vargas', avatar: 'EV', status: 'online' },
  { id: '4', name: 'Miguel Torres', avatar: 'MT', status: 'offline' },
];

const mockMessages: Message[] = [
  {
    id: '1',
    channelId: '1',
    userId: '2',
    text: '¡Bienvenidos al canal general! Este es el lugar para discusiones generales del equipo.',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '2',
    channelId: '1',
    userId: '3',
    text: 'Perfecto, ¡ya estamos todos conectados!',
    timestamp: new Date(Date.now() - 82800000).toISOString(),
  },
  {
    id: '3',
    channelId: '2',
    userId: '1',
    text: 'Hola equipo de desarrollo. Vamos a usar este canal para coordinar nuestro trabajo técnico.',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '4',
    channelId: '2',
    userId: '4',
    text: 'Excelente. ¿Cuáles son las prioridades para esta semana?',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '5',
    channelId: '3',
    userId: '3',
    text: 'Canal de marketing listo. Aquí coordinaremos todas nuestras campañas.',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
];

interface DatabaseState {
  channels: Channel[];
  users: User[];
  messages: Message[];
}

function loadFromStorage(): DatabaseState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Error loading from localStorage:', error);
  }
  
  return {
    channels: mockChannels,
    users: mockUsers,
    messages: mockMessages,
  };
}

function saveToStorage(state: DatabaseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Error saving to localStorage:', error);
  }
}

export function useDatabase() {
  const [state, setState] = useState<DatabaseState>(loadFromStorage);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const getMessagesForChannel = (channelId: string): Message[] => {
    return state.messages
      .filter(message => message.channelId === channelId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const addMessage = (channelId: string, userId: string, text: string): void => {
    const newMessage: Message = {
      id: Date.now().toString(),
      channelId,
      userId,
      text,
      timestamp: new Date().toISOString(),
    };

    setState(prevState => ({
      ...prevState,
      messages: [...prevState.messages, newMessage],
    }));
  };

  const getUserById = (userId: string): User | undefined => {
    return state.users.find(user => user.id === userId);
  };

  return {
    channels: state.channels,
    users: state.users,
    messages: state.messages,
    getMessagesForChannel,
    addMessage,
    getUserById,
  };
}