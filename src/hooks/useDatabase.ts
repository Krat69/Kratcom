import { useState, useEffect } from 'react';
import type { WorkspaceData } from '@/types';

// En un escenario real, estas serían URLs de tu API
const API_BASE_URL = '/api'; 

// Esta función simula la obtención de datos iniciales del backend.
const fetchInitialData = async (): Promise<WorkspaceData> => {
  // Simulación de datos para demostración. Reemplazar con llamadas fetch reales.
  // const response = await fetch(`${API_BASE_URL}/workspace-data`);
  // if (!response.ok) throw new Error('Failed to fetch data');
  // return response.json();
  const now = new Date();
  const users = [
    { id: 'user-1', name: 'Elena Vargas', avatar: 'https://i.pravatar.cc/40?u=user-1', title: 'Socia Directora' },
    { id: 'user-2', name: 'Carlos Mendoza', avatar: 'https://i.pravatar.cc/40?u=user-2', title: 'Abogado Senior' },
    { id: 'user-3', name: 'Sofía Castillo', avatar: 'https://i.pravatar.cc/40?u=user-3', title: 'Abogada Asociada' },
    { id: 'user-4', name: 'Javier Ríos', avatar: 'https://i.pravatar.cc/40?u=user-4', title: 'Pasante' },
  ];

  return Promise.resolve({
    currentUser: users[0],
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
       { id: 'channel-3', name: 'marketing-digital', messages: [] },
       { id: 'channel-4', name: 'random', messages: [{ id: 'msg-5', userId: 'user-4', text: 'Alguien quiere ir por un café?', timestamp: new Date(now.getTime() - 1000 * 60 * 2).toISOString() }] },
    ],
  });
};

const useDatabase = () => {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
        try {
            const initialData = await fetchInitialData();
            setData(initialData);
        } catch (error) {
            console.error("Failed to initialize database from server", error);
            // Aquí se podría manejar un estado de error en la UI
        } finally {
            setLoading(false);
        }
    };
    
    initialize();

    // --- Simulación de suscripción en tiempo real ---
    // En una app real (con Firestore, Supabase, WebSockets), aquí te suscribirías a los cambios.
    // Por ejemplo: const unsubscribe = subscribeToNewMessages(handleNewMessage);
    // return () => unsubscribe(); // Limpiar la suscripción al desmontar el componente.
    // --- Fin de la simulación ---

  }, []);

  // Función para manejar la llegada de un nuevo mensaje desde el servidor
  const handleNewMessage = (newMessage: any, channelId: string) => {
    setData(prevData => {
        if (!prevData) return null;
        
        const newData = { ...prevData, channels: [...prevData.channels] };
        const channelIndex = newData.channels.findIndex(c => c.id === channelId);
        
        if (channelIndex !== -1) {
            const updatedChannel = { 
                ...newData.channels[channelIndex],
                messages: [...newData.channels[channelIndex].messages, newMessage]
            };
            newData.channels[channelIndex] = updatedChannel;
        }
        return newData;
    });
  };

  const addMessage = async (channelId: string, userId: string, text: string) => {
    if (!data) return;

    // 1. Actualización optimista (opcional pero mejora la UX)
    // Se muestra el mensaje en la UI inmediatamente.
    const optimisticMessage = {
      id: `temp-${new Date().getTime()}`,
      userId,
      text,
      timestamp: new Date().toISOString(),
    };
    handleNewMessage(optimisticMessage, channelId);

    // 2. Enviar el mensaje al backend
    try {
        /*
        const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, text }),
        });
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
        const savedMessage = await response.json();
        
        // 3. Reemplazar el mensaje optimista con el real del servidor (que ya tendrá un ID de BD)
        // La suscripción en tiempo real se encargaría de esto automáticamente en un sistema real.
        */
    } catch (error) {
        console.error("Error sending message:", error);
        // Aquí se podría revertir la actualización optimista si falla el envío.
    }
  };

  return { data, addMessage, loading };
};

export default useDatabase;