export const CLIENT_ACTION_TYPES = [
  'Call',
  'Mail',
  'Incontro',
  'Messaggio',
  'Proposta inviata',
  'Feedback',
  'Nota',
] as const;

export type ClientActionType = typeof CLIENT_ACTION_TYPES[number];

export interface ClientAction {
  id: string;
  clientId: string;
  actionType: string;
  actionDate: string;
  note: string;
  author: string;
  createdAt: string;
}

/** Azione mostrata nella scheda cliente: dal registro cliente o da una campagna del funnel. */
export interface ClientActivityItem {
  key: string;
  source: 'client' | 'funnel';
  actionType: string;
  date: string;
  note: string;
  detail: string;
  sortStamp: string;
}
