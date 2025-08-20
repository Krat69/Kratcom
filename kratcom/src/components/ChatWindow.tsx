import React, { useState, useRef, useEffect } from 'react';
import { Channel, Message } from '@/types';
import { Message as MessageComponent } from '@/components/Message';
import { useDatabase } from '@/hooks/useDatabase';
import { SendIcon } from '@/components/Icons';

interface ChatWindowProps {
  channel?: Channel;
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export function ChatWindow({ channel, messages, onSendMessage }: ChatWindowProps) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { getUserById } = useDatabase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <p className="text-gray-400">Selecciona un canal para comenzar</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-800">
      <header className="hidden md:flex items-center px-6 py-4 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-white"># {channel.name}</h1>
          <p className="text-sm text-gray-400">{channel.description}</p>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const user = getUserById(message.userId);
          return (
            <MessageComponent
              key={message.id}
              message={message}
              user={user}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Enviar mensaje a #${channel.name}`}
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-150"
          >
            <SendIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}