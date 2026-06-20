import { OWNERS } from '@/lib/constants/crm';
import { getTodayString } from '@/lib/crm/utils';
import type { ClientTask, Idea } from '@/lib/types/crm';

export const TASK_TYPES = [
  { id: 'call', label: 'Call', icon: 'phone' },
  { id: 'follow-up', label: 'Follow-up', icon: 'refresh-cw' },
  { id: 'proposta', label: 'Proposta', icon: 'file-text' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'meeting', label: 'Meeting', icon: 'users' },
  { id: 'altro', label: 'Altro', icon: 'check-square' },
] as const;

export const ASSIGNEES = OWNERS;

export const TASK_FILTERS = [
  { id: 'all', label: 'Tutte' },
  { id: 'open', label: 'Aperte' },
  { id: 'completed', label: 'Completate' },
  { id: 'overdue', label: 'Scadute' },
] as const;

export function getTaskTypeMeta(typeId: string) {
  return TASK_TYPES.find((t) => t.id === typeId) || TASK_TYPES[1];
}

export function isTaskOverdue(task: ClientTask): boolean {
  if (task.completed || !task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  return due < today;
}

export function isIdeaTaskOverdue(task: Idea, todayString = getTodayString()): boolean {
  if (task.status === 'Fatto' || !task.dueDate) return false;
  return task.dueDate < todayString;
}

export function isIdeaTaskInTodaySection(task: Idea, todayString = getTodayString()): boolean {
  if (!task.dueDate) return false;
  if (task.dueDate === todayString) return true;
  return isIdeaTaskOverdue(task, todayString);
}

export function sortIdeasForTodaySection(tasks: Idea[], todayString = getTodayString()): Idea[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = isIdeaTaskOverdue(a, todayString);
    const bOverdue = isIdeaTaskOverdue(b, todayString);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.name.localeCompare(b.name, 'it');
  });
}

export function filterTasks(tasks: ClientTask[], filterId: string): ClientTask[] {
  switch (filterId) {
    case 'open':
      return tasks.filter((t) => !t.completed);
    case 'completed':
      return tasks.filter((t) => t.completed);
    case 'overdue':
      return tasks.filter((t) => isTaskOverdue(t));
    default:
      return tasks;
  }
}

export function countOpenTasks(tasks: ClientTask[]): number {
  return tasks.filter((t) => !t.completed).length;
}

export function getCompletionPercent(tasks: ClientTask[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.completed).length;
  return Math.round((done / tasks.length) * 100);
}

export function sortTasksForDisplay(tasks: ClientTask[]): ClientTask[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aOver = isTaskOverdue(a);
    const bOver = isTaskOverdue(b);
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}
