export type PiiType =
  | 'PERSONA'
  | 'DNI'
  | 'NIE'
  | 'NIF_EMPRESA'
  | 'NUSS'
  | 'IBAN'
  | 'TARJETA'
  | 'TELEFONO'
  | 'EMAIL'
  | 'MATRICULA'
  | 'REF_CATASTRAL'
  | 'DIRECCION'
  | 'CP'
  | 'FECHA_NACIMIENTO'
  | 'PROTEGIDO';

export interface CustomTerm {
  value: string;
  type: PiiType;
}

export interface DetectedEntity {
  token: string;
  type: PiiType;
  count: number;
}

// Un mensaje de conversación con la IA. text se guarda SIEMPRE
// seudonimizado; los valores reales viven solo en la bóveda cifrada.
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachmentName?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export type TaskStatus = 'borrador' | 'enviada' | 'completada';

// Una tarea NUNCA contiene datos personales en claro: instructions,
// documentText y response se guardan ya seudonimizados. El mapeo
// token -> valor real vive solo en la bóveda cifrada del dispositivo.
export interface Task {
  id: string;
  title: string;
  instructions: string;
  documentName?: string;
  documentText?: string;
  entities: DetectedEntity[];
  response?: string;
  status: TaskStatus;
  createdAt: string;
  sentAt?: string;
}
