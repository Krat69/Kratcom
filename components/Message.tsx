
import React from 'react';
import type { Message as MessageType, User } from '../types';

interface MessageProps {
  message: MessageType;
  user: User;
}

const Message: React.FC<MessageProps> = ({ message, user }) => {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start space-x-4 group">
      <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-lg flex-shrink-0 mt-1" />
      <div className="flex-1">
        <div className="flex items-baseline space-x-2">
          <span className="font-bold text-white">{user.name}</span>
          <span className="text-xs text-gray-500">{formattedTime}</span>
        </div>
        <p className="text-gray-200 whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
};

export default Message;
   