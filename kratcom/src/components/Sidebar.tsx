import type { Conversation } from '@/types';
import { ChatIcon, GearIcon, PlusIcon, ShieldIcon, TrashIcon } from '@/components/Icons';

export type AppView = 'chat' | 'tasks';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeView: AppView;
  isOpen: boolean;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onSelectTasks: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  conversations,
  activeConversationId,
  activeView,
  isOpen,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onSelectTasks,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside
      className={`
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
      `}
    >
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">KratCom</h1>
        <p className="text-sm text-gray-400">Interfaz privada de IA</p>
      </div>

      <div className="p-4 pb-2">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
            Conversaciones
          </h2>
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-500">Todavía no hay conversaciones.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map(conversation => (
                <li key={conversation.id} className="group flex items-center">
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`
                      flex-1 flex items-center px-2 py-1.5 text-left rounded min-w-0
                      transition-colors duration-150
                      ${activeView === 'chat' && activeConversationId === conversation.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }
                    `}
                  >
                    <ChatIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate text-sm">{conversation.title}</span>
                  </button>
                  <button
                    onClick={() => onDeleteConversation(conversation.id)}
                    className="p-1.5 text-gray-600 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                    aria-label={`Eliminar conversación ${conversation.title}`}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
            Espacios
          </h2>
          <button
            onClick={onSelectTasks}
            className={`
              w-full flex items-center px-2 py-1.5 text-left rounded
              transition-colors duration-150
              ${activeView === 'tasks'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }
            `}
          >
            <ShieldIcon className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate text-sm">Tareas privadas</span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <ShieldIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="ml-2 text-xs text-gray-400">
              Los datos personales nunca salen de este dispositivo
            </p>
          </div>
          <button
            onClick={onOpenSettings}
            className="p-2 text-gray-400 hover:text-white flex-shrink-0"
            aria-label="Ajustes de la IA"
          >
            <GearIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
