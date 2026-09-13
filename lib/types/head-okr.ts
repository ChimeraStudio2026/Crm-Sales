export const HEAD_OKR_STATUS_OPTIONS = [
  'Not Started',
  'In Progress',
  'Done',
  'Blocked',
] as const;

export type HeadOkrKeyResultStatus = (typeof HEAD_OKR_STATUS_OPTIONS)[number];

export interface HeadOkrKeyResult {
  id: string;
  title: string;
  status: HeadOkrKeyResultStatus | string;
  evaluationMetric: string;
  valueLabel: string;
  adminNote: string;
  sortOrder: number;
}

export interface HeadOkrObjective {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  keyResults: HeadOkrKeyResult[];
}

export interface HeadOkrCheckpoint {
  id: string;
  title: string;
  sortOrder: number;
  objectives: HeadOkrObjective[];
}

export interface HeadOkrProgramContent {
  checkpoints: HeadOkrCheckpoint[];
}

export interface HeadOkrProgram {
  id: string;
  workspaceId: string;
  headName: string;
  roleTitle: string;
  sheetTitle: string;
  frameworkLabel: string;
  frameworkStartDate: string | null;
  introText: string;
  content: HeadOkrProgramContent;
  createdAt: string;
  updatedAt: string;
}

export interface HeadOkrProgramDraft {
  headName: string;
  roleTitle: string;
  sheetTitle: string;
  frameworkLabel: string;
  frameworkStartDate: string | null;
  introText: string;
  content: HeadOkrProgramContent;
}
