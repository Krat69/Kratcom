
import React from 'react';
import type { WorkspaceData } from '../types';
import { HashtagIcon, ScaleIcon } from './Icons';

interface SidebarProps {
  data: WorkspaceData;
  activeChannelId: string | null;
  setActiveChannelId: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ data, activeChannelId, setActiveChannelId }) => {

  const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
      {children}
    </h3>
  );

  const ChannelLink: React.FC<{ id: string, name: string }> = ({ id, name }) => (
    <button
      onClick={() => setActiveChannelId(id)}
      className={`flex items-center w-full text-left px-4 py-1.5 rounded-md text-gray-300 hover:bg-gray-700 transition-colors duration-150 ${activeChannelId === id ? 'bg-blue-800 text-white' : ''}`}
    >
      <HashtagIcon className="h-5 w-5 mr-2 text-gray-500" />
      <span>{name}</span>
    </button>
  );

  const UserLink: React.FC<{ name: string, title: string, avatar: string }> = ({ name, title, avatar }) => (
    <div className="flex items-center px-4 py-2 text-gray-300">
       <div className="relative mr-3">
        <img src={avatar} alt={name} className="h-8 w-8 rounded-md" />
        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-gray-900"></span>
      </div>
      <div>
        <p className="font-semibold text-sm">{name}</p>
        <p className="text-xs text-gray-400">{title}</p>
      </div>
    </div>
  );

  return (
    <div className="w-64 bg-gray-900 flex flex-col h-full border-r border-gray-700/50">
      <header className="px-4 py-3 border-b border-gray-700/50 flex items-center">
        <ScaleIcon className="h-8 w-8 text-blue-400 mr-2" />
        <div>
           <h1 className="text-lg font-bold text-white">KratCom</h1>
           <p className="text-xs text-gray-400">{data.currentUser.name}</p>
        </div>
      </header>
      
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        <div>
          <SectionHeader>Canales</SectionHeader>
          <div className="space-y-1">
            {data.channels.map((channel) => (
              <ChannelLink key={channel.id} id={channel.id} name={channel.name} />
            ))}
          </div>
        </div>
        
        <div>
          <SectionHeader>Miembros del Equipo</SectionHeader>
          <div className="space-y-1">
            {data.users.map((user) => (
              <UserLink key={user.id} name={user.name} title={user.title} avatar={user.avatar} />
            ))}
          </div>
        </div>
      </nav>

      <footer className="p-4 border-t border-gray-700/50 text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} KratCom. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default Sidebar;