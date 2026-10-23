export interface ClientContact {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string;
}

export interface ClientActionLogEntry {
  id: string;
  text: string;
  date: string;
}

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  type: ClientType;
  owner: Owner;
  clientOrigin: ClientOrigin | '';
  relationship: Relationship;
  manualRelationship: boolean;
  rev2023: number;
  rev2024: number;
  rev2025: number;
  rev2026: number;
  rev2027: number;
  action: string;
  actionDate: string;
  email: string;
  description: string;
  contacts: ClientContact[];
  productOffers: string[];
  actionLog?: ClientActionLogEntry[];
  needsProfileCompletion: boolean;
  isColdClient: boolean;
  /** Cliente principale del gruppo, se questo cliente è una sua ragione sociale (es. Campari). */
  parentClientId?: string;
}

export interface Idea {
  id: string;
  name: string;
  category: IdeaCategory;
  clientId: string;
  status: IdeaStatus;
  description: string;
  dateAdded: string;
  itemType: IdeaItemType;
  dueDate: string;
  assignees: Owner[];
  attachments: TaskAttachment[];
  subtasks: TaskSubtask[];
}

export interface ClientTask {
  id: string;
  clientId: string;
  title: string;
  taskType: TaskType;
  dueDate: string;
  assignee: Owner;
  completed: boolean;
  notes: string;
  createdAt: string;
  completedAt: string;
}

export interface OkrRecord {
  id: string;
  clientName: string;
  clientId: string;
  productType: string;
  amount: number;
  monthLabel: string;
  quarter: number;
  projectCode: string;
  owner: string;
  year: number;
  monthNumber?: number;
  sourceUpdatedAt?: string;
}

export interface AnalysisForecastScope {
  totalForecast: number;
  productPct: Record<string, number>;
}

export type AnalysisForecasts = Record<string, AnalysisForecastScope>;

export type AnalysisForecastsByYear = Record<number, AnalysisForecasts>;

export interface ParsedExcelClient {
  name: string;
  revenue: number;
  recordCount: number;
  year: number;
}

export type ClientType =
  | 'Cliente Diretto'
  | 'Agenzia'
  | 'Agenzia PR'
  | 'CDP'
  | 'Agenzia Eventi';

export type Owner = 'Virginia Velcich' | 'Jeck Scardy' | 'Martina Gavazzi' | 'Martino';

export type ClientOrigin = 'Jeck' | 'Inbound' | 'Instagram' | 'Community' | 'Outbound' | 'Word Of Mouth' | 'Martino';

export type Relationship =
  | 'Freddo'
  | 'Nuovo Cliente'
  | 'Ricorrente'
  | 'Top 20%'
  | 'Da recuperare'
  | 'Eliminato';

export type IdeaCategory = 'Content' | 'Mini prod' | 'Evento' | 'Prod';

export type IdeaStatus = 'Da fare' | 'In progress' | 'Fatto';

export type IdeaItemType = 'idea' | 'task';

export type TaskType =
  | 'call'
  | 'follow-up'
  | 'proposta'
  | 'email'
  | 'meeting'
  | 'altro';

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface ApolloEnrichResult {
  ok: boolean;
  email?: string;
  phone?: string;
  website?: string;
  domain?: string;
  industry?: string;
  linkedinUrl?: string;
  employeeCount?: number | null;
  description?: string;
  organizationName?: string;
  error?: string;
}
