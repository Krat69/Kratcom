
export interface User {
  id: string;
  name: string;
  avatar: string;
  title: string;
}

export interface Message {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
}

export interface Channel {
  id: string;
  name: string;
  messages: Message[];
}

export interface WorkspaceData {
  currentUser: User;
  users: User[];
  channels: Channel[];
}
   