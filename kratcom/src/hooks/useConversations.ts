import { useEffect, useState } from 'react';
import type { ChatMessage, Conversation } from '@/types';
import { deleteMapping } from '@/lib/vault';

const STORAGE_KEY = 'kratcom-conversations';

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.warn('Error loading conversations from localStorage:', error);
  }
  return [];
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.warn('Error saving conversations to localStorage:', error);
    }
  }, [conversations]);

  const createConversation = (): Conversation => {
    const conversation: Conversation = {
      id: Date.now().toString(),
      title: 'Nueva conversación',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations(prev => [conversation, ...prev]);
    return conversation;
  };

  const appendMessage = (conversationId: string, message: ChatMessage): void => {
    setConversations(prev =>
      prev.map(conversation => {
        if (conversation.id !== conversationId) return conversation;
        const title =
          conversation.messages.length === 0 && message.role === 'user'
            ? message.text.replace(/\[\[[A-Z_]+_\d+\]\]/g, '…').slice(0, 40) || 'Conversación'
            : conversation.title;
        return { ...conversation, title, messages: [...conversation.messages, message] };
      })
    );
  };

  const updateMessage = (conversationId: string, messageId: string, text: string): void => {
    setConversations(prev =>
      prev.map(conversation =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map(m => (m.id === messageId ? { ...m, text } : m)),
            }
          : conversation
      )
    );
  };

  const removeMessage = (conversationId: string, messageId: string): void => {
    setConversations(prev =>
      prev.map(conversation =>
        conversation.id === conversationId
          ? { ...conversation, messages: conversation.messages.filter(m => m.id !== messageId) }
          : conversation
      )
    );
  };

  const deleteConversation = (conversationId: string): void => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    // Borra también el mapeo cifrado de la bóveda del dispositivo
    void deleteMapping(conversationId);
  };

  return {
    conversations,
    createConversation,
    appendMessage,
    updateMessage,
    removeMessage,
    deleteConversation,
  };
}
