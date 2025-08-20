import React, { useState, useEffect, useRef } from 'react';
import type { Channel, User } from '@/types';
import { HashtagIcon, SendIcon } from '@/components/Icons';
import Message from '@/components/Message';

interface ChatWindowProps {
  channel: Channel;
  users: User[];
  currentUser: User;
  onSendMessage: (text: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ channel, users, currentUser, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [channel.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const getUserById = (userId: string): User | undefined => {
    return users.find(user => user.id === userId);
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-6 py-3 border-b border-gray-700 shadow-md z-10 md:mt-0 mt-14">
        <HashtagIcon className="h-6 w-6 text-gray-500 mr-2" />
        <h2 className="text-xl font-bold text-white">{channel.name}</h2>
      </header>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {channel.messages.map((msg) => {
            const user = getUserById(msg.userId);
            return user ? <Message key={msg.id} message={msg} user={user} /> : null;
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800">
        <form onSubmit={handleSendMessage} className="relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Enviar mensaje a #${channel.name}`}
            className="w-full bg-gray-700 rounded-lg py-3 pl-4 pr-12 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
          <button
            type="submit"
            className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:hover:text-gray-400"
            disabled={!newMessage.trim()}
          >
            <SendIcon className="h-6 w-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;