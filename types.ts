
export type MessageType = 'cordial' | 'assertiva' | 'urgente' | 'negociacao';

export interface ClientRecord {
  id: string;
  name: string;
  installments: number;
  daysLate: number;
  originalValue: number;
  juros: number;
  valorTotalOriginal: number;
  valorComMargem: number;
  phone?: string;
}

export interface GeneratedMessage {
  clientId: string;
  clientName: string;
  message: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}
