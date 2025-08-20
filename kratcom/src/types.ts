
export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
}

export interface Channel {
  id: string;
  name: string;
  description: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  text: string;
  timestamp: string;
}
