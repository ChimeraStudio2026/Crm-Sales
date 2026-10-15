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
  contactId: string;
  /** Giorni senza una nuova azione dopo cui il semaforo Accounting diventa rosso. */
  redAfterDays: number | null;
  /** Solo sulle azioni di chiusura Accounting: esito del ciclo di azioni. */
  outcome: AccountingOutcome | null;
  /** Obiettivo opzionale dell'azione (es. cosa si vuole ottenere con un'azione Accounting). */
  objective?: string;
  /** Obiettivo Account a cui appartiene l'azione (le azioni Account si vedono solo nel loro obiettivo). */
  objectiveId?: string;
}

export type AccountingOutcome = 'won' | 'lost';

export const ACCOUNTING_ACTION_TYPE = 'Accounting';

/** Chiude il ciclo di azioni Accounting su un cliente con un esito won/lost. */
export const ACCOUNTING_CLOSE_ACTION_TYPE = 'Chiusura Accounting';

/** Obiettivo Account: uno o più clienti su cui si lavora con azioni preimpostate e una nota. */
export interface AccountObjective {
  id: string;
  workspaceId: string;
  title: string;
  note: string;
  owner: string;
  clientIds: string[];
  createdAt: string;
}

/** Tipi di azione preimpostati negli obiettivi Account (come nelle campagne sales, senza gli esiti). */
export const ACCOUNT_OBJECTIVE_ACTION_TYPES = [
  'Call',
  'Mail Di contatto',
  'Incontro in presenza',
  'Messaggio',
  'Instagram',
  'Fissato appuntamento',
  'Presentazione Mandata',
  'Quotazione richiesta',
  'Da scaldare',
] as const;

/** Azione registrata dal Reminder: call di presentazione Chimera a un cliente nuovo. */
export const CALL_DEBRIEF_ACTION_TYPE = 'Call debrief';

export const RED_AFTER_DAYS_OPTIONS = [3, 7, 30] as const;

export const DEFAULT_RED_AFTER_DAYS = 7;

/** Azione mostrata nella scheda cliente: dal registro cliente o da una campagna del funnel. */
export interface ClientActivityItem {
  key: string;
  source: 'client' | 'funnel';
  actionType: string;
  date: string;
  note: string;
  objective?: string;
  detail: string;
  sortStamp: string;
}
