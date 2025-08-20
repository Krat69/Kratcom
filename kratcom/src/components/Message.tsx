import { Message as MessageType, User } from '../types';

interface MessageProps {
  message: MessageType;
  user?: User;
}

export function Message({ message, user }: MessageProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  return (
    <div className="flex space-x-3 hover:bg-gray-700/50 p-2 -m-2 rounded">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-sm font-semibold text-white">
          {user?.avatar || '?'}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-white">
            {user?.name || 'Usuario desconocido'}
          </span>
          <span className="text-xs text-gray-400">
            {formatDate(message.timestamp)} a las {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="text-gray-300 mt-1 break-words">{message.text}</p>
      </div>
    </div>
  );
}
