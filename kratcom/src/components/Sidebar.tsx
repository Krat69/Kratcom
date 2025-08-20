import { Channel, User } from '../types';
import { HashIcon } from './Icons';

interface SidebarProps {
  channels: Channel[];
  users: User[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  isOpen: boolean;
}

export function Sidebar({ channels, users, activeChannelId, onSelectChannel, isOpen }: SidebarProps) {
  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <aside className={`
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 
        fixed md:relative 
        z-20 
        w-64 
        h-full 
        bg-gray-900 
        border-r 
        border-gray-700 
        flex 
        flex-col
        transition-transform 
        duration-300 
        ease-in-out
      `}>
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">KratCom</h1>
          <p className="text-sm text-gray-400">Tu hub de comunicación</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
              Canales
            </h2>
            <ul className="space-y-1">
              {channels.map((channel) => (
                <li key={channel.id}>
                  <button
                    onClick={() => onSelectChannel(channel.id)}
                    className={`
                      w-full flex items-center px-2 py-1 text-left rounded
                      transition-colors duration-150
                      ${activeChannelId === channel.id 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }
                    `}
                  >
                    <HashIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
              Miembros del equipo
            </h2>
            <ul className="space-y-2">
              {users.map((user) => (
                <li key={user.id} className="flex items-center">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-xs font-semibold text-white">
                      {user.avatar}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(user.status)}`}></div>
                  </div>
                  <span className="ml-2 text-sm text-gray-300 truncate">{user.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-semibold text-white">
              AG
            </div>
            <div className="ml-2">
              <p className="text-sm font-medium text-white">Ana García</p>
              <p className="text-xs text-gray-400">En línea</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
